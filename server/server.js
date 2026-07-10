require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const connectDB = require('./config/db');
const Opportunity = require('./models/Opportunity');
const User = require('./models/Users');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const studentRouter = require('./routes/student');
const adminRouter = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const gemsRoot = path.join(__dirname, '../gems');
const viewsRoot = path.join(gemsRoot, 'views');

app.use(express.json());
app.use(express.static(gemsRoot));

app.use(session({
    name: 'gems.sid',
    secret: process.env.SESSION_SECRET || 'gems-dev-secret-change-in-production',
    resave:     false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
}));

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Opportunity routes (public read, admin write) ─────────────────────────────
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
            pageSize: Number(req.query.pageSize) || 50,
        });
        const data = await Promise.all(result.data.map(opp => mapOpportunity(opp, req.session)));
        res.json({ data, meta: result.meta });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/opportunities/:id', async (req, res) => {
    try {
        const opportunity = await Opportunity.findOpportunityById(req.params.id);
        if (!opportunity) return res.status(404).json({ message: 'Opportunity not found' });
        res.json(await mapOpportunity(opportunity, req.session));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── Student-scoped API routes ─────────────────────────────────────────────────
app.use('/api/student', studentRouter);

// ── Admin API routes ──────────────────────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ── HTML page serving with role guards ───────────────────────────────────────

// Public pages (no auth needed)
const publicPages = new Set(['login.html', 'register.html']);

// Student pages (must be authenticated as Student)
const studentPages = new Set([
    'applications.html',
    'catalog.html',
    'dashboard.html',
    'documents.html',
    'opportunity.html',
    'profile.html',
]);

// Admin pages (must be authenticated as admin)
const adminPages = new Set([
    'admin-profile.html',
    'applicants.html',
    'dashboard.html',
    'post-opportunity.html',
    'programs.html',
]);

app.get('/', (req, res) => {
    if (req.session?.userId) {
        const role = req.session.role;
        if (role === 'OVPERI_Admin' || role === 'System_Admin') return res.redirect('/admin/dashboard.html');
        return res.redirect('/dashboard.html');
    }
    res.sendFile(path.join(viewsRoot, 'student', 'login.html'));
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;

    if (publicPages.has(page)) {
        return res.sendFile(path.join(viewsRoot, 'student', page));
    }

    if (studentPages.has(page)) {
        if (!req.session?.userId) return res.redirect('/login.html');
        if (!['Student', 'OVPERI_Admin', 'System_Admin'].includes(req.session.role)) {
            return res.redirect('/login.html');
        }
        return res.sendFile(path.join(viewsRoot, 'student', page));
    }

    next();
});

app.get('/admin', (req, res) => {
    if (!req.session?.userId) return res.redirect('/login.html');
    if (!['OVPERI_Admin', 'System_Admin'].includes(req.session.role)) return res.redirect('/dashboard.html');
    res.redirect('/admin/dashboard.html');
});

app.get('/admin/:page', (req, res, next) => {
    const page = req.params.page;
    if (!adminPages.has(page)) return next();

    if (!req.session?.userId) return res.redirect('/login.html');
    if (!['OVPERI_Admin', 'System_Admin'].includes(req.session.role)) {
        return res.status(403).sendFile(path.join(viewsRoot, 'student', 'login.html'));
    }

    res.sendFile(path.join(viewsRoot, 'admin', page));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const mapOpportunity = async (opportunity, session) => {
    const plain = typeof opportunity.toObject === 'function' ? opportunity.toObject() : opportunity;

    let eligibility = { eligible: true, reasons: [] };
    if (session?.userId && session.role === 'Student') {
        eligibility = await User.checkEligibility(session.userId, plain);
    }

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
        eligible: eligibility.eligible,
        eligibilityReasons: eligibility.reasons,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();
