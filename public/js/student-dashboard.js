(function () {
  const heroTitle = document.getElementById('student-hero-title');
  const navAvatar = document.getElementById('nav-user-avatar');
  const recommendedSubtitle = document.getElementById('recommended-subtitle');
  const recommendedList = document.getElementById('recommended-opportunities-list');
  const deadlinesList = document.getElementById('upcoming-deadlines-list');
  const mainContent = document.getElementById('main-content');
  const statCards = {
    active: document.querySelector('[data-stat="active-applications"]'),
    eligible: document.querySelector('[data-stat="eligible-programs"]'),
    documents: document.querySelector('[data-stat="pending-documents"]'),
    deadlines: document.querySelector('[data-stat="deadlines-30"]')
  };

  function escapeHtml(value) {
    const el = document.createElement('div');
    el.textContent = value === null || value === undefined ? '' : String(value);
    return el.innerHTML;
  }

  function initials(name) {
    const value = String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return value || '?';
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysUntil(value, now) {
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  function setStat(card, value, subtitle, subtitleClass) {
    if (!card) return;
    const valueEl = card.querySelector('.stat-card__value');
    const subEl = card.querySelector('.stat-card__sub');
    if (valueEl) valueEl.textContent = value;
    if (subEl) {
      subEl.textContent = subtitle;
      subEl.className = `stat-card__sub${subtitleClass ? ` ${subtitleClass}` : ''}`;
    }
  }

  function setLoadingState() {
    Object.values(statCards).forEach(card => {
      if (!card) return;
      const valueEl = card.querySelector('.stat-card__value');
      const subEl = card.querySelector('.stat-card__sub');
      if (valueEl) valueEl.textContent = '—';
      if (subEl) {
        subEl.textContent = 'Loading...';
        subEl.className = 'stat-card__sub';
      }
    });
    if (recommendedList) recommendedList.innerHTML = '<p class="post-list-empty">Loading recommended opportunities...</p>';
    if (deadlinesList) deadlinesList.innerHTML = '<p class="post-list-empty">Loading upcoming deadlines...</p>';
    const existingError = document.getElementById('dashboard-error-banner');
    if (existingError) existingError.remove();
  }

  function renderRecommended(items) {
    if (!recommendedList) return;
    if (!items.length) {
      recommendedList.innerHTML = '<p class="post-list-empty">No recommended opportunities are currently available.</p>';
      return;
    }
    recommendedList.innerHTML = items.map(item => {
      const icon = window.GEMSOpportunityInitials(item.hostInstitution);
      const meta = [item.country || item.region, item.category, `closes ${formatDate(item.deadline)}`]
        .filter(Boolean)
        .join(' · ');
      return `
        <a href="opportunity.html?id=${encodeURIComponent(item.id)}" class="opp-row mb-0">
          <div class="opp-icon opp-icon--sm">${escapeHtml(icon)}</div>
          <div class="opp-row__info">
            <div class="opp-name">${escapeHtml(item.hostInstitution)}</div>
            <div class="opp-meta">${escapeHtml(meta)}</div>
          </div>
          <span class="chip chip--green"><span class="chip__dot"></span>Eligible</span>
        </a>
      `;
    }).join('');
  }

  function renderDeadlines(items, now) {
    if (!deadlinesList) return;
    if (!items.length) {
      deadlinesList.innerHTML = '<p class="post-list-empty">No upcoming deadlines.</p>';
      return;
    }
    deadlinesList.innerHTML = items.map(item => {
      const remaining = daysUntil(item.deadline, now);
      const urgency = remaining === null ? 'success' : remaining <= 7 ? 'danger' : remaining <= 14 ? 'warning' : 'success';
      const whenLabel = remaining === null
        ? formatDate(item.deadline)
        : `${formatDate(item.deadline)} · in ${Math.max(remaining, 0)} day${Math.max(remaining, 0) === 1 ? '' : 's'}`;
      return `
        <div class="deadline-item">
          <div class="deadline-bar deadline-bar--${urgency}"></div>
          <div class="deadline-content">
            <div class="deadline-label">${escapeHtml(item.programName)} application deadline</div>
            <div class="deadline-when deadline-when--${urgency}">${escapeHtml(whenLabel)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderError(message) {
    if (recommendedList) recommendedList.innerHTML = '';
    if (deadlinesList) deadlinesList.innerHTML = '';
    if (!mainContent) return;
    const existing = document.getElementById('dashboard-error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'card';
    banner.id = 'dashboard-error-banner';
    banner.innerHTML = `
      <div class="card__title">Unable to load your dashboard.</div>
      <div class="card__subtitle">${escapeHtml(message)}</div>
      <button type="button" class="btn btn--secondary" id="dashboard-retry">Retry</button>
    `;
    mainContent.prepend(banner);
    const retryButton = document.getElementById('dashboard-retry');
    if (retryButton) retryButton.addEventListener('click', init);
  }

  async function init() {
    setLoadingState();

    let response;
    try {
      response = await fetch('/api/student/dashboard');
    } catch (error) {
      renderError('Please check your connection and try again.');
      return;
    }

    if (response.status === 401) {
      renderError('Please log in to view your dashboard.');
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      renderError('Unexpected response from the server.');
      return;
    }

    if (!response.ok || !result.success) {
      renderError(result.error || `HTTP ${response.status}`);
      return;
    }

    const data = result.data || {};
    const now = new Date();
    const student = data.student || {};
    const stats = data.applicationStats || {};
    const upcomingDeadlines = data.upcomingDeadlines || [];

    if (heroTitle) {
      const firstName = String(student.name || '').split(' ')[0];
      heroTitle.textContent = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';
    }
    if (navAvatar) navAvatar.textContent = initials(student.name);
    if (recommendedSubtitle) {
      const parts = ['Matched to your profile'];
      if (student.cgpa !== undefined && student.cgpa !== null && student.cgpa !== '') parts.push(`CGPA ${student.cgpa}`);
      if (student.college) parts.push(student.college);
      recommendedSubtitle.textContent = parts.join(' · ');
    }

    setStat(
      statCards.active,
      stats.active ?? 0,
      `${stats.nominated ?? 0} nominated · ${stats.inReview ?? 0} in review`,
      'stat-card__sub--green'
    );
    setStat(
      statCards.eligible,
      data.eligibleOpportunityCount ?? 0,
      `${data.newOpportunitiesThisMonth ?? 0} new this month`,
      'stat-card__sub--green'
    );
    const pendingDocs = stats.incompleteDocuments ?? 0;
    setStat(
      statCards.documents,
      pendingDocs,
      pendingDocs ? `${pendingDocs} application${pendingDocs === 1 ? '' : 's'} missing documents` : 'All caught up',
      pendingDocs ? 'stat-card__sub--amber' : 'stat-card__sub--green'
    );
    setStat(
      statCards.deadlines,
      upcomingDeadlines.length,
      upcomingDeadlines.length ? `Next: ${formatDate(upcomingDeadlines[0].deadline)}` : 'No upcoming deadlines',
      upcomingDeadlines.length ? 'stat-card__sub--red' : 'stat-card__sub--green'
    );

    renderRecommended(data.recommendedOpportunities || []);
    renderDeadlines(upcomingDeadlines, now);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
