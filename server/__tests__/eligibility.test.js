const { evaluateStudentEligibility, isOpportunityOpenForApplication } = require('../lib/eligibility');

describe('Eligibility Logic - minimum CGPA validation', () => {
    test('blocks a student below the minimum CGPA', () => {
        const result = evaluateStudentEligibility({ cgpa: 2.8 }, { eligibility: { minCgpa: 3.0 } });
        expect(result.eligible).toBe(false);
        expect(result.missing).toContain('Minimum CGPA of 3');
    });

    test('allows a student who meets the minimum CGPA', () => {
        const result = evaluateStudentEligibility({ cgpa: 3.5 }, { eligibility: { minCgpa: 3.0 } });
        expect(result.eligible).toBe(true);
    });

    test('treats a missing CGPA as 0 when a minimum is required', () => {
        const result = evaluateStudentEligibility({}, { eligibility: { minCgpa: 1.0 } });
        expect(result.eligible).toBe(false);
    });

    test('skips the CGPA check when the opportunity has no minimum', () => {
        const result = evaluateStudentEligibility({ cgpa: 0 }, { eligibility: {} });
        expect(result.eligible).toBe(true);
    });
});

describe('Eligibility Logic - graduating/SDFO clearance checks', () => {
    test('blocks a graduating student when non-graduating is required', () => {
        const result = evaluateStudentEligibility(
            { isGraduating: true },
            { eligibility: { nonGraduatingRequired: true } }
        );
        expect(result.missing).toContain('Applicant must not be graduating this term');
    });

    test('blocks a student without SDFO clearance when required', () => {
        const result = evaluateStudentEligibility(
            { sdfoCleared: false },
            { eligibility: { sdfoClearanceRequired: true } }
        );
        expect(result.missing).toContain('SDFO clearance');
    });
});

describe('Eligibility Logic - required document validation', () => {
    test('flags each missing required document', () => {
        const result = evaluateStudentEligibility(
            {},
            { eligibility: {}, requiredDocumentTypes: ['Transcript', 'Passport'] },
            []
        );
        expect(result.eligible).toBe(false);
        expect(result.missing).toEqual(['Transcript', 'Passport']);
    });

    test('passes when all required documents (by normalized type) are present', () => {
        const result = evaluateStudentEligibility(
            {},
            { eligibility: {}, requiredDocumentTypes: ['Transcript'] },
            [{ type: 'transcript' }]
        );
        expect(result.eligible).toBe(true);
    });

    test('is eligible when no documents are required', () => {
        const result = evaluateStudentEligibility({}, { eligibility: {} }, []);
        expect(result.eligible).toBe(true);
        expect(result.missing).toEqual([]);
    });
});

describe('Eligibility Logic - published opportunity validation', () => {
    test('rejects a draft opportunity', () => {
        expect(isOpportunityOpenForApplication({ status: 'draft', deadline: new Date(Date.now() + 100000) })).toBe(false);
    });

    test('rejects a closed opportunity', () => {
        expect(isOpportunityOpenForApplication({ status: 'closed', deadline: new Date(Date.now() + 100000) })).toBe(false);
    });

    test('accepts a published, non-expired opportunity', () => {
        expect(isOpportunityOpenForApplication({ status: 'published', deadline: new Date(Date.now() + 100000) })).toBe(true);
    });

    test('rejects a null/undefined opportunity (e.g. not found)', () => {
        expect(isOpportunityOpenForApplication(null)).toBe(false);
        expect(isOpportunityOpenForApplication(undefined)).toBe(false);
    });
});

describe('Eligibility Logic - expired opportunity validation', () => {
    test('rejects a published opportunity whose deadline has already passed', () => {
        const now = new Date('2026-07-02T00:00:00Z');
        const opportunity = { status: 'published', deadline: new Date('2026-06-01T00:00:00Z') };
        expect(isOpportunityOpenForApplication(opportunity, now)).toBe(false);
    });

    test('accepts a published opportunity whose deadline is exactly now', () => {
        const now = new Date('2026-07-02T00:00:00Z');
        const opportunity = { status: 'published', deadline: new Date('2026-07-02T00:00:00Z') };
        expect(isOpportunityOpenForApplication(opportunity, now)).toBe(true);
    });
});
