const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');
const { roleHome, sanitizeUser, isDlsuEmail, isValidPassword } = require('../lib/authValidation');

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, error: 'Email and password required.' });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });

        let passwordMatches = user.passwordHashed === password;
        if (!passwordMatches && /^\$2[aby]\$/.test(user.passwordHashed || '')) {
            passwordMatches = await bcrypt.compare(password, user.passwordHashed);
        }
        if (!passwordMatches)
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });

        req.session.user = sanitizeUser(user);
        res.json({ success: true, user: req.session.user, redirectTo: roleHome(user.role) });
    } catch (err) { next(err); }
});

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, studentId, college, major, cgpa, graduatingTerm } = req.body;
        if (!email || !password || !name || !studentId)
            return res.status(400).json({ success: false, error: 'Email, password, name, and student ID are required.' });
        if (!isDlsuEmail(email))
            return res.status(400).json({ success: false, error: 'Use a valid DLSU email address.' });
        if (!isValidPassword(password))
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

        const passwordHashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            passwordHashed,
            name,
            studentId,
            college: college || 'CCS',
            major,
            cgpa: cgpa ? Number(cgpa) : undefined,
            graduatingTerm,
            role: 'Student'
        });

        req.session.user = sanitizeUser(user);
        res.status(201).json({ success: true, user: req.session.user, redirectTo: roleHome(user.role) });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, error: 'An account with this email or student ID already exists.' });
        }
        next(err);
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true, message: 'Logged out.' }));
});

router.get('/verify', (req, res) => {
    if (!req.session?.user)
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
    res.json({ success: true, user: req.session.user });
});

module.exports = router;
