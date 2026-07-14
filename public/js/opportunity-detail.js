(function() {
  const detailContainer = document.getElementById('opportunity-detail');
  const loadingState = document.getElementById('opportunity-loading');
  const errorState = document.getElementById('opportunity-error');

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderList(items, className = 'detail-list') {
    if (!items || items.length === 0) return '<div class="text-muted">Not available.</div>';
    return `<ul class="${className}">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function formatDeadline(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function renderBundle(evaluation) {
    if (evaluation.missing.length) {
      return `
        <div class="quick-apply-alert quick-apply-alert--warning">
          <strong>${evaluation.missing.length} document${evaluation.missing.length === 1 ? '' : 's'} needed</strong>
          <span>Upload the missing files to complete this application bundle.</span>
          ${renderList(evaluation.missing, 'quick-apply-missing-list')}
          <a href="documents.html">Upload missing documents &rarr;</a>
        </div>
      `;
    }

    return `
      <div class="quick-apply-alert quick-apply-alert--ready">
        <strong>Ready for 1-Click Apply</strong>
        <span>All ${evaluation.bundle.length} required documents are ready.</span>
      </div>
      <div class="quick-bundle-preview">
        <p>Document bundle</p>
        ${evaluation.bundle.map(document => `
          <div class="quick-bundle-file">
            <span aria-hidden="true">&#10003;</span>
            <div><strong>${escapeHtml(document.requirement)}</strong><small>${escapeHtml(document.fileName)}</small></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderOpportunity(opportunity, existing) {
    const evaluation = window.GEMSApplicationStore.evaluateOpportunity(opportunity);
    const icon = opportunity.hostInstitution.split(' ').map(word => word[0]).slice(0, 3).join('').toUpperCase();
    const eligibleLabel = opportunity.eligible ? 'Eligible' : 'Not eligible';
    const eligibleClass = opportunity.eligible ? 'chip--green' : 'chip--ineligible';

    detailContainer.innerHTML = `
      <div class="opportunity-layout">
        <article class="student-card opportunity-detail-card">
          <header class="opportunity-program-header">
            <div class="opp-icon opp-icon--lg">${escapeHtml(icon)}</div>
            <div class="opportunity-program-copy">
              <p class="opportunity-kicker">${escapeHtml(opportunity.category)} opportunity</p>
              <h2>${escapeHtml(opportunity.programName)}</h2>
              <p>${escapeHtml(opportunity.hostInstitution)} <span aria-hidden="true">&middot;</span> ${escapeHtml(opportunity.location)}</p>
              <div class="opportunity-chips">
                <span class="chip ${eligibleClass}"><span class="chip__dot"></span>${eligibleLabel}</span>
                <span class="chip chip--blue"><span class="chip__dot"></span>${escapeHtml(opportunity.category)}</span>
                <span class="chip chip--gray"><span class="chip__dot"></span>${escapeHtml(opportunity.region)}</span>
              </div>
            </div>
          </header>

          <section class="detail-section">
            <h3>Program overview</h3>
            <p>${escapeHtml(opportunity.description)}</p>
          </section>
          <div class="opportunity-detail-columns">
            <section class="detail-section">
              <h3>Eligibility criteria</h3>
              ${renderList(opportunity.eligibilityCriteria)}
            </section>
            <section class="detail-section">
              <h3>Required documents</h3>
              ${renderList(opportunity.requiredDocuments)}
            </section>
          </div>
          <section class="detail-section">
            <h3>Program benefits</h3>
            ${renderList(opportunity.benefits)}
          </section>
          <section class="detail-section">
            <h3>How to apply</h3>
            <p>${escapeHtml(opportunity.applicationInstructions)}</p>
          </section>
        </article>

        <aside class="student-card opportunity-apply-card">
          <div class="opportunity-apply-card__top">
            <p class="opportunity-apply-card__eyebrow">Application deadline</p>
            <div class="opportunity-deadline">${formatDeadline(opportunity.deadline)}</div>
          </div>
          <div id="quick-apply-feedback" aria-live="polite">
            ${existing ? `
              <div class="quick-apply-alert quick-apply-alert--success">
                <strong>Application submitted</strong>
                <span>Your document bundle is now with OVPERI for review.</span>
                <a href="applications.html">View application tracker &rarr;</a>
              </div>
            ` : renderBundle(evaluation)}
          </div>
          <button
            type="button"
            class="btn btn--primary opportunity-apply-button"
            id="quick-apply-button"
            ${!opportunity.eligible || existing ? 'disabled' : ''}
          >${existing ? 'Application submitted' : `
            <svg class="quick-apply-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M13 2 4.5 13h6L9 22l8.5-11h-6L13 2Z" fill="currentColor"></path>
            </svg>
            <span>Quick Apply</span>
          `}</button>
          <p class="quick-apply-privacy">By applying, your profile and listed documents will be securely bundled and submitted to OVPERI.</p>
          <a class="btn btn--secondary opportunity-catalog-button" href="catalog.html">Back to catalog</a>
        </aside>
      </div>
    `;

    const button = document.getElementById('quick-apply-button');
    if (!button || button.disabled) return;
    button.addEventListener('click', () => handleQuickApply(opportunity, button));
  }

  async function handleQuickApply(opportunity, button) {
    button.disabled = true;
    let result;
    try {
      result = await window.GEMSApplicationStore.submitApplicationToBackend(opportunity);
    } catch (error) {
      result = { ok: false, error: 'Unable to reach the server. Please check your connection and try again.', evaluation: window.GEMSApplicationStore.evaluateOpportunity(opportunity) };
    }
    const feedback = document.getElementById('quick-apply-feedback');

    if (!result.ok) {
      feedback.innerHTML = renderBundle(result.evaluation);
      if (result.error) {
        feedback.insertAdjacentHTML('afterbegin', `<div class="quick-apply-alert quick-apply-alert--warning"><strong>${escapeHtml(result.error)}</strong></div>`);
      }
      const uploadLink = feedback.querySelector('a');
      if (uploadLink) uploadLink.focus();
      button.disabled = false;
      return;
    }

    feedback.innerHTML = `
      <div class="quick-apply-alert quick-apply-alert--success" role="status">
        <strong>${result.duplicate ? 'Already submitted' : 'Application submitted successfully!'}</strong>
        <span>Your application was sent to OVPERI for review.</span>
        <a href="applications.html">View application and bundle &rarr;</a>
      </div>
    `;
    button.textContent = 'Application submitted';
    button.disabled = true;
  }

  async function loadExistingApplication(opportunityId) {
    try {
      const response = await fetch('/api/applications/my');
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) return null;
      return result.data.find(application => String(application.opportunityId) === String(opportunityId)) || null;
    } catch (error) {
      return null;
    }
  }

  async function loadDetail() {
    const id = getQueryParam('id');
    if (!id) {
      loadingState.hidden = true;
      errorState.querySelector('h2').textContent = 'Opportunity ID is missing';
      errorState.querySelector('p').textContent = 'Please return to the catalog and select an opportunity.';
      errorState.hidden = false;
      return;
    }

    try {
      const response = await window.fakeApiFetch(`/api/opportunities/${encodeURIComponent(id)}`);
      const data = await response.json();
      loadingState.hidden = true;
      if (!response.ok) {
        errorState.querySelector('h2').textContent = data.message || 'Opportunity not found';
        errorState.hidden = false;
        return;
      }
      const existing = await loadExistingApplication(data.id);
      renderOpportunity(data, existing);
    } catch (error) {
      loadingState.hidden = true;
      errorState.querySelector('h2').textContent = 'Unable to load opportunity';
      errorState.querySelector('p').textContent = 'Please check your connection and try again.';
      errorState.hidden = false;
      console.error('Failed to load opportunity details:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', loadDetail);
})();
