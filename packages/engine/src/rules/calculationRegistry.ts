/**
 * The calculation registry: its types, its composition, and its helpers.
 *
 * The records themselves live in the per-group modules under `./calculations/`,
 * one formula, dataset, model, composition step, or law-link per frozen record,
 * which this file spreads into the single frozen `CALCULATION_REGISTRY`. A
 * record explains one or more output families: the inputs, the identity, the
 * independent worksheet, and the engine pin. The registry is the catalog half
 * of bidirectional correctness — the tax registry remains the authority half.
 *
 * Composition matches `taxRuleRegistry.ts`: `satisfies` without `as const` so
 * keys stay a closed union while prose strings widen, and a published module
 * list sits beside the spread so coverage can shard one JSON file per group.
 */
import { spendingAndWithdrawalsRecords } from './calculations/spendingAndWithdrawals.js'
import type { OutputFamilyId } from './outputFamilies.js'
import type { TaxRuleId } from './taxRuleRegistry.js'

export type CalculationKind = 'formula' | 'data' | 'model' | 'composition' | 'law-link'

export interface CalculationFormulaVariable {
  readonly symbol: string
  readonly meaning: string
  readonly unit: string
  readonly domain: string
}

export interface CalculationFormula {
  readonly expression: string
  readonly variables: readonly CalculationFormulaVariable[]
  readonly timing: string
  readonly rounding: string
}

export type CalculationJustification =
  | { readonly kind: 'derivation'; readonly worksheet: string }
  | {
      readonly kind: 'dataset'
      readonly source: {
        readonly citation: string
        readonly url: string
        readonly asOf: string
        readonly retrievedOn: string
        readonly rights: string
      }
      readonly transformation: string
      readonly digest: string
    }
  | {
      readonly kind: 'assumption'
      readonly rationale: string
      readonly intendedUse: string
      readonly errorBound: string | null
    }
  | { readonly kind: 'registry'; readonly ruleIds: readonly [TaxRuleId, ...TaxRuleId[]] }

export interface CalculationProvenance {
  readonly derivedBy: string
  readonly implementedBy: string
  readonly reviewedBy: string
}

export interface CalculationRecord {
  readonly title: string
  /** One plain sentence for the catalog card. */
  readonly purpose: string
  readonly kind: CalculationKind
  readonly outputs: readonly [OutputFamilyId, ...OutputFamilyId[]]
  readonly statement: string
  readonly formula: CalculationFormula | null
  readonly justification: CalculationJustification
  readonly limits: readonly string[]
  readonly implementedBy: readonly [string, ...string[]]
  readonly implementedByFunctions: readonly [string, ...string[]]
  readonly verifiedOn: string
  readonly provenance: CalculationProvenance
}

const registry = {
  ...spendingAndWithdrawalsRecords,
} satisfies Record<string, CalculationRecord>

export const CALCULATION_REGISTRY = Object.freeze(registry)

export const CALCULATION_RECORD_MODULES: readonly (readonly [
  string,
  Readonly<Record<string, CalculationRecord>>,
])[] = Object.freeze([['spendingAndWithdrawals', spendingAndWithdrawalsRecords]] as const)

export type CalculationId = keyof typeof CALCULATION_REGISTRY

export const calculationIds = Object.freeze(
  Object.keys(CALCULATION_REGISTRY).sort() as readonly CalculationId[],
)

export function calculation(id: CalculationId): Readonly<CalculationRecord> {
  return CALCULATION_REGISTRY[id]
}

/**
 * The mutation receipt that belongs to a derivation worksheet: the same path
 * with `.md` replaced by `.mutation.md`. One convention, used by both
 * `describeCalculation` (which requires the fixture to name exactly this file)
 * and the coverage gate (which requires it to exist), so the fixture and the
 * published gate can never point at different receipts.
 */
export function mutationReceiptPathOf(worksheet: string): string {
  return worksheet.replace(/\.md$/u, '.mutation.md')
}
