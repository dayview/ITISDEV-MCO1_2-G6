(function() {
  const detailContainer = document.getElementById('opportunity-detail');
  const loadingState = document.getElementById('opportunity-loading');
  const errorState = document.getElementById('opportunity-error');

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderList(items) {
    if (!items || items.length === 0) {
      return '<div class="text-muted">Not available.</div>';
    }
    return `<ul class="detail-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
  }

  function renderMediaGallery(items) {
    if (!items || items.length === 0) {
      return '<div class="text-muted">No supporting media uploaded yet.</div>';
    }
    return `<div class="supporting-media-grid">${items.map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer"><img class="media-thumb" src="${url}" alt="Supporting media" /></a>`).join('')}</div>`;
  }

  function renderOpportunity(opportunity) {
    const deadline = new Date(opportunity.deadline).toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'numeric' });
    const icon = opportunity.hostInstitution.split(' ').map(word => word[0]).slice(0,3).join('').toUpperCase();
    const eligibleLabel = opportunity.eligible ? 'Eligible' : 'Not eligible';
    const eligibleClass = opportunity.eligible ? 'chip--green' : 'chip--ineligible';
    const logoMarkup = opportunity.hostLogo ? `<img class="detail-logo" src="${opportunity.hostLogo}" alt="${opportunity.hostInstitution} logo" />` : '';

    return `
      <div class="card card-lg">
        <div class="flex-row align-center gap-16 mb-16">
          <div class="opp-icon opp-icon--lg">${icon}</div>
          <div>
            <div class="flex-row align-center gap-12 mb-8">
              ${logoMarkup}
              <div>
                <div class="card__title">${opportunity.programName}</div>
                <div class="card__subtitle">${opportunity.hostInstitution} · ${opportunity.location}</div>
              </div>
            </div>
            <div class="flex-row gap-10">
              <span class="chip ${eligibleClass}"><span class="chip__dot"></span>${eligibleLabel}</span>
              <span class="chip chip--blue"><span class="chip__dot"></span>${opportunity.category}</span>
              <span class="chip chip--gray"><span class="chip__dot"></span>${opportunity.region}</span>
            </div>
          </div>
        </div>
        <div class="flex-row gap-20 mb-20">
          <div>
            <div class="opp-deadline-label">Application deadline</div>
            <div class="opp-deadline-val">${deadline}</div>
          </div>
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">Overview</div>
          <p>${opportunity.description}</p>
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">Eligibility criteria</div>
          ${renderList(opportunity.eligibilityCriteria)}
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">Required documents</div>
          ${renderList(opportunity.requiredDocuments)}
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">Supporting media</div>
          ${renderMediaGallery(opportunity.supportingMedia)}
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">Benefits</div>
          ${renderList(opportunity.benefits)}
        </div>
        <div class="detail-section mb-20">
          <div class="card__title--sm">How to apply</div>
          <p>${opportunity.applicationInstructions}</p>
        </div>
        <div class="flex-row gap-12">
          <a class="btn btn--primary" href="catalog.html">Back to catalog</a>
          <button class="btn btn--secondary" disabled>Start application</button>
        </div>
      </div>
    `;
  }

  async function loadDetail() {
    const id = getQueryParam('id');
    if (!id) {
      loadingState.style.display = 'none';
      errorState.textContent = 'Opportunity ID is missing.';
      errorState.style.display = 'block';
      return;
    }

    const response = await window.fakeApiFetch(`/api/opportunities/${encodeURIComponent(id)}`);
    const data = await response.json();
    loadingState.style.display = 'none';

    if (!response.ok) {
      errorState.textContent = data.message || 'Opportunity not found.';
      errorState.style.display = 'block';
      return;
    }

    detailContainer.innerHTML = renderOpportunity(data);
  }

  document.addEventListener('DOMContentLoaded', loadDetail);
})();
