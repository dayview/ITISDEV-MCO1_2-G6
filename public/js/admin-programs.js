(function() {
  const pageSize = 8;
  let currentPage = 1;
  let programs = [];
  const selected = new Set();
  const body = document.getElementById('program-table-body');
  const emptyState = document.getElementById('program-empty-state');
  const table = document.querySelector('.program-table');
  const pagination = document.querySelector('.program-pagination');
  const search = document.getElementById('program-search');
  const filters = {
    status: document.getElementById('filter-status'),
    country: document.getElementById('filter-country'),
    university: document.getElementById('filter-university'),
    type: document.getElementById('filter-type'),
    period: document.getElementById('filter-period')
  };
  const sort = document.getElementById('sort-programs');

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  function filteredPrograms() {
    const query = search.value.trim().toLowerCase();
    const result = programs.filter(program => {
      const haystack = `${program.name} ${program.university} ${program.country}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!filters.status.value || program.status === filters.status.value)
        && (!filters.country.value || program.country === filters.country.value)
        && (!filters.university.value || program.university === filters.university.value)
        && (!filters.type.value || program.type === filters.type.value)
        && (!filters.period.value || program.periodState === filters.period.value);
    });

    return result.sort((a, b) => {
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (sort.value === 'applications') return b.applications - a.applications;
      if (sort.value === 'deadline') return new Date(a.deadline || 0) - new Date(b.deadline || 0);
      return new Date(b.updated || 0) - new Date(a.updated || 0);
    });
  }

  function formatDate(value) {
    if (!value) return 'No date';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function updateFilterOptions(select, values, firstLabel) {
    const current = select.value;
    select.innerHTML = `<option value="">${firstLabel}</option>${values.map(value => `<option>${escapeHtml(value)}</option>`).join('')}`;
    if (values.includes(current)) select.value = current;
  }

  function refreshFilters() {
    updateFilterOptions(filters.country, [...new Set(programs.map(item => item.country).filter(Boolean))].sort(), 'All countries');
    updateFilterOptions(filters.university, [...new Set(programs.map(item => item.university).filter(Boolean))].sort(), 'All partners');
    updateFilterOptions(filters.type, [...new Set(programs.map(item => item.type).filter(Boolean))].sort(), 'All types');
  }

  function updateSummary(meta = {}) {
    const cards = document.querySelectorAll('.program-summary-grid .stat-card__value');
    if (cards[0]) cards[0].textContent = meta.total ?? programs.length;
    if (cards[1]) cards[1].textContent = meta.published ?? programs.filter(item => item.rawStatus === 'published').length;
    if (cards[2]) cards[2].textContent = meta.drafts ?? programs.filter(item => item.rawStatus === 'draft').length;
    if (cards[3]) cards[3].textContent = meta.closed ?? programs.filter(item => item.rawStatus === 'closed').length;
  }

  function render() {
    const matches = filteredPrograms();
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const visible = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    table.hidden = visible.length === 0;
    pagination.hidden = visible.length === 0;
    emptyState.hidden = visible.length !== 0;
    body.innerHTML = visible.map(program => `
      <article class="program-row" role="row" data-program-id="${escapeHtml(program.id)}">
        <label class="program-checkbox" data-label="Select"><input type="checkbox" value="${escapeHtml(program.id)}" ${selected.has(program.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(program.name)}"><span></span></label>
        <div class="program-cell program-cell--name" data-label="Program"><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(program.type)}</small></div>
        <div class="program-cell" data-label="Partner University">${escapeHtml(program.university)}</div>
        <div class="program-cell" data-label="Country">${escapeHtml(program.country)}</div>
        <div class="program-cell" data-label="Application Deadline"><strong>${escapeHtml(formatDate(program.deadline))}</strong><small>${escapeHtml(program.periodState)}</small></div>
        <div class="program-cell program-cell--applications" data-label="Applications">${program.applications}</div>
        <div class="program-cell" data-label="Status"><span class="program-status program-status--${escapeHtml(program.status.toLowerCase())}">${escapeHtml(program.status)}</span></div>
        <div class="program-cell" data-label="Last Updated">${escapeHtml(formatDate(program.updated))}</div>
        <div class="program-row-actions" data-label="Actions">
          <button type="button" class="program-action-link" data-action="view">View</button>
          <button type="button" class="program-action-link" data-action="edit">Edit</button>
          <div class="program-overflow">
            <button type="button" class="program-overflow__trigger" aria-label="More actions for ${escapeHtml(program.name)}" aria-expanded="false">&#8942;</button>
            <div class="program-overflow__menu" hidden>
              <button type="button" data-action="duplicate">Duplicate</button>
              <button type="button" data-action="archive">Archive</button>
              <button type="button" data-action="delete" class="program-danger-action">Delete</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    document.getElementById('program-result-count').textContent = matches.length
      ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, matches.length)} of ${matches.length} programs`
      : 'No programs match the current filters';
    document.getElementById('program-page-summary').textContent = `Page ${currentPage} of ${totalPages}`;
    renderPagination(totalPages);
    bindRows();
    updateBulkBar();
  }

  function renderPagination(totalPages) {
    const pages = document.getElementById('program-pages');
    pages.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pagination-page${page === currentPage ? ' pagination-page--active' : ''}`;
      button.textContent = String(page);
      button.setAttribute('aria-label', `Go to page ${page}`);
      if (page === currentPage) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => { currentPage = page; render(); });
      pages.appendChild(button);
    }
    document.getElementById('program-prev').disabled = currentPage === 1;
    document.getElementById('program-next').disabled = currentPage === totalPages;
  }

  function bindRows() {
    body.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const id = checkbox.value;
        if (checkbox.checked) selected.add(id);
        else selected.delete(id);
        updateBulkBar();
      });
    });

    body.querySelectorAll('.program-overflow__trigger').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.stopPropagation();
        const menu = trigger.nextElementSibling;
        const opening = menu.hidden;
        closeMenus();
        menu.hidden = !opening;
        trigger.setAttribute('aria-expanded', String(opening));
      });
    });

    body.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const row = button.closest('.program-row');
        const program = programs.find(item => item.id === row.dataset.programId);
        const action = button.dataset.action;
        if (action === 'edit') window.location.href = `post-opportunity.html?id=${program.id}`;
        else if (action === 'view' && program.rawStatus === 'published') window.location.href = `../opportunity.html?id=${program.id}`;
        else if (action === 'view') alert('Draft programs are not visible to students yet.');
        else alert(`${action.charAt(0).toUpperCase() + action.slice(1)} action selected for "${program.name}".`);
      });
    });
  }

  function closeMenus() {
    document.querySelectorAll('.program-overflow__menu').forEach(menu => { menu.hidden = true; });
    document.querySelectorAll('.program-overflow__trigger').forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
  }

  function updateBulkBar() {
    const bar = document.getElementById('program-bulk-bar');
    document.getElementById('selected-program-count').textContent = String(selected.size);
    bar.hidden = selected.size === 0;
    document.getElementById('select-all-programs').checked = selected.size > 0
      && filteredPrograms().slice((currentPage - 1) * pageSize, currentPage * pageSize).every(program => selected.has(program.id));
  }

  async function loadPrograms() {
    body.innerHTML = '<p class="post-list-empty">Loading programs...</p>';
    const response = await fetch('/api/admin/opportunities');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
    programs = result.data || [];
    refreshFilters();
    updateSummary(result.meta || {});
    render();
  }

  search.addEventListener('input', () => { currentPage = 1; render(); });
  Object.values(filters).forEach(filter => filter.addEventListener('change', () => { currentPage = 1; render(); }));
  sort.addEventListener('change', () => { currentPage = 1; render(); });
  document.getElementById('toggle-filters').addEventListener('click', () => document.getElementById('program-filter-panel').classList.toggle('program-filter-panel--collapsed'));
  document.getElementById('select-all-programs').addEventListener('change', event => {
    filteredPrograms().slice((currentPage - 1) * pageSize, currentPage * pageSize).forEach(program => {
      if (event.target.checked) selected.add(program.id);
      else selected.delete(program.id);
    });
    render();
  });
  document.getElementById('program-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; render(); } });
  document.getElementById('program-next').addEventListener('click', () => { if (currentPage < Math.ceil(filteredPrograms().length / pageSize)) { currentPage += 1; render(); } });
  document.getElementById('export-programs').addEventListener('click', () => alert('Program list export prepared.'));
  document.getElementById('bulk-menu-button').addEventListener('click', () => {
    document.getElementById('program-bulk-bar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.querySelectorAll('[data-bulk-action]').forEach(button => button.addEventListener('click', () => {
    alert(`${button.dataset.bulkAction} selected for ${selected.size} program${selected.size === 1 ? '' : 's'}.`);
  }));
  document.addEventListener('click', closeMenus);

  loadPrograms().catch(error => {
    table.hidden = true;
    pagination.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('h3').textContent = 'Unable to load programs.';
    emptyState.querySelector('p').textContent = error.message;
  });
})();
