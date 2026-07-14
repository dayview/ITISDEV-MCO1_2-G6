const { computeStatisticsSummary, getUrgentCutoff, URGENT_WINDOW_MS } = require('../lib/statistics');

const statusAgg = [
    { _id: 'submitted', count: 4 },
    { _id: 'under-review', count: 3 },
    { _id: 'nominated', count: 2 },
    { _id: 'accepted', count: 5 },
    { _id: 'rejected', count: 1 },
];

describe('Statistics Logic - per-status counts', () => {
    test('submitted count reflects the aggregation result', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, []).submitted).toBe(4);
    });

    test('under-review count reflects the aggregation result', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, [])['under-review']).toBe(3);
    });

    test('nominated count reflects the aggregation result', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, []).nominated).toBe(2);
    });

    test('accepted count reflects the aggregation result', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, []).accepted).toBe(5);
    });

    test('rejected count reflects the aggregation result', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, []).rejected).toBe(1);
    });

    test('pending count is the sum of submitted and under-review', () => {
        expect(computeStatisticsSummary(statusAgg, 0, 0, []).pending).toBe(7);
    });

    test('unknown status buckets from the aggregation are ignored', () => {
        const withUnknown = [...statusAgg, { _id: 'archived', count: 99 }];
        const summary = computeStatisticsSummary(withUnknown, 0, 0, []);
        expect(summary.archived).toBeUndefined();
    });

    test('defaults every count to 0 when the aggregation returns nothing', () => {
        const summary = computeStatisticsSummary([], 0, 0, []);
        expect(summary).toMatchObject({ submitted: 0, 'under-review': 0, nominated: 0, accepted: 0, rejected: 0, pending: 0 });
    });
});

describe('Statistics Logic - live opportunity count', () => {
    test('passes through the live program count unchanged', () => {
        expect(computeStatisticsSummary([], 0, 12, []).livePrograms).toBe(12);
    });
});

describe('Statistics Logic - urgent deadline count', () => {
    test('passes through the urgent count', () => {
        expect(computeStatisticsSummary([], 6, 0, []).urgent).toBe(6);
    });

    test('defaults urgent to 0 when not provided', () => {
        expect(computeStatisticsSummary([], undefined, 0, []).urgent).toBe(0);
    });

    test('getUrgentCutoff returns a date exactly 7 days after "now"', () => {
        const now = new Date('2026-07-02T00:00:00Z');
        expect(getUrgentCutoff(now).getTime() - now.getTime()).toBe(URGENT_WINDOW_MS);
        expect(getUrgentCutoff(now).toISOString()).toBe('2026-07-09T00:00:00.000Z');
    });
});

describe('Statistics Logic - countries', () => {
    test('counts only truthy country values, deduping is left to the DB distinct() query', () => {
        expect(computeStatisticsSummary([], 0, 0, ['Japan', 'Singapore', null, '']).countries).toBe(2);
    });
});
