(async function() {
  const container = document.getElementById('quick-application-list');
  if (!container || !window.GEMSApplicationStore) return;

  let applications = window.GEMSApplicationStore.getApplications();
  try {
    const response = await fetch('/api/applications/my');
    const result = await response.json();
    if (response.ok && result.success) {
      applications = result.data;
    }
  } catch (error) {
    console.warn('Using local application fallback:', error);
  }
  if (!applications.length) {
    container.hidden = true;
    return;
  }

  const filterPills = document.querySelectorAll('.applications-page .filter-pills .pill');
  if (filterPills[0]) filterPills[0].textContent = `All · ${5 + applications.length}`;
  if (filterPills[1]) filterPills[1].textContent = `Active · ${3 + applications.length}`;

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  container.innerHTML = applications.map(application => {
    const initials = String(application.hostInstitution || '').split(' ').map(word => word[0]).slice(0, 3).join('') || 'OV';
    const submitted = new Date(application.submittedAt || application.submittedDate).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    return `
      <article class="tracker-card quick-application-card">
        <div class="tracker-card__header">
          <div class="tracker-icon">${escapeHtml(initials)}</div>
          <div class="tracker-card__info">
            <div class="tracker-name">${escapeHtml(application.programName)}</div>
            <div class="tracker-host">${escapeHtml(application.hostInstitution)}</div>
            <div class="tracker-submitted">submitted ${submitted} via 1-Click Apply</div>
          </div>
          <span class="chip chip--blue"><span class="chip__dot"></span>${escapeHtml(application.status || 'submitted')}</span>
        </div>
        <div class="progress-steps" role="list" aria-label="Application progress">
          <div class="step-col" role="listitem"><div class="step-dot step-dot--current">&#10003;</div><div class="step-label step-label--current">Submitted</div></div>
          <div class="step-wrap"><div class="step-line step-line--pending"></div></div>
          <div class="step-col" role="listitem"><div class="step-dot step-dot--pending">&nbsp;</div><div class="step-label step-label--pending">Under Review</div></div>
          <div class="step-wrap"><div class="step-line step-line--pending"></div></div>
          <div class="step-col" role="listitem"><div class="step-dot step-dot--pending">&nbsp;</div><div class="step-label step-label--pending">Nominated</div></div>
          <div class="step-wrap"><div class="step-line step-line--pending"></div></div>
          <div class="step-col" role="listitem"><div class="step-dot step-dot--pending">&nbsp;</div><div class="step-label step-label--pending">Decision</div></div>
        </div>
        <details class="application-bundle">
          <summary>View submitted document bundle (${application.bundle?.length || 0})</summary>
          <div class="application-bundle__files">
            ${(application.bundle || []).map(document => `
              <div><span aria-hidden="true">&#10003;</span><p><strong>${escapeHtml(document.requirement)}</strong><small>${escapeHtml(document.fileName)}</small></p></div>
            `).join('')}
          </div>
          <p class="application-bundle__email">Documents status: ${escapeHtml(application.documentsStatus || 'incomplete')}</p>
        </details>
      </article>
    `;
  }).join('');
})();
