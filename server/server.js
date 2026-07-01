require('dotenv').config();
const MongoStore = require('connect-mongo');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const appsRouter = require('./routes/applications');
const statsRouter = require('./routes/statistics');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error('Missing MONGO_URI. Copy .env.example to .env and set MONGO_URI to your MongoDB connection string.');
    process.exit(1);
}

connectDB();

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'gems_dev_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri, ttl: 86400 }),
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 86400000 },
}));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/auth', authRouter);
app.use('/api/applications', appsRouter);
app.use('/api/statistics', statsRouter);

if (process.env.NODE_ENV !== 'production') {
    app.post('/api/seed', async (req, res, next) => {
        try { require('child_process').exec('node server/scripts/seed.js', (err, stdout) => {
            if (err) return next(err);
            res.json({ success: true, message: stdout.trim() });
        }); } catch (err) { next(err); }
    });
}

app.use((req, res) => res.sendFile(path.join(__dirname, '../client/views/student/login.html')));
app.use(errorHandler);

app.listen(PORT, () => console.log(`GEMS running on http://localhost:${PORT}`));
