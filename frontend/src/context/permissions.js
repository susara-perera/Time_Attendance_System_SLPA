// permissions.js
export const rolePermissions = {
  superadmin: {
    canEditUser: true,
    canDeleteUser: true,
    canAddUser: true,
    // add more permissions as needed
  },
  administrator: {
    canEditUser: true,
    canDeleteUser: false,
    canAddUser: true,
  },
  employee: {
    canEditUser: false,
    canDeleteUser: false,
    canAddUser: false,
  },
  // Add other roles as needed
};