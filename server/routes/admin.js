const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin, requireSystemAdmin } = require('../middleware/auth');
const { VALID_ROLES, isValidRole, mapUserSummary } = require('../lib/users');

router.use(requireAuth, requireAdmin);

router.get('/users', requireSystemAdmin, async (req, res, next) => {
    try {
        const { role, isActive, search, page = 1, pageSize = 50 } = req.query;
        const query = {};
        if (role) query.role = role;
        if (isActive != null) query.isActive = isActive === 'true';
        if (search) {
            const pattern = new RegExp(search, 'i');
            query.$or = [{ name: pattern }, { email: pattern }, { studentId: pattern }];
        }

        const skip = (Number(page) - 1) * Number(pageSize);
        const [users, total] = await Promise.all([
            User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
            User.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: users.map(mapUserSummary),
            meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.max(1, Math.ceil(total / pageSize)) }
        });
    } catch (err) { next(err); }
});

router.put('/users/:id/role', requireSystemAdmin, async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid user id.' });
        }
        if (!isValidRole(req.body.role)) {
            return res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

        const from = user.role;
        user.role = req.body.role;
        await user.save();

        await AuditLog.create({
            userId: req.user._id,
            userRole: req.user.role,
            action: 'user_role_changed',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            changes: [{ field: 'role', from, to: user.role }],
            ip: req.ip
        });

        res.json({ success: true, data: mapUserSummary(user) });
    } catch (err) { next(err); }
});

router.put('/users/:id/deactivate', requireSystemAdmin, async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid user id.' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: false } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

        await AuditLog.create({
            userId: req.user._id,
            userRole: req.user.role,
            action: 'user_deactivated',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            ip: req.ip
        });

        res.json({ success: true, data: mapUserSummary(user) });
    } catch (err) { next(err); }
});

router.get('/audit-logs', requireSystemAdmin, async (req, res, next) => {
    try {
        const { action, targetType, userId, from, to, page = 1, pageSize = 50 } = req.query;
        const query = {};
        if (action) query.action = action;
        if (targetType) query.targetType = targetType;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) query.userId = userId;
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        const skip = (Number(page) - 1) * Number(pageSize);
        const [logs, total] = await Promise.all([
            AuditLog.find(query).populate('userId', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
            AuditLog.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: logs,
            meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.max(1, Math.ceil(total / pageSize)) }
        });
    } catch (err) { next(err); }
});

module.exports = router;
