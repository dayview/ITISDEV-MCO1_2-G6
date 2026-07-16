(function() {
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

  function getLatestDocumentsByType(documents) {
    const latestByType = new Map();

    documents.forEach(document => {
      const current = latestByType.get(document.type);
      const uploadedAt = new Date(document.uploadedAt || 0);
      const currentUploadedAt = current ? new Date(current.uploadedAt || 0) : null;

      if (!current || uploadedAt > currentUploadedAt) {
        latestByType.set(document.type, document);
      }
    });

    return latestByType;
  }

  function evaluateOpportunity(opportunity, documents = []) {
    const requirements = Array.isArray(opportunity.requiredDocuments) ? opportunity.requiredDocuments : [];
    const latestDocumentsByType = getLatestDocumentsByType(documents);
    const bundle = [];
    const missing = [];

    requirements.forEach(requirement => {
      const type = normalizeDocumentType(requirement);
      const document = latestDocumentsByType.get(type);

      if (!document) {
        missing.push(requirement);
        return;
      }

      bundle.push({
        requirement,
        type,
        fileName: document.originalFileName || 'Uploaded document',
        status: document.status || 'pending'
      });
    });

    return {
      bundle,
      missing,
      ready: Boolean(opportunity.eligible) && missing.length === 0
    };
  }

  async function loadStudentDocuments() {
    const response = await fetch('/api/documents');
    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Unexpected response while loading documents.');
    }

    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      throw new Error(result.error || `Unable to load documents (HTTP ${response.status}).`);
    }

    return result.data;
  }

  async function submitApplicationToBackend(opportunity, documents = []) {
    const evaluation = evaluateOpportunity(opportunity, documents);
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: opportunity.id })
    });

    let result;
    try {
      result = await response.json();
    } catch (error) {
      return {
        ok: false,
        error: 'Unexpected response while submitting the application.',
        evaluation
      };
    }

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

    return {
      ok: true,
      application: result.data,
      evaluation
    };
  }

  window.GEMSApplicationStore = {
    normalizeDocumentType,
    evaluateOpportunity,
    loadStudentDocuments,
    submitApplicationToBackend
  };
})();
