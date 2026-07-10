const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    passwordHashed: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Student', 'OVPERI_Admin', 'System_Admin'],
        default: 'Student',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    studentId: {
        type: String,
        unique: true,
        sparse: true 
    },
    college: String,
    major: String,
    cgpa: Number,
    graduatingTerm: String,
    phone: String,
    gender: {
        type: String,
        enum: ['female', 'male', 'other', 'prefer-not']
    },
    birthdate: Date,
    enrollmentStatus: {
        type: String,
        enum: ['Full-time', 'Part-time']
    },
    isGraduating: {
        type: Boolean,
        default: false
    },
    sdfoCleared: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

/* Verify password*/
userSchema.methods.verifyPassword = async function (plaintext) {
    return bcrypt.compare(plaintext, this.passwordHashed);
};

/* Return a safe user object for API responses — no password hash, no internal flags. */
userSchema.methods.toPublicJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHashed;
    delete obj.__v;
    return obj;
};


/* Create a new user then hashing the password before saving. */
userSchema.statics.createUser = async function ({ password, ...fields }) {
    const passwordHashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new this({ ...fields, passwordHashed });
    return user.save();
};

/* Find a user by email. Returns null when not found (callers check). */
userSchema.statics.findByEmail = async function (email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

/* Find an active user by their MongoDB_id. */
userSchema.statics.findActiveById = async function (userId) {
    return this.findOne({ _id: userId, isActive: true });
};

/* Find a student by their DLSU student ID. */
userSchema.statics.findByStudentId = async function (studentId) {
    return this.findOne({ studentId });
};

/* List all users, optionally filtered by role. For system admin management. */
userSchema.statics.listAll = async function ({ role, isActive, limit = 100, skip = 0 } = {}) {
    const query = {};
    if (role) query.role = role;
    if (typeof isActive === 'boolean') query.isActive = isActive;

    return this.find(query)
        .select('-passwordHashed -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

/* List all active students. used by admin dashboards and eligibility checks. */
userSchema.statics.listStudents = async function () {
    return this.find({ role: 'Student', isActive: true })
        .select('-passwordHashed -__v')
        .sort({ name: 1 });
};

/* Update profile for student. */
userSchema.statics.updateProfile = async function (userId, updates) {
    const allowed = ['name', 'college', 'major', 'cgpa', 'graduatingTerm', 'phone', 'gender', 'birthdate', 'enrollmentStatus', 'isGraduating', 'sdfoCleared', 'twoFactorEnabled'];
    const safeUpdates = {};
    allowed.forEach(key => {
        if (key in updates) safeUpdates[key] = updates[key];
    });

    return this.findByIdAndUpdate(
        userId,
        { $set: safeUpdates },
        { new: true, runValidators: true }
    ).select('-passwordHashed -__v');
};

/* Change a user's hashed password.*/
userSchema.statics.changePassword = async function (userId, newPlaintextPassword) {
    const passwordHashed = await bcrypt.hash(newPlaintextPassword, SALT_ROUNDS);
    return this.findByIdAndUpdate(
        userId,
        { $set: { passwordHashed } },
        { new: true }
    ).select('-passwordHashed -__v');
};

/* Soft-deactivate a user account rather than deleting. For audit stuff*/
userSchema.statics.deactivate = async function (userId) {
    return this.findByIdAndUpdate(
        userId,
        { $set: { isActive: false } },
        { new: true }
    ).select('-passwordHashed -__v');
};

/* Check whether a student meets the basic eligibility requirements for an opportunity.*/
userSchema.statics.checkEligibility = async function (userId, opportunity) {
    const user = await this.findById(userId).select('cgpa isGraduating sdfoCleared role');
    if (!user || user.role !== 'Student') return { eligible: false, reasons: ['User is not a student'] };

    const reasons = [];

    if (opportunity.eligibility?.minCgpa && (user.cgpa == null || user.cgpa < opportunity.eligibility.minCgpa)) {
        reasons.push(`CGPA ${user.cgpa ?? 'unknown'} is below the minimum of ${opportunity.eligibility.minCgpa}`);
    }

    if (opportunity.eligibility?.nonGraduatingRequired && user.isGraduating) {
        reasons.push('Graduating students are not eligible for this opportunity');
    }

    if (opportunity.eligibility?.sdfoClearanceRequired && !user.sdfoCleared) {
        reasons.push('SDFO clearance is required');
    }

    return { eligible: reasons.length === 0, reasons };
};

module.exports = mongoose.model('User', userSchema);
