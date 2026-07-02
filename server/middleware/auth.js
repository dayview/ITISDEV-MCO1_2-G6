/**
 * requireAuth — any logged-in user
 * requireAdmin — OVPERI_Admin or System_Admin
 * requireSystemAdmin — System_Admin only (role management, audit logs)
 */

function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        if (req.accepts('html')) return res.redirect('/login.html');
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session?.userId) {
        if (req.accepts('html')) return res.redirect('/login.html');
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (!['OVPERI_Admin', 'System_Admin'].includes(req.session.role)) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
    }
    next();
}

function requireSystemAdmin(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.session.role !== 'System_Admin') {
        return res.status(403).json({ message: 'Forbidden: system admin access required' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin, requireSystemAdmin };
