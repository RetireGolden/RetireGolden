/**
 * Capture-after-commit publisher for `YearResult.cashFlow`.
 *
 * Stage 2 emits identity-bearing source lines (spendable, portfolio funding,
 * loan proceeds, post-solve deposits). Use/transfer emission lands later.
 * `assembleYearCashFlow` still runs on every capture-on committed year so
 * `yearResult` shape is stable (`cashFlow` present iff the option is on).
 * Sources-without-uses years are honestly `notReconciled`.
 *
 * @see DOCS/features/year-cash-flow.md
 */

import {
  planDollarsMoveNoLedgerCent,
  ledgerCentsToPlanDollars,
  type ExecuteOrdinaryWithdrawalsResult,
} from '../actions/index.js'
import type { AccountId, PersonId } from '../actions/identity.js'
import { cashFlowLineIds, compareCashFlowLineId } from './annualCashFlowIds.js'
import {
  type CashFlowIncompleteInventoryProbes,
  reconcileYearCashFlow,
} from './annualCashFlowReconciliation.js'
import type {
  AnnualCashFlowYearSites,
} from './annualCashFlowYearSites.js'
import type {
  InheritedAccountYearEvidence,
  SocialSecurityStreamActivity,
  YearCashFlow,
  YearCashFlowEntityReference,
  YearCashFlowPenaltyClass,
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTaxCharacter,
  YearCashFlowTransferEndpoint,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
} from './types.js'

/**
 * Applied engine floating-point tolerance for both conservation identities
 * and the stage-1–4 incomplete-inventory probes. Not display rounding, not
 * funding `EPSILON` (0.005), not Monte Carlo `SHORTFALL_EPSILON` (0.5).
 * Compare with `Math.abs(difference) > tolerance` (strict greater than).
 */
export const CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS = 1e-6

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
}

/**
 * Values `assembleYearCashFlow` may read. It does not close over
 * `simulatePlan`, `evaluateWithdrawalNeed`, or live balances.
 */
export interface AssembleYearCashFlowInput extends CashFlowIncompleteInventoryProbes {
  readonly yearSites: AnnualCashFlowYearSites
  readonly passLocals: AnnualCashFlowPassLocals

  /** Pre-pass streams that already survive as payment-site publication. */
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]

  readonly rmdTakeByAccount: ReadonlyMap<string, number>
  readonly ownedIraRmdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly employerPlanAccountIds: ReadonlySet<string>
  readonly withdrawalPlanByAccountId: ReadonlyMap<string, number>
  readonly inheritedYearEvidence: readonly InheritedAccountYearEvidence[]
  readonly retirementActionExecution: ExecuteOrdinaryWithdrawalsResult | undefined
  /**
   * Economic yield map. Sources must not gather `gross` from this — it mixes
   * taxable + exempt. The per-account split lives on `yearSites.distributedYield`.
   * Reinvested-yield transfers (stage 4) gather `gross` when `reinvest`.
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
    lines.push({
      id: cashFlowLineIds.sourceInheritedAccountDistribution(evidence.accountId),
      kind: 'inheritedAccountDistribution',
      role: 'portfolioFunding',
      amountPlanDollars: evidence.executedRequiredAmount,
      identities: ownerRefs(evidence.accountId, evidence.ownerPersonId),
    })
  }

  const execution = input.retirementActionExecution
  if (execution !== undefined) {
    for (const evidence of execution.evidence) {
      const personId = evidence.personId
      for (const allocation of evidence.allocations) {
        if (allocation.executedAmount <= 0) continue
        const amountPlanDollars = ledgerCentsToPlanDollars(allocation.executedAmount)
        if (amountPlanDollars <= 0) continue
        const actionId = String(evidence.actionId)
        const allocationId = String(allocation.allocationId)
        const sourceAccountId = String(allocation.sourceAccountId)
        const identities: YearCashFlowEntityReference[] = [
          {
            entityKind: 'retirementAction',
            actionId,
            allocationId,
          },
          accountRef(sourceAccountId),
        ]
        if (personId) identities.push(personRef(String(personId)))
        lines.push({
          id: cashFlowLineIds.sourceRetirementActionWithdrawal(actionId, allocationId),
          kind: 'retirementActionWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars,
          identities,
        })
      }
    }
  }

  for (const [accountId, amount] of input.withdrawalPlanByAccountId) {
    if (amount <= 0) continue
    lines.push({
      id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal(accountId),
      kind: 'needBasedPortfolioWithdrawal',
      role: 'portfolioFunding',
      amountPlanDollars: amount,
      identities: ownerRefs(accountId, input.ownerPersonIdByAccountId.get(accountId)),
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

/**
 * Publish one year's cash-flow report from frozen committed locals.
 * Stage 2: source lines plus an honest reconciliation status.
 */
export function assembleYearCashFlow(input: AssembleYearCashFlowInput): YearCashFlow {
  const sourceLines: readonly YearCashFlowSourceLine[] = collectSourceLines(input)
  const useLines: readonly YearCashFlowUseLine[] = []
  const transferLines: readonly YearCashFlowTransferLine[] = []
  const taxCharacterMetadata: readonly YearCashFlowStandaloneTaxCharacter[] = []
  return {
    sourceLines,
    useLines,
    transferLines,
    taxCharacterMetadata,
    reconciliation: reconcileYearCashFlow({
      sourceLines,
      useLines,
      transferLines,
      probes: input,
      tolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
    }),
  }
}
