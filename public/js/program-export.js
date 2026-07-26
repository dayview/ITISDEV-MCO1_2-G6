(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GEMSProgramExport = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const columns = [
    ['Program ID', 'id'],
    ['Program Name', 'name'],
    ['Program Type', 'type'],
    ['Partner University', 'university'],
    ['Country', 'country'],
    ['Application Deadline', 'deadline'],
    ['Application Period', 'periodState'],
    ['Applications', 'applications'],
    ['Status', 'status'],
    ['Last Updated', 'updated']
  ];

  function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function csvDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  function toProgramsCsv(programs = []) {
    const header = columns.map(([label]) => csvCell(label)).join(',');
    const rows = programs.map(program => columns.map(([, key]) => {
      const value = key === 'updated' ? csvDate(program[key]) : program[key];
      return csvCell(value);
    }).join(','));
    return [header, ...rows].join('\n');
  }

  function downloadProgramsCsv(programs, filename = 'programs.csv', dependencies = {}) {
    if (!Array.isArray(programs) || programs.length === 0) {
      throw new Error('No programs match the selected export criteria.');
    }

    const documentRef = dependencies.documentRef || document;
    const urlApi = dependencies.urlApi || URL;
    const BlobImpl = dependencies.BlobImpl || Blob;
    const blob = new BlobImpl(['\uFEFF', toProgramsCsv(programs)], {
      type: 'text/csv;charset=utf-8'
    });
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

    return { filename, count: programs.length };
  }

  return {
    csvCell,
    toProgramsCsv,
    downloadProgramsCsv
  };
});
