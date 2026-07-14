const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
    code: { 
        type: String, 
        unique: true, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    description: String,
    institution: { 
        type: String, 
        required: true 
    },
    country: String,
    region: String,
    category: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'closed'],
        default: 'draft'
    },
    deadline: {
        type: Date,
        required: true
    },
    capacity: Number,
    benefits: String,
    fees: String,
    credits: Number,
    requiredDocumentTypes: [{ type: String }],
    eligibility: {
        minCgpa: {
            type: Number
        },
        nonGraduatingRequired: {
            type: Boolean,
            default: true
        },
        sdfoClearanceRequired: {
            type: Boolean,
            default: true
        },
        notes: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

opportunitySchema.index({ status: 1, deadline: 1 });
opportunitySchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Opportunity', opportunitySchema);