/**
 * The one writer for planner-ui's CSV downloads (the Results ledger CSV and
 * the year cash-flow detail CSV).
 *
 * The file starts with the UTF-8 byte-order mark. Without it, Excel on Windows
 * opens a CSV in the system code page, so any non-ASCII text (a middle dot in
 * a cash-flow label, an accented name, a curly apostrophe) shows as mojibake
 * such as "Â·". Spreadsheet programs that read UTF-8 anyway skip the mark.
 * The CSV text after it is exactly what the serializer produced; nothing in
 * the repository reads these downloads back.
 */

/** U+FEFF, which UTF-8 encodes as the bytes EF BB BF. */
export const UTF8_BYTE_ORDER_MARK = '\uFEFF'

/** The file a CSV download hands the browser: the byte-order mark, then the CSV text unchanged. */
export function csvDownloadBlob(csv: string): Blob {
  return new Blob([UTF8_BYTE_ORDER_MARK + csv], { type: 'text/csv;charset=utf-8' })
}

/** Saves `csv` as `fileName` through a temporary object URL. */
export function downloadCsv(csv: string, fileName: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(csvDownloadBlob(csv))
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}
