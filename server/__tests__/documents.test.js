const { normalizeDocumentType, defaultFilePath, hasDocumentType } = require('../lib/documents');

describe('Document Logic - document type normalization', () => {
    test.each([
        ['Official Transcript of Records', 'transcript'],
        ['Grade Report', 'transcript'],
        ['Letter of Recommendation', 'recommendation'],
        ['Academic Reference', 'recommendation'],
        ['Passport Copy', 'passport'],
        ['EAF Form', 'EAF'],
        ['Exchange Application Form', 'EAF'],
        ['Curriculum Audit', 'curriculumAudit'],
        ['Valid School ID', 'validId'],
        ['Certificate of Enrollment', 'other'],
    ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeDocumentType(input)).toBe(expected);
    });

    test('is case-insensitive', () => {
        expect(normalizeDocumentType('TRANSCRIPT OF RECORDS')).toBe('transcript');
    });

    test('handles missing/undefined input by classifying it as other', () => {
        expect(normalizeDocumentType(undefined)).toBe('other');
        expect(normalizeDocumentType('')).toBe('other');
    });
});

describe('Document Logic - file reference generation', () => {
    test('builds a default upload path scoped to the user', () => {
        expect(defaultFilePath('user123', 'transcript.pdf')).toBe('uploads/user123/transcript.pdf');
    });
});

describe('Document Logic - required document lookup', () => {
    test('finds a matching document by normalized type', () => {
        const documents = [{ type: 'transcript' }, { type: 'passport' }];
        expect(hasDocumentType(documents, 'Official Transcript')).toBe(true);
    });

    test('returns false when the required document type is missing', () => {
        const documents = [{ type: 'passport' }];
        expect(hasDocumentType(documents, 'Transcript')).toBe(false);
    });

    test('returns false for an empty document list', () => {
        expect(hasDocumentType([], 'Transcript')).toBe(false);
    });
});
