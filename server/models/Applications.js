const applicationSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    status: { type: String, enum: ['submitted', 'under-review', 'nominated', 'accepted'], default: 'submitted' },
    submitted_date: { type: String, required: true },
    documents_status: { type: String, enum: ['incomplete', 'complete'], default: 'incomplete' },
}, { timestamps: true });