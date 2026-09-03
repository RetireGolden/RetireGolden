/**
 * Input-event helpers for shared planner fields. Pure, so tests can pin
 * Chromium's insertReplacementText / date-year overflow without a DOM.
 */

const REPLACEMENT_INPUT_TYPES = new Set(['insertReplacementText', 'insertFromAutocomplete'])

/** Digits (and sign/decimal) of a money string, ignoring $ / commas / spaces. */
function amountCore(text: string): string {
  return text.trim().replace(/[$,\s]/g, '')
}

/**
 * True when Chromium concatenated a full-field replacement onto the value
 * that was already there ("450" + "450" → "450450"). A partial selection
 * does not double the inserted fragment that way.
 */
function isDoubledFullFieldReplacement(targetValue: string, data: string): boolean {
  const inserted = amountCore(data)
  return inserted !== '' && amountCore(targetValue) === inserted + inserted
}

/**
 * Next money-field text after a browser `input` event.
 *
 * Default is the input's target value — that is the complete result when
 * only a selected span is replaced (e.g. `25` in `12,500` → `13,000`).
 * Chromium autofill / insertReplacementText can instead concatenate a
 * full-field replacement onto the already-displayed value ("450" →
 * "450450"); only that doubled case uses `data` as the whole new value.
 */
export function nextMoneyFieldText(args: {
  targetValue: string
  inputType?: string
  data?: string | null
}): string {
  if (
    args.inputType !== undefined &&
    REPLACEMENT_INPUT_TYPES.has(args.inputType) &&
    args.data != null &&
    isDoubledFullFieldReplacement(args.targetValue, args.data)
  ) {
    return args.data
  }
  return args.targetValue
}

/** Unformatted editing text: empty when there is nothing to edit, else the raw number. */
export function editingMoneyText(value: number | null): string {
  if (value === null || value === 0) return ''
  return String(value)
}

/**
 * Cap an ISO date's year at 4 digits. Chromium's date control can overflow
 * the year segment (`04/12/121983` → `121983-04-12`); the extra digits are
 * a leading spill, so the calendar year is the last four.
 */
export function capIsoDateYear(iso: string): string {
  const m = /^(\d{5,})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[1].slice(-4)}-${m[2]}-${m[3]}`
}
