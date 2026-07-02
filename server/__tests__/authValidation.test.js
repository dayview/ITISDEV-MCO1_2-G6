const { roleHome, sanitizeUser, isDlsuEmail, isValidPassword, ADMIN_ROLES } = require('../lib/authValidation');

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
