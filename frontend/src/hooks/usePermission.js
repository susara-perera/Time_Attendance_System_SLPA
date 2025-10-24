import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// usePermission(resource, action) -> boolean
// resource: string like 'users', 'divisions', 'attendance'
// action: 'read'|'create'|'update'|'delete'|'edit'
export default function usePermission(resource, action) {
  const { user } = useContext(AuthContext) || {};
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  const perms = user.permissions;
  if (!perms) return false;

  // Normalize action aliases
  const actionAliases = {
    read: ['read', 'view'],
    create: ['create', 'add'],
    update: ['update', 'edit'],
    delete: ['delete', 'remove']
  };

  const actionsToCheck = actionAliases[action] || [action];

  // Check plural/singular resource variants
  const resourcesToCheck = [resource];
  if (resource.endsWith('s')) resourcesToCheck.push(resource.slice(0, -1));
  else resourcesToCheck.push(resource + 's');

  for (const r of resourcesToCheck) {
    const rPerm = perms[r];
    if (rPerm === undefined) continue;

    // boolean permission shortcut
    if (typeof rPerm === 'boolean') {
      if (rPerm) return true;
      continue;
    }

    // array of allowed actions
    if (Array.isArray(rPerm)) {
      for (const a of actionsToCheck) if (rPerm.includes(a)) return true;
      continue;
    }

    // object mapping actions -> boolean
    if (typeof rPerm === 'object' && rPerm !== null) {
      for (const a of actionsToCheck) {
        const val = rPerm[a];
        if (val === true || val === 'true' || val === 1) return true;
      }
    }
  }

  // optional debug
  try {
    if (typeof window !== 'undefined' && window.DEBUG_PERMS) {
      console.debug('usePermission', { user: user?.id || user?.email, resource, action, resourcesToCheck, actionsToCheck, perms });
    }
  } catch (e) {}

  return false;
}
