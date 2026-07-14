const { normalizeDocumentType } = require('./documents');

const evaluateStudentEligibility = (student, opportunity, documents = []) => {
    const missing = [];
    const eligibility = opportunity.eligibility || {};
    if (eligibility.minCgpa && Number(student.cgpa || 0) < eligibility.minCgpa) {
        missing.push(`Minimum CGPA of ${eligibility.minCgpa}`);
    }
    if (eligibility.nonGraduatingRequired === true && student.isGraduating) {
        missing.push('Applicant must not be graduating this term');
    }
    if (eligibility.sdfoClearanceRequired === true && !student.sdfoCleared) {
        missing.push('SDFO clearance');
    }

    const documentTypes = new Set(documents.map(document => document.type));
    (opportunity.requiredDocumentTypes || []).forEach(requirement => {
        const type = normalizeDocumentType(requirement);
        if (!documentTypes.has(type)) missing.push(requirement);
    });

    return { eligible: missing.length === 0, missing };
};

const isOpportunityOpenForApplication = (opportunity, now = new Date()) => {
    if (!opportunity) return false;
    if (opportunity.status !== 'published') return false;
    return new Date(opportunity.deadline) >= now;
};

module.exports = { evaluateStudentEligibility, isOpportunityOpenForApplication };
