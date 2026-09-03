/**
 * Shared CSV cell writer for planner-ui's export paths (the report model,
 * the year cash-flow detail CSV, and the inherited-ledger columns used by
 * `ResultsPage`'s ledger CSV). One neutralization-then-quoting policy so
 * every consumer writes byte-identical spreadsheet-safe cells.
 *
 * Neutralization: a text cell whose first non-control-whitespace character
 * is one of `= + - @` or a literal tab/CR is prefixed with an apostrophe
 * (the standard "render as text" marker) before quoting. Excel/Sheets
 * evaluate a formula-shaped cell even when CSV-quoted, and a bare CR also
 * splits a row, so both must be defused. Leading ASCII spaces AND other C0
 * control characters (LF, FF, VT, NUL, …) are skipped when looking for the
 * trigger character (" =SUM(A1)" and "\n=SUM(A1)" are both caught) — a
 * quoted cell keeps a leading control character as the literal start of its
 * value, so it can still precede a formula prefix once the cell is read
 * back. \t and \r are the exception: they are themselves triggers and are
 * never skipped as leading whitespace, since either can also split or shift
 * a row on its own.
 *
 * Quoting: any cell containing a comma, double quote, or line break is
 * wrapped in double quotes with embedded quotes doubled.
 */

const FORMULA_TRIGGER = /[=+\-@\t\r]/

function isFormulaLike(value: string): boolean {
  let i = 0
  // Skip any leading C0 control character or space that is not itself a
  // trigger — this walks past a bare LF/FF/VT/NUL the same way it walks
  // past a space, so a payload hidden behind one of those cannot dodge the
  // guard the way it could when only ASCII spaces were skippable.
  while (i < value.length && value.charCodeAt(i) <= 0x20 && !FORMULA_TRIGGER.test(value[i])) i++
  return i < value.length && FORMULA_TRIGGER.test(value[i])
}

/** Quote a CSV cell when it contains commas, quotes, or newlines. No formula neutralization. */
export function csvQuote(value: string): string {
  if (value === '') return value
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Format one CSV cell: `null`/`undefined` become an empty cell, numbers
 * pass through bare, and text is neutralized against spreadsheet formula
 * injection, then quoted if needed.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  const neutralized = isFormulaLike(value) ? `'${value}` : value
  return csvQuote(neutralized)
}
