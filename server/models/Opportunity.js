const opportunitySchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    institution: { type: String, required: true },
    country: { type: String, required: true },
    type: { type: String, required: true },
    deadline: { type: String, required: true },
    capacity: { type: Number },
}, { timestamps: true });