/**
 * Applicable age and required beginning date (RBD) derivation for inherited-IRA
 * regime classification.
 *
 * Statutory tiers under IRC §401(a)(9)(C) and SECURE 2.0 §107, keyed by the
 * owner's birth date:
 * - born on or before 1949-06-30 → the 70½ rule;
 * - born 1949-07-01 through 1950-12-31 → applicable age 72;
 * - born 1951–1958 → applicable age 73;
 * - born 1959 → contested between 73 and 75 (enacted §107 places the cohort in
 *   both buckets; Prop. Reg. §1.401(a)(9)-2 would resolve to 73, but T.D. 10001
 *   reserved the paragraph; Announcement 2026-7 defers only the anticipated
 *   final amendments to §§ 1.401(a)(9)-4, -5 and -6 and does not mention it);
 * - born 1960 or later → applicable age 75.
 *
 * For a non-70½ tier the RBD is April 1 of the year after the calendar year the
 * owner attains the applicable age. For the 70½ tier the owner attains age 70½
 * six calendar months after the 70th birthday (former Treas. Reg. §1.401(a)(9)-2
 * Q&A-3, T.D. 8987), and the IRA RBD is April 1 of the year after that attain
 * year (former Treas. Reg. §1.408-8 Q&A-3). IRA owners never take the
 * employer-plan retirement limb (historical §401(a)(9)(C)(ii)(II)).
 *
 * Registry: treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72
 * covers the 70½ / July-1949 / age-72 limbs enforced here; the 1959 contest
 * and SECURE 2.0 73/75 tiers stay on their sibling records.
 *
 * @see DOCS/domain/inherited-ira-regime-matrix.md §1–§2
 */

export type RbdComparison = 'before-rbd' | 'on-or-after-rbd'

export interface RbdDerivationInput {
  ownerDeathYear: number
  /** Asserted RBD-status fact from the plan (see plan.ts inheritedAccountSchema). */
  decedentHadStartedRmds: boolean
  ownerBirthYear?: number
  ownerBirthMonth?: number // 1–12
  ownerBirthDay?: number // 1–31
}

export type RbdDerivation =
  | { kind: 'resolved'; comparison: RbdComparison; contestedApplicableAge: false }
  | {
      /** Candidates disagree, or a certain derivation contradicts the asserted fact. */
      kind: 'needs-review'
      reason:
        | 'owner-birth-year-unknown'
        | 'birth-date-precision-insufficient'
        | 'born-1959-applicable-age-contested'
        | 'assertion-contradicts-derivation'
      detail: string // actionable, names the missing/contradicting fact
    }

/** One feasible birth-date / applicable-age candidate and its derived RBD year. */
interface RbdCandidate {
  /** Calendar year of the RBD (April 1 of that year). */
  rbdYear: number
  /** Calendar year the owner attains the applicable age (or 70½). */
  attainYear: number
  /** True when this candidate comes from the contested born-1959 dual ages. */
  fromBorn1959Contested: boolean
  /** Whether deathYear === rbdYear forced the assertion as a tie-break. */
  usedTieBreak: boolean
  comparison: RbdComparison
}

/**
 * Applicable ages for a fully-specified birth date. Born 1959 yields both 73 and
 * 75; every other settled date yields exactly one age (70½ is represented as the
 * special sentinel 70.5 only for documentation — callers use attain-year math).
 */
function applicableAgesForDate(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
): { ages: number[]; isSeventyAndHalf: boolean; fromBorn1959Contested: boolean } {
  // 70½ cohort: on or before 1949-06-30 (IRC §401(a)(9)(C); SECURE 2.0 §107).
  if (
    birthYear < 1949 ||
    (birthYear === 1949 && (birthMonth < 6 || (birthMonth === 6 && birthDay <= 30)))
  ) {
    return { ages: [70], isSeventyAndHalf: true, fromBorn1959Contested: false }
  }
  // Age-72 cohort: 1949-07-01 through 1950-12-31.
  if (birthYear < 1951) {
    return { ages: [72], isSeventyAndHalf: false, fromBorn1959Contested: false }
  }
  if (birthYear <= 1958) {
    return { ages: [73], isSeventyAndHalf: false, fromBorn1959Contested: false }
  }
  // Born 1959: contested between 73 and 75 — never collapse to a single age.
  if (birthYear === 1959) {
    return { ages: [73, 75], isSeventyAndHalf: false, fromBorn1959Contested: true }
  }
  return { ages: [75], isSeventyAndHalf: false, fromBorn1959Contested: false }
}

/**
 * Calendar year the owner attains the applicable age (or 70½).
 * For the 70½ tier: month ≤ 6 → birthYear+70; month ≥ 7 → birthYear+71.
 * For a whole-year applicable age: birthYear + age.
 */
function attainYearFor(
  birthYear: number,
  birthMonth: number,
  age: number,
  isSeventyAndHalf: boolean,
): number {
  if (isSeventyAndHalf) {
    // Age 70½ is attained six months after the 70th birthday.
    return birthMonth <= 6 ? birthYear + 70 : birthYear + 71
  }
  return birthYear + age
}

/** RBD calendar year: April 1 of the year after the attain year. */
function rbdYearFromAttain(attainYear: number): number {
  return attainYear + 1
}

/**
 * Feasible (month, day) pairs consistent with the known birth-date precision.
 * Year only → every month; year+month → that month (day 1 — each month sits
 * entirely on one side of the June 30 / July 1 1949 70½ cut). Full date → that
 * date alone.
 */
function enumerateBirthDates(
  ownerBirthMonth?: number,
  ownerBirthDay?: number,
): Array<{ month: number; day: number }> {
  if (ownerBirthMonth !== undefined && ownerBirthDay !== undefined) {
    return [{ month: ownerBirthMonth, day: ownerBirthDay }]
  }
  if (ownerBirthMonth !== undefined) {
    // Month known, day unknown: an entire month sits on one side of the 70½ cut.
    return [{ month: ownerBirthMonth, day: 1 }]
  }
  // Year only: every calendar month is a feasible candidate.
  const dates: Array<{ month: number; day: number }> = []
  for (let month = 1; month <= 12; month++) {
    dates.push({ month, day: 1 })
  }
  return dates
}

/**
 * Compare death year to a candidate RBD year. When they fall in the same
 * calendar year the death month is unknown, so the asserted RBD-status fact
 * legitimately breaks the tie.
 */
function compareDeathToRbd(
  deathYear: number,
  rbdYear: number,
  decedentHadStartedRmds: boolean,
): { comparison: RbdComparison; usedTieBreak: boolean } {
  if (deathYear < rbdYear) return { comparison: 'before-rbd', usedTieBreak: false }
  if (deathYear > rbdYear) return { comparison: 'on-or-after-rbd', usedTieBreak: false }
  return {
    comparison: decedentHadStartedRmds ? 'on-or-after-rbd' : 'before-rbd',
    usedTieBreak: true,
  }
}

function buildCandidates(input: RbdDerivationInput): RbdCandidate[] {
  const birthYear = input.ownerBirthYear!
  const dates = enumerateBirthDates(input.ownerBirthMonth, input.ownerBirthDay)
  const candidates: RbdCandidate[] = []
  const seen = new Set<string>()

  for (const { month, day } of dates) {
    const { ages, isSeventyAndHalf, fromBorn1959Contested } = applicableAgesForDate(
      birthYear,
      month,
      day,
    )
    for (const age of ages) {
      const attainYear = attainYearFor(birthYear, month, age, isSeventyAndHalf)
      const rbdYear = rbdYearFromAttain(attainYear)
      const key = `${rbdYear}:${fromBorn1959Contested}:${isSeventyAndHalf}:${age}`
      if (seen.has(key)) continue
      seen.add(key)
      const { comparison, usedTieBreak } = compareDeathToRbd(
        input.ownerDeathYear,
        rbdYear,
        input.decedentHadStartedRmds,
      )
      candidates.push({
        rbdYear,
        attainYear,
        fromBorn1959Contested,
        usedTieBreak,
        comparison,
      })
    }
  }
  return candidates
}

/**
 * Derive whether the owner died before or on/after the RBD from birth-date
 * precision and the asserted RBD-status fact.
 *
 * Unknown owner birth year: a before-RBD assertion is accepted (before-RBD
 * regimes never need the owner arm); a post-RBD assertion cannot proceed without
 * the owner's age for the greater-of arm and year-of-death RMD.
 */
export function deriveRbdComparison(input: RbdDerivationInput): RbdDerivation {
  if (input.ownerBirthYear === undefined) {
    if (!input.decedentHadStartedRmds) {
      return {
        kind: 'resolved',
        comparison: 'before-rbd',
        contestedApplicableAge: false,
      }
    }
    return {
      kind: 'needs-review',
      reason: 'owner-birth-year-unknown',
      detail:
        'ownerBirthYear is required when decedentHadStartedRmds is true (post-RBD regimes need the owner\'s age for the greater-of arm and the year-of-death RMD under Treas. Reg. §1.401(a)(9)-5(d)(1)(ii) and §1.408-8(e)(4)(i)); supply ownerBirthYear or set decedentHadStartedRmds to false',
    }
  }

  const candidates = buildCandidates(input)
  if (candidates.length === 0) {
    return {
      kind: 'needs-review',
      reason: 'birth-date-precision-insufficient',
      detail:
        'no feasible RBD candidates could be derived from the owner birth facts; supply a complete owner birth date',
    }
  }

  // Born-1959 contested ages produce two candidates like any other ambiguity:
  // the comparison is refused only when the candidates actually disagree (the
  // matrix scopes the born-1959 refusal to a "post-RBD-sensitive
  // classification"). A death year on which both candidate readings agree —
  // including via the same-year assertion tie-break — resolves normally.
  const comparisons = new Set(candidates.map((c) => c.comparison))
  if (comparisons.size === 1) {
    const comparison = candidates[0]!.comparison
    const anyTieBreak = candidates.some((c) => c.usedTieBreak)
    // Agreed answer contradicts the asserted fact only when no candidate needed
    // the assertion as a same-year tie-break (the assertion then has no legal
    // role and a mismatch is a contradictory plan fact).
    const asserted: RbdComparison = input.decedentHadStartedRmds
      ? 'on-or-after-rbd'
      : 'before-rbd'
    if (!anyTieBreak && comparison !== asserted) {
      return {
        kind: 'needs-review',
        reason: 'assertion-contradicts-derivation',
        detail: `decedentHadStartedRmds is ${input.decedentHadStartedRmds} but every feasible birth-date candidate derives death ${comparison === 'before-rbd' ? 'before' : 'on or after'} the RBD (owner birth ${input.ownerBirthYear}, death year ${input.ownerDeathYear}); correct decedentHadStartedRmds or the owner birth date`,
      }
    }
    return { kind: 'resolved', comparison, contestedApplicableAge: false }
  }

  // Candidates disagree on before vs on-or-after. Prefer the born-1959 reason
  // when that contest is the sole source of the split.
  const born1959InPlay = candidates.some((c) => c.fromBorn1959Contested)
  let reason: 'born-1959-applicable-age-contested' | 'birth-date-precision-insufficient' =
    'birth-date-precision-insufficient'
  if (born1959InPlay) {
    const non1959 = candidates.filter((c) => !c.fromBorn1959Contested)
    if (non1959.length === 0) {
      reason = 'born-1959-applicable-age-contested'
    } else {
      const non1959Comparisons = new Set(non1959.map((c) => c.comparison))
      if (non1959Comparisons.size === 1) {
        reason = 'born-1959-applicable-age-contested'
      }
    }
  }

  if (reason === 'born-1959-applicable-age-contested') {
    return {
      kind: 'needs-review',
      reason,
      detail:
        'owner born 1959 has a contested applicable age (73 vs 75 under SECURE 2.0 §107; Prop. Reg. §1.401(a)(9)-2 would resolve to 73 but the final paragraph remains reserved, and Announcement 2026-7 does not address it), and the feasible RBD years straddle the death year so death-vs-RBD cannot be settled; supply a settled applicable-age resolution or a death year outside both candidate RBD years',
    }
  }

  return {
    kind: 'needs-review',
    reason: 'birth-date-precision-insufficient',
    detail: `owner birth date precision is insufficient to place death year ${input.ownerDeathYear} before or on/after the RBD (feasible candidates disagree); supply ownerBirthMonth${input.ownerBirthYear === 1949 ? ' and ownerBirthDay (the July 1, 1949 70½ boundary)' : ''} or correct ownerBirthYear`,
  }
}

/**
 * Feasible calendar years the owner would attain the applicable age; two entries
 * when the applicable age is contested (born 1959) or when year-only precision
 * leaves the 70½ attain year ambiguous.
 *
 * Used by spouse life-expectancy deferral under Treas. Reg. §1.401(a)(9)-3(d)
 * (commencement deferred to the end of the year the owner would have attained
 * the applicable age).
 */
export function applicableAgeAttainYears(
  ownerBirthYear: number,
  ownerBirthMonth?: number,
): number[] {
  const years = new Set<number>()

  if (ownerBirthYear === 1959) {
    years.add(ownerBirthYear + 73)
    years.add(ownerBirthYear + 75)
    return [...years].sort((a, b) => a - b)
  }

  if (ownerBirthYear >= 1960) {
    return [ownerBirthYear + 75]
  }
  if (ownerBirthYear >= 1951) {
    return [ownerBirthYear + 73]
  }

  // 1949–1950 and the 70½ cohort.
  const months =
    ownerBirthMonth !== undefined
      ? [ownerBirthMonth]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  for (const month of months) {
    // Day 1 is enough: each month sits entirely on one side of the June 30 /
    // July 1 1949 cut.
    const { ages, isSeventyAndHalf } = applicableAgesForDate(ownerBirthYear, month, 1)
    for (const age of ages) {
      years.add(attainYearFor(ownerBirthYear, month, age, isSeventyAndHalf))
    }
  }

  return [...years].sort((a, b) => a - b)
}
