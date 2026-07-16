const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];

const isValidStatus = (status) => APPLICATION_STATUSES.includes(status);

const applicationPipeline = ({ status = '', college = '', search = '', sort = 'recency', documentsStatus = '', ids = [] } = {}) => {
    const pipeline = [
        { $addFields: { studentRef: { $ifNull: ['$userId', '$studentId'] } } },
        { $lookup: { from: 'users', localField: 'studentRef', foreignField: '_id', as: 'student' } },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opportunity' } },
        { $unwind: { path: '$opportunity', preserveNullAndEmptyArrays: true } }
    ];

    const match = {};
    const idList = Array.isArray(ids) ? ids : ids ? [ids] : [];
    if (idList.length) {
        const validIds = idList
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        match._id = validIds.length ? { $in: validIds } : { $in: [] };
    }
    if (status) match.status = status;
    if (documentsStatus) match.documentsStatus = documentsStatus;
    if (college) match['student.college'] = new RegExp(`^${college}$`, 'i');
    if (search) {
        const pattern = new RegExp(search, 'i');
        match.$or = [
            { 'student.name': pattern },
            { 'student.studentId': pattern },
            { 'opportunity.name': pattern },
            { 'opportunity.institution': pattern }
        ];
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    const sortMap = {
        recency: { createdAt: -1, submittedDate: -1 },
        oldest: { createdAt: 1, submittedDate: 1 },
        urgency: { 'opportunity.deadline': 1 },
        status: { status: 1 },
        college: { 'student.college': 1 },
        cgpa: { 'student.cgpa': -1 },
        documents: { documentsStatus: 1 }
    };
    pipeline.push({ $sort: sortMap[sort] || sortMap.recency });

    pipeline.push({
        $project: {
            id: { $toString: '$_id' },
            name: { $ifNull: ['$student.name', 'Unknown student'] },
            student_id: '$student.studentId',
            college: '$student.college',
            cgpa: '$student.cgpa',
            opp_name: { $ifNull: ['$opportunity.name', 'Unknown opportunity'] },
            institution: '$opportunity.institution',
            submitted_date: { $ifNull: ['$submittedDate', '$createdAt'] },
            documents_status: '$documentsStatus',
            status: 1
        }
    });

    return pipeline;
};

const buildApplicationPayload = ({ userId, opportunityId, documents = [], now = new Date() }) => ({
    userId,
    opportunityId,
    documents: documents.map(document => document._id),
    documentsStatus: getInitialDocumentsStatus(documents),
    submittedDate: now.toISOString().slice(0, 10),
    statusHistory: [{ status: 'submitted', changedAt: now, changedBy: userId }]
});

function getInitialDocumentsStatus(documents = []) {
    return documents.length > 0 && documents.every(document => document.status === 'verified')
        ? 'complete'
        : 'incomplete';
}

const appendStatusHistory = (history = [], status, changedBy, now = new Date()) => [
    ...history,
    { status, changedAt: now, changedBy }
];

const getReviewedAt = (statusHistory = []) => {
    const reviewEntry = [...statusHistory].reverse().find(entry => entry.status && entry.status !== 'submitted');
    return reviewEntry ? reviewEntry.changedAt : null;
};

const mapStudentApplication = (application) => {
    const opportunity = application.opportunityId && typeof application.opportunityId === 'object'
        ? application.opportunityId
        : null;

    return {
        id: String(application._id),
        opportunityId: String(opportunity?._id || application.opportunityId),
        programName: opportunity?.name || 'Unknown opportunity',
        hostInstitution: opportunity?.institution || '',
        location: opportunity?.country || opportunity?.region || '',
        status: application.status,
        documentsStatus: application.documentsStatus,
        submittedAt: application.submittedDate || application.createdAt,
        deadline: opportunity?.deadline || null,
        reviewedAt: getReviewedAt(application.statusHistory)
    };
};

const toApplicationsCsv = (data) => {
    const header = 'Student Name,Student Id,College,CGPA,Program,Institution,Status,Documents,Submitted Date';
    const rows = data.map(row => [
        `"${String(row.name || '').replaceAll('"', '""')}"`,
        row.student_id || '',
        row.college || '',
        row.cgpa ?? '',
        `"${String(row.opp_name || '').replaceAll('"', '""')}"`,
        `"${String(row.institution || '').replaceAll('"', '""')}"`,
        row.status || '',
        row.documents_status || '',
        row.submitted_date ? new Date(row.submitted_date).toISOString() : ''
    ].join(','));
    return [header, ...rows].join('\n');
};

module.exports = {
    APPLICATION_STATUSES,
    isValidStatus,
    applicationPipeline,
    buildApplicationPayload,
    getInitialDocumentsStatus,
    appendStatusHistory,
    toApplicationsCsv,
    getReviewedAt,
    mapStudentApplication
};
