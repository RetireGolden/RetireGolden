/**
 * The library examples' fixed clock, in a leaf module.
 *
 * Every library example is written as a 2026 snapshot: its balances are as of
 * 2026, its ages are 2026 ages, and its copy quotes figures a 2026 start
 * produces. So an example runs from EXAMPLE_FIXED_YEAR on every page, whatever
 * the clock says (decision D-2027-ROLLOVER, 2026-09-28). `projection.ts` reads
 * the year from here, so the projection seam never imports the example builders.
 *
 * A yearly re-date of the library moves these three values together, with the
 * builders' dates of birth and dated events (every builder writes its calendar
 * years relative to EXAMPLE_FIXED_YEAR, so the re-date is mechanical) and the
 * printed copy, gated by the copy test run at the new year.
 */

/** The instant every example is stamped with (created and last saved). */
export const EXAMPLE_FIXED_NOW_ISO = '2026-06-29T12:00:00.000Z'

export function exampleFixedNow(): Date {
  return new Date(EXAMPLE_FIXED_NOW_ISO)
}

/** The year every library example starts in, and the year its dollars are. */
export const EXAMPLE_FIXED_YEAR = 2026
