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

jest.mock('../models/Applications', () => ({
    aggregate: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn()
}));

jest.mock('../models/AuditLog', () => ({
    insertMany: jest.fn(),
    create: jest.fn()
}));

jest.mock('../models/Opportunity', () => ({
    find: jest.fn()
}));

jest.mock('../lib/eventNotifications', () => ({
    notifyApplicationStatusChange: jest.fn(() => Promise.resolve()),
    notifyOpportunityEvent: jest.fn(() => Promise.resolve())
}));

const Application = require('../models/Applications');
const AuditLog = require('../models/AuditLog');
const Opportunity = require('../models/Opportunity');
const { notifyApplicationStatusChange } = require('../lib/eventNotifications');
const { app } = require('../server');

const ADMIN = { _id: '64b000000000000000000001', role: 'OVPERI_Admin' };
const STUDENT = { _id: '64b000000000000000000002', role: 'Student' };
const APP_ONE = '64b000000000000000000011';
const APP_TWO = '64b000000000000000000012';
const OPPORTUNITY_ID = '64b000000000000000000021';

let httpServer;
let baseUrl;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

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
    Opportunity.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{
            _id: OPPORTUNITY_ID,
            name: 'Test Exchange Program'
        }])
    });
});

describe('GET /api/applications/export', () => {
    test('requires an authenticated session', async () => {
        mockSessionUser = null;

        const response = await request('/api/applications/export');

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ success: false, error: 'Please log in.' });
        expect(Application.aggregate).not.toHaveBeenCalled();
    });

    test('requires an administrator role', async () => {
        mockSessionUser = STUDENT;

        const response = await request('/api/applications/export');

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ success: false, error: 'Admin access required.' });
        expect(Application.aggregate).not.toHaveBeenCalled();
    });

    test('returns selected applications as an attachment', async () => {
        Application.aggregate.mockResolvedValue([{
            name: 'Juan Dela Cruz',
            student_id: '12310001',
            college: 'CCS',
            cgpa: 3.7,
            opp_name: 'TUM Exchange Program',
            institution: 'Technical University of Munich',
            status: 'nominated',
            documents_status: 'complete',
            submitted_date: '2026-07-20T00:00:00.000Z'
        }]);

        const response = await request(`/api/applications/export?ids=${APP_ONE}&sort=cgpaDesc`);
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/csv');
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="selected-applications.csv"');
        expect(body).toContain('Student Name,Student Id,College,CGPA');
        expect(body).toContain('"Juan Dela Cruz","12310001","CCS","3.7"');
        const pipeline = Application.aggregate.mock.calls[0][0];
        expect(pipeline.find(stage => stage.$sort)?.$sort).toEqual({
            'student.cgpa': -1,
            sortLastName: 1,
            sortFirstName: 1
        });
        expect(pipeline.find(stage => stage.$match)?.$match._id.$in).toHaveLength(1);
    });

    test('returns a useful 404 when no applications match', async () => {
        Application.aggregate.mockResolvedValue([]);

        const response = await request('/api/applications/export?status=rejected');

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'No applications match the selected export criteria.'
        });
    });
});

describe('POST /api/applications/bulk-action', () => {
    const jsonRequest = body => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const mockTargets = (targets, nextStatus) => {
        Application.find
            .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(targets) })
            .mockResolvedValueOnce(targets.map(target => ({
                ...target,
                status: nextStatus,
                opportunityId: OPPORTUNITY_ID
            })));
        Application.updateMany.mockResolvedValue({ matchedCount: targets.length, modifiedCount: targets.length });
        AuditLog.insertMany.mockResolvedValue([]);
    };

    test.each([
        ['nominated', [
            { _id: APP_ONE, status: 'submitted', documentsStatus: 'complete' },
            { _id: APP_TWO, status: 'under-review', documentsStatus: 'complete' }
        ]],
        ['accepted', [
            { _id: APP_ONE, status: 'nominated', documentsStatus: 'complete' },
            { _id: APP_TWO, status: 'nominated', documentsStatus: 'complete' }
        ]]
    ])('applies a valid batch transition to %s and writes audit entries', async (status, targets) => {
        mockTargets(targets, status);

        const response = await request('/api/applications/bulk-action', jsonRequest({
            ids: [APP_ONE, APP_TWO],
            status
        }));
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(Application.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [APP_ONE, APP_TWO] } },
            expect.objectContaining({ $set: { status } })
        );
        expect(AuditLog.insertMany).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                action: 'application_bulk_status_changed',
                changes: [{ field: 'status', from: targets[0].status, to: status }]
            })
        ]));
        expect(notifyApplicationStatusChange).toHaveBeenCalledTimes(2);
        expect(notifyApplicationStatusChange).toHaveBeenNthCalledWith(1, {
            application: expect.objectContaining({
                _id: APP_ONE,
                status,
                opportunityId: OPPORTUNITY_ID
            }),
            fromStatus: targets[0].status,
            toStatus: status,
            opportunityName: 'Test Exchange Program'
        });
        expect(notifyApplicationStatusChange).toHaveBeenNthCalledWith(2, {
            application: expect.objectContaining({
                _id: APP_TWO,
                status,
                opportunityId: OPPORTUNITY_ID
            }),
            fromStatus: targets[1].status,
            toStatus: status,
            opportunityName: 'Test Exchange Program'
        });
    });

    test('rejects an invalid application id before querying the database', async () => {
        const response = await request('/api/applications/bulk-action', jsonRequest({
            ids: [APP_ONE, 'not-an-object-id'],
            status: 'nominated'
        }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'One or more application ids are invalid.'
        });
        expect(Application.find).not.toHaveBeenCalled();
    });

    test('rejects a mixed selection when one application cannot make the requested transition', async () => {
        const targets = [
            { _id: APP_ONE, status: 'submitted', documentsStatus: 'complete' },
            { _id: APP_TWO, status: 'accepted', documentsStatus: 'complete' }
        ];
        Application.find.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(targets) });

        const response = await request('/api/applications/bulk-action', jsonRequest({
            ids: [APP_ONE, APP_TWO],
            status: 'nominated'
        }));
        const result = await response.json();

        expect(response.status).toBe(409);
        expect(result.success).toBe(false);
        expect(result.error).toContain('final and cannot be changed');
        expect(Application.updateMany).not.toHaveBeenCalled();
        expect(AuditLog.insertMany).not.toHaveBeenCalled();
    });
});
