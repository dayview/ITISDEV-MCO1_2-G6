const EXPORT = require('../../public/js/application-export');

describe('Application Export - request builder', () => {
    test('builds a selected export using repeated ids and the selected sort', () => {
        const url = EXPORT.buildApplicationExportUrl({
            ids: ['app-1', 'app-2'],
            filters: { status: 'submitted' },
            sort: 'cgpaDesc'
        });

        expect(url).toBe('/api/applications/export?ids=app-1&ids=app-2&sort=cgpaDesc');
    });

    test('builds a filtered export when no ids are selected', () => {
        const url = EXPORT.buildApplicationExportUrl({
            filters: {
                search: 'Dela Cruz',
                status: 'under-review',
                documentsStatus: 'incomplete',
                program: 'TUM Exchange Program'
            },
            sort: 'firstNameAsc'
        });

        expect(url).toBe('/api/applications/export?status=under-review&search=Dela+Cruz&documentsStatus=incomplete&program=TUM+Exchange+Program&sort=firstNameAsc');
    });

    test('extracts a safe server-provided filename and falls back when absent', () => {
        expect(EXPORT.getExportFilename('attachment; filename="selected-applications.csv"')).toBe('selected-applications.csv');
        expect(EXPORT.getExportFilename('')).toBe('applications.csv');
    });
});

describe('Application Export - browser download', () => {
    test('downloads the CSV without navigating away from the page', async () => {
        const anchor = { click: jest.fn(), remove: jest.fn() };
        const documentRef = {
            body: { appendChild: jest.fn() },
            createElement: jest.fn(() => anchor)
        };
        const urlApi = { createObjectURL: jest.fn(() => 'blob:csv'), revokeObjectURL: jest.fn() };
        const blob = { type: 'text/csv' };
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            blob: jest.fn().mockResolvedValue(blob),
            headers: { get: jest.fn(() => 'attachment; filename="filtered-applications.csv"') }
        });

        const result = await EXPORT.downloadApplicationsCsv(
            { filters: { status: 'submitted' } },
            { fetchImpl, documentRef, urlApi }
        );

        expect(fetchImpl).toHaveBeenCalledWith('/api/applications/export?status=submitted&sort=recency', { headers: { Accept: 'text/csv' } });
        expect(anchor.download).toBe('filtered-applications.csv');
        expect(anchor.click).toHaveBeenCalled();
        expect(anchor.remove).toHaveBeenCalled();
        expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
        expect(result.filename).toBe('filtered-applications.csv');
    });

    test('surfaces the backend error instead of downloading an error response', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: jest.fn().mockResolvedValue({ error: 'No applications match the selected export criteria.' })
        });

        await expect(EXPORT.downloadApplicationsCsv({}, { fetchImpl }))
            .rejects.toThrow('No applications match the selected export criteria.');
    });
});
