(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GEMSApplicationStatus = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // Mirrors the Application schema's `status` enum in server/models/Applications.js.
  // There is no "draft" status in the backend — applications only exist once submitted.
  const STATUS_CONFIG = {
    submitted: { label: 'Submitted', group: 'active', progress: 40 },
    'under-review': { label: 'Under Review', group: 'active', progress: 60 },
    nominated: { label: 'Nominated', group: 'active', progress: 80 },
    accepted: { label: 'Accepted', group: 'completed', progress: 100 },
    rejected: { label: 'Not Selected', group: 'completed', progress: 100 }
  };

  const UNKNOWN_STATUS = { label: 'Unknown status', group: 'unknown', progress: 0 };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' }
  ];

  const STATUS_TRANSITIONS = {
    submitted: ['under-review', 'nominated', 'rejected'],
    'under-review': ['nominated', 'rejected'],
    nominated: ['accepted', 'rejected'],
    accepted: [],
    rejected: []
  };

  const COMPLETE_DOCUMENT_STATUSES = ['nominated', 'accepted'];

  function getStatusConfig(status) {
    return STATUS_CONFIG[status] || UNKNOWN_STATUS;
  }

  function getStatusLabel(status) {
    return getStatusConfig(status).label;
  }

  function getStatusGroup(status) {
    return getStatusConfig(status).group;
  }

  function getStatusProgress(status) {
    return getStatusConfig(status).progress;
  }

  function countByFilter(applications) {
    const counts = { all: applications.length, active: 0, completed: 0, unknown: 0 };
    applications.forEach(application => {
      const group = getStatusGroup(application.status);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }

  function filterApplications(applications, filterKey) {
    if (!filterKey || filterKey === 'all') return applications.slice();
    return applications.filter(application => getStatusGroup(application.status) === filterKey);
  }

  function canTransition(application, nextStatus) {
    if (!application || !STATUS_TRANSITIONS[application.status]?.includes(nextStatus)) return false;
    return !COMPLETE_DOCUMENT_STATUSES.includes(nextStatus) || application.documentsStatus === 'complete';
  }

  function getPrimaryAdminAction(application) {
    if (application?.status === 'nominated' && canTransition(application, 'accepted')) {
      return { status: 'accepted', label: 'Accept' };
    }
    if (canTransition(application, 'nominated')) {
      return { status: 'nominated', label: 'Nominate' };
    }
    return null;
  }

  return {
    STATUS_CONFIG,
    UNKNOWN_STATUS,
    FILTERS,
    STATUS_TRANSITIONS,
    getStatusConfig,
    getStatusLabel,
    getStatusGroup,
    getStatusProgress,
    countByFilter,
    filterApplications,
    canTransition,
    getPrimaryAdminAction
  };
});
