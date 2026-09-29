/**
 * The year the ledger sells a property (decision D-2027-ROLLOVER, review H1,
 * 2026-09-29).
 *
 * A property's `plannedSaleYear` is a calendar year entered by the household.
 * Once the plan starts after that year (a plan saved in 2026 with a 2026 sale,
 * reopened in 2027), the property is still on the plan, so its balances were
 * not updated for a sale: the proceeds are not in any account. Before this
 * rule the ledger read the date two ways at once. The sale ran only in a year
 * equal to `plannedSaleYear`, which a projection starting later never reaches,
 * so the house was held to the end of the plan, while the carrying costs
 * stopped for every year at or after `plannedSaleYear`, so its property tax
 * and insurance were dropped from the first year. On the reviewer's case (the
 * example couple's $420,000 home, $7,800 a year of tax and insurance, sale
 * dated 2026, run from 2027) that added $1,017,839 to ending net worth.
 *
 * No source governs a planner's reading of a sale date that has passed. The
 * one reading consistent with the rest of the plan is that the sale has not
 * been reflected yet, so the ledger sells the property in the plan's first
 * year, and the carrying costs stop from that same year. That is the closest
 * figure either way: if the house was sold, the proceeds arrive in the first
 * year rather than never; if it was not, it is sold at the first chance the
 * projection has. The projection names it (`preStartEvents`), and the editor
 * notes it, so the household can remove the property and add the proceeds to
 * an account if the sale has already happened. The same first-year rule
 * applies to a debt whose payoff year has passed
 * (`internal/annualDebtAndLongTermCare.ts`) and to a HECM line dated to open
 * earlier (`internal/hecmLineOpenings.ts`).
 */

/**
 * The year the ledger sells the property: its planned sale year, or the
 * projection's start year when the planned year is earlier. Null when no sale
 * is planned. Every reader of a sale (the sale itself, the exact-basis sale
 * tax, the carrying costs and the basis-gap Insight) takes the year from here,
 * so they cannot disagree; planner-ui's home-sale scenario lever counts every
 * property on the plan as owned when the projection starts, for the same
 * reason.
 */
export function effectivePropertySaleYear(
  account: { readonly plannedSaleYear: number | null },
  startYear: number,
): number | null {
  if (account.plannedSaleYear === null) return null
  return Math.max(account.plannedSaleYear, startYear)
}
