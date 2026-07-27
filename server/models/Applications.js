const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    opportunityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Opportunity', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'], 
        default: 'submitted' 
    },
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
    }],
    submittedDate: { 
        type: String, 
        required: true 
    },
    documentsStatus: { 
        type: String, 
        enum: ['incomplete', 'complete'], 
        default: 'incomplete' 
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'],
            required: true
        },
        changedAt: { type: Date, default: Date.now, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, maxlength: 500 },
    }],
}, { timestamps: true });

applicationSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });
applicationSchema.index({ opportunityId: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
