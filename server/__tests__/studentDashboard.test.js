const {
    computeProfileCompletion,
    computeApplicationStats,
    appliedOpportunityIdSet,
    buildRecommendedOpportunities,
    buildUpcomingDeadlines,
    buildRecentApplications,
    countNewThisMonth,
    countEligibleOpportunities,
    buildStudentDashboard
} = require('../lib/studentDashboard');

const student = {
    _id: 'student1',
    name: 'Juan Dela Cruz',
    college: 'CCS',
    major: 'Computer Science',
    cgpa: 3.5,
    graduatingTerm: '2027-T1',
    isGraduating: false,
    sdfoCleared: true
};

const makeOpportunity = (overrides = {}) => ({
    _id: overrides.id || 'opp1',
    name: 'Exchange Program',
    institution: 'Some University',
    country: 'Japan',
    region: 'Asia',
    category: 'Exchange',
    status: 'published',
    deadline: new Date('2026-08-01'),
    eligibility: {},
    requiredDocumentTypes: [],
    createdAt: new Date('2026-07-01'),
    ...overrides
});

describe('Student Dashboard - profile completion', () => {
    test('returns 100 when every tracked profile field is filled', () => {
        expect(computeProfileCompletion(student)).toBe(100);
    });

    test('returns 0 for a student with no tracked profile fields set', () => {
        expect(computeProfileCompletion({})).toBe(0);
    });

    test('returns a partial percentage when some fields are missing', () => {
        expect(computeProfileCompletion({ college: 'CCS', major: 'CS' })).toBe(50);
    });

    test('treats an empty string as not filled', () => {
        expect(computeProfileCompletion({ college: '', major: 'CS', cgpa: 3.5, graduatingTerm: '2027-T1' })).toBe(75);
    });
});

describe('Student Dashboard - application stats', () => {
    test('counts each status bucket independently', () => {
        const applications = [
            { status: 'submitted' },
            { status: 'under-review' },
            { status: 'nominated' },
            { status: 'accepted' },
            { status: 'rejected' }
        ];
        const stats = computeApplicationStats(applications);
        expect(stats).toMatchObject({ total: 5, active: 3, inReview: 2, nominated: 1, accepted: 1, rejected: 1 });
    });

    test('active excludes accepted and rejected (terminal states)', () => {
        const applications = [{ status: 'accepted' }, { status: 'rejected' }];
        expect(computeApplicationStats(applications).active).toBe(0);
    });

    test('counts applications with incomplete documents', () => {
        const applications = [
            { status: 'submitted', documentsStatus: 'incomplete' },
            { status: 'submitted', documentsStatus: 'complete' }
        ];
        expect(computeApplicationStats(applications).incompleteDocuments).toBe(1);
    });

    test('returns all zeros for no applications', () => {
        expect(computeApplicationStats([])).toMatchObject({ total: 0, active: 0, inReview: 0, nominated: 0, accepted: 0, rejected: 0, incompleteDocuments: 0 });
    });
});

describe('Student Dashboard - applied opportunity id set', () => {
    test('reads populated opportunityId documents', () => {
        const ids = appliedOpportunityIdSet([{ opportunityId: { _id: 'opp1' } }]);
        expect(ids.has('opp1')).toBe(true);
    });

    test('reads raw ObjectId-style opportunityId values', () => {
        const ids = appliedOpportunityIdSet([{ opportunityId: 'opp2' }]);
        expect(ids.has('opp2')).toBe(true);
    });
});

describe('Student Dashboard - recommended opportunities', () => {
    test('excludes opportunities the student already applied to', () => {
        const opportunities = [makeOpportunity({ id: 'opp1' }), makeOpportunity({ id: 'opp2' })];
        const recommended = buildRecommendedOpportunities(opportunities, student, [], new Set(['opp1']));
        expect(recommended.map(item => item.id)).toEqual(['opp2']);
    });

    test('excludes opportunities the student is not eligible for', () => {
        const ineligible = makeOpportunity({ id: 'opp1', eligibility: { minCgpa: 3.9 } });
        const recommended = buildRecommendedOpportunities([ineligible], student, [], new Set());
        expect(recommended).toEqual([]);
    });

    test('sorts by soonest deadline first and respects the limit', () => {
        const opportunities = [
            makeOpportunity({ id: 'late', deadline: new Date('2026-12-01') }),
            makeOpportunity({ id: 'soon', deadline: new Date('2026-08-01') })
        ];
        const recommended = buildRecommendedOpportunities(opportunities, student, [], new Set(), 1);
        expect(recommended).toHaveLength(1);
        expect(recommended[0].id).toBe('soon');
    });
});

describe('Student Dashboard - upcoming deadlines', () => {
    test('only includes opportunities in the relevant id set, sorted chronologically', () => {
        const opportunities = [
            makeOpportunity({ id: 'a', deadline: new Date('2026-09-01') }),
            makeOpportunity({ id: 'b', deadline: new Date('2026-08-01') }),
            makeOpportunity({ id: 'c', deadline: new Date('2026-07-15') })
        ];
        const deadlines = buildUpcomingDeadlines(opportunities, new Set(['a', 'b']), 5);
        expect(deadlines.map(item => item.id)).toEqual(['b', 'a']);
    });

    test('respects the limit', () => {
        const opportunities = [
            makeOpportunity({ id: 'a', deadline: new Date('2026-07-01') }),
            makeOpportunity({ id: 'b', deadline: new Date('2026-07-02') })
        ];
        const deadlines = buildUpcomingDeadlines(opportunities, new Set(['a', 'b']), 1);
        expect(deadlines).toHaveLength(1);
    });
});

describe('Student Dashboard - recent applications', () => {
    test('maps populated opportunity fields onto each application', () => {
        const applications = [{
            _id: 'app1',
            opportunityId: { _id: 'opp1', name: 'Exchange Program', institution: 'Some University' },
            status: 'submitted',
            documentsStatus: 'complete',
            submittedDate: '2026-06-01',
            createdAt: new Date('2026-06-01')
        }];
        const recent = buildRecentApplications(applications, 5);
        expect(recent[0]).toMatchObject({
            id: 'app1',
            opportunityId: 'opp1',
            programName: 'Exchange Program',
            hostInstitution: 'Some University',
            status: 'submitted'
        });
    });

    test('sorts newest first', () => {
        const applications = [
            { _id: 'old', opportunityId: 'opp1', createdAt: new Date('2026-01-01') },
            { _id: 'new', opportunityId: 'opp1', createdAt: new Date('2026-06-01') }
        ];
        const recent = buildRecentApplications(applications, 5);
        expect(recent.map(item => item.id)).toEqual(['new', 'old']);
    });
});

describe('Student Dashboard - new-this-month count', () => {
    test('counts opportunities created within the trailing window', () => {
        const now = new Date('2026-07-15');
        const opportunities = [
            makeOpportunity({ id: 'a', createdAt: new Date('2026-07-10') }),
            makeOpportunity({ id: 'b', createdAt: new Date('2026-01-01') })
        ];
        expect(countNewThisMonth(opportunities, now, 30)).toBe(1);
    });
});

describe('Student Dashboard - eligible opportunity count', () => {
    test('excludes applied-to and ineligible opportunities', () => {
        const opportunities = [
            makeOpportunity({ id: 'applied' }),
            makeOpportunity({ id: 'ineligible', eligibility: { minCgpa: 3.9 } }),
            makeOpportunity({ id: 'eligible' })
        ];
        const count = countEligibleOpportunities(opportunities, student, [], new Set(['applied']));
        expect(count).toBe(1);
    });
});

describe('Student Dashboard - full aggregate', () => {
    test('never leaks another student\'s data — output is derived only from the passed-in student and their applications', () => {
        const now = new Date('2026-07-11');
        const applications = [{
            _id: 'app1',
            userId: 'student1',
            opportunityId: { _id: 'opp1', name: 'Exchange Program', institution: 'Some University' },
            status: 'submitted',
            documentsStatus: 'incomplete',
            submittedDate: '2026-07-01',
            createdAt: new Date('2026-07-01')
        }];
        const openOpportunities = [makeOpportunity({ id: 'opp1' }), makeOpportunity({ id: 'opp2' })];

        const dashboard = buildStudentDashboard({ student, applications, openOpportunities, documents: [], now });

        expect(dashboard.student.id).toBe('student1');
        expect(dashboard.applicationStats.total).toBe(1);
        expect(dashboard.applicationStats.incompleteDocuments).toBe(1);
        expect(dashboard.recommendedOpportunities.every(item => item.id !== 'opp1')).toBe(true);
        expect(dashboard.recentApplications).toHaveLength(1);
    });

    test('returns empty-state-compatible arrays when the student has no applications and no open opportunities', () => {
        const dashboard = buildStudentDashboard({ student, applications: [], openOpportunities: [], documents: [], now: new Date('2026-07-11') });
        expect(dashboard.applicationStats.total).toBe(0);
        expect(dashboard.recommendedOpportunities).toEqual([]);
        expect(dashboard.upcomingDeadlines).toEqual([]);
        expect(dashboard.recentApplications).toEqual([]);
    });
});
