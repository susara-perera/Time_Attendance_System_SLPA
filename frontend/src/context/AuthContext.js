import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        }
      } catch (err) {
        console.warn('permissionsChanged handler error:', err);
      }
    };

    window.addEventListener('permissionsChanged', handler);
    return () => window.removeEventListener('permissionsChanged', handler);
  }, []);

  // Poll backend periodically to pick up permission changes made by other users/sessions
  useEffect(() => {
    let intervalId;
    const startPolling = () => {
      intervalId = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
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
            // Update local user only if permissions changed to avoid unnecessary rerenders
            const currentPerms = JSON.stringify(user?.permissions || {});
            const newPerms = JSON.stringify(data.user.permissions || {});
            if (currentPerms !== newPerms) {
              setUser(data.user);
            }
          }
        } catch (err) {
          // Ignore polling errors silently
        }
      }, 15000); // every 15 seconds
    };

    if (user) startPolling();
    return () => clearInterval(intervalId);
  }, [user]);

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
      
      setUser(data.user);
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
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};