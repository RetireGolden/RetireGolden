/**
 * Package-private capability for the legacy aggregate optimizer calculation
 * path. The package export map blocks `projection/internal/*`, so public
 * decision callers cannot forge membership in this module-local WeakSet.
 *
 * Remove this boundary when the WS4 optimizer bridge emits identity-bearing
 * actions and exact comparison evidence.
 */
const legacyAggregateDecisionCalculations = new WeakSet<object>()

export function allowLegacyAggregateDecisionCalculation<T extends object>(options: T): T {
  const allowed = Object.assign({}, options)
  legacyAggregateDecisionCalculations.add(allowed)
  return allowed
}

export function isLegacyAggregateDecisionCalculation(options: unknown): boolean {
  return typeof options === 'object' &&
    options !== null &&
    legacyAggregateDecisionCalculations.has(options)
}
