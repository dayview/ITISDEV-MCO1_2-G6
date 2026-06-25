function requireAuth(req, res, next) {
    if (!req.session?.user)
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    req.user = req.session.user;
    next();
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    next();
}

module.exports = { requireAuth, requireAdmin };