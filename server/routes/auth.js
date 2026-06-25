const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

router.post('/login', async (req, res, next) => { 
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, error: 'Email and password required.' });

        const user = await Student.findOne({ email });
        if (!user)
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });

        // TODO: replace with bcrypt.compare() once passwordHashed is added to schema
        if (user.role !== 'admin')
            return res.status(401).json({ success: false, error: 'Admin access only.' });

        req.session.user = { _id: user._id, email: user.email, name: user.name, role: user.role },
        res.json({ success: true, user: req.session.user });
    } catch (err) { next(err); }
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