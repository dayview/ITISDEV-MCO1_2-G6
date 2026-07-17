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

  // Mirrors ALLOWED_TRANSITIONS in server/lib/applications.js. The admin action controls
  // are derived from this map so the UI can only ever offer a legal next stage.
  const ALLOWED_TRANSITIONS = {
    submitted: ['under-review', 'rejected'],
    'under-review': ['nominated', 'rejected'],
    nominated: ['accepted', 'rejected'],
    accepted: [],
    rejected: []
  };

  function getAllowedTransitions(status) {
    return ALLOWED_TRANSITIONS[status] || [];
  }

  function canTransition(from, to) {
    return getAllowedTransitions(from).includes(to);
  }

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

  return {
    STATUS_CONFIG,
    UNKNOWN_STATUS,
    FILTERS,
    ALLOWED_TRANSITIONS,
    getStatusConfig,
    getStatusLabel,
    getStatusGroup,
    getStatusProgress,
    getAllowedTransitions,
    canTransition,
    countByFilter,
    filterApplications
  };
});
