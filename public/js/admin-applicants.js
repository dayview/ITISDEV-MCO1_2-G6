(function() {
  const pageSize = 8;
  let currentPage = 1;
  let applicants = [];
  const selected = new Set();
  const body = document.getElementById('applicant-table-body');
  const search = document.getElementById('applicant-search');
  const statusFilter = document.getElementById('applicant-status-filter');
  const documentsFilter = document.getElementById('applicant-documents-filter');
  const programFilter = document.getElementById('applicant-program-filter');
  const sort = document.getElementById('applicant-sort');
  const reviewModal = document.getElementById('document-review-modal');
  const reviewList = document.getElementById('document-review-list');
  const reviewMessage = document.getElementById('document-review-message');
  let reviewingApplicationId = '';

  const statusLabels = {
    submitted: 'Pending Review',
    'under-review': 'Needs Revision',
    nominated: 'Nominated',
    accepted: 'Accepted',
    rejected: 'Rejected'
  };

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  function displayStatus(status) {
    return statusLabels[status] || status;
  }

  function displayDocuments(status) {
    return status === 'complete' ? 'Complete' : 'Incomplete';
  }

  function getMatches() {
    const query = search.value.trim().toLowerCase();
    return applicants.filter(applicant => {
      const haystack = `${applicant.name} ${applicant.studentId} ${applicant.program} ${applicant.university}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!statusFilter.value || applicant.statusLabel === statusFilter.value)
        && (!documentsFilter.value || applicant.documents === documentsFilter.value)
        && (!programFilter.value || applicant.program === programFilter.value);
    }).sort((a, b) => {
      if (sort.value === 'oldest') return new Date(a.submitted) - new Date(b.submitted);
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (sort.value === 'status') return a.statusLabel.localeCompare(b.statusLabel);
      return new Date(b.submitted) - new Date(a.submitted);
    });
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function initials(name) {
    return String(name || '?').split(' ').map(part => part[0]).slice(0, 2).join('');
  }

  function renderApplicantActions(applicant) {
    const primary = GEMSApplicationStatus.getPrimaryAdminAction({
      status: applicant.status,
      documentsStatus: applicant.documentsStatus
    });
    const canReject = GEMSApplicationStatus.canTransition({
      status: applicant.status,
      documentsStatus: applicant.documentsStatus
    }, 'rejected');
    const primaryButton = primary
      ? `<button type="button" class="applicant-icon-action applicant-icon-action--approve" data-action="status" data-status="${primary.status}" title="${primary.label}" aria-label="${primary.label} ${escapeHtml(applicant.name)}">&#10003;</button>`
      : '';
    const rejectButton = canReject
      ? `<button type="button" class="applicant-icon-action applicant-icon-action--reject" data-action="status" data-status="rejected" title="Reject" aria-label="Reject ${escapeHtml(applicant.name)}">&times;</button>`
      : '';
    const finalLabel = !primary && !canReject
      ? '<span class="applicant-action-final">Final</span>'
      : '';

    return `${primaryButton}${rejectButton}${finalLabel}<button type="button" class="program-overflow__trigger" data-action="more" aria-label="More actions for ${escapeHtml(applicant.name)}">&#8942;</button>`;
  }

  function updateProgramFilter() {
    const current = programFilter.value;
    const programs = [...new Set(applicants.map(item => item.program).filter(Boolean))].sort();
    programFilter.innerHTML = `<option value="">All programs</option>${programs.map(program => `<option>${escapeHtml(program)}</option>`).join('')}`;
    if (programs.includes(current)) programFilter.value = current;
  }

  function updateSummary() {
    const cards = document.querySelectorAll('.applicant-summary-grid .stat-card__value');
    if (cards[0]) cards[0].textContent = applicants.length;
    if (cards[1]) cards[1].textContent = applicants.filter(item => item.status === 'submitted').length;
    if (cards[2]) cards[2].textContent = applicants.filter(item => ['nominated', 'accepted'].includes(item.status)).length;
    if (cards[3]) cards[3].textContent = applicants.filter(item => item.status === 'rejected').length;
  }

  function render() {
    const matches = getMatches();
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const visible = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const table = document.querySelector('.applicant-table');
    const pagination = document.querySelector('.applicant-pagination');
    const empty = document.getElementById('applicant-empty-state');

    table.hidden = visible.length === 0;
    pagination.hidden = visible.length === 0;
    empty.hidden = visible.length !== 0;
    body.innerHTML = visible.map(applicant => `
      <article class="applicant-row" role="row" data-applicant-id="${escapeHtml(applicant.id)}">
        <label class="program-checkbox"><input type="checkbox" value="${escapeHtml(applicant.id)}" ${selected.has(applicant.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(applicant.name)}"><span></span></label>
        <div class="applicant-cell applicant-cell--student" data-label="Student"><span class="applicant-avatar">${escapeHtml(initials(applicant.name))}</span><strong>${escapeHtml(applicant.name)}</strong></div>
        <div class="applicant-cell" data-label="Student ID">${escapeHtml(applicant.studentId)}</div>
        <div class="applicant-cell" data-label="Program"><strong>${escapeHtml(applicant.program)}</strong></div>
        <div class="applicant-cell" data-label="University">${escapeHtml(applicant.university)}</div>
        <div class="applicant-cell" data-label="Submitted Date">${escapeHtml(formatDate(applicant.submitted))}</div>
        <div class="applicant-cell" data-label="Status">${escapeHtml(applicant.statusLabel)}</div>
        <div class="applicant-cell" data-label="Documents"><span class="applicant-documents applicant-documents--${applicant.documents.toLowerCase()}">${escapeHtml(applicant.documents)}</span></div>
        <div class="applicant-row-actions" data-label="Actions">${renderApplicantActions(applicant)}</div>
      </article>
    `).join('');

    document.getElementById('applicant-result-count').textContent = matches.length
      ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, matches.length)} of ${matches.length} applicants`
      : 'No applicants match the current filters';
    document.getElementById('applicant-page-summary').textContent = `Page ${currentPage} of ${totalPages}`;
    renderPages(totalPages);
    bindRows();
    updateBulkBar();
  }

  function renderPages(totalPages) {
    const pages = document.getElementById('applicant-pages');
    pages.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pagination-page${page === currentPage ? ' pagination-page--active' : ''}`;
      button.textContent = String(page);
      button.addEventListener('click', () => { currentPage = page; render(); });
      pages.appendChild(button);
    }
    document.getElementById('applicant-prev').disabled = currentPage === 1;
    document.getElementById('applicant-next').disabled = currentPage === totalPages;
  }

  function bindRows() {
    body.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.addEventListener('change', () => {
      const id = checkbox.value;
      if (checkbox.checked) selected.add(id);
      else selected.delete(id);
      updateBulkBar();
    }));
    body.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
      const applicant = applicants.find(item => item.id === button.closest('.applicant-row').dataset.applicantId);
      if (button.dataset.action === 'more') {
        await openDocumentReview(applicant);
        return;
      }
      await updateStatus(applicant.id, button.dataset.status);
    }));
  }

  function showReviewMessage(message, isError) {
    reviewMessage.hidden = !message;
    reviewMessage.textContent = message || '';
    reviewMessage.classList.toggle('review-modal__message--error', Boolean(isError));
  }

  function closeDocumentReview() {
    reviewModal.hidden = true;
    reviewingApplicationId = '';
    document.body.classList.remove('review-modal-open');
  }

  async function openDocumentReview(applicant) {
    reviewingApplicationId = applicant.id;
    document.getElementById('document-review-title').textContent = `${applicant.name}'s documents`;
    document.getElementById('document-review-subtitle').textContent = `${applicant.program} · ${applicant.studentId}`;
    reviewList.innerHTML = '<p class="post-list-empty">Loading documents...</p>';
    showReviewMessage('');
    reviewModal.hidden = false;
    document.body.classList.add('review-modal-open');
    const response = await fetch(`/api/applications/${encodeURIComponent(applicant.id)}/documents`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      reviewList.innerHTML = '';
      showReviewMessage(result.error || `HTTP ${response.status}`, true);
      return;
    }
    renderReviewDocuments(result.data || []);
  }

  function renderReviewDocuments(documents) {
    if (!documents.length) {
      reviewList.innerHTML = '<p class="post-list-empty">No documents are attached to this application.</p>';
      return;
    }
    reviewList.innerHTML = documents.map(document => `
      <article class="review-document" data-document-id="${escapeHtml(document.id)}">
        <div class="review-document__summary">
          <div><strong>${escapeHtml(document.originalFileName)}</strong><span>${escapeHtml(document.type)} · ${escapeHtml(DocumentReviewUI.statusLabel(document.status))}</span></div>
          <div class="review-document__links">
            <a class="btn btn--secondary" href="${escapeHtml(document.fileUrl)}" target="_blank" rel="noopener">View</a>
            <a class="btn btn--secondary" href="${escapeHtml(document.fileUrl)}?download=1" download>Download</a>
          </div>
        </div>
        ${document.rejectionReason ? `<p class="review-document__reason"><strong>Rejection reason:</strong> ${escapeHtml(document.rejectionReason)}</p>` : ''}
        <label class="review-document__reason-field"><span>Reason (required when rejecting)</span><textarea maxlength="500" rows="2" placeholder="Explain what the student needs to correct..."></textarea></label>
        <div class="review-document__actions">
          <button type="button" class="btn btn--secondary" data-review-status="rejected">Reject</button>
          <button type="button" class="btn btn--primary" data-review-status="verified">Verify</button>
        </div>
      </article>
    `).join('');
    reviewList.querySelectorAll('[data-review-status]').forEach(button => button.addEventListener('click', () => reviewDocument(button)));
  }

  async function reviewDocument(button) {
    const card = button.closest('[data-document-id]');
    const status = button.dataset.reviewStatus;
    const rejectionReason = card.querySelector('textarea').value;
    const validationError = DocumentReviewUI.validateReview(status, rejectionReason);
    if (validationError) return showReviewMessage(validationError, true);
    showReviewMessage('Saving review...');
    const response = await fetch(`/api/applications/${encodeURIComponent(reviewingApplicationId)}/documents/${encodeURIComponent(card.dataset.documentId)}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionReason })
    });
    const result = await response.json();
    if (!response.ok || !result.success) return showReviewMessage(result.error || `HTTP ${response.status}`, true);
    const applicant = applicants.find(item => item.id === reviewingApplicationId);
    showReviewMessage(status === 'verified' ? 'Document verified.' : 'Document rejected. The reason is now visible to the student.');
    await loadApplicants();
    if (applicant) await openDocumentReview(applicant);
  }

  function updateBulkBar() {
    const bar = document.getElementById('applicant-bulk-bar');
    bar.hidden = selected.size === 0;
    document.getElementById('selected-applicant-count').textContent = String(selected.size);
    const visible = getMatches().slice((currentPage - 1) * pageSize, currentPage * pageSize);
    document.getElementById('select-all-applicants').checked = visible.length > 0 && visible.every(item => selected.has(item.id));
    const selectedApplicants = applicants.filter(applicant => selected.has(applicant.id));
    const completeSelection = selectedApplicants.length === selected.size;
    const nominateButton = document.querySelector('[data-applicant-bulk="approve"]');
    const rejectButton = document.querySelector('[data-applicant-bulk="reject"]');
    const canNominate = selected.size > 0 && completeSelection && selectedApplicants.every(applicant => GEMSApplicationStatus.canTransition({
      status: applicant.status,
      documentsStatus: applicant.documentsStatus
    }, 'nominated'));
    const canReject = selected.size > 0 && completeSelection && selectedApplicants.every(applicant => GEMSApplicationStatus.canTransition({
      status: applicant.status,
      documentsStatus: applicant.documentsStatus
    }, 'rejected'));

    nominateButton.disabled = !canNominate;
    nominateButton.title = canNominate ? 'Nominate selected applications' : 'Only complete Submitted or Under Review applications can be nominated';
    rejectButton.disabled = !canReject;
    rejectButton.title = canReject ? 'Reject selected applications' : 'Accepted and rejected applications are final';
  }

  async function updateStatus(id, status) {
    const response = await fetch(`/api/applications/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.error || `HTTP ${response.status}`);
      return;
    }
    await loadApplicants();
  }

  async function bulkStatus(status) {
    const selectedApplicants = applicants.filter(applicant => selected.has(applicant.id));
    const eligible = selectedApplicants.length === selected.size && selectedApplicants.every(applicant => (
      GEMSApplicationStatus.canTransition({
        status: applicant.status,
        documentsStatus: applicant.documentsStatus
      }, status)
    ));
    if (!selected.size || !eligible) {
      alert(status === 'nominated'
        ? 'Only complete Submitted or Under Review applications can be nominated.'
        : 'One or more selected applications cannot be rejected.');
      return;
    }
    const response = await fetch('/api/applications/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), status })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.error || `HTTP ${response.status}`);
      return;
    }
    selected.clear();
    await loadApplicants();
  }

  async function loadApplicants() {
    body.innerHTML = '<p class="post-list-empty">Loading applicants...</p>';
    const response = await fetch('/api/applications?pageSize=100');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
    applicants = (result.data || []).map(item => ({
      id: item.id,
      name: item.name,
      studentId: item.student_id,
      program: item.opp_name,
      university: item.institution,
      submitted: item.submitted_date,
      status: item.status,
      statusLabel: displayStatus(item.status),
      documents: displayDocuments(item.documents_status),
      documentsStatus: item.documents_status
    }));
    updateProgramFilter();
    updateSummary();
    render();
  }

  [search, statusFilter, documentsFilter, programFilter].forEach(control => control.addEventListener(control === search ? 'input' : 'change', () => {
    currentPage = 1;
    render();
  }));
  sort.addEventListener('change', () => { currentPage = 1; render(); });
  document.getElementById('applicant-filter-button').addEventListener('click', () => document.getElementById('applicant-filter-panel').classList.toggle('applicant-filter-panel--collapsed'));
  document.getElementById('select-all-applicants').addEventListener('change', event => {
    getMatches().slice((currentPage - 1) * pageSize, currentPage * pageSize).forEach(item => {
      if (event.target.checked) selected.add(item.id);
      else selected.delete(item.id);
    });
    render();
  });
  document.getElementById('applicant-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; render(); } });
  document.getElementById('applicant-next').addEventListener('click', () => { if (currentPage < Math.ceil(getMatches().length / pageSize)) { currentPage += 1; render(); } });
  document.getElementById('applicant-export').addEventListener('click', () => alert('Applicant export prepared.'));
  document.getElementById('applicant-batch-button').addEventListener('click', () => document.getElementById('applicant-bulk-bar').scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  document.querySelectorAll('[data-applicant-bulk]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.applicantBulk === 'approve') bulkStatus('nominated');
    else if (button.dataset.applicantBulk === 'reject') bulkStatus('rejected');
    else alert(`Export selected for ${selected.size} applicant${selected.size === 1 ? '' : 's'}.`);
  }));
  document.querySelectorAll('[data-close-review-modal]').forEach(button => button.addEventListener('click', closeDocumentReview));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !reviewModal.hidden) closeDocumentReview(); });

  loadApplicants().catch(error => {
    document.querySelector('.applicant-table').hidden = true;
    document.querySelector('.applicant-pagination').hidden = true;
    const empty = document.getElementById('applicant-empty-state');
    empty.hidden = false;
    empty.querySelector('h3').textContent = 'Unable to load applicants.';
    empty.querySelector('p').textContent = error.message;
  });
})();
