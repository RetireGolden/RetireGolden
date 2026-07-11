/**
 * Ledger-native decision engine (DOCS/enhancements/ledger-native-decision-engine.md).
 *
 * Shared foundation for Insights, the Roth & Tax Optimizer, Social Security
 * candidates, and future decision tools: candidates are generated cheaply,
 * evaluated exactly through `simulatePlan`, ranked by objective policies, and
 * only exact-ledger winners become recommendations.
 */

export * from './types.js'
export * from './evaluateCandidate.js'
export * from './objectives.js'
export * from './generators.js'
export * from './tournament.js'
export * from './search.js'
export * from './stochastic.js'
export * from './spendingSolver.js'
export * from './insightsAdapter.js'
