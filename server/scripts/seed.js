require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Applications');
const Document = require('../models/Document');
const { defaultFilePath } = require('../lib/documents');

const baseEligibility = { nonGraduatingRequired: false, sdfoClearanceRequired: false };
const opportunities = [
    { code: 'NUS-EX-01',    name: 'NUS Student Exchange', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Exchange', deadline: '2026-07-15', capacity: 5, requiredDocumentTypes: ['transcript', 'passport', 'EAF', 'recommendation'] },
    { code: 'KAIST-SU-01',  name: 'KAIST Summer Program', institution: 'KAIST', country: 'South Korea', region: 'Asia', category: 'Summer', deadline: '2026-06-30', capacity: 8, requiredDocumentTypes: ['transcript', 'recommendation'] },
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
    { studentId: '12110002', name: 'Maria Santos', college: 'GCOE', cgpa: 3.5, email: 'maria_santos@dlsu.edu.ph', role: 'student' },
    { studentId: '12210003', name: 'James Lim', college: 'CLA', cgpa: 3.2, email: 'james_lim@dlsu.edu.ph', role: 'student' },
    { studentId: '12310004', name: 'Angela Cruz', college: 'RVRCOB', cgpa: 3.8, email: 'angela_cruz@dlsu.edu.ph', role: 'student' },
    { studentId: '12410005', name: 'Miguel Torres', college: 'CCS', cgpa: 3.1, email: 'miguel_torres@dlsu.edu.ph', role: 'student' },
    { studentId: '12510006', name: 'Sofia Garcia', college: 'GCOE', cgpa: 3.9, email: 'sofia_garcia@dlsu.edu.ph', role: 'student' },
    { studentId: '12610007', name: 'Carlos Mendoza', college: 'CLA', cgpa: 2.9, email: 'carlos_mendoza@dlsu.edu.ph', role: 'student' },
    { studentId: '12010008', name: 'Isabelle Tan', college: 'RVRCOB', cgpa: 3.6, email: 'isabelle_tan@dlsu.edu.ph', role: 'student' },
    { studentId: '12110009', name: 'Rafael Villanueva', college: 'CCS', cgpa: 3.4, email: 'rafael_villaneuva@dlsu.edu.ph', role: 'student' },
    { studentId: '12210010', name: 'Patricia Dela Cruz', college: 'GCOE', cgpa: 3.3, email: 'patricia_delacruz@dlsu.edu.ph', role: 'student' },
    { studentId: '12310011', name: 'Diego Flores', college: 'CLA', cgpa: 3.0, email: 'diego_flores@dlsu.edu.ph', role: 'student' },
    { studentId: '12410012',   name: 'Camille Reyes', college: 'RVRCOB', cgpa: 3.7, email: 'camille_reyes@dlsu.edu.ph', role: 'student' },
    { studentId: '12510013',   name: 'Marco Aquino', college: 'CCS', cgpa: 3.5, email: 'marco_aquino@dlsu.edu.ph', role: 'student' },
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

const STATUSES = ['submitted', 'submitted', 'submitted', 'submitted', 'under-review', 'under-review', 'under-review', 'nominated', 'nominated', 'accepted', 'rejected'];
const DOCUMENT_TYPES = ['transcript', 'recommendation', 'validId', 'passport', 'EAF', 'curriculumAudit'];
const DOCUMENT_UPLOAD_STATUSES = ['pending', 'pending', 'verified', 'verified', 'rejected'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const randDate = (s, e) => new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().split('T')[0];
const randDateTime = (s, e) => new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));

// Gives each student a random subset of document types on file (2 to all 6), so some
// students are missing a type entirely -- exercising the "incomplete" path.
const buildDocumentsForStudents = (students) => students.flatMap((student, index) => {
    const typeCount = 2 + (index % (DOCUMENT_TYPES.length - 1));
    return shuffle(DOCUMENT_TYPES).slice(0, typeCount).map((type, typeIndex) => {
        const fileName = `${type}-${student.studentId}.pdf`;
        return {
            userId: student._id,
            type,
            originalFileName: fileName,
            storedFileName: `${student._id}-${typeIndex}-${fileName}`,
            filePath: defaultFilePath(student._id, fileName),
            mimeType: 'application/pdf',
            size: 100000 + Math.floor(Math.random() * 400000),
            uploadedAt: randDateTime(new Date('2026-04-01'), new Date('2026-06-20')),
            status: pick(DOCUMENT_UPLOAD_STATUSES)
        };
    });
});

async function seed() {
    if (process.env.NODE_ENV === 'production') {
        console.error('Refusing to run: this script clears collections and NODE_ENV=production.');
        process.exit(1);
    }

    await connectDB();
    console.log('Seeding...');
    console.log('Connected database:', mongoose.connection.name);

    await Application.deleteMany({});
    await Opportunity.deleteMany({});
    await User.deleteMany({});
    await Document.deleteMany({});

    await Application.syncIndexes();

    const opps = await Opportunity.insertMany(opportunities);
    const passwordHashed = await bcrypt.hash(SEED_PASSWORD, 10);
    const students = await User.insertMany(studentData.map(user => ({ ...user, passwordHashed })));
    const nonAdmins = students.filter(s => s.role === 'Student');

    const documents = buildDocumentsForStudents(nonAdmins);
    await Document.insertMany(documents);

    const documentTypesByStudent = new Map();
    documents.forEach(document => {
        const types = documentTypesByStudent.get(String(document.userId)) || new Set();
        types.add(document.type);
        documentTypesByStudent.set(String(document.userId), types);
    });
    const hasAllRequiredDocuments = (userId, opportunity) => {
        const onFile = documentTypesByStudent.get(String(userId)) || new Set();
        return (opportunity.requiredDocumentTypes || []).every(type => onFile.has(type));
    };

    const appDocs = Array.from({ length: 55 }, (_, index) => {
        const student = nonAdmins[index % nonAdmins.length];
        const opportunity = opps[Math.floor(index / nonAdmins.length) % opps.length];
        return {
            userId: student._id,
            opportunityId: opportunity._id,
            status: pick(STATUSES),
            submittedDate: randDate(new Date('2026-05-01'), new Date('2026-06-24')),
            documentsStatus: hasAllRequiredDocuments(student._id, opportunity) ? 'complete' : 'incomplete',
        };
    });

    await Application.insertMany(appDocs);
    console.log(`Done: ${opps.length} opportunities | ${students.length} students`);
    console.log(`Documents: ${documents.length}`);
    console.log(`Applications: ${appDocs.length}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Login with any seeded email and password "${SEED_PASSWORD}" (e.g. admin@dlsu.edu.ph). Development credentials only.`);
    }
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
