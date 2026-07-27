jest.mock('../models/Notification');
jest.mock('../models/User');
jest.mock('../lib/email', () => ({
    isEmailNotificationsEnabled: jest.fn(),
    sendEventEmail: jest.fn()
}));

const Notification = require('../models/Notification');
const User = require('../models/User');
const { isEmailNotificationsEnabled, sendEventEmail } = require('../lib/email');
const { notifyApplicationStatusChange, notifyOpportunityEvent } = require('../lib/eventNotifications');
const { buildEventEmail } = jest.requireActual('../lib/email');

const application = { _id: 'app-1', userId: 'student-1', opportunityId: 'opp-1' };

beforeEach(() => jest.clearAllMocks());

describe('Immediate event notifications', () => {
    test('persists a status-change notification and skips email when notifications are disabled', async () => {
        Notification.findOneAndUpdate.mockResolvedValueOnce({ _id: 'note-1', userId: 'student-1' });
        isEmailNotificationsEnabled.mockReturnValue(false);

        const result = await notifyApplicationStatusChange({
            application, fromStatus: 'submitted', toStatus: 'nominated', opportunityName: 'NUS Exchange'
        });

        // Notification is created (idempotently, by deduplication key) ...
        expect(Notification.findOneAndUpdate).toHaveBeenCalledTimes(1);
        const [query, update] = Notification.findOneAndUpdate.mock.calls[0];
        expect(query.deduplicationKey).toContain('status:app-1:submitted->nominated');
        expect(update.$setOnInsert).toEqual(expect.objectContaining({
            type: 'application-status-change', userId: 'student-1', toValue: 'nominated'
        }));
        // ... but no email is dispatched.
        expect(sendEventEmail).not.toHaveBeenCalled();
        expect(result.email.status).toBe('skipped');
    });

    test('claims the send and emails the student when enabled', async () => {
        Notification.findOneAndUpdate
            .mockResolvedValueOnce({ _id: 'note-1', userId: 'student-1' })      // upsert
            .mockResolvedValueOnce({ _id: 'note-1', userId: 'student-1', title: 'Application status: accepted' }); // claim
        Notification.updateOne.mockResolvedValue({});
        isEmailNotificationsEnabled.mockReturnValue(true);
        User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Ana', email: 'ana@dlsu.edu.ph' }) });
        sendEventEmail.mockResolvedValue({ status: 'sent', messageId: 'm-1' });

        const result = await notifyApplicationStatusChange({
            application, fromStatus: 'nominated', toStatus: 'accepted', opportunityName: 'NUS Exchange'
        });

        expect(sendEventEmail).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmail: 'ana@dlsu.edu.ph', recipientName: 'Ana'
        }));
        expect(Notification.updateOne).toHaveBeenCalledWith(
            { _id: 'note-1', emailStatus: 'sending' },
            expect.objectContaining({ $set: expect.objectContaining({ emailStatus: 'sent' }) })
        );
        expect(result.email.status).toBe('sent');
    });

    test('records a failed email without throwing (request path stays alive)', async () => {
        Notification.findOneAndUpdate
            .mockResolvedValueOnce({ _id: 'note-2', userId: 'student-1' })
            .mockResolvedValueOnce({ _id: 'note-2', userId: 'student-1', title: 'Update: NUS Exchange' });
        Notification.updateOne.mockResolvedValue({});
        isEmailNotificationsEnabled.mockReturnValue(true);
        User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Ana', email: 'ana@dlsu.edu.ph' }) });
        sendEventEmail.mockResolvedValue({ status: 'failed', error: 'SMTP down' });

        const opportunity = { _id: 'opp-1', name: 'NUS Exchange', status: 'closed' };
        const result = await notifyOpportunityEvent({
            application, opportunity, eventType: 'opportunity-closed', message: 'NUS Exchange is now closed.'
        });

        expect(Notification.updateOne).toHaveBeenCalledWith(
            { _id: 'note-2', emailStatus: 'sending' },
            expect.objectContaining({ $set: expect.objectContaining({ emailStatus: 'failed', emailError: 'SMTP down' }) })
        );
        expect(result.email.status).toBe('failed');
    });
});

describe('Event email rendering', () => {
    test('escapes dynamic content in the HTML body', () => {
        const email = buildEventEmail({
            recipientName: '<Ana>',
            notification: { title: 'Application status: accepted', message: '<b>accepted</b>', opportunityName: 'NUS & Co' }
        });
        expect(email.subject).toBe('[GEMS] Application status: accepted');
        expect(email.html).toContain('&lt;Ana&gt;');
        expect(email.html).toContain('&lt;b&gt;accepted&lt;/b&gt;');
        expect(email.html).toContain('NUS &amp; Co');
        expect(email.html).not.toContain('<b>accepted</b>');
    });
});
