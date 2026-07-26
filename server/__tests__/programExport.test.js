const PROGRAM_EXPORT = require('../../public/js/program-export');

describe('Program Export - CSV formatting', () => {
    test('exports real program fields in a stable column order', () => {
        const csv = PROGRAM_EXPORT.toProgramsCsv([{
            id: 'program-1',
            name: 'TUM Exchange Program',
            type: 'Semester Exchange',
            university: 'Technical University of Munich',
            country: 'Germany',
            deadline: '2026-07-31',
            periodState: 'Open',
            applications: 12,
            status: 'Published',
            updated: '2026-07-20T10:30:00.000Z'
        }]);
        const lines = csv.split('\n');

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('"Program ID","Program Name","Program Type","Partner University","Country","Application Deadline","Application Period","Applications","Status","Last Updated"');
        expect(lines[1]).toContain('"program-1","TUM Exchange Program"');
        expect(lines[1]).toContain('"12","Published","2026-07-20"');
    });

    test('escapes quotes and neutralizes spreadsheet formulas', () => {
        const csv = PROGRAM_EXPORT.toProgramsCsv([{
            name: '=HYPERLINK("https://example.test")',
            university: 'University "A"'
        }]);

        expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
        expect(csv).toContain('"University ""A"""');
    });
});

describe('Program Export - browser download', () => {
    test('downloads the generated CSV without navigating away', () => {
        const anchor = { click: jest.fn(), remove: jest.fn() };
        const documentRef = {
            body: { appendChild: jest.fn() },
            createElement: jest.fn(() => anchor)
        };
        const urlApi = {
            createObjectURL: jest.fn(() => 'blob:programs'),
            revokeObjectURL: jest.fn()
        };
        const BlobImpl = jest.fn((parts, options) => ({ parts, options }));

        const result = PROGRAM_EXPORT.downloadProgramsCsv(
            [{ id: 'program-1', name: 'TUM Exchange Program' }],
            'selected-programs.csv',
            { documentRef, urlApi, BlobImpl }
        );

        expect(BlobImpl).toHaveBeenCalledWith(
            expect.arrayContaining(['\uFEFF']),
            { type: 'text/csv;charset=utf-8' }
        );
        expect(anchor.download).toBe('selected-programs.csv');
        expect(anchor.click).toHaveBeenCalled();
        expect(anchor.remove).toHaveBeenCalled();
        expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:programs');
        expect(result).toEqual({ filename: 'selected-programs.csv', count: 1 });
    });

    test('rejects an empty export instead of reporting fake success', () => {
        expect(() => PROGRAM_EXPORT.downloadProgramsCsv([]))
            .toThrow('No programs match the selected export criteria.');
    });
});
