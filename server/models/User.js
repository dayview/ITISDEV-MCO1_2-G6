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