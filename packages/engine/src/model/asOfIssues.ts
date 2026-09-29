/**
 * Rules that depend on the year a plan's projection starts, checked against a
 * year the host names rather than inside `parsePlan`.
 *
 * `parsePlan` is a pure function of the document and checks its shape, so a
 * plan that was stored always opens again. A rule about what is already in
 * the past cannot be one of those: the document does not say which year the
 * projection starts in. The save stamp was used for that until decision
 * D-2027-ROLLOVER (2026-09-28), and it was the wrong year twice over. It lags
 * the clock until the next save, so a plan saved in 2026 opened in 2027 with
 * its election kept and then refused its first save; and it is written in
 * UTC while a planner starts its projection on the local calendar, so on New
 * Year's Eve in New York the save refused an election the projection still
 * modelled, and on New Year's morning in Tokyo the save accepted one the
 * projection had stopped modelling.
 *
 * So the host passes the year its projection starts (the planner's
 * `projectionStartYear(plan)`; MCP's `session.startYear`), and these issues
 * refuse a SAVE, never a load. They use `parsePlan`'s issue format
 * (`path: message`), so a planner lists them, counts them on the save chip and
 * jumps to the field exactly as it does a parse issue. Nothing is repaired:
 * see the rule below for why the plan is not changed on the household's
 * behalf.
 */

import type { Plan } from './plan.js'

/**
 * Issues in the plan that are wrong only as of `asOfYear`, the year the
 * plan's projection starts, in `parsePlan`'s `path: message` format. Empty
 * when there are none.
 *
 * One rule today: an ELECTED pension lump sum whose election year is before
 * `asOfYear`. An election models a rollover the projection still has to
 * perform: in the election year the offer arrives in the receiving account
 * and the pension stops paying. A year before the projection starts has no
 * such year to land in, and the ledger would skip the pension for every year
 * while crediting the offer in none (the projection warns when a host skips
 * this check). Crediting it in the first year instead would double-count it
 * whenever the lump sum was taken and its dollars are already in the typed
 * balance, which is what balances "as of today" mean.
 *
 * The plan cannot say whether the lump sum was taken, so the issue offers
 * both restatements and chooses neither: dropping the election on load (the
 * repair the migration used to apply) would pay a pension the household gave
 * up if the lump sum was taken, and keeping the pension and crediting the
 * rollover would double-count it. An offer that is on record but NOT elected
 * is left alone: the projection pays the pension and says the offer's year
 * has passed.
 */
export function asOfIssues(plan: Plan, asOfYear: number): string[] {
  const issues: string[] = []
  const accountName = (id: string): string | null => {
    const account = plan.accounts.find((candidate) => candidate.id === id)
    return account === undefined ? null : account.name
  }
  plan.accounts.forEach((account, index) => {
    if (account.type !== 'pension' || !account.lumpSumElection || !account.lumpSumOffer) return
    const electionYear = account.lumpSumOffer.electionYear
    if (electionYear >= asOfYear) return
    const target = accountName(account.lumpSumElection.rolloverAccountId)
    const receiving = target === null ? 'the receiving account' : `${target}`
    issues.push(
      `accounts.${index}.lumpSumOffer.electionYear: ` +
        `The lump-sum election is dated ${electionYear}, before this plan starts in ${asOfYear}. ` +
        `If you took the lump sum, remove the pension and add the rollover to ${receiving}'s balance. ` +
        `If you did not, clear the election (the pension then pays) or move it to ${asOfYear} or later.`,
    )
  })
  return issues
}
