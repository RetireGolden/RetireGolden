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

/** Save indicator shown in the workspace header for `origin: 'example'` plans. */
export const EXAMPLE_SAVE_INDICATOR = 'Example — edits kept on this device until you reset'

/** Preview-banner sentence describing where an example's edits live. */
export const EXAMPLE_BANNER_PERSISTENCE =
  'Your edits are kept on this device, but this example stays out of Your plans until you Save to my plans.'

/** "Open my version" choice: opening the previously edited example. */
export const EXAMPLE_OPEN_EXISTING_DESC = 'Keeps the edits you made last time, saved on this device.'

/** "Load a fresh copy" choice: resetting the example slot to defaults. */
export const EXAMPLE_LOAD_FRESH_DESC = 'Resets this example to its defaults, discarding edits kept on this device.'
