const nodemailer = require('nodemailer');

let transporter;

const isEmailNotificationsEnabled = () => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

const getSmtpSettings = () => {
    const port = Number(process.env.SMTP_PORT || 465);
    return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
        }
    };
};

const hasSmtpConfiguration = () => {
    const { auth } = getSmtpSettings();
    return Boolean(auth.user && auth.pass && (process.env.EMAIL_FROM || auth.user));
};

const getTransporter = () => {
    if (!transporter) transporter = nodemailer.createTransport(getSmtpSettings());
    return transporter;
};

const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const appBaseUrl = () => String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const buildDeadlineReminderEmail = ({ recipientName, reminder }) => {
    const name = recipientName || 'Student';
    const documentsUrl = `${appBaseUrl()}/documents.html`;
    const subject = `[GEMS] ${reminder.title}`;
    const text = [
        `Hello ${name},`,
        '',
        reminder.message,
        '',
        `Opportunity: ${reminder.opportunityName}`,
        `Requirement: ${reminder.requirementLabel}`,
        `Deadline: ${new Date(reminder.deadline).toLocaleDateString('en-US', { timeZone: process.env.APP_TIMEZONE || 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' })}`,
        '',
        `Open your document checklist: ${documentsUrl}`,
        '',
        'GEMS — Global Exchange Management System'
    ].join('\n');
    const html = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>${escapeHtml(reminder.message)}</p>
      <ul>
        <li><strong>Opportunity:</strong> ${escapeHtml(reminder.opportunityName)}</li>
        <li><strong>Requirement:</strong> ${escapeHtml(reminder.requirementLabel)}</li>
        <li><strong>Deadline:</strong> ${escapeHtml(new Date(reminder.deadline).toLocaleDateString('en-US', { timeZone: process.env.APP_TIMEZONE || 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }))}</li>
      </ul>
      <p><a href="${escapeHtml(documentsUrl)}">Open your document checklist</a></p>
      <p>GEMS — Global Exchange Management System</p>
    `;

    return { subject, text, html };
};

const sendDeadlineReminderEmail = async ({ recipientEmail, recipientName, reminder }) => {
    if (!isEmailNotificationsEnabled()) return { status: 'skipped', reason: 'Email notifications are disabled.' };
    if (!recipientEmail) return { status: 'skipped', reason: 'The student does not have an email address.' };
    if (!hasSmtpConfiguration()) return { status: 'skipped', reason: 'Gmail SMTP is not configured.' };

    try {
        const content = buildDeadlineReminderEmail({ recipientName, reminder });
        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: recipientEmail,
            subject: content.subject,
            text: content.text,
            html: content.html
        });
        return { status: 'sent', messageId: info.messageId || '' };
    } catch (error) {
        return { status: 'failed', error: String(error.message || 'Unable to send email.').slice(0, 500) };
    }
};

// Generic event email (application status change / opportunity event). Reuses the
// same transporter, SMTP guards, and skip semantics as the deadline reminder path.
const buildEventEmail = ({ recipientName, notification }) => {
    const name = recipientName || 'Student';
    const link = `${appBaseUrl()}/applications.html`;
    const subject = `[GEMS] ${notification.title}`;
    const text = [
        `Hello ${name},`,
        '',
        notification.message,
        '',
        notification.opportunityName ? `Opportunity: ${notification.opportunityName}` : '',
        `View your applications: ${link}`,
        '',
        'GEMS — Global Exchange Management System'
    ].filter(Boolean).join('\n');
    const html = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>${escapeHtml(notification.message)}</p>
      ${notification.opportunityName ? `<p><strong>Opportunity:</strong> ${escapeHtml(notification.opportunityName)}</p>` : ''}
      <p><a href="${escapeHtml(link)}">View your applications</a></p>
      <p>GEMS — Global Exchange Management System</p>
    `;

    return { subject, text, html };
};

const sendEventEmail = async ({ recipientEmail, recipientName, notification }) => {
    if (!isEmailNotificationsEnabled()) return { status: 'skipped', reason: 'Email notifications are disabled.' };
    if (!recipientEmail) return { status: 'skipped', reason: 'The student does not have an email address.' };
    if (!hasSmtpConfiguration()) return { status: 'skipped', reason: 'Gmail SMTP is not configured.' };

    try {
        const content = buildEventEmail({ recipientName, notification });
        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: recipientEmail,
            subject: content.subject,
            text: content.text,
            html: content.html
        });
        return { status: 'sent', messageId: info.messageId || '' };
    } catch (error) {
        return { status: 'failed', error: String(error.message || 'Unable to send email.').slice(0, 500) };
    }
};

const resetEmailTransporter = () => {
    transporter = undefined;
};

module.exports = {
    isEmailNotificationsEnabled,
    getSmtpSettings,
    hasSmtpConfiguration,
    buildDeadlineReminderEmail,
    sendDeadlineReminderEmail,
    buildEventEmail,
    sendEventEmail,
    resetEmailTransporter
};
