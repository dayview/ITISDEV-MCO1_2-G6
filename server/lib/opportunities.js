const oneLineArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split('\n').map(item => item.trim()).filter(Boolean);
};

const mapOpportunity = (opportunity) => {
    const plain = typeof opportunity.toObject === 'function' ? opportunity.toObject() : opportunity;
    return {
        id: String(plain._id),
        code: plain.code,
        programName: plain.name,
        title: plain.name,
        hostInstitution: plain.institution,
        institution: plain.institution,
        country: plain.country,
        location: plain.country || plain.region || '',
        region: plain.region,
        category: plain.category,
        status: plain.status,
        deadline: plain.deadline,
        capacity: plain.capacity,
        description: plain.description,
        shortDescription: plain.description,
        benefits: oneLineArray(plain.benefits),
        fees: plain.fees,
        credits: plain.credits,
        requiredDocuments: plain.requiredDocumentTypes || [],
        eligibility: plain.eligibility,
        eligibilityCriteria: oneLineArray(plain.eligibility?.notes),
        eligible: true,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt
    };
};

const normalizeOpportunityInput = (body) => {
    const name = body.name || body.programName;
    const institution = body.institution || body.hostInstitution;
    const country = body.country || body.location?.split(',').pop()?.trim();
    const requiredDocumentTypes = body.requiredDocumentTypes || body.requiredDocuments || [];
    const benefits = Array.isArray(body.benefits) ? body.benefits.join('\n') : body.benefits;
    const codeBase = String(name || 'OPP')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24);

    return {
        code: body.code || `GEMS-${codeBase || 'OPP'}-${Date.now()}`,
        name,
        description: body.description,
        institution,
        country,
        region: body.region,
        category: body.category || body.type,
        status: body.status || 'draft',
        deadline: body.deadline,
        capacity: body.capacity,
        benefits,
        fees: body.fees,
        credits: body.credits,
        requiredDocumentTypes,
        eligibility: body.eligibility || {
            nonGraduatingRequired: false,
            sdfoClearanceRequired: false,
            notes: oneLineArray(body.eligibilityCriteria).join('\n')
        }
    };
};

const mapAdminOpportunity = (opportunity, applicationCount = 0) => {
    const plain = typeof opportunity.toObject === 'function' ? opportunity.toObject() : opportunity;
    const status = plain.status === 'published' ? 'Published' : plain.status === 'closed' ? 'Closed' : 'Draft';
    const deadline = plain.deadline ? new Date(plain.deadline) : null;
    const now = new Date();
    const periodState = !deadline || deadline < now
        ? 'Closed'
        : deadline.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000
            ? 'Open'
            : 'Upcoming';

    return {
        id: String(plain._id),
        name: plain.name,
        programName: plain.name,
        type: plain.category,
        category: plain.category,
        university: plain.institution,
        hostInstitution: plain.institution,
        country: plain.country,
        region: plain.region,
        period: deadline ? deadline.toISOString().slice(0, 10) : '',
        deadline: deadline ? deadline.toISOString().slice(0, 10) : '',
        periodState,
        applications: applicationCount,
        status,
        rawStatus: plain.status,
        updated: plain.updatedAt || plain.createdAt,
        description: plain.description,
        benefits: oneLineArray(plain.benefits),
        requiredDocuments: plain.requiredDocumentTypes || [],
        eligibilityCriteria: oneLineArray(plain.eligibility?.notes)
    };
};

module.exports = { oneLineArray, mapOpportunity, normalizeOpportunityInput, mapAdminOpportunity };
