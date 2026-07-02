(function() {
  const documentAliases = {
    transcript: ['transcript', 'academic transcript', 'copy of grades', 'grades'],
    recommendation: ['recommendation', 'recommendation letter', 'academic reference'],
    passport: ['passport', 'passport bio-page', 'copy of passport'],
    validId: ['valid id', 'id card', 'identification'],
    curriculumAudit: ['curriculum audit', 'curriculum audit form'],
    EAF: ['eaf', 'exchange application form'],
    other: ['other']
  };

  let profile = null;
  let documents = [];
  let applications = [];

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.error || result.message || `HTTP ${response.status}`);
    }
    return result;
  }

  async function refresh() {
    const [profileResult, documentsResult, applicationsResult] = await Promise.all([
      requestJson('/api/student/profile'),
      requestJson('/api/student/documents'),
      requestJson('/api/student/applications')
    ]);
    profile = profileResult.data;
    documents = documentsResult.data || [];
    applications = applicationsResult.data || [];
    return { profile, documents, applications };
  }

  function getDocumentAliases(type) {
    return documentAliases[type] || [type];
  }

  function findDocument(requirement) {
    const normalizedRequirement = normalize(requirement);
    return documents.find(document => getDocumentAliases(document.type).some(alias => {
      const normalizedAlias = normalize(alias);
      return normalizedRequirement.includes(normalizedAlias) || normalizedAlias.includes(normalizedRequirement);
    }));
  }

  function evaluateOpportunity(opportunity) {
    const requirements = opportunity.requiredDocuments || [];
    const bundle = [];
    const missing = [];

    requirements.forEach(requirement => {
      const document = findDocument(requirement);
      if (document) {
        bundle.push({ requirement, type: document.type, fileName: document.fileName || document.type });
      } else {
        missing.push(requirement);
      }
    });

    return {
      profileComplete: Boolean(profile?.profileComplete),
      bundle,
      missing,
      ready: Boolean(profile?.profileComplete) && Boolean(opportunity.eligible) && missing.length === 0
    };
  }

  async function submitApplication(opportunity) {
    const evaluation = evaluateOpportunity(opportunity);
    if (!evaluation.ready) return { ok: false, evaluation };

    const existing = applications.find(item => String(item.opportunityId || item.opportunity_id) === String(opportunity.id));
    if (existing) return { ok: true, duplicate: true, application: existing, evaluation };

    const result = await requestJson('/api/applications', {
      method: 'POST',
      body: JSON.stringify({
        opportunityId: opportunity.id,
        documentsStatus: evaluation.missing.length ? 'incomplete' : 'complete'
      })
    });
    await refresh();
    return { ok: true, duplicate: Boolean(result.duplicate), application: result.data, evaluation };
  }

  window.GEMSApplicationStore = {
    get student() { return profile; },
    get documentVault() { return documents; },
    init: refresh,
    refresh,
    getApplications: () => applications,
    getDocuments: () => documents,
    evaluateOpportunity,
    submitApplication
  };
})();
