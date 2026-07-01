(function() {
  const baseApplicants = [
    ['Leah Pineda', '2023-04589', 'NUS Exchange Semester', 'National University of Singapore', '2026-06-24', 'Pending Review', 'Complete'],
    ['Marco Villanueva', '2022-11842', 'Chung-Ang Summer Program', 'Chung-Ang University', '2026-06-23', 'Approved', 'Complete'],
    ['Sofia Reyes', '2023-07114', 'Kyoto Research Exchange', 'Kyoto University', '2026-06-22', 'Needs Revision', 'Incomplete'],
    ['Andre Lim', '2022-09431', 'Melbourne Global Semester', 'University of Melbourne', '2026-06-21', 'Pending Review', 'Complete'],
    ['Camille Santos', '2023-02176', 'NUS Exchange Semester', 'National University of Singapore', '2026-06-20', 'Rejected', 'Complete'],
    ['Miguel Tan', '2022-15680', 'Chung-Ang Summer Program', 'Chung-Ang University', '2026-06-19', 'Approved', 'Complete'],
    ['Bianca Cruz', '2023-08220', 'Kyoto Research Exchange', 'Kyoto University', '2026-06-18', 'Pending Review', 'Incomplete'],
    ['Paolo Garcia', '2021-14703', 'Melbourne Global Semester', 'University of Melbourne', '2026-06-17', 'Approved', 'Complete'],
    ['Isabel Mendoza', '2023-06218', 'NUS Exchange Semester', 'National University of Singapore', '2026-06-16', 'Pending Review', 'Complete'],
    ['Gabriel Sy', '2022-13451', 'Chung-Ang Summer Program', 'Chung-Ang University', '2026-06-15', 'Needs Revision', 'Incomplete'],
    ['Nina Flores', '2023-03317', 'Kyoto Research Exchange', 'Kyoto University', '2026-06-14', 'Approved', 'Complete'],
    ['Luis Navarro', '2022-12609', 'Melbourne Global Semester', 'University of Melbourne', '2026-06-13', 'Rejected', 'Complete']
  ];

  const applicants = Array.from({ length: 28 }, (_, index) => {
    const template = baseApplicants[index % baseApplicants.length];
    return {
      id: index + 1,
      name: index < baseApplicants.length ? template[0] : `${template[0]} ${index + 1}`,
      studentId: index < baseApplicants.length ? template[1] : `2023-${String(4600 + index).padStart(5, '0')}`,
      program: template[2],
      university: template[3],
      submitted: new Date(new Date(`${template[4]}T00:00:00`).getTime() - Math.floor(index / baseApplicants.length) * 86400000 * 12).toISOString().slice(0, 10),
      status: template[5],
      documents: template[6]
    };
  });

  const pageSize = 8;
  let currentPage = 1;
  const selected = new Set();
  const body = document.getElementById('applicant-table-body');
  const search = document.getElementById('applicant-search');
  const statusFilter = document.getElementById('applicant-status-filter');
  const documentsFilter = document.getElementById('applicant-documents-filter');
  const programFilter = document.getElementById('applicant-program-filter');
  const sort = document.getElementById('applicant-sort');

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  function getMatches() {
    const query = search.value.trim().toLowerCase();
    return applicants.filter(applicant => {
      const haystack = `${applicant.name} ${applicant.studentId} ${applicant.program} ${applicant.university}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!statusFilter.value || applicant.status === statusFilter.value)
        && (!documentsFilter.value || applicant.documents === documentsFilter.value)
        && (!programFilter.value || applicant.program === programFilter.value);
    }).sort((a, b) => {
      if (sort.value === 'oldest') return new Date(a.submitted) - new Date(b.submitted);
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (sort.value === 'status') return a.status.localeCompare(b.status);
      return new Date(b.submitted) - new Date(a.submitted);
    });
  }

  function formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function initials(name) {
    return name.split(' ').map(part => part[0]).slice(0, 2).join('');
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
      <article class="applicant-row" role="row" data-applicant-id="${applicant.id}">
        <label class="program-checkbox"><input type="checkbox" value="${applicant.id}" ${selected.has(applicant.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(applicant.name)}"><span></span></label>
        <div class="applicant-cell applicant-cell--student" data-label="Student"><span class="applicant-avatar">${escapeHtml(initials(applicant.name))}</span><strong>${escapeHtml(applicant.name)}</strong></div>
        <div class="applicant-cell" data-label="Student ID">${escapeHtml(applicant.studentId)}</div>
        <div class="applicant-cell" data-label="Program"><strong>${escapeHtml(applicant.program)}</strong></div>
        <div class="applicant-cell" data-label="University">${escapeHtml(applicant.university)}</div>
        <div class="applicant-cell" data-label="Submitted Date">${formatDate(applicant.submitted)}</div>
        <div class="applicant-cell" data-label="Status">${escapeHtml(applicant.status)}</div>
        <div class="applicant-cell" data-label="Documents"><span class="applicant-documents applicant-documents--${applicant.documents.toLowerCase()}">${escapeHtml(applicant.documents)}</span></div>
        <div class="applicant-row-actions" data-label="Actions">
          <a class="applicant-view-link" href="application-details.html">View Application</a>
          <button type="button" class="applicant-icon-action applicant-icon-action--approve" data-action="approve" title="Approve" aria-label="Approve ${escapeHtml(applicant.name)}">&#10003;</button>
          <button type="button" class="applicant-icon-action applicant-icon-action--reject" data-action="reject" title="Reject" aria-label="Reject ${escapeHtml(applicant.name)}">&times;</button>
          <button type="button" class="program-overflow__trigger" data-action="more" aria-label="More actions for ${escapeHtml(applicant.name)}">&#8942;</button>
        </div>
      </article>
    `).join('');

    document.getElementById('applicant-result-count').textContent = matches.length
      ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, matches.length)} of ${matches.length} applicants`
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
      const id = Number(checkbox.value);
      if (checkbox.checked) selected.add(id);
      else selected.delete(id);
      updateBulkBar();
    }));
    body.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      const applicant = applicants.find(item => item.id === Number(button.closest('.applicant-row').dataset.applicantId));
      if (button.dataset.action === 'more') alert(`More actions for ${applicant.name}.`);
      else alert(`${button.dataset.action === 'approve' ? 'Approved' : 'Rejected'} ${applicant.name}.`);
    }));
  }

  function updateBulkBar() {
    const bar = document.getElementById('applicant-bulk-bar');
    bar.hidden = selected.size === 0;
    document.getElementById('selected-applicant-count').textContent = String(selected.size);
    const visible = getMatches().slice((currentPage - 1) * pageSize, currentPage * pageSize);
    document.getElementById('select-all-applicants').checked = visible.length > 0 && visible.every(item => selected.has(item.id));
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
    alert(`${button.textContent.trim()} for ${selected.size} applicant${selected.size === 1 ? '' : 's'}.`);
  }));

  render();
})();
