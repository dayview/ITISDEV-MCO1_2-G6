const Notification = require('../models/Notification');
const User = require('../models/User');
const { isEmailNotificationsEnabled, sendEventEmail } = require('./email');

// Creates (idempotently, by deduplicationKey) a persisted notification for a
// discrete system event, then immediately delivers the email — reusing the same
// pending -> sending -> sent/failed/skipped state machine the deadline reminder job
// uses in lib/deadlineReminders.js (deliverReminderEmail). Email failures are
// recorded on the notification and never thrown to the caller's request path.
const dispatchEventNotification = async (payload) => {
    const notification = await Notification.findOneAndUpdate(
        { deduplicationKey: payload.deduplicationKey },
        { $setOnInsert: { ...payload, emailStatus: 'pending', emailAttempts: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!isEmailNotificationsEnabled()) {
        return { notification, email: { status: 'skipped', reason: 'Email notifications are disabled.' } };
    }

    // Claim the send so a duplicate/concurrent dispatch cannot email twice.
    const claimed = await Notification.findOneAndUpdate(
        { _id: notification._id, emailStatus: { $in: ['pending', 'failed'] } },
        { $set: { emailStatus: 'sending', emailError: '' }, $inc: { emailAttempts: 1 } },
        { new: true }
    );
    if (!claimed) return { notification, email: { status: 'duplicate' } };

    const recipient = await User.findById(claimed.userId).select('name email');
    const outcome = await sendEventEmail({
        recipientEmail: recipient?.email,
        recipientName: recipient?.name,
        notification: claimed
    });

    if (outcome.status === 'sent') {
        await Notification.updateOne(
            { _id: claimed._id, emailStatus: 'sending' },
            { $set: { emailStatus: 'sent', emailSentAt: new Date(), emailError: '' } }
        );
    } else {
        await Notification.updateOne(
            { _id: claimed._id, emailStatus: 'sending' },
            { $set: { emailStatus: outcome.status === 'failed' ? 'failed' : 'skipped', emailError: outcome.reason || outcome.error || '' } }
        );
    }

    return { notification: claimed, email: outcome };
};

// Fired when an admin changes a single application's status.
const notifyApplicationStatusChange = ({ application, fromStatus, toStatus, opportunityName, changedAt = new Date() }) =>
    dispatchEventNotification({
        userId: application.userId,
        applicationId: application._id,
        opportunityId: application.opportunityId,
        type: 'application-status-change',
        eventType: `${fromStatus}->${toStatus}`,
        fromValue: fromStatus,
        toValue: toStatus,
        opportunityName,
        title: `Application status: ${toStatus}`,
        message: `Your application${opportunityName ? ` for ${opportunityName}` : ''} moved from "${fromStatus}" to "${toStatus}".`,
        deduplicationKey: `status:${application._id}:${fromStatus}->${toStatus}:${new Date(changedAt).toISOString()}`
    });

// Fired for each student with an active application when an opportunity event
// (e.g. a status change such as published -> closed) occurs.
const notifyOpportunityEvent = ({ application, opportunity, eventType, message, changedAt = new Date() }) =>
    dispatchEventNotification({
        userId: application.userId,
        applicationId: application._id,
        opportunityId: opportunity._id,
        type: 'opportunity-event',
        eventType,
        opportunityName: opportunity.name,
        title: `Update: ${opportunity.name}`,
        message,
        deduplicationKey: `opp-event:${application._id}:${eventType}:${new Date(changedAt).toISOString()}`
    });

module.exports = {
    dispatchEventNotification,
    notifyApplicationStatusChange,
    notifyOpportunityEvent
};
