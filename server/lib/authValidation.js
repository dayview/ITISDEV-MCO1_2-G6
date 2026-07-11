const { GENDER_OPTIONS, ENROLLMENT_STATUSES, COLLEGE_OPTIONS } = require('./profile');

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

const isValidPhone = (phone) => {
    const trimmed = String(phone || '').trim();
    const digits = trimmed.replace(/\D/g, '');
    return /^\+?[\d\s-]+$/.test(trimmed) && digits.length >= 10 && digits.length <= 13;
};

// Registration-time personal/academic fields, using the same enum values and
// normalization rules as PATCH /api/profile (see lib/profile.js). College is required —
// this is what replaces the old "silently default to CCS" behavior with a real,
// validated, student-submitted choice.
const validateRegistrationProfile = (body = {}) => {
    const errors = {};
    const profile = {};

    if (!body.college || !COLLEGE_OPTIONS.includes(body.college)) {
        errors.college = 'Please select a valid college.';
    } else {
        profile.college = body.college;
    }

    if (body.phone) {
        if (!isValidPhone(body.phone)) {
            errors.phone = 'Please enter a valid phone number.';
        } else {
            profile.phone = String(body.phone).trim();
        }
    }

    if (body.gender) {
        if (!GENDER_OPTIONS.includes(body.gender)) {
            errors.gender = 'Please select a valid gender option.';
        } else {
            profile.gender = body.gender;
        }
    }

    if (body.birthdate) {
        if (Number.isNaN(new Date(body.birthdate).getTime())) {
            errors.birthdate = 'Please enter a valid date of birth.';
        } else {
            profile.birthdate = body.birthdate;
        }
    }

    if (body.enrollmentStatus) {
        if (!ENROLLMENT_STATUSES.includes(body.enrollmentStatus)) {
            errors.enrollmentStatus = 'Please select a valid enrollment status.';
        } else {
            profile.enrollmentStatus = body.enrollmentStatus;
        }
    }

    if (body.graduatingTerm) {
        profile.graduatingTerm = String(body.graduatingTerm).trim();
    }

    return { valid: Object.keys(errors).length === 0, errors, profile };
};

module.exports = { ADMIN_ROLES, roleHome, sanitizeUser, isDlsuEmail, isValidPassword, isValidPhone, validateRegistrationProfile };
