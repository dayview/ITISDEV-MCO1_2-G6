const VALID_ROLES = ['Student', 'OVPERI_Admin', 'System_Admin'];

const isValidRole = (role) => VALID_ROLES.includes(role);

const mapUserSummary = (user) => ({
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    studentId: user.studentId,
    college: user.college,
    createdAt: user.createdAt,
});

module.exports = { VALID_ROLES, isValidRole, mapUserSummary };
