const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    institution: {
        type: String,
        required: true
    },
    country: String,
    region: String,
    category: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'closed'],
        default: 'draft'
    },
    deadline: {
        type: Date,
        required: true
    },
    capacity: Number,
    benefits: String,
    fees: String,
    credits: Number,
    requiredDocumentTypes: [{ type: String }],
    eligibility: {
        minCgpa: { type: Number },
        nonGraduatingRequired: {
            type: Boolean,
            default: true
        },
        sdfoClearanceRequired: {
            type: Boolean,
            default: true
        },
        notes: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

opportunitySchema.index({ status: 1, deadline: 1 });
opportunitySchema.index({ category: 1, status: 1 });

// ─── Static Methods ──────────────────────────────────────────────────────────

/** Create a new opportunity.*/
opportunitySchema.statics.createOpportunity = async function (fields) {
    const opportunity = new this(fields);
    return opportunity.save();
};

/* Retrieve a single opportunity by its MongoDB id, with creator populated.*/
opportunitySchema.statics.findOpportunityById = async function (opportunityId) {
    return this.findById(opportunityId).populate('createdBy', 'name email');
};

/** Return all published opportunities whose deadline has not yet passed. */
opportunitySchema.statics.findPublished = async function () {
    return this.find({
        status: 'published',
        deadline: { $gte: new Date() }
    }).sort({ deadline: 1 });
};

/** Paginated and filtered search used by the student catalog. */
opportunitySchema.statics.search = async function ({
    search = '',
    category = '',
    region = '',
    deadlineFrom = null,
    deadlineTo = null,
    status = 'published',
    sortBy = 'deadlineAsc',
    page = 1,
    pageSize = 10
} = {}) {
    const query = { status };

    // Only show opportunities with a future (or same-day) deadline by default
    const deadlineFilter = {};
    if (deadlineFrom) deadlineFilter.$gte = new Date(deadlineFrom);
    else deadlineFilter.$gte = new Date();
    if (deadlineTo) deadlineFilter.$lte = new Date(deadlineTo);
    query.deadline = deadlineFilter;

    if (category && category !== 'all') query.category = new RegExp(`^${category}$`, 'i');
    if (region && region !== 'all') query.region = new RegExp(`^${region}$`, 'i');

    if (search) {
        const pattern = new RegExp(search, 'i');
        query.$or = [
            { name: pattern },
            { institution: pattern },
            { country: pattern },
            { description: pattern }
        ];
    }

    const sortMap = {
        deadlineAsc: { deadline: 1 },
        deadlineDesc: { deadline: -1 },
        programName: { name: 1 },
        recentlyAdded: { createdAt: -1 }
    };
    const sort = sortMap[sortBy] || { deadline: 1 };

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
        this.find(query).sort(sort).skip(skip).limit(pageSize),
        this.countDocuments(query)
    ]);

    return {
        data,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
    };
};

/** List all opportunities regardless of status. For admin management. */
opportunitySchema.statics.listAll = async function ({ status, page = 1, pageSize = 50 } = {}) {
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
        this.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        this.countDocuments(query)
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
};

/* Update opportunity fields by id. Returns the updated document. Admins may update any field including status */
opportunitySchema.statics.updateOpportunity = async function (opportunityId, updates) {
    return this.findByIdAndUpdate(
        opportunityId,
        { $set: updates },
        { new: true, runValidators: true }
    );
};

/* Publish a draft opportunity. Makes sure deadline exists before publishing. */
opportunitySchema.statics.publish = async function (opportunityId) {
    const opp = await this.findById(opportunityId);
    if (!opp) throw new Error('Opportunity not found');
    if (!opp.deadline) throw new Error('Cannot publish an opportunity without a deadline');

    opp.status = 'published';
    return opp.save();
};

/* Close an opportunity */
opportunitySchema.statics.close = async function (opportunityId) {
    return this.findByIdAndUpdate(
        opportunityId,
        { $set: { status: 'closed' } },
        { new: true }
    );
};

/* Hard-delete an opportunity. For deleting drafts. */
opportunitySchema.statics.deleteOpportunity = async function (opportunityId) {
    return this.findByIdAndDelete(opportunityId);
};

/* Count published opportunities and the number of distinct countries represented. For the admin dashboard stats. */
opportunitySchema.statics.getLiveStats = async function () {
    const [livePrograms, countryAgg] = await Promise.all([
        this.countDocuments({ status: 'published', deadline: { $gte: new Date() } }),
        this.distinct('country', { status: 'published' })
    ]);
    return { livePrograms, countries: countryAgg.filter(Boolean).length };
};

/* Find opportunities whose deadlines fall within the next x amount of days. For "closing soon" warnings in the admin dashboard. */
opportunitySchema.statics.findClosingSoon = async function (days = 7) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.find({
        status: 'published',
        deadline: { $gte: now, $lte: cutoff }
    }).sort({ deadline: 1 });
};

module.exports = mongoose.model('Opportunity', opportunitySchema);
