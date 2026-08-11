import mongoose from 'mongoose';
import projectModel from '../models/project.model.js';
import { ROLES } from '../services/rbac.service.js';

/**
 * Reusable RBAC middleware that enforces project membership and role permissions
 * @param {string[] | string} allowedRoles - e.g. ['owner', 'editor'] or 'owner'
 */
export const requireProjectRole = (allowedRoles = [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER]) => {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return async (req, res, next) => {
        try {
            const projectId = req.params?.projectId || req.body?.projectId || req.query?.projectId;

            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: "Project ID is required"
                });
            }

            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Project ID format"
                });
            }

            if (!req.user || !req.user._id) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required"
                });
            }

            const project = await projectModel.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found"
                });
            }

            const userRole = project.getUserRole(req.user._id);

            // 1. Enforce Membership (Prevents Insecure Direct Object References - IDOR)
            if (!userRole) {
                return res.status(403).json({
                    success: false,
                    message: "Access Denied: You are not a member of this project"
                });
            }

            // 2. Enforce Role Permissions
            if (!rolesArray.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: `Permission Denied: This action requires [${rolesArray.join(', ')}] role, but your role is '${userRole}'`,
                    userRole,
                    requiredRoles: rolesArray
                });
            }

            // Attach validated project and userRole to request
            req.project = project;
            req.userRole = userRole;

            next();
        } catch (error) {
            console.error("[RBAC Middleware Error]:", error);
            return res.status(500).json({
                success: false,
                message: "Internal authorization error: " + error.message
            });
        }
    };
};
