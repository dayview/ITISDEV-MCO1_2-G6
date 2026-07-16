const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['OVPERI_Admin', 'System_Admin', 'Student'], required: true },
    action: {
        type: String,
        enum: [
            'opportunity_created',
            'opportunity_updated',
            'opportunity_deleted',
            'opportunity_published',
            'opportunity_closed',
            'application_status_changed',
            'application_bulk_status_changed',
            'user_role_changed',
            'user_deactivated',
            'user_registered',
            'user_login',
            'user_logout',
            'user_profile_updated',
            'document_uploaded',
            'document_deleted',
            'document_verified',
            'document_rejected',
            'application_submitted',
        ],
        required: true
    },
    targetType: { type: String, enum: ['Opportunity', 'Application', 'User', 'Document'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String },
    changes: [{
        field: String,
        from: String,
        to: String,
    }],
    ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const blockMutation = function (next) {
    next(new Error('Audit Log records are append-only and cannot be updated or deleted.'));
};
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], blockMutation);

module.exports = mongoose.model('AuditLog', auditLogSchema);
