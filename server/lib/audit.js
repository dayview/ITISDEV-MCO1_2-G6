const ALLOWED_AUDIT_ACTIONS = [
    'opportunity_created',
    'opportunity_updated',
    'opportunity_deleted',
    'opportunity_published',
    'opportunity_closed',
    'application_status_changed',
    'application_bulk_status_changed',
    'user_role_changed',
    'user_deactivated',
    'user_registered',
    'user_login',
    'user_logout',
    'user_profile_updated',
    'document_uploaded',
    'document_deleted',
    'document_verified',
    'document_rejected',
    'application_submitted',
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

// Builds the Mongo filter for the audit log viewer. `actorIds`, when provided (already
// resolved from an actor name/email search by the caller), narrows results to those
// users; it takes precedence over a raw `userId` since a search implies the exact id
// is no longer known.
const buildAuditLogQuery = ({ action, targetType, userId, actorIds, from, to } = {}) => {
    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    if (Array.isArray(actorIds)) {
        query.userId = { $in: actorIds };
    } else if (userId) {
        query.userId = userId;
    }

    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }

    return query;
};

module.exports = { ALLOWED_AUDIT_ACTIONS, buildAuditEntry, determineOpportunityUpdateAction, buildAuditLogQuery };
