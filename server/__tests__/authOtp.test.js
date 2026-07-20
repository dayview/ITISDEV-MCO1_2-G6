jest.mock('../models/User');
jest.mock('../models/AuditLog');
jest.mock('bcrypt');
jest.mock('../lib/mailer');

const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail } = require('../lib/mailer');
const authRouter = require('../routes/auth');

function getHandler(method, routePath) {
    const layer = authRouter.stack.find(
        (l) => l.route && l.route.path === routePath && l.route.methods[method]
    );
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 1];
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// Mirrors the HMAC-SHA256 hashing done in routes/auth.js so tests can construct a
// matching otpCodeHash without importing route-internal helpers.
const hashOtp = (code) => crypto.createHmac('sha256', process.env.OTP_SECRET || 'gems-dev-otp-secret')
    .update(String(code)).digest('hex');

describe('Authentication - login: 2FA branch', () => {
    const loginHandler = getHandler('post', '/login');
    const bcrypt = require('bcrypt');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('a 2FA-enabled user is routed into the pending state instead of getting a full session', async () => {
        const user = {
            _id: 'u3', email: 'admin@dlsu.edu.ph', role: 'OVPERI_Admin', name: 'Admin',
            passwordHashed: '$2b$10$hash', twoFactorEnabled: true,
            otpSendCount: 0, otpSendWindowStart: null, otpLastSentAt: null,
            save: jest.fn().mockResolvedValue(true)
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        sendOtpEmail.mockResolvedValue(true);

        const req = {
            body: { email: 'admin@dlsu.edu.ph', password: 'GemsDev123!' },
            session: { cookie: {} },
            ip: '127.0.0.1'
        };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(sendOtpEmail).toHaveBeenCalledWith('admin@dlsu.edu.ph', expect.any(String));
        expect(req.session.user).toBeUndefined();
        expect(req.session.pendingUserId).toBe('u3');
        expect(req.session.cookie.maxAge).toBe(10 * 60 * 1000);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, requires2fa: true }));
    });

    test('a failed OTP email send returns a generic error, not the SMTP failure', async () => {
        const user = {
            _id: 'u4', email: 'admin2@dlsu.edu.ph', role: 'OVPERI_Admin', name: 'Admin2',
            passwordHashed: '$2b$10$hash', twoFactorEnabled: true,
            otpSendCount: 0, otpSendWindowStart: null, otpLastSentAt: null,
            save: jest.fn().mockResolvedValue(true)
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        sendOtpEmail.mockRejectedValue(new Error('SMTP connection refused'));

        const req = {
            body: { email: 'admin2@dlsu.edu.ph', password: 'GemsDev123!' },
            session: { cookie: {} },
            ip: '127.0.0.1'
        };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(502);
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(false);
        expect(payload.error).not.toMatch(/SMTP/i);
        expect(req.session.pendingUserId).toBeUndefined();
    });
});

describe('Authentication - verify-otp', () => {
    const verifyOtpHandler = getHandler('post', '/verify-otp');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('accepts a correct code, clears it, and promotes the session', async () => {
        const code = '123456';
        const user = {
            _id: 'u1', email: 'juan@dlsu.edu.ph', name: 'Juan', role: 'Student',
            otpCodeHash: hashOtp(code), otpExpiresAt: new Date(Date.now() + 60000), otpAttempts: 0,
            save: jest.fn().mockResolvedValue(true)
        };
        User.findById.mockResolvedValue(user);

        const req = {
            body: { code },
            session: {
                pendingUserId: 'u1',
                pendingExpiresAt: Date.now() + 60000,
                cookie: { maxAge: 10 * 60 * 1000 },
                regenerate: jest.fn((cb) => cb())
            },
            ip: '127.0.0.1'
        };
        const res = mockRes();
        const next = jest.fn();

        await verifyOtpHandler(req, res, next);

        expect(user.otpCodeHash).toBeUndefined();
        expect(req.session.user).toBeDefined();
        expect(req.session.user.email).toBe('juan@dlsu.edu.ph');
        expect(req.session.cookie.maxAge).toBeUndefined();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('rejects an incorrect code without establishing a session, and counts the attempt', async () => {
        const user = {
            _id: 'u2', email: 'maria@dlsu.edu.ph', name: 'Maria', role: 'Student',
            otpCodeHash: hashOtp('123456'), otpExpiresAt: new Date(Date.now() + 60000), otpAttempts: 0,
            save: jest.fn().mockResolvedValue(true)
        };
        User.findById.mockResolvedValue(user);

        const req = {
            body: { code: '000000' },
            session: {
                pendingUserId: 'u2',
                pendingExpiresAt: Date.now() + 60000,
                cookie: {},
                regenerate: jest.fn((cb) => cb())
            },
            ip: '127.0.0.1'
        };
        const res = mockRes();
        const next = jest.fn();

        await verifyOtpHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid code.' });
        expect(req.session.user).toBeUndefined();
        expect(user.otpAttempts).toBe(1);
    });

    test('rejects verification when there is no pending 2FA state on the session', async () => {
        const req = { body: { code: '123456' }, session: {}, ip: '127.0.0.1' };
        const res = mockRes();
        const next = jest.fn();

        await verifyOtpHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(User.findById).not.toHaveBeenCalled();
    });
});
