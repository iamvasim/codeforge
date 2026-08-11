import * as ai from '../services/ai.service.js';
import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';
import { ROLES } from '../services/rbac.service.js';

export const getResult = async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) {
            return res.status(400).json({ message: "Prompt query parameter is required" });
        }
        const result = await ai.generateResult(prompt);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

/**
 * Server-Sent Events (SSE) controller for real-time Gemini token streaming with RBAC enforcement
 */
export const streamCode = async (req, res) => {
    try {
        const { projectId, fileName, language, content, fileContent, instruction, projectContext, projectContextFiles } = req.body;

        if (!instruction || typeof instruction !== 'string') {
            return res.status(400).json({ message: "Instruction is required" });
        }

        // RBAC Check: If projectId is provided, enforce Editor or Owner role
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            const project = await projectModel.findById(projectId);
            if (project) {
                const userRole = project.getUserRole(req.user._id);
                if (!userRole) {
                    return res.status(403).json({
                        success: false,
                        message: "Access Denied: You are not a member of this project"
                    });
                }
                if (userRole === ROLES.VIEWER) {
                    return res.status(403).json({
                        success: false,
                        message: "Permission Denied: Viewers are not authorized to request AI code modifications"
                    });
                }
            }
        }

        // Set SSE Streaming Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Handle client abort / disconnect
        let isAborted = false;
        req.on('close', () => {
            isAborted = true;
        });

        await ai.streamCodeAssistant(
            {
                fileName: fileName || 'file.js',
                language: language || 'javascript',
                content: content || fileContent || '',
                instruction: instruction.trim(),
                projectContext: Array.isArray(projectContext) ? projectContext : (Array.isArray(projectContextFiles) ? projectContextFiles : [])
            },
            (chunk, done, fullText) => {
                if (isAborted) return;

                const payload = JSON.stringify({
                    chunk,
                    text: chunk,
                    done,
                    fullText: done ? fullText : undefined
                });

                res.write(`data: ${payload}\n\n`);

                if (done) {
                    res.end();
                }
            }
        );
    } catch (error) {
        console.error("[AI Controller] Stream error:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
            res.end();
        }
    }
};