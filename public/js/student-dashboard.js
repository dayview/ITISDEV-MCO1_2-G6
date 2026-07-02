(function() {
  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  function initials(value) {
    return String(value || 'GEMS').split(' ').map(word => word[0]).slice(0, 3).join('').toUpperCase();
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysUntil(value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / 86400000);
  }

  function updateStats(summary) {
    const cards = document.querySelectorAll('.stat-grid .stat-card');
    const values = [
      { value: summary.stats.activeApplications, sub: `${summary.applications.length} total application${summary.applications.length === 1 ? '' : 's'}` },
      { value: summary.stats.eligiblePrograms, sub: 'Published and open now' },
      { value: summary.stats.pendingDocuments, sub: `${summary.documents.length} uploaded file${summary.documents.length === 1 ? '' : 's'}` },
      { value: summary.stats.deadlines30Days, sub: 'Open opportunities closing soon' }
    ];
    cards.forEach((card, index) => {
      const value = card.querySelector('.stat-card__value');
      const sub = card.querySelector('.stat-card__sub');
      if (value && values[index]) value.textContent = values[index].value;
      if (sub && values[index]) sub.textContent = values[index].sub;
    });
  }

  function updateRecommended(opportunities) {
    const card = document.querySelector('.dashboard-grid .card-lg:first-child');
    if (!card) return;
    card.querySelectorAll('.opp-row').forEach(row => row.remove());
    const items = opportunities.slice(0, 3);
    if (!items.length) {
      card.insertAdjacentHTML('beforeend', '<div class="opp-row"><div class="opp-row__info"><div class="opp-name">No open opportunities yet.</div><div class="opp-meta">Check back after OVPERI publishes programs.</div></div></div>');
      return;
    }
    items.forEach(item => {
      card.insertAdjacentHTML('beforeend', `
        <a href="opportunity.html?id=${encodeURIComponent(item.id)}" class="opp-row">
          <div class="opp-icon opp-icon--sm">${escapeHtml(initials(item.hostInstitution))}</div>
          <div class="opp-row__info">
            <div class="opp-name">${escapeHtml(item.programName)}</div>
            <div class="opp-meta">${escapeHtml(item.country || item.location)} · ${escapeHtml(item.category)} · closes ${escapeHtml(formatDate(item.deadline))}</div>
          </div>
          <span class="chip chip--green"><span class="chip__dot"></span>Eligible</span>
        </a>
      `);
    });
  }

  function updateDeadlines(opportunities) {
    const card = document.querySelector('.dashboard-grid .card-lg:nth-child(2)');
    if (!card) return;
    card.querySelectorAll('.deadline-item').forEach(item => item.remove());
    const items = opportunities.slice(0, 3);
    if (!items.length) {
      card.insertAdjacentHTML('beforeend', '<div class="deadline-item"><div class="deadline-content"><div class="deadline-label">No upcoming deadlines.</div><div class="deadline-when">Published opportunities will appear here.</div></div></div>');
      return;
    }
    items.forEach(item => {
      const days = daysUntil(item.deadline);
      const tone = days <= 7 ? 'danger' : days <= 21 ? 'warning' : 'success';
      card.insertAdjacentHTML('beforeend', `
        <div class="deadline-item">
          <div class="deadline-bar deadline-bar--${tone}"></div>
          <div class="deadline-content">
            <div class="deadline-label">${escapeHtml(item.programName)}</div>
            <div class="deadline-when deadline-when--${tone}">${escapeHtml(formatDate(item.deadline))} · in ${days} day${days === 1 ? '' : 's'}</div>
          </div>
        </div>
      `);
    });
  }

  async function init() {
    try {
      const response = await fetch('/api/student/summary');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      const summary = result.data;
      const title = document.querySelector('.student-hero__title');
      if (title && summary.student?.name) title.textContent = `Welcome back, ${summary.student.name.split(' ')[0]}!`;
      updateStats(summary);
      updateRecommended(summary.recommended || []);
      updateDeadlines(summary.deadlines || []);
    } catch (error) {
      const firstCard = document.querySelector('.dashboard-grid .card-lg:first-child');
      if (firstCard) firstCard.insertAdjacentHTML('beforeend', `<div class="opp-row"><div class="opp-row__info"><div class="opp-name">Unable to load dashboard data.</div><div class="opp-meta">${escapeHtml(error.message)}</div></div></div>`);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
