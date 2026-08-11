import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import http from "http";
import app from "./app.js";
import connect from "./db/db.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import projectModel from "./models/project.model.js";
import { generateResult } from "./services/ai.service.js";
import { createMessage } from "./services/message.service.js";
import { initRedisAdapter } from "./services/redis.service.js";
import { ROLES } from "./services/rbac.service.js";

connect();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.IO with CORS and transport fallbacks
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"]
});

// Initialize Redis Pub/Sub Adapter for multi-instance horizontal scaling
initRedisAdapter(io);

// Middleware to authenticate socket connections & enforce project membership
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query?.projectId;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid or missing projectId'));
        }

        socket.project = await projectModel.findById(projectId);

        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error: Invalid token'));
        }

        // Enforce project membership (prevents unauthorized room eavesdropping)
        const userRole = socket.project.getUserRole(decoded._id);
        if (!userRole) {
            return next(new Error('Access Denied: You are not a member of this project'));
        }

        socket.user = decoded;
        socket.userRole = userRole;
        next();
    } catch (error) {
        next(new Error(`Authentication failed: ${error.message}`));
    }
});

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString();

    console.log(`[Socket.IO] User ${socket.user?.email || socket.id} (${socket.userRole}) connected (PID: ${process.pid}) to project room: ${socket.roomId}`);
    socket.join(socket.roomId);

    // 1. Real-time Project Chat & Collaboration messages
    socket.on('project-message', async data => {
        const message = typeof data?.message === 'string' ? data.message.trim() : '';

        if (!message) return;

        // Viewers have read-only permissions
        if (socket.userRole === ROLES.VIEWER) {
            socket.emit('error-message', { message: 'Viewers have read-only access and cannot post chat messages' });
            return;
        }

        if (message.length > 5000) {
            socket.emit('error-message', { message: 'Message exceeds maximum length of 5000 characters' });
            return;
        }

        try {
            // 1. Save user's message to MongoDB (source of truth)
            const savedUserMessage = await createMessage({
                projectId: socket.project._id,
                sender: {
                    _id: socket.user._id,
                    email: socket.user.email
                },
                content: message,
                type: 'text'
            });

            const formattedUserMessage = {
                _id: savedUserMessage._id.toString(),
                projectId: savedUserMessage.projectId.toString(),
                sender: savedUserMessage.sender,
                message: savedUserMessage.content,
                content: savedUserMessage.content,
                type: savedUserMessage.type,
                createdAt: savedUserMessage.createdAt
            };

            // 2. Broadcast persisted message to all project room members across all scaled servers
            io.to(socket.roomId).emit('project-message', formattedUserMessage);

            // 3. Handle AI prompt if triggered with @ai
            const aiIsPresentInMessage = message.includes('@ai');

            if (aiIsPresentInMessage) {
                try {
                    const prompt = message.replace('@ai', '').trim();
                    const result = await generateResult(prompt);

                    // Persist AI response to MongoDB
                    const savedAiMessage = await createMessage({
                        projectId: socket.project._id,
                        sender: {
                            _id: 'ai',
                            email: 'AI'
                        },
                        content: result,
                        type: 'ai'
                    });

                    io.to(socket.roomId).emit('project-message', {
                        _id: savedAiMessage._id.toString(),
                        projectId: savedAiMessage.projectId.toString(),
                        sender: savedAiMessage.sender,
                        message: savedAiMessage.content,
                        content: savedAiMessage.content,
                        type: savedAiMessage.type,
                        createdAt: savedAiMessage.createdAt
                    });
                } catch (aiErr) {
                    console.error("[AI Generation Error]:", aiErr.message);
                    const errorContent = JSON.stringify({
                        text: "An error occurred while generating AI response: " + aiErr.message
                    });

                    const savedErrorMessage = await createMessage({
                        projectId: socket.project._id,
                        sender: {
                            _id: 'ai',
                            email: 'AI'
                        },
                        content: errorContent,
                        type: 'ai'
                    });

                    io.to(socket.roomId).emit('project-message', {
                        _id: savedErrorMessage._id.toString(),
                        projectId: savedErrorMessage.projectId.toString(),
                        sender: savedErrorMessage.sender,
                        message: savedErrorMessage.content,
                        content: savedErrorMessage.content,
                        type: savedErrorMessage.type,
                        createdAt: savedErrorMessage.createdAt
                    });
                }
            }
        } catch (err) {
            console.error("[Message Persistence Error]:", err.message);
            socket.emit('error-message', { message: 'Failed to send message: ' + err.message });
        }
    });

    // 2. Cross-server typing indicator support
    socket.on('typing', ({ isTyping }) => {
        if (socket.userRole === ROLES.VIEWER) return; // Viewers do not send typing events

        socket.to(socket.roomId).emit('user-typing', {
            userId: socket.user._id,
            email: socket.user.email,
            isTyping
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] User ${socket.user?.email || socket.id} disconnected from room: ${socket.roomId}`);
        socket.leave(socket.roomId);
    });
});

server.listen(PORT, () => {
    console.log(`[NexChat Server] Running on http://localhost:${PORT} (PID: ${process.pid})`);
});