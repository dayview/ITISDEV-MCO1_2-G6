let mockSessionUser;

jest.mock('express-session', () => jest.fn(() => (req, _res, next) => {
    req.session = { user: mockSessionUser };
    next();
}));

jest.mock('connect-mongo', () => ({ create: jest.fn(() => ({})) }));

jest.mock('../config/db', () => {
    const connectDB = jest.fn();
    connectDB.buildDatabaseConfig = jest.fn(() => ({
        mongoUri: 'mongodb://127.0.0.1:27017/gems_test',
        options: {}
    }));
    return connectDB;
});

jest.mock('../models/AuditLog', () => ({
    find: jest.fn(),
    countDocuments: jest.fn()
}));

jest.mock('../models/User', () => ({
    find: jest.fn()
}));

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { app } = require('../server');

const SYSTEM_ADMIN = { _id: '64b000000000000000000001', role: 'System_Admin' };
const OVPERI_ADMIN = { _id: '64b000000000000000000002', role: 'OVPERI_Admin' };
const STUDENT = { _id: '64b000000000000000000003', role: 'Student' };

let httpServer;
let baseUrl;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

function mockLogsChain(logs) {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(logs)
    };
    AuditLog.find.mockReturnValue(chain);
    return chain;
}

beforeAll(done => {
    httpServer = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
        done();
    });
});

afterAll(done => {
    httpServer.close(done);
});

beforeEach(() => {
    jest.clearAllMocks();
    mockSessionUser = SYSTEM_ADMIN;
    AuditLog.countDocuments.mockResolvedValue(0);
    mockLogsChain([]);
});

describe('GET /api/admin/audit-logs - access control', () => {
    test('rejects an unauthenticated request with 401', async () => {
        mockSessionUser = undefined;
        const res = await request('/api/admin/audit-logs');
        expect(res.status).toBe(401);
    });

    test('rejects an OVPERI_Admin with 403 (system admin only)', async () => {
        mockSessionUser = OVPERI_ADMIN;
        const res = await request('/api/admin/audit-logs');
        expect(res.status).toBe(403);
    });

    test('rejects a Student with 403', async () => {
        mockSessionUser = STUDENT;
        const res = await request('/api/admin/audit-logs');
        expect(res.status).toBe(403);
    });

    test('allows a System_Admin through', async () => {
        const res = await request('/api/admin/audit-logs');
        expect(res.status).toBe(200);
    });
});

describe('GET /api/admin/audit-logs - listing and pagination', () => {
    test('returns logs with pagination metadata', async () => {
        const logs = [{ _id: 'log1', action: 'user_login' }];
        mockLogsChain(logs);
        AuditLog.countDocuments.mockResolvedValue(1);

        const res = await request('/api/admin/audit-logs');
        const body = await res.json();

        expect(body.success).toBe(true);
        expect(body.data).toEqual(logs);
        expect(body.meta).toEqual({ total: 1, page: 1, pageSize: 50, totalPages: 1 });
    });

    test('applies page and pageSize from the query string', async () => {
        AuditLog.countDocuments.mockResolvedValue(120);
        const chain = mockLogsChain([]);

        await request('/api/admin/audit-logs?page=3&pageSize=25');

        expect(chain.skip).toHaveBeenCalledWith(50);
        expect(chain.limit).toHaveBeenCalledWith(25);
    });

    test('filters by action and targetType', async () => {
        await request('/api/admin/audit-logs?action=user_role_changed&targetType=User');

        expect(AuditLog.find).toHaveBeenCalledWith({ action: 'user_role_changed', targetType: 'User' });
    });

    test('filters by createdAt range', async () => {
        await request('/api/admin/audit-logs?from=2026-01-01&to=2026-01-31');

        expect(AuditLog.find).toHaveBeenCalledWith({
            createdAt: { $gte: new Date('2026-01-01'), $lte: new Date('2026-01-31') }
        });
    });

    test('ignores a malformed userId instead of erroring', async () => {
        await request('/api/admin/audit-logs?userId=not-an-object-id');

        expect(AuditLog.find).toHaveBeenCalledWith({});
    });
});

describe('GET /api/admin/audit-logs - actor search', () => {
    test('resolves actorSearch to matching user ids and filters by them', async () => {
        User.find.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]);

        await request('/api/admin/audit-logs?actorSearch=leon');

        expect(User.find).toHaveBeenCalledWith(
            { $or: [{ name: expect.any(RegExp) }, { email: expect.any(RegExp) }] },
            '_id'
        );
        expect(AuditLog.find).toHaveBeenCalledWith({ userId: { $in: ['u1', 'u2'] } });
    });

    test('returns no results when actorSearch matches no user, rather than ignoring the filter', async () => {
        User.find.mockResolvedValue([]);

        await request('/api/admin/audit-logs?actorSearch=nobody');

        expect(AuditLog.find).toHaveBeenCalledWith({ userId: { $in: [] } });
    });

    test('actorSearch takes precedence over a raw userId', async () => {
        User.find.mockResolvedValue([{ _id: 'u9' }]);

        await request('/api/admin/audit-logs?actorSearch=leon&userId=64b000000000000000000099');

        expect(AuditLog.find).toHaveBeenCalledWith({ userId: { $in: ['u9'] } });
    });
});
