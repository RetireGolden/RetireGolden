/**
 * TaxOpportunityView — year-indexed evidence surface for the Advisor tax
 * implementation cockpit (WS3).
 *
 * Role: reorganize a `TaxStrategyEvaluation` plus the proposal-side ledger
 * years that evaluation's comparison was built from into per-year rows that
 * expose bracket headroom, IRMAA lookback distance, ACA state, and RMD
 * pressure — without inventing rankings, scores, or recommendations.
 *
 * No forked arithmetic: every dollar figure is copied from the evaluation's
 * held comparison, from a published `YearResult` field, or from a call to the
 * one canonical calculator `computeFederalTax`. Bracket ceilings come from
 * `indexFederalTaxPack` on the year's pack; IRMAA next-tier thresholds are
 * the simulator-published `irmaaNextTierThreshold` (never reconstructed from
 * `inflationScale`). The $1,000 federal-income-tax marginal probe is the sole
 * incremental `computeFederalTax` call, and it is a named constant because it
 * captures SS phase-in / stacking effects a statutory ordinary rate cannot —
 * it deliberately excludes IRMAA surcharge, ACA PTC, and state/local tax
 * (see bracket.excludes).
 *
 * Decision-support boundary: there is deliberately no rank, score, priority,
 * or recommendation field anywhere in this schema. The view lists evidence;
 * ranking opportunities is out of scope.
 *
 * Fail-closed: absent advisory / IRMAA lookback-or-next-tier / ACA evidence
 * yields null sections (never approximated). Action readiness/outcome/reasons/
 * amounts are copied verbatim from the evaluation and never upgraded. Plan-wide
 * `limitations` are copied verbatim. Unknown action kinds (DAF/NUA) cannot
 * enter — the closed union mirrors WS2.
 */

import { z } from 'zod'

import { compareUtf16CodeUnits } from '../actions/structuralId.js'
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
import {
  retirementActionKindSchema,
} from '../actions/contract.js'
import {
  indexFederalTaxPack,
  packForYear,
} from '../params/index.js'
import {
  taxParameterFilingStatus,
  type YearResult,
} from '../projection/types.js'
import { computeFederalTax } from '../tax/federalTax.js'
import { canonicalScenarioJson } from './patch.js'
import {
  parseTaxStrategyEvaluation,
  taxStrategyEvaluationHash,
  taxStrategyLimitationRefSchema,
  type TaxStrategyEvaluation,
  type TaxStrategyEvaluationAction,
} from './taxStrategyEvaluation.js'

export const TAX_OPPORTUNITY_VIEW_KIND = 'retiregolden.tax-opportunity-view' as const
export const CURRENT_TAX_OPPORTUNITY_VIEW_VERSION = 1 as const

/**
 * Dollar probe for federal-income-tax marginal rate. Captures Social Security
 * taxation phase-in and stacking effects a statutory ordinary bracket rate
 * cannot. The resulting `federalIncomeTaxMarginalRatePct` excludes IRMAA
 * surcharge, ACA premium tax credit, and state/local tax — see
 * `bracket.excludes` and the cliff fields on `irmaa` / `aca`.
 */
export const EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS = 1_000 as const

const nullableFiniteNumberSchema = z.number().finite().nullable()
const finiteNumberSchema = z.number().finite()

/**
 * Fixed disclosure tuple riding beside `federalIncomeTaxMarginalRatePct`.
 * Always present when bracket is non-null so a consumer cannot read the rate
 * without the exclusion list. Do not mint a tax-rule-registry record for this.
 */
const bracketMarginalRateExcludesSchema = z.tuple([
  z.literal('irmaaSurcharge'),
  z.literal('acaPremiumTaxCredit'),
  z.literal('stateAndLocalTax'),
])

const taxOpportunityYearLedgerSchema = z.strictObject({
  tax: nullableFiniteNumberSchema,
  magi: nullableFiniteNumberSchema,
  irmaaTier: nullableFiniteNumberSchema,
  irmaaSurcharge: nullableFiniteNumberSchema,
  rmd: nullableFiniteNumberSchema,
  qcd: nullableFiniteNumberSchema,
  rothConversion: nullableFiniteNumberSchema,
  traditionalWithdrawals: nullableFiniteNumberSchema,
  withdrawals: nullableFiniteNumberSchema,
  inheritedRequired: nullableFiniteNumberSchema,
  taxExemptInterest: nullableFiniteNumberSchema,
  acaGrossEnrollmentPremium: nullableFiniteNumberSchema,
  acaModeledAllowablePtc: nullableFiniteNumberSchema,
  acaEconomicNetPremium: nullableFiniteNumberSchema,
})

const taxOpportunityBracketSchema = z
  .strictObject({
    taxableIncome: finiteNumberSchema,
    ordinaryTaxable: finiteNumberSchema,
    statutoryRatePct: finiteNumberSchema,
    bracketCeiling: nullableFiniteNumberSchema,
    /**
     * Taxable-income space remaining to the next ordinary bracket lowerBound
     * (post-deduction), NOT conversion-dollar space. Under the §151(d)(5)
     * senior-deduction phase-out an extra conversion dollar can raise taxable
     * income by more than a dollar, so sizing a conversion at this figure
     * overshoots. Use `federalIncomeTaxMarginalRatePct` (vs statutory) as the
     * tell that phase-outs / SS stacking are in play.
     */
    ordinarySpaceRemaining: nullableFiniteNumberSchema,
    /**
     * Federal income tax only: `(Δ computeFederalTax.totalTax) / $1,000 × 100`
     * from the named probe. Excludes IRMAA surcharge, ACA premium tax credit,
     * and state/local tax — see `excludes`. For those cliffs read
     * `irmaa.distanceToNextTier` and `aca.cliffState`.
     */
    federalIncomeTaxMarginalRatePct: finiteNumberSchema,
    /**
     * Machine-readable exclusion list for `federalIncomeTaxMarginalRatePct`.
     * Fixed tuple; always present when bracket is non-null.
     */
    excludes: bracketMarginalRateExcludesSchema,
    zeroRateLtcgHeadroom: finiteNumberSchema,
  })
  .nullable()

/**
 * IRMAA lookback evidence. Consumers MUST treat `source: 'planFallback'` as
 * non-evidence for implementation claims — it is the coarse
 * `recentAnnualMagi` stand-in (often 0), not a realized MAGI history entry.
 */
const taxOpportunityIrmaaSchema = z
  .strictObject({
    lookbackMagi: finiteNumberSchema,
    /**
     * Which fallback arm supplied the selected lookback MAGI.
     * `'planFallback'` is non-evidence for implementation claims.
     */
    source: z.enum(['projected', 'historicalInput', 'planFallback']),
    /** Calendar year whose MAGI was selected (SSA-44: year of the minimum). */
    lookbackYear: z.number().int().min(1).max(9999),
    tier: finiteNumberSchema,
    nextTierThreshold: nullableFiniteNumberSchema,
    distanceToNextTier: nullableFiniteNumberSchema,
  })
  .nullable()

const taxOpportunityAcaSchema = z
  .strictObject({
    readiness: z.enum(['actionable', 'nonActionable']),
    cliffState: z.enum([
      'below-eligibility-floor',
      'below-cliff',
      'at-cliff',
      'above-cliff',
      'unsupported',
    ]),
    householdMagi: nullableFiniteNumberSchema,
    fplPct: nullableFiniteNumberSchema,
    modeledAllowablePtc: nullableFiniteNumberSchema,
    economicNetPremium: finiteNumberSchema,
  })
  .nullable()

const taxOpportunityRmdPressureSchema = z.strictObject({
  required: nullableFiniteNumberSchema,
  inheritedRequired: nullableFiniteNumberSchema,
  traditionalWithdrawals: nullableFiniteNumberSchema,
  qcd: nullableFiniteNumberSchema,
})

const taxOpportunityYearRowSchema = z.strictObject({
  year: z.number().int().min(1).max(9999),
  ledger: taxOpportunityYearLedgerSchema,
  bracket: taxOpportunityBracketSchema,
  irmaa: taxOpportunityIrmaaSchema,
  aca: taxOpportunityAcaSchema,
  rmdPressure: taxOpportunityRmdPressureSchema,
})

/*
 * Action-row schema + refinements mirrored from
 * `taxStrategyEvaluationActionSchema` in taxStrategyEvaluation.ts (WS2). The
 * helpers there are module-private; replicate the readiness/outcome/amount
 * invariants rather than re-deriving different rules.
 */
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

const ADJUSTED_REASON_CANONICAL_ORDER = [
  'qcd-person-limit-trimmed',
  'qcd-contribution-offset-applied',
  'qcd-taxable-amount-trimmed',
] as const

function validateAdjustedReasonOrder(
  reasons: ReadonlyArray<{ code: string; outcome: string }>,
  startIndex: number,
  ctx: z.RefinementCtx,
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
        path: ['reasons', index],
        message: 'QCD adjustment reasons may appear at most once',
      })
    } else if (order < previousOrder) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasons', index],
        message: 'QCD adjustment reasons must use canonical order',
      })
    }
    seen.add(reason.code)
    previousOrder = Math.max(previousOrder, order)
  })
}

function refineDispositionAmounts(
  amounts: {
    requestedAmountCents: number
    executedAmountCents: number
    unexecutedAmountCents: number
    outcome: 'executed' | 'partial' | 'refused' | 'unsupported'
  },
  ctx: z.RefinementCtx,
): void {
  if (
    BigInt(amounts.executedAmountCents) + BigInt(amounts.unexecutedAmountCents) !==
    BigInt(amounts.requestedAmountCents)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['unexecutedAmountCents'],
      message: 'Executed and unexecuted cents must exactly conserve the requested amount',
    })
  }
  if (amounts.outcome === 'executed') {
    if (amounts.executedAmountCents !== amounts.requestedAmountCents) {
      ctx.addIssue({
        code: 'custom',
        path: ['executedAmountCents'],
        message: 'An executed action must move the full requested amount',
      })
    }
    if (amounts.unexecutedAmountCents !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['unexecutedAmountCents'],
        message: 'An executed action cannot leave an unexecuted remainder',
      })
    }
    return
  }
  if (amounts.outcome === 'partial') {
    if (amounts.executedAmountCents === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['executedAmountCents'],
        message: 'A partial action must move a positive amount',
      })
    }
    if (amounts.unexecutedAmountCents === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['unexecutedAmountCents'],
        message: 'A partial action must leave a positive remainder',
      })
    }
  }
}

const taxOpportunityActionRowSchema = z
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
    // Mirrored from taxStrategyEvaluationActionSchema (WS2).
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
      action.reasons.forEach((reason, index) => {
        if (reason.outcome !== 'adjusted') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'Executed actions may contain only adjusted reasons',
          })
        }
      })
      validateAdjustedReasonOrder(action.reasons, 0, ctx)
    } else if (action.outcome === 'partial') {
      if (action.reasons.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons'],
          message: 'A partial action requires a physical trim reason first',
        })
      } else if (action.reasons[0]?.outcome !== 'partial') {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons', 0],
          message: 'The first partial-action reason must be a physical trim',
        })
      }
      action.reasons.slice(1).forEach((reason, index) => {
        if (reason.outcome !== 'adjusted') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index + 1],
            message: 'Reasons after a physical trim may only be adjustments',
          })
        }
      })
      validateAdjustedReasonOrder(action.reasons, 1, ctx)
    } else if (action.outcome === 'refused') {
      action.reasons.forEach((reason, index) => {
        if (reason.outcome !== 'refused') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index],
            message: 'Refused actions may contain only refused reasons',
          })
        }
      })
    } else if (action.outcome === 'unsupported') {
      if (action.reasons[0]?.outcome !== 'unsupported') {
        ctx.addIssue({
          code: 'custom',
          path: ['reasons', 0],
          message: 'The first unsupported-action reason must be unsupported',
        })
      }
      action.reasons.slice(1).forEach((reason, index) => {
        if (reason.outcome !== 'unsupported' && reason.outcome !== 'refused') {
          ctx.addIssue({
            code: 'custom',
            path: ['reasons', index + 1],
            message: 'Unsupported actions may retain only unsupported or refused reasons',
          })
        }
      })
    }

    const requestedTotal = action.sourceAllocations.reduce(
      (sum, allocation) => sum + BigInt(allocation.requestedAmountCents),
      0n,
    )
    if (requestedTotal !== BigInt(action.requestedAmountCents)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceAllocations'],
        message: 'allocation requested cents must exactly sum to the action requested amount',
      })
    }

    let executedAllocationTotal = 0n
    const allocationIds = new Set<string>()
    const sourceAccountIds = new Set<string>()
    action.sourceAllocations.forEach((allocation, index) => {
      executedAllocationTotal += BigInt(allocation.executedAmountCents)
      if (allocationIds.has(allocation.allocationId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceAllocations', index, 'allocationId'],
          message: `duplicate allocation id "${allocation.allocationId}"`,
        })
      } else {
        allocationIds.add(allocation.allocationId)
      }
      if (sourceAccountIds.has(allocation.sourceAccountId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceAllocations', index, 'sourceAccountId'],
          message: `duplicate source account id "${allocation.sourceAccountId}"`,
        })
      } else {
        sourceAccountIds.add(allocation.sourceAccountId)
      }
      if (allocation.resolution === 'unresolved' && allocation.executedAmountCents !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceAllocations', index, 'executedAmountCents'],
          message: 'An unresolved allocation cannot move money (executedAmountCents must be 0)',
        })
      }
      if (action.readiness === 'actionable' && allocation.resolution !== 'resolved') {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceAllocations', index, 'resolution'],
          message: "an actionable action requires every sourceAllocation resolution 'resolved'",
        })
      }
    })
    if (executedAllocationTotal !== BigInt(action.executedAmountCents)) {
      ctx.addIssue({
        code: 'custom',
        path: ['executedAmountCents'],
        message: 'Source allocation executed cents must sum to the action executedAmountCents',
      })
    }

    if (action.personId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['personId'],
        message: 'retirement actions require a non-null personId',
      })
    }
    if (action.kind === 'ordinaryWithdrawal') {
      if (action.destinationAccountId !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'ordinaryWithdrawal actions require a null destinationAccountId',
        })
      }
      if (action.charityDesignationId !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['charityDesignationId'],
          message: 'ordinaryWithdrawal actions require a null charityDesignationId',
        })
      }
    } else if (action.kind === 'rothConversion') {
      if (action.destinationAccountId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'rothConversion actions require a non-null destinationAccountId',
        })
      } else if (
        action.sourceAllocations.some(
          (allocation) => allocation.sourceAccountId === action.destinationAccountId,
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'conversion destination aliases a source account',
        })
      }
      if (action.charityDesignationId !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['charityDesignationId'],
          message: 'rothConversion actions require a null charityDesignationId',
        })
      }
    } else {
      if (action.destinationAccountId !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'qcd actions require a null destinationAccountId',
        })
      }
      if (action.charityDesignationId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['charityDesignationId'],
          message: 'qcd actions require a non-null charityDesignationId',
        })
      }
      if (action.sourceAllocations.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceAllocations'],
          message: 'qcd actions require exactly one source allocation',
        })
      }
    }
  })

const viewProvenanceSchema = z.strictObject({
  startYear: z.number().int(),
  baselineSnapshotHash: z.string().min(1),
  proposalSnapshotHash: z.string().min(1),
  engineVersion: z.string().min(1),
  parameterBasis: z.strictObject({
    dataAsOf: z.string().min(1),
    basis: z.string().min(1),
    standInYears: z.array(z.number().int()),
  }),
  evaluationHash: z.string().min(1),
})

export const taxOpportunityViewSchema = z
  .strictObject({
    kind: z.literal(TAX_OPPORTUNITY_VIEW_KIND),
    version: z.literal(CURRENT_TAX_OPPORTUNITY_VIEW_VERSION),
    provenance: viewProvenanceSchema,
    years: z.array(taxOpportunityYearRowSchema),
    actions: z.array(taxOpportunityActionRowSchema),
    /** Plan-wide evaluation limitations, copied verbatim (independent of per-action). */
    limitations: z.array(taxStrategyLimitationRefSchema),
  })
  .superRefine((view, ctx) => {
    const yearSet = new Set(view.years.map((row) => row.year))
    if (yearSet.size !== view.years.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['years'],
        message: 'years must contain unique calendar years',
      })
    }
    for (let i = 1; i < view.years.length; i++) {
      if (view.years[i]!.year < view.years[i - 1]!.year) {
        ctx.addIssue({
          code: 'custom',
          path: ['years', i, 'year'],
          message: 'years must be in ascending calendar order',
        })
        break
      }
    }
    const seenActionIds = new Set<string>()
    view.actions.forEach((action, index) => {
      if (!yearSet.has(action.year)) {
        ctx.addIssue({
          code: 'custom',
          path: ['actions', index, 'year'],
          message: `action year ${action.year} is not present in years`,
        })
      }
      if (seenActionIds.has(action.actionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['actions', index, 'actionId'],
          message: `duplicate actionId "${action.actionId}"`,
        })
      } else {
        seenActionIds.add(action.actionId)
      }
      if (index > 0) {
        const prev = view.actions[index - 1]!
        const ordered =
          prev.year < action.year ||
          (prev.year === action.year &&
            compareUtf16CodeUnits(prev.actionId, action.actionId) < 0)
        if (!ordered) {
          ctx.addIssue({
            code: 'custom',
            path: ['actions', index],
            message:
              'actions must be in ascending (year, actionId) order by UTF-16 code-unit compare',
          })
        }
      }
    })
  })

export type TaxOpportunityYearLedger = z.infer<typeof taxOpportunityYearLedgerSchema>
export type TaxOpportunityYearRow = z.infer<typeof taxOpportunityYearRowSchema>
export type TaxOpportunityActionRow = z.infer<typeof taxOpportunityActionRowSchema>
export type TaxOpportunityView = z.infer<typeof taxOpportunityViewSchema>

export interface BuildTaxOpportunityViewInput {
  evaluation: TaxStrategyEvaluation
  /** Proposal-side ledger years the evaluation's comparison was built from. */
  proposalYears: readonly Readonly<YearResult>[]
}

/** Schema-inferred limitation (`ruleId: string`); not the hand-written `TaxStrategyLimitationRef` (`ruleId: TaxRuleId`). */
function copyLimitation(
  limitation: z.infer<typeof taxStrategyLimitationRefSchema>,
): z.infer<typeof taxStrategyLimitationRefSchema> {
  return {
    ruleId: limitation.ruleId,
    classification: limitation.classification,
    errorDirection: limitation.errorDirection,
    note: limitation.note,
  }
}

function copyActionRow(action: TaxStrategyEvaluationAction): TaxOpportunityActionRow {
  return {
    actionId: action.actionId,
    kind: action.kind,
    year: action.year,
    personId: action.personId,
    destinationAccountId: action.destinationAccountId,
    charityDesignationId: action.charityDesignationId,
    requestedAmountCents: action.requestedAmountCents,
    executedAmountCents: action.executedAmountCents,
    unexecutedAmountCents: action.unexecutedAmountCents,
    readiness: action.readiness,
    outcome: action.outcome,
    sourceAllocations: action.sourceAllocations.map((allocation) => ({ ...allocation })),
    reasons: action.reasons.map((reason) => ({ ...reason })),
    limitations: action.limitations.map(copyLimitation),
  }
}

function deepFreezeActionRow(row: TaxOpportunityActionRow): Readonly<TaxOpportunityActionRow> {
  for (const allocation of row.sourceAllocations) Object.freeze(allocation)
  for (const reason of row.reasons) Object.freeze(reason)
  for (const limitation of row.limitations) Object.freeze(limitation)
  Object.freeze(row.sourceAllocations)
  Object.freeze(row.reasons)
  Object.freeze(row.limitations)
  return Object.freeze(row)
}

function deepFreezeYearRow(row: TaxOpportunityYearRow): Readonly<TaxOpportunityYearRow> {
  Object.freeze(row.ledger)
  if (row.bracket !== null) {
    Object.freeze(row.bracket.excludes)
    Object.freeze(row.bracket)
  }
  if (row.irmaa !== null) Object.freeze(row.irmaa)
  if (row.aca !== null) Object.freeze(row.aca)
  Object.freeze(row.rmdPressure)
  return Object.freeze(row)
}

/**
 * Deep-freeze the post-parse document. Zod parse constructs new plain objects,
 * so any freeze applied to the draft is discarded — freeze the parsed result.
 */
function deepFreezeTaxOpportunityView(view: TaxOpportunityView): TaxOpportunityView {
  for (const year of view.years) deepFreezeYearRow(year)
  for (const action of view.actions) deepFreezeActionRow(action)
  for (const limitation of view.limitations) Object.freeze(limitation)
  Object.freeze(view.years)
  Object.freeze(view.actions)
  Object.freeze(view.limitations)
  Object.freeze(view.provenance.parameterBasis.standInYears)
  Object.freeze(view.provenance.parameterBasis)
  Object.freeze(view.provenance)
  return Object.freeze(view)
}

function yearResultAcaFigure(
  yearResult: Readonly<YearResult>,
  field: 'grossEnrollmentPremium' | 'modeledAllowablePtc' | 'economicNetPremium',
): number {
  const aca = yearResult.aca
  if (aca === undefined) return 0
  return aca[field] ?? 0
}

function isBaselineOnlyAnnualRow(
  row: TaxStrategyEvaluation['comparison']['annual'][number],
): boolean {
  return Object.values(row.values).every((comparison) => comparison.proposal === null)
}

function bindProposalYears(
  evaluation: TaxStrategyEvaluation,
  proposalYears: readonly Readonly<YearResult>[],
): Map<number, Readonly<YearResult>> {
  const annual = evaluation.comparison.annual
  const annualYearSet = new Set(annual.map((row) => row.year))
  const byYear = new Map<number, Readonly<YearResult>>()
  for (const yearResult of proposalYears) {
    if (byYear.has(yearResult.year)) {
      throw new Error(
        `buildTaxOpportunityView: duplicate proposal year ${yearResult.year}`,
      )
    }
    byYear.set(yearResult.year, yearResult)
  }
  for (const year of byYear.keys()) {
    if (!annualYearSet.has(year)) {
      throw new Error(
        'buildTaxOpportunityView: proposalYears must cover every comparison.annual year exactly once',
      )
    }
  }
  for (const row of annual) {
    if (isBaselineOnlyAnnualRow(row)) {
      continue
    }
    const yearResult = byYear.get(row.year)
    if (yearResult === undefined) {
      throw new Error(
        `buildTaxOpportunityView: proposalYears missing comparison year ${row.year}`,
      )
    }
    if (yearResult.magi !== row.values.magi.proposal) {
      throw new Error(
        `buildTaxOpportunityView: proposal year ${row.year} magi does not match comparison`,
      )
    }
    if (yearResult.tax !== row.values.tax.proposal) {
      throw new Error(
        `buildTaxOpportunityView: proposal year ${row.year} tax does not match comparison`,
      )
    }
    if (yearResult.irmaaTier !== row.values.irmaaTier.proposal) {
      throw new Error(
        `buildTaxOpportunityView: proposal year ${row.year} irmaaTier does not match comparison`,
      )
    }
    if (yearResult.irmaaSurcharge !== row.values.irmaaSurcharge.proposal) {
      throw new Error(
        `buildTaxOpportunityView: proposal year ${row.year} irmaaSurcharge does not match comparison`,
      )
    }
    const acaChecks: Array<{
      field: 'acaGrossEnrollmentPremium' | 'acaModeledAllowablePtc' | 'acaEconomicNetPremium'
      proposal: number | null
      actual: number
    }> = [
      {
        field: 'acaGrossEnrollmentPremium',
        proposal: row.values.acaGrossEnrollmentPremium.proposal,
        actual: yearResultAcaFigure(yearResult, 'grossEnrollmentPremium'),
      },
      {
        field: 'acaModeledAllowablePtc',
        proposal: row.values.acaModeledAllowablePtc.proposal,
        actual: yearResultAcaFigure(yearResult, 'modeledAllowablePtc'),
      },
      {
        field: 'acaEconomicNetPremium',
        proposal: row.values.acaEconomicNetPremium.proposal,
        actual: yearResultAcaFigure(yearResult, 'economicNetPremium'),
      },
    ]
    for (const check of acaChecks) {
      if (check.proposal !== null && check.actual !== check.proposal) {
        throw new Error(
          `buildTaxOpportunityView: proposal year ${row.year} ${check.field} does not match comparison`,
        )
      }
    }
  }
  return byYear
}

function buildBracketSection(
  yearResult: Readonly<YearResult>,
): TaxOpportunityYearRow['bracket'] {
  const advisory = yearResult.advisoryFederalTax
  if (advisory === undefined) return null

  if (advisory.input.year !== yearResult.year) {
    throw new Error(
      `buildTaxOpportunityView: advisoryFederalTax year ${advisory.input.year} does not match YearResult year ${yearResult.year}`,
    )
  }
  if (advisory.input.filingStatus !== yearResult.filingStatus) {
    throw new Error(
      `buildTaxOpportunityView: advisoryFederalTax filingStatus does not match YearResult for year ${yearResult.year}`,
    )
  }
  if (advisory.detail.zeroRateLtcgHeadroom !== yearResult.ltcgZeroHeadroom) {
    throw new Error(
      `buildTaxOpportunityView: advisoryFederalTax zeroRateLtcgHeadroom does not match YearResult for year ${yearResult.year}`,
    )
  }
  if (advisory.detail.alternativeMinimumTax !== yearResult.amt) {
    throw new Error(
      `buildTaxOpportunityView: advisoryFederalTax alternativeMinimumTax does not match YearResult amt for year ${yearResult.year}`,
    )
  }

  const recomputed = computeFederalTax(advisory.input)
  if (canonicalScenarioJson(recomputed) !== canonicalScenarioJson(advisory.detail)) {
    throw new Error(
      `buildTaxOpportunityView: advisoryFederalTax detail drifted for year ${yearResult.year}`,
    )
  }

  const { detail, input } = advisory
  const inflationScale = input.inflationScale ?? 1
  const { pack } = packForYear(yearResult.year)
  const taxStatus = taxParameterFilingStatus(input.filingStatus)
  const brackets = indexFederalTaxPack(pack, inflationScale).federalTax.brackets[taxStatus]

  let currentIndex = 0
  for (let i = 0; i < brackets.length; i++) {
    if (brackets[i]!.lowerBound <= detail.ordinaryTaxable) currentIndex = i
    else break
  }
  const current = brackets[currentIndex]!
  const next = brackets[currentIndex + 1]
  const bracketCeiling = next === undefined ? null : next.lowerBound
  // Taxable-income space (post-deduction), not conversion-dollar space — see
  // schema docblock on ordinarySpaceRemaining / §151(d)(5) phase-outs.
  const ordinarySpaceRemaining =
    bracketCeiling === null ? null : bracketCeiling - detail.ordinaryTaxable

  const probed = computeFederalTax({
    ...input,
    ordinaryIncome: input.ordinaryIncome + EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS,
  })
  // Federal income tax only — excludes IRMAA / ACA PTC / SALT (see `excludes`).
  const federalIncomeTaxMarginalRatePct =
    ((probed.totalTax - detail.totalTax) / EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS) * 100

  return {
    taxableIncome: detail.taxableIncome,
    ordinaryTaxable: detail.ordinaryTaxable,
    statutoryRatePct: current.ratePct,
    bracketCeiling,
    ordinarySpaceRemaining,
    federalIncomeTaxMarginalRatePct,
    excludes: ['irmaaSurcharge', 'acaPremiumTaxCredit', 'stateAndLocalTax'] as const,
    zeroRateLtcgHeadroom: detail.zeroRateLtcgHeadroom,
  }
}

function buildIrmaaSection(
  yearResult: Readonly<YearResult>,
  ledgerTier: number | null,
): TaxOpportunityYearRow['irmaa'] {
  // Both lookback MAGI and the next-tier boundary must be simulator-published;
  // reconstructing either from pack tables / inflationScale is a second truth
  // source (non-constant inflation paths diverge from `inflFactorFrom`).
  // Source/year ride with lookbackMagi so consumers can reject planFallback
  // stand-ins. `irmaaNextTierThreshold === null` is published evidence (no
  // Medicare activity or top tier) — only `undefined` is evidence-absent.
  if (
    yearResult.irmaaLookbackMagi === undefined ||
    yearResult.irmaaLookbackMagiSource === undefined ||
    yearResult.irmaaLookbackMagiYear === undefined ||
    yearResult.irmaaNextTierThreshold === undefined
  ) {
    return null
  }

  const lookbackMagi = yearResult.irmaaLookbackMagi
  const nextTierThreshold = yearResult.irmaaNextTierThreshold
  const tier = ledgerTier ?? yearResult.irmaaTier
  return {
    lookbackMagi,
    source: yearResult.irmaaLookbackMagiSource,
    lookbackYear: yearResult.irmaaLookbackMagiYear,
    tier,
    nextTierThreshold,
    distanceToNextTier:
      nextTierThreshold === null ? null : nextTierThreshold - lookbackMagi,
  }
}

function buildAcaSection(yearResult: Readonly<YearResult>): TaxOpportunityYearRow['aca'] {
  const aca = yearResult.aca
  if (aca === undefined) return null
  return {
    readiness: aca.readiness,
    cliffState: aca.cliffState,
    householdMagi: aca.householdMagi,
    fplPct: aca.fplPct,
    modeledAllowablePtc: aca.modeledAllowablePtc,
    economicNetPremium: aca.economicNetPremium,
  }
}

function ledgerFromAnnualProposal(
  row: TaxStrategyEvaluation['comparison']['annual'][number],
): TaxOpportunityYearLedger {
  const { values } = row
  return {
    tax: values.tax.proposal,
    magi: values.magi.proposal,
    irmaaTier: values.irmaaTier.proposal,
    irmaaSurcharge: values.irmaaSurcharge.proposal,
    rmd: values.rmd.proposal,
    qcd: values.qcd.proposal,
    rothConversion: values.rothConversion.proposal,
    traditionalWithdrawals: values.traditionalWithdrawals.proposal,
    withdrawals: values.withdrawals.proposal,
    inheritedRequired: values.inheritedRequired.proposal,
    taxExemptInterest: values.taxExemptInterest.proposal,
    acaGrossEnrollmentPremium: values.acaGrossEnrollmentPremium.proposal,
    acaModeledAllowablePtc: values.acaModeledAllowablePtc.proposal,
    acaEconomicNetPremium: values.acaEconomicNetPremium.proposal,
  }
}

/**
 * Build a TaxOpportunityView by reorganizing published evaluation and ledger
 * evidence. Throws when the result fails schema/invariant validation or when
 * proposalYears do not bind to the evaluation's held comparison.
 */
export function buildTaxOpportunityView(
  input: BuildTaxOpportunityViewInput,
): TaxOpportunityView {
  const evaluation = parseTaxStrategyEvaluation(input.evaluation)
  const yearsByCalendar = bindProposalYears(evaluation, input.proposalYears)

  const years: TaxOpportunityYearRow[] = evaluation.comparison.annual.map((annualRow) => {
    const ledger = ledgerFromAnnualProposal(annualRow)
    if (isBaselineOnlyAnnualRow(annualRow)) {
      return {
        year: annualRow.year,
        ledger,
        bracket: null,
        irmaa: null,
        aca: null,
        rmdPressure: {
          required: null,
          inheritedRequired: null,
          traditionalWithdrawals: null,
          qcd: null,
        },
      }
    }
    const yearResult = yearsByCalendar.get(annualRow.year)!
    return {
      year: annualRow.year,
      ledger,
      bracket: buildBracketSection(yearResult),
      irmaa: buildIrmaaSection(yearResult, ledger.irmaaTier),
      aca: buildAcaSection(yearResult),
      rmdPressure: {
        required: ledger.rmd,
        inheritedRequired: ledger.inheritedRequired,
        traditionalWithdrawals: ledger.traditionalWithdrawals,
        qcd: ledger.qcd,
      },
    }
  })

  const yearSet = new Set(years.map((row) => row.year))
  for (const action of evaluation.actions) {
    if (!yearSet.has(action.year)) {
      throw new Error(
        `buildTaxOpportunityView: action ${action.actionId} year ${action.year} is not in comparison.annual`,
      )
    }
  }

  const actions = evaluation.actions
    .map((action) => copyActionRow(action))
    .sort(
      (left, right) =>
        left.year - right.year ||
        compareUtf16CodeUnits(left.actionId, right.actionId),
    )

  const limitations = evaluation.limitations.map(copyLimitation)

  const draft: TaxOpportunityView = {
    kind: TAX_OPPORTUNITY_VIEW_KIND,
    version: CURRENT_TAX_OPPORTUNITY_VIEW_VERSION,
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
    years,
    actions,
    limitations,
  }

  // Parse first (zod constructs new objects), then deep-freeze the parsed result.
  return deepFreezeTaxOpportunityView(parseTaxOpportunityView(draft))
}

const RMD_PRESSURE_LEDGER_FIELDS = [
  ['required', 'rmd'],
  ['inheritedRequired', 'inheritedRequired'],
  ['traditionalWithdrawals', 'traditionalWithdrawals'],
  ['qcd', 'qcd'],
] as const satisfies ReadonlyArray<
  readonly [keyof TaxOpportunityYearRow['rmdPressure'], keyof TaxOpportunityYearLedger]
>

/**
 * The schema proves internal coherence; only this binding check proves the view
 * says what the evaluation says. Consumers rendering readiness MUST call it.
 *
 * Bracket, IRMAA, and ACA sections are not verified here — they are derived from
 * proposalYears, which this function deliberately does not take.
 */
export function verifyTaxOpportunityViewBinding(
  view: TaxOpportunityView,
  evaluation: TaxStrategyEvaluation,
): void {
  const parsedEvaluation = parseTaxStrategyEvaluation(evaluation)
  const expectedHash = taxStrategyEvaluationHash(parsedEvaluation)
  if (view.provenance.evaluationHash !== expectedHash) {
    throw new Error(
      'verifyTaxOpportunityViewBinding: provenance.evaluationHash does not match taxStrategyEvaluationHash(evaluation)',
    )
  }

  const evalProv = parsedEvaluation.provenance
  const viewProv = view.provenance
  if (
    viewProv.startYear !== evalProv.startYear ||
    viewProv.baselineSnapshotHash !== evalProv.baselineSnapshotHash ||
    viewProv.proposalSnapshotHash !== evalProv.proposalSnapshotHash ||
    viewProv.engineVersion !== evalProv.engineVersion ||
    viewProv.parameterBasis.dataAsOf !== evalProv.parameterBasis.dataAsOf ||
    viewProv.parameterBasis.basis !== evalProv.parameterBasis.basis ||
    viewProv.parameterBasis.standInYears.length !==
      evalProv.parameterBasis.standInYears.length ||
    viewProv.parameterBasis.standInYears.some(
      (year, index) => year !== evalProv.parameterBasis.standInYears[index],
    )
  ) {
    throw new Error(
      'verifyTaxOpportunityViewBinding: provenance fields diverge from evaluation.provenance',
    )
  }

  const expectedYears = parsedEvaluation.comparison.annual.map((row) => row.year)
  const actualYears = view.years.map((row) => row.year)
  if (
    actualYears.length !== expectedYears.length ||
    actualYears.some((year, index) => year !== expectedYears[index])
  ) {
    const expectedSet = new Set(expectedYears)
    const actualSet = new Set(actualYears)
    const divergentYear =
      actualYears.find((year) => !expectedSet.has(year)) ??
      expectedYears.find((year) => !actualSet.has(year))
    throw new Error(
      `verifyTaxOpportunityViewBinding: years diverge from evaluation.comparison.annual` +
        (divergentYear === undefined ? '' : ` (year ${divergentYear})`),
    )
  }

  for (let index = 0; index < parsedEvaluation.comparison.annual.length; index++) {
    const annualRow = parsedEvaluation.comparison.annual[index]!
    const viewRow = view.years[index]!
    const expectedLedger = ledgerFromAnnualProposal(annualRow)
    for (const field of Object.keys(expectedLedger) as Array<keyof TaxOpportunityYearLedger>) {
      if (viewRow.ledger[field] !== expectedLedger[field]) {
        throw new Error(
          `verifyTaxOpportunityViewBinding: year ${annualRow.year} ledger.${field} diverges from evaluation.comparison.annual`,
        )
      }
    }
    for (const [rmdField, ledgerField] of RMD_PRESSURE_LEDGER_FIELDS) {
      if (viewRow.rmdPressure[rmdField] !== expectedLedger[ledgerField]) {
        throw new Error(
          `verifyTaxOpportunityViewBinding: year ${annualRow.year} rmdPressure.${rmdField} diverges from evaluation.comparison.annual`,
        )
      }
    }
  }

  const seenViewActionIds = new Set<string>()
  for (const action of view.actions) {
    if (seenViewActionIds.has(action.actionId)) {
      throw new Error(
        `verifyTaxOpportunityViewBinding: duplicate actionId in view.actions (action ${action.actionId})`,
      )
    }
    seenViewActionIds.add(action.actionId)
  }

  if (view.actions.length !== parsedEvaluation.actions.length) {
    throw new Error(
      'verifyTaxOpportunityViewBinding: actions diverge from evaluation',
    )
  }

  const evaluationById = new Map(
    parsedEvaluation.actions.map((action) => [action.actionId, action]),
  )
  const viewById = new Map(view.actions.map((action) => [action.actionId, action]))

  if (evaluationById.size !== viewById.size) {
    const divergentActionId =
      [...viewById.keys()].find((id) => !evaluationById.has(id)) ??
      [...evaluationById.keys()].find((id) => !viewById.has(id))
    throw new Error(
      `verifyTaxOpportunityViewBinding: actions diverge from evaluation` +
        (divergentActionId === undefined ? '' : ` (action ${divergentActionId})`),
    )
  }

  for (const [actionId, viewAction] of viewById) {
    const evaluationAction = evaluationById.get(actionId)
    if (evaluationAction === undefined) {
      throw new Error(
        `verifyTaxOpportunityViewBinding: actions diverge from evaluation (action ${actionId})`,
      )
    }
    // Field-for-field including reasons, limitations, and sourceAllocations.
    // Strip nothing — a coherent forgery that upgrades readiness still hashes
    // differently here even when the standalone schema accepts it.
    const viewCanonical = canonicalScenarioJson({
      actionId: viewAction.actionId,
      kind: viewAction.kind,
      year: viewAction.year,
      personId: viewAction.personId,
      destinationAccountId: viewAction.destinationAccountId,
      charityDesignationId: viewAction.charityDesignationId,
      requestedAmountCents: viewAction.requestedAmountCents,
      executedAmountCents: viewAction.executedAmountCents,
      unexecutedAmountCents: viewAction.unexecutedAmountCents,
      readiness: viewAction.readiness,
      outcome: viewAction.outcome,
      sourceAllocations: viewAction.sourceAllocations,
      reasons: viewAction.reasons,
      limitations: viewAction.limitations,
    })
    const evaluationCanonical = canonicalScenarioJson({
      actionId: evaluationAction.actionId,
      kind: evaluationAction.kind,
      year: evaluationAction.year,
      personId: evaluationAction.personId,
      destinationAccountId: evaluationAction.destinationAccountId,
      charityDesignationId: evaluationAction.charityDesignationId,
      requestedAmountCents: evaluationAction.requestedAmountCents,
      executedAmountCents: evaluationAction.executedAmountCents,
      unexecutedAmountCents: evaluationAction.unexecutedAmountCents,
      readiness: evaluationAction.readiness,
      outcome: evaluationAction.outcome,
      sourceAllocations: evaluationAction.sourceAllocations,
      reasons: evaluationAction.reasons,
      limitations: evaluationAction.limitations,
    })
    if (viewCanonical !== evaluationCanonical) {
      throw new Error(
        `verifyTaxOpportunityViewBinding: actions diverge from evaluation (action ${actionId})`,
      )
    }
  }

  // Plan-wide limitations (independent of per-action) — field-for-field.
  if (
    canonicalScenarioJson(view.limitations) !==
    canonicalScenarioJson(parsedEvaluation.limitations)
  ) {
    throw new Error(
      'verifyTaxOpportunityViewBinding: limitations diverge from evaluation.limitations',
    )
  }
}

export function parseTaxOpportunityView(value: unknown): TaxOpportunityView {
  return taxOpportunityViewSchema.parse(value) as TaxOpportunityView
}

export function isTaxOpportunityViewDocument(
  value: unknown,
): value is TaxOpportunityView {
  return taxOpportunityViewSchema.safeParse(value).success
}

/** Stable canonical text via the shared scenario JSON normalizer (sorted keys). */
export function canonicalTaxOpportunityViewJson(view: TaxOpportunityView): string {
  return canonicalScenarioJson(view)
}

/**
 * Local FNV-1a 64-bit fingerprint of the canonical view JSON.
 * Mirrors `taxStrategyEvaluationHash` without importing its private hash loop.
 */
export function taxOpportunityViewHash(view: TaxOpportunityView): string {
  const canonical = canonicalTaxOpportunityViewJson(view)
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
