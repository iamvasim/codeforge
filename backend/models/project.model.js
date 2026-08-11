import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    role: {
        type: String,
        enum: ['owner', 'editor', 'viewer'],
        default: 'editor',
        lowercase: true,
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        lowercase: true,
        required: [true, 'Project name is required'],
        trim: true,
        unique: [true, 'Project name must be unique']
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    members: [memberSchema],
    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    fileTree: {
        type: Object,
        default: {}
    }
}, { timestamps: true });

// Helper to determine a user's role in the project with full legacy fallback
projectSchema.methods.getUserRole = function(userId) {
    if (!userId) return null;
    const uidStr = userId.toString();

    // 1. Check explicit project owner
    if (this.owner) {
        const ownerIdStr = this.owner._id ? this.owner._id.toString() : this.owner.toString();
        if (ownerIdStr === uidStr) {
            return 'owner';
        }
    }

    // 2. Check members array
    if (Array.isArray(this.members) && this.members.length > 0) {
        const memberEntry = this.members.find(m => {
            const memberUid = m.user?._id ? m.user._id.toString() : m.user?.toString();
            return memberUid === uidStr;
        });
        if (memberEntry) {
            return memberEntry.role;
        }
    }

    // 3. Fallback for legacy projects (first user in users array is owner, others are editors)
    if (Array.isArray(this.users) && this.users.length > 0) {
        const firstUid = this.users[0]?._id ? this.users[0]._id.toString() : this.users[0]?.toString();
        if (firstUid === uidStr) {
            return 'owner';
        }
        if (this.users.some(u => (u._id ? u._id.toString() : u.toString()) === uidStr)) {
            return 'editor';
        }
    }

    return null;
};

// Helper to check if a user is a member
projectSchema.methods.isMember = function(userId) {
    return this.getUserRole(userId) !== null;
};

const Project = mongoose.model('project', projectSchema);

export default Project;