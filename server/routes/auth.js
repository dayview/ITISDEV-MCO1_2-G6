const express = require('express');
const User = require('../models/Users');
const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register  — students only; role is always forced to Student
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, studentId, college, major, cgpa, graduatingTerm, isGraduating } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Email, password, and name are required' });
        }

        const existing = await User.findByEmail(email);
        if (existing) return res.status(409).json({ message: 'Email already registered' });

        const user = await User.createUser({
            email,
            password,
            name,
            role: 'Student',
            studentId,
            college,
            major,
            cgpa: cgpa != null ? Number(cgpa) : undefined,
            graduatingTerm,
            isGraduating: Boolean(isGraduating),
        });

        req.session.userId = String(user._id);
        req.session.role = user.role;

        await AuditLog.logAction({
            action: 'user.register',
            targetType: 'User',
            targetId: user._id,
            userId: user._id,
            ip: req.ip,
        });

        res.status(201).json({ user: user.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

        const user = await User.findByEmail(email);
        if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials' });

        const valid = await user.verifyPassword(password);
        if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

        req.session.userId = String(user._id);
        req.session.role = user.role;

        await AuditLog.logAction({
            action: 'user.login',
            targetType: 'User',
            targetId: user._id,
            userId: user._id,
            ip: req.ip,
        });

        res.json({ user: user.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
    const { userId } = req.session;
    const ip = req.ip;

    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Logout failed' });
        res.clearCookie('gems.sid');
        res.json({ message: 'Logged out' });
    });

    AuditLog.logAction({ action: 'user.logout', targetType: 'User', targetId: userId, userId, ip }).catch(() => {});
});

// GET /api/auth/me  — returns the current session's user
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findActiveById(req.session.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user: user.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
