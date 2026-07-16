const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateDeadlineReminders } = require('../lib/deadlineReminders');

const router = express.Router();

router.post('/run', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
        const summary = await generateDeadlineReminders();
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Unable to generate deadline reminders.' });
    }
});

module.exports = router;
