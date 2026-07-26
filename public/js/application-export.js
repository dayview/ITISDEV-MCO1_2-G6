(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GEMSApplicationExport = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const FILTER_KEYS = ['status', 'college', 'search', 'documentsStatus', 'program'];

  function buildApplicationExportUrl({ ids = [], filters = {}, sort = 'recency' } = {}) {
    const params = new URLSearchParams();
    const selectedIds = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];

    selectedIds.forEach(id => params.append('ids', id));
    if (!selectedIds.length) {
      FILTER_KEYS.forEach(key => {
        if (filters[key]) params.set(key, String(filters[key]));
      });
    }
    if (sort) params.set('sort', String(sort));

    const query = params.toString();
    return `/api/applications/export${query ? `?${query}` : ''}`;
  }

  function getExportFilename(contentDisposition, fallback = 'applications.csv') {
    const match = String(contentDisposition || '').match(/filename="?([^";]+)"?/i);
    return match?.[1] || fallback;
  }

  async function responseError(response) {
    try {
      const result = await response.json();
      return result.error || `Export failed with HTTP ${response.status}.`;
    } catch (_error) {
      return `Export failed with HTTP ${response.status}.`;
    }
  }

  async function downloadApplicationsCsv(options = {}, dependencies = {}) {
    const fetchImpl = dependencies.fetchImpl || fetch;
    const exportUrl = buildApplicationExportUrl(options);
    const response = await fetchImpl(exportUrl, { headers: { Accept: 'text/csv' } });

    if (!response.ok) throw new Error(await responseError(response));

    const documentRef = dependencies.documentRef || document;
    const urlApi = dependencies.urlApi || URL;
    const blob = await response.blob();
    const filename = getExportFilename(response.headers.get('Content-Disposition'));
    const objectUrl = urlApi.createObjectURL(blob);
    const anchor = documentRef.createElement('a');

    try {
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.hidden = true;
      documentRef.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      urlApi.revokeObjectURL(objectUrl);
    }

    return { exportUrl, filename };
  }

  return {
    buildApplicationExportUrl,
    getExportFilename,
    downloadApplicationsCsv
  };
});
