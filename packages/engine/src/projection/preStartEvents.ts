/**
 * Plan events dated before the year the projection starts, named one by one
 * (decision D-2027-ROLLOVER, 2026-09-28).
 *
 * No source governs how a planner treats an event whose date has passed. The
 * engine's convention is that everything entered is as of the start year:
 * balances are what the household holds then, so a purchase dated earlier is
 * already paid for (its premium or cost is already out of the funding
 * account) and a goal, income or named action dated earlier has already
 * happened, or not, outside the projection. That convention is consistent and
 * it is kept. What was wrong was that it applied silently: a plan saved in
 * 2026 with a 2026 goal, inheritance or annuity purchase, reopened in 2027,
 * lost the goal and the inheritance with nothing on the page to say so, and
 * the annuity paid out while its premium stayed in the balance the household
 * had typed before buying it (in the derivation's U1 household, a $147,623
 * cost from a 2026 start became a $454,837 gain from a 2027 start).
 *
 * The engine cannot know whether that balance was updated after the purchase,
 * so it cannot correct the figure without guessing: deducting the premium at
 * the start would double-deduct it for every household that did update the
 * balance. So nothing moves; each event gets a warning that names it, the
 * year, what the projection assumed, and what to change if the assumption is
 * wrong. The double count that remains possible is registered as a limit of
 * the convention (rules/calculations/cashFlowAndSummary.ts,
 * `income-annuity-annual`).
 *
 * Two dated events are not "already happened" but "not reflected yet", and
 * the ledger acts on them in the first year (review H1 and L4, 2026-09-29):
 * a property whose sale year has passed is still on the plan, so its
 * balances hold no proceeds, and the ledger sells it in the first year
 * (`propertySaleYear.ts`); a debt whose payoff year has passed still carries
 * a balance, and the ledger pays it off in the first year
 * (`internal/annualDebtAndLongTermCare.ts`). Each is named with what the
 * ledger does and what to change if it already happened.
 */

import type { PositiveUsdCents } from '../actions/money.js'
import { formatWholeUsd } from '../internal/evidenceFormat.js'
import { quotePlanLadder } from '../ladder/ladderMath.js'
import type { Plan } from '../model/plan.js'

/** One event dated before the start year, as the warning names it. */
export interface PreStartEvent {
  readonly kind:
    | 'oneTimeGoal'
    | 'oneTimeIncome'
    | 'recurringIncomeEnded'
    | 'annuityPurchase'
    | 'tipsLadderPurchase'
    | 'hecmLineOpening'
    | 'propertySale'
    | 'debtPayoff'
    | 'rothConversionScheduled'
    | 'rothWindowEnded'
    | 'namedRothConversion'
    | 'namedQcd'
    | 'namedWithdrawal'
  /** The event's own id where it has one (the action id for a named action). */
  readonly id: string | null
  /** What the page calls it: the goal, income, account or ladder name. */
  readonly label: string
  /** The year it is dated (the last year of a window or stream). */
  readonly year: number
  /** The warning sentence, naming the event, the year and what was assumed. */
  readonly warning: string
}

/**
 * Every plan event dated before `startYear`, in plan order: one-time goals
 * (a flexible goal only when its whole window is before the start), one-time
 * incomes, recurring incomes that ended before the start, annuity purchases of
 * every kind (non-qualified, qualified, QLAC), TIPS-ladder purchases, HECM
 * lines of credit dated to open earlier (the ledger opens each in the start
 * year: `internal/hecmLineOpenings.ts`, `internal/hecmHudValidatedOpeningAdapter.ts`),
 * property sales and debt payoffs dated earlier (the ledger acts on each in
 * the start year), manual or optimized Roth conversion rows, an aggregate Roth
 * window that ended before the start, and named Roth conversions, QCDs and
 * withdrawals, each named by its amount, person, account and execution date.
 * Two events whose warnings would still read the same (two identical QCDs on
 * the same day, say) are numbered, "the first of two identical entries", so
 * the ledger's warning set keeps both (the second verification's V3). A
 * pension election or offer dated earlier has its own
 * warnings in the ledger (`projection/simulate.ts`); an aggregate Roth window
 * that opened earlier and is still open is not listed: its own years show
 * where it now starts.
 */
export function preStartEvents(plan: Plan, startYear: number): PreStartEvent[] {
  const events: PreStartEvent[] = []
  const before = `before this plan starts in ${startYear}`
  const accountName = (id: string): string =>
    plan.accounts.find((account) => account.id === id)?.name ?? 'the funding account'
  const personName = (id: string): string =>
    plan.household.people.find((person) => person.id === id)?.name ?? 'a household member'
  const dollars = (cents: PositiveUsdCents): string => formatWholeUsd(cents / 100)
  const dated = (action: { readonly year: number; readonly executionDate?: string | undefined }): string =>
    civilDateWords(action.executionDate) ?? String(action.year)
  const sources = (allocations: readonly { readonly sourceAccountId: string }[]): string => {
    const names = [...new Set(allocations.map((allocation) => accountName(allocation.sourceAccountId)))]
    if (names.length <= 1) return names[0] ?? 'the funding account'
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }

  for (const goal of plan.expenses.oneTimeGoals) {
    const last = Math.max(goal.year, goal.latestYear ?? goal.year)
    if (last >= startYear) continue
    events.push({
      kind: 'oneTimeGoal',
      id: goal.id,
      label: goal.label,
      year: last,
      warning:
        `The ${goal.label} goal is dated ${last}, ${before}, so it is not counted. ` +
        `If it has not happened, move it to ${startYear} or later.`,
    })
  }

  for (const income of plan.incomes) {
    if (income.type === 'oneTime' && income.year < startYear) {
      events.push({
        kind: 'oneTimeIncome',
        id: income.id,
        label: income.label,
        year: income.year,
        warning:
          `The ${income.label} income is dated ${income.year}, ${before}, so it is not counted. ` +
          `If it has not arrived, move it to ${startYear} or later.`,
      })
    } else if (income.type === 'recurring' && income.endYear !== null && income.endYear < startYear) {
      events.push({
        kind: 'recurringIncomeEnded',
        id: income.id,
        label: income.label,
        year: income.endYear,
        warning:
          `The ${income.label} income ends in ${income.endYear}, ${before}, so it is not counted. ` +
          `If it is still paid, move its end year to ${startYear} or later.`,
      })
    }
  }

  for (const account of plan.accounts) {
    if (account.type !== 'annuity' || !account.purchase || account.purchase.year >= startYear) continue
    const purchase = account.purchase
    const funding = accountName(purchase.fundingAccountId)
    events.push({
      kind: 'annuityPurchase',
      id: account.id,
      label: account.name,
      year: purchase.year,
      warning:
        `The ${account.name} purchase is dated ${purchase.year}, ${before}, so it is treated as already paid: ` +
        `the premium is not taken from ${funding}. ` +
        `If that balance still includes the premium, lower it by ${formatWholeUsd(purchase.premium)}.`,
    })
  }

  for (const ladder of plan.incomeFloor?.ladders ?? []) {
    if (!ladder.purchase || ladder.purchase.year >= startYear) continue
    const funding = accountName(ladder.purchase.fundingAccountId)
    // Priced as the ledger prices a purchase in its own year: the rungs
    // solved from the embedded real-yield curve, anchored at the purchase
    // year, in that year's dollars (`tipsLadderPurchaseFunding`: the real cost
    // times the inflation factor to the purchase year, which is 1 when the
    // projection starts in it). Null only when the payout window buys nothing.
    const quote = quotePlanLadder(ladder, startYear)
    const cost = quote === null ? null : formatWholeUsd(quote.build.totalCost)
    events.push({
      kind: 'tipsLadderPurchase',
      id: ladder.id,
      label: ladder.name,
      year: ladder.purchase.year,
      warning:
        cost === null
          ? `The ${ladder.name} TIPS ladder purchase is dated ${ladder.purchase.year}, ${before}, so it is treated as already paid. ` +
            'Its payout window buys no rungs, so nothing is taken from any balance.'
          : `The ${ladder.name} TIPS ladder purchase is dated ${ladder.purchase.year}, ${before}, so it is treated as already paid: ` +
            `its ${cost} cost is not taken from ${funding}. ` +
            `If that balance still includes the cost, lower it by ${cost}.`,
    })
  }

  for (const account of plan.accounts) {
    if (account.type !== 'property' || !account.hecm || account.hecm.openYear >= startYear) continue
    const openYear = account.hecm.openYear
    events.push({
      kind: 'hecmLineOpening',
      id: account.id,
      label: account.name,
      year: openYear,
      warning:
        `The HECM line of credit on ${account.name} is dated to open in ${openYear}, ${before}, so it is modeled as opening in ${startYear}. ` +
        `If the line is already open, its credit and loan balance here start from ${startYear}, not from ${openYear}.`,
    })
  }

  for (const account of plan.accounts) {
    if (account.type !== 'property' || account.plannedSaleYear === null || account.plannedSaleYear >= startYear) continue
    events.push({
      kind: 'propertySale',
      id: account.id,
      label: account.name,
      year: account.plannedSaleYear,
      warning:
        `The ${account.name} sale is dated ${account.plannedSaleYear}, ${before}, so the plan sells it in ${startYear}. ` +
        `If it has already been sold, remove the ${account.name} and add the proceeds to an account.`,
    })
  }

  for (const account of plan.accounts) {
    if (account.type !== 'debt' || typeof account.payoffYear !== 'number' || account.payoffYear >= startYear) continue
    if (account.balance <= 0) continue
    // What the ledger pays in the first year: the balance after that year's
    // interest (`annualDebtServiceRows`, grow then pay).
    const paid = account.balance * (1 + account.interestPct / 100)
    events.push({
      kind: 'debtPayoff',
      id: account.id,
      label: account.name,
      year: account.payoffYear,
      warning:
        `The ${account.name} payoff is dated ${account.payoffYear}, ${before}, so the plan pays it off in ${startYear}: ` +
        `${formatWholeUsd(paid)}, its ${formatWholeUsd(account.balance)} balance with a year of interest. ` +
        'If it was paid, set its balance to $0.',
    })
  }

  const roth = plan.strategies.rothConversion
  if (roth.mode === 'fillToTarget' && roth.endYear < startYear) {
    events.push({
      kind: 'rothWindowEnded',
      id: null,
      label: 'Roth conversion window',
      year: roth.endYear,
      warning:
        `The Roth conversion window runs from ${roth.startYear} to ${roth.endYear}, ending ${before}, so no conversion is modeled. ` +
        `If conversions are still planned, move the window to ${startYear} or later.`,
    })
  }
  if (roth.mode === 'manual' || roth.mode === 'optimized') {
    for (const row of roth.conversions) {
      if (row.year >= startYear || row.amount <= 0) continue
      events.push({
        kind: 'rothConversionScheduled',
        id: null,
        label: 'Roth conversion',
        year: row.year,
        warning:
          `A ${formatWholeUsd(row.amount)} Roth conversion is scheduled for ${row.year}, ${before}, so it is not modeled. ` +
          'If it happened, its dollars are already in the account balances.',
      })
    }
  }

  for (const action of plan.strategies.retirementActions) {
    if (action.year >= startYear) continue
    if (action.kind === 'rothConversion') {
      events.push({
        kind: 'namedRothConversion',
        id: action.actionId,
        label: 'Roth conversion',
        year: action.year,
        warning:
          `A ${dollars(action.requestedAmount)} Roth conversion for ${personName(action.personId)} from ${sources(action.allocations)} ` +
          `is dated ${dated(action)}, ${before}, so it is not modeled. ` +
          'If it happened, its dollars are already in the account balances.',
      })
    } else if (action.kind === 'qcd') {
      events.push({
        kind: 'namedQcd',
        id: action.actionId,
        label: 'Qualified charitable distribution',
        year: action.year,
        warning:
          `A ${dollars(action.requestedAmount)} qualified charitable distribution by ${personName(action.donorPersonId)} ` +
          `from ${accountName(action.allocation.sourceAccountId)} to ${action.charity.name} ` +
          `is dated ${dated(action)}, ${before}, so it is not modeled. ` +
          `If the gift has not been made, move it to ${startYear} or later.`,
      })
    } else if (action.kind === 'ordinaryWithdrawal') {
      events.push({
        kind: 'namedWithdrawal',
        id: action.actionId,
        label: 'Withdrawal',
        year: action.year,
        warning:
          `A ${dollars(action.requestedAmount)} withdrawal for ${personName(action.personId)} from ${sources(action.allocations)} ` +
          `is dated ${dated(action)}, ${before}, so it is not modeled. ` +
          'If it happened, the account balances already reflect it.',
      })
    }
  }

  return numberIdenticalWarnings(events)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** "August 1, 2025" for a valid ISO civil date, else null (the caller names the year). */
function civilDateWords(iso: string | undefined): string | null {
  const match = iso === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'] as const
const COUNTS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

/**
 * Two events whose warnings read the same get a number each, so neither the
 * reader nor the ledger's warning set (a `Set` of strings) takes two for one.
 */
function numberIdenticalWarnings(events: PreStartEvent[]): PreStartEvent[] {
  const totals = new Map<string, number>()
  for (const event of events) totals.set(event.warning, (totals.get(event.warning) ?? 0) + 1)
  const seen = new Map<string, number>()
  return events.map((event) => {
    const total = totals.get(event.warning) ?? 1
    if (total < 2) return event
    const index = (seen.get(event.warning) ?? 0) + 1
    seen.set(event.warning, index)
    const ordinal = ORDINALS[index - 1] ?? `number ${index}`
    const count = COUNTS[total - 2] ?? String(total)
    return { ...event, warning: `${event.warning} This is the ${ordinal} of ${count} identical entries.` }
  })
}
