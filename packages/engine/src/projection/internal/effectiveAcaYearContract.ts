/**
 * The premium-credit year contract the ledger prices, for one run and one
 * year (decisions D-EXAMPLE-SOURCE-SWITCH and D-ACA-CONTRACT-PATHS,
 * 2026-09-28).
 *
 * A contract's `premiumBasis` says where its premiums come from:
 *
 * - 'premiumField': the contract stores only its year, the filing assertions,
 *   tax-exempt interest and the foreign-exclusion addback. This run fills the
 *   rest for the year: the poverty-guideline region from the state the
 *   household lives in (Alaska and Hawaii have their own tables, every other
 *   state the contiguous one); the tax family from the people alive this year,
 *   the older as primary and the other as spouse (the canonical people order
 *   of model/peopleOrder.ts, never list order; the labels only count), each
 *   required to file with no separate MAGI; the covered members, those alive
 *   with Marketplace months before Medicare; and, in each of a covered member's
 *   Marketplace months, an enrollment premium and an SLCSP benchmark both equal
 *   to `pre65MonthlyPremiumPerPerson x healthInflFactor`, the plan's premium
 *   grown by this run's healthcare inflation from the start year (the path's
 *   own inflation on a Monte Carlo path).
 * - 'stated' (or absent): the coverage year's actual figures, used as written
 *   on every run, never grown with inflation. The one change a run makes is
 *   that a covered member who is not alive this year is charged nothing: both
 *   monthly arrays are zero. Under the ledger's annual convention a person is
 *   alive through the whole calendar year of the death age, so charging stops
 *   on 1 January of the next year. Enrollment ends on the date of death (45
 *   CFR 155.430(d)(7)) and 26 U.S.C. 36B(c)(2)(A) counts no month after the
 *   month of death, so the rest of the death year is a stated limit: about 5.5
 *   months of premium, and about 0.15 points of success rate (at most 0.23)
 *   on a real-contract couple (record aca-contract-premium-basis). The stated
 *   tax family still names that member, so the year's credit is left unpriced
 *   with `tax-family-member-unknown`. A premium-field family is re-derived
 *   from the people alive, so a survivor's credit is priced, except in a
 *   qualifying-surviving-spouse year and for two people filing single, which
 *   are refused with `tax-family-structure-unsupported`.
 *
 * Pure: reads only its arguments.
 */
import type { AcaStatedYearContract, AcaYearContract, Plan } from '../../model/plan.js'
import { stateForYear } from '../../model/plan.js'
import { canonicalPeopleOrder } from '../../model/peopleOrder.js'
import type { PersonYearState } from '../types.js'

/**
 * The priced contract: the stated shape, whatever the stored basis, carrying
 * the stored basis so the ledger can say where the year's premiums came from.
 */
export type EffectiveAcaYearContract = Omit<AcaStatedYearContract, 'premiumBasis'> & {
  readonly premiumBasis: 'stated' | 'premiumField'
}

export interface EffectiveAcaYearContractInput {
  readonly plan: Plan
  readonly year: number
  readonly peopleStates: readonly PersonYearState[]
  /** Marketplace months before Medicare for each person position this year (0 when not alive). */
  readonly marketplaceMonthsByPersonPosition: readonly number[]
  /** This run's healthcare inflation factor from the start year to `year`. */
  readonly healthInflFactor: number
}

/** The poverty-guideline table for a state: Alaska and Hawaii have their own. */
export function fplRegionForState(state: string): AcaStatedYearContract['fplRegion'] {
  return state === 'AK' ? 'alaska' : state === 'HI' ? 'hawaii' : 'contiguous'
}

function monthRow(value: number, months: number): number[] {
  return Array.from({ length: 12 }, (_, month) => (month < months ? value : 0))
}

/** The living people in the canonical order: date of birth, then sex, then id. */
function canonicalLiving<T extends { state: { personId: string } }>(
  living: readonly T[],
  people: EffectiveAcaYearContractInput['plan']['household']['people'],
): T[] {
  const rank = new Map(canonicalPeopleOrder(people).map((person, index) => [person.id, index]))
  return [...living].sort((left, right) => (rank.get(left.state.personId) ?? 0) - (rank.get(right.state.personId) ?? 0))
}

export function effectiveAcaYearContract(
  contract: AcaYearContract,
  input: EffectiveAcaYearContractInput,
): EffectiveAcaYearContract {
  if (contract.premiumBasis === 'premiumField') {
    const monthlyPremium = input.plan.expenses.healthcare.pre65MonthlyPremiumPerPerson * input.healthInflFactor
    const living = input.peopleStates
      .map((state, position) => ({ state, position }))
      .filter(({ state }) => state.alive)
    return {
      year: contract.year,
      premiumBasis: 'premiumField',
      fplRegion: fplRegionForState(stateForYear(input.plan.household, input.year)),
      // The labels only count (one primary, one spouse on a joint return), and
      // the older living person is the primary, in the canonical people order
      // (model/peopleOrder.ts), so list order never shows in the result.
      taxFamilyMembers: canonicalLiving(living, input.plan.household.people).map(({ state }, index) => ({
        personId: state.personId,
        relationship: index === 0 ? 'primary' : 'spouse',
        requiredToFile: 'required',
        magi: 0,
      })),
      coveredMembers: living
        .filter(({ position }) => input.marketplaceMonthsByPersonPosition[position]! > 0)
        .map(({ state, position }) => {
          const months = input.marketplaceMonthsByPersonPosition[position]!
          return {
            personId: state.personId,
            enrollmentPremiumByMonth: monthRow(monthlyPremium, months),
            slcspBenchmarkPremiumByMonth: monthRow(monthlyPremium, months),
          }
        }),
      taxExemptInterest: contract.taxExemptInterest,
      foreignExclusionAddback: contract.foreignExclusionAddback,
      assertions: contract.assertions,
    }
  }
  // The first person with the id, as this year's other contract checks
  // resolve a covered member (annualHealthcareExpenses.ts).
  const notAliveThisYear = (personId: string): boolean =>
    input.peopleStates.find((state) => state.personId === personId)?.alive === false
  const stated = { ...contract, premiumBasis: 'stated' as const }
  if (!contract.coveredMembers.some((member) => notAliveThisYear(member.personId))) return stated
  return {
    ...stated,
    coveredMembers: contract.coveredMembers.map((member) =>
      notAliveThisYear(member.personId)
        ? {
            personId: member.personId,
            enrollmentPremiumByMonth: new Array<number>(12).fill(0),
            slcspBenchmarkPremiumByMonth: new Array<number>(12).fill(0),
          }
        : member,
    ),
  }
}
