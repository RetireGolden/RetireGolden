/**
 * Which premium-credit (ACA) contracts an edit leaves stale, and the record of
 * what an edit removed (decision D-EXAMPLE-SOURCE-SWITCH, review finding M2,
 * 2026-09-28).
 *
 * A 'premiumField' contract stores only its year, the filing assertions,
 * tax-exempt interest and the foreign-exclusion addback; the region, tax
 * family, covered members and premiums are derived on every run from the
 * household and the premium field. So a change of state, a move, a date of
 * birth, a planning age or the premium cannot make it stale. Its assertions
 * are facts about who is on the return (each member's eligibility, Form 8814,
 * a marriage or divorce in the year, the married-filing-separately exception,
 * the self-employed deduction), so they may no longer hold only when someone
 * joins or leaves the household or the filing status changes: those edits
 * remove it.
 *
 * A 'stated' contract names a roster and written premiums, so any household
 * edit, and a premium edit, can leave it describing a household that no
 * longer exists: every such edit removes it, as before.
 *
 * Every removal is recorded on `healthcare.acaYearsRemoved` with the years it
 * covered, so a host can name the edit when it says why a year's credit is not
 * counted. The projection does not read the record.
 */
import type { Plan } from './plan.js'

type Healthcare = Plan['expenses']['healthcare']

export type AcaContractRemovalEdit = NonNullable<Healthcare['acaYearsRemoved']>[number]['edit']

/** The edits that change who is on the return: they remove premium-field contracts too. */
const REMOVES_EVERY_CONTRACT: ReadonlySet<AcaContractRemovalEdit> = new Set<AcaContractRemovalEdit>([
  'partnerAdded',
  'partnerRemoved',
  'peopleChanged',
  'filingStatusChanged',
])

/** Whether an edit removes premium-field contracts as well as stated ones. */
export function editRemovesPremiumFieldContracts(edit: AcaContractRemovalEdit): boolean {
  return REMOVES_EVERY_CONTRACT.has(edit)
}

/**
 * Remove the contracts `edit` leaves stale from `healthcare` (mutated in
 * place; works on an Immer draft), record the removal, and say whether
 * anything was removed. The `acaYears` key is removed when no contract is
 * left.
 */
export function removeStaleAcaContracts(healthcare: Healthcare, edit: AcaContractRemovalEdit): boolean {
  const contracts = healthcare.acaYears
  if (contracts === undefined) return false
  if (contracts.length === 0) {
    delete healthcare.acaYears
    return false
  }
  const removesAll = editRemovesPremiumFieldContracts(edit)
  const kept = removesAll ? [] : contracts.filter((contract) => contract.premiumBasis === 'premiumField')
  if (kept.length === contracts.length) return false
  const years = [
    ...new Set(
      contracts.filter((contract) => removesAll || contract.premiumBasis !== 'premiumField').map((contract) => contract.year),
    ),
  ].sort((a, b) => a - b)
  if (kept.length === 0) delete healthcare.acaYears
  else healthcare.acaYears = kept
  healthcare.acaYearsRemoved = [...(healthcare.acaYearsRemoved ?? []), { edit, years }]
  return true
}

/**
 * The edit that turned `base` into `edited`, as far as premium-credit
 * contracts are concerned, or null when the contracts are unaffected:
 * - a person added or removed (by id), or the people replaced: partnerAdded,
 *   partnerRemoved or peopleChanged;
 * - otherwise a different filing status: filingStatusChanged;
 * - otherwise any other household change (state, moves, a date of birth, a
 *   planning age): householdChanged;
 * - otherwise a different pre-65 premium: premiumChanged.
 */
export function acaContractEditBetween(base: Plan, edited: Plan): AcaContractRemovalEdit | null {
  const before = new Set(base.household.people.map((person) => person.id))
  const after = new Set(edited.household.people.map((person) => person.id))
  const added = [...after].some((id) => !before.has(id))
  const removed = [...before].some((id) => !after.has(id))
  if (added || removed) {
    return after.size > before.size ? 'partnerAdded' : after.size < before.size ? 'partnerRemoved' : 'peopleChanged'
  }
  if (base.household.filingStatus !== edited.household.filingStatus) return 'filingStatusChanged'
  if (JSON.stringify(base.household) !== JSON.stringify(edited.household)) return 'householdChanged'
  if (base.expenses.healthcare.pre65MonthlyPremiumPerPerson !== edited.expenses.healthcare.pre65MonthlyPremiumPerPerson) {
    return 'premiumChanged'
  }
  return null
}

/**
 * The most recent recorded edit that removed a contract for `year`, or null
 * when no recorded edit did (the year never had one, or it was removed some
 * other way).
 */
export function acaContractRemovalFor(healthcare: Pick<Healthcare, 'acaYearsRemoved'>, year: number): AcaContractRemovalEdit | null {
  const records = healthcare.acaYearsRemoved ?? []
  for (let index = records.length - 1; index >= 0; index--) {
    if (records[index]!.years.includes(year)) return records[index]!.edit
  }
  return null
}
