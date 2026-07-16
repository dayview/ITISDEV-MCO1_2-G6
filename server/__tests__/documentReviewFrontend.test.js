const { validateReview, statusLabel } = require('../../public/js/document-review-ui');

describe('Document review frontend helpers', () => {
    test('blocks a rejection without feedback before sending it to the API', () => {
        expect(validateReview('rejected', '')).toBe('A rejection reason is required.');
        expect(validateReview('rejected', 'Wrong document')).toBe('');
    });

    test('allows verification without feedback', () => {
        expect(validateReview('verified', '')).toBe('');
    });

    test('renders stable user-facing review labels', () => {
        expect(statusLabel('pending')).toBe('Pending Review');
        expect(statusLabel('verified')).toBe('Verified');
        expect(statusLabel('rejected')).toBe('Rejected');
    });
});
