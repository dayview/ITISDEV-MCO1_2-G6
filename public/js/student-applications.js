(function() {
  const container = document.getElementById('quick-application-list');
  if (!container) return;

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  function statusLabel(status) {
    const labels = {
      submitted: 'Submitted',
      'under-review': 'Under Review',
      nominated: 'Nominated',
      accepted: 'Accepted',
      rejected: 'Rejected'
    };
    return labels[status] || status || 'Submitted';
  }

  function statusChip(status) {
    if (status === 'accepted') return 'chip--green';
    if (status === 'rejected') return 'chip--red';
    if (status === 'nominated' || status === 'under-review') return 'chip--blue';
    return 'chip--gray';
  }

  function renderApplications(applications) {
    document.querySelectorAll('.applications-page .tracker-card:not(.quick-application-card)').forEach(card => card.remove());
    const filterPills = document.querySelectorAll('.applications-page .filter-pills .pill');
    if (filterPills[0]) filterPills[0].textContent = `All · ${applications.length}`;
    if (filterPills[1]) filterPills[1].textContent = `Active · ${applications.filter(app => !['accepted', 'rejected'].includes(app.status)).length}`;

    if (!applications.length) {
      container.innerHTML = '<article class="tracker-card quick-application-card"><div class="tracker-name">No submitted applications yet.</div><div class="tracker-host">Apply from the Opportunity Catalog to start tracking here.</div></article>';
      return;
    }

    container.hidden = false;
    container.innerHTML = applications.map(application => {
      const initials = String(application.institution || application.opp_name || 'GEMS').split(' ').map(word => word[0]).slice(0, 3).join('');
      const submitted = new Date(application.submitted_date).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      return `
        <article class="tracker-card quick-application-card">
          <div class="tracker-card__header">
            <div class="tracker-icon">${escapeHtml(initials)}</div>
            <div class="tracker-card__info">
              <div class="tracker-name">${escapeHtml(application.opp_name)}</div>
              <div class="tracker-host">${escapeHtml(application.institution)}</div>
              <div class="tracker-submitted">submitted ${submitted}</div>
            </div>
            <span class="chip ${statusChip(application.status)}"><span class="chip__dot"></span>${escapeHtml(statusLabel(application.status))}</span>
          </div>
          <div class="progress-steps" role="list" aria-label="Application progress">
            <div class="step-col" role="listitem"><div class="step-dot step-dot--current">&#10003;</div><div class="step-label step-label--current">Submitted</div></div>
            <div class="step-wrap"><div class="step-line ${application.status !== 'submitted' ? 'step-line--done' : 'step-line--pending'}"></div></div>
            <div class="step-col" role="listitem"><div class="step-dot ${application.status !== 'submitted' ? 'step-dot--current' : 'step-dot--pending'}">&nbsp;</div><div class="step-label">Under Review</div></div>
            <div class="step-wrap"><div class="step-line ${['nominated', 'accepted'].includes(application.status) ? 'step-line--done' : 'step-line--pending'}"></div></div>
            <div class="step-col" role="listitem"><div class="step-dot ${['nominated', 'accepted'].includes(application.status) ? 'step-dot--current' : 'step-dot--pending'}">&nbsp;</div><div class="step-label">Nominated</div></div>
            <div class="step-wrap"><div class="step-line ${['accepted', 'rejected'].includes(application.status) ? 'step-line--done' : 'step-line--pending'}"></div></div>
            <div class="step-col" role="listitem"><div class="step-dot ${['accepted', 'rejected'].includes(application.status) ? 'step-dot--current' : 'step-dot--pending'}">&nbsp;</div><div class="step-label">Decision</div></div>
          </div>
          <details class="application-bundle">
            <summary>Document status: ${escapeHtml(application.documents_status || 'incomplete')}</summary>
            <p class="application-bundle__email">Application data is synced from MongoDB.</p>
          </details>
        </article>
      `;
    }).join('');
  }

  async function init() {
    container.innerHTML = '<article class="tracker-card quick-application-card"><div class="tracker-name">Loading applications...</div></article>';
    try {
      if (window.GEMSApplicationStore) await window.GEMSApplicationStore.refresh();
      const response = await fetch('/api/student/applications');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      renderApplications(result.data || []);
    } catch (error) {
      container.innerHTML = `<article class="tracker-card quick-application-card"><div class="tracker-name">Unable to load applications.</div><div class="tracker-host">${escapeHtml(error.message)}</div></article>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
