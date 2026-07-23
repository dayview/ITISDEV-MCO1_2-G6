const STORE = require('../../public/js/application-store');

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body)
});

describe('Quick Apply application store - real document integration', () => {
    test('loads the authenticated student documents from the backend', async () => {
        const fetchMock = jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: [{ id: 'doc1', type: 'transcript', originalFileName: 'actual-grades.pdf', status: 'pending' }]
        }));

        await expect(STORE.loadDocuments(fetchMock)).resolves.toEqual([
            { id: 'doc1', type: 'transcript', originalFileName: 'actual-grades.pdf', status: 'pending' }
        ]);
        expect(fetchMock).toHaveBeenCalledWith('/api/documents');
    });

    test('builds the preview from real filenames and reports missing requirements', async () => {
        await STORE.loadDocuments(jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: [{ id: 'doc1', type: 'transcript', originalFileName: 'leon-transcript.pdf', status: 'verified' }]
        })));

        const evaluation = STORE.evaluateOpportunity({
            eligible: true,
            requiredDocuments: ['Official Transcript', 'Passport']
        });

        expect(evaluation).toEqual({
            bundle: [{
                requirement: 'Official Transcript',
                type: 'transcript',
                fileName: 'leon-transcript.pdf',
                documentId: 'doc1',
                status: 'verified'
            }],
            missing: ['Passport'],
            ready: false
        });
    });

    test('uses the latest uploaded document when a type has replacements', async () => {
        await STORE.loadDocuments(jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: [
                { id: 'new', type: 'passport', originalFileName: 'new-passport.pdf', uploadedAt: '2026-07-20T10:00:00Z' },
                { id: 'old', type: 'passport', originalFileName: 'old-passport.pdf', uploadedAt: '2026-07-10T10:00:00Z' }
            ]
        })));

        const evaluation = STORE.evaluateOpportunity({ eligible: true, requiredDocuments: ['Passport'] });
        expect(evaluation.bundle[0].fileName).toBe('new-passport.pdf');
        expect(evaluation.bundle[0].documentId).toBe('new');
        expect(evaluation.ready).toBe(true);
    });

    test('clears cached documents when the document API fails', async () => {
        await STORE.loadDocuments(jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: [{ id: 'doc1', type: 'transcript', originalFileName: 'grades.pdf' }]
        })));

        const fetchMock = jest.fn().mockResolvedValue(jsonResponse(
            { success: false, error: 'Unable to load documents.' },
            { ok: false, status: 500 }
        ));

        await expect(STORE.loadDocuments(fetchMock)).rejects.toThrow('Unable to load documents.');
        expect(STORE.getDocuments()).toEqual([]);
    });

    test('submits only the opportunity id after evaluating the loaded bundle', async () => {
        await STORE.loadDocuments(jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: [{ id: 'doc1', type: 'transcript', originalFileName: 'grades.pdf', status: 'verified' }]
        })));

        const fetchMock = jest.fn().mockResolvedValue(jsonResponse({
            success: true,
            data: { id: 'application1', status: 'submitted' }
        }, { status: 201 }));
        const opportunity = { id: 'opportunity1', eligible: true, requiredDocuments: ['Transcript'] };

        const result = await STORE.submitApplicationToBackend(opportunity, fetchMock);

        expect(result.ok).toBe(true);
        expect(result.evaluation.ready).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opportunityId: 'opportunity1' })
        });
    });
});
