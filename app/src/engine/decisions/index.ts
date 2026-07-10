/**
 * Ledger-native decision engine (DOCS/enhancements/ledger-native-decision-engine.md).
 *
 * Shared foundation for Insights, the Roth & Tax Optimizer, Social Security
 * candidates, and future decision tools: candidates are generated cheaply,
 * evaluated exactly through `simulatePlan`, ranked by objective policies, and
 * only exact-ledger winners become recommendations.
 */

export * from './types'
export * from './evaluateCandidate'
export * from './objectives'
export * from './generators'
export * from './tournament'
export * from './search'
export * from './stochastic'
export * from './spendingSolver'
export * from './insightsAdapter'
