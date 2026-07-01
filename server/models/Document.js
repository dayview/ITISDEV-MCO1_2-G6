const mongoose = require('mongoose');

const ALLOWED_TYPES = ['transcript', 'recommendation', 'validId', 'passport', 'EAF', 'curriculumAudit', 'other'];

const documentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ALLOWED_TYPES,
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

/* Persist a new document record after the file has been written to disk/cloud. filePath should be the storage path or URL returned by the upload middleware. */
documentSchema.statics.uploadDocument = async function ({ userId, type, fileName, filePath, fileFormat }) {
    const doc = new this({ userId, type, fileName, filePath, fileFormat, uploadedAt: new Date() });
    return doc.save();
};

/* Get all documents belonging to a user, most recent first. Used by the student "Documents" vault page. */
documentSchema.statics.findByStudent = async function (userId) {
    return this.find({ userId }).sort({ uploadedAt: -1 });
};

/* Get documents of a specific type for a user. Used to check whether a required document type has already been uploaded before allowing an application to proceed. */
documentSchema.statics.findByStudentAndType = async function (userId, type) {
    return this.find({ userId, type }).sort({ uploadedAt: -1 });
};

/**
 * Get documents that are linked to a specific application.
 * Fetches by the application's document id array — used to render the
 * document checklist inside an application detail view.
 */
documentSchema.statics.findByApplication = async function (documentIds) {
    return this.find({ _id: { $in: documentIds } }).sort({ type: 1, uploadedAt: -1 });
};

/* Retrieve a single document by its id. */
documentSchema.statics.findDocumentById = async function (documentId) {
    return this.findById(documentId);
};

/* Update the file metadata on an existing document record. */
documentSchema.statics.updateDocument = async function (documentId, { fileName, filePath, fileFormat }) {
    return this.findByIdAndUpdate(
        documentId,
        { $set: { fileName, filePath, fileFormat, uploadedAt: new Date() } },
        { new: true, runValidators: true }
    );
};

/* Delete a document record by id. */
documentSchema.statics.deleteDocument = async function (documentId) {
    return this.findByIdAndDelete(documentId);
};

/* Get distinct document types already uploaded by a user. For getting which required types are still missing for an application. */
documentSchema.statics.getUploadedTypes = async function (userId) {
    return this.distinct('type', { userId });
};

/* Check whether all required document types for an opportunity have been uploaded by the student. Returns complete or missing. */
documentSchema.statics.checkCompleteness = async function (userId, requiredTypes = []) {
    const uploadedTypes = await this.getUploadedTypes(userId);
    const uploadedSet = new Set(uploadedTypes);
    const missing = requiredTypes.filter(t => !uploadedSet.has(t));
    return { complete: missing.length === 0, missing };
};

module.exports = mongoose.model('Document', documentSchema);
