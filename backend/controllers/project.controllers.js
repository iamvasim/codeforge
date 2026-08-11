import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

export const createProject = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        if (!loggedInUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const newProject = await projectService.createProject({
            name,
            userId: loggedInUser._id
        });

        res.status(201).json({
            success: true,
            project: newProject,
            userRole: 'owner'
        });
    } catch (err) {
        console.error("[Create Project Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getAllProject = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        if (!loggedInUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        });

        return res.status(200).json({
            success: true,
            projects: allUserProjects
        });
    } catch (err) {
        console.error("[Get All Projects Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getProjectById = async (req, res) => {
    const { projectId } = req.params;

    try {
        const project = await projectService.getProjectById({ projectId });
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        const userRole = project.getUserRole(req.user._id);

        return res.status(200).json({
            success: true,
            project,
            userRole
        });
    } catch (err) {
        console.error("[Get Project Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { projectId, fileTree } = req.body;

        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        });

        return res.status(200).json({
            success: true,
            project
        });
    } catch (err) {
        console.error("[Update FileTree Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { projectId, users, role } = req.body;

        const updatedProject = await projectService.addUsersToProject({
            projectId,
            users,
            role,
            requestingUserId: req.user._id
        });

        return res.status(200).json({
            success: true,
            project: updatedProject,
            message: "Members invited successfully"
        });
    } catch (err) {
        console.error("[Add Member Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const updateMemberRole = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { projectId, targetUserId, newRole } = req.body;

        const updatedProject = await projectService.updateMemberRole({
            projectId,
            targetUserId,
            newRole,
            requestingUserId: req.user._id
        });

        return res.status(200).json({
            success: true,
            project: updatedProject,
            message: `Member role updated to ${newRole}`
        });
    } catch (err) {
        console.error("[Update Role Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const removeMember = async (req, res) => {
    try {
        const { projectId, targetUserId } = req.body;

        const updatedProject = await projectService.removeMemberFromProject({
            projectId,
            targetUserId,
            requestingUserId: req.user._id
        });

        return res.status(200).json({
            success: true,
            project: updatedProject,
            message: "Member removed from project"
        });
    } catch (err) {
        console.error("[Remove Member Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        const result = await projectService.deleteProject({
            projectId,
            requestingUserId: req.user._id
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error("[Delete Project Error]:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};