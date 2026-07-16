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
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const reminderRoutes = require('./routes/reminders');
const { startDeadlineReminderScheduler } = require('./lib/reminderScheduler');
const { mapOpportunity, normalizeOpportunityInput, mapAdminOpportunity } = require('./lib/opportunities');
const { normalizeDocumentType, mapDocument, buildDocumentChecklist, validateDocumentReview, getApplicationDocumentStatus } = require('./lib/documents');
const { evaluateStudentEligibility, isOpportunityOpenForApplication } = require('./lib/eligibility');
const { applicationPipeline, buildApplicationPayload, toApplicationsCsv, isValidStatus, APPLICATION_STATUSES, mapStudentApplication } = require('./lib/applications');
const { computeStatisticsSummary, getUrgentCutoff } = require('./lib/statistics');
const { determineOpportunityUpdateAction } = require('./lib/audit');
const { buildStudentDashboard } = require('./lib/studentDashboard');
const { mapProfile, validateProfileUpdate } = require('./lib/profile');
const { sanitizeUser } = require('./lib/authValidation');
const { uploadSingleFile } = require('./middleware/upload');
const { resolveAbsolutePath, relativeFilePath, deleteStoredFile, removeFileIfExists, sanitizeDownloadFileName } = require('./lib/storage');
const fs = require('fs');

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
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/reminders', reminderRoutes);

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
    'forgot-password.html',
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

        await AuditLog.create({
            userId: user._id,
            userRole: user.role,
            action: 'user_profile_updated',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            changes: Object.keys(updates).map(field => ({ field, from: undefined, to: String(updates[field]) })),
            ip: req.ip
        });

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
        const documents = await Document.find({ userId: req.session.user._id }).populate('reviewedBy', 'name').sort({ uploadedAt: -1 });
        const data = documents.map(mapDocument);
        res.json({ success: true, data, checklist: buildDocumentChecklist(data) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/documents', requireStudentSession, uploadSingleFile, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'A file is required.' });
    }
    try {
        const { type } = req.body;
        if (!type) {
            await removeFileIfExists(req.file.path);
            return res.status(400).json({ success: false, error: 'Document type is required.' });
        }
        const document = await Document.create({
            userId: req.session.user._id,
            type: normalizeDocumentType(type),
            originalFileName: req.file.originalname,
            storedFileName: req.file.filename,
            filePath: relativeFilePath(req.session.user._id, req.file.filename),
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        // A replacement becomes the current document for applications that referenced
        // an older rejected file of the same type.
        const rejected = await Document.find({
            userId: req.session.user._id,
            type: document.type,
            status: 'rejected',
            _id: { $ne: document._id }
        }).select('_id');
        const rejectedIds = rejected.map(item => item._id);
        if (rejectedIds.length) {
            const affected = await Application.find({
                userId: req.session.user._id,
                documents: { $in: rejectedIds }
            });
            for (const application of affected) {
                application.documents = application.documents
                    .filter(id => !rejectedIds.some(rejectedId => String(rejectedId) === String(id)))
                    .concat(document._id);
                application.documentsStatus = 'incomplete';
                await application.save();
            }
        }

        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: 'document_uploaded',
            targetType: 'Document',
            targetId: document._id,
            targetLabel: document.originalFileName,
            ip: req.ip
        });

        res.status(201).json({ success: true, data: mapDocument(document) });
    } catch (err) {
        // The file was already written to disk before this validation/DB step ran —
        // clean it up so a rejected or failed upload never leaves an orphaned file.
        await removeFileIfExists(req.file.path);
        res.status(400).json({ success: false, error: err.message });
    }
});

// Files are served exclusively through this authenticated, ownership-scoped route —
// the storage directory itself is never mounted with express.static.
app.get('/api/documents/:id/file', requireSession, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid document id.' });
        }
        const query = { _id: req.params.id };
        if (!isAdminRole(req.session.user.role)) query.userId = req.session.user._id;
        const document = await Document.findOne(query);
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found.' });
        }

        let absolutePath;
        try {
            absolutePath = resolveAbsolutePath(document.filePath);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Unable to resolve the stored file location.' });
        }
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, error: 'The stored file could not be found. It may have been removed.' });
        }

        const isDownload = req.query.download === '1';
        const safeName = sanitizeDownloadFileName(document.originalFileName);
        res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
        res.sendFile(absolutePath);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/applications/:id/documents', requireAdminSession, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid application id.' });
        }
        const application = await Application.findById(req.params.id).populate({
            path: 'documents',
            populate: { path: 'reviewedBy', select: 'name' }
        });
        if (!application) return res.status(404).json({ success: false, error: 'Application not found.' });
        res.json({
            success: true,
            data: (application.documents || []).map(mapDocument),
            documentsStatus: application.documentsStatus
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.patch('/api/applications/:applicationId/documents/:documentId/review', requireAdminSession, async (req, res) => {
    try {
        const { applicationId, documentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(applicationId) || !mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, error: 'Invalid application or document id.' });
        }
        const review = validateDocumentReview(req.body.status, req.body.rejectionReason);
        if (!review.valid) return res.status(400).json({ success: false, error: review.error });

        const application = await Application.findOne({ _id: applicationId, documents: documentId });
        if (!application) return res.status(404).json({ success: false, error: 'Document is not part of this application.' });
        const document = await Document.findById(documentId);
        if (!document) return res.status(404).json({ success: false, error: 'Document not found.' });

        const previousStatus = document.status;
        document.status = req.body.status;
        document.rejectionReason = review.reason || undefined;
        document.reviewedAt = new Date();
        document.reviewedBy = req.session.user._id;
        await document.save();

        const linkedApplications = await Application.find({ documents: document._id }).populate('documents');
        for (const linked of linkedApplications) {
            linked.documentsStatus = getApplicationDocumentStatus(linked.documents);
            await linked.save();
        }

        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: document.status === 'verified' ? 'document_verified' : 'document_rejected',
            targetType: 'Document',
            targetId: document._id,
            targetLabel: document.originalFileName,
            changes: [
                { field: 'status', from: previousStatus, to: document.status },
                ...(review.reason ? [{ field: 'rejectionReason', from: '', to: review.reason }] : [])
            ],
            ip: req.ip
        });

        await document.populate('reviewedBy', 'name');
        const reviewedApplication = linkedApplications.find(item => String(item._id) === String(application._id));
        res.json({ success: true, data: mapDocument(document), documentsStatus: reviewedApplication?.documentsStatus || 'incomplete' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/documents/:id', requireStudentSession, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid document id.' });
        }
        const document = await Document.findOneAndDelete({ _id: req.params.id, userId: req.session.user._id });
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found.' });
        }
        await Application.updateMany(
            { documents: document._id },
            { $pull: { documents: document._id }, $set: { documentsStatus: 'incomplete' } }
        );
        // The MongoDB record is authoritative: once it's deleted, the document no longer
        // exists to the student regardless of what happens to the physical file next.
        // An already-missing file is treated as success; any other filesystem failure is
        // logged server-side as an orphaned-file warning rather than surfaced to the
        // client or used to block/undo the already-completed DB deletion.
        const fileDeletion = await deleteStoredFile(document.filePath);
        if (!fileDeletion.ok) {
            console.error(`Document ${document._id} record deleted but physical file removal failed: ${fileDeletion.error}`);
        }

        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: 'document_deleted',
            targetType: 'Document',
            targetId: document._id,
            targetLabel: document.originalFileName,
            ip: req.ip
        });

        res.json({ success: true, data: { id: String(document._id) } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
        const requiredTypes = [...new Set((opportunity.requiredDocumentTypes || []).map(normalizeDocumentType))];
        const documents = [];
        for (const type of requiredTypes) {
            const [latest] = await Document.findByStudentAndType(req.session.user._id, type);
            if (latest) documents.push(latest);
        }
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

        await AuditLog.create({
            userId: req.session.user._id,
            userRole: req.session.user.role,
            action: 'application_submitted',
            targetType: 'Application',
            targetId: application._id,
            targetLabel: `Application ${application._id}`,
            ip: req.ip
        });

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
    startDeadlineReminderScheduler();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();
