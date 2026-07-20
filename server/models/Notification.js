const mongoose = require('mongoose');

// Deadline-reminder documents keep the original required fields. Event-driven
// notifications (status changes, opportunity events) reuse the same collection and
// email-delivery state machine but leave the deadline-specific fields empty.
const isDeadlineReminder = function () { return this.type === 'deadline-reminder'; };

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' },
    type: {
        type: String,
        enum: ['deadline-reminder', 'application-status-change', 'opportunity-event'],
        required: true
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    opportunityName: { type: String, trim: true },

    // Deadline-reminder-only fields (unchanged behavior for that type).
    requirementKey: { type: String, required: isDeadlineReminder },
    requirementLabel: { type: String, required: isDeadlineReminder },
    deadline: { type: Date, required: isDeadlineReminder },
    reminderWindowDays: { type: Number, required: isDeadlineReminder },

    // Generic event metadata for status-change / opportunity-event notifications.
    eventType: { type: String, trim: true },
    fromValue: { type: String, trim: true },
    toValue: { type: String, trim: true },

    // Reused dedup + email-delivery state machine (shared by all notification types).
    deduplicationKey: { type: String, required: true, unique: true },
    emailStatus: { type: String, enum: ['pending', 'sending', 'sent', 'failed', 'skipped'], default: 'pending', index: true },
    emailAttempts: { type: Number, default: 0, min: 0 },
    emailSentAt: Date,
    emailError: { type: String, trim: true, maxlength: 500 },
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
