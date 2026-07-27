const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const { getDaysUntilDeadline } = require('../lib/deadlineReminders');

const router = express.Router();

const requireStudent = (req, res, next) => {
    if (req.user?.role !== 'Student') return res.status(403).json({ success: false, error: 'Student access required.' });
    next();
};

const mapNotification = notification => ({
    id: String(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    applicationId: notification.applicationId ? String(notification.applicationId) : null,
    opportunityId: notification.opportunityId ? String(notification.opportunityId) : null,
    opportunityName: notification.opportunityName || null,
    // Deadline-reminder-only fields stay null for other notification types.
    requirementKey: notification.requirementKey || null,
    requirementLabel: notification.requirementLabel || null,
    deadline: notification.deadline || null,
    daysRemaining: notification.deadline ? getDaysUntilDeadline(notification.deadline) : null,
    reminderWindowDays: notification.reminderWindowDays ?? null,
    // Event metadata for status-change / opportunity-event notifications.
    eventType: notification.eventType || null,
    fromValue: notification.fromValue || null,
    toValue: notification.toValue || null,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    readAt: notification.readAt || null
});

router.use(requireAuth, requireStudent);

router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
        const query = { userId: req.user._id };
        const [notifications, total, unread] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
            Notification.countDocuments(query),
            Notification.countDocuments({ ...query, isRead: false })
        ]);
        res.json({
            success: true,
            data: notifications.map(mapNotification),
            meta: { total, unread, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Unable to load notifications.' });
    }
});

router.patch('/read-all', async (req, res, next) => {
    try {
        const now = new Date();
        const result = await Notification.updateMany(
            { userId: req.user._id, isRead: false },
            { $set: { isRead: true, readAt: now } }
        );
        res.json({ success: true, data: { updated: result.modifiedCount } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Unable to update notifications.' });
    }
});

router.patch('/:id/read', async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );
        if (!notification) return res.status(404).json({ success: false, error: 'Notification not found.' });
        res.json({ success: true, data: mapNotification(notification) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Unable to update notification.' });
    }
});

module.exports = router;
module.exports.mapNotification = mapNotification;
