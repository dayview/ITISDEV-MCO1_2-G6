(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GEMSApplicationStore = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  let documents = [];

  function normalizeDocumentType(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('transcript') || text.includes('grade')) return 'transcript';
    if (text.includes('recommendation') || text.includes('reference')) return 'recommendation';
    if (text.includes('passport')) return 'passport';
    if (text.includes('eaf') || text.includes('application form')) return 'EAF';
    if (text.includes('curriculum')) return 'curriculumAudit';
    if (text.includes('id')) return 'validId';
    return 'other';
  }

  function replaceDocuments(items) {
    documents = Array.isArray(items) ? items.slice() : [];
  }

  function getDocuments() {
    return documents.slice();
  }

  function getLatestDocumentsByType() {
    const latestByType = new Map();

    documents.forEach(document => {
      const type = normalizeDocumentType(document.type);
      const existing = latestByType.get(type);
      const uploadedAt = new Date(document.uploadedAt || document.createdAt || 0);
      const existingUploadedAt = new Date(existing?.uploadedAt || existing?.createdAt || 0);

      if (!existing || uploadedAt > existingUploadedAt) {
        latestByType.set(type, document);
      }
    });

    return latestByType;
  }

  function evaluateOpportunity(opportunity = {}) {
    const requirements = Array.isArray(opportunity.requiredDocuments)
      ? opportunity.requiredDocuments
      : [];
    const latestByType = getLatestDocumentsByType();
    const bundle = [];
    const missing = [];

    requirements.forEach(requirement => {
      const type = normalizeDocumentType(requirement);
      const document = latestByType.get(type);

      if (document) {
        bundle.push({
          requirement,
          type,
          fileName: document.originalFileName || 'Untitled file',
          documentId: String(document.id || document._id || ''),
          status: document.status || 'pending'
        });
      } else {
        missing.push(requirement);
      }
    });

    return {
      bundle,
      missing,
      ready: Boolean(opportunity.eligible) && missing.length === 0
    };
  }

  async function loadDocuments(fetchImpl = fetch) {
    try {
      const response = await fetchImpl('/api/documents');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      replaceDocuments(result.data);
      return getDocuments();
    } catch (error) {
      replaceDocuments([]);
      throw error;
    }
  }

  async function submitApplicationToBackend(opportunity, fetchImpl = fetch) {
    const evaluation = evaluateOpportunity(opportunity);
    const response = await fetchImpl('/api/applications', {
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

  return {
    normalizeDocumentType,
    getDocuments,
    loadDocuments,
    evaluateOpportunity,
    submitApplicationToBackend
  };
});
