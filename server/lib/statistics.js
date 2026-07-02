const URGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const getUrgentCutoff = (now = new Date()) => new Date(now.getTime() + URGENT_WINDOW_MS);

const computeStatisticsSummary = (statusAgg = [], urgentCount = 0, livePrograms = 0, countries = []) => {
    const counts = { submitted: 0, 'under-review': 0, nominated: 0, accepted: 0, rejected: 0 };
    statusAgg.forEach(item => { if (item._id in counts) counts[item._id] = item.count; });

    return {
        ...counts,
        pending: counts.submitted + counts['under-review'],
        urgent: urgentCount || 0,
        livePrograms,
        countries: countries.filter(Boolean).length
    };
};

module.exports = { URGENT_WINDOW_MS, getUrgentCutoff, computeStatisticsSummary };
