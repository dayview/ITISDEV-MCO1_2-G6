const STATUS = require('../../public/js/application-status');
const { ALLOWED_TRANSITIONS: SERVER_TRANSITIONS } = require('../lib/applications');

describe('Application Status - canonical status mapping', () => {
    test.each([
        ['submitted', 'Submitted', 'active', 40],
        ['under-review', 'Under Review', 'active', 60],
        ['nominated', 'Nominated', 'active', 80],
        ['accepted', 'Accepted', 'completed', 100],
        ['rejected', 'Not Selected', 'completed', 100]
    ])('status "%s" maps to label "%s", group "%s", progress %i', (status, label, group, progress) => {
        expect(STATUS.getStatusLabel(status)).toBe(label);
        expect(STATUS.getStatusGroup(status)).toBe(group);
        expect(STATUS.getStatusProgress(status)).toBe(progress);
    });

    test('an unrecognized status renders safely as "Unknown status" instead of crashing', () => {
        expect(STATUS.getStatusLabel('some-future-status')).toBe('Unknown status');
        expect(STATUS.getStatusGroup('some-future-status')).toBe('unknown');
        expect(STATUS.getStatusProgress(undefined)).toBe(0);
    });

    test('covers exactly the five statuses defined on the Application schema, no invented ones like "draft"', () => {
        expect(Object.keys(STATUS.STATUS_CONFIG).sort()).toEqual(
            ['accepted', 'nominated', 'rejected', 'submitted', 'under-review'].sort()
        );
    });
});

describe('Application Status - countByFilter', () => {
    test('counts every application into "all" plus its status group', () => {
        const applications = [
            { status: 'submitted' },
            { status: 'under-review' },
            { status: 'accepted' },
            { status: 'rejected' }
        ];
        expect(STATUS.countByFilter(applications)).toEqual({ all: 4, active: 2, completed: 2, unknown: 0 });
    });

    test('counts are derived only from the applications actually passed in, not a fabricated baseline', () => {
        expect(STATUS.countByFilter([])).toEqual({ all: 0, active: 0, completed: 0, unknown: 0 });
        expect(STATUS.countByFilter([{ status: 'submitted' }])).toEqual({ all: 1, active: 1, completed: 0, unknown: 0 });
    });

    test('an unknown status is bucketed separately rather than breaking the count', () => {
        const counts = STATUS.countByFilter([{ status: 'weird-status' }]);
        expect(counts.unknown).toBe(1);
        expect(counts.all).toBe(1);
    });
});

describe('Application Status - filterApplications', () => {
    const applications = [
        { id: 'a', status: 'submitted' },
        { id: 'b', status: 'accepted' },
        { id: 'c', status: 'rejected' }
    ];

    test('"all" (or no filter) returns every application', () => {
        expect(STATUS.filterApplications(applications, 'all').map(a => a.id)).toEqual(['a', 'b', 'c']);
        expect(STATUS.filterApplications(applications, undefined).map(a => a.id)).toEqual(['a', 'b', 'c']);
    });

    test('"active" returns only in-progress applications', () => {
        expect(STATUS.filterApplications(applications, 'active').map(a => a.id)).toEqual(['a']);
    });

    test('"completed" returns only terminal applications', () => {
        expect(STATUS.filterApplications(applications, 'completed').map(a => a.id)).toEqual(['b', 'c']);
    });

    test('a filter matching nothing returns an empty array rather than throwing', () => {
        expect(STATUS.filterApplications([{ status: 'submitted' }], 'completed')).toEqual([]);
    });
});

describe('Application Status - transition map mirrors the server', () => {
    test('the client ALLOWED_TRANSITIONS is identical to the server authority', () => {
        expect(STATUS.ALLOWED_TRANSITIONS).toEqual(SERVER_TRANSITIONS);
    });

    test('getAllowedTransitions / canTransition agree with the map', () => {
        expect(STATUS.getAllowedTransitions('submitted')).toEqual(['under-review', 'rejected']);
        expect(STATUS.canTransition('nominated', 'accepted')).toBe(true);
        expect(STATUS.canTransition('accepted', 'rejected')).toBe(false);
        expect(STATUS.getAllowedTransitions('unknown-status')).toEqual([]);
    });
});
