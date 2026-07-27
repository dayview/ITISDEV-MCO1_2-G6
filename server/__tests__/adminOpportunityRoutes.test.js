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

jest.mock('../models/Opportunity', () => ({
    find: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
}));

jest.mock('../models/Applications', () => ({
    countDocuments: jest.fn()
}));

jest.mock('../models/AuditLog', () => ({
    insertMany: jest.fn(),
    create: jest.fn()
}));

const Opportunity = require('../models/Opportunity');
const Application = require('../models/Applications');
const AuditLog = require('../models/AuditLog');
const { app } = require('../server');

const ADMIN = { _id: '64b000000000000000000001', role: 'OVPERI_Admin' };
const STUDENT = { _id: '64b000000000000000000002', role: 'Student' };
const PROGRAM_ONE = '64b000000000000000000011';
const PROGRAM_TWO = '64b000000000000000000012';

let httpServer;
let baseUrl;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);
const jsonRequest = body => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

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
    mockSessionUser = ADMIN;
});

describe('POST /api/admin/opportunities/bulk-action', () => {
    test('requires an authenticated session', async () => {
        mockSessionUser = null;

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'publish'
        }));

        expect(response.status).toBe(401);
        expect(Opportunity.find).not.toHaveBeenCalled();
    });

    test('requires an administrator role', async () => {
        mockSessionUser = STUDENT;

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'publish'
        }));

        expect(response.status).toBe(403);
        expect(Opportunity.find).not.toHaveBeenCalled();
    });

    test('publishes selected drafts and records each change in the audit log', async () => {
        const targets = [
            { _id: PROGRAM_ONE, name: 'TUM Exchange', status: 'draft', deadline: new Date('2099-07-31') },
            { _id: PROGRAM_TWO, name: 'UTokyo Exchange', status: 'draft', deadline: new Date('2099-08-31') }
        ];
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue(targets)
        });
        Opportunity.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
        AuditLog.insertMany.mockResolvedValue([]);

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE, PROGRAM_TWO],
            action: 'publish'
        }));
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result).toEqual({
            success: true,
            action: 'publish',
            status: 'published',
            count: 2
        });
        expect(Opportunity.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [PROGRAM_ONE, PROGRAM_TWO] }, status: 'draft' },
            { $set: { status: 'published' } },
            { runValidators: true }
        );
        expect(AuditLog.insertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                action: 'opportunity_published',
                targetId: PROGRAM_ONE,
                changes: [{ field: 'status', from: 'draft', to: 'published' }]
            }),
            expect.objectContaining({
                action: 'opportunity_published',
                targetId: PROGRAM_TWO,
                changes: [{ field: 'status', from: 'draft', to: 'published' }]
            })
        ]);
    });

    test('rejects invalid program ids before querying the database', async () => {
        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE, 'invalid-id'],
            action: 'publish'
        }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'One or more program ids are invalid.'
        });
        expect(Opportunity.find).not.toHaveBeenCalled();
    });

    test('rejects a mixed selection containing a published program', async () => {
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: PROGRAM_ONE, name: 'Draft Program', status: 'draft', deadline: new Date('2099-07-31') },
                { _id: PROGRAM_TWO, name: 'Published Program', status: 'published', deadline: new Date('2099-08-31') }
            ])
        });

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE, PROGRAM_TWO],
            action: 'publish'
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: '"Published Program" must be a draft before it can be published.'
        });
        expect(Opportunity.updateMany).not.toHaveBeenCalled();
        expect(AuditLog.insertMany).not.toHaveBeenCalled();
    });

    test('closes selected published programs and records each change in the audit log', async () => {
        const targets = [
            { _id: PROGRAM_ONE, name: 'TUM Exchange', status: 'published', deadline: new Date('2099-07-31') },
            { _id: PROGRAM_TWO, name: 'UTokyo Exchange', status: 'published', deadline: new Date('2099-08-31') }
        ];
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue(targets)
        });
        Opportunity.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
        AuditLog.insertMany.mockResolvedValue([]);

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE, PROGRAM_TWO],
            action: 'close'
        }));
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result).toEqual({
            success: true,
            action: 'close',
            status: 'closed',
            count: 2
        });
        expect(Opportunity.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [PROGRAM_ONE, PROGRAM_TWO] }, status: 'published' },
            { $set: { status: 'closed' } },
            { runValidators: true }
        );
        expect(AuditLog.insertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                action: 'opportunity_closed',
                targetId: PROGRAM_ONE,
                changes: [{ field: 'status', from: 'published', to: 'closed' }]
            }),
            expect.objectContaining({
                action: 'opportunity_closed',
                targetId: PROGRAM_TWO,
                changes: [{ field: 'status', from: 'published', to: 'closed' }]
            })
        ]);
    });

    test('rejects closing a program that is not published', async () => {
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: PROGRAM_ONE, name: 'Draft Program', status: 'draft', deadline: new Date('2099-07-31') }
            ])
        });

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'close'
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: '"Draft Program" must be published before it can be closed.'
        });
        expect(Opportunity.updateMany).not.toHaveBeenCalled();
        expect(AuditLog.insertMany).not.toHaveBeenCalled();
    });

    test('deletes selected unused drafts and records each deletion in the audit log', async () => {
        const targets = [
            { _id: PROGRAM_ONE, name: 'Unused Draft One', status: 'draft', deadline: new Date('2099-07-31') },
            { _id: PROGRAM_TWO, name: 'Unused Draft Two', status: 'draft', deadline: new Date('2099-08-31') }
        ];
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue(targets)
        });
        Application.countDocuments.mockResolvedValue(0);
        Opportunity.deleteMany.mockResolvedValue({ deletedCount: 2 });
        AuditLog.insertMany.mockResolvedValue([]);

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE, PROGRAM_TWO],
            action: 'delete'
        }));
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result).toEqual({ success: true, action: 'delete', count: 2 });
        expect(Application.countDocuments).toHaveBeenCalledWith({
            opportunityId: { $in: [PROGRAM_ONE, PROGRAM_TWO] }
        });
        expect(Opportunity.deleteMany).toHaveBeenCalledWith({
            _id: { $in: [PROGRAM_ONE, PROGRAM_TWO] },
            status: 'draft'
        });
        expect(AuditLog.insertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                action: 'opportunity_deleted',
                targetId: PROGRAM_ONE,
                changes: [{ field: 'status', from: 'draft', to: 'deleted' }]
            }),
            expect.objectContaining({
                action: 'opportunity_deleted',
                targetId: PROGRAM_TWO,
                changes: [{ field: 'status', from: 'draft', to: 'deleted' }]
            })
        ]);
    });

    test('rejects deleting a published program', async () => {
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: PROGRAM_ONE, name: 'Published Program', status: 'published', deadline: new Date('2099-07-31') }
            ])
        });

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'delete'
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: '"Published Program" must be a draft before it can be deleted.'
        });
        expect(Application.countDocuments).not.toHaveBeenCalled();
        expect(Opportunity.deleteMany).not.toHaveBeenCalled();
    });

    test('rejects deleting a draft with application history', async () => {
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: PROGRAM_ONE, name: 'Used Draft', status: 'draft', deadline: new Date('2099-07-31') }
            ])
        });
        Application.countDocuments.mockResolvedValue(1);

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'delete'
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'Programs with application history cannot be deleted. Close or retain them instead.'
        });
        expect(Opportunity.deleteMany).not.toHaveBeenCalled();
        expect(AuditLog.insertMany).not.toHaveBeenCalled();
    });

    test('rejects a draft with an expired deadline', async () => {
        Opportunity.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: PROGRAM_ONE, name: 'Expired Draft', status: 'draft', deadline: new Date('2020-01-01') }
            ])
        });

        const response = await request('/api/admin/opportunities/bulk-action', jsonRequest({
            ids: [PROGRAM_ONE],
            action: 'publish'
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: '"Expired Draft" needs a future application deadline before it can be published.'
        });
        expect(Opportunity.updateMany).not.toHaveBeenCalled();
        expect(AuditLog.insertMany).not.toHaveBeenCalled();
    });
});
