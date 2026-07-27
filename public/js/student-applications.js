(function () {
  const STATUS = window.GEMSApplicationStatus;
  const STEP_LABELS = ['Submitted', 'Under Review', 'Nominated', 'Decision'];
  const STEP_INDEX = { submitted: 0, 'under-review': 1, nominated: 2, accepted: 3, rejected: 3 };

  const loadingEl = document.getElementById('applications-loading');
  const errorEl = document.getElementById('applications-error');
  const errorTitleEl = document.getElementById('applications-error-title');
  const errorMessageEl = document.getElementById('applications-error-message');
  const retryButton = document.getElementById('applications-retry');
  const emptyEl = document.getElementById('applications-empty');
  const filteredEmptyEl = document.getElementById('applications-filtered-empty');
  const listEl = document.getElementById('application-list');
  const pillsEl = document.getElementById('applications-filter-pills');
  const refreshButton = document.getElementById('applications-refresh');
  const updatedEl = document.getElementById('applications-updated');

  if (!listEl || !STATUS) return;

  let allApplications = [];
  let activeFilter = 'all';

  function escapeHtml(value) {
    const el = document.createElement('div');
    el.textContent = value === null || value === undefined ? '' : String(value);
    return el.innerHTML;
  }

  function showOnly(state) {
    if (loadingEl) loadingEl.hidden = state !== 'loading';
    if (errorEl) errorEl.hidden = state !== 'error';
    if (emptyEl) emptyEl.hidden = state !== 'empty';
    if (filteredEmptyEl) filteredEmptyEl.hidden = state !== 'filtered-empty';
    listEl.hidden = state !== 'list';
    if (state !== 'list') listEl.innerHTML = '';
  }

  function showError(title, message) {
    if (errorTitleEl) errorTitleEl.textContent = title;
    if (errorMessageEl) errorMessageEl.textContent = message;
    showOnly('error');
  }

  function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function initials(value) {
    return window.GEMSOpportunityInitials(value);
  }

  function chipClassForStatus(status) {
    if (status === 'accepted') return 'chip--green';
    if (status === 'rejected') return 'chip--red';
    if (STATUS.getStatusGroup(status) === 'unknown') return 'chip--gray';
    return 'chip--blue';
  }

  function renderProgressSteps(status) {
    const currentIndex = STEP_INDEX[status];
    if (currentIndex === undefined) {
      return `
        <div class="draft-bar">
          <span class="draft-bar__text">${escapeHtml(STATUS.getStatusLabel(status))}</span>
        </div>
      `;
    }

    const steps = STEP_LABELS.map((label, index) => {
      if (index < currentIndex) {
        return { label, state: 'done', marker: '&#10003;' };
      }
      if (index === currentIndex) {
        if (status === 'accepted') return { label: 'Accepted', state: 'current', marker: '&#10003;' };
        if (status === 'rejected') return { label: 'Not Selected', state: 'current', marker: '&#10007;' };
        return { label, state: 'current', marker: '&#9679;' };
      }
      return { label, state: 'pending', marker: '&nbsp;' };
    });

    const stepStateText = { done: 'complete', current: 'current step', pending: 'pending' };

    const stepHtml = steps.map((step, index) => {
      const col = `
        <div class="step-col" role="listitem">
          <div class="step-dot step-dot--${step.state}" aria-label="${escapeHtml(step.label)}: ${stepStateText[step.state]}">${step.marker}</div>
          <div class="step-label step-label--${step.state}">${escapeHtml(step.label)}</div>
        </div>
      `;
      if (index === steps.length - 1) return col;
      const lineState = index < currentIndex ? 'done' : 'pending';
      return `${col}<div class="step-wrap"><div class="step-line step-line--${lineState}"></div></div>`;
    }).join('');

    return `<div class="progress-steps" role="list" aria-label="Application progress">${stepHtml}</div>`;
  }

  function renderTimeline(application) {
    const timeline = Array.isArray(application.timeline) ? application.timeline : [];
    if (!timeline.length) return '';

    const items = timeline.map(entry => {
      const label = STATUS.getStatusLabel(entry.status);
      const when = formatDate(entry.at) || 'Date unavailable';
      const actor = entry.by === 'you' ? 'by you' : 'by an administrator';
      return `
        <li class="tracker-timeline__item">
          <span class="tracker-timeline__dot" aria-hidden="true"></span>
          <div class="tracker-timeline__body">
            <span class="tracker-timeline__label">${escapeHtml(label)}</span>
            <span class="tracker-timeline__meta">${escapeHtml(actor)} &middot; ${escapeHtml(when)}</span>
          </div>
        </li>
      `;
    }).join('');

    return `
      <details class="tracker-timeline">
        <summary class="tracker-timeline__summary">Stage history</summary>
        <ol class="tracker-timeline__list">${items}</ol>
      </details>
    `;
  }

  function renderCard(application) {
    const submittedLabel = formatDate(application.submittedAt) || 'Not provided';
    const deadlineLabel = formatDate(application.deadline);
    const reviewedLabel = formatDate(application.reviewedAt);
    const updatedLabel = formatDate(application.lastUpdatedAt);
    const statusLabel = STATUS.getStatusLabel(application.status);
    const chipClass = chipClassForStatus(application.status);
    const documentsLabel = application.documentsStatus === 'complete' ? 'Complete' : 'Incomplete';
    const hasOpportunity = Boolean(application.opportunityId);

    return `
      <div class="tracker-card">
        <div class="tracker-card__header">
          <div class="tracker-icon">${escapeHtml(initials(application.hostInstitution))}</div>
          <div class="tracker-card__info">
            <div class="tracker-name">${escapeHtml(application.programName || 'Untitled opportunity')}</div>
            <div class="tracker-host">${escapeHtml(application.hostInstitution || 'Not provided')}${application.location ? ` · ${escapeHtml(application.location)}` : ''}</div>
            <div class="tracker-submitted">submitted ${escapeHtml(submittedLabel)} &middot; ${deadlineLabel ? `deadline ${escapeHtml(deadlineLabel)}` : 'no deadline available'}${updatedLabel ? ` &middot; updated ${escapeHtml(updatedLabel)}` : ''}</div>
          </div>
          <span class="chip ${chipClass}"><span class="chip__dot"></span>${escapeHtml(statusLabel)}</span>
        </div>

        ${renderProgressSteps(application.status)}

        ${renderTimeline(application)}

        <div class="flex-row align-center space-between gap-12 mt-16">
          <span class="tracker-submitted">Documents: ${escapeHtml(documentsLabel)} &middot; ${reviewedLabel ? `reviewed ${escapeHtml(reviewedLabel)}` : 'not yet reviewed'}</span>
          ${hasOpportunity ? `<a class="btn btn--secondary btn--compact" href="opportunity.html?id=${encodeURIComponent(application.opportunityId)}">View Opportunity</a>` : ''}
        </div>
      </div>
    `;
  }

  function renderPills() {
    if (!pillsEl) return;
    const counts = STATUS.countByFilter(allApplications);
    pillsEl.innerHTML = STATUS.FILTERS.map(filter => `
      <button type="button" class="pill${filter.key === activeFilter ? ' pill--active' : ''}" data-filter="${escapeHtml(filter.key)}" aria-pressed="${filter.key === activeFilter}">
        ${escapeHtml(filter.label)} &middot; ${counts[filter.key] || 0}
      </button>
    `).join('');

    pillsEl.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        renderPills();
        renderList();
      });
    });
  }

  function renderList() {
    const filtered = STATUS.filterApplications(allApplications, activeFilter);
    if (!filtered.length) {
      showOnly('filtered-empty');
      return;
    }
    showOnly('list');
    listEl.innerHTML = filtered.map(renderCard).join('');
  }

  async function load() {
    showOnly('loading');
    if (pillsEl) pillsEl.innerHTML = '';

    let response;
    try {
      response = await fetch('/api/applications/my');
    } catch (error) {
      showError('We could not load your applications.', 'Please check your connection and try again.');
      return;
    }

    if (response.status === 401 || response.status === 403) {
      showError('Your session has expired.', 'Please sign in again to view your applications.');
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      showError('We could not load your applications.', 'Unexpected response from the server.');
      return;
    }

    if (!response.ok || !result.success) {
      showError('We could not load your applications.', result.error || `HTTP ${response.status}`);
      return;
    }

    allApplications = Array.isArray(result.data) ? result.data : [];
    if (!allApplications.length) {
      showOnly('empty');
      return;
    }

    activeFilter = 'all';
    renderPills();
    renderList();
    markRefreshed();
  }

  function markRefreshed() {
    if (!updatedEl) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    updatedEl.textContent = `Last refreshed ${now}`;
  }

  if (retryButton) retryButton.addEventListener('click', load);
  if (refreshButton) refreshButton.addEventListener('click', load);
  document.addEventListener('DOMContentLoaded', load);
})();
