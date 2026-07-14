const multer = require('multer');
const path = require('path');
const { ensureUserDirectory, generateStoredFileName, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require('../lib/storage');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.session?.user?._id) return cb(new Error('Unauthorized.'));
        try {
            cb(null, ensureUserDirectory(req.session.user._id));
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        try {
            cb(null, generateStoredFileName(file.mimetype));
        } catch (err) {
            cb(err);
        }
    }
});

// Never trust MIME type alone — also require the client-reported extension to match
// the extension implied by that (already-allowlisted) MIME type.
const fileFilter = (req, file, cb) => {
    const expectedExt = ALLOWED_MIME_TYPES[file.mimetype];
    if (!expectedExt) {
        return cb(new Error('Unsupported file type. Only PDF, JPG, and PNG are accepted.'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const validExtensions = expectedExt === '.jpg' ? ['.jpg', '.jpeg'] : [expectedExt];
    if (!validExtensions.includes(ext)) {
        return cb(new Error('The file extension does not match its content type.'));
    }
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 } });

// Runs multer in callback style so upload errors (bad type, oversized file) can be
// answered with a clean 400/413 JSON response instead of falling through to the
// generic error handler.
const uploadSingleFile = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
            return res.status(413).json({ success: false, error: `File exceeds the ${maxMb} MB limit.` });
        }
        res.status(400).json({ success: false, error: err.message || 'Invalid file upload.' });
    });
};

module.exports = { upload, uploadSingleFile };
