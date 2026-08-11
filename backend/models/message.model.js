import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "project",
            required: [true, "Project ID is required"],
            index: true
        },
        sender: {
            _id: {
                type: String,
                required: [true, "Sender ID is required"]
            },
            email: {
                type: String,
                required: [true, "Sender email is required"]
            }
        },
        content: {
            type: String,
            required: [true, "Message content is required"],
            trim: true,
            maxlength: [5000, "Message cannot exceed 5000 characters"]
        },
        type: {
            type: String,
            enum: ["text", "ai", "code"],
            default: "text"
        }
    },
    {
        timestamps: true
    }
);

// Compound index for high-speed cursor-based history pagination:
// Filters quickly by project and sorts in reverse chronological order
messageSchema.index({ projectId: 1, createdAt: -1 });

const Message = mongoose.model("message", messageSchema);

export default Message;
