const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { roleHome, sanitizeUser, isDlsuEmail, isValidPassword, isValidStudentId, validateRegistrationProfile } = require('../lib/authValidation');
const { sendOtpEmail } = require('../lib/mailer');
const { SESSION_COOKIE_NAME, sessionCookieOptions } = require('../config/session');

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// --- Email-OTP 2FA -----------------------------------------------------------------
// A user with twoFactorEnabled=true never gets a full session directly off a
// password/OAuth success. Instead a pending marker is placed on the (still-anonymous)
// session and a one-time code is emailed to their DLSU address; only POST /verify-otp
// promotes that pending state into req.session.user.
const OTP_TTL_MS = 5 * 60 * 1000; // how long a single emailed code stays valid
const PENDING_SESSION_MS = 10 * 60 * 1000; // how long the pending-2FA window (and its session cookie) lives
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // minimum gap between individual sends
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000; // rolling window for the send-count cap
const OTP_MAX_SENDS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;

const otpSecret = () => process.env.OTP_SECRET || 'gems-dev-otp-secret';

const hashOtp = (code) => crypto.createHmac('sha256', otpSecret()).update(String(code)).digest();

const generateOtpCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Timing-safe compare: hash lengths always match in practice (fixed-size HMAC digest),
// but a length mismatch is treated as "invalid code" rather than left to throw, since
// crypto.timingSafeEqual throws on unequal-length buffers.
const codeMatches = (submittedCode, storedHashHex) => {
    if (!storedHashHex) return false;
    const submittedHash = hashOtp(submittedCode);
    const storedHash = Buffer.from(storedHashHex, 'hex');
    if (submittedHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(submittedHash, storedHash);
};

// Generates a fresh OTP, persists its hash, and emails it. Returns a result object
// instead of throwing so both the login/OAuth pending branch and /resend-otp can
// respond with the same generic, client-facing error either way.
const issueOtp = async (user, req) => {
    const now = Date.now();

    // Rolling send-count window, independent of the per-send cooldown below - caps total
    // OTP emails per user even across many spaced-out individual sends.
    if (!user.otpSendWindowStart || now - user.otpSendWindowStart.getTime() > OTP_SEND_WINDOW_MS) {
        user.otpSendWindowStart = new Date(now);
        user.otpSendCount = 0;
    }
    if (user.otpSendCount >= OTP_MAX_SENDS_PER_WINDOW) {
        return { ok: false, status: 429, error: 'Too many verification codes requested. Please try again later.' };
    }
    if (user.otpLastSentAt && now - user.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
        return { ok: false, status: 429, error: 'Please wait before requesting another code.' };
    }

    const code = generateOtpCode();
    user.otpCodeHash = hashOtp(code).toString('hex');
    user.otpExpiresAt = new Date(now + OTP_TTL_MS);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date(now);
    user.otpSendCount += 1;
    await user.save();

    try {
        await sendOtpEmail(user.email, code);
    } catch (err) {
        console.error(`Failed to send OTP email to ${user.email}:`, err.message);
        await AuditLog.create({
            userId: user._id,
            userRole: user.role,
            action: 'otp_send_failed',
            targetType: 'User',
            targetId: user._id,
            targetLabel: user.name,
            ip: req.ip
        });
        return { ok: false, status: 502, error: "Couldn't send the verification code. Please try again." };
    }

    await AuditLog.create({
        userId: user._id,
        userRole: user.role,
        action: 'otp_sent',
        targetType: 'User',
        targetId: user._id,
        targetLabel: user.name,
        ip: req.ip
    });
    return { ok: true };
};

// Places the session into the pending-2FA state: no req.session.user yet, just a
// pointer to which user is mid-verification, on a session cookie deliberately shortened
// to the pending window instead of the app's normal (longer) session lifetime.
const startPendingTwoFactor = (req, user) => {
    req.session.cookie.maxAge = PENDING_SESSION_MS;
    req.session.pendingUserId = String(user._id);
    req.session.pendingExpiresAt = Date.now() + PENDING_SESSION_MS;
};

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

        if (user.twoFactorEnabled) {
            const result = await issueOtp(user, req);
            if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });

            startPendingTwoFactor(req, user);
            return res.json({ success: true, requires2fa: true, email: user.email });
        }

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
        if (!isValidStudentId(studentId)) {
            return res.status(400).json({
                success: false,
                error: 'Student ID number must contain exactly 8 digits.'
            });
        }

        const { valid, errors, profile } = validateRegistrationProfile(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Please fix the highlighted fields.', errors });
        }

        const passwordHashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            passwordHashed,
            name,
            studentId: String(studentId).trim(),
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
            if (err.keyPattern?.studentId || err.keyValue?.studentId) {
                return res.status(409).json({ success: false, error: 'This student ID number is already registered.' });
            }
            if (err.keyPattern?.email || err.keyValue?.email) {
                return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
            }
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

        if (user.twoFactorEnabled) {
            const result = await issueOtp(user, req);
            if (!result.ok) {
                const errorCode = result.status === 429 ? 'otp_rate_limited' : 'otp_send_failed';
                return res.redirect(`/login.html?error=${errorCode}`);
            }
            startPendingTwoFactor(req, user);
            return res.redirect('/verify-otp.html');
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

router.post('/verify-otp', async (req, res, next) => {
    try {
        const pendingUserId = req.session?.pendingUserId;
        if (!pendingUserId || !req.session.pendingExpiresAt || Date.now() > req.session.pendingExpiresAt) {
            return res.status(401).json({ success: false, error: 'No pending verification. Please log in again.' });
        }

        const user = await User.findById(pendingUserId);
        if (!user) {
            return res.status(401).json({ success: false, error: 'No pending verification. Please log in again.' });
        }

        if (!user.otpCodeHash || !user.otpExpiresAt || Date.now() > new Date(user.otpExpiresAt).getTime()) {
            return res.status(400).json({ success: false, error: 'Code expired. Please request a new one.' });
        }
        if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ success: false, error: 'Too many attempts. Please request a new code.' });
        }

        const { code } = req.body;
        if (!code || !codeMatches(String(code), user.otpCodeHash)) {
            user.otpAttempts += 1;
            await user.save();
            await AuditLog.create({
                userId: user._id,
                userRole: user.role,
                action: 'otp_failed',
                targetType: 'User',
                targetId: user._id,
                targetLabel: user.name,
                ip: req.ip
            });
            return res.status(401).json({ success: false, error: 'Invalid code.' });
        }

        user.otpCodeHash = undefined;
        user.otpExpiresAt = undefined;
        user.otpAttempts = 0;
        await user.save();

        delete req.session.pendingUserId;
        delete req.session.pendingExpiresAt;

        req.session.regenerate(async (err) => {
            if (err) return next(err);

            // Regenerating drops the shortened pending-window cookie along with the old
            // session; clearing maxAge here restores the app's normal (unset = browser
            // -session) cookie lifetime instead of leaving the 10-minute pending TTL in
            // place for the now-fully-authenticated session.
            req.session.cookie.maxAge = undefined;
            req.session.user = sanitizeUser(user);

            try {
                await AuditLog.create({
                    userId: user._id,
                    userRole: user.role,
                    action: 'otp_verified',
                    targetType: 'User',
                    targetId: user._id,
                    targetLabel: user.name,
                    ip: req.ip
                });
            } catch (auditErr) {
                console.error('Failed to record otp_verified audit log:', auditErr.message);
            }

            res.json({ success: true, user: req.session.user, redirectTo: roleHome(user.role) });
        });
    } catch (err) { next(err); }
});

router.post('/resend-otp', async (req, res, next) => {
    try {
        const pendingUserId = req.session?.pendingUserId;
        if (!pendingUserId || !req.session.pendingExpiresAt || Date.now() > req.session.pendingExpiresAt) {
            return res.status(401).json({ success: false, error: 'No pending verification. Please log in again.' });
        }

        const user = await User.findById(pendingUserId);
        if (!user) {
            return res.status(401).json({ success: false, error: 'No pending verification. Please log in again.' });
        }

        const result = await issueOtp(user, req);
        if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });

        startPendingTwoFactor(req, user);
        res.json({ success: true, message: 'A new verification code has been sent.' });
    } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
    try {
        const user = req.session?.user;
        if (user) {
            // A failed audit write must never block logout - the session
            // still needs to be destroyed and the cookie still needs to go.
            try {
                await AuditLog.create({
                    userId: user._id,
                    userRole: user.role,
                    action: 'user_logout',
                    targetType: 'User',
                    targetId: user._id,
                    targetLabel: user.name,
                    ip: req.ip
                });
            } catch (auditErr) {
                console.error('Failed to write logout audit log:', auditErr.message);
            }
        }

        const finish = () => res.json({ success: true, message: 'Logged out successfully.' });

        if (!req.session) {
            res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
            return finish();
        }

        req.session.destroy((err) => {
            if (err) console.error('Session destroy failed:', err.message);
            res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
            finish();
        });
    } catch (err) { next(err); }
});

router.get('/verify', (req, res) => {
    if (!req.session?.user)
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
    res.json({ success: true, user: req.session.user });
});

module.exports = router;
