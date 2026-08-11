/**
 * Centralized Role-Based Access Control (RBAC) Service & Permission Matrix
 */

export const ROLES = Object.freeze({
    OWNER: 'owner',
    EDITOR: 'editor',
    VIEWER: 'viewer'
});

export const PERMISSIONS = Object.freeze({
    VIEW_PROJECT: [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER],
    READ_FILES: [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER],
    READ_MESSAGES: [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER],
    SEND_MESSAGES: [ROLES.OWNER, ROLES.EDITOR], // Viewers have read-only access
    EDIT_FILES: [ROLES.OWNER, ROLES.EDITOR],
    CREATE_FILES: [ROLES.OWNER, ROLES.EDITOR],
    DELETE_FILES: [ROLES.OWNER, ROLES.EDITOR],
    RUN_PROJECT: [ROLES.OWNER, ROLES.EDITOR],
    AI_CODE_MODIFY: [ROLES.OWNER, ROLES.EDITOR],
    AI_EXPLAIN: [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER],
    INVITE_MEMBERS: [ROLES.OWNER],
    REMOVE_MEMBERS: [ROLES.OWNER],
    CHANGE_ROLES: [ROLES.OWNER],
    DELETE_PROJECT: [ROLES.OWNER],
    TRANSFER_OWNERSHIP: [ROLES.OWNER]
});

/**
 * Check if a given role has a specific permission
 */
export const hasPermission = (userRole, requiredPermission) => {
    if (!userRole) return false;
    const allowedRoles = PERMISSIONS[requiredPermission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(userRole.toLowerCase());
};

/**
 * Semantic helper functions
 */
export const canViewProject = (role) => hasPermission(role, 'VIEW_PROJECT');
export const canEditProject = (role) => hasPermission(role, 'EDIT_FILES');
export const canRunProject = (role) => hasPermission(role, 'RUN_PROJECT');
export const canModifyAI = (role) => hasPermission(role, 'AI_CODE_MODIFY');
export const canManageMembers = (role) => hasPermission(role, 'INVITE_MEMBERS');
export const canDeleteProject = (role) => hasPermission(role, 'DELETE_PROJECT');

export default {
    ROLES,
    PERMISSIONS,
    hasPermission,
    canViewProject,
    canEditProject,
    canRunProject,
    canModifyAI,
    canManageMembers,
    canDeleteProject
};
