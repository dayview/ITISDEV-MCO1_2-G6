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

module.exports = { normalizeDocumentType, defaultFilePath, hasDocumentType };
