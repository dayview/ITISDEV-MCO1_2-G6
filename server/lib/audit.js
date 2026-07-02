const ALLOWED_AUDIT_ACTIONS = [
    'opportunity_created',
    'opportunity_updated',
    'opportunity_deleted',
    'opportunity_published',
    'opportunity_closed',
    'application_status_changed',
    'application_bulk_status_changed',
];

const buildAuditEntry = ({ userId, userRole, action, targetType, targetId, targetLabel, changes = [], ip }) => {
    if (!ALLOWED_AUDIT_ACTIONS.includes(action)) {
        throw new Error(`Invalid audit action: ${action}`);
    }
    return { userId, userRole, action, targetType, targetId, targetLabel, changes, ip };
};

const determineOpportunityUpdateAction = (previousStatus, newStatus) => {
    const statusChanged = previousStatus !== undefined && previousStatus !== newStatus;
    if (statusChanged && newStatus === 'published') return 'opportunity_published';
    if (statusChanged && newStatus === 'closed') return 'opportunity_closed';
    return 'opportunity_updated';
};

module.exports = { ALLOWED_AUDIT_ACTIONS, buildAuditEntry, determineOpportunityUpdateAction };
