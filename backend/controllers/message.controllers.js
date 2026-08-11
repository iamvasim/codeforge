import * as messageService from "../services/message.service.js";
import userModel from "../models/user.model.js";

export const getProjectMessagesController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { before, limit } = req.query;

        const loggedInUser = await userModel.findOne({ email: req.user.email });
        if (!loggedInUser) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const result = await messageService.getProjectMessages({
            projectId,
            userId: loggedInUser._id,
            before,
            limit
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error fetching project messages:", err.message);
        const status = err.statusCode || (err.message.includes("Invalid") ? 400 : 500);
        return res.status(status).json({
            success: false,
            message: err.message || "Unable to load chat history"
        });
    }
};
