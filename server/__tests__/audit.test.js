const { ALLOWED_AUDIT_ACTIONS, buildAuditEntry, determineOpportunityUpdateAction } = require('../lib/audit');

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
