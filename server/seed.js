require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/Users');
const Opportunity = require('./models/Opportunity');
const Application = require('./models/Applications');

const baseEligibility = { nonGraduatingRequired: false, sdfoClearanceRequired: false };
const opportunities = [
    { code: 'NUS-EX-01',    name: 'NUS Student Exchange', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Exchange', deadline: '2026-07-15', capacity: 5 },
    { code: 'KAIST-SU-01',  name: 'KAIST Summer Program', institution: 'KAIST', country: 'South Korea', region: 'Asia', category: 'Summer', deadline: '2026-06-30', capacity: 8 },
    { code: 'UTOKYO-EX-01', name: 'UTokyo Exchange', institution: 'University of Tokyo', country: 'Japan', region: 'Asia', category: 'Exchange', deadline: '2026-08-01', capacity: 4 },
    { code: 'TUM-EX-01',    name: 'TUM Exchange Program', institution: 'Technical University of Munich', country: 'Germany', region: 'Europe', category: 'Exchange', deadline: '2026-09-15', capacity: 6 },
    { code: 'UNSW-EX-01',   name: 'UNSW Exchange', institution: 'University of New South Wales', country: 'Australia', region: 'Australia', category: 'Exchange', deadline: '2026-10-01', capacity: 4 },
    { code: 'NTU-RS-01',    name: 'NTU Research Internship', institution: 'Nanyang Technological University', country: 'Singapore', region: 'Asia', category: 'Internship', deadline: '2026-07-28', capacity: 3 },
    { code: 'YONSEI-SU-01', name: 'Yonsei Summer School', institution: 'Yonsei University', country: 'South Korea', region: 'Asia', category: 'Summer', deadline: '2026-06-28', capacity: 10 },
    { code: 'HKU-EX-01',    name: 'HKU Exchange', institution: 'University of Hong Kong', country: 'Hong Kong', region: 'Asia', category: 'Exchange', deadline: '2026-08-20', capacity: 5 },
    { code: 'NUS-RS-01',    name: 'NUS UROP Research', institution: 'National University of Singapore', country: 'Singapore', region: 'Asia', category: 'Research', deadline: '2026-10-31', capacity: 6 },
    { code: 'POSTECH-EX-01', name: 'POSTECH Exchange', institution: 'POSTECH', country: 'South Korea', region: 'Asia', category: 'Exchange', deadline: '2026-09-30', capacity: 4 },
].map(opportunity => ({
    ...opportunity,
    status: 'published',
    eligibility: baseEligibility
}));

const DEFAULT_PASSWORD_HASH = 'seed-password-placeholder';

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
    passwordHashed: DEFAULT_PASSWORD_HASH,
    // sdfoCleared now defaults to false in the schema, so mark seeded users
    // cleared explicitly to keep them eligible for clearance-gated opportunities.
    sdfoCleared: true,
}));

const STATUSES = ['submitted', 'submitted', 'submitted', 'submitted', 'under-review', 'under-review', 'under-review', 'nominated', 'nominated', 'accepted', 'rejected'];
const DOC_STATUSES = ['incomplete', 'incomplete', 'complete'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randDate = (s, e) => new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().split('T')[0];

async function seed() {
    await connectDB();
    console.log('Seeding...');

    await Application.syncIndexes();

    await Application.deleteMany({});
    await Opportunity.deleteMany({});
    await User.deleteMany({});

    const opps = await Opportunity.insertMany(opportunities);
    const students = await User.insertMany(studentData);
    const nonAdmins = students.filter(s => s.role === 'Student');

    const appDocs = Array.from({ length: 55 }, (_, index) => {
        const submittedDate = randDate(new Date('2026-05-01'), new Date('2026-06-24'));
        return {
            studentId: nonAdmins[index % nonAdmins.length]._id,
            opportunityId: opps[Math.floor(index / nonAdmins.length) % opps.length]._id,
            status: pick(STATUSES),
            documentsStatus: pick(DOC_STATUSES),
            createdAt: submittedDate,
            updatedAt: submittedDate,
        };
    });

    // timestamps:false so the seeded submitted dates above are preserved
    // instead of being overwritten with the current time by Mongoose.
    await Application.insertMany(appDocs, { timestamps: false });
    console.log(`Done: ${opps.length} opportunities | ${students.length} students`);
    console.log(`Applications: ${appDocs.length}`);
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
