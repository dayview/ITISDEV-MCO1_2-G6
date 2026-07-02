function requireAuth(req, res, next) {
    if (!req.session?.user)
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    req.user = req.session.user;
    next();
}

const ADMIN_ROLES = ['OVPERI_Admin', 'System_Admin'];

function requireAdmin(req, res, next) {
    if (!ADMIN_ROLES.includes(req.user?.role))
        return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    next();
}

module.exports = { requireAuth, requireAdmin, ADMIN_ROLES };