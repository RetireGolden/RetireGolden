/**
 * Pure, ordered plan for the annual purchased-annuity funding phase.
 *
 * The balance overlay is positional: funding ids resolve to the first matching
 * balance, and later purchases see every earlier debit and basis sale. The
 * caller retains every live mutation, runtime occurrence/application write,
 * mutation ordinal, contract-value credit, and cross-year investment write.
 */
import type { Account, Person } from '../../model/plan.js'
import {
  latestNonQlacQualifiedAnnuityStartAge,
  latestQlacAnnuityStartAge,
} from '../../model/plan.js'
import { isSpendableInYear } from '../../strategies/accountEligibility.js'
import { aggregateBasisSale } from '../../tax/aggregateBasisSale.js'
import type { RecordedAnnuityPurchase } from '../annualCashFlowYearSites.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

export const ANNUITY_PURCHASE_SHORTFALL_WARNING =
  'An annuity premium exceeded its funding account balance and was reduced to the available amount.'
export const LATE_QLAC_START_WARNING =
  'A QLAC that starts paying later than the first of the month after its owner\'s 85th birthday is not a QLAC; its premium still left the required-distribution base, which only a QLAC may do.'
export const LATE_NON_QLAC_QUALIFIED_START_WARNING =
  'A qualified annuity that starts paying after its owner\'s required beginning date was not marked a QLAC; its premium still left the required-distribution base, which only a QLAC may do.'

type FundingAccount = Extract<
  Account,
  { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa' }
>

export interface AnnuityPurchaseFundingBalanceView {
  readonly account: Readonly<FundingAccount>
  readonly balance: number
  readonly costBasis: number
}

export interface AnnualAnnuityPurchaseFundingInput {
  /** Unsorted Plan order; duplicate annuity ids and positions remain distinct. */
  readonly accounts: readonly Readonly<Account>[]
  /** Unsorted balance order; a funding id resolves to its first position. */
  readonly balances: readonly AnnuityPurchaseFundingBalanceView[]
  readonly peopleById: ReadonlyMap<string, Person>
  readonly primaryPerson: Readonly<Person>
  readonly year: number
  readonly qlacPremiumCap: number
  readonly limitGrowth: number
}

export type AnnualAnnuityPurchaseFundingRow =
  | Readonly<{ kind: 'none'; accountIndex: number }>
  | Readonly<{
      kind: 'purchase'
      accountIndex: number
      fundingIndex: number
      warnings: readonly string[]
      funded: number
      capitalGainOrLoss: number
      /** Null exactly when the inline phase did not fold gains or write basis. */
      capitalGainOrLossDelta: number | null
      closingBalance: number
      closingCostBasis: number | null
      record: RecordedAnnuityPurchase
      debit: Readonly<{
        accountId: string
        amountPlanDollars: number
      }> | null
    }>

function birthYear(person: Readonly<Person>): number {
  return Number(person.dob.slice(0, 4))
}

function birthMonth(person: Readonly<Person>): number {
  return Number(person.dob.slice(5, 7))
}

/** One position-keyed row per Plan account, in Plan order. */
export function annualAnnuityPurchaseFunding(
  input: AnnualAnnuityPurchaseFundingInput,
): readonly AnnualAnnuityPurchaseFundingRow[] {
  const shadow = input.balances.map(({ balance, costBasis }) => ({
    balance,
    costBasis,
  }))
  const rows: AnnualAnnuityPurchaseFundingRow[] = []

  for (const [accountIndex, account] of input.accounts.entries()) {
    if (
      account.type !== 'annuity' ||
      !account.purchase ||
      account.purchase.year !== input.year
    ) {
      rows.push({ kind: 'none', accountIndex })
      continue
    }
    const fundingIndex = input.balances.findIndex(
      ({ account: fundingAccount }) =>
        fundingAccount.id === account.purchase!.fundingAccountId,
    )
    if (fundingIndex < 0) {
      rows.push({ kind: 'none', accountIndex })
      continue
    }

    const funding = input.balances[fundingIndex]!
    const opening = shadow[fundingIndex]!
    const warnings: string[] = []
    let premium = account.purchase.premium
    // Last line rather than the only one. `parsePlan` refuses a qualified
    // purchase that starts paying later than its shape permits — past the
    // owner's required beginning date when it is not a QLAC (Treas. Reg.
    // 1.401(a)(9)-6(a)(3)(i), excused by (q)(1)(iii) for a QLAC alone), and
    // past the first of the month after the owner's 85th birthday when it is
    // one ((q)(1)(ii)) — and a stored document carrying either shape is stood
    // down at load. `simulatePlan` still takes a `Plan` by type rather than by
    // parse, so a caller that built one in memory can reach this pass with the
    // shape intact — and when it does, the premium leaves the traditional
    // balance for a contract that holds no balance, which is the required-
    // distribution exclusion 1.401(a)(9)-5(b)(4) reserves for a QLAC. Say so
    // rather than let it pass silently, the same way the statutory premium cap
    // is enforced here and not only at parse.
    if (account.purchase.taxQualification === 'qualified') {
      const owner = input.peopleById.get(
        account.ownerPersonId ?? input.primaryPerson.id,
      ) ?? input.primaryPerson
      if (account.purchase.qlac === true) {
        if (account.startAge > latestQlacAnnuityStartAge(birthMonth(owner))) {
          warnings.push(LATE_QLAC_START_WARNING)
        }
      } else if (
        account.startAge >
        latestNonQlacQualifiedAnnuityStartAge(
          birthYear(owner),
          account.purchase.year,
        )
      ) {
        warnings.push(LATE_NON_QLAC_QUALIFIED_START_WARNING)
      }
    }
    const qlacCap = input.qlacPremiumCap * input.limitGrowth
    if (account.purchase.qlac && premium > qlacCap) {
      premium = qlacCap
      warnings.push(
        `A QLAC premium above the $${Math.round(qlacCap).toLocaleString()} cap was reduced to the cap (the excess is not QLAC-eligible).`,
      )
    }

    const spendable = isSpendableInYear(funding.account, input.year)
      ? opening.balance
      : 0
    const funded = Math.min(premium, spendable)
    if (funded < premium - ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS) {
      warnings.push(ANNUITY_PURCHASE_SHORTFALL_WARNING)
    }

    let capitalGainOrLoss = 0
    let capitalGainOrLossDelta: number | null = null
    let closingCostBasis: number | null = null
    if (funding.account.type === 'taxable') {
      const sale = aggregateBasisSale({
        openingFairMarketValue: opening.balance,
        openingCostBasis: opening.costBasis,
        saleProceeds: funded,
      })
      capitalGainOrLoss = sale.realizedCapitalGainOrLoss
      capitalGainOrLossDelta = sale.realizedCapitalGainOrLoss
      closingCostBasis = sale.remainingCostBasis
    } else if (funding.account.type === 'equityComp' && opening.balance > 0) {
      const basisRatio = Math.min(1, opening.costBasis / opening.balance)
      capitalGainOrLoss = funded * (1 - basisRatio)
      capitalGainOrLossDelta = capitalGainOrLoss
      closingCostBasis = Math.max(
        0,
        opening.costBasis - funded * basisRatio,
      )
    }
    const closingBalance = opening.balance - funded
    shadow[fundingIndex] = {
      balance: closingBalance,
      costBasis: closingCostBasis ?? opening.costBasis,
    }
    const record: RecordedAnnuityPurchase = {
      fundingAccountId: funding.account.id,
      annuityAccountId: account.id,
      funded,
      capitalGainOrLoss,
    }
    rows.push({
      kind: 'purchase',
      accountIndex,
      fundingIndex,
      warnings,
      funded,
      capitalGainOrLoss,
      capitalGainOrLossDelta,
      closingBalance,
      closingCostBasis,
      record,
      debit: funded > 0
        ? { accountId: funding.account.id, amountPlanDollars: funded }
        : null,
    })
  }
  return rows
}
