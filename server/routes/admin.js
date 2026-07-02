/**
 * Admin routes — require OVPERI_Admin or System_Admin role.
 * System_Admin-only sub-routes (user management, role assignment, audit logs)
 * are further guarded by requireSystemAdmin.
 */
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/Users');
const Application = require('../models/Applications');
const Opportunity = require('../models/Opportunity');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const { requireAdmin, requireSystemAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// ── Applications ──────────────────────────────────────────────────────────────

// GET /api/admin/applications  — paginated list of all applications
router.get('/applications', async (req, res) => {
    try {
        const result = await Application.listAll({
            status: req.query.status,
            college: req.query.college,
            search: req.query.search,
            sort: req.query.sort,
            page: Number(req.query.page) || 1,
            pageSize: Number(req.query.pageSize) || 50,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/admin/applications/:id/status
router.put('/applications/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ message: 'status is required' });

        const application = await Application.updateStatus(req.params.id, status, req.session.userId);
        if (!application) return res.status(404).json({ message: 'Application not found' });

        await AuditLog.logAction({
            action: 'application.status_changed',
            targetType: 'Application',
            targetId: application._id,
            userId: req.session.userId,
            details: { newStatus: status },
            ip: req.ip,
        });

        res.json({ success: true, data: application });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/applications/bulk-status
router.post('/applications/bulk-status', async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || !ids.length || !status) {
            return res.status(400).json({ message: 'ids (array) and status are required' });
        }

        const updated = await Application.bulkUpdateStatus(ids, status, req.session.userId);

        await AuditLog.logAction({
            action: 'application.bulk_status_changed',
            targetType: 'Application',
            userId: req.session.userId,
            details: { ids, newStatus: status },
            ip: req.ip,
        });

        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Statistics ────────────────────────────────────────────────────────────────

// GET /api/admin/statistics
router.get('/statistics', async (req, res) => {
    try {
        const [applicationStats, opportunityStats] = await Promise.all([
            Application.getStatusCounts(),
            Opportunity.getLiveStats(),
        ]);
        res.json({ success: true, data: { ...applicationStats, ...opportunityStats } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Opportunities (CRUD) ──────────────────────────────────────────────────────

// POST /api/admin/opportunities
router.post('/opportunities', async (req, res) => {
    try {
        const opportunity = new Opportunity(req.body);
        await opportunity.save();

        await AuditLog.logAction({
            action: 'opportunity.created',
            targetType: 'Opportunity',
            targetId: opportunity._id,
            userId: req.session.userId,
            ip: req.ip,
        });

        res.status(201).json({ success: true, data: opportunity });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/admin/opportunities/:id
router.put('/opportunities/:id', async (req, res) => {
    try {
        const opportunity = await Opportunity.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!opportunity) return res.status(404).json({ message: 'Opportunity not found' });

        await AuditLog.logAction({
            action: 'opportunity.updated',
            targetType: 'Opportunity',
            targetId: opportunity._id,
            userId: req.session.userId,
            ip: req.ip,
        });

        res.json({ success: true, data: opportunity });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/admin/opportunities/:id
router.delete('/opportunities/:id', async (req, res) => {
    try {
        const opportunity = await Opportunity.findByIdAndDelete(req.params.id);
        if (!opportunity) return res.status(404).json({ message: 'Opportunity not found' });

        await AuditLog.logAction({
            action: 'opportunity.deleted',
            targetType: 'Opportunity',
            targetId: opportunity._id,
            userId: req.session.userId,
            ip: req.ip,
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── User management (System_Admin only) ──────────────────────────────────────

// GET /api/admin/users
router.get('/users', requireSystemAdmin, async (req, res) => {
    try {
        const users = await User.listAll({
            role: req.query.role,
            isActive: req.query.isActive != null ? req.query.isActive === 'true' : undefined,
            limit: Number(req.query.limit) || 100,
            skip: Number(req.query.skip) || 0,
        });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/admin/users/:id/role  — change a user's role
router.put('/users/:id/role', requireSystemAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['Student', 'OVPERI_Admin', 'System_Admin'];
        if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { role } },
            { new: true, runValidators: true }
        ).select('-passwordHashed -__v');

        if (!user) return res.status(404).json({ message: 'User not found' });

        await AuditLog.logAction({
            action: 'user.role_changed',
            targetType: 'User',
            targetId: user._id,
            userId: req.session.userId,
            details: { newRole: role },
            ip: req.ip,
        });

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/admin/users/:id/deactivate
router.put('/users/:id/deactivate', requireSystemAdmin, async (req, res) => {
    try {
        const user = await User.deactivate(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await AuditLog.logAction({
            action: 'user.deactivated',
            targetType: 'User',
            targetId: user._id,
            userId: req.session.userId,
            ip: req.ip,
        });

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Audit logs (System_Admin only) ───────────────────────────────────────────

// GET /api/admin/audit-logs
router.get('/audit-logs', requireSystemAdmin, async (req, res) => {
    try {
        const result = await AuditLog.queryLogs({
            userId: req.query.userId || null,
            action: req.query.action || null,
            targetType: req.query.targetType || null,
            from: req.query.from || null,
            to: req.query.to || null,
            page: Number(req.query.page) || 1,
            pageSize: Number(req.query.pageSize) || 50,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
