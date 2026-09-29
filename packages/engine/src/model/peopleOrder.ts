/**
 * The canonical order of a household's people (decision D-PEOPLE-ORDER).
 *
 * No primary source gives the order in which a plan lists its people a
 * meaning: a joint return is taxed on combined income, and a survivor is
 * whoever outlives the other. Where a computation must still visit the people
 * one at a time and the visit order can move a result, as the Monte Carlo
 * death and care draws do (each person takes numbers from the path's one
 * random stream in turn) and as the month refinement's coordinate search does,
 * it visits them in this order, never in list order:
 *
 * 1. date of birth ascending, the older first (ISO dates compare as strings);
 * 2. then sex, in the explicit order of `CANONICAL_SEX_ORDER`;
 * 3. then id, by ordinal (UTF-16 code unit) comparison, never a locale.
 *
 * Reversing the list therefore changes nothing. Renaming ids can change the
 * order only when two people share a date of birth and a sex, where the id is
 * the one tie-break left.
 */

/** The sex order the canonical order uses: written out, not a locale comparison. */
export const CANONICAL_SEX_ORDER = ['female', 'male', 'average'] as const

type OrderedPerson = { readonly id: string; readonly dob: string; readonly sex: (typeof CANONICAL_SEX_ORDER)[number] }

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Compare two people in the canonical order. */
export function compareCanonicalPeople(left: OrderedPerson, right: OrderedPerson): number {
  return (
    ordinal(left.dob, right.dob) ||
    CANONICAL_SEX_ORDER.indexOf(left.sex) - CANONICAL_SEX_ORDER.indexOf(right.sex) ||
    ordinal(left.id, right.id)
  )
}

/** A new array of the people in the canonical order; the input is not changed. */
export function canonicalPeopleOrder<P extends OrderedPerson>(people: readonly P[]): P[] {
  return [...people].sort(compareCanonicalPeople)
}

/**
 * The person the canonical order puts first (the older; see above), or
 * undefined for no people. Where the app has to illustrate something for one
 * person of a couple and nothing in the plan names who, as the annuitization
 * insight, the annuity sweep and the SPIA candidate do, and where a
 * comparison publishes one person's age, it is this person, so listing the
 * people the other way round changes nothing. Every such surface names them.
 */
export function canonicalFirstPerson<P extends OrderedPerson>(people: readonly P[]): P | undefined {
  let first: P | undefined
  for (const person of people) {
    if (first === undefined || compareCanonicalPeople(person, first) < 0) first = person
  }
  return first
}
