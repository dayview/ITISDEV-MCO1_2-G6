const normalizeDocumentType = (value) => {
    const text = String(value || '').toLowerCase();
    if (text.includes('transcript') || text.includes('grade')) return 'transcript';
    if (text.includes('recommendation') || text.includes('reference')) return 'recommendation';
    if (text.includes('passport')) return 'passport';
    if (text.includes('eaf') || text.includes('application form')) return 'EAF';
    if (text.includes('curriculum')) return 'curriculumAudit';
    if (text.includes('id')) return 'validId';
    return 'other';
};

const defaultFilePath = (userId, fileName) => `uploads/${userId}/${fileName}`;

const hasDocumentType = (documents, requirement) => {
    const type = normalizeDocumentType(requirement);
    return documents.some(document => document.type === type);
};

// The document types a student is generally expected to keep on file. 'other' is a
// catch-all bucket, not a specific requirement, so it's intentionally excluded here.
const CHECKLIST_TYPES = [
    { type: 'transcript', label: 'Academic Transcript' },
    { type: 'curriculumAudit', label: 'Curriculum Audit Form' },
    { type: 'passport', label: 'Passport Bio-Page' },
    { type: 'EAF', label: 'Exchange Application Form (EAF)' },
    { type: 'recommendation', label: 'Recommendation Letter' },
    { type: 'validId', label: 'Valid ID' }
];

const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected'];

// fileUrl points at the protected GET /api/documents/:id/file route — never the raw
// filesystem path, which is not exposed to the client at all.
const mapDocument = (document) => {
    const plain = typeof document.toObject === 'function' ? document.toObject() : document;
    return {
        id: String(plain._id),
        type: plain.type,
        originalFileName: plain.originalFileName || '',
        mimeType: plain.mimeType || '',
        size: plain.size || 0,
        status: plain.status || 'pending',
        uploadedAt: plain.uploadedAt || plain.createdAt,
        reviewedAt: plain.reviewedAt || null,
        fileUrl: `/api/documents/${String(plain._id)}/file`
    };
};

// Expects already-mapped documents (see mapDocument). For each checklist type, uses the
// most recently uploaded document of that type, if any.
const buildDocumentChecklist = (documents = []) => {
    const latestByType = new Map();
    documents.forEach(document => {
        const existing = latestByType.get(document.type);
        if (!existing || new Date(document.uploadedAt) > new Date(existing.uploadedAt)) {
            latestByType.set(document.type, document);
        }
    });

    const items = CHECKLIST_TYPES.map(({ type, label }) => {
        const match = latestByType.get(type);
        return {
            type,
            label,
            status: match ? match.status : 'missing',
            document: match || null
        };
    });

    const totalCount = items.length;
    const submittedCount = items.filter(item => item.status !== 'missing').length;

    return {
        items,
        submittedCount,
        totalCount,
        percentage: totalCount ? Math.round((submittedCount / totalCount) * 100) : 0
    };
};

const canDeleteDocument = (document, requestingUserId) => {
    if (!document || !requestingUserId) return false;
    return String(document.userId) === String(requestingUserId);
};

module.exports = {
    normalizeDocumentType,
    defaultFilePath,
    hasDocumentType,
    CHECKLIST_TYPES,
    DOCUMENT_STATUSES,
    mapDocument,
    buildDocumentChecklist,
    canDeleteDocument
};
