const { requireAuth, requireAdmin } = require('../middleware/auth');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('Authentication - session verification middleware (requireAuth)', () => {
    test('rejects a request with no session user with 401', () => {
        const req = { session: {} };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized. Please log in.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects a request with no session object at all', () => {
        const req = {};
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('attaches req.user and calls next when a session user exists', () => {
        const sessionUser = { _id: '1', role: 'Student' };
        const req = { session: { user: sessionUser } };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(req.user).toBe(sessionUser);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe('Authentication - admin role verification middleware (requireAdmin)', () => {
    test('allows OVPERI_Admin through', () => {
        const req = { user: { role: 'OVPERI_Admin' } };
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('allows System_Admin through', () => {
        const req = { user: { role: 'System_Admin' } };
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    test('rejects a Student role with 403', () => {
        const req = { user: { role: 'Student' } };
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Forbidden. Admin access required.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects when req.user is missing entirely', () => {
        const req = {};
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
