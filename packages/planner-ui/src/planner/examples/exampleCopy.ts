/**
 * One truthful persistence story for library examples, shared across the
 * preview banner, the workspace save indicator, and the open-example dialog so
 * they cannot drift apart (UI/UX round 2, Step 2).
 *
 * The behavior these describe: an opened example is saved on this device under
 * a fixed `example:<id>` slot, so edits persist across reloads. It stays out of
 * the "Your plans" list until "Save to my plans" promotes it to a real plan;
 * "Load a fresh copy" resets the slot to the example's defaults.
 */

import { DEFAULT_HOME_LABEL } from '../editionContext'
import { EXAMPLE_FIXED_YEAR } from './exampleClock'

/** Save indicator shown in the workspace header for `origin: 'example'` plans. */
export const EXAMPLE_SAVE_INDICATOR = 'Example: edits kept on this device until you reset'

/**
 * Preview-banner sentence describing where an example's edits live.
 *
 * `homeLabel` names the planner-home destination the example stays out of until
 * promoted — 'Your plans' in the free web app, a host edition's own label (e.g.
 * 'Client library') when supplied via `PlannerEditionProvider`. It is a function
 * of the label, defaulting to the web copy, so existing hosts are unaffected.
 */
export function exampleBannerPersistence(homeLabel: string = DEFAULT_HOME_LABEL): string {
  return `Your edits are kept on this device, but this example stays out of ${homeLabel} until you Save to my plans.`
}

/**
 * The banner's first sentence, shown on every example: the year it is set in
 * and what that fixes (D-2027-ROLLOVER). An example runs from
 * EXAMPLE_FIXED_YEAR whatever the clock says, so its figures match its
 * description in every year.
 */
export function exampleBannerYear(): string {
  const y = EXAMPLE_FIXED_YEAR
  return (
    `This example is set in ${y}. It starts in ${y} and uses ${y} dollars, ${y} ages and the tax figures ` +
    `published for ${y}, so its results match its description.`
  )
}

/**
 * The banner's second sentence, once the clock's year is past the example's:
 * what Save to my plans changes. A saved copy is the household's own plan, so
 * it runs from the clock's year and reads its balances and dated events as of
 * then. Null while the clock is still in the example's year.
 */
export function exampleBannerLaterYear(clockYear: number): string | null {
  if (clockYear <= EXAMPLE_FIXED_YEAR) return null
  return (
    `Save to my plans to run it from ${clockYear}. Your copy's balances and dated events will then be read as of ` +
    `${clockYear}, and its results will change.`
  )
}

/** "Open my version" choice: opening the previously edited example. */
export const EXAMPLE_OPEN_EXISTING_DESC = 'Keeps the edits you made last time, saved on this device.'

/** "Load a fresh copy" choice: resetting the example slot to defaults. */
export const EXAMPLE_LOAD_FRESH_DESC = 'Resets this example to its defaults, discarding edits kept on this device.'
