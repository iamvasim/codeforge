import projectModel from '../models/project.model.js';
import mongoose from "mongoose";
import { ROLES } from './rbac.service.js';

export const createProject = async ({ name, userId }) => {
    if (!name) {
        throw new Error('Project name is required');
    }
    if (!userId) {
        throw new Error('UserId is required');
    }

    try {
        const project = await projectModel.create({
            name: name.trim(),
            owner: userId,
            members: [
                {
                    user: userId,
                    role: ROLES.OWNER,
                    joinedAt: new Date()
                }
            ],
            users: [userId]
        });

        return project;
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Project name already exists');
        }
        throw error;
    }
};

export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new Error('UserId is required');
    }

    const allUserProjects = await projectModel.find({
        $or: [
            { owner: userId },
            { 'members.user': userId },
            { users: userId }
        ]
    }).populate('owner', 'email').populate('members.user', 'email').populate('users', 'email');

    return allUserProjects;
};

export const getProjectById = async ({ projectId }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    let project = await projectModel.findById(projectId)
        .populate('owner', 'email')
        .populate('members.user', 'email')
        .populate('users', 'email');

    if (!project) return null;

    // Automatic migration / backfill for legacy projects created prior to Phase 6
    let needsSave = false;

    // 1. If project has no owner, set owner to the first user
    if (!project.owner && project.users && project.users.length > 0) {
        project.owner = project.users[0]._id || project.users[0];
        needsSave = true;
    }

    // 2. If project has no members array or it's empty, populate from users array
    if (!project.members || project.members.length === 0) {
        const ownerIdStr = project.owner ? (project.owner._id ? project.owner._id.toString() : project.owner.toString()) : null;

        project.members = (project.users || []).map((u, idx) => {
            const uid = u._id || u;
            const uidStr = uid.toString();
            const isOwner = ownerIdStr ? uidStr === ownerIdStr : idx === 0;

            return {
                user: uid,
                role: isOwner ? ROLES.OWNER : ROLES.EDITOR,
                joinedAt: new Date()
            };
        });

        if (project.members.length > 0 && !project.owner) {
            project.owner = project.members[0].user;
        }

        needsSave = true;
    }

    if (needsSave) {
        await project.save();
        project = await projectModel.findById(projectId)
            .populate('owner', 'email')
            .populate('members.user', 'email')
            .populate('users', 'email');
    }

    return project;
};

export const updateFileTree = async ({ projectId, fileTree }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    if (!fileTree) {
        throw new Error("fileTree is required");
    }

    const project = await projectModel.findByIdAndUpdate(
        projectId,
        { fileTree },
        { new: true }
    );

    return project;
};

/**
 * Add / Invite users to project with specific role (Owner or Editor)
 */
export const addUsersToProject = async ({ projectId, users, role = ROLES.EDITOR, requestingUserId }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Users must be a non-empty array");
    }

    const validRole = [ROLES.EDITOR, ROLES.VIEWER].includes(role) ? role : ROLES.EDITOR;

    let project = await projectModel.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    // Auto-backfill owner if missing
    if (!project.owner && project.users && project.users.length > 0) {
        project.owner = project.users[0];
    }

    const userRole = project.getUserRole(requestingUserId);
    if (userRole === ROLES.VIEWER) {
        throw new Error("Viewers cannot invite new members");
    }

    // Add each user to members and users arrays
    const existingMemberIds = new Set(
        project.members.map(m => m.user?.toString())
    );

    users.forEach(uid => {
        const uidStr = uid.toString();
        if (!existingMemberIds.has(uidStr)) {
            project.members.push({
                user: uid,
                role: validRole,
                joinedAt: new Date()
            });
            if (!project.users.some(u => u.toString() === uidStr)) {
                project.users.push(uid);
            }
        }
    });

    await project.save();

    return await getProjectById({ projectId });
};

/**
 * Update member's role between 'editor' and 'viewer' (Owner only)
 */
export const updateMemberRole = async ({ projectId, targetUserId, newRole, requestingUserId }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new Error("Invalid targetUserId");
    }

    if (![ROLES.EDITOR, ROLES.VIEWER].includes(newRole)) {
        throw new Error("Role must be 'editor' or 'viewer'");
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const ownerIdStr = project.owner ? project.owner.toString() : '';
    if (ownerIdStr && ownerIdStr !== requestingUserId.toString()) {
        throw new Error("Only the project owner can change member roles");
    }

    if (ownerIdStr === targetUserId.toString()) {
        throw new Error("Cannot change role of project owner");
    }

    const member = project.members.find(m => m.user?.toString() === targetUserId.toString());
    if (!member) {
        throw new Error("Target user is not a member of this project");
    }

    member.role = newRole;
    await project.save();

    return await getProjectById({ projectId });
};

/**
 * Remove member from project (Owner only)
 */
export const removeMemberFromProject = async ({ projectId, targetUserId, requestingUserId }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new Error("Invalid targetUserId");
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const ownerIdStr = project.owner ? project.owner.toString() : '';
    if (ownerIdStr && ownerIdStr !== requestingUserId.toString()) {
        throw new Error("Only the project owner can remove members");
    }

    if (ownerIdStr === targetUserId.toString()) {
        throw new Error("Project owner cannot be removed from project");
    }

    project.members = project.members.filter(m => m.user?.toString() !== targetUserId.toString());
    project.users = project.users.filter(u => u.toString() !== targetUserId.toString());

    await project.save();

    return await getProjectById({ projectId });
};

/**
 * Delete project permanently (Owner only)
 */
export const deleteProject = async ({ projectId, requestingUserId }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const ownerIdStr = project.owner ? project.owner.toString() : '';
    if (ownerIdStr && ownerIdStr !== requestingUserId.toString()) {
        throw new Error("Only the project owner can delete this project");
    }

    await projectModel.findByIdAndDelete(projectId);
    return { success: true, message: "Project deleted successfully" };
};