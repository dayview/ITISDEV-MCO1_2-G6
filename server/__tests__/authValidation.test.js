const {
    roleHome, sanitizeUser, isDlsuEmail, isValidPassword, isValidStudentId, ADMIN_ROLES,
    isValidPhone, validateRegistrationProfile
} = require('../lib/authValidation');
const { GENDER_OPTIONS, ENROLLMENT_STATUSES, COLLEGE_OPTIONS } = require('../lib/profile');

describe('Authentication - email validation', () => {
    test('accepts a well-formed DLSU email', () => {
        expect(isDlsuEmail('juan_delacruz@dlsu.edu.ph')).toBe(true);
    });

    test('rejects a non-DLSU email', () => {
        expect(isDlsuEmail('juan_delacruz@gmail.com')).toBe(false);
    });

    test('is case-insensitive on the domain', () => {
        expect(isDlsuEmail('Juan_DelaCruz@DLSU.EDU.PH')).toBe(true);
    });

    test('rejects undefined/empty email', () => {
        expect(isDlsuEmail(undefined)).toBe(false);
        expect(isDlsuEmail('')).toBe(false);
    });
});

describe('Authentication - DLSU email restriction', () => {
    test('rejects lookalike domains that merely contain dlsu.edu.ph', () => {
        expect(isDlsuEmail('someone@notdlsu.edu.ph.evil.com')).toBe(false);
    });

    test('rejects a subdomain-only match without the exact suffix', () => {
        expect(isDlsuEmail('someone@dlsu.edu.ph.co')).toBe(false);
    });
});

describe('Authentication - password validation', () => {
    test('accepts a password of exactly 8 characters', () => {
        expect(isValidPassword('abcd1234')).toBe(true);
    });

    test('rejects a password shorter than 8 characters', () => {
        expect(isValidPassword('short1')).toBe(false);
    });

    test('rejects an empty/undefined password', () => {
        expect(isValidPassword('')).toBe(false);
        expect(isValidPassword(undefined)).toBe(false);
    });
});

describe('Authentication - student ID validation', () => {
    test('accepts exactly eight digits', () => {
        expect(isValidStudentId('12345678')).toBe(true);
    });

    test('rejects IDs with the wrong length or non-digit characters', () => {
        expect(isValidStudentId('1234567')).toBe(false);
        expect(isValidStudentId('123456789')).toBe(false);
        expect(isValidStudentId('1234A678')).toBe(false);
    });
});

describe('Authentication - role-based redirect helper', () => {
    test('routes admin roles to the admin dashboard', () => {
        expect(roleHome('OVPERI_Admin')).toBe('/admin/dashboard.html');
        expect(roleHome('System_Admin')).toBe('/admin/dashboard.html');
    });

    test('routes students to the student dashboard', () => {
        expect(roleHome('Student')).toBe('/dashboard.html');
    });

    test('ADMIN_ROLES contains exactly the two admin roles', () => {
        expect(ADMIN_ROLES).toEqual(['OVPERI_Admin', 'System_Admin']);
    });
});

describe('Authentication - sanitizeUser', () => {
    test('strips sensitive fields such as passwordHashed', () => {
        const user = {
            _id: 'abc123',
            email: 'a@dlsu.edu.ph',
            passwordHashed: '$2b$10$hashedvalue',
            name: 'Juan',
            role: 'Student',
            studentId: '12345678',
            college: 'CCS',
            major: 'CS',
            cgpa: 3.5,
            isGraduating: false,
            sdfoCleared: true
        };
        const sanitized = sanitizeUser(user);
        expect(sanitized).not.toHaveProperty('passwordHashed');
        expect(sanitized).toEqual({
            _id: 'abc123',
            email: 'a@dlsu.edu.ph',
            name: 'Juan',
            role: 'Student',
            studentId: '12345678',
            college: 'CCS',
            major: 'CS',
            cgpa: 3.5,
            isGraduating: false,
            sdfoCleared: true
        });
    });
});

describe('Registration - phone validation', () => {
    test('accepts a valid Philippine mobile number', () => {
        expect(isValidPhone('+63 917 123 4567')).toBe(true);
    });

    test('rejects a number with too few digits', () => {
        expect(isValidPhone('12345')).toBe(false);
    });

    test('rejects an empty phone number', () => {
        expect(isValidPhone('')).toBe(false);
    });
});

describe('Registration - validateRegistrationProfile: college (required)', () => {
    test('rejects registration when college is missing', () => {
        const result = validateRegistrationProfile({});
        expect(result.valid).toBe(false);
        expect(result.errors.college).toBeDefined();
        expect(result.profile.college).toBeUndefined();
    });

    test('rejects a college outside the real enum', () => {
        const result = validateRegistrationProfile({ college: 'MIT' });
        expect(result.valid).toBe(false);
        expect(result.errors.college).toBeDefined();
    });

    test('accepts every real college option, including ones other than CCS', () => {
        COLLEGE_OPTIONS.forEach(college => {
            const result = validateRegistrationProfile({ college });
            expect(result.valid).toBe(true);
            expect(result.profile.college).toBe(college);
        });
        expect(COLLEGE_OPTIONS).toContain('GCOE');
        expect(COLLEGE_OPTIONS).toContain('RVRCOB');
    });
});

describe('Registration - validateRegistrationProfile: optional fields', () => {
    test('valid registration with every optional field populated', () => {
        const result = validateRegistrationProfile({
            college: 'GCOE',
            phone: '+63 917 123 4567',
            gender: 'female',
            birthdate: '2003-05-15',
            enrollmentStatus: 'Full-time',
            graduatingTerm: 'AY 2026-2027, Term 2'
        });
        expect(result.valid).toBe(true);
        expect(result.profile).toEqual({
            college: 'GCOE',
            phone: '+63 917 123 4567',
            gender: 'female',
            birthdate: '2003-05-15',
            enrollmentStatus: 'Full-time',
            graduatingTerm: 'AY 2026-2027, Term 2'
        });
    });

    test('optional fields may all be omitted', () => {
        const result = validateRegistrationProfile({ college: 'CCS' });
        expect(result.valid).toBe(true);
        expect(result.profile).toEqual({ college: 'CCS' });
    });

    test('rejects an invalid gender', () => {
        const result = validateRegistrationProfile({ college: 'CCS', gender: 'alien' });
        expect(result.valid).toBe(false);
        expect(result.errors.gender).toBeDefined();
    });

    test('accepts every real gender option', () => {
        GENDER_OPTIONS.forEach(gender => {
            expect(validateRegistrationProfile({ college: 'CCS', gender }).valid).toBe(true);
        });
    });

    test('rejects an invalid enrollment status', () => {
        const result = validateRegistrationProfile({ college: 'CCS', enrollmentStatus: 'On Leave' });
        expect(result.valid).toBe(false);
        expect(result.errors.enrollmentStatus).toBeDefined();
    });

    test('accepts every real enrollment status', () => {
        ENROLLMENT_STATUSES.forEach(enrollmentStatus => {
            expect(validateRegistrationProfile({ college: 'CCS', enrollmentStatus }).valid).toBe(true);
        });
    });

    test('rejects an unparseable birthdate', () => {
        const result = validateRegistrationProfile({ college: 'CCS', birthdate: 'not-a-date' });
        expect(result.valid).toBe(false);
        expect(result.errors.birthdate).toBeDefined();
    });

    test('rejects an invalid phone number', () => {
        const result = validateRegistrationProfile({ college: 'CCS', phone: '123' });
        expect(result.valid).toBe(false);
        expect(result.errors.phone).toBeDefined();
    });

    test('never returns role, email, studentId, or passwordHashed even if present in the request body', () => {
        const result = validateRegistrationProfile({
            college: 'CCS', role: 'OVPERI_Admin', email: 'attacker@dlsu.edu.ph',
            studentId: '00000000', passwordHashed: 'hacked'
        });
        expect(result.profile).not.toHaveProperty('role');
        expect(result.profile).not.toHaveProperty('email');
        expect(result.profile).not.toHaveProperty('studentId');
        expect(result.profile).not.toHaveProperty('passwordHashed');
    });
});
