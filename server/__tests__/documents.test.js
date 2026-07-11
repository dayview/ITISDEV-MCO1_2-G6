const {
    normalizeDocumentType,
    defaultFilePath,
    hasDocumentType,
    CHECKLIST_TYPES,
    mapDocument,
    buildDocumentChecklist,
    canDeleteDocument
} = require('../lib/documents');

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

describe('Document Logic - mapDocument', () => {
    test('maps every field the documents page displays', () => {
        const document = {
            _id: 'd1', userId: 'u1', type: 'transcript', fileName: 'grades.pdf', fileFormat: 'application/pdf',
            status: 'pending', uploadedAt: new Date('2026-06-10'), reviewedAt: null
        };
        expect(mapDocument(document)).toEqual({
            id: 'd1', type: 'transcript', fileName: 'grades.pdf', fileFormat: 'application/pdf',
            status: 'pending', uploadedAt: new Date('2026-06-10'), reviewedAt: null, fileUrl: null
        });
    });

    test('defaults status to pending when unset', () => {
        expect(mapDocument({ _id: 'd2', type: 'passport', createdAt: new Date('2026-06-01') }).status).toBe('pending');
    });

    test('fileUrl is always null — no route serves real file bytes yet', () => {
        expect(mapDocument({ _id: 'd3', type: 'other', filePath: 'uploads/u1/x.pdf' }).fileUrl).toBeNull();
    });

    test('accepts a Mongoose-document-like object via toObject()', () => {
        const toObject = () => ({ _id: 'd4', type: 'validId' });
        expect(mapDocument({ toObject })).toMatchObject({ id: 'd4', type: 'validId' });
    });
});

describe('Document Logic - buildDocumentChecklist', () => {
    test('covers exactly the real Document type enum, minus the "other" catch-all', () => {
        const types = CHECKLIST_TYPES.map(item => item.type).sort();
        expect(types).toEqual(['EAF', 'curriculumAudit', 'passport', 'recommendation', 'transcript', 'validId'].sort());
    });

    test('marks a type "missing" when no document of that type was uploaded', () => {
        const checklist = buildDocumentChecklist([]);
        expect(checklist.items.every(item => item.status === 'missing')).toBe(true);
        expect(checklist.submittedCount).toBe(0);
        expect(checklist.totalCount).toBe(CHECKLIST_TYPES.length);
        expect(checklist.percentage).toBe(0);
    });

    test('reflects the real status of an uploaded document', () => {
        const documents = [{ type: 'transcript', status: 'verified', uploadedAt: new Date('2026-06-01') }];
        const checklist = buildDocumentChecklist(documents);
        const transcriptItem = checklist.items.find(item => item.type === 'transcript');
        expect(transcriptItem.status).toBe('verified');
        expect(checklist.submittedCount).toBe(1);
    });

    test('percentage is computed from real submitted count over total checklist types', () => {
        const documents = [
            { type: 'transcript', status: 'pending', uploadedAt: new Date('2026-06-01') },
            { type: 'passport', status: 'pending', uploadedAt: new Date('2026-06-01') }
        ];
        const checklist = buildDocumentChecklist(documents);
        expect(checklist.submittedCount).toBe(2);
        expect(checklist.percentage).toBe(Math.round((2 / CHECKLIST_TYPES.length) * 100));
    });

    test('uses the most recently uploaded document when a type has multiple uploads', () => {
        const documents = [
            { type: 'transcript', status: 'rejected', uploadedAt: new Date('2026-05-01') },
            { type: 'transcript', status: 'pending', uploadedAt: new Date('2026-06-15') }
        ];
        const checklist = buildDocumentChecklist(documents);
        const transcriptItem = checklist.items.find(item => item.type === 'transcript');
        expect(transcriptItem.status).toBe('pending');
    });

    test('ignores document types outside the checklist (e.g. "other") for count purposes', () => {
        const documents = [{ type: 'other', status: 'pending', uploadedAt: new Date('2026-06-01') }];
        const checklist = buildDocumentChecklist(documents);
        expect(checklist.submittedCount).toBe(0);
    });
});

describe('Document Logic - canDeleteDocument (ownership check)', () => {
    test('allows deletion when the document belongs to the requesting user', () => {
        expect(canDeleteDocument({ userId: 'u1' }, 'u1')).toBe(true);
    });

    test('rejects deletion when the document belongs to a different user', () => {
        expect(canDeleteDocument({ userId: 'u1' }, 'u2')).toBe(false);
    });

    test('handles ObjectId-vs-string comparison safely', () => {
        expect(canDeleteDocument({ userId: { toString: () => 'u1' } }, 'u1')).toBe(true);
    });

    test('rejects when the document or requesting user is missing', () => {
        expect(canDeleteDocument(null, 'u1')).toBe(false);
        expect(canDeleteDocument({ userId: 'u1' }, undefined)).toBe(false);
    });
});
