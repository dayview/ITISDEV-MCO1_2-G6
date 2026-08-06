const { ALLOWED_AUDIT_ACTIONS, buildAuditEntry, determineOpportunityUpdateAction, buildAuditLogQuery } = require('../lib/audit');

describe('Audit Logging - audit log creation', () => {
    test('builds an entry carrying all the fields provided', () => {
        const entry = buildAuditEntry({
            userId: 'u1', userRole: 'OVPERI_Admin', action: 'opportunity_created',
            targetType: 'Opportunity', targetId: 'opp1', targetLabel: 'NUS Exchange',
            changes: [{ field: 'status', from: 'draft', to: 'published' }], ip: '127.0.0.1'
        });
        expect(entry).toEqual({
            userId: 'u1', userRole: 'OVPERI_Admin', action: 'opportunity_created',
            targetType: 'Opportunity', targetId: 'opp1', targetLabel: 'NUS Exchange',
            changes: [{ field: 'status', from: 'draft', to: 'published' }], ip: '127.0.0.1'
        });
    });

    test('defaults changes to an empty array when omitted', () => {
        const entry = buildAuditEntry({ userId: 'u1', userRole: 'OVPERI_Admin', action: 'opportunity_created', targetType: 'Opportunity', targetId: 'opp1' });
        expect(entry.changes).toEqual([]);
    });
});

describe('Audit Logging - allowed action validation', () => {
    test.each(ALLOWED_AUDIT_ACTIONS)('accepts the known action "%s"', (action) => {
        expect(() => buildAuditEntry({ userId: 'u1', userRole: 'OVPERI_Admin', action, targetType: 'Opportunity', targetId: 'opp1' })).not.toThrow();
    });

    test('throws for an action outside the allowed list', () => {
        expect(() => buildAuditEntry({ userId: 'u1', userRole: 'OVPERI_Admin', action: 'opportunity_hacked', targetType: 'Opportunity', targetId: 'opp1' }))
            .toThrow('Invalid audit action: opportunity_hacked');
    });
});

describe('Audit Logging - target mapping', () => {
    test('records the targetType and targetId supplied', () => {
        const entry = buildAuditEntry({ userId: 'u1', userRole: 'OVPERI_Admin', action: 'application_status_changed', targetType: 'Application', targetId: 'app1' });
        expect(entry.targetType).toBe('Application');
        expect(entry.targetId).toBe('app1');
    });
});

describe('Audit Logging - user role recording', () => {
    test('records the acting user\'s role on the entry', () => {
        const entry = buildAuditEntry({ userId: 'u1', userRole: 'System_Admin', action: 'opportunity_deleted', targetType: 'Opportunity', targetId: 'opp1' });
        expect(entry.userRole).toBe('System_Admin');
    });
});

describe('Audit Logging - opportunity update action classification', () => {
    test('classifies a draft-to-published transition as opportunity_published', () => {
        expect(determineOpportunityUpdateAction('draft', 'published')).toBe('opportunity_published');
    });

    test('classifies a published-to-closed transition as opportunity_closed', () => {
        expect(determineOpportunityUpdateAction('published', 'closed')).toBe('opportunity_closed');
    });

    test('classifies a same-status edit as a plain opportunity_updated', () => {
        expect(determineOpportunityUpdateAction('published', 'published')).toBe('opportunity_updated');
    });

    test('classifies an update with no known previous status as opportunity_updated', () => {
        expect(determineOpportunityUpdateAction(undefined, 'published')).toBe('opportunity_updated');
    });
});

describe('Audit Logging - audit log viewer query building', () => {
    test('returns an empty filter when no criteria are given', () => {
        expect(buildAuditLogQuery()).toEqual({});
        expect(buildAuditLogQuery({})).toEqual({});
    });

    test('filters by action and targetType', () => {
        expect(buildAuditLogQuery({ action: 'user_role_changed', targetType: 'User' }))
            .toEqual({ action: 'user_role_changed', targetType: 'User' });
    });

    test('filters by a plain userId when no actorIds are supplied', () => {
        expect(buildAuditLogQuery({ userId: 'u1' })).toEqual({ userId: 'u1' });
    });

    test('prefers resolved actorIds over a raw userId', () => {
        expect(buildAuditLogQuery({ userId: 'u1', actorIds: ['u2', 'u3'] }))
            .toEqual({ userId: { $in: ['u2', 'u3'] } });
    });

    test('applies actorIds even when the array is empty, matching nothing', () => {
        expect(buildAuditLogQuery({ actorIds: [] })).toEqual({ userId: { $in: [] } });
    });

    test('builds a createdAt range from from/to', () => {
        const from = '2026-01-01';
        const to = '2026-01-31';
        expect(buildAuditLogQuery({ from, to })).toEqual({
            createdAt: { $gte: new Date(from), $lte: new Date(to) }
        });
    });

    test('builds a one-sided createdAt range when only from is given', () => {
        const from = '2026-01-01';
        expect(buildAuditLogQuery({ from })).toEqual({ createdAt: { $gte: new Date(from) } });
    });

    test('combines action, targetType, actorIds, and date range together', () => {
        const from = '2026-01-01';
        expect(buildAuditLogQuery({ action: 'document_deleted', targetType: 'Document', actorIds: ['u1'], from }))
            .toEqual({
                action: 'document_deleted',
                targetType: 'Document',
                userId: { $in: ['u1'] },
                createdAt: { $gte: new Date(from) }
            });
    });
});
