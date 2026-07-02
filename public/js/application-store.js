(function() {
  const APPLICATIONS_KEY = 'gems-student-applications';

  const student = {
    name: 'Leah Pineda',
    studentId: '2023-04589',
    college: 'CCS',
    cgpa: '3.42',
    email: 'leah.pineda@dlsu.edu.ph',
    profileComplete: true
  };

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

  function readApplications() {
    try {
      const saved = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn('Unable to read saved applications.', error);
      return [];
    }
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
      profileComplete: student.profileComplete,
      bundle,
      missing,
      ready: student.profileComplete && Boolean(opportunity.eligible) && missing.length === 0
    };
  }

  function submitApplication(opportunity) {
    const evaluation = evaluateOpportunity(opportunity);
    if (!evaluation.ready) return { ok: false, evaluation };

    const applications = readApplications();
    const existing = applications.find(item => String(item.opportunityId) === String(opportunity.id));
    if (existing) return { ok: true, duplicate: true, application: existing, evaluation };

    const now = new Date();
    const application = {
      id: `quick-${Date.now()}`,
      opportunityId: String(opportunity.id),
      programName: opportunity.programName,
      hostInstitution: opportunity.hostInstitution,
      location: opportunity.location,
      deadline: opportunity.deadline,
      student,
      status: 'submitted',
      documentsStatus: 'complete',
      submissionMethod: '1-Click Apply',
      submittedAt: now.toISOString(),
      bundle: evaluation.bundle,
      emailNotification: {
        sent: true,
        recipient: student.email,
        sentAt: now.toISOString()
      }
    };

    applications.unshift(application);
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
    return { ok: true, duplicate: false, application, evaluation };
  }

  window.GEMSApplicationStore = {
    student,
    documentVault,
    getApplications: readApplications,
    evaluateOpportunity,
    submitApplication
  };
})();
