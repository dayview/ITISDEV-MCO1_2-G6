const { GENDER_OPTIONS, ENROLLMENT_STATUSES, mapProfile, validateProfileUpdate } = require('../lib/profile');

describe('Profile Logic - mapProfile', () => {
    test('maps every field the profile page displays', () => {
        const user = {
            _id: 'u1',
            name: 'Juan Dela Cruz',
            email: 'juan@dlsu.edu.ph',
            studentId: '12345678',
            phone: '+63 917 123 4567',
            gender: 'male',
            birthdate: new Date('2003-05-15'),
            major: 'BS Computer Science',
            enrollmentStatus: 'Full-time',
            graduatingTerm: 'AY 2026-2027, Term 2'
        };

        expect(mapProfile(user)).toEqual({
            id: 'u1',
            name: 'Juan Dela Cruz',
            email: 'juan@dlsu.edu.ph',
            studentId: '12345678',
            phone: '+63 917 123 4567',
            gender: 'male',
            birthdate: '2003-05-15',
            major: 'BS Computer Science',
            enrollmentStatus: 'Full-time',
            graduatingTerm: 'AY 2026-2027, Term 2'
        });
    });

    test('falls back to empty strings for unset optional fields rather than undefined/null', () => {
        const mapped = mapProfile({ _id: 'u2', name: 'Bare User', email: 'bare@dlsu.edu.ph' });
        expect(mapped).toMatchObject({
            studentId: '',
            phone: '',
            gender: '',
            birthdate: '',
            major: '',
            enrollmentStatus: '',
            graduatingTerm: ''
        });
    });

    test('never includes passwordHashed or role', () => {
        const mapped = mapProfile({ _id: 'u3', name: 'X', email: 'x@dlsu.edu.ph', passwordHashed: 'secret-hash', role: 'Student' });
        expect(mapped).not.toHaveProperty('passwordHashed');
        expect(mapped).not.toHaveProperty('role');
    });

    test('accepts a Mongoose-document-like object via toObject()', () => {
        const toObject = () => ({ _id: 'u4', name: 'Doc User', email: 'doc@dlsu.edu.ph' });
        expect(mapProfile({ toObject })).toMatchObject({ id: 'u4', name: 'Doc User' });
    });
});

describe('Profile Logic - validateProfileUpdate: name', () => {
    test('rejects a name shorter than 3 characters', () => {
        const result = validateProfileUpdate({ name: 'Al' });
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.updates.name).toBeUndefined();
    });

    test('trims and accepts a valid name', () => {
        const result = validateProfileUpdate({ name: '  Juan Dela Cruz  ' });
        expect(result.valid).toBe(true);
        expect(result.updates.name).toBe('Juan Dela Cruz');
    });

    test('leaves name untouched when not present in the request body', () => {
        const result = validateProfileUpdate({});
        expect(result.updates).not.toHaveProperty('name');
    });
});

describe('Profile Logic - validateProfileUpdate: phone', () => {
    test('rejects a phone number with too few digits', () => {
        const result = validateProfileUpdate({ phone: '12345' });
        expect(result.valid).toBe(false);
        expect(result.errors.phone).toBeDefined();
    });

    test('accepts a valid phone number', () => {
        const result = validateProfileUpdate({ phone: '+63 917 123 4567' });
        expect(result.valid).toBe(true);
        expect(result.updates.phone).toBe('+63 917 123 4567');
    });

    test('allows clearing the phone number to an empty string', () => {
        const result = validateProfileUpdate({ phone: '' });
        expect(result.valid).toBe(true);
        expect(result.updates.phone).toBe('');
    });
});

describe('Profile Logic - validateProfileUpdate: gender (enum field)', () => {
    test('accepts every real gender option', () => {
        GENDER_OPTIONS.forEach(option => {
            const result = validateProfileUpdate({ gender: option });
            expect(result.valid).toBe(true);
            expect(result.updates.gender).toBe(option);
        });
    });

    test('rejects a value outside the enum', () => {
        const result = validateProfileUpdate({ gender: 'not-a-real-option' });
        expect(result.valid).toBe(false);
        expect(result.errors.gender).toBeDefined();
    });

    test('an empty string unsets the field instead of being $set (would fail the schema enum)', () => {
        const result = validateProfileUpdate({ gender: '' });
        expect(result.valid).toBe(true);
        expect(result.updates.gender).toBeUndefined();
        expect(result.unsets).toContain('gender');
    });
});

describe('Profile Logic - validateProfileUpdate: enrollmentStatus (enum field)', () => {
    test('accepts every real enrollment status', () => {
        ENROLLMENT_STATUSES.forEach(option => {
            const result = validateProfileUpdate({ enrollmentStatus: option });
            expect(result.valid).toBe(true);
            expect(result.updates.enrollmentStatus).toBe(option);
        });
    });

    test('rejects a value outside the enum', () => {
        const result = validateProfileUpdate({ enrollmentStatus: 'On Leave' });
        expect(result.valid).toBe(false);
        expect(result.errors.enrollmentStatus).toBeDefined();
    });

    test('an empty string unsets the field', () => {
        const result = validateProfileUpdate({ enrollmentStatus: '' });
        expect(result.valid).toBe(true);
        expect(result.unsets).toContain('enrollmentStatus');
    });
});

describe('Profile Logic - validateProfileUpdate: birthdate', () => {
    test('rejects an unparseable date', () => {
        const result = validateProfileUpdate({ birthdate: 'not-a-date' });
        expect(result.valid).toBe(false);
        expect(result.errors.birthdate).toBeDefined();
    });

    test('accepts a valid ISO date string', () => {
        const result = validateProfileUpdate({ birthdate: '2003-05-15' });
        expect(result.valid).toBe(true);
        expect(result.updates.birthdate).toBe('2003-05-15');
    });

    test('an empty string unsets the field', () => {
        const result = validateProfileUpdate({ birthdate: '' });
        expect(result.valid).toBe(true);
        expect(result.unsets).toContain('birthdate');
    });
});

describe('Profile Logic - validateProfileUpdate: major and graduatingTerm (free text)', () => {
    test('accepts any trimmed string for major', () => {
        const result = validateProfileUpdate({ major: '  BS Computer Science  ' });
        expect(result.valid).toBe(true);
        expect(result.updates.major).toBe('BS Computer Science');
    });

    test('accepts any trimmed string for graduatingTerm', () => {
        const result = validateProfileUpdate({ graduatingTerm: '  AY 2026-2027, Term 2  ' });
        expect(result.valid).toBe(true);
        expect(result.updates.graduatingTerm).toBe('AY 2026-2027, Term 2');
    });
});

describe('Profile Logic - validateProfileUpdate: identity fields are never accepted', () => {
    test('email, studentId, and role in the request body are silently ignored', () => {
        const result = validateProfileUpdate({
            name: 'Juan Dela Cruz',
            email: 'attacker@dlsu.edu.ph',
            studentId: '00000000',
            role: 'OVPERI_Admin'
        });
        expect(result.valid).toBe(true);
        expect(result.updates).not.toHaveProperty('email');
        expect(result.updates).not.toHaveProperty('studentId');
        expect(result.updates).not.toHaveProperty('role');
    });
});
