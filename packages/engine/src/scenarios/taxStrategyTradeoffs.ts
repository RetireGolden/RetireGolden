/**
 * TaxStrategyTradeoffs — comparison / tradeoff surface for the Advisor tax
 * implementation cockpit (WS4).
 *
 * Role: reorganize a `TaxStrategyEvaluation` into a fixed seven-dimension
 * tradeoff document so baseline vs selected strategy is visible across lifetime
 * tax, after-tax spending, IRMAA/ACA, success/adjustments, estate, and survivor
 * outcomes — without inventing cross-dimension rankings, composite scores, or
 * document-level winners.
 *
 * No forked arithmetic: every dollar figure is copied from the evaluation's
 * held comparison sections, or is a SUM of held per-year annual values over an
 * evidence-derived survivor year window. This module never calls tax
 * calculators.
 *
 * Decision-support boundary: alternatives retain the tournament's per-candidate
 * facts under the labeled single objective (`objective.label` /
 * `objective.primaryMetricLabel` name that objective; `primaryValue` is that
 * labeled metric's value for the candidate — not a composite score). Those
 * fields are plan-mandated false-optimality mitigation for the single
 * objective. What this document structurally forbids is any CROSS-DIMENSION
 * composite, any document-level winner field, and any ranking of the seven
 * dimensions. The objective is labeled as the single optimized metric
 * (`scope: 'single-objective'`); every other dimension is presented as a
 * tradeoff. `presentationContract` pins the fixed always-present shape with no
 * cross-dimension ranking.
 *
 * Fail-closed survivor dimension: without both ledger year arrays the survivor
 * section is `absent` (not approximated). Mismatched first-survivor windows
 * between sides are `absent` — longevity is plan-level, so a differing window
 * means the caller mixed projections and nothing may be summed across them.
 * Survivor window and filing-status path are derived only from years actually
 * bound for each side (non-exempt annual rows); supplied exempt-side rows are
 * ignored for derivation.
 *
 * Ledger-years trust residual: when `verifyTaxStrategyTradeoffsBinding` is
 * called without optional ledger years, window authenticity and
 * evidence-to-absent downgrades ride inside the ledger-years trust boundary
 * (same boundary language as WS3's IRMAA note). Unconditional minimums still
 * apply for `status: 'evidence'` (firstSurvivorYear must appear in
 * `evaluation.comparison.annual`; filingStatusPath non-empty). Supplying
 * `{ baselineYears, proposalYears }` rebuilds the survivor section via the
 * builder's own derivation and requires canonical-JSON equality.
 */

import { z } from 'zod'

import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { objectivePolicies } from '../decisions/objectives.js'
import type { YearResult } from '../projection/types.js'
import { canonicalScenarioJson } from './patch.js'
import {
  parseTaxStrategyEvaluation,
  TAX_STRATEGY_OBJECTIVE_POLICY_IDS,
  taxStrategyEvaluationHash,
  type TaxStrategyAlternative,
  type TaxStrategyEvaluation,
} from './taxStrategyEvaluation.js'

export const TAX_STRATEGY_TRADEOFFS_KIND = 'retiregolden.tax-strategy-tradeoffs' as const
export const CURRENT_TAX_STRATEGY_TRADEOFFS_VERSION = 1 as const

const finiteNumberSchema = z.number().finite()
const nullableFiniteNumberSchema = z.number().finite().nullable()

/**
 * Re-derive `adverse` from delta sign and fixed betterDirection.
 * Zero delta is never adverse. Contextual metrics always report null.
 */
export function deriveAdverse(
  delta: number | null,
  betterDirection: 'lower' | 'higher' | 'contextual',
): boolean | null {
  if (delta === null || betterDirection === 'contextual') return null
  if (betterDirection === 'lower') return delta > 0
  return delta < 0
}

function expectedDelta(
  baseline: number | null,
  proposal: number | null,
): number | null {
  if (baseline === null || proposal === null) return null
  return proposal - baseline
}

function refineMetricEntry(
  metric: {
    baseline: number | null
    proposal: number | null
    delta: number | null
    betterDirection: 'lower' | 'higher' | 'contextual'
    adverse: boolean | null
  },
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[] = [],
): void {
  const expected = expectedDelta(metric.baseline, metric.proposal)
  if (metric.delta !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'delta'],
      message: 'delta must equal proposal − baseline when both sides are non-null; else null',
    })
  }
  const expectedAdverse = deriveAdverse(metric.delta, metric.betterDirection)
  if (metric.adverse !== expectedAdverse) {
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'adverse'],
      message: 'adverse must match the sign rule for betterDirection and delta',
    })
  }
}

function tradeoffMetricSchema(
  betterDirection: 'lower' | 'higher' | 'contextual',
  sides: 'required' | 'nullable',
) {
  const sideSchema = sides === 'required' ? finiteNumberSchema : nullableFiniteNumberSchema
  return z
    .strictObject({
      baseline: sideSchema,
      proposal: sideSchema,
      delta: sideSchema,
      betterDirection: z.literal(betterDirection),
      adverse: z.boolean().nullable(),
    })
    .superRefine((metric, ctx) => {
      refineMetricEntry(metric, ctx)
    })
}

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

const decisionDeltasSchema = z.strictObject({
  endingAfterTaxEstate: finiteNumberSchema,
  endingNetWorth: finiteNumberSchema,
  lifetimeTax: finiteNumberSchema,
  moneyLastsYears: finiteNumberSchema,
})

/**
 * Tournament alternative under the labeled single objective.
 * `primaryValue` is that objective's metric value for the candidate (see
 * `objective.label` / `objective.primaryMetricLabel`) — not a composite score.
 * `recommendationState` / `eligible` / `lossReason` are the tournament's
 * per-candidate facts for that same single objective (false-optimality
 * mitigation). They are not a cross-dimension ranking or document-level winner.
 */
const taxStrategyAlternativeSchema = z
  .strictObject({
    candidateId: z.string().min(1),
    label: z.string().min(1),
    source: decisionSourceSchema,
    category: decisionCategorySchema,
    recommendationState: recommendationStateSchema,
    /** Labeled single-objective metric value for this candidate — not a composite score. */
    primaryValue: finiteNumberSchema,
    eligible: z.boolean(),
    lossReason: z.string().nullable(),
    deltas: decisionDeltasSchema,
  })
  .superRefine((alternative, ctx) => {
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

const parameterBasisSchema = z.strictObject({
  dataAsOf: z.string().min(1),
  basis: z.string().min(1),
  standInYears: z.array(z.number().int()),
})

const tradeoffsProvenanceSchema = z.strictObject({
  startYear: z.number().int(),
  baselineSnapshotHash: z.string().min(1),
  proposalSnapshotHash: z.string().min(1),
  engineVersion: z.string().min(1),
  parameterBasis: parameterBasisSchema,
  evaluationHash: z.string().min(1),
})

/**
 * The selected strategy optimized exactly this metric; nothing in this document
 * ranks the seven dimensions or declares an overall cross-dimension winner.
 * Labels are bound to the canonical `objectivePolicies` entry for `policyId`.
 */
const tradeoffsObjectiveSchema = z
  .strictObject({
    policyId: z.enum(TAX_STRATEGY_OBJECTIVE_POLICY_IDS),
    label: z.string().min(1),
    primaryMetricLabel: z.string().min(1),
    scope: z.literal('single-objective'),
  })
  .superRefine((objective, ctx) => {
    const policy = objectivePolicies[objective.policyId]
    if (objective.label !== policy.label) {
      ctx.addIssue({
        code: 'custom',
        path: ['label'],
        message:
          'objective.label must equal objectivePolicies[policyId].label (canonical static label)',
      })
    }
    if (objective.primaryMetricLabel !== policy.primaryMetricLabel) {
      ctx.addIssue({
        code: 'custom',
        path: ['primaryMetricLabel'],
        message:
          'objective.primaryMetricLabel must equal objectivePolicies[policyId].primaryMetricLabel',
      })
    }
  })

const projectedFilingStatusSchema = z.enum([
  'single',
  'marriedFilingJointly',
  'qualifyingSurvivingSpouse',
])

const capacitySchema = z
  .strictObject({
    maxBaseAnnual: tradeoffMetricSchema('higher', 'nullable'),
    spendingSlack: tradeoffMetricSchema('higher', 'nullable'),
  })
  .nullable()

const successAdjustmentsSchema = z
  .strictObject({
    successRate: tradeoffMetricSchema('higher', 'required'),
    requiredFloorSuccessRate: tradeoffMetricSchema('higher', 'required'),
    targetLifestyleSuccessRate: tradeoffMetricSchema('higher', 'required'),
    probabilityOfAdjustment: tradeoffMetricSchema('lower', 'required'),
    medianMaxCutDepth: tradeoffMetricSchema('lower', 'required'),
    p90MaxCutDepth: tradeoffMetricSchema('lower', 'required'),
    expectedShortfallDollars: tradeoffMetricSchema('lower', 'required'),
  })
  .nullable()

const estatePercentilesSchema = z
  .strictObject({
    estateP10: tradeoffMetricSchema('higher', 'required'),
    estateP50: tradeoffMetricSchema('higher', 'required'),
    estateP90: tradeoffMetricSchema('higher', 'required'),
  })
  .nullable()

const survivorEvidenceSchema = z.strictObject({
  status: z.literal('evidence'),
  firstSurvivorYear: z.number().int().min(1).max(9999),
  /** Non-empty run-length encoding of filing status from firstSurvivorYear onward. */
  filingStatusPath: z.array(projectedFilingStatusSchema).min(1),
  tax: tradeoffMetricSchema('lower', 'nullable'),
  spendingFunded: tradeoffMetricSchema('higher', 'nullable'),
  spendingShortfall: tradeoffMetricSchema('lower', 'nullable'),
  requiredShortfall: tradeoffMetricSchema('lower', 'nullable'),
  irmaaSurcharge: tradeoffMetricSchema('lower', 'nullable'),
  magi: tradeoffMetricSchema('contextual', 'nullable'),
})

const survivorAbsentSchema = z.strictObject({
  status: z.literal('absent'),
  reason: z.enum([
    'ledger-years-not-supplied',
    'no-survivor-phase',
    'survivor-window-mismatch',
  ]),
})

const survivorSchema = z.discriminatedUnion('status', [
  survivorEvidenceSchema,
  survivorAbsentSchema,
])

const dimensionsSchema = z.strictObject({
  /**
   * Machine-readable pin: all seven dimension sections are always present;
   * there is no cross-dimension ranking or document-level winner.
   */
  presentationContract: z.literal(
    'all-dimensions-always-present-no-cross-dimension-ranking',
  ),
  lifetimeTax: z.strictObject({
    lifetimeTaxesAndPenalties: tradeoffMetricSchema('lower', 'required'),
    lifetimeTax: tradeoffMetricSchema('lower', 'required'),
    lifetimePenalties: tradeoffMetricSchema('lower', 'required'),
    /**
     * Selected-strategy durability (nullable). Do not interpret a shorter
     * projection horizon as earlier depletion — carry projectionEndYear
     * (contextual) alongside for that reason (same warning as comparison.ts).
     */
    depletionYear: tradeoffMetricSchema('higher', 'nullable'),
    /** Explicit simulation horizon; pair with depletionYear (see its docblock). */
    projectionEndYear: tradeoffMetricSchema('contextual', 'required'),
  }),
  /**
   * After-tax spending tradeoffs.
   * `funded` sums expenses.total: healthcare (Medicare Part B WITH IRMAA, Part D
   * surcharge, marketplace premiums net of ACA credit), debt service, property
   * costs, insurance, and net LTC — outlays net of income tax, not lifestyle
   * spending alone. It excludes income tax. betterDirection remains higher.
   * `intended` (contextual) is the spending goal so a funded increase from a
   * raised goal is distinguishable from better funding of the same goal.
   */
  afterTaxSpending: z.strictObject({
    funded: tradeoffMetricSchema('higher', 'required'),
    intended: tradeoffMetricSchema('contextual', 'required'),
    totalShortfall: tradeoffMetricSchema('lower', 'required'),
    requiredShortfall: tradeoffMetricSchema('lower', 'required'),
    targetShortfall: tradeoffMetricSchema('lower', 'required'),
    capacity: capacitySchema,
  }),
  medicareIrmaa: z.strictObject({
    surcharge: tradeoffMetricSchema('lower', 'required'),
    totalMedicarePremiums: tradeoffMetricSchema('lower', 'required'),
    surchargeTierYears: tradeoffMetricSchema('lower', 'required'),
    maxTier: tradeoffMetricSchema('lower', 'required'),
  }),
  acaPremiumTaxCredit: z.strictObject({
    grossEnrollmentPremium: tradeoffMetricSchema('contextual', 'required'),
    modeledAllowablePtc: tradeoffMetricSchema('higher', 'required'),
    economicNetPremium: tradeoffMetricSchema('lower', 'required'),
    actionableYears: tradeoffMetricSchema('contextual', 'required'),
    nonActionableYears: tradeoffMetricSchema('contextual', 'required'),
  }),
  successAdjustments: successAdjustmentsSchema,
  estate: z.strictObject({
    afterTaxEstate: tradeoffMetricSchema('higher', 'required'),
    grossNetWorth: tradeoffMetricSchema('higher', 'required'),
    heirTax: tradeoffMetricSchema('lower', 'required'),
    charity: tradeoffMetricSchema('contextual', 'required'),
    percentiles: estatePercentilesSchema,
  }),
  survivor: survivorSchema,
})

export const taxStrategyTradeoffsSchema = z
  .strictObject({
    kind: z.literal(TAX_STRATEGY_TRADEOFFS_KIND),
    version: z.literal(CURRENT_TAX_STRATEGY_TRADEOFFS_VERSION),
    provenance: tradeoffsProvenanceSchema,
    objective: tradeoffsObjectiveSchema,
    dimensions: dimensionsSchema,
    /**
     * Alternatives under the labeled single objective. Each row's `primaryValue`
     * is that objective's metric value for the candidate — not a composite score.
     */
    alternatives: z.array(taxStrategyAlternativeSchema),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>()
    doc.alternatives.forEach((alternative, index) => {
      if (seen.has(alternative.candidateId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['alternatives', index, 'candidateId'],
          message: `duplicate candidateId "${alternative.candidateId}" in alternatives`,
        })
      } else {
        seen.add(alternative.candidateId)
      }
      if (index > 0) {
        const prev = doc.alternatives[index - 1]!
        if (compareUtf16CodeUnits(prev.candidateId, alternative.candidateId) >= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['alternatives', index],
            message:
              'alternatives must be in ascending candidateId order by UTF-16 code-unit compare',
          })
        }
      }
    })
  })

export type TradeoffMetric = {
  baseline: number | null
  proposal: number | null
  delta: number | null
  betterDirection: 'lower' | 'higher' | 'contextual'
  adverse: boolean | null
}

export type TaxStrategyTradeoffs = z.infer<typeof taxStrategyTradeoffsSchema>

export interface BuildTaxStrategyTradeoffsInput {
  evaluation: TaxStrategyEvaluation
  /** Optional ledger years for the survivor dimension only. Both or neither. */
  baselineYears?: readonly Readonly<YearResult>[]
  proposalYears?: readonly Readonly<YearResult>[]
}

type ScalarLike = {
  baseline: number | null
  proposal: number | null
  delta: number | null
}

type RequiredScalarLike = {
  baseline: number
  proposal: number
  delta: number
}

function metricFromComparison(
  comparison: ScalarLike,
  betterDirection: 'lower' | 'higher' | 'contextual',
): TradeoffMetric {
  return {
    baseline: comparison.baseline,
    proposal: comparison.proposal,
    delta: comparison.delta,
    betterDirection,
    adverse: deriveAdverse(comparison.delta, betterDirection),
  }
}

function metricFromRequired(
  comparison: RequiredScalarLike,
  betterDirection: 'lower' | 'higher' | 'contextual',
): TradeoffMetric {
  return metricFromComparison(comparison, betterDirection)
}

function copyAlternative(alternative: TaxStrategyAlternative): TaxStrategyAlternative {
  return {
    candidateId: alternative.candidateId,
    label: alternative.label,
    source: alternative.source,
    category: alternative.category,
    recommendationState: alternative.recommendationState,
    primaryValue: alternative.primaryValue,
    eligible: alternative.eligible,
    lossReason: alternative.lossReason,
    deltas: {
      endingAfterTaxEstate: alternative.deltas.endingAfterTaxEstate,
      endingNetWorth: alternative.deltas.endingNetWorth,
      lifetimeTax: alternative.deltas.lifetimeTax,
      moneyLastsYears: alternative.deltas.moneyLastsYears,
    },
  }
}

function isBaselineOnlyAnnualRow(
  row: TaxStrategyEvaluation['comparison']['annual'][number],
): boolean {
  return Object.values(row.values).every((comparison) => comparison.proposal === null)
}

function isProposalOnlyAnnualRow(
  row: TaxStrategyEvaluation['comparison']['annual'][number],
): boolean {
  return Object.values(row.values).every((comparison) => comparison.baseline === null)
}

function bindSideYears(
  evaluation: TaxStrategyEvaluation,
  years: readonly Readonly<YearResult>[],
  side: 'baseline' | 'proposal',
): Map<number, Readonly<YearResult>> {
  const annual = evaluation.comparison.annual
  const annualYearSet = new Set(annual.map((row) => row.year))
  const byYear = new Map<number, Readonly<YearResult>>()
  for (const yearResult of years) {
    if (byYear.has(yearResult.year)) {
      throw new Error(
        `buildTaxStrategyTradeoffs: duplicate ${side} year ${yearResult.year}`,
      )
    }
    byYear.set(yearResult.year, yearResult)
  }
  for (const year of byYear.keys()) {
    if (!annualYearSet.has(year)) {
      throw new Error(
        `buildTaxStrategyTradeoffs: ${side}Years must cover every comparison.annual year exactly once`,
      )
    }
  }
  for (const row of annual) {
    if (side === 'proposal' && isBaselineOnlyAnnualRow(row)) continue
    if (side === 'baseline' && isProposalOnlyAnnualRow(row)) continue
    const yearResult = byYear.get(row.year)
    if (yearResult === undefined) {
      throw new Error(
        `buildTaxStrategyTradeoffs: ${side}Years missing comparison year ${row.year}`,
      )
    }
    if (yearResult.magi !== row.values.magi[side]) {
      throw new Error(
        `buildTaxStrategyTradeoffs: ${side} year ${row.year} magi does not match comparison`,
      )
    }
    if (yearResult.tax !== row.values.tax[side]) {
      throw new Error(
        `buildTaxStrategyTradeoffs: ${side} year ${row.year} tax does not match comparison`,
      )
    }
  }
  return byYear
}

/**
 * Years actually bound for `side` (non-exempt annual rows). Supplied YearResults
 * for the opposite-only tail are ignored for survivor window / filing-status
 * derivation — they may legitimately exist in a fuller projection.
 */
function boundYearResultsForSide(
  evaluation: TaxStrategyEvaluation,
  byYear: Map<number, Readonly<YearResult>>,
  side: 'baseline' | 'proposal',
): Readonly<YearResult>[] {
  const bound: Readonly<YearResult>[] = []
  for (const row of evaluation.comparison.annual) {
    if (side === 'proposal' && isBaselineOnlyAnnualRow(row)) continue
    if (side === 'baseline' && isProposalOnlyAnnualRow(row)) continue
    const yearResult = byYear.get(row.year)
    if (yearResult === undefined) {
      throw new Error(
        `buildTaxStrategyTradeoffs: ${side}Years missing comparison year ${row.year}`,
      )
    }
    bound.push(yearResult)
  }
  return bound
}

function aliveCount(yearResult: Readonly<YearResult>): number {
  return yearResult.people.filter((person) => person.alive).length
}

/**
 * First calendar year that is an in-plan survivor TRANSITION: index i > 0 where
 * aliveCount(years[i]) === 1 AND aliveCount(years[i-1]) >= 2.
 * Mirrors the widowsPenalty detector transition requirement (last joint year
 * must exist in-horizon). A household already single from its first bound year
 * has no survivor phase — its whole horizon is covered by the other six
 * dimensions — and this returns null so the builder takes absent(no-survivor-phase).
 */
function firstSurvivorYearFromYears(
  years: readonly Readonly<YearResult>[],
): number | null {
  const ordered = [...years].sort((left, right) => left.year - right.year)
  for (let i = 1; i < ordered.length; i++) {
    if (aliveCount(ordered[i]!) === 1 && aliveCount(ordered[i - 1]!) >= 2) {
      return ordered[i]!.year
    }
  }
  return null
}

function filingStatusPathFromProposal(
  years: readonly Readonly<YearResult>[],
  firstSurvivorYear: number,
): Array<'single' | 'marriedFilingJointly' | 'qualifyingSurvivingSpouse'> {
  const ordered = [...years]
    .filter((yearResult) => yearResult.year >= firstSurvivorYear)
    .sort((left, right) => left.year - right.year)
  const path: Array<'single' | 'marriedFilingJointly' | 'qualifyingSurvivingSpouse'> = []
  for (const yearResult of ordered) {
    if (path.length === 0 || path[path.length - 1] !== yearResult.filingStatus) {
      path.push(yearResult.filingStatus)
    }
  }
  return path
}

type AnnualField =
  | 'tax'
  | 'spendingFunded'
  | 'shortfall'
  | 'requiredShortfall'
  | 'irmaaSurcharge'
  | 'magi'

function sumAnnualSide(
  evaluation: TaxStrategyEvaluation,
  firstSurvivorYear: number,
  field: AnnualField,
  side: 'baseline' | 'proposal',
): number | null {
  let sum = 0
  for (const row of evaluation.comparison.annual) {
    if (row.year < firstSurvivorYear) continue
    const value = row.values[field][side]
    if (value === null) return null
    sum += value
  }
  return sum
}

function survivorMetricFromSums(
  baseline: number | null,
  proposal: number | null,
  betterDirection: 'lower' | 'higher' | 'contextual',
): TradeoffMetric {
  const delta = expectedDelta(baseline, proposal)
  return {
    baseline,
    proposal,
    delta,
    betterDirection,
    adverse: deriveAdverse(delta, betterDirection),
  }
}

function buildSurvivorEvidence(
  evaluation: TaxStrategyEvaluation,
  firstSurvivorYear: number,
  proposalYears: readonly Readonly<YearResult>[],
): z.infer<typeof survivorEvidenceSchema> {
  return {
    status: 'evidence',
    firstSurvivorYear,
    filingStatusPath: filingStatusPathFromProposal(proposalYears, firstSurvivorYear),
    tax: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'tax', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'tax', 'proposal'),
      'lower',
    ),
    spendingFunded: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'spendingFunded', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'spendingFunded', 'proposal'),
      'higher',
    ),
    spendingShortfall: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'shortfall', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'shortfall', 'proposal'),
      'lower',
    ),
    requiredShortfall: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'requiredShortfall', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'requiredShortfall', 'proposal'),
      'lower',
    ),
    irmaaSurcharge: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'irmaaSurcharge', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'irmaaSurcharge', 'proposal'),
      'lower',
    ),
    magi: survivorMetricFromSums(
      sumAnnualSide(evaluation, firstSurvivorYear, 'magi', 'baseline'),
      sumAnnualSide(evaluation, firstSurvivorYear, 'magi', 'proposal'),
      'contextual',
    ),
  }
}

function buildSurvivorDimension(
  evaluation: TaxStrategyEvaluation,
  baselineYears: readonly Readonly<YearResult>[] | undefined,
  proposalYears: readonly Readonly<YearResult>[] | undefined,
): z.infer<typeof survivorSchema> {
  const hasBaseline = baselineYears !== undefined
  const hasProposal = proposalYears !== undefined
  if (hasBaseline !== hasProposal) {
    throw new Error(
      'buildTaxStrategyTradeoffs: baselineYears and proposalYears must both be supplied or both omitted',
    )
  }
  if (!hasBaseline || !hasProposal) {
    return { status: 'absent', reason: 'ledger-years-not-supplied' }
  }

  const baselineByYear = bindSideYears(evaluation, baselineYears, 'baseline')
  const proposalByYear = bindSideYears(evaluation, proposalYears, 'proposal')
  // Derive only from non-exempt bound rows; ignore supplied exempt-side years.
  const baselineBound = boundYearResultsForSide(evaluation, baselineByYear, 'baseline')
  const proposalBound = boundYearResultsForSide(evaluation, proposalByYear, 'proposal')

  const baselineFirst = firstSurvivorYearFromYears(baselineBound)
  const proposalFirst = firstSurvivorYearFromYears(proposalBound)

  if (baselineFirst === null && proposalFirst === null) {
    return { status: 'absent', reason: 'no-survivor-phase' }
  }
  if (baselineFirst === null || proposalFirst === null || baselineFirst !== proposalFirst) {
    // Longevity is plan-level: a differing window means mixed projections.
    return { status: 'absent', reason: 'survivor-window-mismatch' }
  }

  return buildSurvivorEvidence(evaluation, proposalFirst, proposalBound)
}

function freezeMetric(metric: TradeoffMetric): void {
  Object.freeze(metric)
}

function deepFreezeTaxStrategyTradeoffs(
  tradeoffs: TaxStrategyTradeoffs,
): TaxStrategyTradeoffs {
  Object.freeze(tradeoffs.provenance.parameterBasis.standInYears)
  Object.freeze(tradeoffs.provenance.parameterBasis)
  Object.freeze(tradeoffs.provenance)
  Object.freeze(tradeoffs.objective)

  const dims = tradeoffs.dimensions
  for (const metric of Object.values(dims.lifetimeTax)) freezeMetric(metric)
  Object.freeze(dims.lifetimeTax)

  freezeMetric(dims.afterTaxSpending.funded)
  freezeMetric(dims.afterTaxSpending.intended)
  freezeMetric(dims.afterTaxSpending.totalShortfall)
  freezeMetric(dims.afterTaxSpending.requiredShortfall)
  freezeMetric(dims.afterTaxSpending.targetShortfall)
  if (dims.afterTaxSpending.capacity !== null) {
    freezeMetric(dims.afterTaxSpending.capacity.maxBaseAnnual)
    freezeMetric(dims.afterTaxSpending.capacity.spendingSlack)
    Object.freeze(dims.afterTaxSpending.capacity)
  }
  Object.freeze(dims.afterTaxSpending)

  for (const metric of Object.values(dims.medicareIrmaa)) freezeMetric(metric)
  Object.freeze(dims.medicareIrmaa)

  for (const metric of Object.values(dims.acaPremiumTaxCredit)) freezeMetric(metric)
  Object.freeze(dims.acaPremiumTaxCredit)

  if (dims.successAdjustments !== null) {
    for (const metric of Object.values(dims.successAdjustments)) freezeMetric(metric)
    Object.freeze(dims.successAdjustments)
  }

  freezeMetric(dims.estate.afterTaxEstate)
  freezeMetric(dims.estate.grossNetWorth)
  freezeMetric(dims.estate.heirTax)
  freezeMetric(dims.estate.charity)
  if (dims.estate.percentiles !== null) {
    freezeMetric(dims.estate.percentiles.estateP10)
    freezeMetric(dims.estate.percentiles.estateP50)
    freezeMetric(dims.estate.percentiles.estateP90)
    Object.freeze(dims.estate.percentiles)
  }
  Object.freeze(dims.estate)

  if (dims.survivor.status === 'evidence') {
    Object.freeze(dims.survivor.filingStatusPath)
    freezeMetric(dims.survivor.tax)
    freezeMetric(dims.survivor.spendingFunded)
    freezeMetric(dims.survivor.spendingShortfall)
    freezeMetric(dims.survivor.requiredShortfall)
    freezeMetric(dims.survivor.irmaaSurcharge)
    freezeMetric(dims.survivor.magi)
  }
  Object.freeze(dims.survivor)
  Object.freeze(dims)

  for (const alternative of tradeoffs.alternatives) {
    Object.freeze(alternative.deltas)
    Object.freeze(alternative)
  }
  Object.freeze(tradeoffs.alternatives)
  return Object.freeze(tradeoffs)
}

/**
 * Build a TaxStrategyTradeoffs document by reorganizing published evaluation
 * comparison evidence. Throws when the result fails schema/invariant validation
 * or when optional ledger years do not bind to the evaluation's held comparison.
 */
export function buildTaxStrategyTradeoffs(
  input: BuildTaxStrategyTradeoffsInput,
): TaxStrategyTradeoffs {
  const evaluation = parseTaxStrategyEvaluation(input.evaluation)

  // Mirror WS2: risk-null implies confidence.stochastic null (parse already
  // enforces; re-assert so a hand-forged evaluation path cannot pass silently).
  if (evaluation.comparison.risk === null && evaluation.confidence.stochastic !== null) {
    throw new Error(
      'buildTaxStrategyTradeoffs: confidence.stochastic must be null when comparison.risk is null',
    )
  }

  const headline = evaluation.comparison.headline
  const spending = evaluation.comparison.spending
  const irmaa = evaluation.comparison.irmaa
  const aca = evaluation.comparison.aca
  const estate = evaluation.comparison.estate
  const risk = evaluation.comparison.risk
  const spendingCapacity = evaluation.comparison.spendingCapacity

  const capacity =
    spendingCapacity === null
      ? null
      : {
          maxBaseAnnual: metricFromComparison(spendingCapacity.maxBaseAnnual, 'higher'),
          spendingSlack: metricFromComparison(spendingCapacity.spendingSlack, 'higher'),
        }

  const successAdjustments =
    risk === null
      ? null
      : {
          successRate: metricFromRequired(risk.successRate, 'higher'),
          requiredFloorSuccessRate: metricFromRequired(risk.requiredFloorSuccessRate, 'higher'),
          targetLifestyleSuccessRate: metricFromRequired(
            risk.targetLifestyleSuccessRate,
            'higher',
          ),
          probabilityOfAdjustment: metricFromRequired(risk.probabilityOfAdjustment, 'lower'),
          medianMaxCutDepth: metricFromRequired(risk.medianMaxCutDepth, 'lower'),
          p90MaxCutDepth: metricFromRequired(risk.p90MaxCutDepth, 'lower'),
          expectedShortfallDollars: metricFromRequired(risk.expectedShortfallDollars, 'lower'),
        }

  const percentiles =
    risk === null
      ? null
      : {
          estateP10: metricFromRequired(risk.estateP10, 'higher'),
          estateP50: metricFromRequired(risk.estateP50, 'higher'),
          estateP90: metricFromRequired(risk.estateP90, 'higher'),
        }

  const alternatives = evaluation.alternatives
    .map(copyAlternative)
    .sort((left, right) => compareUtf16CodeUnits(left.candidateId, right.candidateId))

  const draft: TaxStrategyTradeoffs = {
    kind: TAX_STRATEGY_TRADEOFFS_KIND,
    version: CURRENT_TAX_STRATEGY_TRADEOFFS_VERSION,
    provenance: {
      startYear: evaluation.provenance.startYear,
      baselineSnapshotHash: evaluation.provenance.baselineSnapshotHash,
      proposalSnapshotHash: evaluation.provenance.proposalSnapshotHash,
      engineVersion: evaluation.provenance.engineVersion,
      parameterBasis: {
        dataAsOf: evaluation.provenance.parameterBasis.dataAsOf,
        basis: evaluation.provenance.parameterBasis.basis,
        standInYears: [...evaluation.provenance.parameterBasis.standInYears],
      },
      evaluationHash: taxStrategyEvaluationHash(evaluation),
    },
    objective: {
      policyId: evaluation.objective.policyId,
      label: evaluation.objective.label,
      primaryMetricLabel: evaluation.objective.primaryMetricLabel,
      scope: 'single-objective',
    },
    dimensions: {
      presentationContract: 'all-dimensions-always-present-no-cross-dimension-ranking',
      lifetimeTax: {
        lifetimeTaxesAndPenalties: metricFromRequired(
          headline.lifetimeTaxesAndPenalties,
          'lower',
        ),
        lifetimeTax: metricFromRequired(headline.lifetimeTax, 'lower'),
        lifetimePenalties: metricFromRequired(headline.lifetimePenalties, 'lower'),
        depletionYear: metricFromComparison(headline.depletionYear, 'higher'),
        projectionEndYear: metricFromRequired(headline.projectionEndYear, 'contextual'),
      },
      afterTaxSpending: {
        funded: metricFromRequired(spending.funded, 'higher'),
        intended: metricFromRequired(spending.intended, 'contextual'),
        totalShortfall: metricFromRequired(spending.totalShortfall, 'lower'),
        requiredShortfall: metricFromRequired(spending.requiredShortfall, 'lower'),
        targetShortfall: metricFromRequired(spending.targetShortfall, 'lower'),
        capacity,
      },
      medicareIrmaa: {
        surcharge: metricFromRequired(irmaa.surcharge, 'lower'),
        totalMedicarePremiums: metricFromRequired(irmaa.totalMedicarePremiums, 'lower'),
        surchargeTierYears: metricFromRequired(irmaa.surchargeTierYears, 'lower'),
        maxTier: metricFromRequired(irmaa.maxTier, 'lower'),
      },
      acaPremiumTaxCredit: {
        grossEnrollmentPremium: metricFromRequired(aca.grossEnrollmentPremium, 'contextual'),
        modeledAllowablePtc: metricFromRequired(aca.modeledAllowablePtc, 'higher'),
        economicNetPremium: metricFromRequired(aca.economicNetPremium, 'lower'),
        actionableYears: metricFromRequired(aca.actionableYears, 'contextual'),
        nonActionableYears: metricFromRequired(aca.nonActionableYears, 'contextual'),
      },
      successAdjustments,
      estate: {
        afterTaxEstate: metricFromRequired(estate.afterTaxEstate, 'higher'),
        grossNetWorth: metricFromRequired(estate.grossNetWorth, 'higher'),
        heirTax: metricFromRequired(estate.heirTax, 'lower'),
        charity: metricFromRequired(estate.charity, 'contextual'),
        percentiles,
      },
      survivor: buildSurvivorDimension(
        evaluation,
        input.baselineYears,
        input.proposalYears,
      ),
    },
    alternatives,
  }

  // Parse first (zod constructs new objects), then deep-freeze the parsed result.
  return deepFreezeTaxStrategyTradeoffs(parseTaxStrategyTradeoffs(draft))
}

function metricsEqual(actual: TradeoffMetric, expected: TradeoffMetric): boolean {
  return (
    actual.baseline === expected.baseline &&
    actual.proposal === expected.proposal &&
    actual.delta === expected.delta &&
    actual.betterDirection === expected.betterDirection &&
    actual.adverse === expected.adverse
  )
}

function assertMetricBinding(
  actual: TradeoffMetric,
  expected: TradeoffMetric,
  fieldPath: string,
): void {
  if (!metricsEqual(actual, expected)) {
    throw new Error(
      `verifyTaxStrategyTradeoffsBinding: dimension metric ${fieldPath} diverges from evaluation.comparison`,
    )
  }
}

/**
 * The schema proves internal coherence; only this binding check proves the
 * tradeoffs document says what the evaluation says. Consumers rendering tradeoff
 * claims MUST call it.
 *
 * Always parses both arguments on entry (rejects unknown keys / wrong kind /
 * presentationContract). Objective labels are re-checked against
 * `objectivePolicies[policyId]`.
 *
 * Unconditional survivor minimums when `status: 'evidence'`: `firstSurvivorYear`
 * must exist in `evaluation.comparison.annual` and `filingStatusPath` must be
 * non-empty. Metric sums are re-derived from annual given the document's
 * `firstSurvivorYear`.
 *
 * Residual without optional ledger years: window authenticity and
 * evidence-to-absent downgrades ride inside the ledger-years trust boundary
 * (same boundary language as WS3's IRMAA note). When `{ baselineYears,
 * proposalYears }` is supplied, the entire survivor section is rebuilt via the
 * builder's own derivation and must match by canonical JSON.
 */
export function verifyTaxStrategyTradeoffsBinding(
  tradeoffs: TaxStrategyTradeoffs,
  evaluation: TaxStrategyEvaluation,
  years?: {
    baselineYears: readonly Readonly<YearResult>[]
    proposalYears: readonly Readonly<YearResult>[]
  },
): void {
  const parsedTradeoffs = parseTaxStrategyTradeoffs(tradeoffs)
  const parsedEvaluation = parseTaxStrategyEvaluation(evaluation)
  const expectedHash = taxStrategyEvaluationHash(parsedEvaluation)
  if (parsedTradeoffs.provenance.evaluationHash !== expectedHash) {
    throw new Error(
      'verifyTaxStrategyTradeoffsBinding: provenance.evaluationHash does not match taxStrategyEvaluationHash(evaluation)',
    )
  }

  const evalProv = parsedEvaluation.provenance
  const docProv = parsedTradeoffs.provenance
  if (
    docProv.startYear !== evalProv.startYear ||
    docProv.baselineSnapshotHash !== evalProv.baselineSnapshotHash ||
    docProv.proposalSnapshotHash !== evalProv.proposalSnapshotHash ||
    docProv.engineVersion !== evalProv.engineVersion ||
    docProv.parameterBasis.dataAsOf !== evalProv.parameterBasis.dataAsOf ||
    docProv.parameterBasis.basis !== evalProv.parameterBasis.basis ||
    docProv.parameterBasis.standInYears.length !==
      evalProv.parameterBasis.standInYears.length ||
    docProv.parameterBasis.standInYears.some(
      (year, index) => year !== evalProv.parameterBasis.standInYears[index],
    )
  ) {
    throw new Error(
      'verifyTaxStrategyTradeoffsBinding: provenance fields diverge from evaluation.provenance',
    )
  }

  const policy = objectivePolicies[parsedTradeoffs.objective.policyId]
  if (
    parsedTradeoffs.objective.policyId !== parsedEvaluation.objective.policyId ||
    parsedTradeoffs.objective.label !== parsedEvaluation.objective.label ||
    parsedTradeoffs.objective.primaryMetricLabel !==
      parsedEvaluation.objective.primaryMetricLabel ||
    parsedTradeoffs.objective.scope !== 'single-objective' ||
    parsedTradeoffs.objective.label !== policy.label ||
    parsedTradeoffs.objective.primaryMetricLabel !== policy.primaryMetricLabel
  ) {
    throw new Error(
      'verifyTaxStrategyTradeoffsBinding: objective diverges from evaluation.objective',
    )
  }

  const seenCandidateIds = new Set<string>()
  for (let index = 0; index < parsedTradeoffs.alternatives.length; index++) {
    const alternative = parsedTradeoffs.alternatives[index]!
    if (seenCandidateIds.has(alternative.candidateId)) {
      throw new Error(
        `verifyTaxStrategyTradeoffsBinding: duplicate candidateId in alternatives (candidate ${alternative.candidateId})`,
      )
    }
    seenCandidateIds.add(alternative.candidateId)
    if (index > 0) {
      const prev = parsedTradeoffs.alternatives[index - 1]!
      if (compareUtf16CodeUnits(prev.candidateId, alternative.candidateId) >= 0) {
        throw new Error(
          `verifyTaxStrategyTradeoffsBinding: alternatives out of canonical candidateId order (candidate ${alternative.candidateId})`,
        )
      }
    }
  }

  if (parsedTradeoffs.alternatives.length !== parsedEvaluation.alternatives.length) {
    throw new Error(
      'verifyTaxStrategyTradeoffsBinding: alternatives diverge from evaluation',
    )
  }

  const evaluationById = new Map(
    parsedEvaluation.alternatives.map((alternative) => [
      alternative.candidateId,
      alternative,
    ]),
  )
  const tradeoffsById = new Map(
    parsedTradeoffs.alternatives.map((alternative) => [alternative.candidateId, alternative]),
  )

  if (evaluationById.size !== tradeoffsById.size) {
    const divergentId =
      [...tradeoffsById.keys()].find((id) => !evaluationById.has(id)) ??
      [...evaluationById.keys()].find((id) => !tradeoffsById.has(id))
    throw new Error(
      `verifyTaxStrategyTradeoffsBinding: alternatives diverge from evaluation` +
        (divergentId === undefined ? '' : ` (candidate ${divergentId})`),
    )
  }

  for (const [candidateId, tradeoffsAlt] of tradeoffsById) {
    const evaluationAlt = evaluationById.get(candidateId)
    if (evaluationAlt === undefined) {
      throw new Error(
        `verifyTaxStrategyTradeoffsBinding: alternatives diverge from evaluation (candidate ${candidateId})`,
      )
    }
    if (canonicalScenarioJson(tradeoffsAlt) !== canonicalScenarioJson(evaluationAlt)) {
      throw new Error(
        `verifyTaxStrategyTradeoffsBinding: alternatives diverge from evaluation (candidate ${candidateId})`,
      )
    }
  }

  const headline = parsedEvaluation.comparison.headline
  const spending = parsedEvaluation.comparison.spending
  const irmaa = parsedEvaluation.comparison.irmaa
  const aca = parsedEvaluation.comparison.aca
  const estate = parsedEvaluation.comparison.estate
  const risk = parsedEvaluation.comparison.risk
  const spendingCapacity = parsedEvaluation.comparison.spendingCapacity
  const dims = parsedTradeoffs.dimensions

  assertMetricBinding(
    dims.lifetimeTax.lifetimeTaxesAndPenalties,
    metricFromRequired(headline.lifetimeTaxesAndPenalties, 'lower'),
    'lifetimeTax.lifetimeTaxesAndPenalties',
  )
  assertMetricBinding(
    dims.lifetimeTax.lifetimeTax,
    metricFromRequired(headline.lifetimeTax, 'lower'),
    'lifetimeTax.lifetimeTax',
  )
  assertMetricBinding(
    dims.lifetimeTax.lifetimePenalties,
    metricFromRequired(headline.lifetimePenalties, 'lower'),
    'lifetimeTax.lifetimePenalties',
  )
  assertMetricBinding(
    dims.lifetimeTax.depletionYear,
    metricFromComparison(headline.depletionYear, 'higher'),
    'lifetimeTax.depletionYear',
  )
  assertMetricBinding(
    dims.lifetimeTax.projectionEndYear,
    metricFromRequired(headline.projectionEndYear, 'contextual'),
    'lifetimeTax.projectionEndYear',
  )

  assertMetricBinding(
    dims.afterTaxSpending.funded,
    metricFromRequired(spending.funded, 'higher'),
    'afterTaxSpending.funded',
  )
  assertMetricBinding(
    dims.afterTaxSpending.intended,
    metricFromRequired(spending.intended, 'contextual'),
    'afterTaxSpending.intended',
  )
  assertMetricBinding(
    dims.afterTaxSpending.totalShortfall,
    metricFromRequired(spending.totalShortfall, 'lower'),
    'afterTaxSpending.totalShortfall',
  )
  assertMetricBinding(
    dims.afterTaxSpending.requiredShortfall,
    metricFromRequired(spending.requiredShortfall, 'lower'),
    'afterTaxSpending.requiredShortfall',
  )
  assertMetricBinding(
    dims.afterTaxSpending.targetShortfall,
    metricFromRequired(spending.targetShortfall, 'lower'),
    'afterTaxSpending.targetShortfall',
  )

  if (spendingCapacity === null) {
    if (dims.afterTaxSpending.capacity !== null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric afterTaxSpending.capacity diverges from evaluation.comparison',
      )
    }
  } else {
    if (dims.afterTaxSpending.capacity === null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric afterTaxSpending.capacity diverges from evaluation.comparison',
      )
    }
    assertMetricBinding(
      dims.afterTaxSpending.capacity.maxBaseAnnual,
      metricFromComparison(spendingCapacity.maxBaseAnnual, 'higher'),
      'afterTaxSpending.capacity.maxBaseAnnual',
    )
    assertMetricBinding(
      dims.afterTaxSpending.capacity.spendingSlack,
      metricFromComparison(spendingCapacity.spendingSlack, 'higher'),
      'afterTaxSpending.capacity.spendingSlack',
    )
  }

  assertMetricBinding(
    dims.medicareIrmaa.surcharge,
    metricFromRequired(irmaa.surcharge, 'lower'),
    'medicareIrmaa.surcharge',
  )
  assertMetricBinding(
    dims.medicareIrmaa.totalMedicarePremiums,
    metricFromRequired(irmaa.totalMedicarePremiums, 'lower'),
    'medicareIrmaa.totalMedicarePremiums',
  )
  assertMetricBinding(
    dims.medicareIrmaa.surchargeTierYears,
    metricFromRequired(irmaa.surchargeTierYears, 'lower'),
    'medicareIrmaa.surchargeTierYears',
  )
  assertMetricBinding(
    dims.medicareIrmaa.maxTier,
    metricFromRequired(irmaa.maxTier, 'lower'),
    'medicareIrmaa.maxTier',
  )

  assertMetricBinding(
    dims.acaPremiumTaxCredit.grossEnrollmentPremium,
    metricFromRequired(aca.grossEnrollmentPremium, 'contextual'),
    'acaPremiumTaxCredit.grossEnrollmentPremium',
  )
  assertMetricBinding(
    dims.acaPremiumTaxCredit.modeledAllowablePtc,
    metricFromRequired(aca.modeledAllowablePtc, 'higher'),
    'acaPremiumTaxCredit.modeledAllowablePtc',
  )
  assertMetricBinding(
    dims.acaPremiumTaxCredit.economicNetPremium,
    metricFromRequired(aca.economicNetPremium, 'lower'),
    'acaPremiumTaxCredit.economicNetPremium',
  )
  assertMetricBinding(
    dims.acaPremiumTaxCredit.actionableYears,
    metricFromRequired(aca.actionableYears, 'contextual'),
    'acaPremiumTaxCredit.actionableYears',
  )
  assertMetricBinding(
    dims.acaPremiumTaxCredit.nonActionableYears,
    metricFromRequired(aca.nonActionableYears, 'contextual'),
    'acaPremiumTaxCredit.nonActionableYears',
  )

  if (risk === null) {
    if (dims.successAdjustments !== null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric successAdjustments diverges from evaluation.comparison',
      )
    }
    if (dims.estate.percentiles !== null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric estate.percentiles diverges from evaluation.comparison',
      )
    }
  } else {
    if (dims.successAdjustments === null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric successAdjustments diverges from evaluation.comparison',
      )
    }
    assertMetricBinding(
      dims.successAdjustments.successRate,
      metricFromRequired(risk.successRate, 'higher'),
      'successAdjustments.successRate',
    )
    assertMetricBinding(
      dims.successAdjustments.requiredFloorSuccessRate,
      metricFromRequired(risk.requiredFloorSuccessRate, 'higher'),
      'successAdjustments.requiredFloorSuccessRate',
    )
    assertMetricBinding(
      dims.successAdjustments.targetLifestyleSuccessRate,
      metricFromRequired(risk.targetLifestyleSuccessRate, 'higher'),
      'successAdjustments.targetLifestyleSuccessRate',
    )
    assertMetricBinding(
      dims.successAdjustments.probabilityOfAdjustment,
      metricFromRequired(risk.probabilityOfAdjustment, 'lower'),
      'successAdjustments.probabilityOfAdjustment',
    )
    assertMetricBinding(
      dims.successAdjustments.medianMaxCutDepth,
      metricFromRequired(risk.medianMaxCutDepth, 'lower'),
      'successAdjustments.medianMaxCutDepth',
    )
    assertMetricBinding(
      dims.successAdjustments.p90MaxCutDepth,
      metricFromRequired(risk.p90MaxCutDepth, 'lower'),
      'successAdjustments.p90MaxCutDepth',
    )
    assertMetricBinding(
      dims.successAdjustments.expectedShortfallDollars,
      metricFromRequired(risk.expectedShortfallDollars, 'lower'),
      'successAdjustments.expectedShortfallDollars',
    )
    if (dims.estate.percentiles === null) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: dimension metric estate.percentiles diverges from evaluation.comparison',
      )
    }
    assertMetricBinding(
      dims.estate.percentiles.estateP10,
      metricFromRequired(risk.estateP10, 'higher'),
      'estate.percentiles.estateP10',
    )
    assertMetricBinding(
      dims.estate.percentiles.estateP50,
      metricFromRequired(risk.estateP50, 'higher'),
      'estate.percentiles.estateP50',
    )
    assertMetricBinding(
      dims.estate.percentiles.estateP90,
      metricFromRequired(risk.estateP90, 'higher'),
      'estate.percentiles.estateP90',
    )
  }

  assertMetricBinding(
    dims.estate.afterTaxEstate,
    metricFromRequired(estate.afterTaxEstate, 'higher'),
    'estate.afterTaxEstate',
  )
  assertMetricBinding(
    dims.estate.grossNetWorth,
    metricFromRequired(estate.grossNetWorth, 'higher'),
    'estate.grossNetWorth',
  )
  assertMetricBinding(
    dims.estate.heirTax,
    metricFromRequired(estate.heirTax, 'lower'),
    'estate.heirTax',
  )
  assertMetricBinding(
    dims.estate.charity,
    metricFromRequired(estate.charity, 'contextual'),
    'estate.charity',
  )

  if (dims.survivor.status === 'evidence') {
    const first = dims.survivor.firstSurvivorYear
    if (!parsedEvaluation.comparison.annual.some((row) => row.year === first)) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: survivor.firstSurvivorYear is not present in evaluation.comparison.annual',
      )
    }
    if (dims.survivor.filingStatusPath.length === 0) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: survivor.filingStatusPath must be non-empty when status is evidence',
      )
    }
    assertMetricBinding(
      dims.survivor.tax,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'tax', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'tax', 'proposal'),
        'lower',
      ),
      'survivor.tax',
    )
    assertMetricBinding(
      dims.survivor.spendingFunded,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'spendingFunded', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'spendingFunded', 'proposal'),
        'higher',
      ),
      'survivor.spendingFunded',
    )
    assertMetricBinding(
      dims.survivor.spendingShortfall,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'shortfall', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'shortfall', 'proposal'),
        'lower',
      ),
      'survivor.spendingShortfall',
    )
    assertMetricBinding(
      dims.survivor.requiredShortfall,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'requiredShortfall', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'requiredShortfall', 'proposal'),
        'lower',
      ),
      'survivor.requiredShortfall',
    )
    assertMetricBinding(
      dims.survivor.irmaaSurcharge,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'irmaaSurcharge', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'irmaaSurcharge', 'proposal'),
        'lower',
      ),
      'survivor.irmaaSurcharge',
    )
    assertMetricBinding(
      dims.survivor.magi,
      survivorMetricFromSums(
        sumAnnualSide(parsedEvaluation, first, 'magi', 'baseline'),
        sumAnnualSide(parsedEvaluation, first, 'magi', 'proposal'),
        'contextual',
      ),
      'survivor.magi',
    )
  }

  if (years !== undefined) {
    let expectedSurvivor: z.infer<typeof survivorSchema>
    try {
      expectedSurvivor = buildSurvivorDimension(
        parsedEvaluation,
        years.baselineYears,
        years.proposalYears,
      )
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(
        `verifyTaxStrategyTradeoffsBinding: ${originalMessage}`,
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    if (
      canonicalScenarioJson(dims.survivor) !== canonicalScenarioJson(expectedSurvivor)
    ) {
      throw new Error(
        'verifyTaxStrategyTradeoffsBinding: survivor section diverges from derivation from supplied ledger years',
      )
    }
  }
}

export function parseTaxStrategyTradeoffs(value: unknown): TaxStrategyTradeoffs {
  return taxStrategyTradeoffsSchema.parse(value) as TaxStrategyTradeoffs
}

export function isTaxStrategyTradeoffsDocument(
  value: unknown,
): value is TaxStrategyTradeoffs {
  return taxStrategyTradeoffsSchema.safeParse(value).success
}

/** Stable canonical text via the shared scenario JSON normalizer (sorted keys). */
export function canonicalTaxStrategyTradeoffsJson(
  tradeoffs: TaxStrategyTradeoffs,
): string {
  return canonicalScenarioJson(tradeoffs)
}

/**
 * Local FNV-1a 64-bit fingerprint of the canonical tradeoffs JSON.
 * Mirrors `taxStrategyEvaluationHash` without importing its private hash loop.
 */
export function taxStrategyTradeoffsHash(tradeoffs: TaxStrategyTradeoffs): string {
  const canonical = canonicalTaxStrategyTradeoffsJson(tradeoffs)
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
