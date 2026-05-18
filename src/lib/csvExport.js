// CSV export helper. Pure functions, no DOM side effects in `toCSV` so it
// can be unit-tested; the file download lives in `downloadCSV`.

// Escape per RFC 4180: wrap in quotes if value contains comma/quote/newline,
// and double internal quotes.
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Build CSV text from an array of objects + a column spec.
 *
 * @param {Array<Object>} rows    Data
 * @param {Array<{ header: string, accessor: (row) => any }>} columns
 * @returns {string}
 */
export function toCSV(rows, columns) {
  const headerLine = columns.map(c => escapeCell(c.header)).join(',')
  const dataLines = rows.map(r =>
    columns.map(c => {
      try { return escapeCell(c.accessor(r)) } catch { return '' }
    }).join(',')
  )
  return [headerLine, ...dataLines].join('\n')
}

/**
 * Trigger a browser download of CSV text. Caller provides filename suffix.
 */
export function downloadCSV(csvText, filename) {
  try {
    const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Defer revoke so the click handler completes first
    setTimeout(() => URL.revokeObjectURL(url), 100)
  } catch (err) {
    console.error('CSV download failed:', err)
  }
}
