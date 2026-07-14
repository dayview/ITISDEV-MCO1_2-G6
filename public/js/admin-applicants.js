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

  const statusLabels = {
    submitted: 'Pending Review',
    'under-review': 'Needs Revision',
    nominated: 'Approved',
    accepted: 'Approved',
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
        <div class="applicant-row-actions" data-label="Actions">
          <button type="button" class="applicant-icon-action applicant-icon-action--approve" data-action="approve" title="Approve" aria-label="Approve ${escapeHtml(applicant.name)}">&#10003;</button>
          <button type="button" class="applicant-icon-action applicant-icon-action--reject" data-action="reject" title="Reject" aria-label="Reject ${escapeHtml(applicant.name)}">&times;</button>
          <button type="button" class="program-overflow__trigger" data-action="more" aria-label="More actions for ${escapeHtml(applicant.name)}">&#8942;</button>
        </div>
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
        alert(`Application for ${applicant.name}: ${applicant.statusLabel}.`);
        return;
      }
      const status = button.dataset.action === 'approve' ? 'nominated' : 'rejected';
      await updateStatus(applicant.id, status);
    }));
  }

  function updateBulkBar() {
    const bar = document.getElementById('applicant-bulk-bar');
    bar.hidden = selected.size === 0;
    document.getElementById('selected-applicant-count').textContent = String(selected.size);
    const visible = getMatches().slice((currentPage - 1) * pageSize, currentPage * pageSize);
    document.getElementById('select-all-applicants').checked = visible.length > 0 && visible.every(item => selected.has(item.id));
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
      documents: displayDocuments(item.documents_status)
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

  loadApplicants().catch(error => {
    document.querySelector('.applicant-table').hidden = true;
    document.querySelector('.applicant-pagination').hidden = true;
    const empty = document.getElementById('applicant-empty-state');
    empty.hidden = false;
    empty.querySelector('h3').textContent = 'Unable to load applicants.';
    empty.querySelector('p').textContent = error.message;
  });
})();
