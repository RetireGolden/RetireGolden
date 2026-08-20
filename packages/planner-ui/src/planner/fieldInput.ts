/**
 * Input-event helpers for shared planner fields. Pure, so tests can pin
 * Chromium's insertReplacementText / date-year overflow without a DOM.
 */

const REPLACEMENT_INPUT_TYPES = new Set(['insertReplacementText', 'insertFromAutocomplete'])

/**
 * Next money-field text after a browser `input` event.
 *
 * Chromium autofill and insertReplacementText can concatenate into an
 * already-formatted display ("450" + replacement "450" → "450450"). For
 * those input types the event's `data` is the whole new value.
 */
export function nextMoneyFieldText(args: {
  targetValue: string
  inputType?: string
  data?: string | null
}): string {
  if (args.inputType !== undefined && REPLACEMENT_INPUT_TYPES.has(args.inputType) && args.data != null) {
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
  return `${m[1]!.slice(-4)}-${m[2]}-${m[3]}`
}
