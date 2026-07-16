const GENDER_OPTIONS = ['female', 'male', 'other', 'prefer-not'];
const ENROLLMENT_STATUSES = ['Full-time', 'Part-time'];
// The set of colleges already in use across seed data and the User schema.
const COLLEGE_OPTIONS = ['BAGCED', 'CCS', 'CLA', 'COS', 'GCOE', 'RVRCOB', 'SOE'];

const mapProfile = (user) => {
    const plain = typeof user.toObject === 'function' ? user.toObject() : user;
    return {
        id: String(plain._id),
        name: plain.name || '',
        email: plain.email || '',
        studentId: plain.studentId || '',
        phone: plain.phone || '',
        gender: plain.gender || '',
        birthdate: plain.birthdate ? new Date(plain.birthdate).toISOString().slice(0, 10) : '',
        major: plain.major || '',
        enrollmentStatus: plain.enrollmentStatus || '',
        graduatingTerm: plain.graduatingTerm || ''
    };
};

// Only these fields may be changed via PATCH /api/profile. email, studentId, and role
// are intentionally excluded — they are read-only identity fields.
//
// gender and enrollmentStatus are constrained by a schema enum, so an empty string
// (the "not set" state of their <select>) must be $unset rather than $set, or Mongoose's
// enum validator would reject it. name/phone/major/graduatingTerm have no enum, so an
// empty string is a valid $set value for them.
const validateProfileUpdate = (body = {}) => {
    const errors = {};
    const updates = {};
    const unsets = [];

    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (name.length < 3) errors.name = 'Name must be at least 3 characters long.';
        else updates.name = name;
    }

    if (body.phone !== undefined) {
        const phone = String(body.phone).trim();
        const digits = phone.replace(/\D/g, '');
        if (phone && (!/^\+?[\d\s-]+$/.test(phone) || digits.length < 10 || digits.length > 13)) {
            errors.phone = 'Please enter a valid phone number.';
        } else {
            updates.phone = phone;
        }
    }

    if (body.gender !== undefined) {
        if (!body.gender) {
            unsets.push('gender');
        } else if (!GENDER_OPTIONS.includes(body.gender)) {
            errors.gender = 'Please select a valid gender option.';
        } else {
            updates.gender = body.gender;
        }
    }

    if (body.birthdate !== undefined) {
        if (!body.birthdate) {
            unsets.push('birthdate');
        } else if (Number.isNaN(new Date(body.birthdate).getTime())) {
            errors.birthdate = 'Please enter a valid date of birth.';
        } else {
            updates.birthdate = body.birthdate;
        }
    }

    if (body.major !== undefined) {
        updates.major = String(body.major).trim();
    }

    if (body.enrollmentStatus !== undefined) {
        if (!body.enrollmentStatus) {
            unsets.push('enrollmentStatus');
        } else if (!ENROLLMENT_STATUSES.includes(body.enrollmentStatus)) {
            errors.enrollmentStatus = 'Please select a valid enrollment status.';
        } else {
            updates.enrollmentStatus = body.enrollmentStatus;
        }
    }

    if (body.graduatingTerm !== undefined) {
        updates.graduatingTerm = String(body.graduatingTerm).trim();
    }

    return { valid: Object.keys(errors).length === 0, errors, updates, unsets };
};

module.exports = { GENDER_OPTIONS, ENROLLMENT_STATUSES, COLLEGE_OPTIONS, mapProfile, validateProfileUpdate };
