(function() {
  const container = document.getElementById('quick-admin-applications');
  if (!container || !window.GEMSApplicationStore) return;
  const applications = window.GEMSApplicationStore.getApplications();
  if (!applications.length) return;

  const pendingValue = document.querySelector('.admin-page .stat-card:first-child .stat-card__value');
  const allPill = document.querySelector('.admin-page .filter-pills .pill:first-child');
  if (pendingValue) pendingValue.textContent = String(17 + applications.length);
  if (allPill) allPill.textContent = `All · ${17 + applications.length}`;

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  applications.forEach(application => {
    const submitted = new Date(application.submittedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const row = document.createElement('div');
    row.className = 'table-row admin-quick-row';
    row.setAttribute('role', 'row');
    row.innerHTML = `
      <div class="table-checkbox" aria-label="Not selected" role="checkbox" aria-checked="false"></div>
      <div><div class="table-cell-primary">${escapeHtml(application.student.name)}</div><div class="table-cell-secondary">${escapeHtml(application.student.studentId)} · ${escapeHtml(application.student.college)}</div></div>
      <div><div class="table-cell-primary">${escapeHtml(application.programName)}</div><div class="table-cell-secondary">${escapeHtml(application.hostInstitution)}</div></div>
      <div class="table-cell">${escapeHtml(application.student.cgpa)}</div>
      <div class="table-cell">${submitted}</div>
      <div>
        <span class="chip chip--green"><span class="chip__dot"></span>Complete</span>
        <details class="admin-bundle-details">
          <summary>View bundle (${application.bundle.length})</summary>
          <ul>${application.bundle.map(document => `<li>${escapeHtml(document.fileName)}</li>`).join('')}</ul>
        </details>
      </div>
      <div><span class="chip chip--blue"><span class="chip__dot"></span>Submitted</span></div>
    `;
    container.appendChild(row);
  });
})();
