const SESSION_COOKIE_NAME = 'gems.sid';

// Shared by the express-session setup and the logout route so the cookie
// express-session issues and the cookie logout clears are always identical -
// mismatched options make res.clearCookie() silently no-op in the browser.
const sessionCookieOptions = () => ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
});

module.exports = { SESSION_COOKIE_NAME, sessionCookieOptions };
