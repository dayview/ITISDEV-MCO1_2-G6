/**
 * Additive, idempotent seed for manually verifying 1-Click Apply
 * (automatic eligibility + document auto-attach on POST /api/student/applications).
 *
 * Unlike seed.js, this does NOT wipe the database — it only upserts one
 * dedicated test student, gives them every document type, and points two
 * existing opportunities' requirements/eligibility at that profile. Safe to
 * re-run any time; run `npm run seed` first if the base data doesn't exist yet.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const connectDB = require('./config/db');
const User = require('./models/Users');
const Opportunity = require('./models/Opportunity');
const Document = require('./models/Document');
const Application = require('./models/Applications');

const TEST_PASSWORD = 'Password123';
const TEST_EMAIL = 'quickapply_test@dlsu.edu.ph';

const TEST_STUDENT = {
    studentId: '99999999',
    name: 'Quick Apply Tester',
    email: TEST_EMAIL,
    college: 'CCS',
    major: 'Computer Science',
    cgpa: 3.8,
    graduatingTerm: null,
    enrollmentStatus: 'Full-time',
    isGraduating: false,
    sdfoCleared: true,
    role: 'Student',
};

// One document per allowed type (see Document.js ALLOWED_TYPES) so the test
// student can satisfy any opportunity's requiredDocumentTypes.
const DOCUMENT_TYPES = ['transcript', 'recommendation', 'validId', 'passport', 'EAF', 'curriculumAudit', 'other'];

// Opportunities to point at this student. Both must have future deadlines
// (checked against today) and eligibility criteria the test student passes,
// so 1-Click Apply should succeed with documentsStatus: 'complete'.
const TARGET_OPPORTUNITIES = [
    {
        code: 'NUS-EX-01',
        requiredDocumentTypes: ['transcript', 'validId', 'recommendation'],
        eligibility: { minCgpa: 3.0, nonGraduatingRequired: true, sdfoClearanceRequired: true },
    },
    {
        code: 'TUM-EX-01',
        requiredDocumentTypes: ['transcript', 'passport', 'EAF'],
        eligibility: { minCgpa: 3.5, nonGraduatingRequired: true, sdfoClearanceRequired: false },
    },
];

async function seed() {
    await connectDB();
    console.log('Seeding quick-apply test fixture...');

    const passwordHashed = await bcrypt.hash(TEST_PASSWORD, 12);
    const student = await User.findOneAndUpdate(
        { email: TEST_EMAIL },
        { $set: { ...TEST_STUDENT, passwordHashed } },
        { upsert: true, new: true, runValidators: true }
    );

    await Document.deleteMany({ userId: student._id });
    await Document.insertMany(DOCUMENT_TYPES.map(type => ({
        userId: student._id,
        type,
        fileName: `${type}.pdf`,
        filePath: `/uploads/${student._id}/${type}.pdf`,
        fileFormat: 'pdf',
    })));

    const opportunities = [];
    for (const target of TARGET_OPPORTUNITIES) {
        const opportunity = await Opportunity.findOneAndUpdate(
            { code: target.code },
            { $set: { requiredDocumentTypes: target.requiredDocumentTypes, eligibility: target.eligibility, status: 'published' } },
            { new: true }
        );
        if (!opportunity) {
            console.warn(`Skipped ${target.code}: not found. Run "npm run seed" first.`);
            continue;
        }
        // Clear any prior application so this opportunity can be applied to fresh.
        await Application.deleteOne({ studentId: student._id, opportunityId: opportunity._id });
        opportunities.push(opportunity);
    }

    console.log('\nDone. Log in with:');
    console.log(`  email:    ${TEST_EMAIL}`);
    console.log(`  password: ${TEST_PASSWORD}`);
    console.log('\nOpportunities ready for 1-Click Apply:');
    opportunities.forEach(opp => {
        console.log(`  ${opp.code} (${opp._id}) — requires [${opp.requiredDocumentTypes.join(', ')}], deadline ${opp.deadline.toISOString().slice(0, 10)}`);
    });
    console.log('\nEach should return eligible: true and, after POST /api/student/applications, documentsStatus: "complete".');

    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
