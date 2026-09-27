/**
 * The one sum of a conversion schedule (B2-P1 slice 3): its amounts added left
 * to right from 0, the order every surface used, so the same schedule always
 * gives the same double (IEEE 754 addition is not associative). Nominal
 * dollars of different years, undiscounted. Refuses a non-finite amount with a
 * RangeError.
 *
 * A leaf module with no imports, so a page that only prints a schedule's total
 * does not load the optimizer's LP builder; `strategies/optimizer.ts`
 * re-exports it.
 *
 * @see DOCS/calculations/roth/optimizer-schedule-conversion-total.md
 */
export function conversionScheduleTotal(conversions: readonly { readonly amount: number }[]): number {
  let total = 0
  for (const conversion of conversions) {
    if (!Number.isFinite(conversion.amount)) {
      throw new RangeError(`A conversion schedule's amounts must be finite; got ${String(conversion.amount)}`)
    }
    total += conversion.amount
  }
  return total
}
