import messageModel from "../models/message.model.js";
import projectModel from "../models/project.model.js";
import mongoose from "mongoose";

/**
 * Creates and persists a chat message in MongoDB
 */
export const createMessage = async ({ projectId, sender, content, type = "text" }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid or missing projectId");
    }

    if (!sender || !sender._id || !sender.email) {
        throw new Error("Sender with _id and email is required");
    }

    if (!content || typeof content !== "string" || !content.trim()) {
        throw new Error("Message content cannot be empty");
    }

    if (content.length > 5000) {
        throw new Error("Message exceeds maximum length of 5000 characters");
    }

    const message = await messageModel.create({
        projectId,
        sender: {
            _id: sender._id.toString(),
            email: sender.email
        },
        content: content.trim(),
        type: ["text", "ai", "code"].includes(type) ? type : "text"
    });

    return message;
};

/**
 * Fetches cursor-paginated chat history for a project with authorization
 */
export const getProjectMessages = async ({ projectId, userId, before, limit = 30 }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid userId");
    }

    // Authorization: Verify user belongs to the project
    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    });

    if (!project) {
        const error = new Error("You do not have access to this project's messages");
        error.statusCode = 403;
        throw error;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

    const query = { projectId };

    if (before) {
        const beforeDate = new Date(before);
        if (!isNaN(beforeDate.getTime())) {
            query.createdAt = { $lt: beforeDate };
        }
    }

    // Fetch parsedLimit + 1 to check if there are more older messages
    const rawMessages = await messageModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(parsedLimit + 1)
        .lean();

    const hasMore = rawMessages.length > parsedLimit;
    const messagesToReturn = hasMore ? rawMessages.slice(0, parsedLimit) : rawMessages;

    // Reverse to chronological order (oldest first) for UI
    const chronologicalMessages = messagesToReturn.reverse();

    const nextCursor =
        hasMore && messagesToReturn.length > 0
            ? messagesToReturn[0].createdAt.toISOString()
            : null;

    return {
        messages: chronologicalMessages,
        hasMore,
        nextCursor
    };
};
