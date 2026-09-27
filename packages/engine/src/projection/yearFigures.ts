/**
 * The per-year figures the ledger surfaces print, published once here so no
 * page recomputes them (owner decision D-UI-SS: no plan-related math in the
 * UI; the UI formats and selects engine values).
 *
 * Every figure reads one published `YearResult` row (and the plan, where
 * account ids matter). Sums are written in the order the pages used to write
 * them, so the verbatim families are bit-identical to what was printed
 * before. Three figures changed by owner decision on 2026-09-25:
 * - `taxFreeGainsRoom` (R2) is the largest extra long-term gain that raises
 *   the year's federal income tax by $0, not the 0% band room plus the
 *   remaining carryforward;
 * - `balancesByCategory` (R1) counts each logical account once, however many
 *   plan rows hold it;
 * - and `unassignedCash` is published beside the categories, so the stack's
 *   gap is a figure and not a silence.
 *
 * Nothing here rounds: whole-dollar formatting belongs to the page.
 *
 * @see DOCS/calculations/taxes/display-tax-free-gains-room-annual.md
 * @see DOCS/calculations/accounts-and-growth/display-balance-by-category-annual.md
 */
import { selectedLogicalBalanceAccounts, type Plan } from '../model/plan.js'
import { accountChannel, policyChannel, sharedIdGroups } from '../model/sharedIdCollisions.js'
import { packForYear } from '../params/index.js'
import { applyCapitalLossCarryforward, computeFederalTax } from '../tax/federalTax.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from './moneyTolerance.js'
import type { ProjectionResult, YearExpenses, YearResult } from './types.js'

/** The account categories the balance charts stack, bottom to top. */
export const BALANCE_CATEGORIES = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const

export type BalanceCategory = (typeof BALANCE_CATEGORIES)[number]

/**
 * The year's single "Tax" figure: `tax + penalties` (the settled federal,
 * state and any composed tax, plus the early-withdrawal penalty and the IRC
 * 4974 excise). AMT is already inside `tax`.
 */
export function taxAndPenalties(year: Pick<YearResult, 'tax' | 'penalties'>): number {
  return year.tax + year.penalties
}

/**
 * Everything the year paid out: `expenses.total + tax + penalties`, summed
 * left to right. The association matters: `total + (tax + penalties)` differs
 * in the last binary digit on some inputs, and this order is the one the
 * FI number's spending base uses.
 */
export function spendingWithTaxAndPenalties(
  year: Pick<YearResult, 'tax' | 'penalties'> & { readonly expenses: Pick<YearExpenses, 'total'> },
): number {
  return year.expenses.total + year.tax + year.penalties
}

/**
 * Long-term-care cost left after the modeled LTC benefit:
 * `max(0, careCost - ltcBenefit)`. The ledger never pays more benefit than
 * the cost in exact arithmetic, but its sum of per-policy payments can exceed
 * the summed cost by a unit in the last binary place; the floor absorbs only
 * that residue. A benefit above the cost by more than half a cent is a ledger
 * error and is refused.
 */
export function netCareCost(
  year: Pick<YearResult, 'year'> & { readonly expenses: Pick<YearExpenses, 'careCost' | 'ltcBenefit'> },
): number {
  const difference = year.expenses.careCost - year.expenses.ltcBenefit
  if (difference < -ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS) {
    throw new Error(
      `Year ${year.year} publishes an LTC benefit of ${year.expenses.ltcBenefit} against a care cost of ${year.expenses.careCost}; a benefit above the cost is not a rounding residue`,
    )
  }
  return Math.max(0, difference)
}

/** Spending intended above the target layer: `idealSpending + excessSpending` (intended, not funded). */
export function upsideSpending(year: { readonly expenses: Pick<YearExpenses, 'idealSpending' | 'excessSpending'> }): number {
  return year.expenses.idealSpending + year.expenses.excessSpending
}

/** Upside spending the year did not fund: `idealShortfall + excessShortfall`. */
export function upsideShortfall(year: Pick<YearResult, 'idealShortfall' | 'excessShortfall'>): number {
  return year.idealShortfall + year.excessShortfall
}

/**
 * Capital-loss carryforward the year used: against its gains plus against
 * ordinary income. When the year also realizes a net loss of its own, this
 * exceeds the fall in the carried balance by that loss, which joined the pool.
 */
export function capitalLossCarryforwardUsed(
  year: Pick<YearResult, 'capitalLossUsedAgainstGains' | 'capitalLossUsedAgainstOrdinary'>,
): number {
  return year.capitalLossUsedAgainstGains + year.capitalLossUsedAgainstOrdinary
}

/** Width of the gains-room bisection's final bracket, in dollars of extra gain. */
export const TAX_FREE_GAINS_ROOM_STEP_DOLLARS = 0.01

/**
 * Tax change the gains-room search reads as "no change". It absorbs the
 * binary rounding in `taxableIncome - preferentialIncome` (about 1e-11) and
 * nothing a real rate could produce over a cent of gain.
 */
export const TAX_FREE_GAINS_ROOM_TAX_TOLERANCE_DOLLARS = 1e-6

const TAX_FREE_GAINS_ROOM_MAX_DOUBLINGS = 64

/**
 * The largest additional long-term capital gain the household could realize
 * in the year without raising the year's federal income tax (regular tax,
 * AMT and NIIT), as `computeFederalTax` prices the year's published advisory
 * input with the extra gain netted through the capital-loss carryforward
 * first (owner decision R2, 2026-09-25).
 *
 *   R = max { g >= 0 : F(h) <= F(0) for every h in [0, g] }
 *   F(g) = computeFederalTax({ ...I, capitalGains: N(g), realizedCapitalGainsBeforeCarryforward: G + g }).totalTax
 *   N(g) = applyCapitalLossCarryforward(P, I.ordinaryIncome, G + g, L).netCapitalGain
 *
 * with `I` the advisory input, `G` its signed realized gain before netting,
 * `L` the year's loss offset limit, and `P` the opening carryforward pool
 * reconstructed from the published netting,
 * `P = remaining + usedAgainstOrdinary + usedAgainstGains - max(0, -G)`.
 *
 * Search: double an upper bound from $1 until tax rises by more than
 * `TAX_FREE_GAINS_ROOM_TAX_TOLERANCE_DOLLARS`, then bisect to
 * `TAX_FREE_GAINS_ROOM_STEP_DOLLARS` and return the lower end. So the result
 * lies in `[R - 0.01, R + 1e-6 / m]`, `m` the marginal rate just past `R`.
 *
 * It includes what the 0% band room does not price: Social Security made
 * taxable by the gain, the $3,000 loss deduction the gain uses up, the
 * senior-deduction phase-out and the NIIT threshold (neither indexed), and
 * the AMT. It excludes state tax, a smaller ACA premium credit (see
 * `premiumTaxCreditYear`) and Medicare premiums two years later.
 *
 * Null when the row carries no `advisoryFederalTax` (evidence-absent, never
 * approximated), or when its input omits the realized gain before netting in
 * a year that used or carried a loss, since the pool cannot then be rebuilt.
 */
export function taxFreeGainsRoom(
  year: Pick<
    YearResult,
    'advisoryFederalTax' | 'capitalLossCarryforwardRemaining' | 'capitalLossUsedAgainstOrdinary' | 'capitalLossUsedAgainstGains'
  >,
): number | null {
  const advisory = year.advisoryFederalTax
  if (advisory === undefined) return null
  const input = advisory.input
  const usedAgainstGains = year.capitalLossUsedAgainstGains
  const usedAgainstOrdinary = year.capitalLossUsedAgainstOrdinary
  const remaining = year.capitalLossCarryforwardRemaining
  let realized = input.realizedCapitalGainsBeforeCarryforward
  if (realized === undefined) {
    if (usedAgainstGains !== 0 || usedAgainstOrdinary !== 0 || remaining !== 0) return null
    realized = input.capitalGains
  }
  const grossRealized = realized
  const openingPool = remaining + usedAgainstOrdinary + usedAgainstGains - Math.max(0, -grossRealized)
  const offsetLimit = packForYear(input.year).pack.federalTax.capitalLossOrdinaryOffsetLimit
  const taxWithExtraGain = (extra: number): number => {
    const gross = grossRealized + extra
    const netting = applyCapitalLossCarryforward(openingPool, input.ordinaryIncome, gross, offsetLimit)
    return computeFederalTax({
      ...input,
      capitalGains: netting.netCapitalGain,
      realizedCapitalGainsBeforeCarryforward: gross,
    }).totalTax
  }
  const base = taxWithExtraGain(0)
  if (!Number.isFinite(base)) {
    throw new Error(`Year ${input.year}'s advisory federal tax is not finite (${base}); no gains room can be priced`)
  }
  const ceiling = base + TAX_FREE_GAINS_ROOM_TAX_TOLERANCE_DOLLARS
  let low = 0
  let high = 1
  let doublings = 0
  while (taxWithExtraGain(high) <= ceiling) {
    low = high
    high *= 2
    doublings += 1
    if (doublings > TAX_FREE_GAINS_ROOM_MAX_DOUBLINGS) {
      throw new Error(`Year ${input.year}: federal tax did not rise with an extra gain of ${high}; the gains room is unbounded`)
    }
  }
  while (high - low > TAX_FREE_GAINS_ROOM_STEP_DOLLARS) {
    const mid = (low + high) / 2
    if (taxWithExtraGain(mid) <= ceiling) low = mid
    else high = mid
  }
  return low
}

/**
 * Whether the year carries a modeled ACA premium tax credit. Extra gains
 * raise MAGI and can shrink the credit, and a credit paid in advance and lost
 * that way is repaid as federal tax at filing (Form 8962, Schedule 2). The
 * tax-free gains room does not price that, so a page marks such years.
 */
export function premiumTaxCreditYear(year: Pick<YearResult, 'aca'>): boolean {
  return (year.aca?.modeledAllowablePtc ?? 0) > 0
}

/**
 * Whether a modeled premium-tax-credit year rests on projected income-tax
 * figures: the credit is priced on the coverage year's published Marketplace
 * figures, but the household income it reads was computed with tax brackets
 * projected from the latest published income-tax pack (support code
 * `income-tax-parameters-projected`). A page says so beside the year's credit.
 */
export function premiumTaxCreditOnProjectedIncomeTax(year: Pick<YearResult, 'aca'>): boolean {
  return (
    premiumTaxCreditYear(year) &&
    (year.aca?.supportCodes.includes('income-tax-parameters-projected') ?? false)
  )
}

/**
 * Refuses a plan in which an investable account shares its id with a
 * property, a debt or a permanent-life policy: the published balances record
 * keeps one value per id, so such an account's balance was overwritten
 * (decision D-CASH-PROPERTY-ALIAS). The plan checks refuse these plans and
 * stored ones are repaired on load, so this fires only on a plan that did not
 * go through them.
 */
function assertNoOverwrittenBalanceIds(plan: Pick<Plan, 'accounts'> & { readonly insurance?: Plan['insurance'] }): void {
  const groups = sharedIdGroups(
    plan.accounts.map((account) => ({ id: account.id, channel: accountChannel(account.type) })),
    (plan.insurance ?? []).map((policy) => ({ id: policy.id, channel: policyChannel(policy.kind) })),
  )
  for (const group of groups) {
    if (group.space !== 'balances') continue
    if (!group.members.some((member) => member.channel === 'balance')) continue
    const others = group.members.filter((member) => member.channel !== 'balance').map((member) => member.channel)
    throw new Error(
      `Account id "${group.id}" is also the id of a ${others.join(' and a ')}, so the year's published balance under it is not the account's; give each its own id`,
    )
  }
}

/**
 * The year-end balances of the plan's investable accounts summed into the six
 * categories, one value per logical account id (owner decision R1): rows that
 * share an id are one account, whose aggregate the ledger publishes once under
 * that id. Iterates `selectedLogicalBalanceAccounts` and adds
 * `year.balances[id] ?? 0` under the id's account type. Property, debt and
 * policy values enter nothing. Unassigned cash is in no category (see
 * `unassignedCash`). Refuses a plan whose account id is shared with a
 * property, a debt or a permanent-life policy.
 */
export function balancesByCategory(
  plan: Pick<Plan, 'accounts'> & { readonly insurance?: Plan['insurance'] },
  year: Pick<YearResult, 'balances'>,
): Record<BalanceCategory, number> {
  assertNoOverwrittenBalanceIds(plan)
  const out: Record<BalanceCategory, number> = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
  for (const account of selectedLogicalBalanceAccounts(plan.accounts)) {
    out[account.type] += year.balances[account.id] ?? 0
  }
  return out
}

/**
 * Surplus cash the ledger could not deposit, because the plan has no cash or
 * taxable account for it to land in (the ledger warns when this happens). It
 * is in `investableTotal` and in no balance category. Null when the row does
 * not publish it.
 */
export function unassignedCash(year: Pick<YearResult, 'unassignedCash'>): number | null {
  return year.unassignedCash ?? null
}

/** Every per-year display figure for one ledger row. */
export interface YearDisplayFigures {
  readonly year: number
  readonly taxAndPenalties: number
  readonly spendingWithTaxAndPenalties: number
  readonly netCareCost: number
  readonly upsideSpending: number
  readonly upsideShortfall: number
  readonly capitalLossCarryforwardUsed: number
  readonly taxFreeGainsRoom: number | null
  readonly premiumTaxCreditYear: boolean
  readonly premiumTaxCreditOnProjectedIncomeTax: boolean
  readonly balancesByCategory: Readonly<Record<BalanceCategory, number>>
  readonly unassignedCash: number | null
}

/** The display figures of one ledger row. The gains room runs a search, so a page computes these once per projection. */
export function yearDisplayFigures(
  plan: Pick<Plan, 'accounts'> & { readonly insurance?: Plan['insurance'] },
  year: YearResult,
): YearDisplayFigures {
  return Object.freeze({
    year: year.year,
    taxAndPenalties: taxAndPenalties(year),
    spendingWithTaxAndPenalties: spendingWithTaxAndPenalties(year),
    netCareCost: netCareCost(year),
    upsideSpending: upsideSpending(year),
    upsideShortfall: upsideShortfall(year),
    capitalLossCarryforwardUsed: capitalLossCarryforwardUsed(year),
    taxFreeGainsRoom: taxFreeGainsRoom(year),
    premiumTaxCreditYear: premiumTaxCreditYear(year),
    premiumTaxCreditOnProjectedIncomeTax: premiumTaxCreditOnProjectedIncomeTax(year),
    balancesByCategory: Object.freeze(balancesByCategory(plan, year)),
    unassignedCash: unassignedCash(year),
  })
}

/** `yearDisplayFigures` for every row of a projection, in ledger order. */
export function projectionDisplayFigures(
  plan: Pick<Plan, 'accounts'> & { readonly insurance?: Plan['insurance'] },
  result: Pick<ProjectionResult, 'years'>,
): readonly YearDisplayFigures[] {
  return Object.freeze(result.years.map((year) => yearDisplayFigures(plan, year)))
}
