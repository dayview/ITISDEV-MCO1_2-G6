const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['transcript', 'recommendation', 'validId', 'passport', 'EAF', 'curriculumAudit', 'other'],
    },
    fileName: String,
    filePath: {
        type: String,
        required: true
    },
    fileFormat: String,
    uploadedAt: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

documentSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Document', documentSchema);