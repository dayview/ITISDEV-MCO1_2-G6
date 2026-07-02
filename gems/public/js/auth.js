/**
 * Client-side auth utilities.
 *
 * Usage — drop one of these calls at the top of each page's script:
 *   guardStudent()  — redirects to /login.html if not a Student
 *   guardAdmin()    — redirects to /login.html if not OVPERI_Admin / System_Admin
 *
 * Also exposes:
 *   getSession()    — returns { user } or null
 *   logout()        — calls /api/auth/logout then redirects to /login.html
 */

let _session = null;

async function getSession() {
    if (_session) return _session;
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return null;
        _session = await res.json();
        return _session;
    } catch {
        return null;
    }
}

async function guardStudent() {
    const session = await getSession();
    if (!session) return (window.location.href = '/login.html');
    const role = session.user?.role;
    if (!['Student', 'OVPERI_Admin', 'System_Admin'].includes(role)) {
        window.location.href = '/login.html';
    }
}

async function guardAdmin() {
    const session = await getSession();
    if (!session) return (window.location.href = '/login.html');
    const role = session.user?.role;
    if (!['OVPERI_Admin', 'System_Admin'].includes(role)) {
        window.location.href = '/dashboard.html';
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    _session = null;
    window.location.href = '/login.html';
}
