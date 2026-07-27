const Application = require('../models/Applications');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { buildRequirementChecklist } = require('./documents');
const { isEmailNotificationsEnabled, sendDeadlineReminderEmail } = require('./email');

const DEADLINE_REMINDER_WINDOWS = [7, 3, 1, 0];
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Manila';
const ACTIVE_APPLICATION_STATUSES = ['submitted', 'under-review', 'nominated'];
const INCOMPLETE_REQUIREMENT_STATUSES = ['missing', 'pending', 'rejected'];
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = Math.max(1, Number(process.env.DEADLINE_REMINDER_EMAIL_MAX_ATTEMPTS || 3));

const calendarDateParts = (value, timeZone = APP_TIMEZONE) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const get = type => Number(parts.find(part => part.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
};

const calendarDateKey = (value, timeZone = APP_TIMEZONE) => {
    const parts = calendarDateParts(value, timeZone);
    if (!parts) return '';
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const getDaysUntilDeadline = (deadline, now = new Date(), timeZone = APP_TIMEZONE) => {
    const deadlineParts = calendarDateParts(deadline, timeZone);
    const nowParts = calendarDateParts(now, timeZone);
    if (!deadlineParts || !nowParts) return null;
    const deadlineDay = Date.UTC(deadlineParts.year, deadlineParts.month - 1, deadlineParts.day);
    const currentDay = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
    return Math.round((deadlineDay - currentDay) / DAY_MS);
};

const isApplicationReminderEligible = (application, daysRemaining) => Boolean(
    application
    && ACTIVE_APPLICATION_STATUSES.includes(application.status)
    && application.opportunityId
    && application.opportunityId.status === 'published'
    && Number.isInteger(daysRemaining)
    && daysRemaining >= 0
    && DEADLINE_REMINDER_WINDOWS.includes(daysRemaining)
);

const getIncompleteRequirements = (requiredTypes = [], documents = []) => (
    buildRequirementChecklist(requiredTypes, documents)
        .filter(item => INCOMPLETE_REQUIREMENT_STATUSES.includes(item.status))
);

const buildReminderDeduplicationKey = ({ userId, applicationId, requirementKey, deadline, reminderWindowDays }) => (
    [userId, applicationId, requirementKey, calendarDateKey(deadline), reminderWindowDays].map(String).join(':')
);

const formatDeadline = deadline => new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
}).format(new Date(deadline));

const buildDeadlineReminder = ({ application, requirement, daysRemaining }) => {
    const opportunity = application.opportunityId;
    const timing = daysRemaining === 0 ? 'due today' : `due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    const deadlineText = formatDeadline(opportunity.deadline);
    const action = requirement.status === 'rejected'
        ? 'Replace or correct it'
        : requirement.status === 'pending'
            ? 'Monitor its review status and respond if a correction is requested'
            : 'Upload it';
    const title = `${requirement.label} ${timing}`;
    const message = `${requirement.label} is ${requirement.status} for your ${opportunity.name} application. ${action} by ${deadlineText} (${timing}).`;
    const input = {
        userId: application.userId,
        applicationId: application._id,
        opportunityId: opportunity._id,
        type: 'deadline-reminder',
        title,
        message,
        requirementKey: requirement.type,
        requirementLabel: requirement.label,
        opportunityName: opportunity.name,
        deadline: opportunity.deadline,
        reminderWindowDays: daysRemaining,
        emailStatus: 'pending',
        emailAttempts: 0
    };
    return { ...input, deduplicationKey: buildReminderDeduplicationKey(input) };
};

const deliverReminderEmail = async ({ reminder, recipient, summary }) => {
    if (!recipient?.email) {
        summary.emailsSkipped += 1;
        return;
    }

    const notification = await Notification.findOneAndUpdate(
        {
            deduplicationKey: reminder.deduplicationKey,
            emailStatus: { $in: ['pending', 'failed'] },
            emailAttempts: { $lt: EMAIL_MAX_ATTEMPTS }
        },
        {
            $set: { emailStatus: 'sending', emailError: '' },
            $inc: { emailAttempts: 1 }
        },
        { new: true }
    );

    if (!notification) {
        summary.skippedEmailDuplicates += 1;
        return;
    }

    const outcome = await sendDeadlineReminderEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        reminder: notification
    });

    if (outcome.status === 'sent') {
        await Notification.updateOne(
            { _id: notification._id, emailStatus: 'sending' },
            { $set: { emailStatus: 'sent', emailSentAt: new Date(), emailError: '' } }
        );
        summary.emailsSent += 1;
        return;
    }

    const emailStatus = outcome.status === 'failed' ? 'failed' : 'skipped';
    await Notification.updateOne(
        { _id: notification._id, emailStatus: 'sending' },
        { $set: { emailStatus, emailError: outcome.reason || outcome.error || '' } }
    );

    if (emailStatus === 'failed') summary.emailsFailed += 1;
    else summary.emailsSkipped += 1;
};

const generateDeadlineReminders = async ({ now = new Date() } = {}) => {
    const summary = {
        processedApplications: 0,
        eligibleApplications: 0,
        createdReminders: 0,
        skippedDuplicates: 0,
        skippedComplete: 0,
        skippedOutsideWindow: 0,
        skippedFinalizedOrExpired: 0,
        emailsSent: 0,
        emailsFailed: 0,
        emailsSkipped: 0,
        skippedEmailDuplicates: 0
    };
    const applications = await Application.find({}).populate('opportunityId');
    summary.processedApplications = applications.length;
    const userIds = [...new Set(applications.map(item => String(item.userId)).filter(Boolean))];
    const documents = await Document.find({ userId: { $in: userIds } }).sort({ uploadedAt: -1 });
    const emailEnabled = isEmailNotificationsEnabled();
    const users = emailEnabled && userIds.length
        ? await User.find({ _id: { $in: userIds } }).select('_id name email')
        : [];
    const documentsByUser = new Map();
    const usersById = new Map(users.map(user => [String(user._id), user]));
    documents.forEach(document => {
        const key = String(document.userId);
        if (!documentsByUser.has(key)) documentsByUser.set(key, []);
        documentsByUser.get(key).push(document);
    });

    for (const application of applications) {
        const opportunity = application.opportunityId;
        const daysRemaining = opportunity ? getDaysUntilDeadline(opportunity.deadline, now) : null;
        if (!opportunity || !ACTIVE_APPLICATION_STATUSES.includes(application.status) || opportunity.status !== 'published' || daysRemaining === null || daysRemaining < 0) {
            summary.skippedFinalizedOrExpired += 1;
            continue;
        }
        if (!DEADLINE_REMINDER_WINDOWS.includes(daysRemaining)) {
            summary.skippedOutsideWindow += 1;
            continue;
        }
        const incomplete = getIncompleteRequirements(
            opportunity.requiredDocumentTypes || [],
            documentsByUser.get(String(application.userId)) || []
        );
        if (!incomplete.length) {
            summary.skippedComplete += 1;
            continue;
        }
        if (!isApplicationReminderEligible(application, daysRemaining)) continue;
        summary.eligibleApplications += 1;
        for (const requirement of incomplete) {
            const reminder = buildDeadlineReminder({ application, requirement, daysRemaining });
            const result = await Notification.updateOne(
                { deduplicationKey: reminder.deduplicationKey },
                { $setOnInsert: reminder },
                { upsert: true }
            );
            if (result.upsertedCount === 1) summary.createdReminders += 1;
            else summary.skippedDuplicates += 1;

            if (emailEnabled) {
                try {
                    await deliverReminderEmail({
                        reminder,
                        recipient: usersById.get(String(application.userId)),
                        summary
                    });
                } catch (error) {
                    summary.emailsFailed += 1;
                    console.error(`Deadline reminder email processing failed for ${reminder.deduplicationKey}:`, error.message);
                }
            }
        }
    }
    return summary;
};

module.exports = {
    DEADLINE_REMINDER_WINDOWS,
    APP_TIMEZONE,
    ACTIVE_APPLICATION_STATUSES,
    INCOMPLETE_REQUIREMENT_STATUSES,
    calendarDateKey,
    getDaysUntilDeadline,
    isApplicationReminderEligible,
    getIncompleteRequirements,
    buildReminderDeduplicationKey,
    buildDeadlineReminder,
    deliverReminderEmail,
    generateDeadlineReminders
};
