/**
 * Shared CSV cell writer for planner-ui's export paths (the report model,
 * the year cash-flow detail CSV, and the inherited-ledger columns used by
 * `ResultsPage`'s ledger CSV). One neutralization-then-quoting policy so
 * every consumer writes byte-identical spreadsheet-safe cells.
 *
 * Neutralization: a text cell whose first non-space character is one of
 * `= + - @` or a literal tab/CR is prefixed with an apostrophe (the
 * standard "render as text" marker) before quoting. Excel/Sheets evaluate a
 * formula-shaped cell even when CSV-quoted, and a bare CR also splits a
 * row, so both must be defused. Leading ASCII spaces are skipped when
 * looking for the trigger character (" =SUM(A1)" is still caught); \t and
 * \r are themselves triggers, never treated as skippable leading
 * whitespace.
 *
 * Quoting: any cell containing a comma, double quote, or line break is
 * wrapped in double quotes with embedded quotes doubled.
 */

const FORMULA_TRIGGER = /[=+\-@\t\r]/

function isFormulaLike(value: string): boolean {
  let i = 0
  while (i < value.length && value[i] === ' ') i++
  return i < value.length && FORMULA_TRIGGER.test(value[i]!)
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
