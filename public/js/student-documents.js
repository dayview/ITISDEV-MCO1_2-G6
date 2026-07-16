(function () {
  const loadingEl = document.getElementById('documents-loading');
  const errorEl = document.getElementById('documents-error');
  const errorMessageEl = document.getElementById('documents-error-message');
  const retryButton = document.getElementById('documents-retry');
  const contentEl = document.getElementById('documents-content');
  const progressText = document.getElementById('doc-progress-text');
  const progressPct = document.getElementById('doc-progress-pct');
  const progressFill = document.getElementById('doc-progress-fill');
  const checklistBody = document.getElementById('doc-checklist-body');
  const vaultBody = document.getElementById('doc-vault-body');
  const vaultTable = document.getElementById('doc-vault-table');
  const vaultEmpty = document.getElementById('doc-vault-empty');
  const fileInput = document.getElementById('fileInput');
  const navAvatar = document.getElementById('nav-user-avatar');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  if (!contentEl) return;

  const STATUS_BADGE = {
    verified: { className: 'badge--uploaded', label: 'Verified', icon: 'pass' },
    pending: { className: 'badge--expires', label: 'Pending Review', icon: 'warn' },
    rejected: { className: 'badge--missing', label: 'Rejected', icon: 'fail' },
    missing: { className: 'badge--missing', label: 'Missing', icon: 'fail' }
  };

  const CHECK_ICON_GLYPH = { pass: '&#10003;', warn: '!', fail: '&#10007;' };

  let pendingDocumentType = 'other';

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
    if (!value) return 'Not uploaded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not uploaded';
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function showToast(message, isError) {
    if (!toast) return;
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.toggle('toast--error', Boolean(isError));
    toast.classList.add('show');
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function renderChecklist(checklist) {
    const total = checklist.totalCount || 0;
    const submitted = checklist.submittedCount || 0;
    const pct = checklist.percentage || 0;

    if (progressText) progressText.textContent = `${submitted} of ${total} submitted`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressFill) progressFill.style.width = `${pct}%`;

    checklistBody.innerHTML = checklist.items.map(item => {
      const badge = STATUS_BADGE[item.status] || STATUS_BADGE.missing;
      const actionLabel = item.status === 'missing' ? 'Upload' : 'Replace';
      const actionClass = item.status === 'missing' ? 'doc-btn doc-btn--primary' : 'doc-btn';
      const lastUpdated = item.document ? formatDate(item.document.uploadedAt) : '—';
      return `
        <tr>
          <td>
            <div class="doc-name">
              <div class="check-icon check-icon--${badge.icon}">${CHECK_ICON_GLYPH[badge.icon]}</div>
              <div>
                <div class="doc-primary">${escapeHtml(item.label)}</div>
              </div>
            </div>
          </td>
          <td><span class="badge ${badge.className}"><span class="badge__dot"></span>${escapeHtml(badge.label)}</span>${item.document?.rejectionReason ? `<p class="document-rejection-reason">${escapeHtml(item.document.rejectionReason)}</p>` : ''}</td>
          <td class="table-muted">${escapeHtml(lastUpdated)}</td>
          <td><button type="button" class="${actionClass}" data-upload-type="${escapeHtml(item.type)}">${actionLabel}</button></td>
        </tr>
      `;
    }).join('');

    checklistBody.querySelectorAll('[data-upload-type]').forEach(button => {
      button.addEventListener('click', () => {
        pendingDocumentType = button.dataset.uploadType;
        fileInput.click();
      });
    });
  }

  function renderVault(documents) {
    if (!documents.length) {
      vaultTable.hidden = true;
      vaultEmpty.hidden = false;
      vaultBody.innerHTML = '';
      return;
    }
    vaultTable.hidden = false;
    vaultEmpty.hidden = true;

    const isImage = (mimeType) => /^image\//i.test(mimeType || '');
    // Only PDF and image types can ever be uploaded (see the server-side allowlist), and
    // both render natively in a browser tab, so View is always offered alongside Download.
    const canView = (mimeType) => mimeType === 'application/pdf' || isImage(mimeType);

    vaultBody.innerHTML = documents.map(document => {
      const badge = STATUS_BADGE[document.status] || STATUS_BADGE.pending;
      const iconClass = isImage(document.mimeType) ? 'file-icon--img' : 'file-icon--pdf';
      return `
        <tr>
          <td>
            <div class="doc-name">
              <div class="file-icon ${iconClass}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
              </div>
              ${escapeHtml(document.originalFileName || 'Untitled file')}
            </div>
          </td>
          <td><span class="category-tag">${escapeHtml(document.type)}</span></td>
          <td class="table-muted">${escapeHtml(formatSize(document.size))}</td>
          <td class="table-muted">${escapeHtml(formatDate(document.uploadedAt))}</td>
          <td><span class="badge ${badge.className}"><span class="badge__dot"></span>${escapeHtml(badge.label)}</span>${document.rejectionReason ? `<p class="document-rejection-reason">${escapeHtml(document.rejectionReason)}</p>` : ''}</td>
          <td>
            <div class="doc-actions">
              ${canView(document.mimeType) ? `
                <a class="doc-btn" href="${escapeHtml(document.fileUrl)}" target="_blank" rel="noopener noreferrer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  View
                </a>
              ` : ''}
              <a class="doc-btn" href="${escapeHtml(document.fileUrl)}?download=1" download="${escapeHtml(document.originalFileName || '')}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button type="button" class="doc-btn doc-btn--danger" data-delete-id="${escapeHtml(document.id)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    vaultBody.querySelectorAll('[data-delete-id]').forEach(button => {
      button.addEventListener('click', () => handleDelete(button.dataset.deleteId));
    });
  }

  async function loadDocuments() {
    loadingEl.hidden = false;
    errorEl.hidden = true;
    contentEl.hidden = true;

    let response;
    try {
      response = await fetch('/api/documents');
    } catch (error) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Please check your connection and try again.';
      errorEl.hidden = false;
      return;
    }

    if (response.status === 401 || response.status === 403) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Your session has expired. Please sign in again.';
      errorEl.hidden = false;
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Unexpected response from the server.';
      errorEl.hidden = false;
      return;
    }

    if (!response.ok || !result.success) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = result.error || `HTTP ${response.status}`;
      errorEl.hidden = false;
      return;
    }

    renderChecklist(result.checklist || { items: [], submittedCount: 0, totalCount: 0, percentage: 0 });
    renderVault(Array.isArray(result.data) ? result.data : []);

    loadingEl.hidden = true;
    errorEl.hidden = true;
    contentEl.hidden = false;
  }

  async function handleUpload(file) {
    // Fast client-side pre-check for a responsive UI; the server independently
    // re-validates MIME type, extension, and size and is the actual authority.
    const maxSize = 5 * 1024 * 1024;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      showToast('Invalid format. Only PDF, JPG, and PNG are accepted.', true);
      return;
    }
    if (file.size > maxSize) {
      showToast('File exceeds the 5 MB limit. Please compress and try again.', true);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', pendingDocumentType);

    let response;
    try {
      // No Content-Type header here — the browser sets multipart/form-data with the
      // correct boundary automatically. Setting it manually would break the upload.
      response = await fetch('/api/documents', { method: 'POST', body: formData });
    } catch (error) {
      showToast('Unable to upload. Please check your connection and try again.', true);
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      showToast('Unexpected response from the server.', true);
      return;
    }

    if (!response.ok || !result.success) {
      showToast(result.error || 'Unable to upload this document.', true);
      return;
    }

    showToast(`Uploaded: ${file.name}`, false);
    await loadDocuments();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document? This cannot be undone.')) return;

    let response;
    try {
      response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      showToast('Unable to delete. Please check your connection and try again.', true);
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      showToast('Unexpected response from the server.', true);
      return;
    }

    if (!response.ok || !result.success) {
      showToast(result.error || 'Unable to delete this document.', true);
      return;
    }

    showToast('Document deleted.', false);
    await loadDocuments();
  }

  async function loadNavIdentity() {
    if (!navAvatar) return;
    try {
      const response = await fetch('/api/me');
      if (!response.ok) return;
      const result = await response.json();
      if (result.success && result.user) navAvatar.textContent = initials(result.user.name);
    } catch (error) {
      // Non-critical — leave the placeholder avatar as-is.
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) handleUpload(file);
  });

  if (retryButton) retryButton.addEventListener('click', loadDocuments);

  loadNavIdentity();
  loadDocuments();
})();
