const { getDaysUntilDeadline } = require('../lib/deadlineReminders');
const {
    DOCUMENT_TYPES,
    OPPORTUNITY_DEADLINE_OFFSETS,
    buildSeedOpportunities,
    buildDocumentsForStudents,
    buildSeedApplications,
    databaseNameFromMongoUri,
    validateSeedEnvironment
} = require('../scripts/seed');

const now = new Date('2026-07-20T04:00:00.000Z');
const students = [
    { _id: 'student-leon', studentId: '12010001', name: 'Leon Pavino' },
    { _id: 'student-gracezel', studentId: '12110002', name: 'Gracezel Castrence' },
    { _id: 'student-theo', studentId: '12210003', name: 'Theo Patawaran' },
    { _id: 'student-paolo', studentId: '12310004', name: 'Paolo Medina' },
    { _id: 'student-miguel', studentId: '12410005', name: 'Miguel Torres' }
];

const withIds = documents => documents.map((document, index) => ({
    ...document,
    _id: `document-${index + 1}`
}));

describe('Deterministic seed - destructive execution guard', () => {
    test('extracts the database name without exposing credentials or query parameters', () => {
        expect(databaseNameFromMongoUri('mongodb+srv://user:password@example.mongodb.net/gems_demo?retryWrites=true'))
            .toBe('gems_demo');
    });

    test('allows an explicitly opted-in development, test, or demo database', () => {
        for (const databaseName of ['gems_dev', 'gems_development', 'gems_test', 'gems_demo']) {
            expect(validateSeedEnvironment({
                nodeEnv: 'development',
                mongoUri: `mongodb://localhost:27017/${databaseName}`,
                allowDatabaseSeed: 'true'
            })).toEqual({ valid: true, databaseName });
        }
    });

    test('always rejects production even when opt-in and database name appear safe', () => {
        expect(validateSeedEnvironment({
            nodeEnv: 'production',
            mongoUri: 'mongodb://localhost:27017/gems_demo',
            allowDatabaseSeed: 'true'
        })).toEqual({ valid: false, error: 'Refusing to seed while NODE_ENV=production.' });
    });

    test('rejects execution without explicit opt-in', () => {
        expect(validateSeedEnvironment({
            nodeEnv: 'development',
            mongoUri: 'mongodb://localhost:27017/gems_dev',
            allowDatabaseSeed: 'false'
        })).toEqual({ valid: false, error: 'Refusing to seed unless ALLOW_DATABASE_SEED=true.' });
    });

    test('rejects missing, malformed, and production-like database names', () => {
        for (const mongoUri of [
            '',
            'not-a-mongodb-uri',
            'mongodb://localhost:27017',
            'mongodb://localhost:27017/gems_production',
            'mongodb://localhost:27017/gems_db'
        ]) {
            expect(validateSeedEnvironment({
                nodeEnv: 'development',
                mongoUri,
                allowDatabaseSeed: 'true'
            }).valid).toBe(false);
        }
    });
});

describe('Deterministic seed - opportunity deadlines', () => {
    test('creates the same opportunities for the same clock value', () => {
        expect(buildSeedOpportunities(now)).toEqual(buildSeedOpportunities(now));
    });

    test('provides 7, 3, 1, and 0-day reminder windows followed by an expired opportunity', () => {
        const seeded = buildSeedOpportunities(now);
        expect(OPPORTUNITY_DEADLINE_OFFSETS.slice(0, 5)).toEqual([7, 3, 1, 0, -1]);
        expect(seeded.slice(0, 5).map(item => getDaysUntilDeadline(item.deadline, now))).toEqual([7, 3, 1, 0, -1]);
    });
});

describe('Deterministic seed - document scenarios', () => {
    test('gives Leon a stable 50-percent global checklist', () => {
        const documents = buildDocumentsForStudents(students, now)
            .filter(document => document.userId === 'student-leon');

        expect(documents.map(document => [document.type, document.status])).toEqual([
            ['transcript', 'verified'],
            ['recommendation', 'verified'],
            ['EAF', 'verified']
        ]);
    });

    test('gives Gracezel a rejected correction scenario with a reason', () => {
        const documents = buildDocumentsForStudents(students, now)
            .filter(document => document.userId === 'student-gracezel');

        expect(documents).toHaveLength(1);
        expect(documents[0]).toMatchObject({
            type: 'curriculumAudit',
            status: 'rejected',
            rejectionReason: 'The submitted form is missing the adviser signature.'
        });
    });

    test('gives Theo all six verified document types and Paolo an empty vault', () => {
        const documents = buildDocumentsForStudents(students, now);
        const theo = documents.filter(document => document.userId === 'student-theo');
        const paolo = documents.filter(document => document.userId === 'student-paolo');

        expect(theo.map(document => document.type)).toEqual(DOCUMENT_TYPES);
        expect(theo.every(document => document.status === 'verified')).toBe(true);
        expect(paolo).toEqual([]);
    });

    test('does not randomize the remaining student fixtures', () => {
        expect(buildDocumentsForStudents(students, now)).toEqual(buildDocumentsForStudents(students, now));
    });
});

describe('Deterministic seed - linked applications', () => {
    const opportunities = buildSeedOpportunities(now).map((opportunity, index) => ({
        ...opportunity,
        _id: `opportunity-${index + 1}`
    }));
    const documents = withIds(buildDocumentsForStudents(students, now));
    const applications = buildSeedApplications({
        students,
        opportunities,
        documents,
        adminId: 'admin-1',
        now
    });

    const applicationFor = (studentId, opportunityCode) => {
        const student = students.find(item => item.studentId === studentId);
        const opportunity = opportunities.find(item => item.code === opportunityCode);
        return applications.find(application => (
            application.userId === student._id && application.opportunityId === opportunity._id
        ));
    };

    test('links Leon real documents while keeping the missing-passport application incomplete', () => {
        const application = applicationFor('12010001', 'NUS-EX-01');
        expect(application.documents).toHaveLength(3);
        expect(application.documents.every(id => String(id).startsWith('document-'))).toBe(true);
        expect(application.documentsStatus).toBe('incomplete');
        expect(application.status).toBe('submitted');
    });

    test('links Theo verified requirements and marks the application complete', () => {
        const application = applicationFor('12210003', 'UTOKYO-EX-01');
        expect(application.documents).toHaveLength(3);
        expect(application.documentsStatus).toBe('complete');
        expect(application.status).toBe('submitted');
    });

    test('keeps Paolo empty and includes a deadline-day application', () => {
        const application = applicationFor('12310004', 'TUM-EX-01');
        expect(application.documents).toEqual([]);
        expect(application.documentsStatus).toBe('incomplete');
        expect(getDaysUntilDeadline(opportunities[3].deadline, now)).toBe(0);
    });

    test('records non-submitted statuses in history with the admin actor', () => {
        const application = applicationFor('12110002', 'KAIST-SU-01');
        expect(application.status).toBe('under-review');
        expect(application.documents).toHaveLength(1);
        expect(application.documentsStatus).toBe('incomplete');
        expect(application.statusHistory).toHaveLength(2);
        expect(application.statusHistory[1]).toMatchObject({ status: 'under-review', changedBy: 'admin-1' });
    });

    test('leaves later opportunities unused by the primary demo student', () => {
        const leon = students.find(student => student.studentId === '12010001');
        const leonOpportunityIds = applications
            .filter(application => application.userId === leon._id)
            .map(application => application.opportunityId);

        expect(leonOpportunityIds).not.toContain(opportunities[5]._id);
    });

    test('produces identical application payloads for identical inputs', () => {
        const repeated = buildSeedApplications({
            students,
            opportunities,
            documents,
            adminId: 'admin-1',
            now
        });
        expect(repeated).toEqual(applications);
    });
});
