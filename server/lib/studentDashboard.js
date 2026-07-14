const { evaluateStudentEligibility } = require('./eligibility');
const { mapOpportunity } = require('./opportunities');

const PROFILE_FIELDS = ['college', 'major', 'cgpa', 'graduatingTerm'];

const computeProfileCompletion = (student = {}) => {
    const filled = PROFILE_FIELDS.filter(field => {
        const value = student[field];
        return value !== undefined && value !== null && value !== '';
    }).length;
    return Math.round((filled / PROFILE_FIELDS.length) * 100);
};

const computeApplicationStats = (applications = []) => {
    const counts = { submitted: 0, 'under-review': 0, nominated: 0, accepted: 0, rejected: 0 };
    applications.forEach(application => {
        if (application.status in counts) counts[application.status] += 1;
    });
    return {
        total: applications.length,
        active: counts.submitted + counts['under-review'] + counts.nominated,
        inReview: counts.submitted + counts['under-review'],
        nominated: counts.nominated,
        accepted: counts.accepted,
        rejected: counts.rejected,
        incompleteDocuments: applications.filter(application => application.documentsStatus === 'incomplete').length
    };
};

const appliedOpportunityIdSet = (applications = []) => new Set(
    applications.map(application => String(application.opportunityId?._id || application.opportunityId))
);

const buildRecommendedOpportunities = (openOpportunities = [], student = {}, documents = [], appliedIds = new Set(), limit = 3) => {
    return openOpportunities
        .filter(opportunity => !appliedIds.has(String(opportunity._id)))
        .filter(opportunity => evaluateStudentEligibility(student, opportunity, documents).eligible)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, limit)
        .map(mapOpportunity);
};

const buildUpcomingDeadlines = (openOpportunities = [], relevantIds = new Set(), limit = 5) => {
    return openOpportunities
        .filter(opportunity => relevantIds.has(String(opportunity._id)))
        .slice()
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, limit)
        .map(opportunity => ({
            id: String(opportunity._id),
            programName: opportunity.name,
            hostInstitution: opportunity.institution,
            deadline: opportunity.deadline
        }));
};

const buildRecentApplications = (applications = [], limit = 5) => {
    return applications
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.submittedDate) - new Date(a.createdAt || a.submittedDate))
        .slice(0, limit)
        .map(application => ({
            id: String(application._id),
            opportunityId: String(application.opportunityId?._id || application.opportunityId),
            programName: application.opportunityId?.name || 'Unknown opportunity',
            hostInstitution: application.opportunityId?.institution || '',
            status: application.status,
            documentsStatus: application.documentsStatus,
            submittedAt: application.submittedDate || application.createdAt
        }));
};

const countNewThisMonth = (openOpportunities = [], now = new Date(), windowDays = 30) => {
    const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    return openOpportunities.filter(opportunity => opportunity.createdAt && new Date(opportunity.createdAt) >= cutoff).length;
};

const countEligibleOpportunities = (openOpportunities = [], student = {}, documents = [], appliedIds = new Set()) => {
    return openOpportunities
        .filter(opportunity => !appliedIds.has(String(opportunity._id)))
        .filter(opportunity => evaluateStudentEligibility(student, opportunity, documents).eligible)
        .length;
};

const buildStudentDashboard = ({ student, applications = [], openOpportunities = [], documents = [], now = new Date() }) => {
    const appliedIds = appliedOpportunityIdSet(applications);
    const recommendedOpportunities = buildRecommendedOpportunities(openOpportunities, student, documents, appliedIds, 3);
    const deadlineRelevantIds = new Set([
        ...recommendedOpportunities.map(opportunity => opportunity.id),
        ...applications
            .filter(application => ['submitted', 'under-review', 'nominated'].includes(application.status))
            .map(application => String(application.opportunityId?._id || application.opportunityId))
    ]);

    return {
        student: {
            id: String(student._id),
            name: student.name,
            college: student.college,
            cgpa: student.cgpa,
            profileCompletion: computeProfileCompletion(student)
        },
        applicationStats: computeApplicationStats(applications),
        eligibleOpportunityCount: countEligibleOpportunities(openOpportunities, student, documents, appliedIds),
        newOpportunitiesThisMonth: countNewThisMonth(openOpportunities, now),
        recommendedOpportunities,
        upcomingDeadlines: buildUpcomingDeadlines(openOpportunities, deadlineRelevantIds, 5),
        recentApplications: buildRecentApplications(applications, 5)
    };
};

module.exports = {
    PROFILE_FIELDS,
    computeProfileCompletion,
    computeApplicationStats,
    appliedOpportunityIdSet,
    buildRecommendedOpportunities,
    buildUpcomingDeadlines,
    buildRecentApplications,
    countNewThisMonth,
    countEligibleOpportunities,
    buildStudentDashboard
};
