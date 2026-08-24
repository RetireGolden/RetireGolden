/**
 * Capture-after-commit publisher for `YearResult.cashFlow`.
 *
 * Stage 5 emits identity-bearing source, use, transfer, and tax-character
 * lines, then runs the full cash/use/transfer checker. Assemble still runs
 * on every capture-on committed year so `yearResult` shape is stable
 * (`cashFlow` present iff the option is on). Leftover remaining after the
 * contribution group is not plugged. Cash identity accepts the funding
 * solver's inclusive half-cent residual and fails closed above it.
 *
 * @see DOCS/features/year-cash-flow.md
 */

import {
  asUsdCents,
  planDollarsMoveNoLedgerCent,
  ledgerCentsToPlanDollars,
  type ExecuteAnnualQcdsResult,
  type ExecuteOrdinaryWithdrawalsResult,
  type ExecuteRothConversionsResult,
} from '../actions/index.js'
import type { AccountId, PersonId } from '../actions/identity.js'
import type { EmployerElectiveAllocation } from './employerRothCatchUp.js'
import { cashFlowLineIds, compareCashFlowLineId } from './annualCashFlowIds.js'
import type { AggregateBasisSaleResult } from '../tax/aggregateBasisSale.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from './moneyTolerance.js'
import {
  finalizeYearCashFlow,
  type MissingRequiredIdentityReport,
} from './annualCashFlowReconciliation.js'
import {
  attributeCashFlowShortfall,
  type CashFlowShortfallLayer,
  type CashFlowShortfallLineInput,
} from './annualCashFlowShortfallAttribution.js'
import type {
  AnnualCashFlowYearSites,
} from './annualCashFlowYearSites.js'
import type {
  InheritedAccountYearEvidence,
  SocialSecurityStreamActivity,
  YearCashFlow,
  YearCashFlowEntityReference,
  YearCashFlowLineId,
  YearCashFlowPenaltyClass,
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTaxCharacter,
  YearCashFlowTransferEndpoint,
  YearCashFlowTransferLine,
  YearCashFlowUseKind,
  YearCashFlowUseLine,
} from './types.js'

/**
 * Strict structural tolerance for use, transfer, and lineage checks. Cash
 * conservation separately follows the annual funding tolerance below.
 * Compare with `Math.abs(difference) > tolerance` (strict greater than).
 */
export const CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS = 1e-6

/** Cash conservation follows the annual funding solve's accepted half-cent residual. */
export const CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS =
  ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

export type AnnualCashFlowPenaltySnapshot =
  | {
      readonly attribution: 'account'
      readonly accountId: string
      readonly penaltyClass: YearCashFlowPenaltyClass
      readonly amount: number
    }
  | {
      readonly attribution: 'rothPool'
      readonly personId: string
      readonly penaltyClass: 'rothEarly'
      readonly amount: number
    }

/**
 * In-pass reporting allocated only inside `if (publishCashFlow)` in
 * `runPostContributionAnnualPass`. Never written into `yearSites`.
 */
export interface AnnualCashFlowPassLocals {
  readonly seppByAccountId: ReadonlyMap<string, { ownerPersonId: string | null; take: number }>
  readonly hecmCoordinatedByProperty: ReadonlyMap<string, number>
  readonly hecmBackstopByProperty: ReadonlyMap<string, number>
  /** Settled qualified-IRA annuity basis return per contract. Missing key → omit character. */
  readonly annuityBasisReturnByAccountId: ReadonlyMap<string, number>
  /** Settled owned-IRA RMD return-of-basis per owner. Missing key → omit character. */
  readonly rmdNontaxableByOwner: ReadonlyMap<string, number>
  /** Settled SEPP return-of-basis per source account. Missing key → omit character. */
  readonly seppNontaxableByAccountId: ReadonlyMap<string, number>
  /**
   * Per-account / per-pool early-withdrawal penalties recorded at committed
   * finals inside `if (publishCashFlow)`. Assemble does not re-walk `penaltiesFor`.
   */
  readonly penaltyLines: readonly AnnualCashFlowPenaltySnapshot[]
  /** Owned-Roth-IRA pool taxable ordinary (standalone metadata), same walk. */
  readonly rothPoolTaxableOrdinaryByPersonId: ReadonlyMap<string, number>
  readonly legacyPropertySaleDeposits: readonly {
    readonly propertyAccountId: string
    readonly amount: number
    readonly destination: YearCashFlowTransferEndpoint
  }[]
  readonly deathBenefits: readonly {
    readonly policyId: string
    readonly insuredPersonId: string
    readonly amount: number
    readonly destination: YearCashFlowTransferEndpoint
  }[]
  readonly surplusDestination: YearCashFlowTransferEndpoint
  /**
   * Final post-offset QCD exclusion on the RMD-diverted gift (`fromRmdExcludable`
   * after the 408(d)(8)(A) second-sentence / §219 offset). Never the pre-offset
   * `fromRmdQualified` carve used by Form 8606 line 7.
   */
  readonly qcdExclusionFromRmdByOwner: ReadonlyMap<string, number>
  /**
   * Final post-offset QCD exclusion on the beyond-RMD gift. Independent of the
   * ordinary amount: basis recovery is neither exclusion nor ordinary.
   *
   * Owner totals only. Per-transfer assignment lives on
   * `qcdBeyondRmdCharacterByOccurrence` because the Form 8606 walk charges
   * statutory excess onto the earliest draws; these maps cannot reconstruct
   * that when the excess is basis recovery (ordinary 0).
   */
  readonly qcdExclusionBeyondRmdByOwner: ReadonlyMap<string, number>
  /**
   * Final beyond-RMD ordinary character: §219 leftover plus Form 8606
   * `split.taxable` on the statutory excess. Never the pre-split gross excess.
   *
   * Owner totals. Same caveat as `qcdExclusionBeyondRmdByOwner`.
   */
  readonly qcdOrdinaryBeyondRmdByOwner: ReadonlyMap<string, number>
  /**
   * Per-occurrence beyond-RMD QCD character, snapshotted at the Form 8606
   * walk in mutation order. Excess (then leftover ordinary) is charged onto
   * the earliest `deferredLegacyQcdDistributions` entries; exclusion fills
   * the remainder. Empty → assemble falls back to the owner totals,
   * excess-first in that same order.
   */
  readonly qcdBeyondRmdCharacterByOccurrence: readonly {
    readonly ownerId: string
    readonly sourceAccountId: string
    readonly exclusion: number
    readonly ordinary: number
  }[]
  /**
   * Final from-RMD ordinary character: §219 leftover on the diverted qualified
   * dollars plus Form 8606 `split.taxable` on the nonqualified diverted portion.
   * Never `diverted − exclusion`, which would label basis recovery as ordinary.
   */
  readonly qcdOrdinaryFromRmdByOwner: ReadonlyMap<string, number>
  /**
   * Form 8606 `split.nontaxable` on the from-RMD nonqualified diverted portion.
   * Not also assigned to the owner's net RMD source line.
   */
  readonly qcdBasisFromRmdByOwner: ReadonlyMap<string, number>
  /**
   * Committed `hsaEffectFinal` nonqualified ordinary per HSA account
   * (`capByMedicalExpenses` excess only). Missing key → omit character.
   */
  readonly hsaNonqualifiedOrdinaryByAccountId: ReadonlyMap<string, number>
  /**
   * Committed designated-Roth (`roth:` per-account pool) taxable ordinary on
   * need-based withdrawals. Missing key → omit character. Owned Roth-IRA
   * (`rothira:`) ordinary stays on `rothPoolTaxableOrdinaryByPersonId`.
   */
  readonly employerRothTaxableOrdinaryByAccountId: ReadonlyMap<string, number>
}

/**
 * Values `assembleYearCashFlow` may read. It does not close over
 * `simulatePlan`, `evaluateWithdrawalNeed`, or live balances.
 *
 * `tax` / `penalties` / `surplus` feed published uses. The remaining
 * committed scalars are still gathered by `simulate.ts` so the call site
 * type-checks without a simulate.ts edit; they are not incomplete-inventory
 * probes (that heuristic retired at stage 5).
 */
export interface AssembleYearCashFlowInput {
  readonly yearSites: AnnualCashFlowYearSites
  readonly passLocals: AnnualCashFlowPassLocals

  /** Pre-pass streams that already survive as payment-site publication. */
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]

  readonly rmdTakeByAccount: ReadonlyMap<string, number>
  readonly ownedIraRmdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly qcdGrossByOwner: ReadonlyMap<string, number>
  readonly deferredLegacyQcdDistributions: readonly {
    readonly ownerId: string
    readonly amount: number
    readonly sourceAccountId: string
  }[]
  readonly employerPlanAccountIds: ReadonlySet<string>
  /** Traditional inherited accounts. Roth forced lines carry no ordinary character. */
  readonly inheritedTraditionalAccountIds: ReadonlySet<string>
  readonly withdrawalPlanByAccountId: ReadonlyMap<string, number>
  readonly withdrawalPlanTaxableSales: ReadonlyMap<string, Readonly<AggregateBasisSaleResult>>
  readonly iraCharacterFinal: {
    readonly nontaxable: number
    readonly taxableBySourceAccountId: ReadonlyMap<string, number>
  }
  readonly inheritedYearEvidence: readonly InheritedAccountYearEvidence[]
  readonly retirementActionExecution: ExecuteOrdinaryWithdrawalsResult | undefined
  readonly rothConversionActionExecution: ExecuteRothConversionsResult | undefined
  readonly qcdActionExecution: ExecuteAnnualQcdsResult | undefined
  readonly namedRothConversionExecuted: number
  readonly namedRothConversionNontaxable: number
  readonly conversionNontaxable: number
  readonly rothConversion: number
  readonly aggregateConversionDraws: readonly {
    readonly sourceAccountId: string
    readonly destinationAccountId: string
    readonly ownerPersonId: string
    readonly amount: number
    readonly nontaxable: number
  }[]
  /**
   * Economic yield map. Sources must not gather `gross` from this — it mixes
   * taxable + exempt. The per-account split lives on `yearSites.distributedYield`.
   * Reinvested-yield transfers gather `gross` when `reinvest`.
   */
  readonly distributedYieldByAccountId: ReadonlyMap<string, {
    readonly gross: number
    readonly distributedYieldPct: number
    readonly reinvest: boolean
  }>
  /**
   * Owner as the account carries it. Assemble does not infer primary when the
   * account's `ownerPersonId` is null.
   */
  readonly ownerPersonIdByAccountId: ReadonlyMap<string, string | null>

  /** Employer Roth-catch-up routing (pre-pass, survives). */
  readonly employerAllocationByOwner: ReadonlyMap<string, EmployerElectiveAllocation>
  readonly desiredByAccountId: ReadonlyMap<string, number>

  readonly yearTaxExemptInterest: number
  readonly generatedTaxExemptInterest: number
  readonly acaForeignExclusionAddback: number

  /** Pre-guardrail required lifestyle; assemble does not re-derive from `baseAnnual`. */
  readonly requiredLifestyle: number
  readonly targetLifestyle: number
  readonly targetLifestyleFunded: number
  readonly idealLifestyle: number
  readonly idealLifestyleFunded: number
  readonly excessLifestyle: number
  readonly excessLifestyleFunded: number
  /** Final ACA-converged healthcare. */
  readonly healthcare: number
  readonly shortfallAfterHecm: number

  readonly tax: number
  readonly penalties: number
  readonly surplus: number

  /** Gathered by simulate.ts; unused after the stage-5 heuristic retirement. */
  readonly incomesTotal: number
  readonly taxableYieldReinvested: number
  readonly propertySaleProceedsTotal: number
  readonly rmdTotal: number
  readonly seppTotal: number
  readonly inheritedTotal: number
  readonly needBasedWithdrawalTotal: number
  readonly retirementActionProceeds: number
  readonly hecmDraw: number
  readonly hecmShortfallDraw: number
  readonly contributionsTotal: number
  readonly employerMatchTotal: number
  /**
   * Plan-level encoded-segment collisions, computed once per capture-on
   * projection. Empty when every distinct producer ID encodes uniquely.
   */
  readonly collidingEncodedProducerSegments?: readonly string[]
}

function asReportingAccountId(id: string): AccountId {
  return id as AccountId
}

function asReportingPersonId(id: string): PersonId {
  return id as PersonId
}

function personRef(personId: string): YearCashFlowEntityReference {
  return { entityKind: 'person', personId: asReportingPersonId(personId) }
}

function accountRef(accountId: string): YearCashFlowEntityReference {
  return { entityKind: 'account', accountId: asReportingAccountId(accountId) }
}

function streamRef(incomeStreamId: string): YearCashFlowEntityReference {
  return { entityKind: 'incomeStream', incomeStreamId }
}

function propertyRef(propertyAccountId: string): YearCashFlowEntityReference {
  return { entityKind: 'propertyAccount', propertyAccountId: asReportingAccountId(propertyAccountId) }
}

function tipsRef(ladderId: string): YearCashFlowEntityReference {
  return { entityKind: 'tipsLadder', ladderId }
}

function policyRef(policyId: string): YearCashFlowEntityReference {
  return { entityKind: 'insurancePolicy', policyId }
}

function poolRef(personId: string): YearCashFlowEntityReference {
  return { entityKind: 'requiredDistributionPool', personId: asReportingPersonId(personId) }
}

function annuityContractRef(annuityAccountId: string): YearCashFlowEntityReference {
  return { entityKind: 'annuityContract', annuityAccountId: asReportingAccountId(annuityAccountId) }
}

function goalRef(goalId: string): YearCashFlowEntityReference {
  return { entityKind: 'goal', goalId }
}

function careEventRef(careEventId: string): YearCashFlowEntityReference {
  return { entityKind: 'careEvent', careEventId }
}

function ownerRefs(accountId: string, ownerPersonId: string | null | undefined): YearCashFlowEntityReference[] {
  const identities: YearCashFlowEntityReference[] = [accountRef(accountId)]
  if (ownerPersonId) identities.push(personRef(ownerPersonId))
  return identities
}

function chars(parts: readonly (YearCashFlowTaxCharacter | undefined)[]):
  readonly YearCashFlowTaxCharacter[] | undefined {
  const present = parts.filter((part): part is YearCashFlowTaxCharacter =>
    part !== undefined && part.amountPlanDollars !== 0)
  return present.length > 0 ? present : undefined
}

function ordinary(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount === 0 ? undefined : { kind: 'ordinaryIncome', amountPlanDollars: amount }
}

function capitalGain(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount === 0 ? undefined : { kind: 'capitalGain', amountPlanDollars: amount }
}

function returnOfBasis(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount <= 0 ? undefined : { kind: 'returnOfBasis', amountPlanDollars: amount }
}

function qcdExclusion(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount <= 0 ? undefined : { kind: 'qcdIncomeExclusion', amountPlanDollars: amount }
}

function qcdNonQualified(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount <= 0 ? undefined : { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: amount }
}

function householdCash(): YearCashFlowTransferEndpoint {
  return { entityKind: 'householdCash' }
}

function employerEndpoint(): YearCashFlowTransferEndpoint {
  return { entityKind: 'employer' }
}

function charityEndpoint(designationId?: string): YearCashFlowTransferEndpoint {
  return designationId === undefined || designationId === ''
    ? { entityKind: 'charity' }
    : { entityKind: 'charity', designationId }
}

function pensionPlanRef(pensionAccountId: string): YearCashFlowTransferEndpoint {
  return { entityKind: 'pensionPlan', pensionAccountId: asReportingAccountId(pensionAccountId) }
}

function accountYieldRef(accountId: string): YearCashFlowTransferEndpoint {
  return { entityKind: 'accountYield', accountId: asReportingAccountId(accountId) }
}

function unassignedCash(): YearCashFlowTransferEndpoint {
  return { entityKind: 'unassignedCash' }
}

function actionRef(actionId: string, allocationId?: string): YearCashFlowEntityReference {
  return allocationId === undefined
    ? { entityKind: 'retirementAction', actionId }
    : { entityKind: 'retirementAction', actionId, allocationId }
}

function conversionCharacter(nontaxable: number, taxable: number):
  readonly YearCashFlowTaxCharacter[] | undefined {
  return chars([returnOfBasis(nontaxable), ordinary(taxable)])
}

function qcdCharacter(exclusion: number, nonQualified: number, basis = 0):
  readonly YearCashFlowTaxCharacter[] | undefined {
  return chars([qcdExclusion(exclusion), qcdNonQualified(nonQualified), returnOfBasis(basis)])
}

function qualifiedDividend(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount === 0 ? undefined : { kind: 'qualifiedDividend', amountPlanDollars: amount }
}

function taxExemptIncome(amount: number): YearCashFlowTaxCharacter | undefined {
  return amount === 0 ? undefined : { kind: 'taxExemptIncome', amountPlanDollars: amount }
}

function streamCharacter(taxTreatment: 'ordinary' | 'capitalGain' | 'none', amount: number):
  readonly YearCashFlowTaxCharacter[] | undefined {
  if (taxTreatment === 'ordinary') return chars([ordinary(amount)])
  if (taxTreatment === 'capitalGain') return chars([capitalGain(amount)])
  return undefined
}

function collectSourceLines(input: AssembleYearCashFlowInput): YearCashFlowSourceLine[] {
  const lines: YearCashFlowSourceLine[] = []
  const { yearSites, passLocals } = input

  for (const row of yearSites.wages) {
    lines.push({
      id: cashFlowLineIds.sourceWages(row.incomeStreamId),
      kind: 'wages',
      role: 'spendableSource',
      amountPlanDollars: row.amount,
      identities: [streamRef(row.incomeStreamId), personRef(row.personId)],
    })
  }

  for (const stream of input.socialSecurityStreams) {
    if (stream.annualAmount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceSocialSecurity(stream.streamId),
      kind: 'socialSecurity',
      role: 'spendableSource',
      amountPlanDollars: stream.annualAmount,
      identities: [streamRef(stream.streamId), personRef(stream.personId)],
    })
  }

  for (const row of yearSites.pensions) {
    const taxCharacter = chars([ordinary(row.amount)])
    lines.push({
      id: cashFlowLineIds.sourcePension(row.accountId),
      kind: 'pension',
      role: 'spendableSource',
      amountPlanDollars: row.amount,
      identities: [accountRef(row.accountId), personRef(row.payeePersonId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.annuityPayments) {
    const identities: YearCashFlowEntityReference[] = [
      annuityContractRef(row.accountId),
      accountRef(row.accountId),
      personRef(row.recipientPersonId),
    ]
    // Funding owner is additional evidence, never a replacement for the
    // living recipient. Same-person qualified contracts already carry that
    // person as the recipient.
    if (
      row.fundingOwnerPersonId !== null &&
      row.fundingOwnerPersonId !== row.recipientPersonId
    ) {
      identities.push(personRef(row.fundingOwnerPersonId))
    }
    // Qualified-IRA settled basis is a pass-local map (stage 4). Missing key
    // → omit character rather than pro-rate the household scalar.
    const qualifiedBasis = row.qualifiedIraFunded
      ? passLocals.annuityBasisReturnByAccountId.get(row.accountId)
      : undefined
    const taxCharacter = row.qualifiedIraFunded
      ? chars([returnOfBasis(qualifiedBasis ?? 0)])
      : chars([returnOfBasis(row.nonqualifiedExcludable)])
    lines.push({
      id: cashFlowLineIds.sourceAnnuityPayment(row.accountId),
      kind: 'annuityPayment',
      role: 'spendableSource',
      amountPlanDollars: row.paid,
      identities,
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.tipsLadderCash) {
    if (row.cash <= 0) continue
    const taxCharacter = chars([returnOfBasis(row.maturingPrincipal)])
    lines.push({
      id: cashFlowLineIds.sourceTipsLadderCash(row.ladderId),
      kind: 'tipsLadderCash',
      role: 'spendableSource',
      amountPlanDollars: row.cash,
      identities: [tipsRef(row.ladderId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.recurring) {
    const taxCharacter = streamCharacter(row.taxTreatment, row.amount)
    lines.push({
      id: cashFlowLineIds.sourceRecurringIncome(row.incomeStreamId),
      kind: 'recurringIncome',
      role: 'spendableSource',
      amountPlanDollars: row.amount,
      identities: [streamRef(row.incomeStreamId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.oneTime) {
    const taxCharacter = streamCharacter(row.taxTreatment, row.amount)
    lines.push({
      id: cashFlowLineIds.sourceOneTimeIncome(row.incomeStreamId),
      kind: 'oneTimeIncome',
      role: 'spendableSource',
      amountPlanDollars: row.amount,
      identities: [streamRef(row.incomeStreamId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  // Distributed yield: taxable gross and exempt are separate source kinds.
  // Reinvested accounts are transfer-only (stage 4). Do not gather `gross`
  // from `distributedYieldByAccountId` — that mixes taxable + exempt.
  for (const row of yearSites.distributedYield) {
    if (row.reinvest) continue
    if (row.taxableGross > 0) {
      const taxCharacter = chars([
        ordinary(row.interest),
        ordinary(row.ordinaryDividends),
        row.qualified === 0
          ? undefined
          : { kind: 'qualifiedDividend', amountPlanDollars: row.qualified },
      ])
      lines.push({
        id: cashFlowLineIds.sourceTaxableAccountYield(row.accountId),
        kind: 'taxableAccountYield',
        role: 'spendableSource',
        amountPlanDollars: row.taxableGross,
        identities: [accountRef(row.accountId)],
        ...(taxCharacter ? { taxCharacter } : {}),
      })
    }
    if (row.exempt > 0) {
      const taxCharacter = chars([{ kind: 'taxExemptIncome', amountPlanDollars: row.exempt }])
      lines.push({
        id: cashFlowLineIds.sourceTaxExemptInterest(row.accountId),
        kind: 'taxExemptInterest',
        role: 'spendableSource',
        amountPlanDollars: row.exempt,
        identities: [accountRef(row.accountId)],
        ...(taxCharacter ? { taxCharacter } : {}),
      })
    }
  }

  for (const row of yearSites.propertySales) {
    if (row.netProceedsAfterHecm <= 0) continue
    const taxCharacter = chars([ordinary(row.ordinaryGain), capitalGain(row.capitalGain)])
    lines.push({
      id: cashFlowLineIds.sourcePropertySaleProceeds(row.propertyAccountId),
      kind: 'propertySaleProceeds',
      role: 'spendableSource',
      amountPlanDollars: row.netProceedsAfterHecm,
      identities: [propertyRef(row.propertyAccountId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const [accountId, take] of input.rmdTakeByAccount) {
    if (!input.employerPlanAccountIds.has(accountId)) continue
    if (take <= 0 || planDollarsMoveNoLedgerCent(take)) continue
    lines.push({
      id: cashFlowLineIds.sourceEmployerPlanRmd(accountId),
      kind: 'requiredMinimumDistribution',
      role: 'portfolioFunding',
      amountPlanDollars: take,
      identities: ownerRefs(accountId, input.ownerPersonIdByAccountId.get(accountId)),
    })
  }

  const ownedIraOwners = new Set<string>([
    ...input.ownedIraRmdGrossByOwner.keys(),
    ...input.qcdFromRmdByOwner.keys(),
  ])
  for (const ownerId of ownedIraOwners) {
    const gross = input.ownedIraRmdGrossByOwner.get(ownerId) ?? 0
    const diverted = input.qcdFromRmdByOwner.get(ownerId) ?? 0
    const net = gross - diverted
    // Zero-net exception: still publish when that owner's diversion is positive
    // so a later QCD transfer has a lineage target.
    if (net <= 0 && diverted <= 0) continue
    const amountPlanDollars = net > 0 ? net : 0
    const basis = passLocals.rmdNontaxableByOwner.get(ownerId)
    lines.push({
      id: cashFlowLineIds.sourceOwnedIraRmd(ownerId),
      kind: 'requiredMinimumDistribution',
      role: 'portfolioFunding',
      amountPlanDollars,
      identities: [poolRef(ownerId)],
      ...(chars([returnOfBasis(basis ?? 0)])
        ? { taxCharacter: chars([returnOfBasis(basis ?? 0)]) }
        : {}),
    })
  }

  for (const [accountId, row] of passLocals.seppByAccountId) {
    if (row.take <= 0) continue
    const basis = passLocals.seppNontaxableByAccountId.get(accountId)
    lines.push({
      id: cashFlowLineIds.sourceSeppDistribution(accountId),
      kind: 'seppDistribution',
      role: 'portfolioFunding',
      amountPlanDollars: row.take,
      identities: ownerRefs(accountId, row.ownerPersonId),
      ...(chars([returnOfBasis(basis ?? 0)])
        ? { taxCharacter: chars([returnOfBasis(basis ?? 0)]) }
        : {}),
    })
  }

  for (const evidence of input.inheritedYearEvidence) {
    if (evidence.executedRequiredAmount <= 0) continue
    const taxCharacter = input.inheritedTraditionalAccountIds.has(evidence.accountId)
      ? chars([ordinary(evidence.executedRequiredAmount)])
      : undefined
    lines.push({
      id: cashFlowLineIds.sourceInheritedAccountDistribution(evidence.accountId),
      kind: 'inheritedAccountDistribution',
      role: 'portfolioFunding',
      amountPlanDollars: evidence.executedRequiredAmount,
      identities: ownerRefs(evidence.accountId, evidence.ownerPersonId),
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  const execution = input.retirementActionExecution
  if (execution !== undefined) {
    for (const evidence of execution.evidence) {
      const personId = evidence.personId
      const actionCharacters = evidence.readiness === 'actionable' ? evidence.taxCharacter : []
      for (const allocation of evidence.allocations) {
        if (allocation.executedAmount <= 0) continue
        const amountPlanDollars = ledgerCentsToPlanDollars(allocation.executedAmount)
        if (amountPlanDollars <= 0) continue
        const actionId = String(evidence.actionId)
        const allocationId = String(allocation.allocationId)
        const sourceAccountId = String(allocation.sourceAccountId)
        const identities: YearCashFlowEntityReference[] = [
          actionRef(actionId, allocationId),
          accountRef(sourceAccountId),
        ]
        if (personId) identities.push(personRef(String(personId)))
        const taxCharacter = chars(actionCharacters.flatMap((part) => {
          if (String(part.allocationId) !== allocationId) return []
          const dollars = ledgerCentsToPlanDollars(part.amount)
          if (part.kind === 'capitalGain') return [capitalGain(dollars)]
          if (part.kind === 'capitalLoss') return [capitalGain(-dollars)]
          if (part.kind === 'basisReturn') return [returnOfBasis(dollars)]
          if (part.kind === 'ordinaryIncome') return [ordinary(dollars)]
          return []
        }))
        lines.push({
          id: cashFlowLineIds.sourceRetirementActionWithdrawal(actionId, allocationId),
          kind: 'retirementActionWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars,
          identities,
          ...(taxCharacter ? { taxCharacter } : {}),
        })
      }
    }
  }

  for (const [accountId, amount] of input.withdrawalPlanByAccountId) {
    if (amount <= 0) continue
    const sale = input.withdrawalPlanTaxableSales.get(accountId)
    const iraTaxable = input.iraCharacterFinal.taxableBySourceAccountId.get(accountId)
    const hsaOrdinary = passLocals.hsaNonqualifiedOrdinaryByAccountId.get(accountId)
    const employerRothOrdinary = passLocals.employerRothTaxableOrdinaryByAccountId.get(accountId)
    const taxCharacter = chars([
      sale !== undefined ? capitalGain(sale.realizedCapitalGainOrLoss) : undefined,
      sale !== undefined ? returnOfBasis(sale.recoveredCostBasis) : undefined,
      iraTaxable !== undefined ? returnOfBasis(amount - iraTaxable) : undefined,
      iraTaxable !== undefined ? ordinary(iraTaxable) : undefined,
      hsaOrdinary !== undefined ? ordinary(hsaOrdinary) : undefined,
      employerRothOrdinary !== undefined ? ordinary(employerRothOrdinary) : undefined,
    ])
    lines.push({
      id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal(accountId),
      kind: 'needBasedPortfolioWithdrawal',
      role: 'portfolioFunding',
      amountPlanDollars: amount,
      identities: ownerRefs(accountId, input.ownerPersonIdByAccountId.get(accountId)),
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const [propertyAccountId, amount] of passLocals.hecmCoordinatedByProperty) {
    if (amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceHecmCoordinatedDraw(propertyAccountId),
      kind: 'hecmCoordinatedDraw',
      role: 'loanProceeds',
      amountPlanDollars: amount,
      identities: [propertyRef(propertyAccountId)],
    })
  }

  for (const [propertyAccountId, amount] of passLocals.hecmBackstopByProperty) {
    if (amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceHecmBackstopDraw(propertyAccountId),
      kind: 'hecmBackstopDraw',
      role: 'loanProceeds',
      amountPlanDollars: amount,
      identities: [propertyRef(propertyAccountId)],
    })
  }

  for (const row of passLocals.legacyPropertySaleDeposits) {
    if (row.amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceLegacyPropertySaleDeposit(row.propertyAccountId),
      kind: 'legacyPropertySaleDeposit',
      role: 'postSolveDeposit',
      amountPlanDollars: row.amount,
      identities: [propertyRef(row.propertyAccountId)],
      postSolveDestination: row.destination,
    })
  }

  for (const row of passLocals.deathBenefits) {
    if (row.amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceLifeInsuranceDeathBenefit(row.policyId),
      kind: 'lifeInsuranceDeathBenefit',
      role: 'postSolveDeposit',
      amountPlanDollars: row.amount,
      identities: [policyRef(row.policyId), personRef(row.insuredPersonId)],
      postSolveDestination: row.destination,
    })
  }

  lines.sort((a, b) => compareCashFlowLineId(a.id, b.id))
  return lines
}

interface PendingUseLine {
  readonly id: YearCashFlowLineId
  readonly kind: YearCashFlowUseKind
  readonly layer: CashFlowShortfallLayer
  readonly requestedPlanDollars: number
  readonly attemptedFundedPlanDollars: number
  readonly identities: readonly YearCashFlowEntityReference[]
  readonly penaltyClass?: YearCashFlowPenaltyClass
}

function pushUse(
  pending: PendingUseLine[],
  row: {
    id: YearCashFlowLineId
    kind: YearCashFlowUseKind
    layer: CashFlowShortfallLayer
    requested: number
    attempted: number
    identities: readonly YearCashFlowEntityReference[]
    penaltyClass?: YearCashFlowPenaltyClass
  },
): void {
  if (row.requested <= 0 && row.attempted <= 0) return
  pending.push({
    id: row.id,
    kind: row.kind,
    layer: row.layer,
    requestedPlanDollars: row.requested,
    attemptedFundedPlanDollars: row.attempted,
    identities: row.identities,
    ...(row.penaltyClass !== undefined ? { penaltyClass: row.penaltyClass } : {}),
  })
}

function goalLayer(classification: 'required' | 'target' | 'ideal' | 'excess'): CashFlowShortfallLayer {
  return classification
}

function collectUseLines(
  input: AssembleYearCashFlowInput,
  missingRequiredIdentityReports: MissingRequiredIdentityReport[],
): YearCashFlowUseLine[] {
  const pending: PendingUseLine[] = []
  const { yearSites, passLocals } = input

  pushUse(pending, {
    id: cashFlowLineIds.useRequiredLifestyle(),
    kind: 'requiredLifestyle',
    layer: 'required',
    requested: input.requiredLifestyle,
    attempted: input.requiredLifestyle,
    identities: [],
  })
  pushUse(pending, {
    id: cashFlowLineIds.useTargetLifestyle(),
    kind: 'targetLifestyle',
    layer: 'target',
    requested: input.targetLifestyle,
    attempted: input.targetLifestyleFunded,
    identities: [],
  })
  pushUse(pending, {
    id: cashFlowLineIds.useIdealLifestyle(),
    kind: 'idealLifestyle',
    layer: 'ideal',
    requested: input.idealLifestyle,
    attempted: input.idealLifestyleFunded,
    identities: [],
  })
  pushUse(pending, {
    id: cashFlowLineIds.useExcessLifestyle(),
    kind: 'excessLifestyle',
    layer: 'excess',
    requested: input.excessLifestyle,
    attempted: input.excessLifestyleFunded,
    identities: [],
  })

  for (const row of yearSites.goals) {
    pushUse(pending, {
      id: cashFlowLineIds.useOneTimeGoal(row.goalId),
      kind: 'oneTimeGoal',
      layer: goalLayer(row.classification),
      requested: row.requested,
      attempted: row.fundedNominal,
      identities: [goalRef(row.goalId)],
    })
  }

  for (const row of yearSites.debtService) {
    pushUse(pending, {
      id: cashFlowLineIds.useDebtService(row.accountId),
      kind: 'debtService',
      layer: 'required',
      requested: row.amount,
      attempted: row.amount,
      identities: ownerRefs(row.accountId, row.ownerPersonId),
    })
  }

  for (const row of yearSites.propertyCosts) {
    pushUse(pending, {
      id: cashFlowLineIds.usePropertyCosts(row.accountId),
      kind: 'propertyCosts',
      layer: 'required',
      requested: row.amount,
      attempted: row.amount,
      identities: [propertyRef(row.accountId)],
    })
  }

  pushUse(pending, {
    id: cashFlowLineIds.useHealthcare(),
    kind: 'healthcare',
    layer: 'required',
    requested: input.healthcare,
    attempted: input.healthcare,
    identities: [],
  })

  for (const row of yearSites.insurancePremiums) {
    pushUse(pending, {
      id: cashFlowLineIds.useInsurancePremium(row.policyId),
      kind: 'insurancePremium',
      layer: 'required',
      requested: row.amount,
      attempted: row.amount,
      identities: [policyRef(row.policyId), personRef(row.subjectPersonId)],
    })
  }

  for (const row of yearSites.longTermCare) {
    if (row.net <= 0) continue
    const identities: YearCashFlowEntityReference[] = [personRef(row.personId)]
    for (const careEventId of row.careEventIds) identities.push(careEventRef(careEventId))
    for (const policyId of row.payingPolicyIds) identities.push(policyRef(policyId))
    pushUse(pending, {
      id: cashFlowLineIds.useLongTermCare(row.personId),
      kind: 'longTermCare',
      layer: 'required',
      requested: row.net,
      attempted: row.net,
      identities,
    })
  }

  pushUse(pending, {
    id: cashFlowLineIds.useSettledTax(),
    kind: 'settledTax',
    layer: 'tax',
    requested: input.tax,
    attempted: input.tax,
    identities: [],
  })

  let attributedPenalties = 0
  const snapshotClasses = new Set<YearCashFlowPenaltyClass>()
  for (const row of passLocals.penaltyLines) {
    if (row.amount <= 0) continue
    attributedPenalties += row.amount
    snapshotClasses.add(row.penaltyClass)
    if (row.attribution === 'account') {
      pushUse(pending, {
        id: cashFlowLineIds.usePenaltyAccount(row.accountId, row.penaltyClass),
        kind: 'earlyWithdrawalPenalty',
        layer: 'penalty',
        requested: row.amount,
        attempted: row.amount,
        identities: ownerRefs(row.accountId, input.ownerPersonIdByAccountId.get(row.accountId)),
        penaltyClass: row.penaltyClass,
      })
    } else {
      pushUse(pending, {
        id: cashFlowLineIds.usePenaltyRothPool(row.personId),
        kind: 'earlyWithdrawalPenalty',
        layer: 'penalty',
        requested: row.amount,
        attempted: row.amount,
        identities: [poolRef(row.personId)],
        penaltyClass: 'rothEarly',
      })
    }
  }
  const penaltyRemainder = input.penalties - attributedPenalties
  if (penaltyRemainder > CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS && snapshotClasses.size === 1) {
    const penaltyClass = [...snapshotClasses][0]!
    pushUse(pending, {
      id: cashFlowLineIds.usePenaltyHousehold(penaltyClass),
      kind: 'earlyWithdrawalPenalty',
      layer: 'penalty',
      requested: penaltyRemainder,
      attempted: penaltyRemainder,
      identities: [],
      penaltyClass,
    })
  } else if (penaltyRemainder > CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS) {
    // Contract: omit rather than invent a class. Empty lineIds — even the
    // household grammar needs a known YearCashFlowPenaltyClass.
    missingRequiredIdentityReports.push({ lineIds: [] })
  }

  for (const row of yearSites.contributions) {
    pushUse(pending, {
      id: cashFlowLineIds.useContribution(row.destinationAccountId),
      kind: 'contribution',
      layer: 'contribution',
      requested: row.requested,
      attempted: row.credited,
      identities: ownerRefs(row.destinationAccountId, row.ownerPersonId),
    })
  }

  if (input.surplus > 0) {
    const dest = passLocals.surplusDestination
    const surplusId = dest.entityKind === 'account'
      ? cashFlowLineIds.useSurplusAccount(dest.accountId)
      : cashFlowLineIds.useSurplusUnassigned()
    const identities = dest.entityKind === 'account' ? [accountRef(dest.accountId)] : []
    pushUse(pending, {
      id: surplusId,
      kind: 'surplusInvestment',
      layer: 'surplus',
      requested: input.surplus,
      attempted: input.surplus,
      identities,
    })
  }

  const attributionInput: CashFlowShortfallLineInput[] = pending.map((row) => ({
    id: row.id,
    layer: row.layer,
    requestedPlanDollars: row.requestedPlanDollars,
    attemptedFundedPlanDollars: row.attemptedFundedPlanDollars,
  }))
  const attributed = attributeCashFlowShortfall({
    lines: attributionInput,
    shortfallAfterHecm: input.shortfallAfterHecm,
  })
  const fundingById = new Map(attributed.lines.map((row) => [row.id, row]))
  if (attributed.remainingUnattributed > CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS) {
    // An unattributed shortfall is an incomplete use inventory, not funding
    // fixed-point residue. Fail closed even when the hole is below half a cent.
    missingRequiredIdentityReports.push({ lineIds: [] })
  }
  // Leftover remaining is never plugged. Separately, the complete cash
  // identity accepts either sign of solved residual through the inclusive
  // half-cent budget and fails closed outside it.

  const useLines: YearCashFlowUseLine[] = []
  for (const row of pending) {
    const funding = fundingById.get(row.id)
    if (funding === undefined) continue
    if (funding.requestedPlanDollars <= 0 && funding.fundedPlanDollars <= 0) continue
    useLines.push({
      id: row.id,
      kind: row.kind,
      ...(row.penaltyClass !== undefined ? { penaltyClass: row.penaltyClass } : {}),
      requestedPlanDollars: funding.requestedPlanDollars,
      fundedPlanDollars: funding.fundedPlanDollars,
      unfundedPlanDollars: funding.unfundedPlanDollars,
      identities: row.identities,
    })
  }
  useLines.sort((a, b) => compareCashFlowLineId(a.id, b.id))
  return useLines
}

function collectTransferLines(
  input: AssembleYearCashFlowInput,
  useLines: readonly YearCashFlowUseLine[],
): YearCashFlowTransferLine[] {
  const lines: YearCashFlowTransferLine[] = []
  const { yearSites, passLocals } = input
  const useById = new Map(useLines.map((line) => [line.id, line]))

  const push = (line: YearCashFlowTransferLine): void => {
    if (line.debitPlanDollars <= 0 && line.creditPlanDollars <= 0) return
    lines.push(line)
  }

  for (const row of yearSites.contributions) {
    if (row.credited <= 0) continue
    const useId = cashFlowLineIds.useContribution(row.destinationAccountId)
    const useLine = useById.get(useId)
    // Residual attribution, not statutory-cap rejection: committed-credit
    // lineage only when the transfer actually exceeds the funded use.
    const funded = useLine?.fundedPlanDollars ?? 0
    const relationship =
      row.credited - funded > CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS
        ? 'committedCreditBeyondFunding' as const
        : 'sameDollarLaterStage' as const
    push({
      id: cashFlowLineIds.transferEmployeeContribution(row.destinationAccountId),
      kind: 'employeeContribution',
      source: householdCash(),
      destination: {
        entityKind: 'account',
        accountId: asReportingAccountId(row.destinationAccountId),
      },
      debitPlanDollars: row.credited,
      creditPlanDollars: row.credited,
      identities: ownerRefs(row.destinationAccountId, row.ownerPersonId),
      ...(useLine !== undefined
        ? { lineage: [{ lineId: useLine.id, relationship }] }
        : {}),
    })
  }

  for (const row of yearSites.employerMatch) {
    push({
      id: cashFlowLineIds.transferEmployerMatch(row.destinationAccountId),
      kind: 'employerMatch',
      source: employerEndpoint(),
      destination: {
        entityKind: 'account',
        accountId: asReportingAccountId(row.destinationAccountId),
      },
      debitPlanDollars: row.amount,
      creditPlanDollars: row.amount,
      identities: ownerRefs(row.destinationAccountId, row.ownerPersonId),
    })
  }

  for (const row of yearSites.annuityPurchases) {
    if (row.funded <= 0) continue
    const taxCharacter = chars([capitalGain(row.capitalGainOrLoss)])
    const fundingOwner = input.ownerPersonIdByAccountId.get(row.fundingAccountId)
    push({
      id: cashFlowLineIds.transferAnnuityPurchase(row.annuityAccountId),
      kind: 'annuityPurchase',
      source: {
        entityKind: 'account',
        accountId: asReportingAccountId(row.fundingAccountId),
      },
      destination: annuityContractRef(row.annuityAccountId),
      debitPlanDollars: row.funded,
      creditPlanDollars: row.funded,
      identities: [
        ...ownerRefs(row.fundingAccountId, fundingOwner),
        annuityContractRef(row.annuityAccountId),
      ],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.tipsPurchases) {
    if (row.funded <= 0) continue
    const taxCharacter = chars([capitalGain(row.capitalGainOrLoss)])
    push({
      id: cashFlowLineIds.transferTipsLadderPurchase(row.ladderId),
      kind: 'tipsLadderPurchase',
      source: {
        entityKind: 'account',
        accountId: asReportingAccountId(row.fundingAccountId),
      },
      destination: tipsRef(row.ladderId),
      debitPlanDollars: row.funded,
      creditPlanDollars: row.funded,
      identities: [accountRef(row.fundingAccountId), tipsRef(row.ladderId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const row of yearSites.pensionRollovers) {
    push({
      id: cashFlowLineIds.transferPensionRollover(row.pensionAccountId, row.destinationAccountId),
      kind: 'pensionRollover',
      source: pensionPlanRef(row.pensionAccountId),
      destination: {
        entityKind: 'account',
        accountId: asReportingAccountId(row.destinationAccountId),
      },
      debitPlanDollars: row.amount,
      creditPlanDollars: row.amount,
      identities: ownerRefs(row.destinationAccountId, row.ownerPersonId),
    })
  }

  const namedConversions = input.rothConversionActionExecution
  if (namedConversions?.committed === true) {
    for (const evidence of namedConversions.evidence) {
      if (evidence.outcome !== 'executed') continue
      const personId = String(evidence.request.personId)
      const destId = String(evidence.destinationRothAccountId)
      for (const allocation of evidence.allocations) {
        if (allocation.executedAmount <= 0) continue
        const amountPlanDollars = ledgerCentsToPlanDollars(asUsdCents(allocation.executedAmount))
        if (amountPlanDollars <= 0) continue
        const actionId = String(evidence.actionId)
        const allocationId = String(allocation.allocationId)
        const sourceAccountId = String(allocation.sourceAccountId)
        const identities: YearCashFlowEntityReference[] = [
          actionRef(actionId, allocationId),
          accountRef(sourceAccountId),
          accountRef(destId),
          personRef(personId),
        ]
        const taxCharacter =
          allocation.nontaxableConvertedAmount !== null &&
          allocation.taxableConvertedAmount !== null
            ? conversionCharacter(
                ledgerCentsToPlanDollars(asUsdCents(allocation.nontaxableConvertedAmount)),
                ledgerCentsToPlanDollars(asUsdCents(allocation.taxableConvertedAmount)),
              )
            : undefined
        push({
          id: cashFlowLineIds.transferNamedRothConversion(actionId, allocationId),
          kind: 'namedRothConversion',
          source: {
            entityKind: 'account',
            accountId: asReportingAccountId(sourceAccountId),
          },
          destination: {
            entityKind: 'account',
            accountId: asReportingAccountId(destId),
          },
          debitPlanDollars: amountPlanDollars,
          creditPlanDollars: amountPlanDollars,
          identities,
          ...(taxCharacter ? { taxCharacter } : {}),
        })
      }
    }
  }

  const aggregateByPair = new Map<string, {
    sourceAccountId: string
    destinationAccountId: string
    ownerPersonId: string
    amount: number
    nontaxable: number
  }>()
  for (const draw of input.aggregateConversionDraws) {
    if (draw.amount <= 0) continue
    // Reuse the published line-ID builder so schema-valid IDs containing NUL
    // or ':' cannot merge distinct source/destination pairs.
    const key = cashFlowLineIds.transferAggregateRothConversion(
      draw.sourceAccountId,
      draw.destinationAccountId,
    )
    const existing = aggregateByPair.get(key)
    if (existing === undefined) {
      aggregateByPair.set(key, { ...draw })
    } else {
      existing.amount += draw.amount
      existing.nontaxable += draw.nontaxable
    }
  }
  for (const [id, draw] of aggregateByPair) {
    const taxCharacter = conversionCharacter(
      draw.nontaxable,
      draw.amount - draw.nontaxable,
    )
    push({
      id,
      kind: 'aggregateRothConversion',
      source: {
        entityKind: 'account',
        accountId: asReportingAccountId(draw.sourceAccountId),
      },
      destination: {
        entityKind: 'account',
        accountId: asReportingAccountId(draw.destinationAccountId),
      },
      debitPlanDollars: draw.amount,
      creditPlanDollars: draw.amount,
      identities: [
        accountRef(draw.sourceAccountId),
        accountRef(draw.destinationAccountId),
        personRef(draw.ownerPersonId),
      ],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  for (const [ownerId, diverted] of input.qcdFromRmdByOwner) {
    if (diverted <= 0) continue
    const exclusion = passLocals.qcdExclusionFromRmdByOwner.get(ownerId) ?? 0
    const nonQualified = passLocals.qcdOrdinaryFromRmdByOwner.get(ownerId) ?? 0
    const basis = passLocals.qcdBasisFromRmdByOwner.get(ownerId) ?? 0
    const rmdLineId = cashFlowLineIds.sourceOwnedIraRmd(ownerId)
    const taxCharacter = qcdCharacter(exclusion, nonQualified, basis)
    push({
      id: cashFlowLineIds.transferRmdQcd(ownerId),
      kind: 'qualifiedCharitableDistribution',
      source: poolRef(ownerId),
      destination: charityEndpoint(),
      debitPlanDollars: diverted,
      creditPlanDollars: diverted,
      identities: [poolRef(ownerId)],
      ...(taxCharacter ? { taxCharacter } : {}),
      lineage: [{ lineId: rmdLineId, relationship: 'divertedBeforeHouseholdCash' }],
    })
  }

  // Same mutation order as the Form 8606 walk (`legacyQcdExcessByOwner` over
  // `deferredLegacyQcdDistributions`): statutory excess / leftover ordinary
  // first on the earliest draws, exclusion filling the remainder. The
  // pass-local occurrence snapshots are that walk's per-draw result; owner
  // totals are the fallback when a unit test does not supply them.
  const beyondOccurrenceByLineId = new Map(
    passLocals.qcdBeyondRmdCharacterByOccurrence.map((row) => [
      cashFlowLineIds.transferBeyondRmdQcd(row.ownerId, row.sourceAccountId),
      row,
    ]),
  )
  const beyondExclusionRemaining = new Map(passLocals.qcdExclusionBeyondRmdByOwner)
  const beyondOrdinaryRemaining = new Map(passLocals.qcdOrdinaryBeyondRmdByOwner)
  for (const entry of input.deferredLegacyQcdDistributions) {
    if (entry.amount <= 0) continue
    const lineId = cashFlowLineIds.transferBeyondRmdQcd(
      entry.ownerId, entry.sourceAccountId,
    )
    const occurrence = beyondOccurrenceByLineId.get(lineId)
    let exclusion: number
    let nonQualified: number
    if (occurrence !== undefined) {
      exclusion = occurrence.exclusion
      nonQualified = occurrence.ordinary
    } else {
      const remainingOrdinary = Math.max(
        0, beyondOrdinaryRemaining.get(entry.ownerId) ?? 0,
      )
      nonQualified = Math.min(remainingOrdinary, entry.amount)
      beyondOrdinaryRemaining.set(entry.ownerId, remainingOrdinary - nonQualified)
      const remainingExclusion = Math.max(
        0, beyondExclusionRemaining.get(entry.ownerId) ?? 0,
      )
      exclusion = Math.min(
        remainingExclusion, Math.max(0, entry.amount - nonQualified),
      )
      beyondExclusionRemaining.set(entry.ownerId, remainingExclusion - exclusion)
    }
    const taxCharacter = qcdCharacter(exclusion, nonQualified)
    push({
      id: lineId,
      kind: 'qualifiedCharitableDistribution',
      source: {
        entityKind: 'account',
        accountId: asReportingAccountId(entry.sourceAccountId),
      },
      destination: charityEndpoint(),
      debitPlanDollars: entry.amount,
      creditPlanDollars: entry.amount,
      identities: ownerRefs(entry.sourceAccountId, entry.ownerId),
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  const namedQcds = input.qcdActionExecution
  if (namedQcds?.committed === true) {
    for (const evidence of namedQcds.evidence) {
      if (evidence.executedAmount <= 0) continue
      const amountPlanDollars = ledgerCentsToPlanDollars(evidence.executedAmount)
      if (amountPlanDollars <= 0) continue
      const actionId = String(evidence.actionId)
      const allocationId = String(evidence.allocationId)
      const sourceAccountId = String(evidence.sourceAccountId)
      const donorId = String(evidence.donorPersonId)
      const designationId = evidence.request.charity.designationId
      const facts = evidence.derivedFacts
      const taxCharacter = qcdCharacter(
        ledgerCentsToPlanDollars(facts.excludableQcdAmount),
        ledgerCentsToPlanDollars(facts.taxableQcdAmount),
      )
      push({
        id: cashFlowLineIds.transferNamedQcd(actionId, allocationId),
        kind: 'qualifiedCharitableDistribution',
        source: {
          entityKind: 'account',
          accountId: asReportingAccountId(sourceAccountId),
        },
        destination: charityEndpoint(designationId),
        debitPlanDollars: amountPlanDollars,
        creditPlanDollars: amountPlanDollars,
        identities: [
          actionRef(actionId, allocationId),
          accountRef(sourceAccountId),
          personRef(donorId),
        ],
        ...(taxCharacter ? { taxCharacter } : {}),
      })
    }
  }

  const distributedYieldSitesByAccountId = new Map(
    yearSites.distributedYield.map((row) => [row.accountId, row]),
  )
  for (const [accountId, row] of input.distributedYieldByAccountId) {
    if (!row.reinvest || row.gross <= 0) continue
    const site = distributedYieldSitesByAccountId.get(accountId)
    const taxCharacter = site === undefined
      ? undefined
      : chars([
        ordinary(site.interest + site.ordinaryDividends),
        qualifiedDividend(site.qualified),
        taxExemptIncome(site.exempt),
      ])
    push({
      id: cashFlowLineIds.transferReinvestedYield(accountId),
      kind: 'reinvestedYield',
      source: accountYieldRef(accountId),
      destination: {
        entityKind: 'account',
        accountId: asReportingAccountId(accountId),
      },
      debitPlanDollars: row.gross,
      creditPlanDollars: row.gross,
      identities: [accountRef(accountId)],
      ...(taxCharacter ? { taxCharacter } : {}),
    })
  }

  if (input.surplus > 0) {
    const dest = passLocals.surplusDestination
    const useId = dest.entityKind === 'account'
      ? cashFlowLineIds.useSurplusAccount(dest.accountId)
      : cashFlowLineIds.useSurplusUnassigned()
    const transferId = dest.entityKind === 'account'
      ? cashFlowLineIds.transferSurplusAccount(dest.accountId)
      : cashFlowLineIds.transferSurplusUnassigned()
    const identities = dest.entityKind === 'account' ? [accountRef(dest.accountId)] : []
    const destination: YearCashFlowTransferEndpoint = dest.entityKind === 'account'
      ? dest
      : unassignedCash()
    push({
      id: transferId,
      kind: 'surplusInvestment',
      source: householdCash(),
      destination,
      debitPlanDollars: input.surplus,
      creditPlanDollars: input.surplus,
      identities,
      lineage: [{ lineId: useId, relationship: 'sameDollarLaterStage' }],
    })
  }

  lines.sort((a, b) => compareCashFlowLineId(a.id, b.id))
  return lines
}

function collectTaxCharacterMetadata(
  input: AssembleYearCashFlowInput,
): YearCashFlowStandaloneTaxCharacter[] {
  const lines: YearCashFlowStandaloneTaxCharacter[] = []
  const { yearSites, passLocals } = input

  for (const row of yearSites.tipsLadderCash) {
    if (row.accretion === 0) continue
    lines.push({
      id: cashFlowLineIds.metadataTipsPhantomOid(row.ladderId),
      taxCharacter: { kind: 'tipsPhantomOidIncome', amountPlanDollars: row.accretion },
      identities: [tipsRef(row.ladderId)],
      ...(row.cash > 0
        ? { relatedLineId: cashFlowLineIds.sourceTipsLadderCash(row.ladderId) }
        : {}),
    })
  }

  const attestedExcess = Math.max(0, input.yearTaxExemptInterest - input.generatedTaxExemptInterest)
  if (attestedExcess > 0) {
    lines.push({
      id: cashFlowLineIds.metadataTaxExemptInterestAttestedExcess(),
      taxCharacter: { kind: 'taxExemptIncome', amountPlanDollars: attestedExcess },
      identities: [],
    })
  }

  if (input.acaForeignExclusionAddback > 0) {
    lines.push({
      id: cashFlowLineIds.metadataForeignExclusionAddback(),
      taxCharacter: {
        kind: 'foreignExclusionAddback',
        amountPlanDollars: input.acaForeignExclusionAddback,
      },
      identities: [],
    })
  }

  for (const [personId, amount] of passLocals.rothPoolTaxableOrdinaryByPersonId) {
    if (amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.metadataRothPoolOrdinaryIncome(personId),
      taxCharacter: { kind: 'ordinaryIncome', amountPlanDollars: amount },
      identities: [poolRef(personId)],
    })
  }

  for (const row of yearSites.rebalancingGains) {
    if (row.realizedCapitalGainOrLoss === 0) continue
    lines.push({
      id: cashFlowLineIds.metadataRebalancingCapitalGain(row.accountId),
      taxCharacter: { kind: 'capitalGain', amountPlanDollars: row.realizedCapitalGainOrLoss },
      identities: [accountRef(row.accountId)],
    })
  }

  for (const row of yearSites.propertySales) {
    if (row.netProceedsAfterHecm > 0) continue
    if (row.capitalGain !== 0) {
      lines.push({
        id: cashFlowLineIds.metadataPropertySaleCapitalGain(row.propertyAccountId),
        taxCharacter: { kind: 'capitalGain', amountPlanDollars: row.capitalGain },
        identities: [propertyRef(row.propertyAccountId)],
      })
    }
    if (row.ordinaryGain !== 0) {
      lines.push({
        id: cashFlowLineIds.metadataPropertySaleOrdinaryIncome(row.propertyAccountId),
        taxCharacter: { kind: 'ordinaryIncome', amountPlanDollars: row.ordinaryGain },
        identities: [propertyRef(row.propertyAccountId)],
      })
    }
  }

  lines.sort((a, b) => compareCashFlowLineId(a.id, b.id))
  return lines
}

/**
 * Publish one year's cash-flow report from frozen committed locals.
 * Stage 5: source, use, transfer, and tax-character lines, then the full
 * cash/use/transfer checker (zero-line omission, lexicographic sort,
 * identities, diagnostics). The stage-1 incomplete-inventory heuristic is
 * retired.
 */
export function assembleYearCashFlow(input: AssembleYearCashFlowInput): YearCashFlow {
  const missingRequiredIdentityReports: MissingRequiredIdentityReport[] = []
  const sourceLines = collectSourceLines(input)
  const useLines = collectUseLines(input, missingRequiredIdentityReports)
  const transferLines = collectTransferLines(input, useLines)
  const taxCharacterMetadata = collectTaxCharacterMetadata(input)
  return finalizeYearCashFlow({
    sourceLines,
    useLines,
    transferLines,
    taxCharacterMetadata,
    missingRequiredIdentityReports,
    collidingEncodedProducerSegments: input.collidingEncodedProducerSegments,
    tolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
    cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  })
}
