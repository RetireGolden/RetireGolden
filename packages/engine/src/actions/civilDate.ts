export interface CivilDate {
  year: number
  month: number
  day: number
}

const CIVIL_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Parse a canonical ISO civil date without permitting JavaScript Date rollover. */
export function parseCivilIsoDate(value: string): CivilDate | null {
  const match = CIVIL_ISO_DATE.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null
  }
  return { year, month, day }
}

export function formatCivilDate(date: CivilDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

/**
 * Add proleptic-Gregorian calendar months, preserving the day when possible
 * and otherwise clamping to the target month's final civil day.
 */
export function addCalendarMonths(value: string, months: number): string | null {
  const date = parseCivilIsoDate(value)
  if (date === null || !Number.isSafeInteger(months)) return null
  const zeroBasedMonth = date.year * 12 + date.month - 1 + months
  const year = Math.floor(zeroBasedMonth / 12)
  const month = ((zeroBasedMonth % 12) + 12) % 12 + 1
  if (year < 1 || year > 9999) return null
  return formatCivilDate({
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month)),
  })
}
