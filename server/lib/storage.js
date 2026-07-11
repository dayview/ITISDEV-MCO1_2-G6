const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');

// Local-disk storage for development only. In production this should be replaced
// with managed object storage (e.g. S3-compatible storage) behind the same
// resolveAbsolutePath()/deleteStoredFile() contract used here.
const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage');
const DOCUMENTS_DIR = path.join(STORAGE_ROOT, 'documents');

// The extension is derived from the validated MIME type, never from the client-supplied
// filename or extension, so a mismatched/spoofed extension can never influence the path
// written to disk.
const ALLOWED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png'
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const userDirectory = (userId) => path.join(DOCUMENTS_DIR, String(userId));

const ensureUserDirectory = (userId) => {
    const dir = userDirectory(userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const generateStoredFileName = (mimeType) => {
    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) throw new Error('Unsupported file type.');
    return `${crypto.randomBytes(16).toString('hex')}${ext}`;
};

// filePath, as stored in MongoDB, is always relative to STORAGE_ROOT (e.g.
// "documents/<userId>/<generatedFileName>"). This resolves it to an absolute path and
// throws if the result would fall outside STORAGE_ROOT — defense in depth against a
// corrupted or tampered filePath value ever escaping the storage directory.
const resolveAbsolutePath = (relativeFilePath) => {
    const normalizedRoot = STORAGE_ROOT + path.sep;
    const absolute = path.resolve(STORAGE_ROOT, relativeFilePath);
    if (absolute !== STORAGE_ROOT && !absolute.startsWith(normalizedRoot)) {
        throw new Error('Resolved path escapes the storage root.');
    }
    return absolute;
};

const relativeFilePath = (userId, storedFileName) =>
    path.join('documents', String(userId), storedFileName);

// Best-effort delete: an already-missing file is treated as success (nothing to clean
// up), since that's an expected outcome, not a real failure.
const deleteStoredFile = async (relativeFilePathValue) => {
    if (!relativeFilePathValue) return { ok: true };
    let absolutePath;
    try {
        absolutePath = resolveAbsolutePath(relativeFilePathValue);
    } catch (err) {
        return { ok: false, error: `Refused to delete a path outside the storage root: ${err.message}` };
    }
    try {
        await fsPromises.unlink(absolutePath);
        return { ok: true };
    } catch (err) {
        if (err.code === 'ENOENT') return { ok: true };
        return { ok: false, error: err.message };
    }
};

const removeFileIfExists = async (absolutePath) => {
    if (!absolutePath) return;
    try {
        await fsPromises.unlink(absolutePath);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`Failed to clean up orphaned upload at ${absolutePath}:`, err.message);
        }
    }
};

// Strips characters that could break a Content-Disposition header or be misread as a
// path by the receiving browser/OS.
const sanitizeDownloadFileName = (name) => {
    const base = String(name || 'document').replace(/["\r\n\\/]/g, '_').trim();
    return base || 'document';
};

module.exports = {
    STORAGE_ROOT,
    DOCUMENTS_DIR,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    userDirectory,
    ensureUserDirectory,
    generateStoredFileName,
    resolveAbsolutePath,
    relativeFilePath,
    deleteStoredFile,
    removeFileIfExists,
    sanitizeDownloadFileName
};
