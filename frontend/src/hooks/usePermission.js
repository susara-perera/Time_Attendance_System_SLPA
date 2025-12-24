import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// usePermission(resource, action) -> boolean
// resource: string like 'users', 'divisions', 'attendance'
// action: 'read'|'create'|'update'|'delete'|'edit'
export default function usePermission(resource, action) {
  const { user, hasPermission } = useContext(AuthContext) || {};
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;

  // Use the context's hasPermission which handles role-based permissions
  return hasPermission(`${resource}.${action}`);
};
