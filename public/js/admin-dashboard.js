/**
 * Handles fetching, rendering, sorting, filtering, and bulk actions
 */

let currentApplications = [];
let selectedIds = new Set();
let currentSort = 'recency';
let currentFilters = {};

const API_BASE = '/api';

/**
 * Fetch applications from backend with current filters and sort
 */
async function fetchApplications() {
  try {
    // Show loading state
    const container = document.getElementById('applications-container');
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading applications...</div>';

    const params = new URLSearchParams();
    params.append('sort', currentSort);

    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const response = await fetch(`${API_BASE}/applications?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    currentApplications = (result.data || []).map(app => ({
      ...app,
      documentsStatus: app.documentsStatus ?? app.documents_status ?? 'incomplete',
      submittedDate: app.submittedDate ?? app.submitted_date ?? null
    }));
    renderApplications();
    updateStatistics();

    console.log(`Loaded ${currentApplications.length} applications`);
  } catch (err) {
    console.error('Error fetching applications:', err);
    const container = document.getElementById('applications-container');
    container.innerHTML = `<div style="padding: 20px; color: var(--red-dark);">Error loading applications: ${err.message}</div>`;
  }
}

/**
 * Render applications table
 */
function renderApplications() {
  const container = document.getElementById('applications-container');

  if (currentApplications.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No applications found</div>';
    return;
  }

  let html = '';

  currentApplications.forEach((app) => {
    const isSelected = selectedIds.has(app.id);
    const statusColor = getStatusColor(app.status);
    const docsStatusColor = app.documentsStatus === 'complete' ? 'green' : 'red';

    html += `
      <div class="table-row" role="row" data-app-id="${app.id}">
        <div>
          <input type="checkbox" class="app-checkbox" value="${app.id}" ${isSelected ? 'checked' : ''} />
        </div>
        <div>
          <div class="table-cell-primary">${app.name}</div>
          <div class="table-cell-secondary">${app.student_id} · ${app.college}</div>
        </div>
        <div>
          <div class="table-cell-primary">${app.opp_name}</div>
          <div class="table-cell-secondary">${app.institution}</div>
        </div>
        <div class="table-cell">${app.cgpa}</div>
        <div class="table-cell">${formatDate(app.submittedDate)}</div>
        <div>
          <span class="chip chip--${docsStatusColor}">
            <span class="chip__dot"></span>${capitalize(app.documentsStatus || 'incomplete')}
          </span>
        </div>
        <div>
          <span class="chip chip--${statusColor}">
            <span class="chip__dot"></span>${capitalize(app.status.replace('-', ' '))}
          </span>
        </div>
        <div class="table-actions">
          <button class="btn-icon approve-btn" title="Approve" data-id="${app.id}" data-status="nominated">
            ✓
          </button>
          <button class="btn-icon reject-btn" title="Reject" data-id="${app.id}" data-status="rejected">
            ✕
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach event listeners
  attachCheckboxListeners();
  attachActionButtonListeners();
}

/**
 * Attach checkbox change listeners
 */
function attachCheckboxListeners() {
  const checkboxes = document.querySelectorAll('.app-checkbox');
  const selectAll = document.getElementById('select-all');

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const appId = e.target.value;
      if (e.target.checked) {
        selectedIds.add(appId);
      } else {
        selectedIds.delete(appId);
      }
      updateBulkActionButtons();

      // Update select-all checkbox
      const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
      selectAll.checked = allChecked;
    });
  });

  if (selectAll) {
    selectAll.onchange = (e) => {
      if (e.target.checked) {
        currentApplications.forEach(app => selectedIds.add(app.id));
      } else {
        selectedIds.clear();
      }
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
      updateBulkActionButtons();
    };
  }
}

/**
 * Attach quick action button listeners
 */
function attachActionButtonListeners() {
  const approveButtons = document.querySelectorAll('.approve-btn');
  const rejectButtons = document.querySelectorAll('.reject-btn');

  approveButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const appId = btn.dataset.id;
      const status = 'nominated';
      await updateApplicationStatus(appId, status);
    });
  });

  rejectButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const appId = btn.dataset.id;
      const status = 'rejected';
      await updateApplicationStatus(appId, status);
    });
  });
}

/**
 * Update a single application status
 */
async function updateApplicationStatus(appId, status) {
  try {
    const response = await fetch(`${API_BASE}/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    // Refetch to update UI
    await fetchApplications();
    console.log(`Updated application ${appId} to ${status}`);
  } catch (err) {
    console.error('Error updating application:', err);
    alert(`Error: ${err.message}`);
  }
}

/**
 * Update bulk action buttons based on selection
 */
function updateBulkActionButtons() {
  const badge = document.getElementById('selection-badge');
  const exportBtn = document.getElementById('export-btn');
  const batchApproveBtn = document.getElementById('batch-approve-btn');
  const count = selectedIds.size;

  if (!badge || !exportBtn || !batchApproveBtn) return;

  if (count > 0) {
    badge.style.display = 'inline-block';
    document.getElementById('selection-count').textContent = count;
    exportBtn.style.display = 'inline-block';
    batchApproveBtn.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
    exportBtn.style.display = 'none';
    batchApproveBtn.style.display = 'none';
  }
}

/**
 * Batch approve selected applications
 */
async function batchApprove() {
  if (selectedIds.size === 0) {
    alert('Please select applications to approve');
    return;
  }

  if (!confirm(`Approve ${selectedIds.size} applications?`)) return;

  try {
    const response = await fetch(`${API_BASE}/applications/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), status: 'nominated' })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    selectedIds.clear();
    await fetchApplications();
    console.log(`Batch approved ${result.count} applications`);
  } catch (err) {
    console.error('Error batch approving:', err);
    alert(`Error: ${err.message}`);
  }
}

/**
 * Export selected applications as CSV
 */
async function exportCSV() {
  try {
    const params = new URLSearchParams();
    Array.from(selectedIds).forEach(id => params.append('ids', id));
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.college) params.append('college', currentFilters.college);
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.documentsStatus) params.append('documentsStatus', currentFilters.documentsStatus);

    window.location.href = `${API_BASE}/applications/export?${params}`;
  } catch (err) {
    console.error('Error exporting:', err);
    alert(`Error: ${err.message}`);
  }
}

/**
 * Update dashboard statistics
 */
async function updateStatistics() {
  try {
    const response = await fetch(`${API_BASE}/statistics`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    const stats = result.data;

    // Update stat cards
    updateStatCard('pending', stats.pending, `${stats.urgent} urgent · deadline < 7d`);
    updateStatCard('nominated', stats.nominated, 'Awaiting partner reply');
    updateStatCard('accepted', stats.accepted, 'Current accepted applications');
    updateStatCard('live-programs', stats.livePrograms, `across ${stats.countries} countries`);
  } catch (err) {
    console.error('Error updating statistics:', err);
  }
}

/**
 * Update a stat card with new values
 */
function updateStatCard(statKey, value, subtitle) {
  const card = document.querySelector(`[data-stat="${statKey}"]`);
  if (!card) return;

  const valueEl = card.querySelector('.stat-card__value');
  const subEl = card.querySelector('.stat-card__sub');

  if (valueEl) valueEl.textContent = value;
  if (subEl) subEl.innerHTML = subtitle;
}

/**
 * Setup sort buttons
 */
function setupSortButtons() {
  const sortBtns = document.querySelectorAll('.sort-btn');
  sortBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      currentSort = btn.dataset.sort;

      // Update active state
      sortBtns.forEach(b => b.classList.remove('sort-btn--active'));
      btn.classList.add('sort-btn--active');

      // Update subtitle
      const subtitle = document.getElementById('queue-subtitle');
      const sortLabels = {
        'recency': 'Sorted by recency (newest first)',
        'urgency': 'Sorted by urgency (nearest deadline)',
        'status': 'Sorted by status',
        'college': 'Sorted by college',
        'cgpa': 'Sorted by CGPA (highest first)',
        'documents': 'Sorted by documents'
      };
      if (subtitle) subtitle.textContent = sortLabels[currentSort];

      await fetchApplications();
    });
  });
}

/**
 * Setup filter pills
 */
function setupFilterPills() {
  const filterPills = document.querySelectorAll('.pill--filter');
  filterPills.forEach(pill => {
    pill.addEventListener('click', async (e) => {
      e.preventDefault();
      const filterType = pill.dataset.filterType;
      const filterValue = pill.dataset.filterValue;

      if (filterType === 'sort') {
        currentSort = filterValue || 'recency';
        delete currentFilters.documentsStatus;
        delete currentFilters.status;
      } else {
        currentSort = 'recency';
        if (filterValue) {
          currentFilters[filterType] = filterValue;
        } else {
          delete currentFilters[filterType];
          delete currentFilters.documentsStatus;
        }
      }

      filterPills.forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');

      const subtitle = document.getElementById('queue-subtitle');
      if (subtitle) {
        subtitle.textContent = filterType === 'sort'
          ? 'Sorted by urgency · nearest deadline first'
          : filterValue === 'incomplete'
            ? 'Showing applications with incomplete documents'
            : 'Sorted by recency · newest first';
      }

      await fetchApplications();
    });
  });

  // Set initial active state
  filterPills.forEach(pill => {
    if (pill.dataset.filterValue === '') {
      pill.classList.add('pill--active');
    }
  });
}

/**
 * Setup search input
 */
function setupSearchInput() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      currentFilters.search = e.target.value;
      await fetchApplications();
    }, 500);
  });
}

/**
 * Setup compact topbar actions.
 */
function setupTopbarActions() {
  const filterToggle = document.getElementById('admin-filter-toggle');
  const notificationBtn = document.getElementById('admin-notification-btn');
  const incompletePill = document.querySelector('.pill--filter[data-filter-type="documentsStatus"]');

  if (filterToggle && incompletePill) {
    filterToggle.addEventListener('click', () => incompletePill.click());
  }

  if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
      let notice = document.getElementById('admin-notification-status');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'admin-notification-status';
        notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;top:76px;right:24px;z-index:30;padding:12px 14px;border-radius:8px;background:#ffffff;border:1px solid rgba(15,122,61,.18);box-shadow:0 16px 40px rgba(15,23,42,.14);color:#123524;font-size:14px;';
        document.body.appendChild(notice);
      }
      notice.textContent = 'Notifications are not available yet.';
      window.clearTimeout(notice._hideTimer);
      notice._hideTimer = window.setTimeout(() => notice.remove(), 2500);
    });
  }
}

/**
 * Setup batch action buttons
 */
function setupBatchActionButtons() {
  const batchApproveBtn = document.getElementById('batch-approve-btn');
  const exportBtn = document.getElementById('export-btn');

  if (batchApproveBtn) {
    batchApproveBtn.addEventListener('click', batchApprove);
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }
}

/**
 * Helper: Get color for status
 */
function getStatusColor(status) {
  const colors = {
    'submitted': 'gray',
    'under-review': 'blue',
    'nominated': 'blue',
    'accepted': 'green',
    'rejected': 'red'
  };
  return colors[status] || 'gray';
}

/**
 * Helper: Format date from YYYY-MM-DD
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Not available';

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Helper: Capitalize string
 */
function capitalize(str) {
  const value = typeof str === 'string' ? str : '';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not available';
}

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing GEMS Admin Dashboard...');

  setupFilterPills();
  setupSearchInput();
  setupBatchActionButtons();
  setupTopbarActions();

  await fetchApplications();

  console.log('Dashboard initialized and ready');
});
