/**
 * Apply this year's annuity purchases to the ledger.
 *
 * The pure planner in `annualAnnuityPurchaseFunding.ts` decides what each
 * purchase costs, which account funds it, whether the QLAC cap binds and what
 * gain a taxable source realizes. What moved here out of the `simulatePlan`
 * year loop is the application: the positional refusals, the funding-account
 * mutation, the realized-gain fold, and the runtime-journal rows.
 *
 * Three orderings the move had to keep, and now states:
 *
 * - **Row order over `plan.accounts`.** `rebalanceRealizedGains` arrives with
 *   the start-of-year rebalance already folded into it, so this fold continues
 *   on a NON-ZERO base. Reassociating it, or pre-summing the deltas, would move
 *   IEEE-754 results. It comes in and goes back out for exactly that reason.
 * - **Every debit before every credit.** A household that buys two contracts in
 *   one year is the reason the contract credits are deferred to a second loop
 *   rather than recorded in place. The runtime replay requires application
 *   phases to be non-decreasing across the year, and debit-credit-debit-credit
 *   would refuse an ordinary Plan on an ordering rule that is about the
 *   simulator's own passes, not about anything the statute cares about.
 * - **The debit capture sits at the mutation site.** `row.debit` is pushed for
 *   EVERY funded purchase, while the runtime occurrence is emitted only for a
 *   traditional funding source. A cash- or brokerage-funded premium moves the
 *   same dollars and publishes nothing, so the optimizer probe would not see it
 *   otherwise.
 *
 * Move-only. Both maps and the debit array come in live and by identity,
 * because the year publishes from all three after this phase returns.
 */
import type { Account } from '../../model/plan.js'
import type { Person } from '../../model/plan.js'
import { isAggregatedIra } from '../../strategies/accountEligibility.js'
import type { RecordedAnnuityPurchase } from '../annualCashFlowYearSites.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'
import type { SimulatorRetirementRuntimeApplication } from '../types.js'
import { annualAnnuityPurchaseFunding } from './annualAnnuityPurchaseFunding.js'
import type { SimulatorRetirementRuntimeApplicationWithoutOrdinal } from './annualContributionReconciliationPhase.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'

/** A balance debit the optimizer probe reads when no runtime record exists. */
export interface AnnualExogenousStrategyDebit {
  accountId: string
  amountPlanDollars: number
}

/** The one cash-flow sink this phase writes. Null means capture is off. */
export interface AnnualAnnuityPurchaseCommitSites {
  recordAnnuityPurchase(row: RecordedAnnuityPurchase): void
}

export interface AnnualAnnuityPurchaseApplicationPhaseInput {
  /** The Plan's accounts, by position: the planner returns one row per entry. */
  readonly accounts: readonly Account[]
  /** Live physical rows; the funding account's balance and basis move here. */
  readonly balances: readonly PhysicalBalanceState[]
  readonly peopleById: ReadonlyMap<string, Person>
  readonly primaryPerson: Person
  readonly year: number
  readonly qlacPremiumCap: number
  readonly limitGrowth: number
  /**
   * This year's realized gains so far. The start-of-year rebalance has already
   * folded into it, so the purchase fold continues from a non-zero base.
   */
  readonly rebalanceRealizedGains: number
  /** The year's warning set; a planner warning is inserted at its own row. */
  readonly warnings: Set<string>
  /** Live, appended at the mutation site for every funded purchase. */
  readonly exogenousStrategyDebits: AnnualExogenousStrategyDebit[]
  /** Live contract values; a credited premium moves the value it holds. */
  readonly annuityContractValue: Map<string, number>
  /** Live investment-in-contract totals, for the exclusion ratio. */
  readonly annuityInvestmentInContract: Map<string, number>
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly recordAnnualRetirementRuntimeOccurrence: (
    occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  ) => void
  readonly recordAnnualRetirementRuntimeApplication: (
    application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
  ) => SimulatorRetirementRuntimeApplication
  readonly yearSites: AnnualAnnuityPurchaseCommitSites | null
}

export interface AnnualAnnuityPurchaseApplicationPhaseResult {
  /** The same running total, with this year's purchase gains folded in. */
  readonly rebalanceRealizedGains: number
}

export function annualAnnuityPurchaseApplicationPhase(
  input: AnnualAnnuityPurchaseApplicationPhaseInput,
): AnnualAnnuityPurchaseApplicationPhaseResult {
  const {
    accounts,
    balances,
    peopleById,
    primaryPerson,
    year,
    qlacPremiumCap,
    limitGrowth,
    warnings,
    exogenousStrategyDebits,
    annuityContractValue,
    annuityInvestmentInContract,
    runtimeOccurrenceKey,
    recordAnnualRetirementRuntimeOccurrence,
    recordAnnualRetirementRuntimeApplication,
    yearSites,
  } = input
  let rebalanceRealizedGains = input.rebalanceRealizedGains
  const pendingAnnuityContractCredits: {
    producerOccurrenceKey: string
    annuityAccountId: string
    ownerPersonId: string | null
    creditedAmountPlanDollars: number
    contractValueBeforePlanDollars: number
    contractValueAfterPlanDollars: number
  }[] = []
  // --- annuity purchase funding (guaranteed-income-and-estate-depth) -------
  // A purchased annuity trades a premium out of a funding account in its
  // purchase year. The move is a transfer, not spending: cash and qualified
  // (traditional) sources move at book value; a taxable/equity-comp source
  // realizes gains pro-rata like any sale, folded into this year's realized
  // gains, and the premium leaves the account. A qualified premium leaving a
  // traditional balance shrinks future RMDs automatically. A QLAC premium is
  // held to the statutory cap. The premium actually funded becomes the
  // contract's investment for the non-qualified exclusion ratio.
  //
  // The late-start warning is a last line rather than the only one.
  // `parsePlan` refuses a qualified purchase that starts paying later than
  // its shape permits, but simulatePlan accepts an in-memory Plan by type.
  // The pure planner therefore preserves the warning for that reachable
  // shape alongside the statutory cap and available-funding warnings.
  const annuityPurchaseRows = annualAnnuityPurchaseFunding({
    accounts,
    balances,
    peopleById,
    primaryPerson,
    year,
    qlacPremiumCap,
    limitGrowth,
  })
  if (annuityPurchaseRows.length !== accounts.length) {
    throw new Error('Annuity-purchase funding row count does not match Plan accounts')
  }
  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
    const row = annuityPurchaseRows[accountIndex]!
    if (row.accountIndex !== accountIndex) {
      throw new Error('Annuity-purchase funding row lost its Plan position')
    }
    if (row.kind === 'none') continue
    const account = accounts[accountIndex]
    const funding = balances[row.fundingIndex]
    if (
      account?.type !== 'annuity' ||
      !account.purchase ||
      funding === undefined ||
      funding.account.id !== account.purchase.fundingAccountId
    ) {
      throw new Error('Annuity-purchase funding row does not resolve its funding account')
    }
    for (const warning of row.warnings) warnings.add(warning)
    const fundingBalanceBefore = funding.balance
    if (row.capitalGainOrLossDelta !== null) {
      rebalanceRealizedGains += row.capitalGainOrLossDelta
      funding.costBasis = row.closingCostBasis!
    }
    funding.balance = row.closingBalance
    yearSites?.recordAnnuityPurchase(row.record)
    // The premium leaves an LP bucket for a contract the LP does not carry.
    // Captured here rather than from the occurrence below, which is emitted
    // only for a traditional funding source — a cash- or brokerage-funded
    // premium moves exactly the same dollars and publishes nothing.
    if (row.debit !== null) exogenousStrategyDebits.push(row.debit)
    if (row.funded > 0 && funding.account.type === 'traditional') {
      const kind = 'annuityFundingTransfer' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(
        kind,
        funding.account.id,
        account.id,
      )
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: row.funded,
        ownerPersonId: funding.account.ownerPersonId,
        sourceAccountId: funding.account.id,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      if (isAggregatedIra(funding.account)) {
        recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey,
          simulatorPhase: 'annuityPurchaseFunding',
          ownerPersonId: funding.account.ownerPersonId,
          sourceAccountId: funding.account.id,
          sourceBalanceBeforePlanDollars: fundingBalanceBefore,
          appliedAmountPlanDollars: row.funded,
          sourceBalanceAfterPlanDollars: funding.balance,
        })
        // THE CREDIT BESIDE THE DEBIT. The premium is not a distribution --
        // IRC 408(d)(1) reaches only what is paid or distributed OUT, and
        // Publication 590-B says the owner is not taxed on receiving the
        // contract -- so the value did not leave the section 408(d)(2)
        // aggregate, it changed which asset holds it. Recording only the debit
        // asserted the opposite by omission: the line-6 denominator lost the
        // premium and nothing gained it. Withheld where the contract has no
        // channel at all, so the year refuses in the source series rather
        // than crediting one that cannot say whose aggregate it belongs to.
        //
        // DEFERRED PAST THE LOOP rather than recorded in place, and a
        // household that buys two contracts in one year is the whole reason.
        // The replay requires application phases to be non-decreasing across
        // the year, so debit-credit-debit-credit would refuse an ordinary
        // Plan on an ordering rule that is about the simulator's own passes
        // and not about anything the statute cares about. Every debit first,
        // then every credit, keeps each phase to one contiguous run.
        if (annuityContractValue.has(account.id)) {
          const contractValueBefore = annuityContractValue.get(account.id)!
          const contractValueAfter = contractValueBefore + row.funded
          annuityContractValue.set(account.id, contractValueAfter)
          pendingAnnuityContractCredits.push({
            producerOccurrenceKey,
            annuityAccountId: account.id,
            ownerPersonId: funding.account.ownerPersonId,
            creditedAmountPlanDollars: row.funded,
            contractValueBeforePlanDollars: contractValueBefore,
            contractValueAfterPlanDollars: contractValueAfter,
          })
        }
      }
    }
    annuityInvestmentInContract.set(
      account.id,
      (annuityInvestmentInContract.get(account.id) ?? 0) + row.funded,
    )
  }
  for (const credit of pendingAnnuityContractCredits) {
    recordAnnualRetirementRuntimeApplication({
      applicationKind: 'annuityContractPremiumCredit',
      simulatorPhase: 'annuityPurchaseContractCredit',
      producerOccurrenceKey: null,
      ownerPersonId: null,
      sourceAccountId: null,
      sourceBalanceBeforePlanDollars: null,
      sourceBalanceAfterPlanDollars: null,
      producerOccurrenceKeys: [credit.producerOccurrenceKey],
      sourceOwnerPersonIds: [credit.ownerPersonId],
      destinationAnnuityAccountId: credit.annuityAccountId,
      destinationOwnerPersonId: credit.ownerPersonId,
      destinationContractValueBeforePlanDollars:
        credit.contractValueBeforePlanDollars,
      destinationCreditedAmountPlanDollars: credit.creditedAmountPlanDollars,
      destinationContractValueAfterPlanDollars:
        credit.contractValueAfterPlanDollars,
    })
  }
  return { rebalanceRealizedGains }
}
