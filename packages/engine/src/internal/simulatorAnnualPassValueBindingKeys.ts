import type { SimulatorAnnualPassStateBindings } from
  '../projection/annualPassTransaction.js'

/**
 * The keys of `SimulatorAnnualPassStateBindings` whose value is a read/write
 * adapter rather than a container, derived from the interface itself.
 *
 * Adapters are detected structurally by their `read` method: every other field
 * in the bindings is an array, a `Map`, a `Set` or the expenses record, and none
 * of those carry one.
 */
export type SimulatorAnnualPassValueBindingKey = {
  [Key in keyof SimulatorAnnualPassStateBindings]-?:
    SimulatorAnnualPassStateBindings[Key] extends { read: () => unknown } ? Key : never
}[keyof SimulatorAnnualPassStateBindings]

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
] as const satisfies readonly SimulatorAnnualPassValueBindingKey[]

/**
 * Exhaustiveness, not just membership.
 *
 * `satisfies` above proves every listed key exists; this proves no adapter key
 * is missing. A new value binding on the state interface that nobody adds here
 * fails to compile, and the error names the key that is absent.
 */
type UncoveredValueBindingKey = Exclude<
  SimulatorAnnualPassValueBindingKey,
  typeof SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS[number]
>
const VALUE_BINDING_KEYS_ARE_EXHAUSTIVE:
  [UncoveredValueBindingKey] extends [never] ? true : UncoveredValueBindingKey = true
void VALUE_BINDING_KEYS_ARE_EXHAUSTIVE
