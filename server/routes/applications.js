const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Applications');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

const VALID_STATUSES = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];

function buildPipeline(query, matchOverride = null) {
    const { sort = 'recency', status, college, search, dateFrom, dateTo, documentsStatus } = query;

    const pipeline = [
        { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
        { $unwind: '$student' },
        { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opportunity' } },
        { $unwind: '$opportunity' },
    ];

    const match = matchOverride || {};
    if (!matchOverride) {
        if (status) match.status = status;
        if (documentsStatus) match.documentsStatus = documentsStatus;
        if (college) match['student.college'] = college;
        if (dateFrom || dateTo) {
            match.submittedDate = {};
            if (dateFrom) match.submittedDate.$gte = dateFrom;
            if (dateTo) match.submittedDate.$lte = dateTo;
        }
        if (search) {
            const re = new RegExp(search, 'i');
            match.$or = [
                { 'student.name': re },
                { 'student.studentId': re },
                { 'student.college': re },
            ];
        }
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    const sortMap = {
        recency: { submittedDate: -1 },
        urgency: { 'opportunity.deadline': 1 },
        status: { status: 1 },
        college: { 'student.college': 1 },
        cgpa: { 'student.cgpa': -1 },
        documents: { documentsStatus: 1 },
    };
    pipeline.push({ $sort: sortMap[sort] || sortMap.recency });

    pipeline.push({ $project: {
        id: '$_id',
        name: '$student.name',
        student_id: '$student.studentId',
        college: '$student.college',
        cgpa: '$student.cgpa',
        opp_name: '$opportunity.name',
        institution: '$opportunity.institution',
        status: 1,
        documentsStatus: 1,
        submittedDate: 1,
        deadline: '$opportunity.deadline',
    }});

    return pipeline;
}

router.get('/', async (req, res, next) => {
    try {
        const data = await Application.aggregate(buildPipeline(req.query));
        res.json({ success: true, data, count: data.length });
    } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => { 
    try {
        const data = await Application.aggregate(buildPipeline(req.query));
        const header = 'Student Name,Student Id,College,CGPA,Program,Institution,Status,Documents,Submitted Date,Deadline';
        const rows = data.map(r => 
            [`"${r.name}"`, r.student_id, r.college, r.cgpa, `"${r.opp_name}"`, `"${r.institution}"`, r.status, r.documentsStatus, r.submittedDate, r.deadline].join(',')
        );
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
        res.send([header, ...rows].join('\n'));
    } catch (err) { next(err); }
});

router.post('/bulk-action', async (req, res, next) => {
    try {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || !ids.length)
            return res.status(400).json({ success: false, error: 'ids must be a non-empty array.' });
        if (!VALID_STATUSES.includes(status))
            return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });

        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

        await Application.updateMany({ _id: { $in: validIds } }, { $set: { status } });
        const apps = await Application.find({ _id: { $in: validIds } });
        await AuditLog.insertMany(apps.map(app => ({
            application_id: app._id,
            action: 'bulk_status_change',
            from_status: app.status,
            to_status: status,
            performed_by: req.user?.name || 'admin',
        })));

        const updated = await Application.find({ _id: { $in: validIds } });
        res.json({ success: true, data: updated, message: `${updated.length} application(s) updated to "${status}".` });
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, error: 'Invalid ID.' });
        const [data] = await Application.aggregate([ 
            { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } }, ...buildPipeline({}).slice(0, 5),
        ]);
        if (!data) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true, data });
    } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!VALID_STATUSES.includes(status))
            return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, error: 'Invalid Id.' });

        const app = await Application.findById(req.params.id);
        if (!app) return res.status(404).json({ success: false, error: 'Not found.' });

        const from_status = app.status;
        app.status = status;
        await app.save();

        await AuditLog.create({
            application_id: app._id,
            action: 'status_change',
            from_status,
            to_status: status,
            performed_by: req.user?.name || 'admin',
        });

        res.json({ success: true, data: app, message: `Status updated to "${status}".` });
    } catch (err) { next(err); }
});

module.exports = router;