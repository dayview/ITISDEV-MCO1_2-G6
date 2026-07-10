(async function() {
  const container = document.getElementById('quick-application-list');
  if (!container) return;

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  container.innerHTML = '<p class="post-list-empty">Loading your recent applications...</p>';

  let response;
  try {
    response = await fetch('/api/applications/my');
  } catch (error) {
    container.innerHTML = '<div class="card"><div class="card__title">Unable to load your applications.</div><div class="card__subtitle">Please check your connection and try again.</div></div>';
    return;
  }

  if (response.status === 401) {
    container.hidden = true;
    return;
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    container.innerHTML = '<div class="card"><div class="card__title">Unexpected response from the server.</div></div>';
    return;
  }

  if (!response.ok || !result.success) {
    container.innerHTML = `<div class="card"><div class="card__title">Unable to load your applications.</div><div class="card__subtitle">${escapeHtml(result.error || `HTTP ${response.status}`)}</div></div>`;
    return;
  }

  const applications = Array.isArray(result.data) ? result.data : [];
  if (!applications.length) {
    container.hidden = true;
    return;
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
