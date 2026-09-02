/**
 * The range a field may accept, taken from the engine's schema rather than
 * chosen here (#476, review r3-2, r3-3).
 *
 * A field's own `min`/`max` used to be hand-written at the call site, which
 * could be tighter than what the engine allows — a safe-withdrawal rate of
 * 0.05 is valid to the engine and was refused by the control. The engine's
 * Plan JSON Schema is the only source: `schemaFieldBounds.generated.ts` holds
 * its numeric bounds for every wired path, and a drift test regenerates that
 * map from `@retiregolden/engine/schema/current`.
 *
 * Where the card shows a value in a different unit from the one the plan
 * stores (the brokerage qualified-dividend share is a 0–1 ratio shown as a
 * percent), the bound is converted the same way the advice is.
 */

import { SCHEMA_FIELD_BOUNDS, type SchemaBounds } from './schemaFieldBounds.generated'
import { displayScaleFor } from './validationIssues'

export type { SchemaBounds }

/** `accounts.3.balance` → `accounts.N.balance`, the shape the map is keyed by. */
export function boundsKey(path: string): string {
  return path
    .split('.')
    .map((segment) => (/^\d+$/.test(segment) ? 'N' : segment))
    .join('.')
}

const scaled = (value: number | undefined, scale: number): number | undefined =>
  value === undefined ? undefined : value * scale

/**
 * What the engine allows at this path, in the unit the field displays. Null
 * when the path is not a number in the schema, or when the field has no path
 * (an import-wizard or lever control outside a plan).
 */
export function boundsForPath(path: string | undefined): SchemaBounds | null {
  if (!path) return null
  const bounds = SCHEMA_FIELD_BOUNDS[boundsKey(path)]
  if (!bounds) return null
  const scale = displayScaleFor(path)
  if (scale === 1) return bounds
  return {
    min: scaled(bounds.min, scale),
    max: scaled(bounds.max, scale),
    exclusiveMin: scaled(bounds.exclusiveMin, scale),
    exclusiveMax: scaled(bounds.exclusiveMax, scale),
  }
}

export interface RangeCheck {
  /** Which side of the range the value falls outside, or null when it is allowed. */
  side: 'low' | 'high' | null
  /** The message for that side, in the field's own unit. */
  message: string | null
}

/** Whether `n` is inside `bounds`, and what to say when it is not. */
export function checkRange(n: number, bounds: SchemaBounds | null): RangeCheck {
  if (!bounds) return { side: null, message: null }
  if (bounds.min !== undefined && n < bounds.min) return { side: 'low', message: `Must be at least ${bounds.min}` }
  if (bounds.exclusiveMin !== undefined && n <= bounds.exclusiveMin) {
    return { side: 'low', message: `Must be more than ${bounds.exclusiveMin}` }
  }
  if (bounds.max !== undefined && n > bounds.max) return { side: 'high', message: `Must be at most ${bounds.max}` }
  if (bounds.exclusiveMax !== undefined && n >= bounds.exclusiveMax) {
    return { side: 'high', message: `Must be less than ${bounds.exclusiveMax}` }
  }
  return { side: null, message: null }
}

/**
 * What the field says about an entry it did not keep, naming the bound it
 * missed the way the range message does: an inclusive bound is "the lowest
 * allowed", an exclusive one is a value the entry has to be beyond, so 0 is
 * never presented as an allowed safe-withdrawal rate (r4-3).
 */
export function notKeptNote(entry: string, side: 'low' | 'high', bounds: SchemaBounds | null): string {
  if (side === 'low') {
    if (bounds?.min !== undefined) return `Not kept: ${entry} is below the lowest allowed, ${bounds.min}`
    if (bounds?.exclusiveMin !== undefined) return `Not kept: ${entry} must be more than ${bounds.exclusiveMin}`
    return `Not kept: ${entry} is below the lowest allowed`
  }
  if (bounds?.max !== undefined) return `Not kept: ${entry} is above the highest allowed, ${bounds.max}`
  if (bounds?.exclusiveMax !== undefined) return `Not kept: ${entry} must be less than ${bounds.exclusiveMax}`
  return `Not kept: ${entry} is above the highest allowed`
}

/** The bounds a native number input can advertise (an exclusive bound has no HTML equivalent). */
export function nativeMin(bounds: SchemaBounds | null): number | undefined {
  return bounds?.min
}

export function nativeMax(bounds: SchemaBounds | null): number | undefined {
  return bounds?.max
}
