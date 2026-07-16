(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DocumentReviewUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function validateReview(status, reason) {
    if (!['verified', 'rejected'].includes(status)) return 'Choose verified or rejected.';
    if (status === 'rejected' && !String(reason || '').trim()) return 'A rejection reason is required.';
    if (String(reason || '').trim().length > 500) return 'The rejection reason must be 500 characters or fewer.';
    return '';
  }

  function statusLabel(status) {
    return ({ pending: 'Pending Review', verified: 'Verified', rejected: 'Rejected' })[status] || status;
  }

  return { validateReview, statusLabel };
});
