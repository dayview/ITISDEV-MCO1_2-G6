jest.mock('../models/Applications');
jest.mock('../models/Document');
jest.mock('../models/Notification');
jest.mock('../models/User');
jest.mock('../lib/email');

const Application = require('../models/Applications');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { isEmailNotificationsEnabled, sendDeadlineReminderEmail } = require('../lib/email');
const {
    DEADLINE_REMINDER_WINDOWS,
    ACTIVE_APPLICATION_STATUSES,
    getDaysUntilDeadline,
    isApplicationReminderEligible,
    getIncompleteRequirements,
    buildReminderDeduplicationKey,
    buildDeadlineReminder,
    generateDeadlineReminders
} = require('../lib/deadlineReminders');

const now = new Date('2026-07-16T04:00:00.000Z'); // July 16 noon in Manila
const opportunity = (days, overrides = {}) => ({
    _id: 'opp1', name: 'NUS Exchange', status: 'published',
    deadline: new Date(now.getTime() + days * 86400000),
    requiredDocumentTypes: ['passport'],
    ...overrides
});
const application = (days, overrides = {}) => ({
    _id: 'app1', userId: 'user1', status: 'submitted', opportunityId: opportunity(days), ...overrides
});

describe('Deadline reminders - calendar logic', () => {
    test.each([[7, 7], [3, 3], [1, 1], [0, 0], [-1, -1]])('calculates %i calendar days', (offset, expected) => {
        expect(getDaysUntilDeadline(new Date(now.getTime() + offset * 86400000), now)).toBe(expected);
    });

    test('uses Asia/Manila calendar boundaries rather than elapsed hours', () => {
        const late = new Date('2026-07-16T15:30:00.000Z'); // 11:30 PM Manila
        const nextDay = new Date('2026-07-16T16:30:00.000Z'); // 12:30 AM Manila
        expect(getDaysUntilDeadline(nextDay, late)).toBe(1);
    });

    test('centralizes the supported windows', () => {
        expect(DEADLINE_REMINDER_WINDOWS).toEqual([7, 3, 1, 0]);
    });
});

describe('Deadline reminders - eligibility and requirements', () => {
    test.each(ACTIVE_APPLICATION_STATUSES)('includes active status %s', status => {
        expect(isApplicationReminderEligible(application(3, { status }), 3)).toBe(true);
    });

    test.each(['accepted', 'rejected'])('excludes finalized status %s', status => {
        expect(isApplicationReminderEligible(application(3, { status }), 3)).toBe(false);
    });

    test('excludes expired deadlines and days outside a reminder window', () => {
        expect(isApplicationReminderEligible(application(-1), -1)).toBe(false);
        expect(isApplicationReminderEligible(application(5), 5)).toBe(false);
    });

    test('finds missing, pending, and rejected requirements but not verified ones', () => {
        const required = ['passport', 'transcript', 'EAF', 'curriculumAudit'];
        const documents = [
            { type: 'transcript', status: 'pending', uploadedAt: now },
            { type: 'EAF', status: 'verified', uploadedAt: now },
            { type: 'curriculumAudit', status: 'rejected', uploadedAt: now }
        ];
        expect(getIncompleteRequirements(required, documents).map(item => item.status)).toEqual(['missing', 'pending', 'rejected']);
    });

    test('a fully verified opportunity checklist is complete', () => {
        expect(getIncompleteRequirements(['passport'], [{ type: 'passport', status: 'verified', uploadedAt: now }])).toEqual([]);
    });
});

describe('Deadline reminders - content and deduplication', () => {
    test('builds a deterministic key including requirement and window', () => {
        const input = { userId: 'u', applicationId: 'a', requirementKey: 'passport', deadline: opportunity(3).deadline, reminderWindowDays: 3 };
        expect(buildReminderDeduplicationKey(input)).toBe(buildReminderDeduplicationKey(input));
        expect(buildReminderDeduplicationKey({ ...input, reminderWindowDays: 1 })).not.toBe(buildReminderDeduplicationKey(input));
    });

    test('creates actionable deadline-day wording', () => {
        const reminder = buildDeadlineReminder({
            application: application(0),
            requirement: { type: 'passport', label: 'Passport Bio-Page', status: 'missing' },
            daysRemaining: 0
        });
        expect(reminder.title).toContain('due today');
        expect(reminder.message).toContain('Passport Bio-Page');
        expect(reminder.message).toContain('NUS Exchange');
        expect(reminder.message).toContain('Upload it');
    });
});

describe('Deadline reminders - generation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isEmailNotificationsEnabled.mockReturnValue(false);
    });

    function mockQueries(applications, documents = []) {
        Application.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(applications) });
        Document.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(documents) });
    }

    test('creates one reminder per incomplete requirement', async () => {
        const app = application(3, { opportunityId: opportunity(3, { requiredDocumentTypes: ['passport', 'EAF'] }) });
        mockQueries([app]);
        Notification.updateOne.mockResolvedValue({ upsertedCount: 1 });
        const summary = await generateDeadlineReminders({ now });
        expect(Notification.updateOne).toHaveBeenCalledTimes(2);
        expect(summary.createdReminders).toBe(2);
        expect(summary.eligibleApplications).toBe(1);
    });

    test('repeated generation reports duplicates instead of creating them', async () => {
        mockQueries([application(3)]);
        Notification.updateOne.mockResolvedValue({ upsertedCount: 0 });
        const summary = await generateDeadlineReminders({ now });
        expect(summary.createdReminders).toBe(0);
        expect(summary.skippedDuplicates).toBe(1);
    });

    test('sends a new reminder email once and records delivery', async () => {
        isEmailNotificationsEnabled.mockReturnValue(true);
        mockQueries([application(3)]);
        const usersQuery = { select: jest.fn().mockResolvedValue([{ _id: 'user1', name: 'Student One', email: 'student@dlsu.edu.ph' }]) };
        User.find.mockReturnValue(usersQuery);
        Notification.updateOne.mockResolvedValue({ upsertedCount: 1 });
        Notification.findOneAndUpdate.mockResolvedValue({
            _id: 'notification1',
            deduplicationKey: 'dedupe-key',
            title: 'Passport due in 3 days',
            message: 'Upload it.',
            opportunityName: 'NUS Exchange',
            requirementLabel: 'Passport Bio-Page',
            deadline: opportunity(3).deadline
        });
        sendDeadlineReminderEmail.mockResolvedValue({ status: 'sent', messageId: 'message-1' });

        const summary = await generateDeadlineReminders({ now });

        expect(User.find).toHaveBeenCalledWith({ _id: { $in: ['user1'] } });
        expect(sendDeadlineReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmail: 'student@dlsu.edu.ph',
            recipientName: 'Student One'
        }));
        expect(Notification.updateOne).toHaveBeenLastCalledWith(
            { _id: 'notification1', emailStatus: 'sending' },
            expect.objectContaining({ $set: expect.objectContaining({ emailStatus: 'sent' }) })
        );
        expect(summary.emailsSent).toBe(1);
    });

    test('a later reminder window produces a different notification key', () => {
        const app = application(3);
        const requirement = { type: 'passport', label: 'Passport Bio-Page', status: 'missing' };
        const threeDay = buildDeadlineReminder({ application: app, requirement, daysRemaining: 3 });
        const oneDay = buildDeadlineReminder({ application: app, requirement, daysRemaining: 1 });
        expect(threeDay.deduplicationKey).not.toBe(oneDay.deduplicationKey);
    });

    test('skips complete, expired, finalized, and outside-window applications', async () => {
        mockQueries([
            application(3),
            application(-1, { _id: 'expired' }),
            application(3, { _id: 'final', status: 'accepted' }),
            application(5, { _id: 'outside' })
        ], [{ userId: 'user1', type: 'passport', status: 'verified', uploadedAt: now }]);
        const summary = await generateDeadlineReminders({ now });
        expect(summary.skippedComplete).toBe(1);
        expect(summary.skippedFinalizedOrExpired).toBe(2);
        expect(summary.skippedOutsideWindow).toBe(1);
        expect(Notification.updateOne).not.toHaveBeenCalled();
    });
});
