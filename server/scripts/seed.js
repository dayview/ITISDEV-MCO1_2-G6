require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Applications');

const opportunities = [
    { code: 'NUS-EX-01', name: 'NUS Student Exchange', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Exchange', status: 'published', deadline: '2026-07-15', capacity: 5, description: 'Semester exchange program in Singapore.', benefits: 'Partner university support.', requiredDocumentTypes: ['transcript', 'passport'] },
    { code: 'KAIST-SU-01', name: 'KAIST Summer Program', institution: 'KAIST', country: 'South Korea', region: 'Asia', category: 'Summer', status: 'published', deadline: '2026-07-30', capacity: 8, description: 'Short summer program in Korea.', benefits: 'Program advising.', requiredDocumentTypes: ['transcript', 'validId'] },
    { code: 'UTOKYO-EX-01', name: 'UTokyo Exchange', institution: 'University of Tokyo', country: 'Japan', region: 'Asia', category: 'Exchange', status: 'published', deadline: '2026-08-01', capacity: 4, description: 'Exchange term in Tokyo.', benefits: 'Tuition waiver.', requiredDocumentTypes: ['transcript', 'recommendation'] },
    { code: 'TUM-EX-01', name: 'TUM Exchange Program', institution: 'Technical University of Munich', country: 'Germany', region: 'Europe', category: 'Exchange', status: 'published', deadline: '2026-09-15', capacity: 6, description: 'Engineering exchange program.', benefits: 'Academic mobility support.', requiredDocumentTypes: ['transcript', 'passport'] },
    { code: 'UNSW-EX-01', name: 'UNSW Exchange', institution: 'University of New South Wales', country: 'Australia', region: 'Oceania', category: 'Exchange', status: 'published', deadline: '2026-10-01', capacity: 4, description: 'Exchange opportunity in Australia.', benefits: 'Credit transfer guidance.', requiredDocumentTypes: ['transcript'] },
    { code: 'NTU-RS-01', name: 'NTU Research Internship', institution: 'Nanyang Technological University', country: 'Singapore', region: 'Asia', category: 'Research', status: 'published', deadline: '2026-07-28', capacity: 3, description: 'Research internship with faculty mentors.', benefits: 'Research placement.', requiredDocumentTypes: ['transcript', 'recommendation'] },
    { code: 'YONSEI-SU-01', name: 'Yonsei Summer School', institution: 'Yonsei University', country: 'South Korea', region: 'Asia', category: 'Summer', status: 'published', deadline: '2026-07-28', capacity: 10, description: 'Summer school in Seoul.', benefits: 'Short-term mobility support.', requiredDocumentTypes: ['validId'] },
    { code: 'HKU-EX-01', name: 'HKU Exchange', institution: 'University of Hong Kong', country: 'Hong Kong', region: 'Asia', category: 'Exchange', status: 'published', deadline: '2026-08-20', capacity: 5, description: 'Exchange term in Hong Kong.', benefits: 'Partner coordination.', requiredDocumentTypes: ['transcript', 'passport'] },
    { code: 'NUS-RS-01', name: 'NUS UROP Research', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Research', status: 'draft', deadline: '2026-10-31', capacity: 6, description: 'Draft research listing.', benefits: 'Research advising.', requiredDocumentTypes: ['transcript'] },
    { code: 'POSTECH-EX-01', name: 'POSTECH Exchange', institution: 'POSTECH', country: 'South Korea', region: 'Asia', category: 'Exchange', status: 'published', deadline: '2026-09-30', capacity: 4, description: 'Exchange opportunity at POSTECH.', benefits: 'Mobility support.', requiredDocumentTypes: ['transcript', 'passport'] },
];

const studentData = [
    { studentId: '12010001', name: 'Leon Pavino', college: 'CCS', cgpa: 3.7, email: 'leon_pavino@dlsu.edu.ph', role: 'Student', passwordHashed: 'seed-only' },
    { studentId: '12110002', name: 'Maria Santos', college: 'GCOE', cgpa: 3.5, email: 'maria_santos@dlsu.edu.ph', role: 'Student', passwordHashed: 'seed-only' },
    { studentId: '12210003', name: 'James Lim', college: 'CLA', cgpa: 3.2, email: 'james_lim@dlsu.edu.ph', role: 'Student', passwordHashed: 'seed-only' },
    { studentId: '12310004', name: 'Angela Cruz', college: 'RVRCOB', cgpa: 3.8, email: 'angela_cruz@dlsu.edu.ph', role: 'Student', passwordHashed: 'seed-only' },
    { studentId: '12410005', name: 'Miguel Torres', college: 'CCS', cgpa: 3.1, email: 'miguel_torres@dlsu.edu.ph', role: 'Student', passwordHashed: 'seed-only' },
    { studentId: '12510020', name: 'Admin User', college: 'CCS', cgpa: 4.0, email: 'admin@dlsu.edu.ph', role: 'OVPERI_Admin', passwordHashed: 'seed-only' },
];

const STATUSES = ['submitted', 'submitted', 'submitted', 'submitted', 'under-review', 'under-review', 'under-review', 'nominated', 'nominated', 'accepted', 'rejected'];
const DOC_STATUSES = ['incomplete', 'incomplete', 'complete'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randDate = (s, e) => new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().split('T')[0];

async function seed() {
    await connectDB();
    console.log('Seeding...');

    await Application.deleteMany({});
    await Opportunity.deleteMany({});
    await User.deleteMany({});

    const opps = await Opportunity.insertMany(opportunities);
    const students = await User.insertMany(studentData);
    const nonAdmins = students.filter(s => s.role === 'Student');

    const appDocs = [];
    nonAdmins.forEach((student, studentIndex) => {
        opps.slice(0, 6).forEach((opportunity, oppIndex) => {
            appDocs.push({
                userId: student._id,
                opportunityId: opportunity._id,
                status: STATUSES[(studentIndex + oppIndex) % STATUSES.length],
                submittedDate: randDate(new Date('2026-05-01'), new Date('2026-06-24')),
                documentsStatus: pick(DOC_STATUSES),
            });
        });
    });

    await Application.insertMany(appDocs);
    console.log(`Done: ${opps.length} opportunities | ${students.length} students | ${appDocs.length} applications`);
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
