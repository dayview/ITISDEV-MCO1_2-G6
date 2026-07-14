const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { roleHome, sanitizeUser, isDlsuEmail, isValidPassword, validateRegistrationProfile } = require('../lib/authValidation');

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, error: 'Email and password required.' });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });

        const passwordMatches = await bcrypt.compare(password, user.passwordHashed || '');
        if (!passwordMatches)
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });

        req.session.user = sanitizeUser(user);

        await AuditLog.create({
            userId: user._id,
            userRole: user.role,
            action: 'user_login',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            ip: req.ip
        });

        res.json({ success: true, user: req.session.user, redirectTo: roleHome(user.role) });
    } catch (err) { next(err); }
});

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, studentId, major, cgpa } = req.body;
        if (!email || !password || !name || !studentId)
            return res.status(400).json({ success: false, error: 'Email, password, name, and student ID are required.' });
        if (!isDlsuEmail(email))
            return res.status(400).json({ success: false, error: 'Use a valid DLSU email address.' });
        if (!isValidPassword(password))
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

        const { valid, errors, profile } = validateRegistrationProfile(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Please fix the highlighted fields.', errors });
        }

        const passwordHashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            passwordHashed,
            name,
            studentId,
            major,
            cgpa: cgpa ? Number(cgpa) : undefined,
            ...profile,
            role: 'Student'
        });

        req.session.user = sanitizeUser(user);

        await AuditLog.create({
            userId: user._id,
            userRole: user.role,
            action: 'user_registered',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            ip: req.ip
        });

        res.status(201).json({ success: true, user: req.session.user, redirectTo: roleHome(user.role) });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, error: 'An account with this email or student ID already exists.' });
        }
        next(err);
    }
});

router.get('/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.redirect('/login.html?error=google_not_configured');
    }

    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const authUrl = googleClient.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        hd: 'dlsu.edu.ph',
        prompt: 'select_account',
        state
    });
    res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const expectedState = req.session.oauthState;
        delete req.session.oauthState;

        if (!code || !state || !expectedState || state !== expectedState) {
            return res.redirect('/login.html?error=google_auth_failed');
        }

        const { tokens } = await googleClient.getToken(code);
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        if (!payload?.email || !payload.email_verified) {
            return res.redirect('/login.html?error=google_email_unverified');
        }

        const email = payload.email.toLowerCase();
        if (!isDlsuEmail(email)) {
            return res.redirect('/login.html?error=google_wrong_domain');
        }

        let user = await User.findOne({ email });
        let isNewUser = false;
        if (!user) {
            user = await User.create({
                email,
                googleId: payload.sub,
                name: payload.name || email.split('@')[0],
                role: 'Student'
            });
            isNewUser = true;
        } else if (user.googleId !== payload.sub) {
            user.googleId = payload.sub;
            await user.save();
        }

        req.session.user = sanitizeUser(user);

        await AuditLog.create({
            userId: user._id,
            userRole: user.role,
            action: isNewUser ? 'user_registered' : 'user_login',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            ip: req.ip
        });

        res.redirect(roleHome(user.role));
    } catch (err) {
        console.error('Google OAuth callback failed:', err.message);
        res.redirect('/login.html?error=google_auth_failed');
    }
});

router.post('/logout', async (req, res, next) => {
    try {
        const user = req.session?.user;
        if (user) {
            await AuditLog.create({
                userId: user._id,
                userRole: user.role,
                action: 'user_logout',
                targetType: 'User',
                targetId: user._id,
                targetLabel: user.name,
                ip: req.ip
            });
        }
        req.session.destroy(() => res.json({ success: true, message: 'Logged out.' }));
    } catch (err) { next(err); }
});

router.get('/verify', (req, res) => {
    if (!req.session?.user)
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
    res.json({ success: true, user: req.session.user });
});

module.exports = router;
