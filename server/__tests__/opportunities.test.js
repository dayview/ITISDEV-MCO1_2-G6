const { oneLineArray, mapOpportunity, normalizeOpportunityInput, mapAdminOpportunity } = require('../lib/opportunities');

describe('Opportunity Management - oneLineArray helper', () => {
    test('splits newline-separated text into a trimmed array', () => {
        expect(oneLineArray('Benefit A\n Benefit B \nBenefit C')).toEqual(['Benefit A', 'Benefit B', 'Benefit C']);
    });

    test('passes through an existing array, filtering falsy entries', () => {
        expect(oneLineArray(['A', '', 'B', null])).toEqual(['A', 'B']);
    });

    test('returns an empty array for null/undefined input', () => {
        expect(oneLineArray(undefined)).toEqual([]);
        expect(oneLineArray(null)).toEqual([]);
    });
});

describe('Opportunity Management - mapOpportunity (student-facing view)', () => {
    test('maps a plain opportunity object into the student-facing shape', () => {
        const opportunity = {
            _id: 'id1', code: 'GEMS-001', name: 'NUS Exchange', institution: 'NUS',
            country: 'Singapore', region: 'Asia', category: 'Exchange', status: 'published',
            deadline: new Date('2026-12-31'), capacity: 5, description: 'desc', benefits: 'A\nB',
            requiredDocumentTypes: ['transcript'], eligibility: { minCgpa: 3.0 }
        };
        const mapped = mapOpportunity(opportunity);
        expect(mapped.id).toBe('id1');
        expect(mapped.programName).toBe('NUS Exchange');
        expect(mapped.location).toBe('Singapore');
        expect(mapped.benefits).toEqual(['A', 'B']);
        expect(mapped.eligible).toBe(true);
    });

    test('falls back to region for location when country is absent', () => {
        const mapped = mapOpportunity({ _id: 'id2', region: 'Europe', name: 'X', institution: 'Y', category: 'Z', deadline: new Date() });
        expect(mapped.location).toBe('Europe');
    });

    test('calls toObject() when given a mongoose-like document', () => {
        const toObject = jest.fn().mockReturnValue({ _id: 'id3', name: 'X', institution: 'Y', category: 'Z', deadline: new Date() });
        mapOpportunity({ toObject });
        expect(toObject).toHaveBeenCalledTimes(1);
    });
});

describe('Opportunity Management - normalizeOpportunityInput', () => {
    test('accepts both canonical and admin-form field names', () => {
        const result = normalizeOpportunityInput({ programName: 'Test Program', hostInstitution: 'MIT', category: 'Research' });
        expect(result.name).toBe('Test Program');
        expect(result.institution).toBe('MIT');
    });

    test('derives country from a "City, Country" location string when country is absent', () => {
        const result = normalizeOpportunityInput({ name: 'X', institution: 'Y', category: 'Z', location: 'Tokyo, Japan' });
        expect(result.country).toBe('Japan');
    });

    test('defaults status to draft when not provided', () => {
        const result = normalizeOpportunityInput({ name: 'X', institution: 'Y', category: 'Z' });
        expect(result.status).toBe('draft');
    });

    test('preserves an explicitly provided published status', () => {
        const result = normalizeOpportunityInput({ name: 'X', institution: 'Y', category: 'Z', status: 'published' });
        expect(result.status).toBe('published');
    });

    test('joins an array of benefits into newline-separated text', () => {
        const result = normalizeOpportunityInput({ name: 'X', institution: 'Y', category: 'Z', benefits: ['A', 'B'] });
        expect(result.benefits).toBe('A\nB');
    });

    test('generates a code from the name when no code is provided', () => {
        const result = normalizeOpportunityInput({ name: 'NUS Summer Program!!', institution: 'Y', category: 'Z' });
        expect(result.code).toMatch(/^GEMS-NUS-SUMMER-PROGRAM-\d+$/);
    });

    test('preserves an explicitly provided code', () => {
        const result = normalizeOpportunityInput({ code: 'GEMS-CUSTOM', name: 'X', institution: 'Y', category: 'Z' });
        expect(result.code).toBe('GEMS-CUSTOM');
    });
});

describe('Opportunity Management - mapAdminOpportunity (admin-facing view)', () => {
    test('labels status Draft/Published/Closed for the admin UI', () => {
        const base = { _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: new Date(Date.now() + 100000000) };
        expect(mapAdminOpportunity({ ...base, status: 'draft' }).status).toBe('Draft');
        expect(mapAdminOpportunity({ ...base, status: 'published' }).status).toBe('Published');
        expect(mapAdminOpportunity({ ...base, status: 'closed' }).status).toBe('Closed');
    });

    test('marks periodState Closed when the deadline has passed', () => {
        const mapped = mapAdminOpportunity({ _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: new Date('2020-01-01'), status: 'published' });
        expect(mapped.periodState).toBe('Closed');
    });

    test('marks periodState Closed when the program is closed even if its deadline is in the future', () => {
        const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        const mapped = mapAdminOpportunity({ _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: future, status: 'closed' });
        expect(mapped.periodState).toBe('Closed');
    });

    test('marks periodState Open within 30 days of the deadline', () => {
        const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        const mapped = mapAdminOpportunity({ _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: soon, status: 'published' });
        expect(mapped.periodState).toBe('Open');
    });

    test('marks periodState Upcoming when the deadline is more than 30 days away', () => {
        const later = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        const mapped = mapAdminOpportunity({ _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: later, status: 'published' });
        expect(mapped.periodState).toBe('Upcoming');
    });

    test('includes the application count passed in', () => {
        const mapped = mapAdminOpportunity({ _id: 'id1', name: 'X', institution: 'Y', category: 'Z', deadline: new Date() }, 7);
        expect(mapped.applications).toBe(7);
    });
});
