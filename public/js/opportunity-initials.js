(function (root) {
  const FILLER_WORDS = new Set([
    'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'
  ]);

  function getOpportunityInitials(institution) {
    const initials = String(institution || '')
      .trim()
      .split(/\s+/)
      .map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
      .filter(word => word && !FILLER_WORDS.has(word.toLowerCase()))
      .map(word => word[0])
      .slice(0, 5)
      .join('')
      .toUpperCase();

    return initials || 'OV';
  }

  root.GEMSOpportunityInitials = getOpportunityInitials;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = getOpportunityInitials;
  }
})(typeof window !== 'undefined' ? window : globalThis);
