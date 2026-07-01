(function() {
  const programs = [
    { id: 1, name: 'NUS Exchange Semester', type: 'Exchange', university: 'National University of Singapore', country: 'Singapore', period: 'Aug 1 – Oct 15, 2026', periodState: 'Open', applications: 42, status: 'Published', updated: '2026-06-23' },
    { id: 2, name: 'Chung-Ang Summer Program', type: 'Summer', university: 'Chung-Ang University', country: 'South Korea', period: 'Jan 10 – Mar 30, 2027', periodState: 'Upcoming', applications: 31, status: 'Published', updated: '2026-06-21' },
    { id: 3, name: 'Kyoto Research Exchange', type: 'Research', university: 'Kyoto University', country: 'Japan', period: 'Sep 1 – Nov 30, 2026', periodState: 'Open', applications: 18, status: 'Published', updated: '2026-06-19' },
    { id: 4, name: 'Melbourne Global Semester', type: 'Exchange', university: 'University of Melbourne', country: 'Australia', period: 'Jul 15 – Sep 10, 2026', periodState: 'Open', applications: 27, status: 'Published', updated: '2026-06-18' },
    { id: 5, name: 'TUM Winter Research Immersion', type: 'Research', university: 'Technical University of Munich', country: 'Germany', period: 'Oct 1 – Dec 5, 2026', periodState: 'Upcoming', applications: 0, status: 'Draft', updated: '2026-06-17' },
    { id: 6, name: 'UBC Sustainability Leadership', type: 'Summer', university: 'University of British Columbia', country: 'Canada', period: 'May 1 – Aug 5, 2026', periodState: 'Open', applications: 22, status: 'Draft', updated: '2026-06-14' },
    { id: 7, name: 'HKUST Innovation Exchange', type: 'Exchange', university: 'Hong Kong University of Science & Technology', country: 'Hong Kong', period: 'Feb 1 – Apr 20, 2026', periodState: 'Closed', applications: 38, status: 'Closed', updated: '2026-06-10' },
    { id: 8, name: 'Edinburgh Intercultural Program', type: 'Exchange', university: 'University of Edinburgh', country: 'United Kingdom', period: 'Sep 1 – Nov 15, 2025', periodState: 'Closed', applications: 16, status: 'Archived', updated: '2026-05-28' },
    { id: 9, name: 'NTU Engineering Exchange', type: 'Exchange', university: 'Nanyang Technological University', country: 'Singapore', period: 'Aug 15 – Oct 30, 2026', periodState: 'Upcoming', applications: 12, status: 'Published', updated: '2026-05-24' },
    { id: 10, name: 'Osaka Industry Internship', type: 'Internship', university: 'Osaka University', country: 'Japan', period: 'Mar 1 – May 15, 2027', periodState: 'Upcoming', applications: 0, status: 'Draft', updated: '2026-05-20' },
    { id: 11, name: 'Sciences Po Social Sciences Exchange', type: 'Exchange', university: 'Sciences Po', country: 'France', period: 'Aug 1 – Oct 10, 2026', periodState: 'Open', applications: 29, status: 'Published', updated: '2026-05-18' },
    { id: 12, name: 'MIT Campus Research Fellowship', type: 'Research', university: 'Massachusetts Institute of Technology', country: 'United States', period: 'Sep 15 – Dec 20, 2026', periodState: 'Upcoming', applications: 14, status: 'Published', updated: '2026-05-16' },
    { id: 13, name: 'Ateneo de Madrid Language Exchange', type: 'Exchange', university: 'Universidad Autónoma de Madrid', country: 'Spain', period: 'Jul 1 – Sep 30, 2026', periodState: 'Open', applications: 11, status: 'Published', updated: '2026-05-14' },
    { id: 14, name: 'Waseda Global Leadership Program', type: 'Summer', university: 'Waseda University', country: 'Japan', period: 'Oct 1 – Dec 18, 2026', periodState: 'Upcoming', applications: 24, status: 'Published', updated: '2026-05-12' },
    { id: 15, name: 'Erasmus Rotterdam Business Exchange', type: 'Exchange', university: 'Erasmus University Rotterdam', country: 'Netherlands', period: 'Aug 10 – Oct 25, 2026', periodState: 'Open', applications: 19, status: 'Published', updated: '2026-05-10' },
    { id: 16, name: 'KAIST Technology Research Track', type: 'Research', university: 'KAIST', country: 'South Korea', period: 'Sep 1 – Nov 20, 2026', periodState: 'Upcoming', applications: 17, status: 'Published', updated: '2026-05-08' },
    { id: 17, name: 'University of Auckland Exchange', type: 'Exchange', university: 'University of Auckland', country: 'New Zealand', period: 'Jun 15 – Aug 31, 2026', periodState: 'Open', applications: 21, status: 'Published', updated: '2026-05-06' },
    { id: 18, name: 'Copenhagen Sustainability Lab', type: 'Research', university: 'University of Copenhagen', country: 'Denmark', period: 'Jan 15 – Mar 15, 2027', periodState: 'Upcoming', applications: 8, status: 'Published', updated: '2026-05-04' },
    { id: 19, name: 'Toronto Urban Innovation Exchange', type: 'Exchange', university: 'University of Toronto', country: 'Canada', period: 'Aug 1 – Oct 5, 2026', periodState: 'Open', applications: 26, status: 'Published', updated: '2026-05-02' },
    { id: 20, name: 'ETH Zurich Engineering Research', type: 'Research', university: 'ETH Zurich', country: 'Switzerland', period: 'Oct 1 – Dec 10, 2026', periodState: 'Upcoming', applications: 13, status: 'Published', updated: '2026-04-30' },
    { id: 21, name: 'Chulalongkorn ASEAN Exchange', type: 'Exchange', university: 'Chulalongkorn University', country: 'Thailand', period: 'Jul 20 – Sep 30, 2026', periodState: 'Open', applications: 20, status: 'Published', updated: '2026-04-28' },
    { id: 22, name: 'Stockholm Social Innovation Program', type: 'Summer', university: 'Stockholm University', country: 'Sweden', period: 'Feb 1 – Apr 30, 2027', periodState: 'Upcoming', applications: 7, status: 'Published', updated: '2026-04-26' },
    { id: 23, name: 'Monash Data Science Internship', type: 'Internship', university: 'Monash University', country: 'Australia', period: 'Mar 1 – May 30, 2027', periodState: 'Upcoming', applications: 0, status: 'Draft', updated: '2026-04-24' },
    { id: 24, name: 'Old Seoul Cultural Immersion', type: 'Summer', university: 'Hanyang University', country: 'South Korea', period: 'Jan 10 – Mar 10, 2025', periodState: 'Closed', applications: 34, status: 'Archived', updated: '2026-04-20' }
  ];

  const pageSize = 8;
  let currentPage = 1;
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
      if (sort.value === 'deadline') return a.period.localeCompare(b.period);
      return new Date(b.updated) - new Date(a.updated);
    });
  }

  function formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <article class="program-row" role="row" data-program-id="${program.id}">
        <label class="program-checkbox" data-label="Select"><input type="checkbox" value="${program.id}" ${selected.has(program.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(program.name)}"><span></span></label>
        <div class="program-cell program-cell--name" data-label="Program"><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(program.type)}</small></div>
        <div class="program-cell" data-label="Partner University">${escapeHtml(program.university)}</div>
        <div class="program-cell" data-label="Country">${escapeHtml(program.country)}</div>
        <div class="program-cell" data-label="Application Period"><strong>${escapeHtml(program.period)}</strong><small>${escapeHtml(program.periodState)}</small></div>
        <div class="program-cell program-cell--applications" data-label="Applications">${program.applications}</div>
        <div class="program-cell" data-label="Status"><span class="program-status program-status--${program.status.toLowerCase()}">${escapeHtml(program.status)}</span></div>
        <div class="program-cell" data-label="Last Updated">${formatDate(program.updated)}</div>
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
      ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, matches.length)} of ${matches.length} programs`
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
        const id = Number(checkbox.value);
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
        const program = programs.find(item => item.id === Number(row.dataset.programId));
        const action = button.dataset.action;
        if (action === 'edit') window.location.href = `post-opportunity.html?id=${program.id}`;
        else if (action === 'view') alert(`Previewing “${program.name}”.`);
        else alert(`${action.charAt(0).toUpperCase() + action.slice(1)} action selected for “${program.name}”.`);
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

  render();
})();
