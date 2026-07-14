(function() {
  const documentVault = [
    { type: 'Academic transcript', fileName: 'grades_T32526.pdf', aliases: ['transcript', 'academic transcript', 'copy of grades'] },
    { type: 'Recommendation letter', fileName: 'recommendation_letter.pdf', aliases: ['recommendation letter', 'faculty recommendation', 'academic reference', 'faculty reference'] },
    { type: 'Passport', fileName: 'passport_biopage.jpg', aliases: ['passport', 'copy of passport', 'passport bio-page'] },
    { type: 'Valid ID', fileName: 'dlsu_id_scan.png', aliases: ['valid id', 'id card', 'identification'] },
    { type: 'Curriculum audit', fileName: 'curriculum_audit.pdf', aliases: ['curriculum audit', 'prerequisite course records'] },
    { type: 'CV', fileName: 'resume_2026.pdf', aliases: ['cv', 'resume'] },
    { type: 'Personal statement', fileName: 'personal_statement.pdf', aliases: ['personal statement', 'personal essay', 'statement of purpose'] }
  ];

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(copy of|proof of|academic|faculty|valid|latest|two|one)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findDocument(requirement) {
    const normalizedRequirement = normalize(requirement);
    return documentVault.find(document => document.aliases.some(alias => {
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
      if (document) bundle.push({ requirement, type: document.type, fileName: document.fileName });
      else missing.push(requirement);
    });

    return {
      bundle,
      missing,
      ready: Boolean(opportunity.eligible) && missing.length === 0
    };
  }

  async function submitApplicationToBackend(opportunity) {
    const evaluation = evaluateOpportunity(opportunity);
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: opportunity.id })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return {
        ok: false,
        error: result.error || `HTTP ${response.status}`,
        evaluation: {
          ...evaluation,
          missing: Array.isArray(result.missing) ? result.missing : evaluation.missing
        }
      };
    }
    return { ok: true, duplicate: false, application: result.data, evaluation };
  }

  window.GEMSApplicationStore = {
    documentVault,
    evaluateOpportunity,
    submitApplicationToBackend
  };
})();
