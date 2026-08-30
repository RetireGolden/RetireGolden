/**
 * Projection engine types. The deterministic annual ledger is the core v2
 * artifact: Monte Carlo (roadmap V4) drives this same simulation with
 * stochastic inputs, never a separate model.
 *
 * @see DOCS/architecture.md (simulation core)
 *
 * This module is the type surface's façade. The declarations themselves live
 * in per-domain slices under `internal/types/`, which the package export map
 * blocks, so `projection/types.js` remains the one public specifier for every
 * name below and no import site anywhere has to know which slice holds what.
 * The slices are listed in dependency order — each one may read the slices
 * above it and none reads a slice below it.
 */

export * from './internal/types/market.js'
export * from './internal/types/tax.js'
export * from './internal/types/yearLedger.js'
export * from './internal/types/aca.js'
export * from './internal/types/optimizer.js'
export * from './internal/types/retirementRuntime.js'
export * from './internal/types/ownedIraReplay.js'
export * from './internal/types/accountActivity.js'
export * from './internal/types/cashFlow.js'
export * from './internal/types/result.js'
