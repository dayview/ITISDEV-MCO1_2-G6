(function () {
  const PAGE_SIZE = 20;

  const ACTION_META = {
    opportunity_created:            { chip: 'green', label: 'created the opportunity' },
    opportunity_updated:            { chip: 'blue',  label: 'updated the opportunity' },
    opportunity_deleted:            { chip: 'red',   label: 'deleted the opportunity' },
    opportunity_published:          { chip: 'green', label: 'published the opportunity' },
    opportunity_closed:             { chip: 'amber', label: 'closed the opportunity' },
    application_status_changed:     { chip: 'blue',  label: 'changed the application status' },
    application_bulk_status_changed:{ chip: 'blue',  label: 'bulk-changed application statuses' },
    application_submitted:          { chip: 'green', label: 'submitted an application' },
    user_role_changed:              { chip: 'blue',  label: "changed a user's role" },
    user_deactivated:               { chip: 'red',   label: 'deactivated a user account' },
    user_registered:                { chip: 'green', label: 'registered an account' },
    user_login:                     { chip: 'gray',  label: 'logged in' },
    user_logout:                    { chip: 'gray',  label: 'logged out' },
    user_profile_updated:           { chip: 'blue',  label: 'updated their profile' },
    document_uploaded:              { chip: 'blue',  label: 'uploaded a document' },
    document_deleted:               { chip: 'red',   label: 'deleted a document' },
    document_verified:              { chip: 'green', label: 'verified a document' },
    document_rejected:              { chip: 'red',   label: 'rejected a document' },
    otp_sent:                       { chip: 'gray',  label: 'sent a one-time passcode' },
    otp_verified:                   { chip: 'green', label: 'verified a one-time passcode' },
    otp_failed:                     { chip: 'red',   label: 'failed a one-time passcode attempt' },
    otp_send_failed:                { chip: 'red',   label: 'failed to send a one-time passcode' }
  };

  const state = { page: 1, action: '', targetType: '', actorSearch: '', from: '', to: '' };
  let totalPages = 1;

  const forbidden = document.getElementById('audit-forbidden');
  const body = document.getElementById('audit-log-body');
  const list = document.getElementById('audit-log-list');
  const resultCount = document.getElementById('audit-log-result-count');
  const emptyState = document.getElementById('audit-log-empty-state');
  const pagination = document.querySelector('.audit-log-pagination');
  const pageSummary = document.getElementById('audit-log-page-summary');
  const pagesContainer = document.getElementById('audit-log-pages');
  const prevBtn = document.getElementById('audit-log-prev');
  const nextBtn = document.getElementById('audit-log-next');
  const actorSearchInput = document.getElementById('audit-actor-search');
  const actionFilter = document.getElementById('audit-action-filter');
  const targetFilter = document.getElementById('audit-target-filter');
  const fromDate = document.getElementById('audit-from-date');
  const toDate = document.getElementById('audit-to-date');
  const clearFiltersBtn = document.getElementById('audit-clear-filters');

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    for (const [unit, secondsInUnit] of units) {
      const value = Math.floor(seconds / secondsInUnit);
      if (value >= 1) return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    }
    return seconds < 5 ? 'just now' : `${seconds} seconds ago`;
  }

  function absoluteTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function populateActionFilter() {
    const options = Object.keys(ACTION_META).map(action => {
      const label = action.replace(/_/g, ' ');
      return `<option value="${action}">${label.charAt(0).toUpperCase()}${label.slice(1)}</option>`;
    }).join('');
    actionFilter.insertAdjacentHTML('beforeend', options);
  }

  function renderDiff(changes) {
    if (!Array.isArray(changes) || !changes.length) return '';
    return `<div class="audit-log-entry__diff">${changes.map(change => `
      <div class="audit-log-entry__diff-row">
        <span class="audit-log-entry__diff-field">${escapeHtml(change.field)}</span>
        <span class="audit-log-entry__diff-from">${escapeHtml(change.from ?? '—')}</span>
        <span aria-hidden="true">&rarr;</span>
        <span class="audit-log-entry__diff-to">${escapeHtml(change.to ?? '—')}</span>
      </div>`).join('')}</div>`;
  }

  function renderEntry(log) {
    const actor = log.userId && typeof log.userId === 'object' ? log.userId : null;
    const actorName = actor?.name || 'Unknown user';
    const actorRole = actor?.role || log.userRole || '';
    const meta = ACTION_META[log.action] || { chip: 'gray', label: log.action };
    const targetLabel = log.targetLabel || log.targetId;

    return `
      <div class="audit-log-entry" data-expanded="false" role="listitem">
        <div class="audit-log-entry__row" data-toggle-row>
          <span class="user-avatar" aria-hidden="true">${initials(actorName)}</span>
          <div class="audit-log-entry__main">
            <div class="audit-log-entry__headline">
              <span class="audit-log-entry__actor">${escapeHtml(actorName)}</span>
              <span class="chip chip--${meta.chip}"><span class="chip__dot"></span>${escapeHtml(meta.label)}</span>
              <span class="audit-log-entry__role">${escapeHtml(actorRole)}</span>
            </div>
            <div class="audit-log-entry__description">${escapeHtml(log.targetType)}: <strong>${escapeHtml(targetLabel)}</strong></div>
          </div>
          <div class="audit-log-entry__meta">
            <span class="audit-log-entry__time" title="${absoluteTime(log.createdAt)}">${timeAgo(log.createdAt)}</span>
            <button type="button" class="audit-log-entry__toggle" aria-expanded="false" aria-label="Show details for this entry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
            </button>
          </div>
        </div>
        <div class="audit-log-entry__details" hidden>
          ${renderDiff(log.changes) || '<p class="audit-log-entry__ip">No field-level changes were recorded for this action.</p>'}
          <p class="audit-log-entry__ip">Full timestamp: ${absoluteTime(log.createdAt)}${log.ip ? ` &middot; IP: ${escapeHtml(log.ip)}` : ''}</p>
        </div>
      </div>`;
  }

  function renderPages() {
    pagesContainer.innerHTML = '';
    const windowSize = 5;
    let start = Math.max(1, state.page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    for (let page = start; page <= end; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pagination-page${page === state.page ? ' pagination-page--active' : ''}`;
      button.textContent = String(page);
      button.addEventListener('click', () => { state.page = page; fetchLogs(); });
      pagesContainer.appendChild(button);
    }

    prevBtn.disabled = state.page === 1;
    nextBtn.disabled = state.page >= totalPages;
  }

  function bindToggles() {
    list.querySelectorAll('.audit-log-entry').forEach(entry => {
      const toggle = entry.querySelector('.audit-log-entry__toggle');
      const details = entry.querySelector('.audit-log-entry__details');
      entry.querySelector('[data-toggle-row]').addEventListener('click', () => {
        const expanded = entry.dataset.expanded === 'true';
        entry.dataset.expanded = expanded ? 'false' : 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        details.hidden = expanded;
      });
    });
  }

  function buildQuery() {
    const params = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE });
    if (state.action) params.set('action', state.action);
    if (state.targetType) params.set('targetType', state.targetType);
    if (state.actorSearch) params.set('actorSearch', state.actorSearch);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    return params.toString();
  }

  async function fetchLogs() {
    resultCount.textContent = 'Loading...';
    try {
      const res = await fetch(`/api/admin/audit-logs?${buildQuery()}`, { credentials: 'include' });
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      if (!res.ok) throw new Error(`Request failed with HTTP ${res.status}`);
      const payload = await res.json();
      const logs = payload.data || [];
      const meta = payload.meta || { total: 0, page: 1, totalPages: 1 };
      totalPages = Math.max(1, meta.totalPages);
      state.page = Math.min(state.page, totalPages);

      list.hidden = logs.length === 0;
      emptyState.hidden = logs.length !== 0;
      pagination.hidden = logs.length === 0;

      list.innerHTML = logs.map(renderEntry).join('');
      bindToggles();

      resultCount.textContent = meta.total
        ? `Showing ${(meta.page - 1) * PAGE_SIZE + 1}-${Math.min(meta.page * PAGE_SIZE, meta.total)} of ${meta.total} entries`
        : 'No activity recorded yet.';
      pageSummary.textContent = `Page ${state.page} of ${totalPages}`;
      renderPages();
    } catch (error) {
      resultCount.textContent = 'Could not load the audit log. Please try again.';
      list.innerHTML = '';
      list.hidden = true;
      pagination.hidden = true;
      emptyState.hidden = true;
    }
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function resetAndFetch() { state.page = 1; fetchLogs(); }

  function bindFilters() {
    actorSearchInput.addEventListener('input', debounce(() => {
      state.actorSearch = actorSearchInput.value.trim();
      resetAndFetch();
    }, 350));
    actionFilter.addEventListener('change', () => { state.action = actionFilter.value; resetAndFetch(); });
    targetFilter.addEventListener('change', () => { state.targetType = targetFilter.value; resetAndFetch(); });
    fromDate.addEventListener('change', () => { state.from = fromDate.value; resetAndFetch(); });
    toDate.addEventListener('change', () => { state.to = toDate.value; resetAndFetch(); });
    clearFiltersBtn.addEventListener('click', () => {
      actorSearchInput.value = '';
      actionFilter.value = '';
      targetFilter.value = '';
      fromDate.value = '';
      toDate.value = '';
      Object.assign(state, { action: '', targetType: '', actorSearch: '', from: '', to: '' });
      resetAndFetch();
    });
    prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; fetchLogs(); } });
    nextBtn.addEventListener('click', () => { if (state.page < totalPages) { state.page += 1; fetchLogs(); } });
  }

  async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const payload = await res.json();
      if (payload?.user?.role !== 'System_Admin') {
        body.hidden = true;
        forbidden.hidden = false;
        return;
      }
    } catch (_error) {
      body.hidden = true;
      forbidden.hidden = false;
      return;
    }

    populateActionFilter();
    bindFilters();
    fetchLogs();
  }

  init();
}());
