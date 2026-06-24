const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    college: { type: String, required: true },
    cgpa: { type: Number, required: true },
    email: String,
    role: { type: String, enum: ['student', 'admin'], default: 'student' }, 
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);