const getOpportunityInitials = require('../../public/js/opportunity-initials');

describe('opportunity institution initials', () => {
  test.each([
    ['National University of Singapore', 'NUS'],
    ['Technical University of Munich', 'TUM'],
    ['University of Tokyo', 'UT'],
    ['Hong Kong University of Science & Technology', 'HKUST'],
    ['Massachusetts Institute of Technology', 'MIT'],
    ['', 'OV']
  ])('formats %p as %s', (institution, expected) => {
    expect(getOpportunityInitials(institution)).toBe(expected);
  });
});
