const {
    APPLICATION_STATUSES,
    isValidStatus,
    buildApplicationPayload,
    appendStatusHistory,
    toApplicationsCsv,
    applicationPipeline,
    getReviewedAt,
    mapStudentApplication
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

describe('Application Logic - getReviewedAt', () => {
    test('returns null when the only history entry is the initial submission', () => {
        const history = [{ status: 'submitted', changedAt: new Date('2026-01-01') }];
        expect(getReviewedAt(history)).toBeNull();
    });

    test('returns the changedAt of the most recent non-submitted entry', () => {
        const history = [
            { status: 'submitted', changedAt: new Date('2026-01-01') },
            { status: 'under-review', changedAt: new Date('2026-01-05') },
            { status: 'nominated', changedAt: new Date('2026-01-10') }
        ];
        expect(getReviewedAt(history)).toEqual(new Date('2026-01-10'));
    });

    test('returns null for an empty or missing history', () => {
        expect(getReviewedAt([])).toBeNull();
        expect(getReviewedAt(undefined)).toBeNull();
    });
});

describe('Application Logic - mapStudentApplication', () => {
    test('maps a populated application into the tracker-card contract', () => {
        const application = {
            _id: 'app1',
            opportunityId: { _id: 'opp1', name: 'Exchange Program', institution: 'Some University', country: 'Japan', deadline: new Date('2026-09-01') },
            status: 'under-review',
            documentsStatus: 'complete',
            submittedDate: '2026-06-01',
            createdAt: new Date('2026-06-01'),
            statusHistory: [
                { status: 'submitted', changedAt: new Date('2026-06-01') },
                { status: 'under-review', changedAt: new Date('2026-06-05') }
            ]
        };

        expect(mapStudentApplication(application)).toEqual({
            id: 'app1',
            opportunityId: 'opp1',
            programName: 'Exchange Program',
            hostInstitution: 'Some University',
            location: 'Japan',
            status: 'under-review',
            documentsStatus: 'complete',
            submittedAt: '2026-06-01',
            deadline: new Date('2026-09-01'),
            reviewedAt: new Date('2026-06-05')
        });
    });

    test('falls back to safe defaults when the opportunity was not populated', () => {
        const application = { _id: 'app2', opportunityId: 'opp2', status: 'submitted', documentsStatus: 'incomplete', createdAt: new Date('2026-06-01') };
        const mapped = mapStudentApplication(application);
        expect(mapped.opportunityId).toBe('opp2');
        expect(mapped.programName).toBe('Unknown opportunity');
        expect(mapped.hostInstitution).toBe('');
        expect(mapped.location).toBe('');
        expect(mapped.deadline).toBeNull();
        expect(mapped.reviewedAt).toBeNull();
    });

    test('never includes fields identifying another student', () => {
        const application = { _id: 'app3', userId: 'someone-elses-id', opportunityId: 'opp3', status: 'submitted', createdAt: new Date() };
        const mapped = mapStudentApplication(application);
        expect(mapped).not.toHaveProperty('userId');
        expect(mapped).not.toHaveProperty('studentId');
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
