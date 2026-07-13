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

function requireSystemAdmin(req, res, next) {
    if (req.user?.role !== 'System_Admin')
        return res.status(403).json({ success: false, error: 'Forbidden. System admin access required.' });
    next();
}

module.exports = { requireAuth, requireAdmin, requireSystemAdmin, ADMIN_ROLES };