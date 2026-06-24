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
    targetType: String,
    targetId: {
        type: mongoose.Schema.Types.ObjectId
    },
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
});

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

const blockMutation = function (next) {
    next(new Error('Audit Log records are append-only and cannot be updated or deleted.'));
};
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], blockMutation);

module.exports = mongoose.model('AuditLog', auditLogSchema);