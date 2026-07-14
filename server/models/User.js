const mongoose = require('mongoose');

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
        // Accounts created via Google Sign-In have no password of their own.
        required: function () { return !this.googleId; }
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
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
    college: {
        type: String,
        enum: ['CCS', 'GCOE', 'CLA', 'RVRCOB']
    },
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
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);