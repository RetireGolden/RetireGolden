import type { SimulatorAnnualPassStateBindings } from
  '../projection/annualPassTransaction.js'

/**
 * The complete scalar-adapter inventory whose object and method wiring belongs
 * to one simulator annual-pass transaction.
 */
export const SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS = [
  'nextRetirementRuntimeMutationOrdinal',
  'unassignedCash',
  'priorYearPortfolioReturnPct',
  'capitalLossPool',
  'hsaReimbursablePool',
  'depletionYear',
  'conversionNontaxable',
  'healthcare',
  'qualifiedMedicalThisYear',
  'hsaQualifiedCap',
  'requiredSpendingBase',
  'targetSpendingBase',
] as const satisfies readonly (keyof SimulatorAnnualPassStateBindings)[]
