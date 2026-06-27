(function() {
  const STORAGE_KEY = 'gems-admin-opportunities';
  const form = document.getElementById('opportunity-form');
  const workspace = document.getElementById('post-workspace');
  const accessDenied = document.getElementById('access-denied');
  const confirmation = document.getElementById('confirmation-message');
  const list = document.getElementById('admin-opportunity-list');
  const searchInput = document.getElementById('opportunity-search');
  const fields = Array.from(form.querySelectorAll('[required]'));

  if (document.body.dataset.userRole !== 'administrator') {
    workspace.hidden = true;
    accessDenied.hidden = false;
    return;
  }

  function getSaved() {
    return typeof window.getSavedOpportunities === 'function' ? window.getSavedOpportunities() : [];
  }

  function writeSaved(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function lines(value) {
    return value.split('\n').map(item => item.trim()).filter(Boolean);
  }

  function formValue(id) {
    return document.getElementById(id).value.trim();
  }

  function getRecord(status) {
    const id = formValue('opportunity-id') || `admin-${Date.now()}`;
    return {
      id,
      programName: formValue('program-name'),
      hostInstitution: formValue('host-institution'),
      location: formValue('location'),
      country: formValue('location').split(',').pop().trim(),
      region: formValue('region'),
      category: formValue('category'),
      description: formValue('description'),
      shortDescription: formValue('description').slice(0, 145),
      eligibilityCriteria: lines(formValue('eligibility-criteria')),
      requiredDocuments: lines(formValue('required-documents')),
      deadline: formValue('deadline'),
      benefits: lines(formValue('benefits')),
      status,
      eligible: true,
      applicationInstructions: 'Prepare all required documents and submit your application through the GEMS portal.',
      updatedAt: new Date().toISOString()
    };
  }

  function saveRecord(status) {
    const record = getRecord(status);
    const saved = getSaved();
    const index = saved.findIndex(item => String(item.id) === String(record.id));
    if (index >= 0) saved[index] = record;
    else saved.unshift(record);
    writeSaved(saved);
    document.getElementById('opportunity-id').value = record.id;
    setEditingState(record);
    renderList(searchInput.value);
    showConfirmation(status === 'published'
      ? 'Opportunity published successfully. It is now visible in the Opportunity Catalog.'
      : 'Draft saved successfully. You can return and publish it later.');
  }

  function validateForPublish() {
    let valid = true;
    fields.forEach(field => {
      const error = field.parentElement.querySelector('.field-error');
      field.removeAttribute('aria-invalid');
      error.textContent = '';
      if (!field.value.trim()) {
        field.setAttribute('aria-invalid', 'true');
        error.textContent = 'This field is required.';
        valid = false;
      }
    });

    const deadline = document.getElementById('deadline');
    if (deadline.value) {
      const selected = new Date(`${deadline.value}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        deadline.setAttribute('aria-invalid', 'true');
        deadline.parentElement.querySelector('.field-error').textContent = 'Deadline cannot be in the past.';
        valid = false;
      }
    }

    if (!valid) {
      form.querySelector('[aria-invalid="true"]').focus();
      showConfirmation('Please complete all required fields before publishing.', true);
    }
    return valid;
  }

  function showConfirmation(message, isError = false) {
    confirmation.textContent = message;
    confirmation.classList.toggle('post-confirmation--error', isError);
    confirmation.hidden = false;
    confirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setEditingState(record) {
    document.getElementById('form-title').textContent = record ? 'Edit Opportunity' : 'Post an Opportunity';
    document.getElementById('editing-status').textContent = record
      ? `${record.status === 'published' ? 'Published' : 'Draft'} · Editing`
      : 'New opportunity';
    document.getElementById('publish-opportunity').textContent =
      record && record.status === 'published' ? 'Update published opportunity' : 'Publish opportunity';
  }

  function populate(record) {
    const values = {
      'opportunity-id': record.id,
      'program-name': record.programName,
      'host-institution': record.hostInstitution,
      location: record.location,
      region: record.region,
      category: record.category,
      description: record.description,
      'eligibility-criteria': (record.eligibilityCriteria || []).join('\n'),
      'required-documents': (record.requiredDocuments || []).join('\n'),
      deadline: record.deadline,
      benefits: (record.benefits || []).join('\n')
    };
    Object.entries(values).forEach(([id, value]) => {
      document.getElementById(id).value = value || '';
    });
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      field.parentElement.querySelector('.field-error').textContent = '';
    });
    confirmation.hidden = true;
    setEditingState(record);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    form.reset();
    document.getElementById('opportunity-id').value = '';
    confirmation.hidden = true;
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      field.parentElement.querySelector('.field-error').textContent = '';
    });
    setEditingState(null);
    document.getElementById('program-name').focus();
  }

  function renderList(query = '') {
    const normalized = query.trim().toLowerCase();
    const items = getSaved()
      .filter(item => [item.programName, item.hostInstitution, item.location].join(' ').toLowerCase().includes(normalized))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'post-list-empty';
      empty.textContent = normalized ? 'No opportunities match your search.' : 'Your saved drafts and published opportunities will appear here.';
      list.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'admin-opportunity-item';
      const info = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = item.programName || 'Untitled opportunity';
      const host = document.createElement('p');
      host.textContent = item.hostInstitution || 'Host institution not added';
      const meta = document.createElement('div');
      const status = document.createElement('span');
      status.className = `post-item-status post-item-status--${item.status}`;
      status.textContent = item.status === 'published' ? 'Published' : 'Draft';
      const deadline = document.createElement('span');
      deadline.textContent = item.deadline ? `Deadline ${new Date(`${item.deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No deadline';
      meta.append(status, deadline);
      info.append(name, host, meta);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'post-edit-button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => populate(item));
      card.append(info, edit);
      list.appendChild(card);
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (validateForPublish()) saveRecord('published');
  });
  document.getElementById('save-draft').addEventListener('click', () => saveRecord('draft'));
  document.getElementById('new-opportunity').addEventListener('click', resetForm);
  searchInput.addEventListener('input', () => renderList(searchInput.value));
  fields.forEach(field => field.addEventListener('input', () => {
    if (field.value.trim()) {
      field.removeAttribute('aria-invalid');
      field.parentElement.querySelector('.field-error').textContent = '';
    }
  }));

  const requestedId = new URLSearchParams(window.location.search).get('id');
  const requested = requestedId && getSaved().find(item => String(item.id) === requestedId);
  if (requested) populate(requested);
  renderList();
})();
