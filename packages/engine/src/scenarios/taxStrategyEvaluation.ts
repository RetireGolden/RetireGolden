/**
 * TaxStrategyEvaluation — presentation-facing evidence document for a selected
 * tax strategy (Advisor tax implementation cockpit WS2).
 *
 * Role: compose the canonical scenario-comparison seam with identity-bearing
 * annual actions, objective/constraints, ranked alternatives, confidence
 * provenance, and disclosed law/engine limitations into one deterministic
 * contract the future Advisor cockpit can render without re-deriving figures.
 *
 * No forked arithmetic: the evaluation holds a `ScenarioPlanComparison` whole
 * and derives every other monetary field by copying published figures from that
 * comparison (and from supplied tournament rows). This module performs zero tax
 * calculations, zero source/account inference, and never re-derives a number the
 * comparison or action rows already publish.
 *
 * Fail-closed readiness: action readiness is copied exclusively from the
 * underlying `ScenarioActionRow` (`actionable` | `nonActionable`, with the same
 * `ActionReason` codes the actions layer uses). The builder has no option,
 * parameter, or code path that can upgrade `nonActionable` to `actionable` or
 * drop reasons — "no relevant prerequisite can be downgraded to a warning or
 * bypassed."
 *
 * Closed action-kind union: only the engine's retirement action kinds
 * (`ordinaryWithdrawal` | `rothConversion` | `qcd`) may enter. DAF/NUA and other
 * invented kinds are rejected by the schema (cockpit v1 de-scopes them).
 *
 * Bundle boundary: do not import the tax rule registry at runtime — use
 * `import type` for `TaxRuleId` only. Limitation `ruleId` values are plain
 * strings at this contract boundary; runtime registry consistency (real
 * `TaxRuleId` plus matching classification/errorDirection) is validated only
 * via the opt-in `taxStrategyEvaluationRegistryCheck` module (and by tests).
 *
 * Comparison validation is structural-plus-one-level: section presence, closed
 * action kinds/outcomes, moneyBasis/provenance, finite numbers, headline/risk
 * key shapes, and action-row amount conservation. Metric-level integrity inside
 * comparison sections is intentionally not re-validated — the schema prevents
 * inconsistent readiness downgrades but cannot prevent a wholesale-fabricated
 * yet internally consistent document (no schema can).
 */

import { z } from 'zod'

import {
  retirementActionKindSchema,
  type RetirementActionKind,
} from '../actions/contract.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
} from '../actions/identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
} from '../actions/money.js'
import { actionReasonSchema } from '../actions/reasons.js'
import type { ObjectivePolicy, ObjectivePolicyId } from '../decisions/objectives.js'
import type { RankedDecision } from '../decisions/tournament.js'
import type {
  DecisionCategory,
  DecisionDeltas,
  DecisionRecommendationState,
  DecisionSource,
} from '../decisions/types.js'
import {
  PARAMETER_DATA_AS_OF,
  PARAMETER_DATA_BASIS,
  packForYear,
} from '../params/index.js'
import type { TaxRuleId } from '../rules/taxRuleRegistry.js'
import { ENGINE_VERSION } from '../version.js'
import type {
  ScenarioActionComparisonRow,
  ScenarioActionRow,
} from './actionRows.js'
import {
  ANNUAL_VALUE_KEYS,
  type ScenarioAcaComparison,
  type ScenarioEstateComparison,
  type ScenarioHeadlineComparison,
  type ScenarioIncomeComparison,
  type ScenarioIrmaaComparison,
  type ScenarioPlanComparison,
  type ScenarioRiskComparison,
  type ScenarioSpendingCapacityComparison,
  type ScenarioSpendingComparison,
  type ScenarioWithdrawalComparison,
} from './comparison.js'
import { canonicalScenarioJson } from './patch.js'

export const TAX_STRATEGY_EVALUATION_KIND = 'retiregolden.tax-strategy-evaluation' as const
export const CURRENT_TAX_STRATEGY_EVALUATION_VERSION = 1 as const

/** Closed objective-policy id tuple shared with tradeoffs (WS4) and other cockpit surfaces. */
export const TAX_STRATEGY_OBJECTIVE_POLICY_IDS = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
  'max-sustainable-spending',
  'max-downside-resilience',
] as const satisfies readonly ObjectivePolicyId[]

const objectivePolicyIdSchema = z.enum(TAX_STRATEGY_OBJECTIVE_POLICY_IDS)

const decisionSourceSchema = z.enum([
  'milp',
  'detector',
  'heuristic',
  'scenario-sweep',
  'search',
])

const decisionCategorySchema = z.enum([
  'roth',
  'withdrawal',
  'social-security',
  'tax-cliff',
  'spending',
  'insurance',
  'geography',
  'asset-location',
  'guaranteed-income',
])

const recommendationStateSchema = z.enum([
  'beneficial',
  'neutral',
  'rejected',
  'diagnostic',
])

const limitationClassificationSchema = z.enum([
  'settled',
  'unsettled',
  'approximated',
  'outOfScope',
])

const errorDirectionSchema = z.enum([
  'understatesTax',
  'overstatesTax',
  'bothDirections',
])

export const taxStrategyLimitationRefSchema = z
  .strictObject({
    ruleId: z.string().min(1),
    classification: limitationClassificationSchema,
    errorDirection: errorDirectionSchema.nullable(),
    note: z.string().nullable(),
  })
  .superRefine((limitation, ctx) => {
    if (limitation.classification === 'approximated') {
      if (limitation.errorDirection === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['errorDirection'],
          message: 'approximated limitations require a non-null errorDirection',
        })
      }
    } else if (limitation.errorDirection !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['errorDirection'],
        message: `${limitation.classification} limitations require a null errorDirection`,
      })
    }
  })

/** `ruleId` uses `TaxRuleId` as a compile-time authoring aid; parsed documents expose a plain string. Registry truth comes only from the opt-in `taxStrategyEvaluationRegistryCheck` module. */
export type TaxStrategyLimitationRef = Readonly<{
  ruleId: TaxRuleId
  classification: z.infer<typeof limitationClassificationSchema>
  errorDirection: z.infer<typeof errorDirectionSchema> | null
  note: string | null
}>

const sourceAllocationSchema = z
  .strictObject({
    allocationId: allocationIdSchema,
    sourceAccountId: accountIdSchema,
    resolution: z.enum(['resolved', 'unresolved']),
    requestedAmountCents: positiveUsdCentsSchema,
    executedAmountCents: usdCentsSchema,
    unexecutedAmountCents: usdCentsSchema,
  })
  .superRefine((allocation, ctx) => {
    // Mirror disposition amount conservation from actions/contract.ts. Request
    // schemas only carry requestedAmount; executed/unexecuted conservation is
    // the disposition rule and applies the same way at allocation publication.
    if (
      BigInt(allocation.executedAmountCents) + BigInt(allocation.unexecutedAmountCents) !==
      BigInt(allocation.requestedAmountCents)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['unexecutedAmountCents'],
        message: 'Executed and unexecuted cents must exactly conserve the requested amount',
      })
    }
  })

const CLOSED_ACTION_KINDS: ReadonlySet<string> = new Set([
  'ordinaryWithdrawal',
  'rothConversion',
  'qcd',
])

const retirementActionYearSchema = z.number().int().min(1).max(9999)

function positiveMoneyCentsIsStructural(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false
  return positiveUsdCentsSchema.safeParse(value).success
}

function usdMoneyCentsIsStructural(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false
  return usdCentsSchema.safeParse(value).success
}

function nullableScalarComparisonIsStructural(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  for (const side of ['baseline', 'proposal', 'delta'] as const) {
    const scalar = value[side]
    if (scalar !== null && (typeof scalar !== 'number' || !Number.isFinite(scalar))) {
      return false
    }
  }
  return true
}

function scalarComparisonIsStructural(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  for (const side of ['baseline', 'proposal', 'delta'] as const) {
    const scalar = value[side]
    if (typeof scalar !== 'number' || !Number.isFinite(scalar)) return false
  }
  return true
}

function nonBlankStringIsStructural(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function scalarComparisonSectionIsStructural(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    if (!scalarComparisonIsStructural(value[key])) return false
  }
  return true
}

function sourceAllocationIdentitiesAreUnique(
  sourceAllocations: ReadonlyArray<Record<string, unknown>>,
): boolean {
  const allocationIds = new Set<string>()
  const sourceAccountIds = new Set<string>()
  for (const allocation of sourceAllocations) {
    const allocationId = allocation['allocationId']
    const sourceAccountId = allocation['sourceAccountId']
    if (typeof allocationId !== 'string' || typeof sourceAccountId !== 'string') return false
    if (allocationIds.has(allocationId) || sourceAccountIds.has(sourceAccountId)) return false
    allocationIds.add(allocationId)
    sourceAccountIds.add(sourceAccountId)
  }
  return true
}

function refineUniqueSourceAllocationIdentities(
  sourceAllocations: ReadonlyArray<{
    allocationId: string
    sourceAccountId: string
  }>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  const allocationIds = new Set<string>()
  const sourceAccountIds = new Set<string>()
  sourceAllocations.forEach((allocation, index) => {
    if (allocationIds.has(allocation.allocationId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'sourceAllocations', index, 'allocationId'],
        message: `duplicate allocation id "${allocation.allocationId}"`,
      })
    } else {
      allocationIds.add(allocation.allocationId)
    }
    if (sourceAccountIds.has(allocation.sourceAccountId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'sourceAllocations', index, 'sourceAccountId'],
        message: `duplicate source account id "${allocation.sourceAccountId}"`,
      })
    } else {
      sourceAccountIds.add(allocation.sourceAccountId)
    }
  })
}

/**
 * Canonical disposition amount invariants mirrored from
 * `packages/engine/src/actions/contract.ts` (validatedActionExecutionDispositionSchema
 * superRefine). Field names use the evaluation's `*AmountCents` suffixes.
 */
function refineDispositionAmounts(
  amounts: {
    requestedAmountCents: number
    executedAmountCents: number
    unexecutedAmountCents: number
    outcome: 'executed' | 'partial' | 'refused' | 'unsupported'
  },
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  if (
    BigInt(amounts.executedAmountCents) + BigInt(amounts.unexecutedAmountCents) !==
    BigInt(amounts.requestedAmountCents)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'unexecutedAmountCents'],
      message: 'Executed and unexecuted cents must exactly conserve the requested amount',
    })
  }

  if (amounts.outcome === 'executed') {
    if (amounts.executedAmountCents !== amounts.requestedAmountCents) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'executedAmountCents'],
        message: 'An executed action must move the full requested amount',
      })
    }
    if (amounts.unexecutedAmountCents !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'unexecutedAmountCents'],
        message: 'An executed action cannot leave an unexecuted remainder',
      })
    }
    return
  }

  if (amounts.outcome === 'partial') {
    if (amounts.executedAmountCents === 0) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'executedAmountCents'],
        message: 'A partial action must move a positive amount',
      })
    }
    if (amounts.unexecutedAmountCents === 0) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'unexecutedAmountCents'],
        message: 'A partial action must leave a positive remainder',
      })
    }
  }
}

const ADJUSTED_REASON_CANONICAL_ORDER = [
  'qcd-person-limit-trimmed',
  'qcd-contribution-offset-applied',
  'qcd-taxable-amount-trimmed',
] as const

function validateAdjustedReasonOrder(
  reasons: ReadonlyArray<{ code: string; outcome: string }>,
  startIndex: number,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  let previousOrder = -1
  const seen = new Set<string>()

  reasons.slice(startIndex).forEach((reason, offset) => {
    if (reason.outcome !== 'adjusted') return
    const index = startIndex + offset
    const order = ADJUSTED_REASON_CANONICAL_ORDER.indexOf(
      reason.code as (typeof ADJUSTED_REASON_CANONICAL_ORDER)[number],
    )
    if (seen.has(reason.code)) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index],
        message: 'QCD adjustment reasons may appear at most once',
      })
    } else if (order < previousOrder) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index],
        message: 'QCD adjustment reasons must use canonical order',
      })
    }
    seen.add(reason.code)
    previousOrder = Math.max(previousOrder, order)
  })
}

type ActionReasonOutcomeFields = Readonly<{
  code: string
  outcome: string
}>

function adjustedReasonOrderIsCanonical(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  startIndex: number,
): boolean {
  let previousOrder = -1
  const seen = new Set<string>()

  for (let offset = 0; offset < reasons.length - startIndex; offset++) {
    const reason = reasons[startIndex + offset]!
    if (reason.outcome !== 'adjusted') continue
    const order = ADJUSTED_REASON_CANONICAL_ORDER.indexOf(
      reason.code as (typeof ADJUSTED_REASON_CANONICAL_ORDER)[number],
    )
    if (seen.has(reason.code) || order < previousOrder) return false
    seen.add(reason.code)
    previousOrder = Math.max(previousOrder, order)
  }
  return true
}

/**
 * Reason-outcome rules mirrored from `validatedActionExecutionDispositionSchema`
 * superRefine in `packages/engine/src/actions/contract.ts`.
 */
function actionReasonsMatchOutcomeRules(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  outcome: 'executed' | 'partial' | 'refused' | 'unsupported',
): boolean {
  if (outcome === 'executed') {
    if (!reasons.every((reason) => reason.outcome === 'adjusted')) return false
    return adjustedReasonOrderIsCanonical(reasons, 0)
  }

  if (outcome === 'partial') {
    if (reasons.length === 0) return false
    if (reasons[0]?.outcome !== 'partial') return false
    if (!reasons.slice(1).every((reason) => reason.outcome === 'adjusted')) return false
    return adjustedReasonOrderIsCanonical(reasons, 1)
  }

  if (outcome === 'refused') {
    if (reasons.length === 0) return false
    return reasons.every((reason) => reason.outcome === 'refused')
  }

  if (reasons.length === 0) return false
  if (reasons[0]?.outcome !== 'unsupported') return false
  return reasons
    .slice(1)
    .every((reason) => reason.outcome === 'unsupported' || reason.outcome === 'refused')
}

function refineExecutedActionReasons(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  reasons.forEach((reason, index) => {
    if (reason.outcome !== 'adjusted') {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index],
        message: 'Executed actions may contain only adjusted reasons',
      })
    }
  })
  validateAdjustedReasonOrder(reasons, 0, ctx, pathPrefix)
}

function refineRefusedActionReasons(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  reasons.forEach((reason, index) => {
    if (reason.outcome !== 'refused') {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index],
        message: 'Refused actions may contain only refused reasons',
      })
    }
  })
}

function refineUnsupportedActionReasons(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  if (reasons[0]?.outcome !== 'unsupported') {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'reasons', 0],
      message: 'The first unsupported-action reason must be unsupported',
    })
  }
  reasons.slice(1).forEach((reason, index) => {
    if (reason.outcome !== 'unsupported' && reason.outcome !== 'refused') {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index + 1],
        message: 'Unsupported actions may retain only unsupported or refused reasons',
      })
    }
  })
}

function refinePartialActionReasons(
  reasons: ReadonlyArray<ActionReasonOutcomeFields>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  if (reasons.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'reasons'],
      message: 'A partial action requires a physical trim reason first',
    })
    return
  }
  if (reasons[0]?.outcome !== 'partial') {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'reasons', 0],
      message: 'The first partial-action reason must be a physical trim',
    })
  }
  reasons.slice(1).forEach((reason, index) => {
    if (reason.outcome !== 'adjusted') {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'reasons', index + 1],
        message: 'Reasons after a physical trim may only be adjustments',
      })
    }
  })
  validateAdjustedReasonOrder(reasons, 1, ctx, pathPrefix)
}

function refineAllocationRequestedTotals(
  action: Readonly<{
    requestedAmountCents: number
    sourceAllocations: ReadonlyArray<{ requestedAmountCents: number }>
  }>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  const total = action.sourceAllocations.reduce(
    (sum, allocation) => sum + BigInt(allocation.requestedAmountCents),
    0n,
  )
  if (total !== BigInt(action.requestedAmountCents)) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'sourceAllocations'],
      message: 'allocation requested cents must exactly sum to the action requested amount',
    })
  }
}

function refineActionKindIdentities(
  action: Readonly<{
    kind: RetirementActionKind
    personId: string | null
    destinationAccountId: string | null
    charityDesignationId: string | null
  }>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  if (action.personId === null) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'personId'],
      message: 'retirement actions require a non-null personId',
    })
  }
  if (action.kind === 'ordinaryWithdrawal') {
    if (action.destinationAccountId !== null) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'destinationAccountId'],
        message: 'ordinaryWithdrawal actions require a null destinationAccountId',
      })
    }
    if (action.charityDesignationId !== null) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'charityDesignationId'],
        message: 'ordinaryWithdrawal actions require a null charityDesignationId',
      })
    }
    return
  }
  if (action.kind === 'rothConversion') {
    if (action.destinationAccountId === null) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'destinationAccountId'],
        message: 'rothConversion actions require a non-null destinationAccountId',
      })
    }
    if (action.charityDesignationId !== null) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'charityDesignationId'],
        message: 'rothConversion actions require a null charityDesignationId',
      })
    }
    return
  }
  if (action.destinationAccountId !== null) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'destinationAccountId'],
      message: 'qcd actions require a null destinationAccountId',
    })
  }
  if (action.charityDesignationId === null) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'charityDesignationId'],
      message: 'qcd actions require a non-null charityDesignationId',
    })
  } else if (action.charityDesignationId.trim().length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'charityDesignationId'],
      message: 'qcd actions require a non-blank charityDesignationId',
    })
  }
}

function rothDestinationAliasesSourceAccount(
  destinationAccountId: string | null,
  sourceAllocations: ReadonlyArray<{ sourceAccountId: string }>,
): boolean {
  if (destinationAccountId === null) return false
  return sourceAllocations.some(
    (allocation) => allocation.sourceAccountId === destinationAccountId,
  )
}

function refineRothConversionDestinationNotAliasingSource(
  action: Readonly<{
    kind: RetirementActionKind
    destinationAccountId: string | null
    sourceAllocations: ReadonlyArray<{ sourceAccountId: string }>
  }>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  if (action.kind !== 'rothConversion') return
  if (
    rothDestinationAliasesSourceAccount(action.destinationAccountId, action.sourceAllocations)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'destinationAccountId'],
      message: 'conversion destination aliases a source account',
    })
  }
}

/**
 * Readiness/outcome binding and disposition amount rules mirrored from the
 * action superRefine — used by the structural gate for every non-null side.
 */
function comparisonSideDispositionIsStructural(side: Record<string, unknown>): boolean {
  const readiness = side['readiness']
  const outcome = side['outcome']
  if (readiness !== 'actionable' && readiness !== 'nonActionable') return false
  if (
    outcome !== 'executed' &&
    outcome !== 'partial' &&
    outcome !== 'refused' &&
    outcome !== 'unsupported'
  ) {
    return false
  }

  const requested = side['requestedAmountCents']
  const executed = side['executedAmountCents']
  const unexecuted = side['unexecutedAmountCents']
  if (!positiveMoneyCentsIsStructural(requested)) return false
  if (!usdMoneyCentsIsStructural(executed)) return false
  if (!usdMoneyCentsIsStructural(unexecuted)) return false
  if (BigInt(executed) + BigInt(unexecuted) !== BigInt(requested)) return false

  if (readiness === 'nonActionable') {
    if (outcome !== 'refused' && outcome !== 'unsupported') return false
    if (executed !== 0) return false
    if (unexecuted !== requested) return false
  } else if (outcome !== 'executed' && outcome !== 'partial') {
    return false
  }

  if (outcome === 'executed') {
    if (executed !== requested) return false
    if (unexecuted !== 0) return false
  }
  if (outcome === 'partial') {
    if (executed === 0) return false
    if (unexecuted === 0) return false
  }

  return true
}

function comparisonSideKindIdentitiesAreStructural(side: Record<string, unknown>): boolean {
  const kind = side['kind']
  if (typeof kind !== 'string' || !CLOSED_ACTION_KINDS.has(kind)) return false
  return actionKindIdentitiesAreStructural(
    kind,
    side['personId'],
    side['destinationAccountId'],
    side['charityDesignationId'],
  )
}

function actionKindIdentitiesAreStructural(
  kind: string,
  personId: unknown,
  destinationAccountId: unknown,
  charityDesignationId: unknown,
): boolean {
  if (typeof personId !== 'string' || personId.length === 0) return false
  if (kind === 'ordinaryWithdrawal') {
    return destinationAccountId === null && charityDesignationId === null
  }
  if (kind === 'rothConversion') {
    return (
      typeof destinationAccountId === 'string' &&
      destinationAccountId.length > 0 &&
      charityDesignationId === null
    )
  }
  if (kind === 'qcd') {
    return (
      destinationAccountId === null && nonBlankStringIsStructural(charityDesignationId)
    )
  }
  return false
}

function comparisonSideSourceAllocationsAreStructural(
  side: Record<string, unknown>,
): boolean {
  if (!('sourceAllocations' in side)) return false
  const sourceAllocations = side['sourceAllocations']
  if (!Array.isArray(sourceAllocations)) return false

  const sideRequested = side['requestedAmountCents']
  if (!positiveMoneyCentsIsStructural(sideRequested)) return false

  const allocationRecords: Record<string, unknown>[] = []
  let requestedAllocationTotal = 0n
  let executedAllocationTotal = 0n
  for (const allocation of sourceAllocations) {
    if (!isPlainObject(allocation)) return false
    allocationRecords.push(allocation)
    if (typeof allocation['allocationId'] !== 'string' || allocation['allocationId'].length === 0) {
      return false
    }
    if (
      typeof allocation['sourceAccountId'] !== 'string' ||
      allocation['sourceAccountId'].length === 0
    ) {
      return false
    }
    if (allocation['resolution'] !== 'resolved' && allocation['resolution'] !== 'unresolved') {
      return false
    }
    const requested = allocation['requestedAmountCents']
    const executed = allocation['executedAmountCents']
    const unexecuted = allocation['unexecutedAmountCents']
    if (!positiveMoneyCentsIsStructural(requested)) return false
    if (!usdMoneyCentsIsStructural(executed)) return false
    if (!usdMoneyCentsIsStructural(unexecuted)) return false
    if (BigInt(executed) + BigInt(unexecuted) !== BigInt(requested)) return false
    if (allocation['resolution'] === 'unresolved' && executed !== 0) return false
    if (side['readiness'] === 'actionable' && allocation['resolution'] !== 'resolved') {
      return false
    }
    requestedAllocationTotal += BigInt(requested)
    executedAllocationTotal += BigInt(executed)
  }

  if (!sourceAllocationIdentitiesAreUnique(allocationRecords)) return false

  if (requestedAllocationTotal !== BigInt(sideRequested)) return false

  const sideExecuted = side['executedAmountCents']
  if (!usdMoneyCentsIsStructural(sideExecuted)) return false
  return executedAllocationTotal === BigInt(sideExecuted)
}

function comparisonSideReasonsAreStructural(
  side: Record<string, unknown>,
): boolean {
  if (!('reasons' in side) || side['reasons'] === undefined) return false
  const reasonsValue = side['reasons']
  if (!Array.isArray(reasonsValue)) return false

  const reasons: ActionReasonOutcomeFields[] = []
  for (const reason of reasonsValue) {
    const parsed = actionReasonSchema.safeParse(reason)
    if (!parsed.success) return false
    reasons.push({ code: parsed.data.code, outcome: parsed.data.outcome })
  }

  const outcome = side['outcome']
  if (outcome !== 'executed' && outcome !== 'partial' && outcome !== 'refused' && outcome !== 'unsupported') {
    return false
  }
  return actionReasonsMatchOutcomeRules(reasons, outcome)
}

/**
 * Allocation resolution and total invariants mirrored from
 * `packages/engine/src/actions/annualRetirementActionPublication.ts`
 * (executor allocation binding loop).
 */
function refineSourceAllocationResolutions(
  action: Readonly<{
    readiness: 'actionable' | 'nonActionable'
    executedAmountCents: number
    sourceAllocations: ReadonlyArray<{
      resolution: 'resolved' | 'unresolved'
      executedAmountCents: number
    }>
  }>,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  let executedAllocationTotal = 0n
  action.sourceAllocations.forEach((allocation, index) => {
    executedAllocationTotal += BigInt(allocation.executedAmountCents)
    if (allocation.resolution === 'unresolved' && allocation.executedAmountCents !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'sourceAllocations', index, 'executedAmountCents'],
        message: 'An unresolved allocation cannot move money (executedAmountCents must be 0)',
      })
    }
    if (action.readiness === 'actionable' && allocation.resolution !== 'resolved') {
      ctx.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'sourceAllocations', index, 'resolution'],
        message: "an actionable action requires every sourceAllocation resolution 'resolved'",
      })
    }
  })
  if (executedAllocationTotal !== BigInt(action.executedAmountCents)) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'executedAmountCents'],
      message: 'Source allocation executed cents must sum to the action executedAmountCents',
    })
  }
}

const taxStrategyEvaluationActionSchema = z
  .strictObject({
    actionId: actionIdSchema,
    kind: retirementActionKindSchema,
    year: z.number().int().min(1).max(9999),
    personId: personIdSchema.nullable(),
    destinationAccountId: accountIdSchema.nullable(),
    charityDesignationId: z
      .string()
      .nullable()
      .refine((value) => value === null || value.trim().length > 0, {
        message: 'Value must not be blank',
      }),
    requestedAmountCents: positiveUsdCentsSchema,
    executedAmountCents: usdCentsSchema,
    unexecutedAmountCents: usdCentsSchema,
    readiness: z.enum(['actionable', 'nonActionable']),
    outcome: z.enum(['executed', 'partial', 'refused', 'unsupported']),
    sourceAllocations: z.array(sourceAllocationSchema),
    reasons: z.array(actionReasonSchema),
    limitations: z.array(taxStrategyLimitationRefSchema),
  })
  .superRefine((action, ctx) => {
    // Always: conservation + executed/partial amount rules (contract.ts).
    refineDispositionAmounts(action, ctx)

    if (action.readiness === 'nonActionable') {
      if (action.outcome !== 'refused' && action.outcome !== 'unsupported') {
        ctx.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: "a nonActionable action must have outcome 'refused' or 'unsupported'",
        })
      }
      if (action.reasons.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons'],
          message: 'a nonActionable action must carry non-empty reasons',
        })
      }
      if (action.executedAmountCents !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['executedAmountCents'],
          message: 'a nonActionable action cannot move money (executedAmountCents must be 0)',
        })
      }
      if (action.unexecutedAmountCents !== action.requestedAmountCents) {
        ctx.addIssue({
          code: 'custom',
          path: ['unexecutedAmountCents'],
          message:
            'a nonActionable action cannot move money (unexecutedAmountCents must equal requestedAmountCents)',
        })
      }
    } else if (action.outcome !== 'executed' && action.outcome !== 'partial') {
      ctx.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: "an actionable action must have outcome 'executed' or 'partial'",
      })
    }

    if (action.outcome === 'executed') {
      refineExecutedActionReasons(action.reasons, ctx)
    } else if (action.outcome === 'partial') {
      refinePartialActionReasons(action.reasons, ctx)
    } else if (action.outcome === 'refused') {
      refineRefusedActionReasons(action.reasons, ctx)
    } else if (action.outcome === 'unsupported') {
      refineUnsupportedActionReasons(action.reasons, ctx)
    }

    refineAllocationRequestedTotals(action, ctx)
    refineSourceAllocationResolutions(action, ctx)
    refineUniqueSourceAllocationIdentities(action.sourceAllocations, ctx)
    refineActionKindIdentities(action, ctx)
    refineRothConversionDestinationNotAliasingSource(action, ctx)
    if (action.kind === 'qcd' && action.sourceAllocations.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceAllocations'],
        message: 'qcd actions require exactly one source allocation',
      })
    }
  })

export type TaxStrategyEvaluationAction = z.infer<typeof taxStrategyEvaluationActionSchema>

const decisionDeltasSchema = z.strictObject({
  endingAfterTaxEstate: z.number().finite(),
  endingNetWorth: z.number().finite(),
  lifetimeTax: z.number().finite(),
  moneyLastsYears: z.number().finite(),
})

const taxStrategyAlternativeSchema = z
  .strictObject({
    candidateId: z.string().min(1),
    label: z.string().min(1),
    source: decisionSourceSchema,
    category: decisionCategorySchema,
    recommendationState: recommendationStateSchema,
    primaryValue: z.number().finite(),
    eligible: z.boolean(),
    lossReason: z.string().nullable(),
    deltas: decisionDeltasSchema,
  })
  .superRefine((alternative, ctx) => {
    // Mirror rankEvaluations: ineligible rows always carry an explanation; the
    // winner alone keeps lossReason null among eligible candidates.
    if (!alternative.eligible) {
      if (alternative.lossReason === null || alternative.lossReason.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['lossReason'],
          message: 'ineligible alternatives require a non-blank lossReason',
        })
      }
    } else if (alternative.lossReason !== null && alternative.lossReason.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['lossReason'],
        message: 'eligible alternatives cannot carry a blank lossReason',
      })
    }
  })

export type TaxStrategyAlternative = Readonly<{
  candidateId: string
  label: string
  source: DecisionSource
  category: DecisionCategory
  recommendationState: DecisionRecommendationState
  primaryValue: number
  eligible: boolean
  lossReason: string | null
  deltas: DecisionDeltas
}>

const moneyBasisSchema = z.strictObject({
  deterministic: z.literal('nominal'),
  annualLedger: z.literal('nominal'),
  stochastic: z.literal('nominal'),
  spendingCapacity: z.literal('today'),
  deltaConvention: z.literal('proposal-minus-baseline'),
})

const comparisonProvenanceSchema = z.strictObject({
  startYear: z.number().int(),
  baselineSnapshotHash: z.string().min(1),
  proposalSnapshotHash: z.string().min(1),
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Reject non-finite numbers anywhere under a comparison value. Same accepted
 * value domain as `canonicalScenarioJson` (null/boolean/string/finite number,
 * arrays, plain objects) but returns false instead of throwing.
 */
function comparisonValuesAreFiniteJson(value: unknown): boolean {
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === null || typeof current === 'boolean' || typeof current === 'string') {
      continue
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) return false
      continue
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item === undefined ? null : item)
      }
      continue
    }
    if (isPlainObject(current)) {
      for (const item of Object.values(current)) {
        if (item !== undefined) stack.push(item)
      }
      continue
    }
    return false
  }
  return true
}

const COMPARISON_REQUIRED_OBJECT_SECTIONS = [
  'headline',
  'spending',
  'income',
  'withdrawals',
  'irmaa',
  'aca',
  'estate',
] as const satisfies readonly (keyof ScenarioPlanComparison)[]

const SCENARIO_HEADLINE_COMPARISON_KEYS = [
  'endingInvestable',
  'endingNetWorth',
  'endingAfterTaxEstate',
  'lifetimeTax',
  'lifetimePenalties',
  'lifetimeTaxesAndPenalties',
  'depletionYear',
  'projectionEndYear',
] as const satisfies readonly (keyof ScenarioHeadlineComparison)[]

type ScenarioRiskMetricComparisonKey = Exclude<
  keyof ScenarioRiskComparison,
  'provenance' | 'depletionProbabilityByYear'
>

const SCENARIO_RISK_COMPARISON_KEYS = [
  'successRate',
  'requiredFloorSuccessRate',
  'targetLifestyleSuccessRate',
  'targetAttainmentP50',
  'expectedShortfallDollars',
  'expectedRequiredShortfallDollars',
  'expectedTargetShortfallDollars',
  'averageTotalShortfallDollars',
  'averageRequiredShortfallDollars',
  'averageTargetShortfallDollars',
  'probabilityOfAdjustment',
  'medianMaxCutDepth',
  'p90MaxCutDepth',
  'estateP10',
  'estateP50',
  'estateP90',
] as const satisfies readonly ScenarioRiskMetricComparisonKey[]

const SCENARIO_SPENDING_CAPACITY_KEYS = [
  'maxBaseAnnual',
  'spendingSlack',
  'baselineConverged',
  'proposalConverged',
  'baselineSimulationCount',
  'proposalSimulationCount',
  'baselineLimitingConstraint',
  'proposalLimitingConstraint',
  'baselineDiagnostics',
  'proposalDiagnostics',
] as const satisfies readonly (keyof ScenarioSpendingCapacityComparison)[]

const SCENARIO_SPENDING_COMPARISON_KEYS = [
  'intended',
  'funded',
  'totalShortfall',
  'requiredShortfall',
  'targetShortfall',
  'idealShortfall',
  'excessShortfall',
] as const satisfies readonly (keyof ScenarioSpendingComparison)[]

const SCENARIO_INCOME_COMPARISON_KEYS = [
  'wages',
  'socialSecurity',
  'pension',
  'annuity',
  'tipsLadder',
  'recurring',
  'oneTime',
  'taxableInterest',
  'ordinaryDividends',
  'qualifiedDividends',
  'taxableYield',
  'taxExemptInterest',
  'total',
] as const satisfies readonly (keyof ScenarioIncomeComparison)[]

const SCENARIO_WITHDRAWAL_COMPARISON_KEYS = [
  'cash',
  'taxable',
  'traditional',
  'roth',
  'hsa',
  'total',
  'rothConversions',
  'rmd',
  'inherited',
  'qcd',
] as const satisfies readonly (keyof ScenarioWithdrawalComparison)[]

const SCENARIO_IRMAA_COMPARISON_KEYS = [
  'surcharge',
  'totalMedicarePremiums',
  'surchargeTierYears',
  'maxTier',
] as const satisfies readonly (keyof ScenarioIrmaaComparison)[]

const SCENARIO_ACA_COMPARISON_KEYS = [
  'grossEnrollmentPremium',
  'modeledAllowablePtc',
  'economicNetPremium',
  'actionableYears',
  'nonActionableYears',
] as const satisfies readonly (keyof ScenarioAcaComparison)[]

const SCENARIO_ESTATE_COMPARISON_KEYS = [
  'grossNetWorth',
  'afterTaxEstate',
  'heirTax',
  'charity',
] as const satisfies readonly Exclude<keyof ScenarioEstateComparison, 'byCategory'>[]

const SCENARIO_ESTATE_BY_CATEGORY_KEYS = [
  'cash',
  'taxable',
  'traditional',
  'roth',
  'hsa',
] as const satisfies readonly (keyof ScenarioEstateComparison['byCategory'])[]

function estateComparisonIsStructural(value: Record<string, unknown>): boolean {
  if (!scalarComparisonSectionIsStructural(value, SCENARIO_ESTATE_COMPARISON_KEYS)) {
    return false
  }
  const byCategory = value['byCategory']
  if (!isPlainObject(byCategory)) return false
  return scalarComparisonSectionIsStructural(
    byCategory,
    SCENARIO_ESTATE_BY_CATEGORY_KEYS,
  )
}

function spendingCapacityIsStructural(value: Record<string, unknown>): boolean {
  for (const key of SCENARIO_SPENDING_CAPACITY_KEYS) {
    if (!(key in value)) return false
    const field = value[key]
    switch (key) {
      case 'maxBaseAnnual':
      case 'spendingSlack':
        if (!nullableScalarComparisonIsStructural(field)) return false
        break
      case 'baselineConverged':
      case 'proposalConverged':
        if (typeof field !== 'boolean') return false
        break
      case 'baselineSimulationCount':
      case 'proposalSimulationCount':
        if (typeof field !== 'number' || !Number.isInteger(field)) return false
        break
      case 'baselineLimitingConstraint':
      case 'proposalLimitingConstraint':
        if (
          field !== null &&
          field !== 'depletion' &&
          field !== 'estate-floor'
        ) {
          return false
        }
        break
      case 'baselineDiagnostics':
      case 'proposalDiagnostics':
        if (!Array.isArray(field) || !field.every((entry) => typeof entry === 'string')) {
          return false
        }
        break
      default: {
        const _exhaustive: never = key
        return _exhaustive === undefined
      }
    }
  }
  return true
}

function isScenarioActionScheduleDiagnosticShape(
  value: unknown,
  containingActionId: string,
): boolean {
  if (!isPlainObject(value)) return false
  const kind = value['kind']
  if (typeof value['actionId'] !== 'string' || value['actionId'].length === 0) return false
  if (value['actionId'] !== containingActionId) return false

  if (kind === 'actionYearMismatch') {
    return (
      typeof value['expectedYear'] === 'number' &&
      Number.isInteger(value['expectedYear']) &&
      typeof value['actualYear'] === 'number' &&
      Number.isInteger(value['actualYear'])
    )
  }

  if (kind === 'duplicateActionId') {
    const inputIndexes = value['inputIndexes']
    if (!Array.isArray(inputIndexes) || inputIndexes.length < 2) return false
    return inputIndexes.every(
      (index) => typeof index === 'number' && Number.isInteger(index),
    )
  }

  if (kind === 'executionSequenceConflict') {
    if (typeof value['year'] !== 'number' || !Number.isInteger(value['year'])) return false
    if (value['scheduledDate'] !== null && typeof value['scheduledDate'] !== 'string') {
      return false
    }
    if (typeof value['executionSequence'] !== 'number' || !Number.isInteger(value['executionSequence'])) {
      return false
    }
    const collidingActionIds = value['collidingActionIds']
    if (!Array.isArray(collidingActionIds) || collidingActionIds.length < 2) return false
    if (
      !collidingActionIds.every(
        (actionId) => typeof actionId === 'string' && actionId.length > 0,
      )
    ) {
      return false
    }
    const parsedReason = actionReasonSchema.safeParse(value['reason'])
    return parsedReason.success && parsedReason.data.code === 'action-sequence-conflict'
  }

  return false
}

function sourceAllocationsMatch(
  left: ScenarioActionRow['sourceAllocations'],
  right: ScenarioActionRow['sourceAllocations'],
): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) {
    const a = left[index]!
    const b = right[index]!
    if (
      a.allocationId !== b.allocationId ||
      a.sourceAccountId !== b.sourceAccountId ||
      a.resolution !== b.resolution ||
      a.requestedAmountCents !== b.requestedAmountCents ||
      a.executedAmountCents !== b.executedAmountCents ||
      a.unexecutedAmountCents !== b.unexecutedAmountCents
    ) {
      return false
    }
  }
  return true
}

type ActionReasonComparisonFields = Readonly<{
  code: string
  predicate: string
  outcome: string
  message: string
  personId?: string | undefined
  accountId?: string | undefined
  allocationId?: string | undefined
}>

function actionReasonsMatch(
  left: ReadonlyArray<ActionReasonComparisonFields>,
  right: ReadonlyArray<ActionReasonComparisonFields>,
): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) {
    const a = left[index]!
    const b = right[index]!
    if (
      a.code !== b.code ||
      a.predicate !== b.predicate ||
      a.outcome !== b.outcome ||
      a.message !== b.message ||
      a.personId !== b.personId ||
      a.accountId !== b.accountId ||
      a.allocationId !== b.allocationId
    ) {
      return false
    }
  }
  return true
}

function evaluationActionMatchesProposalRow(
  action: TaxStrategyEvaluationAction,
  row: Readonly<ScenarioActionRow>,
): boolean {
  const kindOk =
    CLOSED_ACTION_KINDS.has(row.kind) &&
    action.kind === row.kind &&
    isRetirementActionKind(action.kind)
  return (
    action.actionId === row.actionId &&
    kindOk &&
    action.year === row.year &&
    action.personId === row.personId &&
    action.destinationAccountId === row.destinationAccountId &&
    action.charityDesignationId === row.charityDesignationId &&
    action.readiness === row.readiness &&
    action.outcome === row.outcome &&
    action.requestedAmountCents === row.requestedAmountCents &&
    action.executedAmountCents === row.executedAmountCents &&
    action.unexecutedAmountCents === row.unexecutedAmountCents &&
    sourceAllocationsMatch(action.sourceAllocations, row.sourceAllocations) &&
    actionReasonsMatch(action.reasons, row.reasons)
  )
}

/**
 * Structural gate for the held-whole comparison. Validates presence/shape of
 * every ScenarioPlanComparison section and the fields the evaluation copies or
 * reconciles. One bounded level of headline/risk key validation; deep
 * re-validation of every comparison metric is intentionally out of scope (no
 * forked arithmetic / no second truth source).
 */
function isScenarioPlanComparisonShape(value: unknown): value is ScenarioPlanComparison {
  if (!isPlainObject(value)) return false
  const moneyBasis = moneyBasisSchema.safeParse(value['moneyBasis'])
  if (!moneyBasis.success) return false
  const provenance = comparisonProvenanceSchema.safeParse(value['provenance'])
  if (!provenance.success) return false

  for (const section of COMPARISON_REQUIRED_OBJECT_SECTIONS) {
    if (!isPlainObject(value[section])) return false
  }

  if (
    !scalarComparisonSectionIsStructural(
      value['spending'] as Record<string, unknown>,
      SCENARIO_SPENDING_COMPARISON_KEYS,
    )
  ) {
    return false
  }
  if (
    !scalarComparisonSectionIsStructural(
      value['income'] as Record<string, unknown>,
      SCENARIO_INCOME_COMPARISON_KEYS,
    )
  ) {
    return false
  }
  if (
    !scalarComparisonSectionIsStructural(
      value['withdrawals'] as Record<string, unknown>,
      SCENARIO_WITHDRAWAL_COMPARISON_KEYS,
    )
  ) {
    return false
  }
  if (
    !scalarComparisonSectionIsStructural(
      value['irmaa'] as Record<string, unknown>,
      SCENARIO_IRMAA_COMPARISON_KEYS,
    )
  ) {
    return false
  }
  if (
    !scalarComparisonSectionIsStructural(
      value['aca'] as Record<string, unknown>,
      SCENARIO_ACA_COMPARISON_KEYS,
    )
  ) {
    return false
  }
  if (!estateComparisonIsStructural(value['estate'] as Record<string, unknown>)) {
    return false
  }

  const headline = value['headline']
  if (!isPlainObject(headline)) return false
  for (const key of SCENARIO_HEADLINE_COMPARISON_KEYS) {
    if (!isPlainObject(headline[key])) return false
  }

  if (value['risk'] !== null) {
    if (!isPlainObject(value['risk'])) return false
    const risk = value['risk']
    if (!isPlainObject(risk['provenance'])) return false
    for (const key of SCENARIO_RISK_COMPARISON_KEYS) {
      if (!isPlainObject(risk[key])) return false
    }
    if (!Array.isArray(risk['depletionProbabilityByYear'])) return false
    for (const entry of risk['depletionProbabilityByYear']) {
      if (!isPlainObject(entry)) return false
      if (typeof entry['year'] !== 'number' || !Number.isInteger(entry['year'])) return false
      if (!isPlainObject(entry['cumulativeProbability'])) return false
    }
  }
  if (value['spendingCapacity'] !== null) {
    if (!isPlainObject(value['spendingCapacity'])) return false
    if (!spendingCapacityIsStructural(value['spendingCapacity'])) return false
  }

  if (!Array.isArray(value['actionRows'])) return false
  if (!Array.isArray(value['annual'])) return false
  let previousAnnualYear = Number.NEGATIVE_INFINITY
  for (const row of value['annual']) {
    if (!isPlainObject(row) || typeof row['year'] !== 'number' || !Number.isInteger(row['year'])) {
      return false
    }
    if (row['year'] <= previousAnnualYear) return false
    previousAnnualYear = row['year']
    if (!('values' in row) || !isPlainObject(row['values'])) return false
    const values = row['values']
    for (const key of ANNUAL_VALUE_KEYS) {
      if (!nullableScalarComparisonIsStructural(values[key])) return false
    }
  }
  for (const row of value['actionRows']) {
    if (!isPlainObject(row)) return false
    if (typeof row['actionId'] !== 'string' || row['actionId'].length === 0) return false
    const outerActionId = row['actionId']
    if (!Array.isArray(row['baselineScheduleDiagnostics'])) return false
    if (!Array.isArray(row['proposalScheduleDiagnostics'])) return false
    for (const diagnostic of row['baselineScheduleDiagnostics']) {
      if (!isScenarioActionScheduleDiagnosticShape(diagnostic, outerActionId)) return false
    }
    for (const diagnostic of row['proposalScheduleDiagnostics']) {
      if (!isScenarioActionScheduleDiagnosticShape(diagnostic, outerActionId)) return false
    }
    const baseline = row['baseline']
    const proposal = row['proposal']
    if (
      baseline === null &&
      proposal === null &&
      row['baselineScheduleDiagnostics'].length === 0 &&
      row['proposalScheduleDiagnostics'].length === 0
    ) {
      return false
    }
    const sideKeys = ['baseline', 'proposal'] as const
    for (const sideKey of sideKeys) {
      if (!(sideKey in row)) return false
      const side = row[sideKey]
      if (side === null) continue
      if (side === undefined) return false
      if (!isPlainObject(side)) return false
      if (side['actionId'] !== outerActionId) return false
      if (!retirementActionYearSchema.safeParse(side['year']).success) return false
      if (typeof side['kind'] !== 'string' || !CLOSED_ACTION_KINDS.has(side['kind'])) return false
      if (!comparisonSideDispositionIsStructural(side)) return false
      if (!comparisonSideKindIdentitiesAreStructural(side)) return false
      if (!comparisonSideSourceAllocationsAreStructural(side)) return false
      if (!comparisonSideReasonsAreStructural(side)) return false
      if (side['kind'] === 'qcd') {
        const sideAllocations = side['sourceAllocations']
        if (!Array.isArray(sideAllocations) || sideAllocations.length !== 1) return false
      }
      if (side['kind'] === 'rothConversion') {
        const destinationAccountId = side['destinationAccountId']
        const sideAllocations = side['sourceAllocations']
        if (
          typeof destinationAccountId === 'string' &&
          Array.isArray(sideAllocations) &&
          sideAllocations.some(
            (allocation) =>
              isPlainObject(allocation) && allocation['sourceAccountId'] === destinationAccountId,
          )
        ) {
          return false
        }
      }
    }
  }

  if (!comparisonValuesAreFiniteJson(value)) return false
  return true
}

const scenarioPlanComparisonSchema = z.custom<ScenarioPlanComparison>(
  (value): value is ScenarioPlanComparison => isScenarioPlanComparisonShape(value),
  {
    message:
      'expected a ScenarioPlanComparison with all declared sections, finite numbers, closed action kinds/outcomes, moneyBasis, provenance, annual, and actionRows',
  },
)

const parameterBasisSchema = z.strictObject({
  dataAsOf: z.string().min(1),
  basis: z.string().min(1),
  standInYears: z.array(z.number().int()),
})

const evaluationProvenanceSchema = z.strictObject({
  startYear: z.number().int(),
  baselineSnapshotHash: z.string().min(1),
  proposalSnapshotHash: z.string().min(1),
  engineVersion: z.string().min(1),
  parameterBasis: parameterBasisSchema,
})

const objectiveSchema = z.strictObject({
  policyId: objectivePolicyIdSchema,
  label: z.string().min(1),
  primaryMetricLabel: z.string().min(1),
})

const confidenceSchema = z.strictObject({
  basis: z.literal('exactLedger'),
  stochastic: z
    .strictObject({
      pathCount: z.number().int().positive(),
      seed: z.number().finite(),
      model: z.string().min(1),
    })
    .nullable(),
})

export const taxStrategyEvaluationSchema = z
  .strictObject({
    kind: z.literal(TAX_STRATEGY_EVALUATION_KIND),
    version: z.literal(CURRENT_TAX_STRATEGY_EVALUATION_VERSION),
    provenance: evaluationProvenanceSchema,
    objective: objectiveSchema,
    comparison: scenarioPlanComparisonSchema,
    actions: z.array(taxStrategyEvaluationActionSchema),
    constraints: z.array(z.string()),
    alternatives: z.array(taxStrategyAlternativeSchema),
    limitations: z.array(taxStrategyLimitationRefSchema),
    confidence: confidenceSchema,
  })
  .superRefine((evaluation, ctx) => {
    if (evaluation.provenance.startYear !== evaluation.comparison.provenance.startYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'startYear'],
        message: 'evaluation provenance.startYear must match comparison.provenance.startYear',
      })
    }
    if (
      evaluation.provenance.baselineSnapshotHash !==
      evaluation.comparison.provenance.baselineSnapshotHash
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'baselineSnapshotHash'],
        message: 'evaluation provenance.baselineSnapshotHash must match comparison',
      })
    }
    if (
      evaluation.provenance.proposalSnapshotHash !==
      evaluation.comparison.provenance.proposalSnapshotHash
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'proposalSnapshotHash'],
        message: 'evaluation provenance.proposalSnapshotHash must match comparison',
      })
    }
    if (evaluation.comparison.moneyBasis.deltaConvention !== 'proposal-minus-baseline') {
      ctx.addIssue({
        code: 'custom',
        path: ['comparison', 'moneyBasis', 'deltaConvention'],
        message: "deltaConvention must be 'proposal-minus-baseline'",
      })
    }

    const expectedStandInYears = standInYearsFromComparison(evaluation.comparison)
    const actualStandInYears = evaluation.provenance.parameterBasis.standInYears
    if (
      actualStandInYears.length !== expectedStandInYears.length ||
      actualStandInYears.some((year, index) => year !== expectedStandInYears[index])
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'parameterBasis', 'standInYears'],
        message:
          'provenance.parameterBasis.standInYears must match stand-in years derived from comparison.annual',
      })
    }

    const risk = evaluation.comparison.risk
    if (risk === null || risk === undefined) {
      if (evaluation.confidence.stochastic !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['confidence', 'stochastic'],
          message: 'confidence.stochastic must be null when comparison.risk is null',
        })
      }
    } else {
      const stochastic = evaluation.confidence.stochastic
      if (stochastic === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['confidence', 'stochastic'],
          message: 'confidence.stochastic is required when comparison.risk is present',
        })
      } else {
        if (stochastic.pathCount !== risk.provenance.pathCount) {
          ctx.addIssue({
            code: 'custom',
            path: ['confidence', 'stochastic', 'pathCount'],
            message: 'confidence.stochastic.pathCount must match comparison.risk.provenance.pathCount',
          })
        }
        if (stochastic.seed !== risk.provenance.seed) {
          ctx.addIssue({
            code: 'custom',
            path: ['confidence', 'stochastic', 'seed'],
            message: 'confidence.stochastic.seed must match comparison.risk.provenance.seed',
          })
        }
        const expectedModel = canonicalScenarioJson(risk.provenance.model)
        if (stochastic.model !== expectedModel) {
          ctx.addIssue({
            code: 'custom',
            path: ['confidence', 'stochastic', 'model'],
            message:
              'confidence.stochastic.model must be the canonical JSON of comparison.risk.provenance.model',
          })
        }
      }
    }

    const seenActionIds = new Map<string, number>()
    evaluation.actions.forEach((action, index) => {
      if (seenActionIds.has(action.actionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['actions', index],
          message: `duplicate actionId "${action.actionId}" in evaluation.actions`,
        })
      } else {
        seenActionIds.set(action.actionId, index)
      }
    })

    const seenComparisonActionIds = new Map<string, number>()
    evaluation.comparison.actionRows.forEach((row, index) => {
      if (seenComparisonActionIds.has(row.actionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['comparison', 'actionRows', index],
          message: `duplicate actionId "${row.actionId}" in comparison.actionRows`,
        })
      } else {
        seenComparisonActionIds.set(row.actionId, index)
      }
    })

    // 1:1 reconcile evaluation.actions against proposal-side comparison rows in
    // published actionRows order so comparison.actionRows cannot forge evidence.
    const proposalRows = proposalActionRows(evaluation.comparison.actionRows)
    if (evaluation.actions.length !== proposalRows.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['actions'],
        message:
          'evaluation.actions length must match the proposal-side comparison.actionRows length',
      })
    }
    const pairCount = Math.min(evaluation.actions.length, proposalRows.length)
    for (let index = 0; index < pairCount; index++) {
      const action = evaluation.actions[index]!
      const row = proposalRows[index]!
      if (!evaluationActionMatchesProposalRow(action, row)) {
        ctx.addIssue({
          code: 'custom',
          path: ['actions', index],
          message:
            'evaluation.actions[index] must match comparison.actionRows proposal-side row ' +
            '(actionId, kind, year, identities, readiness, outcome, amounts, sourceAllocations, reasons)',
        })
      }
    }
  })

export type TaxStrategyEvaluation = z.infer<typeof taxStrategyEvaluationSchema>

export interface BuildTaxStrategyEvaluationInput {
  comparison: ScenarioPlanComparison
  objective: ObjectivePolicy
  /** Policy constraint violations for the selected strategy, if the caller ran them. */
  constraints?: readonly string[]
  alternatives?: readonly RankedDecision[]
  limitations?: readonly TaxStrategyLimitationRef[]
  /**
   * Pure per-action attachment hook. Receives a **frozen** field-for-field copy
   * of the proposal-side row (not the live comparison row). The builder never
   * alters readiness/outcome/reasons from this hook, and mutation of the
   * callback argument cannot affect the built evaluation or the held comparison.
   */
  actionLimitations?: (
    row: Readonly<ScenarioActionRow>,
  ) => readonly TaxStrategyLimitationRef[]
}

function standInYearsFromComparison(comparison: ScenarioPlanComparison): number[] {
  const years = new Set<number>()
  for (const row of comparison.annual) {
    if (packForYear(row.year).isStandIn) years.add(row.year)
  }
  return [...years].sort((a, b) => a - b)
}

function copyLimitation(
  limitation: TaxStrategyLimitationRef,
): TaxStrategyLimitationRef {
  return {
    ruleId: limitation.ruleId,
    classification: limitation.classification,
    errorDirection: limitation.errorDirection,
    note: limitation.note,
  }
}

function isRetirementActionKind(kind: string): kind is RetirementActionKind {
  return kind === 'ordinaryWithdrawal' || kind === 'rothConversion' || kind === 'qcd'
}

/**
 * Field-for-field copy of a proposal-side action row (no shared nested refs).
 * Readiness, outcome, reasons, and amounts are taken verbatim.
 */
function copyActionRow(row: Readonly<ScenarioActionRow>): ScenarioActionRow {
  return {
    actionId: row.actionId,
    kind: row.kind,
    year: row.year,
    personId: row.personId,
    destinationAccountId: row.destinationAccountId,
    charityDesignationId: row.charityDesignationId,
    requestedAmountCents: row.requestedAmountCents,
    executedAmountCents: row.executedAmountCents,
    unexecutedAmountCents: row.unexecutedAmountCents,
    readiness: row.readiness,
    outcome: row.outcome,
    sourceAllocations: row.sourceAllocations.map((allocation) => ({ ...allocation })),
    reasons: row.reasons.map((reason) => ({ ...reason })),
  }
}

/** Deep-freeze a copied action row (row, nested arrays, and each nested object). */
function deepFreezeActionRow(row: ScenarioActionRow): Readonly<ScenarioActionRow> {
  for (const allocation of row.sourceAllocations) Object.freeze(allocation)
  for (const reason of row.reasons) Object.freeze(reason)
  Object.freeze(row.sourceAllocations)
  Object.freeze(row.reasons)
  return Object.freeze(row)
}

/**
 * Build an evaluation action from a pre-captured row copy plus limitations.
 * Readiness, outcome, reasons, and amounts are taken verbatim — never upgraded
 * or dropped. Non-closed kinds are passed through so the schema rejects them
 * (fail closed).
 */
function evaluationActionFromRow(
  row: Readonly<ScenarioActionRow>,
  limitations: readonly TaxStrategyLimitationRef[],
): TaxStrategyEvaluationAction {
  const kind: RetirementActionKind = isRetirementActionKind(row.kind)
    ? row.kind
    : (row.kind as RetirementActionKind)
  return {
    actionId: row.actionId,
    kind,
    year: row.year,
    personId: row.personId,
    destinationAccountId: row.destinationAccountId,
    charityDesignationId: row.charityDesignationId,
    requestedAmountCents: row.requestedAmountCents,
    executedAmountCents: row.executedAmountCents,
    unexecutedAmountCents: row.unexecutedAmountCents,
    readiness: row.readiness,
    outcome: row.outcome,
    sourceAllocations: row.sourceAllocations.map((allocation) => ({ ...allocation })),
    reasons: row.reasons.map((reason) => ({ ...reason })),
    limitations: limitations.map(copyLimitation),
  }
}

function alternativeFromRanked(ranked: RankedDecision): TaxStrategyAlternative {
  const { candidate, deltas, recommendationState } = ranked.evaluation
  return {
    candidateId: candidate.id,
    label: candidate.label,
    source: candidate.source,
    category: candidate.category,
    recommendationState,
    primaryValue: ranked.primaryValue,
    eligible: ranked.eligible,
    lossReason: ranked.lossReason,
    deltas: {
      endingAfterTaxEstate: deltas.endingAfterTaxEstate,
      endingNetWorth: deltas.endingNetWorth,
      lifetimeTax: deltas.lifetimeTax,
      moneyLastsYears: deltas.moneyLastsYears,
    },
  }
}

function confidenceFromComparison(
  comparison: ScenarioPlanComparison,
): TaxStrategyEvaluation['confidence'] {
  if (comparison.risk === null || comparison.risk === undefined) {
    return { basis: 'exactLedger', stochastic: null }
  }
  const { seed, pathCount, model } = comparison.risk.provenance
  return {
    basis: 'exactLedger',
    stochastic: {
      pathCount,
      seed,
      model: canonicalScenarioJson(model),
    },
  }
}

/** Proposal-side rows only, preserving actionRows published order. */
function proposalActionRows(
  actionRows: readonly Readonly<ScenarioActionComparisonRow>[],
): readonly Readonly<ScenarioActionRow>[] {
  const rows: ScenarioActionRow[] = []
  for (const comparisonRow of actionRows) {
    if (comparisonRow.proposal !== null) rows.push(comparisonRow.proposal)
  }
  return rows
}

/**
 * Build a TaxStrategyEvaluation by reorganizing published comparison and
 * tournament evidence. Throws when the result fails schema/invariant validation.
 */
export function buildTaxStrategyEvaluation(
  input: BuildTaxStrategyEvaluationInput,
): TaxStrategyEvaluation {
  const { comparison, objective } = input
  if (!isScenarioPlanComparisonShape(comparison)) {
    throw new Error(
      'buildTaxStrategyEvaluation: comparison is not a structurally valid ScenarioPlanComparison',
    )
  }

  const proposalRows = proposalActionRows(comparison.actionRows)
  const frozenSnapshots = proposalRows.map((row) => deepFreezeActionRow(copyActionRow(row)))
  const sourceSnapshots = proposalRows.map((row) => copyActionRow(row))
  const actions = frozenSnapshots.map((frozenHookArg, index) => {
    const limitations = input.actionLimitations?.(frozenHookArg) ?? []
    return evaluationActionFromRow(sourceSnapshots[index]!, limitations)
  })

  const draft: TaxStrategyEvaluation = {
    kind: TAX_STRATEGY_EVALUATION_KIND,
    version: CURRENT_TAX_STRATEGY_EVALUATION_VERSION,
    provenance: {
      startYear: comparison.provenance.startYear,
      baselineSnapshotHash: comparison.provenance.baselineSnapshotHash,
      proposalSnapshotHash: comparison.provenance.proposalSnapshotHash,
      engineVersion: ENGINE_VERSION,
      parameterBasis: {
        dataAsOf: PARAMETER_DATA_AS_OF,
        basis: PARAMETER_DATA_BASIS,
        standInYears: standInYearsFromComparison(comparison),
      },
    },
    objective: {
      policyId: objective.id,
      label: objective.label,
      primaryMetricLabel: objective.primaryMetricLabel,
    },
    // Held whole — same object reference when validation accepts the input.
    comparison,
    actions,
    constraints: [...(input.constraints ?? [])],
    alternatives: (input.alternatives ?? []).map(alternativeFromRanked),
    limitations: (input.limitations ?? []).map(copyLimitation),
    confidence: confidenceFromComparison(comparison),
  }

  return parseTaxStrategyEvaluation(draft)
}

export function parseTaxStrategyEvaluation(value: unknown): TaxStrategyEvaluation {
  return taxStrategyEvaluationSchema.parse(value) as TaxStrategyEvaluation
}

export function isTaxStrategyEvaluationDocument(
  value: unknown,
): value is TaxStrategyEvaluation {
  return taxStrategyEvaluationSchema.safeParse(value).success
}

/** Stable canonical text via the shared scenario JSON normalizer (sorted keys). */
export function canonicalTaxStrategyEvaluationJson(
  evaluation: TaxStrategyEvaluation,
): string {
  return canonicalScenarioJson(evaluation)
}

/**
 * Local FNV-1a 64-bit fingerprint of the canonical evaluation JSON.
 * Mirrors `scenarioPlanSnapshotHash` without importing its private hash loop.
 */
export function taxStrategyEvaluationHash(evaluation: TaxStrategyEvaluation): string {
  const canonical = canonicalTaxStrategyEvaluationJson(evaluation)
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < canonical.length; index++) {
    const codeUnit = canonical.charCodeAt(index)
    for (const byte of [codeUnit & 0xff, codeUnit >>> 8]) {
      hash ^= BigInt(byte)
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

Object.freeze(TAX_STRATEGY_OBJECTIVE_POLICY_IDS)
