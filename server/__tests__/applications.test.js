const {
    APPLICATION_STATUSES,
    isValidStatus,
    buildApplicationPayload,
    appendStatusHistory,
    toApplicationsCsv,
    applicationPipeline
} = require('../lib/applications');

describe('Application Logic - status transition / bulk status validation', () => {
    test.each(APPLICATION_STATUSES)('accepts the valid status "%s"', (status) => {
        expect(isValidStatus(status)).toBe(true);
    });

    test('rejects a status outside the allowed set', () => {
        expect(isValidStatus('approved')).toBe(false);
        expect(isValidStatus('')).toBe(false);
        expect(isValidStatus(undefined)).toBe(false);
    });

    test('APPLICATION_STATUSES exposes exactly the five known statuses', () => {
        expect(APPLICATION_STATUSES).toEqual(['submitted', 'under-review', 'nominated', 'accepted', 'rejected']);
    });
});

describe('Application Logic - application creation helper', () => {
    test('builds a submitted application payload with today\'s date and one document reference', () => {
        const now = new Date('2026-07-02T12:00:00Z');
        const payload = buildApplicationPayload({
            userId: 'u1',
            opportunityId: 'o1',
            documents: [{ _id: 'd1' }, { _id: 'd2' }],
            now
        });

        expect(payload).toEqual({
            userId: 'u1',
            opportunityId: 'o1',
            documents: ['d1', 'd2'],
            documentsStatus: 'complete',
            submittedDate: '2026-07-02',
            statusHistory: [{ status: 'submitted', changedAt: now, changedBy: 'u1' }]
        });
    });

    test('defaults to an empty document list when none are provided', () => {
        const payload = buildApplicationPayload({ userId: 'u1', opportunityId: 'o1', now: new Date('2026-01-01') });
        expect(payload.documents).toEqual([]);
    });
});

describe('Application Logic - status history append', () => {
    test('appends a new entry without mutating the original history array', () => {
        const original = [{ status: 'submitted', changedAt: new Date('2026-01-01') }];
        const updated = appendStatusHistory(original, 'nominated', 'admin1', new Date('2026-02-01'));

        expect(updated).toHaveLength(2);
        expect(updated[1]).toEqual({ status: 'nominated', changedAt: new Date('2026-02-01'), changedBy: 'admin1' });
        expect(original).toHaveLength(1);
    });

    test('starts a fresh history when none exists yet', () => {
        const updated = appendStatusHistory(undefined, 'submitted', 'u1', new Date('2026-01-01'));
        expect(updated).toEqual([{ status: 'submitted', changedAt: new Date('2026-01-01'), changedBy: 'u1' }]);
    });
});

describe('Application Logic - CSV export formatter', () => {
    test('writes the header row followed by one row per record', () => {
        const csv = toApplicationsCsv([
            { name: 'Juan Dela Cruz', student_id: '123', college: 'CCS', cgpa: 3.5, opp_name: 'NUS Exchange', institution: 'NUS', status: 'submitted', documents_status: 'complete', submitted_date: '2026-01-01T00:00:00.000Z' }
        ]);
        const lines = csv.split('\n');
        expect(lines[0]).toBe('Student Name,Student Id,College,CGPA,Program,Institution,Status,Documents,Submitted Date');
        expect(lines[1]).toBe('"Juan Dela Cruz",123,CCS,3.5,"NUS Exchange","NUS",submitted,complete,2026-01-01T00:00:00.000Z');
    });

    test('escapes embedded double quotes in text fields', () => {
        const csv = toApplicationsCsv([{ name: 'Juan "JD" Cruz', opp_name: 'X', institution: 'Y' }]);
        expect(csv).toContain('"Juan ""JD"" Cruz"');
    });

    test('produces only the header row for an empty result set', () => {
        const csv = toApplicationsCsv([]);
        expect(csv.split('\n')).toHaveLength(1);
    });

    test('falls back to empty strings for missing optional fields', () => {
        const csv = toApplicationsCsv([{}]);
        const dataLine = csv.split('\n')[1];
        expect(dataLine).toBe('"",,,,"","",,,');
    });
});

describe('Application Logic - applicationPipeline query builder', () => {
    test('adds a $match stage filtering by status when provided', () => {
        const pipeline = applicationPipeline({ status: 'nominated' });
        const matchStage = pipeline.find(stage => stage.$match);
        expect(matchStage.$match.status).toBe('nominated');
    });

    test('omits the $match stage entirely when no filters are provided', () => {
        const pipeline = applicationPipeline({});
        expect(pipeline.some(stage => stage.$match)).toBe(false);
    });

    test('falls back to recency sort for an unrecognized sort key', () => {
        const pipeline = applicationPipeline({ sort: 'not-a-real-sort' });
        const sortStage = pipeline.find(stage => stage.$sort);
        expect(sortStage.$sort).toEqual({ createdAt: -1, submittedDate: -1 });
    });
});
