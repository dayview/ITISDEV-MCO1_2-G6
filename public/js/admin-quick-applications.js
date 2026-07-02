(function() {
  const container = document.getElementById('quick-admin-applications');
  if (!container) return;

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }

  function updateStats(stats) {
    const cards = document.querySelectorAll('.admin-page .stat-card');
    const values = [
      { value: stats.pending, sub: `${stats.urgent} urgent · deadline < 7d` },
      { value: stats.nominated, sub: 'Awaiting partner reply' },
      { value: stats.accepted, sub: 'Current accepted cohort' },
      { value: stats.livePrograms, sub: `Across ${stats.countries} countries` }
    ];
    cards.forEach((card, index) => {
      const value = card.querySelector('.stat-card__value');
      const sub = card.querySelector('.stat-card__sub');
      if (value && values[index]) value.textContent = values[index].value;
      if (sub && values[index]) sub.textContent = values[index].sub;
    });
    const allPill = document.querySelector('.admin-page .filter-pills .pill:first-child');
    const urgentPill = document.querySelector('.admin-page .filter-pills .pill:nth-child(2)');
    if (allPill) allPill.textContent = `All · ${stats.pending + stats.nominated + stats.accepted + stats.rejected}`;
    if (urgentPill) urgentPill.textContent = `Urgent · ${stats.urgent}`;
  }

  function renderRows(applications) {
    const staticRows = container.parentElement.querySelectorAll('.table-row:not(.admin-quick-row)');
    staticRows.forEach(row => row.remove());

    if (!applications.length) {
      container.innerHTML = '<div class="table-row admin-quick-row" role="row"><div></div><div><div class="table-cell-primary">No applications yet</div><div class="table-cell-secondary">Student submissions will appear here.</div></div><div></div><div></div><div></div><div></div><div></div></div>';
      return;
    }

    container.innerHTML = applications.slice(0, 8).map(application => `
      <div class="table-row admin-quick-row" role="row">
        <div class="table-checkbox" aria-label="Not selected" role="checkbox" aria-checked="false"></div>
        <div><div class="table-cell-primary">${escapeHtml(application.name)}</div><div class="table-cell-secondary">${escapeHtml(application.student_id)} · ${escapeHtml(application.college)}</div></div>
        <div><div class="table-cell-primary">${escapeHtml(application.opp_name)}</div><div class="table-cell-secondary">${escapeHtml(application.institution)}</div></div>
        <div class="table-cell">${escapeHtml(application.cgpa)}</div>
        <div class="table-cell">${escapeHtml(formatDate(application.submitted_date))}</div>
        <div><span class="chip ${application.documents_status === 'complete' ? 'chip--green' : 'chip--red'}"><span class="chip__dot"></span>${escapeHtml(application.documents_status)}</span></div>
        <div><span class="chip chip--blue"><span class="chip__dot"></span>${escapeHtml(application.status)}</span></div>
      </div>
    `).join('');
  }

  async function init() {
    container.innerHTML = '<div class="table-row admin-quick-row" role="row"><div></div><div><div class="table-cell-primary">Loading applications...</div></div><div></div><div></div><div></div><div></div><div></div></div>';
    try {
      const [statsResponse, applicationsResponse] = await Promise.all([
        fetch('/api/statistics'),
        fetch('/api/applications?sort=urgency&pageSize=8')
      ]);
      const [statsResult, applicationsResult] = await Promise.all([
        statsResponse.json(),
        applicationsResponse.json()
      ]);
      if (!statsResponse.ok || !statsResult.success) throw new Error(statsResult.error || `HTTP ${statsResponse.status}`);
      if (!applicationsResponse.ok || !applicationsResult.success) throw new Error(applicationsResult.error || `HTTP ${applicationsResponse.status}`);
      updateStats(statsResult.data);
      renderRows(applicationsResult.data || []);
    } catch (error) {
      container.innerHTML = `<div class="table-row admin-quick-row" role="row"><div></div><div><div class="table-cell-primary">Unable to load dashboard data.</div><div class="table-cell-secondary">${escapeHtml(error.message)}</div></div><div></div><div></div><div></div><div></div><div></div></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
