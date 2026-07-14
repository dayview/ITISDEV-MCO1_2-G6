(function() {
  function createResponse(data, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data)
    });
  }

  function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  }

  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function filterOpportunities(query = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const search = normalizeText(query.search);
    const category = normalizeText(query.category);
    const region = normalizeText(query.region);
    const deadlineFrom = parseDate(query.deadlineFrom);
    const deadlineTo = parseDate(query.deadlineTo);
    const eligibleOnly = parseBoolean(query.eligibleOnly);

    const opportunities = typeof window.getOpportunities === 'function'
      ? window.getOpportunities()
      : window.OPPORTUNITY_MOCK_DATA;

    return opportunities
      .filter(opportunity => normalizeText(opportunity.status) === 'published')
      .filter(opportunity => {
        const deadlineDate = parseDate(opportunity.deadline);
        return deadlineDate && deadlineDate >= today;
      })
      .filter(opportunity => {
        if (search === '') return true;
        const haystack = [
          opportunity.programName,
          opportunity.hostInstitution,
          opportunity.location,
          opportunity.country,
          opportunity.category,
          opportunity.region
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      })
      .filter(opportunity => {
        if (!category || category === 'all') return true;
        return normalizeText(opportunity.category) === category;
      })
      .filter(opportunity => {
        if (!region || region === 'all') return true;
        return normalizeText(opportunity.region) === region;
      })
      .filter(opportunity => {
        if (deadlineFrom) {
          const deadlineDate = parseDate(opportunity.deadline);
          if (!deadlineDate || deadlineDate < deadlineFrom) return false;
        }
        if (deadlineTo) {
          const deadlineDate = parseDate(opportunity.deadline);
          if (!deadlineDate || deadlineDate > deadlineTo) return false;
        }
        return true;
      })
      .filter(opportunity => {
        if (!eligibleOnly) return true;
        return Boolean(opportunity.eligible);
      })
      .sort((a, b) => {
        const aDate = parseDate(a.deadline);
        const bDate = parseDate(b.deadline);
        return aDate - bDate;
      });
  }

  async function handleApiRequest(url) {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname;
    const searchParams = parsed.searchParams;

    if (pathname === '/api/opportunities') {
      try {
        const response = await window.fetch(url);
        if (response.ok) return response;
      } catch (error) {
        console.warn('Backend opportunities unavailable, using local data.', error);
      }
      const allMatches = filterOpportunities(Object.fromEntries(searchParams.entries()));
      const page = Math.max(1, Number(searchParams.get('page')) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize')) || 10));
      const start = (page - 1) * pageSize;
      const data = allMatches.slice(start, start + pageSize);
      const total = allMatches.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return createResponse({
        data,
        meta: {
          total,
          page,
          pageSize,
          totalPages
        }
      });
    }

    const detailMatch = pathname.match(/^\/api\/opportunities\/(.+)$/);
    if (detailMatch) {
      try {
        const response = await window.fetch(url);
        if (response.ok) return response;
      } catch (error) {
        console.warn('Backend opportunity detail unavailable, using local data.', error);
      }
      const id = detailMatch[1];
      const opportunity = typeof window.getOpportunityById === 'function'
        ? window.getOpportunityById(id)
        : window.OPPORTUNITY_MOCK_DATA.find(item => String(item.id) === String(id));
      if (!opportunity || normalizeText(opportunity.status) !== 'published') {
        return createResponse({ message: 'Opportunity not found' }, 404);
      }
      return createResponse(opportunity);
    }

    return window.fetch(url);
  }

  window.fakeApiFetch = function(url) {
    try {
      return handleApiRequest(url);
    } catch (error) {
      return createResponse({ message: error.message }, 500);
    }
  };
})();
