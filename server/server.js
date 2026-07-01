require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const Opportunity = require('./models/Opportunity');
const Application = require('./models/Applications');
// const applicationsRouter = require('./routes/applications'); remove comment once implemented

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const gemsRoot = path.join(__dirname, '../gems');
const viewsRoot = path.join(gemsRoot, 'views');

app.use(express.json());
app.use(express.static(gemsRoot));

app.get('/', (req, res) => {
    res.sendFile(path.join(viewsRoot, 'student', 'login.html'));
});

app.get('/student', (req, res) => {
    res.redirect('/views/student/dashboard.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/views/admin/dashboard.html');
});

app.get('/admin/profile', (req, res) => {
    res.sendFile(path.join(viewsRoot, 'admin', 'admin-profile.html'));
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
    res.sendFile(path.join(viewsRoot, 'student', req.params.page));
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
    res.sendFile(path.join(viewsRoot, 'admin', req.params.page));
});

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
        benefits: plain.benefits ? [plain.benefits] : [],
        fees: plain.fees,
        credits: plain.credits,
        requiredDocuments: plain.requiredDocumentTypes || [],
        eligibility: plain.eligibility,
        eligible: true,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt
    };
};

const mapApplication = (application) => ({
    id: String(application._id),
    name: application.student?.name || '',
    student_id: application.student?.studentId || '',
    college: application.student?.college || '',
    cgpa: application.student?.cgpa || '',
    opp_name: application.opportunity?.name || '',
    institution: application.opportunity?.institution || '',
    submitted_date: application.createdAt,
    documents_status: application.documentsStatus,
    status: application.status
});

app.get('/api/opportunities', async (req, res) => {
    try {
        const result = await Opportunity.search({
            search: req.query.search,
            category: req.query.category,
            region: req.query.region,
            deadlineFrom: req.query.deadlineFrom,
            deadlineTo: req.query.deadlineTo,
            sortBy: req.query.sortBy,
            page: Number(req.query.page) || 1,
            pageSize: Number(req.query.pageSize) || 50
        });

        res.json({
            data: result.data.map(mapOpportunity),
            meta: result.meta
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/opportunities/:id', async (req, res) => {
    try {
        const opportunity = await Opportunity.findOpportunityById(req.params.id);
        if (!opportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }

        res.json(mapOpportunity(opportunity));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/applications', async (req, res) => {
    try {
        const result = await Application.listAll({
            status: req.query.status,
            college: req.query.college,
            search: req.query.search,
            sort: req.query.sort,
            page: Number(req.query.page) || 1,
            pageSize: Number(req.query.pageSize) || 50
        });

        res.json({
            success: true,
            data: result.data.map(mapApplication),
            meta: result.meta
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/statistics', async (req, res) => {
    try {
        const [applicationStats, opportunityStats] = await Promise.all([
            Application.getStatusCounts(),
            Opportunity.getLiveStats()
        ]);

        res.json({
            success: true,
            data: {
                ...applicationStats,
                ...opportunityStats
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// app.use('/api', applicationsRouter) remove comment once implemented

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();
