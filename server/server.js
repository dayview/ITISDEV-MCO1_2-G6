require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Opportunity = require('./models/Opportunity');
const Application = require('./models/Applications');
const Document = require('./models/Document');
const AuditLog = require('./models/AuditLog');
const User = require('./models/User');
const authRoutes = require('./routes/auth');
const { mapOpportunity, normalizeOpportunityInput, mapAdminOpportunity } = require('./lib/opportunities');
const { normalizeDocumentType } = require('./lib/documents');
const { evaluateStudentEligibility, isOpportunityOpenForApplication } = require('./lib/eligibility');
const { applicationPipeline, buildApplicationPayload, toApplicationsCsv, isValidStatus, APPLICATION_STATUSES, mapStudentApplication } = require('./lib/applications');
const { computeStatisticsSummary, getUrgentCutoff } = require('./lib/statistics');
const { determineOpportunityUpdateAction } = require('./lib/audit');
const { buildStudentDashboard } = require('./lib/studentDashboard');
const { mapProfile, validateProfileUpdate } = require('./lib/profile');
const { sanitizeUser } = require('./lib/authValidation');

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, '..');
const studentViewsRoot = path.join(root, 'views', 'student');
const adminViewsRoot = path.join(root, 'views', 'admin');

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'gems-dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use('/public', express.static(path.join(root, 'public')));

const isAdminRole = (role) => ['OVPERI_Admin', 'System_Admin'].includes(role);

const requireSession = (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ success: false, error: 'Please log in.' });
    next();
};

const requireAdminSession = (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ success: false, error: 'Please log in.' });
    if (!isAdminRole(req.session.user.role)) return res.status(403).json({ success: false, error: 'Admin access required.' });
    next();
};

const requireStudentSession = (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ success: false, error: 'Please log in.' });
    if (req.session.user.role !== 'Student') return res.status(403).json({ success: false, error: 'Student access required.' });
    next();
};

app.use('/api/auth', authRoutes);

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
    if (!req.session?.user) return res.redirect('/login.html');
    if (!isAdminRole(req.session.user.role)) return res.status(403).send('Admin access required.');
    res.sendFile(path.join(adminViewsRoot, req.params.page));
});

app.get('/api/admin/opportunities', requireAdminSession, async (_req, res) => {
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

app.get('/api/me', requireSession, (req, res) => {
    res.json({ success: true, user: req.session.user });
});

app.get('/api/student/dashboard', requireStudentSession, async (req, res) => {
    try {
        const now = new Date();
        const [student, applications, openOpportunities, documents] = await Promise.all([
            User.findById(req.session.user._id),
            Application.find({ userId: req.session.user._id }).populate('opportunityId'),
            Opportunity.find({ status: 'published', deadline: { $gte: now } }),
            Document.find({ userId: req.session.user._id })
        ]);
        if (!student) {
            return res.status(401).json({ success: false, error: 'Please log in.' });
        }
        const data = buildStudentDashboard({ student, applications, openOpportunities, documents, now });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/profile', requireStudentSession, async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        if (!user) return res.status(401).json({ success: false, error: 'Please log in.' });
        res.json({ success: true, data: mapProfile(user) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.patch('/api/profile', requireStudentSession, async (req, res) => {
    try {
        const { valid, errors, updates, unsets } = validateProfileUpdate(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Please fix the highlighted fields.', errors });
        }
        const mongoUpdate = {};
        if (Object.keys(updates).length) mongoUpdate.$set = updates;
        if (unsets.length) mongoUpdate.$unset = Object.fromEntries(unsets.map(field => [field, '']));

        const user = await User.findByIdAndUpdate(
            req.session.user._id,
            mongoUpdate,
            { new: true, runValidators: true }
        );
        if (!user) return res.status(401).json({ success: false, error: 'Please log in.' });
        req.session.user = sanitizeUser(user);
        res.json({ success: true, data: mapProfile(user) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
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

app.post('/api/opportunities', requireAdminSession, async (req, res) => {
    try {
        const opportunity = await Opportunity.create(normalizeOpportunityInput(req.body));
        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: 'opportunity_created',
            targetType: 'Opportunity',
            targetId: opportunity._id,
            targetLabel: opportunity.name,
            ip: req.ip
        });
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

app.patch('/api/opportunities/:id', requireAdminSession, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid opportunity id.' });
        }
        const existing = await Opportunity.findById(req.params.id).select('code status');
        const updates = normalizeOpportunityInput({ ...req.body, code: req.body.code || existing?.code });
        const opportunity = await Opportunity.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!opportunity) {
            return res.status(404).json({ success: false, error: 'Opportunity not found' });
        }
        const statusChanged = existing && existing.status !== opportunity.status;
        const action = determineOpportunityUpdateAction(existing?.status, opportunity.status);
        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action,
            targetType: 'Opportunity',
            targetId: opportunity._id,
            targetLabel: opportunity.name,
            changes: statusChanged ? [{ field: 'status', from: existing.status, to: opportunity.status }] : [],
            ip: req.ip
        });
        res.json({
            success: true,
            data: mapOpportunity(opportunity),
            adminData: mapAdminOpportunity(opportunity)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/documents', requireStudentSession, async (req, res) => {
    try {
        const data = await Document.find({ userId: req.session.user._id }).sort({ uploadedAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/documents', requireStudentSession, async (req, res) => {
    try {
        const { type, fileName, filePath, fileFormat } = req.body;
        if (!type || !fileName) return res.status(400).json({ success: false, error: 'Document type and file name are required.' });
        const document = await Document.create({
            userId: req.session.user._id,
            type: normalizeDocumentType(type),
            fileName,
            filePath: filePath || `uploads/${req.session.user._id}/${fileName}`,
            fileFormat
        });
        res.status(201).json({ success: true, data: document });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/applications/my', requireStudentSession, async (req, res) => {
    try {
        const data = await Application.find({ userId: req.session.user._id })
            .populate('opportunityId')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: data.map(mapStudentApplication) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/applications', requireStudentSession, async (req, res) => {
    try {
        const { opportunityId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
            return res.status(400).json({ success: false, error: 'Valid opportunity ID is required.' });
        }
        const opportunity = await Opportunity.findById(opportunityId);
        if (!isOpportunityOpenForApplication(opportunity)) {
            return res.status(400).json({ success: false, error: 'Opportunity is not open for applications.' });
        }
        const documents = await Document.find({ userId: req.session.user._id });
        const evaluation = evaluateStudentEligibility(req.session.user, opportunity, documents);
        if (!evaluation.eligible) {
            return res.status(400).json({
                success: false,
                error: 'Application requirements are incomplete.',
                missing: evaluation.missing
            });
        }
        const application = await Application.create(
            buildApplicationPayload({ userId: req.session.user._id, opportunityId, documents })
        );
        res.status(201).json({ success: true, data: application });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, error: 'You already applied to this opportunity.' });
        }
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/applications', requireAdminSession, async (req, res) => {
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

app.get('/api/applications/export', requireAdminSession, async (req, res) => {
    try {
        const data = await Application.aggregate(applicationPipeline(req.query));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
        res.send(toApplicationsCsv(data));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.patch('/api/applications/:id/status', requireAdminSession, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid application id.' });
        }
        if (!isValidStatus(req.body.status)) {
            return res.status(400).json({ success: false, error: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}` });
        }
        const previous = await Application.findById(req.params.id).select('status');
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
        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: 'application_status_changed',
            targetType: 'Application',
            targetId: application._id,
            targetLabel: `Application ${application._id}`,
            changes: [{ field: 'status', from: previous?.status, to: application.status }],
            ip: req.ip
        });
        res.json({ success: true, data: application });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/applications/bulk-action', requireAdminSession, async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];
        if (!ids.length) {
            return res.status(400).json({ success: false, error: 'Select at least one application.' });
        }
        if (!isValidStatus(req.body.status)) {
            return res.status(400).json({ success: false, error: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}` });
        }
        const targets = await Application.find({ _id: { $in: ids } }).select('status');
        await Application.updateMany(
            { _id: { $in: ids } },
            {
                $set: { status: req.body.status },
                $push: { statusHistory: { status: req.body.status, changedAt: new Date() } }
            }
        );
        if (targets.length) {
            await AuditLog.insertMany(targets.map(app => ({
                userId: req.session.user._id,
                userRole: req.session.user.role,
                action: 'application_bulk_status_changed',
                targetType: 'Application',
                targetId: app._id,
                targetLabel: `Application ${app._id}`,
                changes: [{ field: 'status', from: app.status, to: req.body.status }],
                ip: req.ip
            })));
        }
        const data = await Application.find({ _id: { $in: ids } });
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/statistics', requireAdminSession, async (_req, res) => {
    try {
        const now = new Date();
        const urgentCutoff = getUrgentCutoff(now);
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

        res.json({
            success: true,
            data: computeStatisticsSummary(statusAgg, urgentAgg[0]?.urgent, livePrograms, countries)
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
