const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    action: {
        type: String,
        required: true
    },
    userRole: {
        type: String,
        enum: ['Student', 'OVPERI_Admin', 'System_Admin']
    },
    targetType: String,
    targetId: {
        type: mongoose.Schema.Types.ObjectId
    },
    targetLabel: String,
    // Structured field-level diff for change events (from the admin-review lineage).
    // Optional — free-form events can use `details` instead.
    changes: [{
        field: String,
        from: String,
        to: String,
    }],
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
});

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Block all mutation operations — audit logs are write-once by design.
const blockMutation = function (next) {
    next(new Error('AuditLog records are append-only and cannot be updated or deleted.'));
};
auditLogSchema.pre(
    ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
    blockMutation
);

/**
 * Append a new audit entry. This is the single write path for all logging.
 *
 * action     — a short verb string: 'application.status_changed', 'user.login', etc.
 * targetType — the Mongoose model name being acted on: 'Application', 'User', etc.
 * targetId   — the ObjectId of the document being acted on.
 * targetLabel— optional human-readable label for the target (e.g. opportunity name).
 * changes    — optional structured field diff: [{ field, from, to }].
 * details    — arbitrary extra context (old/new status, reason, field changes).
 * userRole   — optional role of the actor at the time of the action.
 * userId     — the actor's ObjectId; null for system-initiated actions.
 * ip         — the request IP address.
 */
auditLogSchema.statics.logAction = async function ({
    action,
    targetType = null,
    targetId = null,
    targetLabel = null,
    changes = null,
    details = null,
    userRole = null,
    userId = null,
    ip = null
}) {
    const entry = new this({ action, targetType, targetId, targetLabel, changes, details, userRole, userId, ip });
    return entry.save();
};

/* Retrieve log entries created by a specific user, newest first. Used by admin screens showing per-user activity history. */
auditLogSchema.statics.getLogsByUser = async function (userId, { limit = 50, skip = 0 } = {}) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role');
};

/* Retrieve log entries for a specific action verb, newest first.
 * Useful for auditing "who changed application statuses" or "who logged in". */
auditLogSchema.statics.getLogsByAction = async function (action, { limit = 50, skip = 0 } = {}) {
    return this.find({ action })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role');
};

/**
 * Retrieve all log entries touching a specific document (e.g. all actions on
 * Application id X). Used to render the status timeline on an application detail.
 */
auditLogSchema.statics.getLogsByTarget = async function (targetType, targetId, { limit = 100 } = {}) {
    return this.find({ targetType, targetId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email role');
};

/**
 * Return the N most recent log entries across all users and actions.
 * Used by the System_Admin activity feed.
 */
auditLogSchema.statics.getRecentLogs = async function ({ limit = 20, skip = 0 } = {}) {
    return this.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role');
};

/**
 * Paginated, filterable log query for the admin audit log browser.
 * Accepts userId, action, targetType, and a date range.
 */
auditLogSchema.statics.queryLogs = async function ({
    userId = null,
    action = null,
    targetType = null,
    from = null,
    to = null,
    page = 1,
    pageSize = 50
} = {}) {
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = new RegExp(action, 'i');
    if (targetType) query.targetType = targetType;
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
        this.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate('userId', 'name email role'),
        this.countDocuments(query)
    ]);

    return {
        data,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
