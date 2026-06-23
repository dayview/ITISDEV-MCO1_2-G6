(function() {
  const form = document.getElementById('catalog-filter-form');
  const resultsContainer = document.getElementById('catalog-results');
  const paginationContainer = document.getElementById('catalog-pagination');
  const countLabel = document.getElementById('catalog-result-count');
  const calendarModeLabel = document.getElementById('calendar-view-mode');
  const pageSizeSelect = document.getElementById('page-size');
  const sortSelect = document.getElementById('sort-by');
  const deadlineRangeSelect = document.getElementById('deadline-range');
  const globalSearchInput = document.getElementById('global-search');
  const filterSearchInput = document.getElementById('search-query');
  const resetButton = document.getElementById('reset-filters');
  const viewTabs = Array.from(document.querySelectorAll('.view-tab'));
  const formFields = {
    search: form ? form.elements.search : null,
    category: form ? form.elements.category : null,
    region: form ? form.elements.region : null,
    deadlineFrom: form ? form.elements.deadlineFrom : null,
    deadlineTo: form ? form.elements.deadlineTo : null,
    page: form ? form.elements.page : null
  };
  let currentView = 'card';
  let calendarMode = 'month';
  let calendarFocusDate = getToday();
  let timelineFocusDate = getToday();
  let searchTimer;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function sortOpportunities(items, sortBy) {
    return items.slice().sort((a, b) => {
      if (sortBy === 'deadlineAsc') {
        return parseDate(a.deadline) - parseDate(b.deadline);
      }
      if (sortBy === 'deadlineDesc') {
        return parseDate(b.deadline) - parseDate(a.deadline);
      }
      if (sortBy === 'programName') {
        return String(a.programName).localeCompare(String(b.programName));
      }
      if (sortBy === 'recentlyAdded') {
        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
      }
      return 0;
    });
  }

  function getFormData() {
    const data = new FormData(form);
    return {
      search: normalizeText(data.get('search')),
      category: data.get('category') || 'all',
      region: data.get('region') || 'all',
      deadlineFrom: data.get('deadlineFrom') || '',
      deadlineTo: data.get('deadlineTo') || '',
      page: Number(data.get('page')) || 1,
      pageSize: pageSizeSelect ? Number(pageSizeSelect.value) || 10 : 10,
      sortBy: sortSelect ? sortSelect.value : 'deadlineAsc'
    };
  }

  function formatInputDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(date, offset) {
    const result = new Date(date);
    result.setDate(result.getDate() + offset);
    return result;
  }

  function startOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function getMonthGrid(startDate) {
    const firstOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    const dates = [];
    for (let i = 0; i < 42; i += 1) {
      dates.push(addDays(gridStart, i));
    }
    return dates;
  }

  function formatCalendarLabel(date) {
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }

  function getInitials(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word[0])
      .slice(0, 3)
      .join('')
      .toUpperCase();
  }

  function attachSettingsPopover(root) {
    const settingsButton = root.querySelector('[data-settings-toggle]');
    const settingsPopover = root.querySelector('[data-settings-popover]');
    if (!settingsButton || !settingsPopover) return;

    settingsButton.addEventListener('click', () => {
      const isOpen = settingsButton.getAttribute('aria-expanded') === 'true';
      settingsButton.setAttribute('aria-expanded', String(!isOpen));
      settingsPopover.hidden = isOpen;
    });
  }

  function changeCalendarFocus(direction) {
    if (calendarMode === 'month') {
      calendarFocusDate = addDays(new Date(calendarFocusDate.getFullYear(), calendarFocusDate.getMonth() + direction, 1), 0);
    } else {
      calendarFocusDate = addDays(calendarFocusDate, direction * 7);
    }
    renderResults();
  }

  function updateCalendarModeLabel() {
    if (!calendarModeLabel) return;
    if (currentView !== 'calendar') {
      calendarModeLabel.innerHTML = '';
    }
  }

  function changeCalendarMode(mode) {
    calendarMode = mode;
    updateCalendarModeLabel();
    renderResults();
  }

  function renderCalendarView(items) {
    const eventsByDate = items.reduce((acc, opportunity) => {
      const dateKey = parseDate(opportunity.deadline)?.toISOString().slice(0, 10);
      if (!dateKey) return acc;
      acc[dateKey] = acc[dateKey] || [];
      acc[dateKey].push(opportunity);
      return acc;
    }, {});

    const viewLabel = calendarMode === 'month'
      ? calendarFocusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `Week of ${formatCalendarLabel(startOfWeek(calendarFocusDate))}`;

    if (calendarModeLabel) {
      calendarModeLabel.innerHTML = `
        <div class="cal-toolbar">
          <div class="cal-nav">
            <button type="button" class="seg-icon-btn" data-nav="prev" aria-label="Previous ${calendarMode === 'month' ? 'month' : 'week'}">&#8249;</button>
            <button type="button" class="seg-icon-btn" data-nav="next" aria-label="Next ${calendarMode === 'month' ? 'month' : 'week'}">&#8250;</button>
            <button type="button" class="cal-nav__title">${viewLabel} <span class="cal-nav__caret">&#9660;</span></button>
          </div>
          <div class="cal-mode-group segmented-control" aria-label="Calendar controls">
            <button type="button" class="cal-mode-btn${calendarMode === 'month' ? ' cal-mode-btn--active' : ''}" data-mode="month">Month</button>
            <button type="button" class="cal-mode-btn${calendarMode === 'week' ? ' cal-mode-btn--active' : ''}" data-mode="week">Week</button>
            <button type="button" class="cal-mode-btn" data-nav="today">Today</button>
            <button type="button" class="cal-mode-btn cal-mode-btn--icon" data-settings-toggle aria-expanded="false" aria-controls="calendar-settings" aria-label="Calendar settings">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.18 2.18 0 1 1-3.08 3.08l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.2 2.2 0 1 1-4.4 0v-.08A1.8 1.8 0 0 0 8.1 19.3a1.8 1.8 0 0 0-1.98.36l-.05.05A2.18 2.18 0 1 1 3 16.63l.05-.05A1.8 1.8 0 0 0 3.4 14.6a1.8 1.8 0 0 0-1.66-1.1H1.7a2.2 2.2 0 1 1 0-4.4h.08A1.8 1.8 0 0 0 3.4 8a1.8 1.8 0 0 0-.36-1.98L3 5.97a2.18 2.18 0 1 1 3.08-3.08l.05.05A1.8 1.8 0 0 0 8.1 3.3a1.8 1.8 0 0 0 1.1-1.66V1.6a2.2 2.2 0 1 1 4.4 0v.08A1.8 1.8 0 0 0 14.7 3.3a1.8 1.8 0 0 0 1.98-.36l.05-.05A2.18 2.18 0 1 1 19.8 5.97l-.05.05A1.8 1.8 0 0 0 19.4 8c.08.28.32.67 1.1 1.1h.08a2.2 2.2 0 1 1 0 4.4h-.08A1.8 1.8 0 0 0 19.4 15Z"></path></svg>
            </button>
          </div>
          <div class="settings-popover" id="calendar-settings" data-settings-popover role="menu" aria-label="Visible properties" hidden>
            <div class="settings-popover__title">Visible properties</div>
            <label class="settings-option"><input type="checkbox" checked> <span>Program Title</span></label>
            <label class="settings-option"><input type="checkbox" checked> <span>University</span></label>
            <label class="settings-option"><input type="checkbox" checked> <span>Location</span></label>
            <label class="settings-option"><input type="checkbox"> <span>Deadline</span></label>
            <label class="settings-option"><input type="checkbox"> <span>Eligibility</span></label>
            <label class="settings-option"><input type="checkbox"> <span>Status</span></label>
          </div>
        </div>
      `;
      calendarModeLabel.querySelector('[data-nav="prev"]').addEventListener('click', () => changeCalendarFocus(-1));
      calendarModeLabel.querySelector('[data-nav="next"]').addEventListener('click', () => changeCalendarFocus(1));
      calendarModeLabel.querySelector('[data-nav="today"]').addEventListener('click', () => { calendarFocusDate = getToday(); renderResults(); });
      calendarModeLabel.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => changeCalendarMode(btn.dataset.mode));
      });
      attachSettingsPopover(calendarModeLabel);
    }

    const weekdayRow = document.createElement('div');
    weekdayRow.className = 'cal-weekday-row';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      const label = document.createElement('div');
      label.className = 'cal-weekday-label';
      label.textContent = day;
      weekdayRow.append(label);
    });

    const calendarGrid = document.createElement('div');
    calendarGrid.className = `cal-grid cal-grid--${calendarMode}`;

    let dates = [];
    if (calendarMode === 'month') {
      dates = getMonthGrid(calendarFocusDate);
    } else {
      const weekStart = startOfWeek(calendarFocusDate);
      for (let i = 0; i < 7; i += 1) {
        dates.push(addDays(weekStart, i));
      }
    }

    const today = getToday();
    const todayKey = today.toISOString().slice(0, 10);
    const lastRowStart = dates.length - 7;

    dates.forEach((date, index) => {
      const dateKey = date.toISOString().slice(0, 10);
      const dayEvents = eventsByDate[dateKey] || [];
      const isCurrentMonth = date.getMonth() === calendarFocusDate.getMonth();
      const isToday = dateKey === todayKey;

      const cell = document.createElement('div');
      let cellClass = 'cal-cell';
      if (!isCurrentMonth && calendarMode === 'month') cellClass += ' cal-cell--muted';
      cell.className = cellClass;
      if (index >= lastRowStart) cell.style.borderBottom = 'none';

      const numEl = document.createElement('div');
      numEl.className = 'cal-cell__num' + (isToday ? ' cal-cell__num--today' : '');
      numEl.textContent = String(date.getDate());
      cell.append(numEl);

      dayEvents.slice(0, 2).forEach(event => {
        const pill = document.createElement('a');
        pill.className = 'cal-event';
        pill.href = `opportunity.html?id=${encodeURIComponent(event.id)}`;
        pill.innerHTML = `
          <div class="cal-event__left">
            <span class="cal-event__dot"></span>
            <div class="cal-event__body">
              <div class="cal-event__title">${event.programName}</div>
              <div class="cal-event__sub">${event.hostInstitution}</div>
              <div class="cal-event__meta">${event.location}</div>
            </div>
          </div>
          <span class="cal-event__view">View</span>
        `;
        cell.append(pill);
      });

      if (dayEvents.length > 2) {
        const more = document.createElement('div');
        more.className = 'cal-more';
        more.textContent = `+${dayEvents.length - 2} more`;
        cell.append(more);
      }

      calendarGrid.append(cell);
    });

    resultsContainer.append(weekdayRow, calendarGrid);
  }

  function getTimelineStatus(range) {
    const today = getToday();
    if (range.end < today) return 'overdue';
    if (range.start <= today && range.end >= today) return 'in-progress';
    if (range.start <= addDays(today, 21)) return 'upcoming';
    return 'not-started';
  }

  function changeTimelineFocus(direction) {
    timelineFocusDate = addDays(timelineFocusDate, direction * 28);
    renderResults();
  }

  function getDayDiff(start, end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end - start) / msPerDay);
  }

  function renderTimelineView(items) {
    const validItems = items.filter(item => parseDate(item.deadline));
    if (validItems.length === 0) {
      resultsContainer.innerHTML = '<div class="card"><div class="card__title">No timeline data available.</div></div>';
      return;
    }

    const ranges = validItems.map(item => {
      const end = parseDate(item.endDate) || parseDate(item.deadline);
      const start = parseDate(item.startDate) || addDays(end, -6);
      return { item, start, end };
    }).filter(r => r.start && r.end && r.start <= r.end);

    if (ranges.length === 0) {
      resultsContainer.innerHTML = '<div class="card"><div class="card__title">No timeline ranges available.</div></div>';
      return;
    }

    const timelineStart = startOfWeek(timelineFocusDate);
    const visibleDays = 42;
    const timelineEnd = addDays(timelineStart, visibleDays - 1);
    const timelineLabel = `${timelineStart.toLocaleDateString('en-US', { month: 'long' })}-${timelineEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const days = Array.from({ length: visibleDays }, (_, index) => addDays(timelineStart, index));
    const monthGroups = days.reduce((groups, day) => {
      const monthKey = day.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === monthKey) {
        lastGroup.span += 1;
      } else {
        groups.push({ label: monthKey, span: 1 });
      }
      return groups;
    }, []);

    const toolbar = document.createElement('div');
    toolbar.className = 'timeline-toolbar';
    toolbar.innerHTML = `
      <div class="timeline-toolbar__main">
        <button type="button" class="seg-icon-btn" data-timeline-nav="prev" aria-label="Previous timeline range">&#8249;</button>
        <button type="button" class="seg-icon-btn" data-timeline-nav="next" aria-label="Next timeline range">&#8250;</button>
        <button type="button" class="cal-nav__title">${timelineLabel} <span class="cal-nav__caret">&#9660;</span></button>
        <button type="button" class="cal-mode-btn timeline-scale-btn">Weeks <span class="cal-nav__caret">&#9660;</span></button>
        <button type="button" class="cal-mode-btn cal-mode-btn--icon" data-settings-toggle aria-expanded="false" aria-controls="timeline-settings" aria-label="Timeline settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.18 2.18 0 1 1-3.08 3.08l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.2 2.2 0 1 1-4.4 0v-.08A1.8 1.8 0 0 0 8.1 19.3a1.8 1.8 0 0 0-1.98.36l-.05.05A2.18 2.18 0 1 1 3 16.63l.05-.05A1.8 1.8 0 0 0 3.4 14.6a1.8 1.8 0 0 0-1.66-1.1H1.7a2.2 2.2 0 1 1 0-4.4h.08A1.8 1.8 0 0 0 3.4 8a1.8 1.8 0 0 0-.36-1.98L3 5.97a2.18 2.18 0 1 1 3.08-3.08l.05.05A1.8 1.8 0 0 0 8.1 3.3a1.8 1.8 0 0 0 1.1-1.66V1.6a2.2 2.2 0 1 1 4.4 0v.08A1.8 1.8 0 0 0 14.7 3.3a1.8 1.8 0 0 0 1.98-.36l.05-.05A2.18 2.18 0 1 1 19.8 5.97l-.05.05A1.8 1.8 0 0 0 19.4 8c.08.28.32.67 1.1 1.1h.08a2.2 2.2 0 1 1 0 4.4h-.08A1.8 1.8 0 0 0 19.4 15Z"></path></svg>
        </button>
      </div>
      <div class="timeline-legend" aria-label="Timeline status legend">
        <span><i class="status-dot status-dot--in-progress"></i>In Progress</span>
        <span><i class="status-dot status-dot--upcoming"></i>Upcoming</span>
        <span><i class="status-dot status-dot--not-started"></i>Not Started</span>
        <span><i class="status-dot status-dot--overdue"></i>Overdue</span>
      </div>
      <div class="settings-popover" id="timeline-settings" data-settings-popover role="menu" aria-label="Visible properties" hidden>
        <div class="settings-popover__title">Visible properties</div>
        <label class="settings-option"><input type="checkbox" checked> <span>Program Title</span></label>
        <label class="settings-option"><input type="checkbox" checked> <span>University</span></label>
        <label class="settings-option"><input type="checkbox" checked> <span>Location</span></label>
        <label class="settings-option"><input type="checkbox"> <span>Deadline</span></label>
        <label class="settings-option"><input type="checkbox"> <span>Eligibility</span></label>
        <label class="settings-option"><input type="checkbox"> <span>Status</span></label>
      </div>
    `;
    toolbar.querySelector('[data-timeline-nav="prev"]').addEventListener('click', () => changeTimelineFocus(-1));
    toolbar.querySelector('[data-timeline-nav="next"]').addEventListener('click', () => changeTimelineFocus(1));
    attachSettingsPopover(toolbar);

    const timeline = document.createElement('div');
    timeline.className = 'notion-timeline';

    const axis = document.createElement('div');
    axis.className = 'notion-timeline__axis';
    axis.innerHTML = `
      <div class="notion-timeline__corner">Opportunity</div>
      <div class="notion-timeline__dates">
        <div class="notion-timeline__months"></div>
        <div class="notion-timeline__days"></div>
      </div>
    `;

    const monthRow = axis.querySelector('.notion-timeline__months');
    monthRow.style.gridTemplateColumns = monthGroups.map(group => `minmax(0, ${group.span}fr)`).join(' ');
    monthGroups.forEach(group => {
      const label = document.createElement('div');
      label.className = 'notion-timeline__month';
      label.textContent = group.label;
      monthRow.append(label);
    });

    const dayRow = axis.querySelector('.notion-timeline__days');
    days.forEach(day => {
      const label = document.createElement('div');
      label.className = 'notion-timeline__day';
      label.textContent = String(day.getDate());
      dayRow.append(label);
    });

    timeline.append(axis);

    ranges.forEach(range => {
      const { item, start, end } = range;
      const rowEl = document.createElement('div');
      rowEl.className = 'notion-timeline__row';

      const info = document.createElement('a');
      info.className = 'timeline-opportunity';
      info.href = `opportunity.html?id=${encodeURIComponent(item.id)}`;
      info.innerHTML = `
        <span class="timeline-opportunity__avatar">${getInitials(item.hostInstitution)}</span>
        <span class="timeline-opportunity__text">
          <strong>${item.programName}</strong>
          <span>${item.hostInstitution}</span>
          <span>${item.country || item.location}</span>
        </span>
      `;

      const lane = document.createElement('div');
      lane.className = 'notion-timeline__lane';

      const overlapsVisibleRange = end >= timelineStart && start <= timelineEnd;
      if (overlapsVisibleRange) {
        const visibleStart = start < timelineStart ? timelineStart : start;
        const visibleEnd = end > timelineEnd ? timelineEnd : end;
        const startIndex = Math.max(0, getDayDiff(timelineStart, visibleStart));
        const duration = Math.max(1, getDayDiff(visibleStart, visibleEnd) + 1);
        const leftPercent = (startIndex / visibleDays) * 100;
        const widthPercent = (duration / visibleDays) * 100;
        const status = getTimelineStatus(range);

        const bar = document.createElement('a');
        bar.className = `timeline-event timeline-event--bar timeline-event--${status}`;
        bar.href = `opportunity.html?id=${encodeURIComponent(item.id)}`;
        bar.style.left = `${leftPercent}%`;
        bar.style.width = `${widthPercent}%`;
        bar.innerHTML = `<span class="status-dot status-dot--${status}"></span>Application Window`;
        lane.append(bar);
      }

      rowEl.append(info, lane);
      timeline.append(rowEl);
    });

    resultsContainer.append(toolbar, timeline);
  }

  function getFilteredOpportunities() {
    const opportunities = typeof window.getOpportunities === 'function'
      ? window.getOpportunities()
      : [];
    const filters = getFormData();
    const today = getToday();

    return opportunities
      .filter(opportunity => normalizeText(opportunity.status) === 'published')
      .filter(opportunity => {
        const deadline = parseDate(opportunity.deadline);
        return deadline && deadline >= today;
      })
      .filter(opportunity => {
        if (!filters.search) return true;
        const haystack = [
          opportunity.programName,
          opportunity.hostInstitution,
          opportunity.location,
          opportunity.country,
          opportunity.category,
          opportunity.region
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(filters.search);
      })
      .filter(opportunity => {
        if (!filters.category || filters.category === 'all') return true;
        return normalizeText(opportunity.category) === normalizeText(filters.category);
      })
      .filter(opportunity => {
        if (!filters.region || filters.region === 'all') return true;
        return normalizeText(opportunity.region) === normalizeText(filters.region);
      })
      .filter(opportunity => {
        const deadline = parseDate(opportunity.deadline);
        if (filters.deadlineFrom) {
          const from = parseDate(filters.deadlineFrom);
          if (!deadline || deadline < from) return false;
        }
        if (filters.deadlineTo) {
          const to = parseDate(filters.deadlineTo);
          if (!deadline || deadline > to) return false;
        }
        return true;
      });
  }

  function renderOpportunityCard(opportunity) {
    const card = document.createElement('article');
    card.className = 'opp-row';

    const icon = document.createElement('div');
    icon.className = 'opp-icon';
    icon.textContent = getInitials(opportunity.hostInstitution);

    const info = document.createElement('div');
    info.className = 'opp-row__info';

    const titleRow = document.createElement('div');
    titleRow.className = 'flex-row align-center gap-8 mb-4';

    const title = document.createElement('span');
    title.className = 'opp-name';
    title.textContent = opportunity.programName;

    const statusChip = document.createElement('span');
    statusChip.className = `chip ${opportunity.eligible ? 'chip--green' : 'chip--ineligible'}`;
    statusChip.innerHTML = `<span class="chip__dot"></span>${opportunity.eligible ? 'Eligible' : 'Not eligible'}`;

    titleRow.append(title, statusChip);

    const meta = document.createElement('div');
    meta.className = 'opp-meta';
    meta.textContent = `${opportunity.hostInstitution} · ${opportunity.location}`;

    const description = document.createElement('div');
    description.className = 'opp-description';
    description.textContent = opportunity.description;
    description.style.marginTop = '10px';
    description.style.color = 'var(--text-muted)';
    description.style.fontSize = '13px';
    description.style.lineHeight = '1.6';
    description.style.maxWidth = '560px';

    info.append(titleRow, meta, description);

    const right = document.createElement('div');
    right.className = 'opp-row__right';

    const deadline = document.createElement('div');
    deadline.className = 'opp-row__deadline';
    deadline.innerHTML = `
      <div class="opp-row__deadline-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2"></rect>
          <path d="M8 2v4M16 2v4M3 10h18"></path>
        </svg>
      </div>
      <div class="opp-deadline-label">Deadline</div>
      <div class="opp-deadline-val">${new Date(opportunity.deadline).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })}</div>
    `;

    const viewLink = document.createElement('a');
    viewLink.className = opportunity.eligible ? 'btn btn--primary' : 'btn btn--secondary';
    viewLink.href = `opportunity.html?id=${encodeURIComponent(opportunity.id)}`;
    viewLink.innerHTML = 'View details <span aria-hidden="true">-></span>';

    right.append(deadline, viewLink);
    card.append(icon, info, right);
    return card;
  }

  function renderPagination(meta) {
    paginationContainer.innerHTML = '';

    const prevButton = document.createElement('button');
    prevButton.className = 'btn btn--secondary';
    prevButton.innerHTML = '&larr;';
    prevButton.disabled = meta.page <= 1;
    prevButton.addEventListener('click', () => updatePage(meta.page - 1));

    const nextButton = document.createElement('button');
    nextButton.className = 'btn btn--secondary';
    nextButton.innerHTML = '&rarr;';
    nextButton.disabled = meta.page >= meta.totalPages;
    nextButton.addEventListener('click', () => updatePage(meta.page + 1));

    const pageList = document.createElement('div');
    pageList.className = 'pagination-pages';

    const pages = [];
    for (let page = 1; page <= meta.totalPages; page += 1) {
      if (page <= 3 || page === meta.totalPages || Math.abs(page - meta.page) <= 1) {
        pages.push(page);
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis');
      }
    }

    pages.forEach(page => {
      if (page === 'ellipsis') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pageList.append(ellipsis);
        return;
      }

      const pageButton = document.createElement('button');
      pageButton.type = 'button';
      pageButton.className = `pagination-page${page === meta.page ? ' pagination-page--active' : ''}`;
      pageButton.textContent = String(page);
      pageButton.setAttribute('aria-label', `Go to page ${page}`);
      if (page === meta.page) {
        pageButton.setAttribute('aria-current', 'page');
      }
      pageButton.addEventListener('click', () => updatePage(page));
      pageList.append(pageButton);
    });

    const container = document.createElement('div');
    container.className = 'pagination';
    container.append(prevButton, pageList, nextButton);

    paginationContainer.append(container);
  }

  function setView(view) {
    currentView = view;
    viewTabs.forEach(tab => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle('view-tab--active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    updateCalendarModeLabel();
  }

  function renderCardView(items) {
    items.forEach(item => resultsContainer.append(renderOpportunityCard(item)));
  }

  function renderGalleryView(items) {
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    items.forEach(opportunity => {
      const card = document.createElement('article');
      card.className = 'gallery-card';

      const image = document.createElement('div');
      image.className = 'gallery-card__image gallery-card__image--ovperi';
      image.innerHTML = '<img src="../../public/images/OVPERI-white.png" alt="OVPERI">';

      const info = document.createElement('div');
      info.className = 'gallery-card__info';

      const title = document.createElement('div');
      title.className = 'gallery-card__title';
      title.textContent = opportunity.programName;

      const subtitle = document.createElement('div');
      subtitle.className = 'gallery-card__subtitle';
      subtitle.textContent = `${opportunity.hostInstitution} · ${new Date(opportunity.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const viewLink = document.createElement('a');
      viewLink.className = 'btn btn--ghost';
      viewLink.href = `opportunity.html?id=${encodeURIComponent(opportunity.id)}`;
      viewLink.textContent = 'View details';

      info.append(title, subtitle, viewLink);
      card.append(image, info);
      grid.append(card);
    });

    resultsContainer.append(grid);
  }

  function renderItemsByView(items) {
    if (currentView === 'gallery') {
      renderGalleryView(items);
      return;
    }
    if (currentView === 'calendar') {
      renderCalendarView(items);
      return;
    }
    if (currentView === 'timeline') {
      renderTimelineView(items);
      return;
    }
    renderCardView(items);
  }

  function updatePage(page) {
    if (formFields.page) formFields.page.value = String(page);
    renderResults();
  }

  function renderResults() {
    const formData = getFormData();
    const allFiltered = sortOpportunities(getFilteredOpportunities(), formData.sortBy);
    const total = allFiltered.length;
    const pageSize = formData.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, formData.page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = allFiltered.slice(startIndex, startIndex + pageSize);

    resultsContainer.innerHTML = '';

    if (pageItems.length === 0) {
      if (countLabel) countLabel.textContent = total === 0 ? 'No opportunities found.' : `Page ${currentPage} has no items.`;
      resultsContainer.innerHTML = '<div class="card"><div class="card__title">No opportunities match your filters.</div><div class="card__subtitle">Try broadening your search or clearing the date range.</div></div>';
      paginationContainer.innerHTML = '';
      if (formFields.page) formFields.page.value = '1';
      updateFilterControls();
      return;
    }

    renderItemsByView(pageItems);
    if (countLabel) countLabel.textContent = `${total} opportunit${total === 1 ? 'y' : 'ies'} found · page ${currentPage} of ${totalPages}`;
    renderPagination({ page: currentPage, totalPages, total });
    if (formFields.page) formFields.page.value = String(currentPage);
    updateFilterControls();
  }

  function syncFormFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const searchValue = params.get('search') || '';
    if (formFields.search) formFields.search.value = searchValue;
    if (filterSearchInput) filterSearchInput.value = searchValue;
    if (globalSearchInput) globalSearchInput.value = searchValue;
    if (formFields.category) formFields.category.value = params.get('category') || 'all';
    if (formFields.region) formFields.region.value = params.get('region') || 'all';
    if (formFields.deadlineFrom) formFields.deadlineFrom.value = params.get('deadlineFrom') || '';
    if (formFields.deadlineTo) formFields.deadlineTo.value = params.get('deadlineTo') || '';
    if (deadlineRangeSelect) {
      deadlineRangeSelect.value = params.get('deadlineRange') || 'any';
    }
    if (formFields.page) formFields.page.value = params.get('page') || '1';
    if (pageSizeSelect) {
      pageSizeSelect.value = params.get('pageSize') || '10';
    }
  }

  function applyDeadlineRange() {
    if (!deadlineRangeSelect) return;
    const value = deadlineRangeSelect.value;
    if (formFields.deadlineFrom) formFields.deadlineFrom.value = '';
    if (formFields.deadlineTo) formFields.deadlineTo.value = '';

    if (value === 'any') return;

    const days = Number(value);
    if (!Number.isFinite(days)) return;

    const today = getToday();
    if (formFields.deadlineFrom) formFields.deadlineFrom.value = formatInputDate(today);
    if (formFields.deadlineTo) formFields.deadlineTo.value = formatInputDate(addDays(today, days));
  }

  function resetFilters() {
    form.reset();
    if (globalSearchInput) globalSearchInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (formFields.page) formFields.page.value = '1';
    if (formFields.category) formFields.category.value = 'all';
    if (formFields.region) formFields.region.value = 'all';
    if (deadlineRangeSelect) deadlineRangeSelect.value = 'any';
    if (formFields.deadlineFrom) formFields.deadlineFrom.value = '';
    if (formFields.deadlineTo) formFields.deadlineTo.value = '';
    if (pageSizeSelect) pageSizeSelect.value = '10';
    renderResults();
  }

  function updateFilterControls() {
    if (!resetButton) return;
    const filters = getFormData();
    const hasActiveFilters = Boolean(filters.search)
      || filters.category !== 'all'
      || filters.region !== 'all'
      || Boolean(filters.deadlineFrom)
      || Boolean(filters.deadlineTo)
      || (deadlineRangeSelect && deadlineRangeSelect.value !== 'any')
      || (sortSelect && sortSelect.value !== 'deadlineAsc');
    resetButton.hidden = !hasActiveFilters;
  }

  function debounceRender() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderResults, 250);
  }

  function attachEvents() {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (formFields.page) formFields.page.value = '1';
      renderResults();
    });

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', function() {
        if (formFields.page) formFields.page.value = '1';
        renderResults();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        if (formFields.page) formFields.page.value = '1';
        renderResults();
      });
    }

    if (deadlineRangeSelect) {
      deadlineRangeSelect.addEventListener('change', function() {
        if (formFields.page) formFields.page.value = '1';
        applyDeadlineRange();
        renderResults();
      });
    }

    if (globalSearchInput) {
      globalSearchInput.addEventListener('input', function() {
        if (formFields.search) formFields.search.value = this.value;
        if (filterSearchInput) filterSearchInput.value = this.value;
        if (formFields.page) formFields.page.value = '1';
        debounceRender();
      });
    }

    if (filterSearchInput) {
      filterSearchInput.addEventListener('input', function() {
        if (formFields.search) formFields.search.value = this.value;
        if (globalSearchInput) globalSearchInput.value = this.value;
        if (formFields.page) formFields.page.value = '1';
        debounceRender();
      });
    }

    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setView(tab.dataset.view);
        renderResults();
      });
    });

    if (resetButton) resetButton.addEventListener('click', resetFilters);
  }

  function init() {
    syncFormFromUrl();
    if (deadlineRangeSelect && deadlineRangeSelect.value !== 'any') {
      applyDeadlineRange();
    }
    attachEvents();
    updateCalendarModeLabel();
    renderResults();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
