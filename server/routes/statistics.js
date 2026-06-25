const express = require('express');
const router = express.Router();
const Application = require('../models/Applications');
const Opportunity = require('../models/Opportunity');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const in7days = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

        const [pending, nominated, accepted, urgentAgg, opps] = await Promise.all([Application.countDocuments({ status: { $in: ['submitted', 'under-review'] } }),
        Application.countDocuments({ status: 'nominated' }),
        Application.countDocuments({ status: 'accepted' }),
        Application.aggregate([
            { $match: { status: { $in: ['submitted', 'under-review'] } } },
            { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opp' } },
            { $unwind: '$opp' },
            { $match: { 'opp.deadline': { $gte: today, $lte: in7days } } },
            { $count: 'count' },
        ]),
        Opportunity.find({}, { country: 1 }),
    ]);

    res.json({ success: true, data: {
        pending,
        urgent: urgentAgg[0]?.count || 0,
        nominated,
        accepted,
        livePrograms: opps.length,
        countries: new Set(opps.map(o => o.country)).size,
    }});
    } catch (err) { next(err); }
});

module.exports = router;