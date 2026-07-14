const mongoose = require('mongoose');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Applications');
const Document = require('../models/Document');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const oid = () => new mongoose.Types.ObjectId();

describe('Opportunity Management - schema validation', () => {
    test('valid opportunity passes validation', () => {
        const opp = new Opportunity({
            code: 'GEMS-001', name: 'Exchange', institution: 'NUS', category: 'Exchange',
            deadline: new Date('2026-12-31')
        });
        expect(opp.validateSync()).toBeUndefined();
    });

    test('required field validation: code, name, institution, category, deadline are required', () => {
        const opp = new Opportunity({});
        const err = opp.validateSync();
        expect(err).toBeDefined();
        expect(err.errors.code).toBeDefined();
        expect(err.errors.name).toBeDefined();
        expect(err.errors.institution).toBeDefined();
        expect(err.errors.category).toBeDefined();
        expect(err.errors.deadline).toBeDefined();
    });

    test('deadline validation: missing deadline is rejected', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', category: 'X' });
        const err = opp.validateSync();
        expect(err.errors.deadline).toBeDefined();
    });

    test('draft vs published status validation: defaults to draft', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', category: 'X', deadline: new Date() });
        expect(opp.status).toBe('draft');
    });

    test('draft vs published status validation: accepts published and closed', () => {
        const base = { code: 'X', name: 'X', institution: 'X', category: 'X', deadline: new Date() };
        expect(new Opportunity({ ...base, status: 'published' }).validateSync()).toBeUndefined();
        expect(new Opportunity({ ...base, status: 'closed' }).validateSync()).toBeUndefined();
    });

    test('draft vs published status validation: rejects an unknown status', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', category: 'X', deadline: new Date(), status: 'archived' });
        const err = opp.validateSync();
        expect(err.errors.status).toBeDefined();
    });

    test('category validation: rejects a missing category', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', deadline: new Date() });
        expect(opp.validateSync().errors.category).toBeDefined();
    });

    test('region validation: region is optional and accepts any provided string', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', category: 'X', deadline: new Date(), region: 'Asia' });
        expect(opp.validateSync()).toBeUndefined();
        expect(opp.region).toBe('Asia');
    });

    test('region validation: opportunity is valid even when region is omitted', () => {
        const opp = new Opportunity({ code: 'X', name: 'X', institution: 'X', category: 'X', deadline: new Date() });
        expect(opp.validateSync()).toBeUndefined();
    });
});

describe('Application Logic - schema validation', () => {
    test('valid application passes validation', () => {
        const app = new Application({ userId: oid(), opportunityId: oid(), submittedDate: '2026-01-01' });
        expect(app.validateSync()).toBeUndefined();
    });

    test('required field validation: userId, opportunityId, submittedDate are required', () => {
        const app = new Application({});
        const err = app.validateSync();
        expect(err.errors.userId).toBeDefined();
        expect(err.errors.opportunityId).toBeDefined();
        expect(err.errors.submittedDate).toBeDefined();
    });

    test('status defaults to submitted and rejects unknown values', () => {
        const app = new Application({ userId: oid(), opportunityId: oid(), submittedDate: '2026-01-01' });
        expect(app.status).toBe('submitted');

        const bad = new Application({ userId: oid(), opportunityId: oid(), submittedDate: '2026-01-01', status: 'approved' });
        expect(bad.validateSync().errors.status).toBeDefined();
    });

    test('duplicate application detection: enforces a unique compound index on userId + opportunityId', () => {
        const indexes = Application.schema.indexes();
        const compound = indexes.find(([fields]) => fields.userId === 1 && fields.opportunityId === 1);
        expect(compound).toBeDefined();
        expect(compound[1].unique).toBe(true);
    });
});

describe('Document Logic - schema validation', () => {
    const validDocFields = {
        userId: oid(), type: 'transcript', originalFileName: 'grades.pdf', storedFileName: 'abc123.pdf',
        filePath: 'documents/x/abc123.pdf', mimeType: 'application/pdf', size: 20480
    };

    test('valid document passes validation', () => {
        const doc = new Document(validDocFields);
        expect(doc.validateSync()).toBeUndefined();
    });

    test('rejects an unknown document type', () => {
        const doc = new Document({ ...validDocFields, type: 'diploma' });
        expect(doc.validateSync().errors.type).toBeDefined();
    });

    test('required field validation: userId, type, originalFileName, storedFileName, filePath, mimeType, size are required', () => {
        const doc = new Document({});
        const err = doc.validateSync();
        expect(err.errors.userId).toBeDefined();
        expect(err.errors.type).toBeDefined();
        expect(err.errors.originalFileName).toBeDefined();
        expect(err.errors.storedFileName).toBeDefined();
        expect(err.errors.filePath).toBeDefined();
        expect(err.errors.mimeType).toBeDefined();
        expect(err.errors.size).toBeDefined();
    });

    test('defaults status to pending', () => {
        const doc = new Document(validDocFields);
        expect(doc.status).toBe('pending');
    });
});

describe('Authentication - User schema validation', () => {
    test('rejects an unknown role', () => {
        const user = new User({ email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A', role: 'SuperUser' });
        expect(user.validateSync().errors.role).toBeDefined();
    });

    test('defaults role to Student', () => {
        const user = new User({ email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A' });
        expect(user.role).toBe('Student');
    });

    test('email and studentId are declared unique for duplicate detection at the DB layer', () => {
        expect(User.schema.path('email').options.unique).toBe(true);
        expect(User.schema.path('studentId').options.unique).toBe(true);
    });

    test('accepts a fully populated profile (phone, gender, birthdate, enrollmentStatus)', () => {
        const user = new User({
            email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A',
            phone: '+63 917 123 4567', gender: 'female', birthdate: new Date('2003-05-15'),
            major: 'BS Computer Science', enrollmentStatus: 'Full-time', graduatingTerm: 'AY 2026-2027, Term 2'
        });
        expect(user.validateSync()).toBeUndefined();
    });

    test('rejects an unknown gender', () => {
        const user = new User({ email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A', gender: 'not-a-real-option' });
        expect(user.validateSync().errors.gender).toBeDefined();
    });

    test('rejects an unknown enrollment status', () => {
        const user = new User({ email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A', enrollmentStatus: 'On Leave' });
        expect(user.validateSync().errors.enrollmentStatus).toBeDefined();
    });

    test('phone, gender, birthdate, and enrollmentStatus are all optional', () => {
        const user = new User({ email: 'a@dlsu.edu.ph', passwordHashed: 'x', name: 'A' });
        expect(user.validateSync()).toBeUndefined();
    });
});

describe('Audit Logging - schema validation and append-only behavior', () => {
    test('valid audit log entry passes validation', () => {
        const log = new AuditLog({
            userId: oid(), userRole: 'OVPERI_Admin', action: 'opportunity_created',
            targetType: 'Opportunity', targetId: oid()
        });
        expect(log.validateSync()).toBeUndefined();
    });

    test('allowed action validation: rejects an action outside the enum', () => {
        const log = new AuditLog({
            userId: oid(), userRole: 'OVPERI_Admin', action: 'opportunity_hacked',
            targetType: 'Opportunity', targetId: oid()
        });
        expect(log.validateSync().errors.action).toBeDefined();
    });

    test('user role recording: accepts Student now that student-initiated actions are logged', () => {
        const log = new AuditLog({
            userId: oid(), userRole: 'Student', action: 'application_submitted',
            targetType: 'Application', targetId: oid()
        });
        expect(log.validateSync()).toBeUndefined();
    });

    test('user role recording: rejects a role outside Student/OVPERI_Admin/System_Admin', () => {
        const log = new AuditLog({
            userId: oid(), userRole: 'Guest', action: 'opportunity_created',
            targetType: 'Opportunity', targetId: oid()
        });
        expect(log.validateSync().errors.userRole).toBeDefined();
    });

    test('target mapping: accepts User and Document alongside Opportunity/Application', () => {
        const userTargeted = new AuditLog({
            userId: oid(), userRole: 'System_Admin', action: 'user_deactivated',
            targetType: 'User', targetId: oid()
        });
        const documentTargeted = new AuditLog({
            userId: oid(), userRole: 'Student', action: 'document_uploaded',
            targetType: 'Document', targetId: oid()
        });
        expect(userTargeted.validateSync()).toBeUndefined();
        expect(documentTargeted.validateSync()).toBeUndefined();
    });

    test('target mapping: rejects a targetType outside the known set', () => {
        const log = new AuditLog({
            userId: oid(), userRole: 'OVPERI_Admin', action: 'opportunity_created',
            targetType: 'Comment', targetId: oid()
        });
        expect(log.validateSync().errors.targetType).toBeDefined();
    });

    test('append-only behavior: updateOne is blocked', async () => {
        await expect(AuditLog.updateOne({}, { $set: { action: 'opportunity_deleted' } }))
            .rejects.toThrow('Audit Log records are append-only and cannot be updated or deleted.');
    });

    test('append-only behavior: deleteOne is blocked', async () => {
        await expect(AuditLog.deleteOne({}))
            .rejects.toThrow('Audit Log records are append-only and cannot be updated or deleted.');
    });

    test('append-only behavior: findOneAndUpdate is blocked', async () => {
        await expect(AuditLog.findOneAndUpdate({}, { $set: { action: 'opportunity_deleted' } }))
            .rejects.toThrow('Audit Log records are append-only and cannot be updated or deleted.');
    });
});
