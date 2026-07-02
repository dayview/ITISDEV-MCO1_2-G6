(function() {
  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  const typeLabels = {
    transcript: 'Academic Transcript',
    recommendation: 'Recommendation Letter',
    validId: 'Valid ID',
    passport: 'Passport Bio-Page',
    EAF: 'Exchange Application Form',
    curriculumAudit: 'Curriculum Audit Form',
    other: 'Other Document'
  };

  function labelFor(type) {
    return typeLabels[type] || String(type || 'Document');
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderChecklist(requiredTypes, uploadedTypes) {
    const checklistBody = document.querySelectorAll('.doc-tbl tbody')[0];
    if (!checklistBody) return;
    if (!requiredTypes.length) {
      checklistBody.innerHTML = '<tr><td colspan="4">No required documents yet. Published opportunities will populate this checklist.</td></tr>';
      return;
    }
    checklistBody.innerHTML = requiredTypes.map(type => {
      const uploaded = uploadedTypes.has(type);
      return `
        <tr>
          <td>
            <div class="doc-name">
              <div class="doc-primary">${escapeHtml(labelFor(type))}</div>
              <div class="doc-secondary">Required by currently published opportunities</div>
            </div>
          </td>
          <td><span class="badge ${uploaded ? 'badge--uploaded' : 'badge--missing'}"><span class="badge__dot"></span>${uploaded ? 'Uploaded' : 'Missing'}</span></td>
          <td>${uploaded ? 'Ready' : 'Required'}</td>
          <td><button class="doc-btn ${uploaded ? '' : 'doc-btn--primary'}" onclick="triggerUpload()">${uploaded ? 'Replace' : 'Upload'}</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderFiles(documents) {
    const filesBody = document.querySelectorAll('.doc-tbl tbody')[1];
    if (!filesBody) return;
    if (!documents.length) {
      filesBody.innerHTML = '<tr><td colspan="5">No uploaded documents found for the current student.</td></tr>';
      return;
    }
    filesBody.innerHTML = documents.map(document => `
      <tr>
        <td>
          <div class="doc-name">
            <div class="doc-primary">${escapeHtml(document.fileName || labelFor(document.type))}</div>
            <div class="doc-secondary">${escapeHtml(labelFor(document.type))}</div>
          </div>
        </td>
        <td>${escapeHtml(document.fileFormat || 'file')}</td>
        <td>${escapeHtml(formatDate(document.uploadedAt))}</td>
        <td><span class="badge badge--uploaded"><span class="badge__dot"></span>Uploaded</span></td>
        <td><div class="doc-actions"><button class="doc-btn" onclick="alert('Viewing file...')">View</button><button class="doc-btn" onclick="alert('Downloading...')">Download</button></div></td>
      </tr>
    `).join('');
  }

  async function init() {
    try {
      const [documentsResponse, opportunitiesResponse] = await Promise.all([
        fetch('/api/student/documents'),
        fetch('/api/opportunities?pageSize=100')
      ]);
      const [documentsResult, opportunitiesResult] = await Promise.all([
        documentsResponse.json(),
        opportunitiesResponse.json()
      ]);
      if (!documentsResponse.ok || !documentsResult.success) throw new Error(documentsResult.error || `HTTP ${documentsResponse.status}`);
      if (!opportunitiesResponse.ok) throw new Error(opportunitiesResult.message || `HTTP ${opportunitiesResponse.status}`);

      const documents = documentsResult.data || [];
      const uploadedTypes = new Set(documents.map(document => document.type));
      const requiredTypes = [...new Set((opportunitiesResult.data || []).flatMap(opportunity => opportunity.requiredDocuments || []))];
      renderChecklist(requiredTypes, uploadedTypes);
      renderFiles(documents);
    } catch (error) {
      const filesBody = document.querySelectorAll('.doc-tbl tbody')[1];
      if (filesBody) filesBody.innerHTML = `<tr><td colspan="5">Unable to load documents: ${escapeHtml(error.message)}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
