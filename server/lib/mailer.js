const nodemailer = require('nodemailer');

// Mirrors the SMTP settings logic in the deadline-reminders email feature (server/lib/email.js
// on integration/deadline-reminders): default to Gmail's SMTP relay and infer `secure` from the
// port when SMTP_SECURE isn't set explicitly, rather than silently defaulting to false.
const getSmtpSettings = () => {
    const port = Number(process.env.SMTP_PORT || 465);
    return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
    };
};

// Built lazily so a missing SMTP config never crashes module load (e.g. in tests, where
// SMTP_* env vars are never set) — the transporter is only exercised when sendOtpEmail is
// actually called, and this module is fully jest.mock()-ed in route tests anyway.
let transporter;
const getTransporter = () => {
    if (!transporter) transporter = nodemailer.createTransport(getSmtpSettings());
    return transporter;
};

// DLSU addresses (@dlsu.edu.ph) run on Google Workspace and accept mail from any standard
// sender — delivering an OTP there is plain SMTP delivery, no DLSU-specific integration
// is required. Only the "from" address would need to be an official DLSU domain if that
// were ever a requirement, which it isn't here.
const sendOtpEmail = (toEmail, code) => getTransporter().sendMail({
    from: process.env.SMTP_FROM || '"GEMS OVPERI" <no-reply@gems.app>',
    to: toEmail,
    subject: 'Your GEMS verification code',
    text: `Your GEMS verification code is ${code}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your GEMS verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`
});

module.exports = { sendOtpEmail, getTransporter };
