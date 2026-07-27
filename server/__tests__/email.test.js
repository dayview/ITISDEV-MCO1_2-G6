jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const nodemailer = require('nodemailer');
const {
    buildDeadlineReminderEmail,
    sendDeadlineReminderEmail,
    resetEmailTransporter
} = require('../lib/email');

const reminder = {
    title: 'Passport due in 3 days',
    message: 'Passport Bio-Page is missing for your NUS Exchange application. Upload it by July 19, 2026.',
    opportunityName: 'NUS Exchange',
    requirementLabel: 'Passport Bio-Page',
    deadline: new Date('2026-07-19T00:00:00.000Z')
};

describe('Deadline reminder email delivery', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        resetEmailTransporter();
        process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.EMAIL_FROM;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('does not send mail when email notifications are disabled', async () => {
        const result = await sendDeadlineReminderEmail({
            recipientEmail: 'student@dlsu.edu.ph',
            recipientName: 'Student One',
            reminder
        });

        expect(result).toEqual({ status: 'skipped', reason: 'Email notifications are disabled.' });
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    test('sends a formatted Gmail SMTP message when configured', async () => {
        process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
        process.env.SMTP_USER = 'gems.sender@gmail.com';
        process.env.SMTP_PASS = 'app-password';
        process.env.EMAIL_FROM = 'GEMS <gems.sender@gmail.com>';
        const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });
        nodemailer.createTransport.mockReturnValue({ sendMail });

        const result = await sendDeadlineReminderEmail({
            recipientEmail: 'student@dlsu.edu.ph',
            recipientName: 'Student One',
            reminder
        });

        expect(result).toEqual({ status: 'sent', messageId: 'message-1' });
        expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true
        }));
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: 'GEMS <gems.sender@gmail.com>',
            to: 'student@dlsu.edu.ph',
            subject: '[GEMS] Passport due in 3 days'
        }));
    });

    test('escapes dynamic content in the HTML email body', () => {
        const email = buildDeadlineReminderEmail({
            recipientName: '<Student>',
            reminder: { ...reminder, message: '<script>alert(1)</script>' }
        });

        expect(email.html).toContain('&lt;Student&gt;');
        expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(email.html).not.toContain('<script>');
    });
});
