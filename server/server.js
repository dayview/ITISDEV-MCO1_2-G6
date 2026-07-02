require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Opportunity = require('./models/Opportunity');
const Application = require('./models/Applications');
const User = require('./models/User');
const Document = require('./models/Document');

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, '..');
const studentViewsRoot = path.join(root, 'client', 'views', 'student');
const adminViewsRoot = path.join(root, 'gems', 'views', 'admin');

app.use(express.json());
app.use('/public', express.static(path.join(root, 'public')));

app.get('/', (_req, res) => {
    res.sendFile(path.join(studentViewsRoot, 'login.html'));
});

app.get('/student', (_req, res) => {
    res.redirect('/dashboard.html');
});

app.get('/admin', (_req, res) => {
    res.redirect('/admin/dashboard.html');
});

const studentPages = new Set([
    'applications.html',
    'catalog.html',
    'dashboard.html',
    'documents.html',
    'login.html',
    'opportunity.html',
    'profile.html',
    'register.html'
]);

app.get('/:page', (req, res, next) => {
    if (!studentPages.has(req.params.page)) return next();
    res.sendFile(path.join(studentViewsRoot, req.params.page));
});

const adminPages = new Set([
    'admin-profile.html',
    'applicants.html',
    'dashboard.html',
    'post-opportunity.html',
    'programs.html'
]);

app.get('/admin/:page', (req, res, next) => {
    if (!adminPages.has(req.params.page)) return next();
    res.sendFile(path.join(adminViewsRoot, req.params.page));
});

const oneLineArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split('\n').map(item => item.trim()).filter(Boolean);
};

const getDevStudent = async () => {
    let student = await User.findOne({ role: { $in: ['Student', 'student'] }, isActive: { $ne: false } }).sort({ createdAt: 1 });
    if (student) return student;

    student = await User.create({
        email: 'student@example.edu',
        passwordHashed: 'dev-only',
        role: 'Student',
        name: 'Demo Student',
        studentId: '00000000',
        college: 'CCS',
        major: 'Information Systems',
        cgpa: 3.25,
        graduatingTerm: 'AY 2026-2027',
        sdfoCleared: true
    });
    return student;
};

const getDevAdmin = async () => {
    let admin = await User.findOne({ role: { $in: ['OVPERI_Admin', 'System_Admin', 'admin'] } }).sort({ createdAt: 1 });
    if (admin) return admin;

    admin = await User.create({
        email: 'admin@example.edu',
        passwordHashed: 'dev-only',
        role: 'OVPERI_Admin',
        name: 'OVPERI Administrator',
        isActive: true
    });
    return admin;
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
        eligibilityCriteria: oneLineArray(plain.eligibility?.notes),
        applicationInstructions: 'Prepare all required documents and submit your application through the GEMS portal.',
        eligibility: plain.eligibility,
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

const applicationPipeline = ({ status = '', college = '', search = '', sort = 'recency' } = {}) => {
    const pipeline = [
        { $addFields: { studentRef: { $ifNull: ['$userId', '$studentId'] } } },
        { $lookup: { from: 'users', localField: 'studentRef', foreignField: '_id', as: 'student' } },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opportunity' } },
        { $unwind: { path: '$opportunity', preserveNullAndEmptyArrays: true } }
    ];

    const match = {};
    if (status) match.status = status;
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
            opportunityId: { $toString: '$opportunityId' },
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

app.get('/api/admin/opportunities', async (_req, res) => {
    try {
        const opportunities = await Opportunity.find({}).sort({ updatedAt: -1 });
        const counts = await Application.aggregate([
            { $group: { _id: '$opportunityId', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(item => [String(item._id), item.count]));
        const data = opportunities.map(opportunity => mapAdminOpportunity(
            opportunity,
            countMap.get(String(opportunity._id)) || 0
        ));

        res.json({
            success: true,
            data,
            meta: {
                total: data.length,
                published: data.filter(item => item.rawStatus === 'published').length,
                drafts: data.filter(item => item.rawStatus === 'draft').length,
                closed: data.filter(item => item.rawStatus === 'closed').length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/admin/summary', async (_req, res) => {
    try {
        const [admin, opportunities, applications, statsResponse] = await Promise.all([
            getDevAdmin(),
            Opportunity.find({}).sort({ updatedAt: -1 }).limit(5),
            Application.aggregate(applicationPipeline({ sort: 'urgency' })),
            Promise.resolve()
        ]);
        const now = new Date();
        const published = await Opportunity.countDocuments({ status: 'published', deadline: { $gte: now } });
        const drafts = await Opportunity.countDocuments({ status: 'draft' });
        const reviewed = applications.filter(app => ['nominated', 'accepted', 'rejected'].includes(app.status)).length;

        res.json({
            success: true,
            data: {
                admin: {
                    id: String(admin._id),
                    name: admin.name,
                    email: admin.email,
                    role: admin.role
                },
                programs: {
                    total: await Opportunity.countDocuments({}),
                    published,
                    drafts,
                    recent: opportunities.map(item => mapAdminOpportunity(item))
                },
                applicants: {
                    total: applications.length,
                    reviewed,
                    recent: applications.slice(0, 8)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/opportunities', async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
        const query = { status: 'published', deadline: { $gte: new Date() } };

        if (req.query.category && req.query.category !== 'all') query.category = new RegExp(`^${req.query.category}$`, 'i');
        if (req.query.region && req.query.region !== 'all') query.region = new RegExp(`^${req.query.region}$`, 'i');
        if (req.query.search) {
            const pattern = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: pattern },
                { institution: pattern },
                { country: pattern },
                { description: pattern }
            ];
        }

        const sort = req.query.sortBy === 'deadlineDesc' ? { deadline: -1 } : { deadline: 1 };
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
            Opportunity.find(query).sort(sort).skip(skip).limit(pageSize),
            Opportunity.countDocuments(query)
        ]);

        res.json({
            data: data.map(mapOpportunity),
            meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/opportunities', async (req, res) => {
    try {
        const opportunity = await Opportunity.create(normalizeOpportunityInput(req.body));
        res.status(201).json({
            success: true,
            data: mapOpportunity(opportunity),
            adminData: mapAdminOpportunity(opportunity)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/opportunities/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        const opportunity = await Opportunity.findById(req.params.id);
        if (!opportunity || opportunity.status !== 'published') {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        res.json(mapOpportunity(opportunity));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.patch('/api/opportunities/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid opportunity id.' });
        }
        const existing = await Opportunity.findById(req.params.id).select('code');
        const updates = normalizeOpportunityInput({ ...req.body, code: req.body.code || existing?.code });
        const opportunity = await Opportunity.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!opportunity) {
            return res.status(404).json({ success: false, error: 'Opportunity not found' });
        }
        res.json({
            success: true,
            data: mapOpportunity(opportunity),
            adminData: mapAdminOpportunity(opportunity)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/opportunities/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid opportunity id.' });
        }
        const [opportunity] = await Promise.all([
            Opportunity.findByIdAndDelete(req.params.id),
            Application.deleteMany({ opportunityId: req.params.id })
        ]);
        if (!opportunity) {
            return res.status(404).json({ success: false, error: 'Opportunity not found' });
        }
        res.json({ success: true, data: mapAdminOpportunity(opportunity) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/student/profile', async (_req, res) => {
    try {
        const student = await getDevStudent();
        res.json({
            success: true,
            data: {
                id: String(student._id),
                name: student.name,
                email: student.email,
                studentId: student.studentId,
                college: student.college,
                major: student.major,
                cgpa: student.cgpa,
                graduatingTerm: student.graduatingTerm,
                sdfoCleared: student.sdfoCleared,
                profileComplete: Boolean(student.name && student.email && student.studentId)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/student/documents', async (_req, res) => {
    try {
        const student = await getDevStudent();
        const documents = await Document.find({ userId: student._id }).sort({ uploadedAt: -1 });
        res.json({
            success: true,
            data: documents.map(document => ({
                id: String(document._id),
                type: document.type,
                fileName: document.fileName,
                fileFormat: document.fileFormat,
                uploadedAt: document.uploadedAt
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/student/applications', async (_req, res) => {
    try {
        const student = await getDevStudent();
        const data = await Application.aggregate([
            { $match: { $or: [{ userId: student._id }, { studentId: student._id }] } },
            ...applicationPipeline({ sort: 'recency' })
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/student/summary', async (_req, res) => {
    try {
        const student = await getDevStudent();
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const [applications, opportunities, documents] = await Promise.all([
            Application.aggregate([
                { $match: { $or: [{ userId: student._id }, { studentId: student._id }] } },
                ...applicationPipeline({ sort: 'recency' })
            ]),
            Opportunity.find({ status: 'published', deadline: { $gte: now } }).sort({ deadline: 1 }).limit(6),
            Document.find({ userId: student._id }).sort({ uploadedAt: -1 })
        ]);

        res.json({
            success: true,
            data: {
                student: {
                    id: String(student._id),
                    name: student.name,
                    email: student.email,
                    studentId: student.studentId,
                    college: student.college,
                    major: student.major,
                    cgpa: student.cgpa
                },
                stats: {
                    activeApplications: applications.filter(app => !['accepted', 'rejected'].includes(app.status)).length,
                    eligiblePrograms: await Opportunity.countDocuments({ status: 'published', deadline: { $gte: now } }),
                    pendingDocuments: 0,
                    deadlines30Days: await Opportunity.countDocuments({ status: 'published', deadline: { $gte: now, $lte: in30Days } })
                },
                recommended: opportunities.map(mapOpportunity),
                deadlines: opportunities.filter(item => item.deadline <= in30Days).map(mapOpportunity),
                applications,
                documents: documents.map(document => ({
                    id: String(document._id),
                    type: document.type,
                    fileName: document.fileName,
                    fileFormat: document.fileFormat,
                    uploadedAt: document.uploadedAt
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/applications', async (req, res) => {
    try {
        const data = await Application.aggregate(applicationPipeline(req.query));
        res.json({
            success: true,
            data,
            meta: { total: data.length, page: 1, pageSize: data.length, totalPages: 1 }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/applications', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.body.opportunityId)) {
            return res.status(400).json({ success: false, error: 'Invalid opportunity id.' });
        }
        const student = await getDevStudent();
        const opportunity = await Opportunity.findOne({
            _id: req.body.opportunityId,
            status: 'published',
            deadline: { $gte: new Date() }
        });
        if (!opportunity) {
            return res.status(404).json({ success: false, error: 'Opportunity not found or no longer open.' });
        }

        const existing = await Application.findOne({
            $or: [{ userId: student._id }, { studentId: student._id }],
            opportunityId: opportunity._id
        });
        if (existing) {
            return res.json({ success: true, duplicate: true, data: existing });
        }

        const application = await Application.create({
            userId: student._id,
            opportunityId: opportunity._id,
            status: 'submitted',
            submittedDate: new Date().toISOString().slice(0, 10),
            documentsStatus: req.body.documentsStatus || 'incomplete',
            statusHistory: [{ status: 'submitted', changedAt: new Date() }]
        });

        res.status(201).json({ success: true, duplicate: false, data: application });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.patch('/api/applications/:id/status', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid application id.' });
        }
        const allowed = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];
        if (!allowed.includes(req.body.status)) {
            return res.status(400).json({ success: false, error: `Status must be one of: ${allowed.join(', ')}` });
        }
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            {
                $set: { status: req.body.status },
                $push: { statusHistory: { status: req.body.status, changedAt: new Date() } }
            },
            { new: true, runValidators: true }
        );
        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        res.json({ success: true, data: application });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/applications/bulk-action', async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];
        const allowed = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];
        if (!ids.length) {
            return res.status(400).json({ success: false, error: 'Select at least one application.' });
        }
        if (!allowed.includes(req.body.status)) {
            return res.status(400).json({ success: false, error: `Status must be one of: ${allowed.join(', ')}` });
        }
        await Application.updateMany(
            { _id: { $in: ids } },
            {
                $set: { status: req.body.status },
                $push: { statusHistory: { status: req.body.status, changedAt: new Date() } }
            }
        );
        const data = await Application.find({ _id: { $in: ids } });
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/statistics', async (_req, res) => {
    try {
        const now = new Date();
        const urgentCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const [statusAgg, urgentAgg, livePrograms, countries] = await Promise.all([
            Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Application.aggregate([
                { $match: { status: { $in: ['submitted', 'under-review'] } } },
                { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opp' } },
                { $unwind: '$opp' },
                { $match: { 'opp.deadline': { $gte: now, $lte: urgentCutoff } } },
                { $count: 'urgent' }
            ]),
            Opportunity.countDocuments({ status: 'published', deadline: { $gte: now } }),
            Opportunity.distinct('country', { status: 'published' })
        ]);
        const counts = { submitted: 0, 'under-review': 0, nominated: 0, accepted: 0, rejected: 0 };
        statusAgg.forEach(item => { if (item._id in counts) counts[item._id] = item.count; });

        res.json({
            success: true,
            data: {
                ...counts,
                pending: counts.submitted + counts['under-review'],
                urgent: urgentAgg[0]?.urgent || 0,
                livePrograms,
                countries: countries.filter(Boolean).length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();
