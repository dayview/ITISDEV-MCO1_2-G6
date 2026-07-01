const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: true
    },
    status: {
        type: String,
        enum: ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'],
        default: 'submitted',
    },
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
    }],
    documentsStatus: {
        type: String,
        enum: ['incomplete', 'complete'],
        default: 'incomplete'
    },
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
}, { timestamps: true });

// Prevents duplicate applications per student per opportunity
applicationSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });
applicationSchema.index({ opportunityId: 1, status: 1 });

/**
 * Transition status and append an entry to statusHistory so the full audit
 * trail is visible without querying AuditLog separately.
 */
applicationSchema.methods.setStatus = async function (newStatus, changedByUserId) {
    this.statusHistory.push({ status: newStatus, changedBy: changedByUserId, changedAt: new Date() });
    this.status = newStatus;
    return this.save();
};

/**
 * Recalculate documentsStatus by comparing uploaded doc types against the
 * opportunity's requiredDocumentTypes. Call after any document add/remove.
 */
applicationSchema.methods.recalculateDocumentsStatus = async function () {
    const Document = mongoose.model('Document');
    const Opportunity = mongoose.model('Opportunity');

    const [uploadedDocs, opportunity] = await Promise.all([
        Document.find({ _id: { $in: this.documents } }).select('type'),
        Opportunity.findById(this.opportunityId).select('requiredDocumentTypes')
    ]);

    const uploadedTypes = new Set(uploadedDocs.map(d => d.type));
    const required = opportunity?.requiredDocumentTypes ?? [];
    const allPresent = required.length > 0 && required.every(t => uploadedTypes.has(t));

    this.documentsStatus = allPresent ? 'complete' : 'incomplete';
    return this.save();
};

/* Create a new application. Can also check dupes coz of unique index */
applicationSchema.statics.createApplication = async function ({ studentId, opportunityId }) {
    const application = new this({
        studentId,
        opportunityId,
        statusHistory: [{ status: 'submitted', changedAt: new Date() }]
    });
    return application.save();
};

/* Get all applications submitted by a specific student, populated with opportunity details */
applicationSchema.statics.findByStudent = async function (studentId) {
    return this.find({ studentId })
        .populate('opportunityId', 'name institution country category deadline status')
        .populate('documents', 'type fileName uploadedAt')
        .sort({ createdAt: -1 });
};

/* Get all applications for a specific opportunity, populated with student details.  Used by the admin dashboard queue. Supports the sort and filter
 the frontend sends (sort, status, college, search). */
applicationSchema.statics.findByOpportunity = async function (opportunityId, { status, sort = 'recency' } = {}) {
    const query = { opportunityId };
    if (status) query.status = status;

    const sortMap = {
        recency: { createdAt: -1 },
        urgency: { 'opportunityId.deadline': 1 },  // requires populate; handled below
        status: { status: 1 },
        cgpa: { 'studentId.cgpa': -1 }
    };

    return this.find(query)
        .populate('studentId', 'name studentId college cgpa')
        .populate('opportunityId', 'name institution deadline')
        .populate('documents', 'type fileName')
        .sort(sortMap[sort] || { createdAt: -1 });
};

/**
 * Paginated list of all applications across all opportunities for admin dashboard with filtering by status, college, and
   free-text search on student name/ID, plus sorting options. */
applicationSchema.statics.listAll = async function ({
    status = '',
    college = '',
    search = '',
    sort = 'recency',
    page = 1,
    pageSize = 50
} = {}) {
    // Text-search and college filtering happen via $lookup aggregation so we
    // can filter on populated student fields without two-step in-memory filtering.
    const pipeline = [
        {
            $lookup: {
                from: 'users',
                localField: 'studentId',
                foreignField: '_id',
                as: 'student'
            }
        },
        { $unwind: '$student' },
        {
            $lookup: {
                from: 'opportunities',
                localField: 'opportunityId',
                foreignField: '_id',
                as: 'opportunity'
            }
        },
        { $unwind: '$opportunity' }
    ];

    const matchStage = {};
    if (status) matchStage.status = status;
    if (college) matchStage['student.college'] = new RegExp(`^${college}$`, 'i');
    if (search) {
        const pattern = new RegExp(search, 'i');
        matchStage.$or = [
            { 'student.name': pattern },
            { 'student.studentId': pattern },
            { 'opportunity.name': pattern },
            { 'opportunity.institution': pattern }
        ];
    }
    if (Object.keys(matchStage).length) pipeline.push({ $match: matchStage });

    const sortMap = {
        recency: { createdAt: -1 },
        urgency: { 'opportunity.deadline': 1 },
        status: { status: 1 },
        college: { 'student.college': 1 },
        cgpa: { 'student.cgpa': -1 },
        documents: { documentsStatus: -1 }
    };
    pipeline.push({ $sort: sortMap[sort] || { createdAt: -1 } });

    const countPipeline = [...pipeline, { $count: 'total' }];
    const skip = (page - 1) * pageSize;
    pipeline.push({ $skip: skip }, { $limit: pageSize });

    const [results, countResult] = await Promise.all([
        this.aggregate(pipeline),
        this.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;
    return {
        data: results,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
};

/**
 * Update the status of a single application and append to its history.
 * changedByUserId is the admin's ObjectId, written into statusHistory.
 */
applicationSchema.statics.updateStatus = async function (applicationId, newStatus, changedByUserId) {
    return this.findByIdAndUpdate(
        applicationId,
        {
            $set: { status: newStatus },
            $push: { statusHistory: { status: newStatus, changedBy: changedByUserId, changedAt: new Date() } }
        },
        { new: true, runValidators: true }
    );
};

/**
 * Bulk-update status for multiple applications at once.
 * Used by the admin "batch approve" action (ids is an array of ObjectId strings).
 */
applicationSchema.statics.bulkUpdateStatus = async function (ids, newStatus, changedByUserId) {
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    const historyEntry = { status: newStatus, changedBy: changedByUserId, changedAt: new Date() };

    await this.updateMany(
        { _id: { $in: objectIds } },
        {
            $set: { status: newStatus },
            $push: { statusHistory: historyEntry }
        }
    );

    return this.find({ _id: { $in: objectIds } });
};

/* Attach a document to an application and recompute documentsStatus. Prevents duplicate document references. */
applicationSchema.statics.addDocument = async function (applicationId, documentId) {
    const application = await this.findByIdAndUpdate(
        applicationId,
        { $addToSet: { documents: documentId } },
        { new: true }
    );
    if (!application) throw new Error('Application not found');
    await application.recalculateDocumentsStatus();
    return application;
};

/* Remove a document reference from an application and recompute documentsStatus */
applicationSchema.statics.removeDocument = async function (applicationId, documentId) {
    const application = await this.findByIdAndUpdate(
        applicationId,
        { $pull: { documents: documentId } },
        { new: true }
    );
    if (!application) throw new Error('Application not found');
    await application.recalculateDocumentsStatus();
    return application;
};

/* Aggregate counts of applications grouped by status.
 * Returns { submitted, under-review, nominated, accepted, rejected } plus
 * urgent = submitted applications whose opportunity deadline is within 7 days.
 * Powers the admin dashboard stat cards.
 */
applicationSchema.statics.getStatusCounts = async function () {
    const now = new Date();
    const urgentCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [statusAgg, urgentAgg] = await Promise.all([
        this.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        this.aggregate([
            { $match: { status: 'submitted' } },
            {
                $lookup: {
                    from: 'opportunities',
                    localField: 'opportunityId',
                    foreignField: '_id',
                    as: 'opp'
                }
            },
            { $unwind: '$opp' },
            { $match: { 'opp.deadline': { $gte: now, $lte: urgentCutoff } } },
            { $count: 'urgent' }
        ])
    ]);

    const counts = { submitted: 0, 'under-review': 0, nominated: 0, accepted: 0, rejected: 0 };
    statusAgg.forEach(({ _id, count }) => { if (_id in counts) counts[_id] = count; });

    return { ...counts, urgent: urgentAgg[0]?.urgent ?? 0 };
};

/* Export applications as plain objects suitable for CSV serialisation. Accepts the same filter params as listAll so the export matches what is currently visible in the admin table.*/
applicationSchema.statics.exportData = async function ({ status, college, search } = {}) {
    const { data } = await this.listAll({ status, college, search, pageSize: 10000 });
    return data.map(row => ({
        id: row._id,
        name: row.student?.name ?? '',
        student_id: row.student?.studentId ?? '',
        college: row.student?.college ?? '',
        cgpa: row.student?.cgpa ?? '',
        opp_name: row.opportunity?.name ?? '',
        institution: row.opportunity?.institution ?? '',
        submitted_date: row.createdAt,
        documents_status: row.documentsStatus,
        status: row.status
    }));
};

module.exports = mongoose.model('Application', applicationSchema);
