const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    type: { type: String, enum: ['deadline-reminder'], required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    requirementKey: { type: String, required: true },
    requirementLabel: { type: String, required: true },
    opportunityName: { type: String, required: true },
    deadline: { type: Date, required: true },
    reminderWindowDays: { type: Number, required: true },
    deduplicationKey: { type: String, required: true, unique: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
