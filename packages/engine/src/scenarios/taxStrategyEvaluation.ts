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
import type { ScenarioPlanComparison } from './comparison.js'
import { canonicalScenarioJson } from './patch.js'

export const TAX_STRATEGY_EVALUATION_KIND = 'retiregolden.tax-strategy-evaluation' as const
export const CURRENT_TAX_STRATEGY_EVALUATION_VERSION = 1 as const

const OBJECTIVE_POLICY_IDS = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
  'max-sustainable-spending',
  'max-downside-resilience',
] as const satisfies readonly ObjectivePolicyId[]

const objectivePolicyIdSchema = z.enum(OBJECTIVE_POLICY_IDS)

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
const CLOSED_ACTION_OUTCOMES: ReadonlySet<string> = new Set([
  'executed',
  'partial',
  'refused',
  'unsupported',
])

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

function refinePartialActionReasons(
  reasons: ReadonlyArray<{
    code: string
    outcome: string
  }>,
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

const taxStrategyEvaluationActionSchema = z
  .strictObject({
    actionId: actionIdSchema,
    kind: retirementActionKindSchema,
    year: z.number().int().min(1).max(9999),
    personId: personIdSchema.nullable(),
    destinationAccountId: accountIdSchema.nullable(),
    charityDesignationId: z.string().min(1).nullable(),
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

    if (action.outcome === 'partial') {
      refinePartialActionReasons(action.reasons, ctx)
    }
  })

export type TaxStrategyEvaluationAction = z.infer<typeof taxStrategyEvaluationActionSchema>

const decisionDeltasSchema = z.strictObject({
  endingAfterTaxEstate: z.number().finite(),
  endingNetWorth: z.number().finite(),
  lifetimeTax: z.number().finite(),
  moneyLastsYears: z.number().finite(),
})

const taxStrategyAlternativeSchema = z.strictObject({
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
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
] as const

const SCENARIO_HEADLINE_COMPARISON_KEYS = [
  'endingInvestable',
  'endingNetWorth',
  'endingAfterTaxEstate',
  'lifetimeTax',
  'lifetimePenalties',
  'lifetimeTaxesAndPenalties',
  'depletionYear',
  'projectionEndYear',
] as const

function comparisonSideConservesAmounts(side: Record<string, unknown>): boolean {
  const requested = side['requestedAmountCents']
  const executed = side['executedAmountCents']
  const unexecuted = side['unexecutedAmountCents']
  if (typeof requested !== 'number' || !Number.isInteger(requested)) return false
  if (typeof executed !== 'number' || !Number.isInteger(executed)) return false
  if (typeof unexecuted !== 'number' || !Number.isInteger(unexecuted)) return false
  return BigInt(executed) + BigInt(unexecuted) === BigInt(requested)
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

  const headline = value['headline']
  if (!isPlainObject(headline)) return false
  for (const key of SCENARIO_HEADLINE_COMPARISON_KEYS) {
    if (!isPlainObject(headline[key])) return false
  }

  if (value['risk'] !== null) {
    if (!isPlainObject(value['risk'])) return false
    const risk = value['risk']
    if (!isPlainObject(risk['provenance'])) return false
    if (!Array.isArray(risk['depletionProbabilityByYear'])) return false
  }
  if (value['spendingCapacity'] !== null && !isPlainObject(value['spendingCapacity'])) {
    return false
  }

  if (!Array.isArray(value['actionRows'])) return false
  if (!Array.isArray(value['annual'])) return false
  for (const row of value['annual']) {
    if (!isPlainObject(row) || typeof row['year'] !== 'number' || !Number.isInteger(row['year'])) {
      return false
    }
  }
  for (const row of value['actionRows']) {
    if (!isPlainObject(row)) return false
    if (typeof row['actionId'] !== 'string' || row['actionId'].length === 0) return false
    const outerActionId = row['actionId']
    const sides = [row['baseline'], row['proposal']] as const
    for (const side of sides) {
      if (side === null || side === undefined) continue
      if (!isPlainObject(side)) return false
      if (side['actionId'] !== outerActionId) return false
      if (typeof side['kind'] !== 'string' || !CLOSED_ACTION_KINDS.has(side['kind'])) return false
      if (side['readiness'] !== 'actionable' && side['readiness'] !== 'nonActionable') return false
      if (typeof side['outcome'] !== 'string' || !CLOSED_ACTION_OUTCOMES.has(side['outcome'])) {
        return false
      }
      if (!comparisonSideConservesAmounts(side)) return false
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

Object.freeze(OBJECTIVE_POLICY_IDS)
