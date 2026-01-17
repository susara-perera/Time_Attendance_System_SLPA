import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [lastVerified, setLastVerified] = useState(0);

  // Check for existing token on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Verify token with backend
          const response = await fetch('http://localhost:5000/api/auth/verify', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              setUser(data.user);
              setTokenVerified(true);
              setLastVerified(Date.now());
              // Fetch available roles once to enable role-based permission lookups
              (async () => {
                try {
                  const rolesRes = await fetch('http://localhost:5000/api/roles', {
                    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
                  });
                  if (rolesRes.ok) {
                    const rolesData = await rolesRes.json().catch(() => ({}));
                    if (rolesData && rolesData.data) setRolesList(rolesData.data);
                  }
                } catch (err) { /* ignore */ }
              })();
            } else {
              localStorage.removeItem('token');
            }
          } else {
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Refresh current user when permissions change elsewhere in the app
  useEffect(() => {
    const handler = async (e) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        // Only verify token if it hasn't been verified in the last 30 seconds
        const now = Date.now();
        if (now - lastVerified < 30000) return;
        
        // Refresh user data
        const res = await fetch('http://localhost:5000/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (data && data.success && data.user) {
          setUser(data.user);
          setLastVerified(now);
        }
        // Also refresh roles list to pick up permission changes
        const rolesRes = await fetch('http://localhost:5000/api/roles', {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json().catch(() => ({}));
          if (rolesData && rolesData.data) setRolesList(rolesData.data);
        }
      } catch (err) {
        console.warn('permissionsChanged handler error:', err);
      }
    };

    window.addEventListener('permissionsChanged', handler);
    // Listen for explicit profile updates from other components
    const profileHandler = (ev) => {
      try {
        const newUser = ev?.detail;
        if (newUser) {
          setUser(newUser);
        } else {
          // fallback: fetch latest profile
          (async () => {
            try {
              const token = localStorage.getItem('token');
              if (!token) return;
              const res = await fetch('http://localhost:5000/api/auth/me', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                credentials: 'include'
              });
              if (!res.ok) return;
              const data = await res.json();
              if (data && data.success && data.data) setUser(data.data);
            } catch (err) { /* ignore */ }
          })();
        }
      } catch (err) {
        console.warn('profileUpdated handler error:', err);
      }
    };
    window.addEventListener('profileUpdated', profileHandler);
    return () => {
      window.removeEventListener('permissionsChanged', handler);
      window.removeEventListener('profileUpdated', profileHandler);
    };
  }, []);

  // Helper: get effective permissions for the current user by merging explicit user.permissions
  // with permissions defined on their role (rolesList). Returns an object map.
  const getEffectivePermissions = () => {
    const explicit = user?.permissions || {};
    if (!user?.role) return explicit;
    // Prefer role-defined permissions: role-based model
    const roleMatch = rolesList.find(r => r.value === user.role || r.value === user?.role || r.label === user.role || r._id === user.role);
    const rolePerms = (roleMatch && roleMatch.permissions) ? roleMatch.permissions : null;
    // If role defines permissions, use those (role-based permissions). Otherwise fall back to explicit user.permissions
    return rolePerms || explicit;
  };

  // Helper: check a permission by flexible identifiers. Accepts either dotted path
  // like 'roles.create' or single ids like 'create_role' or 'view_roles'. Returns boolean.
  const hasPermission = (permId) => {
    if (!user) return false;
    // Super admin shortcut
    if (user?.role === 'super_admin' || user?.role === 'admin') return true;
    const perms = getEffectivePermissions();
    if (!perms) return false;

    // If permId contains a dot, resolve nested object
    if (permId.includes('.')) {
      const parts = permId.split('.');
      let cur = perms;
      for (const p of parts) {
        if (!cur) return false;
        cur = cur[p];
      }
      if (cur) return !!cur;
      // Fallback: check for underscore version, e.g., settings.view -> settings.settings_view
      const underscoreId = parts.join('_');
      if (perms[parts[0]] && perms[parts[0]][underscoreId]) return true;
      return false;
    }

    // Try direct keys (create_role, view_roles)
    if (perms[permId] === true) return true;

    // Try to map common patterns: e.g., 'create_role' -> perms.role_management?.create_role or perms.roles?.create
    const underscoreParts = permId.split('_');
    if (underscoreParts.length >= 2) {
      const action = underscoreParts[0];
      const resource = underscoreParts.slice(1).join('_');
      // check perms[resource]?.[action]
      if (perms[resource] && typeof perms[resource] === 'object' && perms[resource][action]) return true;
      // check role_management or roles
      if (perms.role_management && perms.role_management[permId]) return true;
      if (perms.roles && perms.roles[action]) return true;
    }

    return false;
  };

  const login = async (credentials) => {
    try {
      console.log('Attempting login with credentials:', credentials);
      
      // Make API call to backend for authentication
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error(data.message || 'Invalid credentials');
        } else if (response.status === 423) {
          throw new Error('Account locked due to multiple failed attempts');
        } else if (response.status === 403) {
          throw new Error('Account deactivated. Contact administrator');
        } else {
          throw new Error(data.message || 'Login failed');
        }
      }

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      // Validate user data
      if (!data.user || !data.user.id) {
        throw new Error('Invalid user data received');
      }

      // Check if user is active
      if (data.user.isActive === false) {
        throw new Error('Your account has been deactivated');
      }

      // Store token and user data
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Save cache preload status (if returned by server)
      if (data.cache) setCacheStatus(data.cache);

      // Set preliminary user then fetch full profile to populate fields like phone/address
      setUser(data.user);
      try {
        const token = data.token || localStorage.getItem('token');
        if (token) {
          const meRes = await fetch('http://localhost:5000/api/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          if (meRes.ok) {
            const meData = await meRes.json().catch(() => ({}));
            if (meData && meData.success && meData.data) {
              setUser(meData.data);
            }
          }
        }
      } catch (err) {
        // ignore
      }
      return data;

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Call backend logout
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clean up local state
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const value = {
    user,
    rolesList,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    cacheStatus
  };
  // expose hasPermission helper in context value
  value.hasPermission = hasPermission;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};