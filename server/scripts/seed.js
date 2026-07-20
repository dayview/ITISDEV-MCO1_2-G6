require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Applications');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const { defaultFilePath, normalizeDocumentType } = require('../lib/documents');
const { buildApplicationPayload, appendStatusHistory } = require('../lib/applications');
const { generateDeadlineReminders } = require('../lib/deadlineReminders');

const DAY_MS = 24 * 60 * 60 * 1000;
const baseEligibility = { nonGraduatingRequired: false, sdfoClearanceRequired: false };
const opportunities = [
    { code: 'NUS-EX-01',    name: 'NUS Student Exchange', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Exchange', deadline: '2026-07-15', capacity: 5, requiredDocumentTypes: ['transcript', 'passport', 'EAF', 'recommendation'] },
    { code: 'KAIST-SU-01',  name: 'KAIST Summer Program', institution: 'KAIST', country: 'South Korea', region: 'Asia', category: 'Summer', deadline: '2026-06-30', capacity: 8, requiredDocumentTypes: ['curriculumAudit'] },
    { code: 'UTOKYO-EX-01', name: 'UTokyo Exchange', institution: 'University of Tokyo', country: 'Japan', region: 'Asia', category: 'Exchange', deadline: '2026-08-01', capacity: 4, requiredDocumentTypes: ['transcript', 'passport', 'EAF'] },
    { code: 'TUM-EX-01',    name: 'TUM Exchange Program', institution: 'Technical University of Munich', country: 'Germany', region: 'Europe', category: 'Exchange', deadline: '2026-09-15', capacity: 6, requiredDocumentTypes: ['transcript', 'passport', 'EAF', 'recommendation'] },
    { code: 'UNSW-EX-01',   name: 'UNSW Exchange', institution: 'University of New South Wales', country: 'Australia', region: 'Australia', category: 'Exchange', deadline: '2026-10-01', capacity: 4, requiredDocumentTypes: ['transcript', 'passport', 'EAF'] },
    { code: 'NTU-RS-01',    name: 'NTU Research Internship', institution: 'Nanyang Technological University', country: 'Singapore', region: 'Asia', category: 'Internship', deadline: '2026-07-28', capacity: 3, requiredDocumentTypes: ['transcript', 'validId', 'recommendation'] },
    { code: 'YONSEI-SU-01', name: 'Yonsei Summer School', institution: 'Yonsei University', country: 'South Korea', region: 'Asia', category: 'Summer', deadline: '2026-06-28', capacity: 10, requiredDocumentTypes: ['transcript', 'recommendation'] },
    { code: 'HKU-EX-01',    name: 'HKU Exchange', institution: 'University of Hong Kong', country: 'Hong Kong', region: 'Asia', category: 'Exchange', deadline: '2026-08-20', capacity: 5, requiredDocumentTypes: ['transcript', 'passport', 'EAF', 'recommendation'] },
    { code: 'NUS-RS-01',    name: 'NUS UROP Research', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Research', deadline: '2026-10-31', capacity: 6, requiredDocumentTypes: ['transcript', 'curriculumAudit'] },
    { code: 'POSTECH-EX-01', name: 'POSTECH Exchange', institution: 'POSTECH', country: 'South Korea', region: 'Asia', category: 'Exchange', deadline: '2026-09-30', capacity: 4, requiredDocumentTypes: ['transcript', 'passport', 'EAF'] },
].map(opportunity => ({
    ...opportunity,
    status: 'published',
    eligibility: baseEligibility
}));

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'GemsDev123!';

const studentData = [
    { studentId: '12010001', name: 'Leon Pavino', college: 'CCS', cgpa: 3.7, email: 'leon_pavino@dlsu.edu.ph', role: 'student' },
    { studentId: '12110002', name: 'Gracezel Castrence', college: 'CCS', cgpa: 3.5, email: 'gracezel_castrence@dlsu.edu.ph', role: 'student' },
    { studentId: '12210003', name: 'Theo Patawaran', college: 'CCS', cgpa: 3.2, email: 'paolo_patawaran@dlsu.edu.ph', role: 'student' },
    { studentId: '12310004', name: 'Paolo Medina', college: 'CCS', cgpa: 3.8, email: 'paolo_medina@dlsu.edu.ph', role: 'student' },
    { studentId: '12410005', name: 'Miguel Torres', college: 'CCS', cgpa: 3.1, email: 'miguel_torres@dlsu.edu.ph', role: 'student' },
    { studentId: '12510006', name: 'Sofia Garcia', college: 'GCOE', cgpa: 3.9, email: 'sofia_garcia@dlsu.edu.ph', role: 'student' },
    { studentId: '12610007', name: 'Carlos Mendoza', college: 'CLA', cgpa: 2.9, email: 'carlos_mendoza@dlsu.edu.ph', role: 'student' },
    { studentId: '12010008', name: 'Isabelle Tan', college: 'RVRCOB', cgpa: 3.6, email: 'isabelle_tan@dlsu.edu.ph', role: 'student' },
    { studentId: '12110009', name: 'Rafael Villanueva', college: 'CCS', cgpa: 3.4, email: 'rafael_villaneuva@dlsu.edu.ph', role: 'student' },
    { studentId: '12210010', name: 'Patricia Dela Cruz', college: 'GCOE', cgpa: 3.3, email: 'patricia_delacruz@dlsu.edu.ph', role: 'student' },
    { studentId: '12310011', name: 'Diego Flores', college: 'CLA', cgpa: 3.0, email: 'diego_flores@dlsu.edu.ph', role: 'student' },
    { studentId: '12410012', name: 'Camille Reyes', college: 'RVRCOB', cgpa: 3.7, email: 'camille_reyes@dlsu.edu.ph', role: 'student' },
    { studentId: '12510013', name: 'Marco Aquino', college: 'CCS', cgpa: 3.5, email: 'marco_aquino@dlsu.edu.ph', role: 'student' },
    { studentId: '12610014', name: 'Bianca Navarro', college: 'GCOE', cgpa: 3.8, email: 'bianca_navarro@dlsu.edu.ph', role: 'student' },
    { studentId: '12010015', name: 'Andrei Pascual', college: 'CCS', cgpa: 2.8, email: 'andrei_pascual@dlsu.edu.ph', role: 'student' },
    { studentId: '12110016', name: 'Tricia Ong', college: 'RVRCOB', cgpa: 3.6, email: 'tricia_ong@dlsu.edu.ph', role: 'student' },
    { studentId: '12210017', name: 'Zachary Fernandez', college: 'CLA', cgpa: 3.1, email: 'zachary_fernandez@dlsu.edu.ph', role: 'student' },
    { studentId: '12310018', name: 'Natalie Gomez', college: 'GCOE', cgpa: 3.1, email: 'natalie_gomez@dlsu.edu.ph', role: 'student' },
    { studentId: '12410019', name: 'Kevin Bautista', college: 'CCS', cgpa: 3.2, email: 'kevin_bautista@dlsu.edu.ph', role: 'student' },
    { studentId: '12510020', name: 'Admin User', college: 'CCS', cgpa: 4.0, email: 'admin@dlsu.edu.ph', role: 'admin' },
].map(user => ({
    ...user,
    role: user.role === 'admin' ? 'OVPERI_Admin' : 'Student',
}));

const DOCUMENT_TYPES = ['transcript', 'recommendation', 'validId', 'passport', 'EAF', 'curriculumAudit'];
const DOCUMENT_STATUS_SEQUENCE = ['pending', 'verified', 'rejected', 'verified'];
const APPLICATION_STATUS_SEQUENCE = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];
const OPPORTUNITY_DEADLINE_OFFSETS = [7, 3, 1, 0, -1, 30, 45, 60, 75, 90];
const SEEDABLE_DATABASE_NAME = /(?:^|_)(?:dev|development|test|demo)$/i;

/** These named accounts are stable presentation fixtures. Other students use a deterministic rotation so the dashboard remains varied without changing per run. */
const DEMO_DOCUMENT_SCENARIOS = {
    '12010001': [
        { type: 'transcript', status: 'verified' },
        { type: 'recommendation', status: 'verified' },
        { type: 'EAF', status: 'verified' }
    ],
    '12110002': [
        { type: 'curriculumAudit', status: 'rejected', rejectionReason: 'The submitted form is missing the adviser signature.' }
    ],
    '12210003': DOCUMENT_TYPES.map(type => ({ type, status: 'verified' })),
    '12310004': []
};

const manilaCalendarParts = value => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(value);
    const get = type => Number(parts.find(part => part.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
};

const relativeDeadline = (now, days) => {
    const { year, month, day } = manilaCalendarParts(now);
    return new Date(Date.UTC(year, month - 1, day + days, 4, 0, 0));
};

const buildSeedOpportunities = (now = new Date()) => opportunities.map((opportunity, index) => ({
    ...opportunity,
    deadline: relativeDeadline(now, OPPORTUNITY_DEADLINE_OFFSETS[index])
}));

const deterministicDocumentScenario = index => {
    const typeCount = 2 + (index % (DOCUMENT_TYPES.length - 1));
    return Array.from({ length: typeCount }, (_, offset) => ({
        type: DOCUMENT_TYPES[(index + offset) % DOCUMENT_TYPES.length],
        status: DOCUMENT_STATUS_SEQUENCE[(index + offset) % DOCUMENT_STATUS_SEQUENCE.length]
    }));
};

const buildDocumentsForStudents = (students, now = new Date()) => students.flatMap((student, studentIndex) => {
    const configured = DEMO_DOCUMENT_SCENARIOS[student.studentId];
    const scenario = configured === undefined ? deterministicDocumentScenario(studentIndex) : configured;

    return scenario.map((item, typeIndex) => {
        const fileName = `${item.type}-${student.studentId}.pdf`;
        return {
            userId: student._id,
            type: item.type,
            originalFileName: fileName,
            storedFileName: `${student._id}-${typeIndex}-${fileName}`,
            filePath: defaultFilePath(student._id, fileName),
            mimeType: 'application/pdf',
            size: 100000 + ((studentIndex * DOCUMENT_TYPES.length + typeIndex) % 24) * 12500,
            uploadedAt: new Date(now.getTime() - (45 - (studentIndex % 15) - typeIndex) * DAY_MS),
            status: item.status,
            rejectionReason: item.status === 'rejected' ? item.rejectionReason || 'Please replace this document with a corrected copy.' : ''
        };
    });
});

const latestDocumentsByStudentAndType = documents => {
    const latest = new Map();
    documents.forEach(document => {
        const key = `${String(document.userId)}:${normalizeDocumentType(document.type)}`;
        const existing = latest.get(key);
        if (!existing || new Date(document.uploadedAt) > new Date(existing.uploadedAt)) latest.set(key, document);
    });
    return latest;
};

const statusForApplication = ({ student, opportunity, index }) => {
    const key = `${student.studentId}:${opportunity.code}`;
    const overrides = {
        '12010001:NUS-EX-01': 'submitted',
        '12110002:KAIST-SU-01': 'under-review',
        '12210003:UTOKYO-EX-01': 'submitted',
        '12310004:NUS-EX-01': 'submitted',
        '12310004:TUM-EX-01': 'submitted'
    };
    return overrides[key] || APPLICATION_STATUS_SEQUENCE[index % APPLICATION_STATUS_SEQUENCE.length];
};

const buildSeedApplications = ({ students, opportunities: seededOpportunities, documents, adminId, now = new Date() }) => {
    const latestDocuments = latestDocumentsByStudentAndType(documents);
    const cohortCount = Math.min(3, seededOpportunities.length);
    const baseApplicationCount = Math.min(55, students.length * cohortCount);
    const basePairs = Array.from({ length: baseApplicationCount }, (_, index) => ({
        student: students[index % students.length],
        opportunity: seededOpportunities[Math.floor(index / students.length) % cohortCount],
        index
    }));
    const emptyStudent = students.find(student => student.studentId === '12310004');
    if (emptyStudent && seededOpportunities[3]) {
        basePairs.push({ student: emptyStudent, opportunity: seededOpportunities[3], index: basePairs.length });
    }

    return basePairs.map(({ student, opportunity, index }) => {
        const requiredTypes = [...new Set((opportunity.requiredDocumentTypes || []).map(normalizeDocumentType))];
        const linkedDocuments = requiredTypes
            .map(type => latestDocuments.get(`${String(student._id)}:${type}`))
            .filter(Boolean);
        const complete = requiredTypes.length > 0
            && requiredTypes.every(type => {
                const document = latestDocuments.get(`${String(student._id)}:${type}`);
                return document?.status === 'verified';
            });
        const submittedAt = new Date(now.getTime() - (30 - (index % 21)) * DAY_MS);
        const status = statusForApplication({ student, opportunity, index });
        const payload = buildApplicationPayload({
            userId: student._id,
            opportunityId: opportunity._id,
            documents: linkedDocuments,
            now: submittedAt
        });

        return {
            ...payload,
            status,
            documentsStatus: complete ? 'complete' : 'incomplete',
            statusHistory: status === 'submitted'
                ? payload.statusHistory
                : appendStatusHistory(payload.statusHistory, status, adminId, new Date(submittedAt.getTime() + DAY_MS))
        };
    });
};

const generateSeedRemindersWithoutEmail = async () => {
    const originalEmailSetting = process.env.EMAIL_NOTIFICATIONS_ENABLED;
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
    try {
        return await generateDeadlineReminders();
    } finally {
        if (originalEmailSetting === undefined) delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
        else process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailSetting;
    }
};

const databaseNameFromMongoUri = value => {
    try {
        return decodeURIComponent(new URL(String(value || '')).pathname.replace(/^\//, ''));
    } catch (error) {
        return '';
    }
};

const validateSeedEnvironment = ({
    nodeEnv = process.env.NODE_ENV,
    mongoUri = process.env.MONGO_URI,
    allowDatabaseSeed = process.env.ALLOW_DATABASE_SEED
} = {}) => {
    if (nodeEnv === 'production') {
        return { valid: false, error: 'Refusing to seed while NODE_ENV=production.' };
    }
    if (allowDatabaseSeed !== 'true') {
        return { valid: false, error: 'Refusing to seed unless ALLOW_DATABASE_SEED=true.' };
    }

    const databaseName = databaseNameFromMongoUri(mongoUri);
    if (!databaseName) {
        return { valid: false, error: 'Refusing to seed because MONGO_URI does not specify a database name.' };
    }
    if (!SEEDABLE_DATABASE_NAME.test(databaseName)) {
        return {
            valid: false,
            error: `Refusing to seed database "${databaseName}". Its name must end in _dev, _development, _test, or _demo.`
        };
    }

    return { valid: true, databaseName };
};

async function seed() {
    const environment = validateSeedEnvironment();
    if (!environment.valid) throw new Error(environment.error);

    await connectDB();
    console.log('Seeding...');
    console.log('Validated seed database:', environment.databaseName);
    console.log('Connected database:', mongoose.connection.name);

    await Application.deleteMany({});
    await Opportunity.deleteMany({});
    await User.deleteMany({});
    await Document.deleteMany({});
    await Notification.deleteMany({});

    await Application.syncIndexes();

    const now = new Date();
    const seededOpportunities = buildSeedOpportunities(now);
    const opps = await Opportunity.insertMany(seededOpportunities);
    const passwordHashed = await bcrypt.hash(SEED_PASSWORD, 10);
    const students = await User.insertMany(studentData.map(user => ({ ...user, passwordHashed })));
    const nonAdmins = students.filter(student => student.role === 'Student');
    const admin = students.find(student => student.role === 'OVPERI_Admin');

    const documentPayloads = buildDocumentsForStudents(nonAdmins, now);
    const documents = await Document.insertMany(documentPayloads);
    const applicationPayloads = buildSeedApplications({
        students: nonAdmins,
        opportunities: opps,
        documents,
        adminId: admin?._id,
        now
    });
    await Application.insertMany(applicationPayloads);

    await Notification.syncIndexes();
    const reminderSummary = await generateSeedRemindersWithoutEmail();
    console.log(`Done: ${opps.length} opportunities | ${students.length} students`);
    console.log(`Documents: ${documents.length}`);
    console.log(`Applications: ${applicationPayloads.length}`);
    console.log(`Deadline reminders: ${JSON.stringify(reminderSummary)}`);
    console.log('Seeded development accounts use SEED_PASSWORD from the environment (or the documented development default).');

    return {
        opportunities: opps.length,
        students: students.length,
        documents: documents.length,
        applications: applicationPayloads.length,
        reminders: reminderSummary
    };
}

if (require.main === module) {
    seed()
        .then(() => mongoose.disconnect())
        .catch(async error => {
            console.error(error.message);
            await mongoose.disconnect();
            process.exit(1);
        });
}

module.exports = {
    DOCUMENT_TYPES,
    DEMO_DOCUMENT_SCENARIOS,
    OPPORTUNITY_DEADLINE_OFFSETS,
    buildSeedOpportunities,
    buildDocumentsForStudents,
    buildSeedApplications,
    databaseNameFromMongoUri,
    validateSeedEnvironment,
    seed
};
