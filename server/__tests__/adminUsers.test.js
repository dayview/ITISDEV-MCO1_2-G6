const { requireSystemAdmin } = require('../middleware/auth');
const { VALID_ROLES, isValidRole, mapUserSummary } = require('../lib/users');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('Authorization - system admin verification middleware (requireSystemAdmin)', () => {
    test('allows System_Admin through', () => {
        const req = { user: { role: 'System_Admin' } };
        const res = mockRes();
        const next = jest.fn();

        requireSystemAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects an OVPERI_Admin with 403', () => {
        const req = { user: { role: 'OVPERI_Admin' } };
        const res = mockRes();
        const next = jest.fn();

        requireSystemAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Forbidden. System admin access required.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects a Student role with 403', () => {
        const req = { user: { role: 'Student' } };
        const res = mockRes();
        const next = jest.fn();

        requireSystemAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects when req.user is missing entirely', () => {
        const req = {};
        const res = mockRes();
        const next = jest.fn();

        requireSystemAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('User Management - role validation', () => {
    test.each(VALID_ROLES)('accepts the valid role "%s"', (role) => {
        expect(isValidRole(role)).toBe(true);
    });

    test('rejects a role outside the allowed set', () => {
        expect(isValidRole('SuperAdmin')).toBe(false);
        expect(isValidRole('')).toBe(false);
        expect(isValidRole(undefined)).toBe(false);
    });

    test('VALID_ROLES exposes exactly the three known roles', () => {
        expect(VALID_ROLES).toEqual(['Student', 'OVPERI_Admin', 'System_Admin']);
    });
});

describe('User Management - admin-facing user summary mapping', () => {
    test('maps the fields needed by the admin user list, stringifying the id', () => {
        const user = {
            _id: { toString: () => '507f1f77bcf86cd799439011' },
            email: 'jane@dlsu.edu.ph',
            name: 'Jane Dela Cruz',
            role: 'Student',
            isActive: true,
            studentId: '12345678',
            college: 'CCS',
            createdAt: new Date('2026-01-01'),
            passwordHashed: 'should-not-leak',
        };

        const summary = mapUserSummary(user);

        expect(summary).toEqual({
            id: '507f1f77bcf86cd799439011',
            email: 'jane@dlsu.edu.ph',
            name: 'Jane Dela Cruz',
            role: 'Student',
            isActive: true,
            studentId: '12345678',
            college: 'CCS',
            createdAt: user.createdAt,
        });
        expect(summary.passwordHashed).toBeUndefined();
    });
});
