function dayOfWeek(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const adjustedYear = month < 3 ? year - 1 : year
  return (
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    offsets[month - 1]! +
    day
  ) % 7
}

/**
 * Ordinary nationwide federal individual filing deadline under IRC 6072(a)
 * with IRC 7503 weekend / District of Columbia legal-holiday adjustments
 * (Notice 2011-17). Supported integer tax years are 2006..9998. Extensions,
 * disaster relief, and state-office holidays are outside this helper.
 */
export function ordinaryFederalFilingDeadline(taxYear: number): string | null {
  // Supported calendar scope is tax years 2006..9998 (filing seasons from
  // 2007). Earlier years need historical calendars outside this helper.
  if (!Number.isInteger(taxYear) || taxYear < 2006 || taxYear >= 9999) {
    return null
  }
  const deadlineYear = taxYear + 1
  const april16Weekday = dayOfWeek(deadlineYear, 4, 16)
  const observedEmancipationDay = april16Weekday === 6
    ? 15
    : april16Weekday === 0
      ? 17
      : 16
  let day = 15
  while (
    dayOfWeek(deadlineYear, 4, day) === 0 ||
    dayOfWeek(deadlineYear, 4, day) === 6 ||
    day === observedEmancipationDay
  ) day++
  return `${String(deadlineYear).padStart(4, '0')}-04-${String(day).padStart(2, '0')}`
}
