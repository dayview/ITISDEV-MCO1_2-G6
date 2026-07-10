jest.mock('../models/User');
jest.mock('bcrypt');

const User = require('../models/User');
const bcrypt = require('bcrypt');
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

describe('Authentication - register: duplicate email/student ID detection', () => {
    const registerHandler = getHandler('post', '/register');

    beforeEach(() => {
        jest.clearAllMocks();
        bcrypt.hash.mockResolvedValue('hashed-password');
    });

    test('returns 409 when User.create rejects with a duplicate-key error (Mongo code 11000)', async () => {
        User.create.mockRejectedValue({ code: 11000 });
        const req = {
            body: {
                email: 'juan_delacruz@dlsu.edu.ph',
                password: 'password123',
                name: 'Juan Dela Cruz',
                studentId: '12345678'
            },
            session: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'An account with this email or student ID already exists.'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('propagates non-duplicate-key errors to the error handler instead of masking them', async () => {
        User.create.mockRejectedValue(new Error('connection lost'));
        const req = {
            body: {
                email: 'juan_delacruz@dlsu.edu.ph',
                password: 'password123',
                name: 'Juan Dela Cruz',
                studentId: '12345678'
            },
            session: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalledWith(409);
    });

    test('creates the account and starts a session when registration succeeds', async () => {
        User.create.mockResolvedValue({
            _id: 'u1', email: 'juan_delacruz@dlsu.edu.ph', name: 'Juan Dela Cruz',
            role: 'Student', studentId: '12345678', college: 'CCS'
        });
        const req = {
            body: {
                email: 'juan_delacruz@dlsu.edu.ph',
                password: 'password123',
                name: 'Juan Dela Cruz',
                studentId: '12345678'
            },
            session: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(req.session.user.role).toBe('Student');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, redirectTo: '/dashboard.html' }));
    });
});

describe('Authentication - register: input validation', () => {
    const registerHandler = getHandler('post', '/register');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects registration with a non-DLSU email before touching the database', async () => {
        const req = {
            body: { email: 'juan@gmail.com', password: 'password123', name: 'Juan', studentId: '123' },
            session: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Use a valid DLSU email address.' });
        expect(User.create).not.toHaveBeenCalled();
    });

    test('rejects registration with a password shorter than 8 characters', async () => {
        const req = {
            body: { email: 'juan@dlsu.edu.ph', password: 'short', name: 'Juan', studentId: '123' },
            session: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Password must be at least 8 characters.' });
        expect(User.create).not.toHaveBeenCalled();
    });

    test('rejects registration missing required fields', async () => {
        const req = { body: { email: 'juan@dlsu.edu.ph' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await registerHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(User.create).not.toHaveBeenCalled();
    });
});

describe('Authentication - login', () => {
    const loginHandler = getHandler('post', '/login');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns 401 for an unknown email', async () => {
        User.findOne.mockResolvedValue(null);
        const req = { body: { email: 'ghost@dlsu.edu.ph', password: 'password123' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials.' });
    });

    test('returns 401 when bcrypt.compare rejects the password', async () => {
        User.findOne.mockResolvedValue({ passwordHashed: '$2b$10$somehashedvalue' });
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { email: 'juan@dlsu.edu.ph', password: 'wrong-password' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', '$2b$10$somehashedvalue');
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials.' });
    });

    test('logs in and redirects an admin to the admin dashboard when bcrypt.compare accepts the password', async () => {
        User.findOne.mockResolvedValue({
            _id: 'admin1', email: 'admin@dlsu.edu.ph', role: 'OVPERI_Admin', passwordHashed: '$2b$10$somehashedvalue'
        });
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { email: 'admin@dlsu.edu.ph', password: 'GemsDev123!' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: '/admin/dashboard.html' }));
    });

    test('does not fall back to a plaintext equality check when the submitted password literally matches passwordHashed', async () => {
        User.findOne.mockResolvedValue({ passwordHashed: 'not-a-real-hash' });
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { email: 'juan@dlsu.edu.ph', password: 'not-a-real-hash' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(bcrypt.compare).toHaveBeenCalledWith('not-a-real-hash', 'not-a-real-hash');
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials.' });
    });

    test('rejects login when the user has no passwordHashed value rather than throwing', async () => {
        User.findOne.mockResolvedValue({ email: 'juan@dlsu.edu.ph' });
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { email: 'juan@dlsu.edu.ph', password: 'anything123' }, session: {} };
        const res = mockRes();
        const next = jest.fn();

        await loginHandler(req, res, next);

        expect(bcrypt.compare).toHaveBeenCalledWith('anything123', '');
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
