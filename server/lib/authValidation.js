const ADMIN_ROLES = ['OVPERI_Admin', 'System_Admin'];

const roleHome = (role) => ADMIN_ROLES.includes(role) ? '/admin/dashboard.html' : '/dashboard.html';

const sanitizeUser = (user) => ({
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentId: user.studentId,
    college: user.college,
    major: user.major,
    cgpa: user.cgpa,
    isGraduating: user.isGraduating,
    sdfoCleared: user.sdfoCleared
});

const isDlsuEmail = (email) => String(email || '').toLowerCase().endsWith('@dlsu.edu.ph');

const isValidPassword = (password) => String(password || '').length >= 8;

module.exports = { ADMIN_ROLES, roleHome, sanitizeUser, isDlsuEmail, isValidPassword };
