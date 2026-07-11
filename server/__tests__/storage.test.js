const fs = require('fs');
const path = require('path');
const {
    STORAGE_ROOT,
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
} = require('../lib/storage');

// Everything below writes only inside a clearly-marked test subdirectory of the real
// storage root, cleaned up in afterAll, so it never pollutes real development uploads
// and never touches any other user's directory.
const TEST_USER_ID = '__storage_test_user__';

afterAll(() => {
    fs.rmSync(userDirectory(TEST_USER_ID), { recursive: true, force: true });
});

describe('Storage Logic - allowlist and limits', () => {
    test('allows exactly PDF, JPEG, and PNG', () => {
        expect(Object.keys(ALLOWED_MIME_TYPES).sort()).toEqual(
            ['application/pdf', 'image/jpeg', 'image/png'].sort()
        );
    });

    test('max file size is 5 MB', () => {
        expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });
});

describe('Storage Logic - generateStoredFileName', () => {
    test('generates a random hex name with the extension matching the MIME type', () => {
        expect(generateStoredFileName('application/pdf')).toMatch(/^[a-f0-9]{32}\.pdf$/);
        expect(generateStoredFileName('image/jpeg')).toMatch(/^[a-f0-9]{32}\.jpg$/);
        expect(generateStoredFileName('image/png')).toMatch(/^[a-f0-9]{32}\.png$/);
    });

    test('never derives the extension from client input — throws for a disallowed MIME type', () => {
        expect(() => generateStoredFileName('application/x-msdownload')).toThrow();
        expect(() => generateStoredFileName('text/html')).toThrow();
    });

    test('produces a different name on every call', () => {
        const a = generateStoredFileName('application/pdf');
        const b = generateStoredFileName('application/pdf');
        expect(a).not.toBe(b);
    });
});

describe('Storage Logic - relativeFilePath', () => {
    test('builds a path scoped to documents/<userId>/<storedFileName>', () => {
        expect(relativeFilePath('user123', 'abc.pdf')).toBe(path.join('documents', 'user123', 'abc.pdf'));
    });
});

describe('Storage Logic - resolveAbsolutePath (path traversal defense)', () => {
    test('resolves a normal relative path inside the storage root', () => {
        const resolved = resolveAbsolutePath(path.join('documents', 'u1', 'file.pdf'));
        expect(resolved.startsWith(STORAGE_ROOT)).toBe(true);
    });

    test('throws when the relative path attempts to escape the storage root with ../', () => {
        expect(() => resolveAbsolutePath('../../../../etc/passwd')).toThrow(/escapes the storage root/);
    });

    test('throws for a deeply nested traversal attempt', () => {
        expect(() => resolveAbsolutePath(path.join('documents', 'u1', '..', '..', '..', 'secrets.txt'))).toThrow();
    });

    test('an absolute path outside the root is also rejected', () => {
        expect(() => resolveAbsolutePath('/etc/passwd')).toThrow();
    });
});

describe('Storage Logic - sanitizeDownloadFileName', () => {
    test('passes through an ordinary filename unchanged', () => {
        expect(sanitizeDownloadFileName('transcript.pdf')).toBe('transcript.pdf');
    });

    test('strips quotes, slashes, and newlines that could break the header or imply a path', () => {
        expect(sanitizeDownloadFileName('evil".pdf')).not.toContain('"');
        expect(sanitizeDownloadFileName('../../etc/passwd')).not.toContain('/');
        expect(sanitizeDownloadFileName('name\r\nwith\nlines')).not.toMatch(/[\r\n]/);
    });

    test('falls back to a safe default for an empty or missing name', () => {
        expect(sanitizeDownloadFileName('')).toBe('document');
        expect(sanitizeDownloadFileName(undefined)).toBe('document');
    });
});

describe('Storage Logic - ensureUserDirectory and deleteStoredFile (real filesystem, isolated test dir)', () => {
    test('creates the user directory if missing', () => {
        const dir = ensureUserDirectory(TEST_USER_ID);
        expect(fs.existsSync(dir)).toBe(true);
        expect(dir.startsWith(STORAGE_ROOT)).toBe(true);
    });

    test('is idempotent — calling it again does not throw', () => {
        expect(() => ensureUserDirectory(TEST_USER_ID)).not.toThrow();
    });

    test('deletes a real file that exists', async () => {
        const dir = ensureUserDirectory(TEST_USER_ID);
        const storedName = generateStoredFileName('application/pdf');
        const absolutePath = path.join(dir, storedName);
        fs.writeFileSync(absolutePath, 'fake pdf bytes');
        expect(fs.existsSync(absolutePath)).toBe(true);

        const result = await deleteStoredFile(relativeFilePath(TEST_USER_ID, storedName));
        expect(result.ok).toBe(true);
        expect(fs.existsSync(absolutePath)).toBe(false);
    });

    test('treats an already-missing file as success, not an error', async () => {
        const result = await deleteStoredFile(relativeFilePath(TEST_USER_ID, 'does-not-exist.pdf'));
        expect(result.ok).toBe(true);
    });

    test('refuses to delete a path outside the storage root', async () => {
        const result = await deleteStoredFile('../../../../etc/passwd');
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/escapes the storage root/);
    });

    test('deleteStoredFile with no path at all is a safe no-op success', async () => {
        expect((await deleteStoredFile(undefined)).ok).toBe(true);
        expect((await deleteStoredFile('')).ok).toBe(true);
    });

    test('removeFileIfExists silently succeeds for a missing file and removes an existing one', async () => {
        const dir = ensureUserDirectory(TEST_USER_ID);
        const absolutePath = path.join(dir, 'temp-cleanup-test.pdf');
        fs.writeFileSync(absolutePath, 'x');

        await removeFileIfExists(absolutePath);
        expect(fs.existsSync(absolutePath)).toBe(false);

        // Second call on the now-missing file must not throw.
        await expect(removeFileIfExists(absolutePath)).resolves.toBeUndefined();
    });
});
