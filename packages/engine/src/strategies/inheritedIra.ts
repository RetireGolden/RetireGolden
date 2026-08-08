/**
 * Inherited (beneficiary) IRA 10-year rule (roadmap V8, §4 tax depth) and the
 * WS3 regime engine (classifier + annual requirement calculator).
 *
 * Post-SECURE-Act, a non-spouse beneficiary must empty an inherited IRA by the
 * end of the 10th year after the original owner's death. If the owner had
 * already reached their required beginning date (RBD) — i.e. had started RMDs —
 * the beneficiary must ALSO take an annual RMD in years 1–9, because the
 * at-least-as-rapidly rule of section 401(a)(9)(B)(i) survives the death. If
 * the owner died before their RBD, no annual RMD is required during the window;
 * the only requirement is to be empty by year 10.
 *
 * Inherited-IRA distributions are taxable ordinary income but are NEVER subject
 * to the 10% early-withdrawal penalty, regardless of the beneficiary's age.
 *
 * The annual divisor is the beneficiary's remaining life expectancy from the
 * Single Life Table of Treas. Reg. 1.401(a)(9)-9(b), carried in the parameter
 * pack. Treas. Reg. 1.401(a)(9)-5(d)(3)(i) is explicit that "all life
 * expectancies are determined using the Single Life Table in § 1.401(a)(9)-9(b)"
 * — that table and no other. It is unisex, which is why nothing here takes a
 * sex: an SSA period table indexed by sex is not the prescribed table, and the
 * divisor it produces is not the prescribed number.
 *
 * The expectancy is FIXED, not recalculated. Under 1.401(a)(9)-5(d)(3)(iii) a
 * non-spouse designated beneficiary reads the table once, at the age reached in
 * the calendar year FOLLOWING the year of death, and then reduces that entry by
 * one for each later calendar year. Only a surviving spouse who is the sole
 * beneficiary redetermines annually, under (d)(3)(iv).
 *
 * The legacy `inheritedForcedAmount` path still omits the greater-of owner arm
 * of §1.401(a)(9)-5(d)(1)(ii); `inheritedRequirementForYear` implements that arm
 * for classified regimes. WS4 wires the schedule into the projection ledger.
 *
 * @see DOCS/domain/inherited-ira-regime-matrix.md
 */

import type { InheritedAccount } from '../model/plan.js'
import {
  singleLifeExpectancyYears,
  uniformLifetimeDivisor,
} from '../params/index.js'
import type { ParameterPack } from '../params/types.js'
import {
  applicableAgeAttainYears,
  deriveRbdComparison,
} from '../rmd/applicableAge.js'
import { jointLifeTableDivisor } from '../rmd/jointLifeTable.js'

/** The account must be fully distributed by the END of this year. */
export function inheritedTenYearDeadline(ownerDeathYear: number): number {
  return ownerDeathYear + 10
}

/**
 * The calendar year the beneficiary's fixed life expectancy is read at: the
 * calendar year following the calendar year of the employee's death, which is
 * the year 1.401(a)(9)-5(d)(3)(iii) names for the initial table lookup and
 * measures its subtract-one reductions from.
 */
export function beneficiaryFirstDistributionYear(ownerDeathYear: number): number {
  return ownerDeathYear + 1
}

/**
 * The beneficiary's remaining life expectancy for `year`, per Treas. Reg.
 * 1.401(a)(9)-5(d)(3)(i) and (d)(3)(iii): the Single Life Table entry for the
 * age the beneficiary reaches in the first distribution calendar year, reduced
 * by one for each calendar year elapsed since that year.
 *
 * May return zero or a negative number once the fixed entry has been exhausted;
 * the caller decides what that means for the distribution.
 */
export function beneficiaryRemainingLifeExpectancy(
  pack: ParameterPack,
  input: { year: number; ownerDeathYear: number; beneficiaryAge: number },
): number {
  const elapsed = input.year - beneficiaryFirstDistributionYear(input.ownerDeathYear)
  // `beneficiaryAge` is the age attained in `year`; walk it back to the age
  // attained in the first distribution year, which is the only age the table is
  // ever read at for this account.
  const ageInFirstYear = input.beneficiaryAge - elapsed
  return singleLifeExpectancyYears(pack, ageInFirstYear) - elapsed
}

export interface InheritedForcedInput {
  /** Parameter pack supplying the Single Life Table. */
  pack: ParameterPack
  /** Current projection year. */
  year: number
  /** Calendar year the original owner died. */
  ownerDeathYear: number
  /** Did the decedent reach their RBD (had started RMDs)? Drives years 1–9. */
  decedentHadStartedRmds: boolean
  /** Current account balance. */
  balance: number
  /** Start-of-year balance, used for the annual-RMD divisor. */
  startBalance: number
  /** Beneficiary's attained age this year. */
  beneficiaryAge: number
}

/**
 * The forced distribution required from an inherited IRA this year:
 *   - the full remaining balance in (and after) the 10th year — the final sweep;
 *   - an annual single-life RMD in years 1–9 when the decedent had started RMDs;
 *   - otherwise 0 (the beneficiary may still withdraw voluntarily).
 * Never exceeds the current balance.
 */
export function inheritedForcedAmount(input: InheritedForcedInput): number {
  const { year, ownerDeathYear, balance } = input
  if (balance <= 0 || year <= ownerDeathYear) return 0

  if (year >= inheritedTenYearDeadline(ownerDeathYear)) return balance // empty it by year 10

  if (input.decedentHadStartedRmds) {
    const le = beneficiaryRemainingLifeExpectancy(input.pack, input)
    // A fixed expectancy that has run out leaves nothing to divide by, so the
    // entire remaining interest is due. Reachable only for a beneficiary past
    // about age 110 when they inherit, since the window is at most nine years.
    if (le <= 0) return balance
    return Math.min(input.startBalance / le, balance)
  }
  return 0
}

// ---------------------------------------------------------------------------
// WS3 regime engine — classifier + annual requirement calculator
// ---------------------------------------------------------------------------

export type InheritedRegimeKey =
  | 'ten-year-with-annual-rmds' // R1
  | 'ten-year-no-annual' // R2
  | 'edb-life-expectancy' // R3
  | 'edb-ten-year-elected' // R3a
  | 'spouse-remain-beneficiary' // S0 (default) and S1 (explicit)
  | 'spouse-treat-as-own-transition' // S2
  | 'spouse-ten-year-elected' // S3
  | 'roth-ten-year-no-annual' // K1
  | 'roth-edb-life-expectancy' // K2

export type InheritedRefusalKey =
  | 'legacy-planning-approximation' // X1 and traditional accounts without a beneficiary block
  | 'unsupported' // X2/X3/X4, S4
  | 'needs-review' // X5, S3x, RBD needs-review

export type MatrixRow =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R3a'
  | 'S0'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S3x'
  | 'S4'
  | 'K1'
  | 'K2'
  | 'X1'
  | 'X2'
  | 'X3'
  | 'X4'
  | 'X5'

export type RegimeDisclosure =
  | 'prop-reg-spouse-as-employee' // S1/K2 death-before-RBD spouse rows (§327 overlay)
  | 'ira-agreement-election' // R3a/S3 (the §1.401(a)(9)-3(c)(5)(iii) election)
  | 'deemed-election-risk' // S0 (§1.408-8(c)(2))
  | 'roth-taxability-needs-review' // K rows without roth5YearStartYear (K3)
  | 'edb-category-year-precision-unverified' // 10-year-gap arithmetic ambiguous at year precision
  // Life-expectancy regimes end early if the beneficiary dies: the successor
  // 10-year clock of §1.401(a)(9)-5(e)(3) is out of scope (matrix X2), so the
  // schedule is flagged as terminating on an unmodeled rule, never extended.
  | 'successor-clock-out-of-scope'
  /**
   * S2: §1.408-8(c)(1)(iii)–(iv) timing bar is not consulted because the prior
   * ten-year-election fact is unrepresentable alongside `treat-as-own`; the
   * flip is executed as asserted on `treatAsOwnElectionYear`.
   */
  | 'treat-as-own-timing-gate-unverified'

export interface InheritedRegimeClassification {
  kind: 'regime'
  regime: InheritedRegimeKey
  row: MatrixRow
  classification: 'settled' | 'unsettled'
  rbdComparison: 'before-rbd' | 'on-or-after-rbd' | 'not-applicable' // Roth: always 'before-rbd'
  citations: string[] // operative subparagraphs from the matrix row
  disclosures: RegimeDisclosure[]
  /** End of the calendar year by which the entire interest must be distributed, when fixed. */
  finalDeadlineYear?: number // deathYear+10 for the 10-year rows; majority+10 for minor child
  /** Minor child: the calendar year of the 21st birthday (birthYear + 21). */
  minorMajorityYear?: number
}

export interface InheritedRegimeRefusal {
  kind: 'refusal'
  refusal: InheritedRefusalKey
  row: MatrixRow
  citations: string[]
  /** Actionable, names the missing rule or fact — matches the repo's message style. */
  reason: string
}

export type InheritedRegimeResult = InheritedRegimeClassification | InheritedRegimeRefusal

const CITATIONS = {
  R1: [
    'IRC §401(a)(9)(B)(i)',
    'IRC §401(a)(9)(H)(i)–(ii)',
    'Treas. Reg. §1.401(a)(9)-5(d)(1)(i)–(ii)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(i)–(iii)',
    'Treas. Reg. §1.401(a)(9)-5(e)(2)',
    'Notices 2022-53/2023-54/2024-35',
  ],
  R2: [
    'IRC §401(a)(9)(B)(ii)',
    'IRC §401(a)(9)(H)(i)',
    'Treas. Reg. §1.401(a)(9)-3(c)(3)',
    'Treas. Reg. §1.401(a)(9)-3(c)(5)(i)',
    'Treas. Reg. §1.401(a)(9)-5(e)(2)',
  ],
  R3: [
    'IRC §401(a)(9)(B)(iii)',
    'IRC §401(a)(9)(E)(ii)–(iii)',
    'IRC §401(a)(9)(H)(ii)',
    'Treas. Reg. §1.401(a)(9)-4(e)',
    'Treas. Reg. §1.401(a)(9)-3(c)(4)',
    'Treas. Reg. §1.401(a)(9)-3(c)(5)(i)',
    'Treas. Reg. §1.401(a)(9)-5(d)(1)(ii)',
    'Treas. Reg. §1.401(a)(9)-5(d)(2)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(iii)',
    'Treas. Reg. §1.401(a)(9)-5(e)(1)',
    'Treas. Reg. §1.401(a)(9)-5(e)(4)',
  ],
  R3a: ['Treas. Reg. §1.401(a)(9)-3(c)(5)(iii)'],
  S0: [
    'Treas. Reg. §1.401(a)(9)-3(c)(5)(i)',
    'IRC §401(a)(9)(B)(i)',
    'Treas. Reg. §1.401(a)(9)-3(d)',
    'Treas. Reg. §1.401(a)(9)-5(d)(1)',
    'Treas. Reg. §1.401(a)(9)-5(d)(2)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)',
    'Treas. Reg. §1.408-8(c)(2)',
  ],
  S1: [
    'IRC §401(a)(9)(B)(iii)–(iv)',
    'Treas. Reg. §1.401(a)(9)-3(d)',
    'Treas. Reg. §1.401(a)(9)-5(d)(1)(ii)',
    'Treas. Reg. §1.401(a)(9)-5(d)(2)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(ii)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)',
  ],
  S2: [
    'IRC §408(d)(3)(C)(ii)',
    'Treas. Reg. §1.408-8(c)(1)(i)–(iv)',
    'Treas. Reg. §1.408-8(c)(3)',
  ],
  S3: [
    'Treas. Reg. §1.401(a)(9)-3(c)(3)',
    'Treas. Reg. §1.401(a)(9)-3(c)(5)(iii)',
  ],
  S3x: [
    'Treas. Reg. §1.401(a)(9)-3(c)(5)(iii)',
  ],
  // S4 is presently unreachable: the WS2 schema carries no fact by which a
  // household could assert §327 spouse-as-employee treatment as governing, so
  // the fail-closed refusal the matrix specifies has no trigger until a later
  // workstream adds that assertion path. The row and citations are kept so the
  // matrix row numbering and the eventual refusal share one source of truth.
  S4: [
    'Treas. Reg. §1.401(a)(9)-5(g)(3)(ii)',
    'REG-103529-23',
    'Announcement 2026-7',
  ],
  K1: [
    'Treas. Reg. §1.408A-6, A-14(b)',
    'IRC §401(a)(9)(H)(i) via §408(a)(6)',
    'Treas. Reg. §1.401(a)(9)-3(c)(3)',
    'Treas. Reg. §1.401(a)(9)-5(e)(2)',
  ],
  K2: [
    'Treas. Reg. §1.408A-6, A-14(b)',
    'Treas. Reg. §1.401(a)(9)-3(c)(4)',
    'Treas. Reg. §1.401(a)(9)-3(d)',
    'Treas. Reg. §1.401(a)(9)-5(d)(2)',
    'Treas. Reg. §1.401(a)(9)-5(d)(3)(iii)–(iv)',
  ],
  X1: ['SECURE Act §401(b)(1)'],
  X2: [
    'IRC §401(a)(9)(H)(iii)',
    'Treas. Reg. §1.401(a)(9)-5(e)(3)',
    'SECURE Act §401(b)(5)',
  ],
  X3: ['Treas. Reg. §1.401(a)(9)-4(f)'],
  X4: ['Treas. Reg. §1.401(a)(9)-8(a)'],
  X5: ['DOCS/domain/inherited-ira-regime-matrix.md §2'],
} as const

function refusal(
  refusalKey: InheritedRefusalKey,
  row: MatrixRow,
  reason: string,
  citations?: string[],
): InheritedRegimeRefusal {
  return {
    kind: 'refusal',
    refusal: refusalKey,
    row,
    citations: citations ?? [...CITATIONS[row]],
    reason,
  }
}

/**
 * Birth-year gap of beneficiary minus owner. Positive means the beneficiary is
 * younger. §1.401(a)(9)-4(e)(6) measures birth-date to birth-date; year-only
 * arithmetic is certain only outside the exact-10-year boundary.
 */
function birthYearGap(ownerBirthYear: number, beneficiaryBirthYear: number): number {
  return beneficiaryBirthYear - ownerBirthYear
}

/**
 * Fact-consistency screens (matrix X5) that do not depend on RBD derivation.
 * Returns a refusal when a contradiction is certain, or a disclosure to attach
 * when year-precision arithmetic is ambiguous but the assertion is kept.
 */
function factConsistencyScreen(input: {
  accountType: 'traditional' | 'roth'
  inherited: InheritedAccount
}): InheritedRegimeRefusal | { disclosures: RegimeDisclosure[] } {
  const b = input.inherited.beneficiary
  if (b === undefined) return { disclosures: [] }

  const disclosures: RegimeDisclosure[] = []
  const ownerBirth = b.ownerBirthYear
  const benBirth = b.beneficiaryBirthYear
  const edb = b.edbCategory
  const election = b.election
  const deathYear = input.inherited.ownerDeathYear

  if (
    input.accountType === 'roth' &&
    b.roth5YearStartYear !== undefined &&
    b.roth5YearStartYear > deathYear
  ) {
    return refusal(
      'needs-review',
      'X5',
      `roth5YearStartYear ${b.roth5YearStartYear} is after ownerDeathYear ${deathYear}; an owner cannot make their first Roth contribution after death — correct roth5YearStartYear or ownerDeathYear`,
    )
  }

  if (
    b.roth5YearStartYear !== undefined &&
    b.ownerBirthYear !== undefined &&
    b.roth5YearStartYear < b.ownerBirthYear
  ) {
    return refusal(
      'needs-review',
      'X5',
      `roth5YearStartYear ${b.roth5YearStartYear} is before ownerBirthYear ${b.ownerBirthYear}; a first Roth contribution cannot precede the owner's birth — correct roth5YearStartYear or ownerBirthYear`,
    )
  }

  // Spouse-only elections with a non-spouse EDB category.
  if (
    (election === 'remain-beneficiary' || election === 'treat-as-own') &&
    edb !== 'surviving-spouse'
  ) {
    return refusal(
      'needs-review',
      'X5',
      `election '${election}' requires edbCategory 'surviving-spouse'; set edbCategory to 'surviving-spouse' or clear/change the election`,
    )
  }

  // Minor-child majority checks at year precision (§1.401(a)(9)-4(e)(3)).
  if (edb === 'minor-child' && benBirth !== undefined) {
    const majorityYear = benBirth + 21
    if (deathYear > majorityYear) {
      return refusal(
        'needs-review',
        'X5',
        `edbCategory 'minor-child' is contradicted by the death year (owner died in ${deathYear} after the beneficiary's majority year ${majorityYear}; majority is the 21st birthday under Treas. Reg. §1.401(a)(9)-4(e)(3)) — correct beneficiaryBirthYear, ownerDeathYear, or edbCategory`,
      )
    }
    if (deathYear === majorityYear) {
      return refusal(
        'needs-review',
        'X5',
        `edbCategory 'minor-child' is ambiguous at year precision (death year ${deathYear} equals the majority year ${majorityYear}; the beneficiary may still have been 20 on the date of death under Treas. Reg. §1.401(a)(9)-4(e)(3)) — confirm the beneficiary was under 21 on the date of death or correct the facts`,
      )
    }
  }

  // not-more-than-10-years-younger arithmetic (§1.401(a)(9)-4(e)(6)).
  if (edb === 'not-more-than-10-years-younger' && benBirth !== undefined) {
    if (ownerBirth === undefined) {
      disclosures.push('edb-category-year-precision-unverified')
    } else {
      const gap = birthYearGap(ownerBirth, benBirth)
      // Certain contradiction: beneficiary younger by ≥ 11 birth years.
      if (gap >= 11) {
        return refusal(
          'needs-review',
          'X5',
          `edbCategory 'not-more-than-10-years-younger' is contradicted by birth years (beneficiary birth year ${benBirth} is ${gap} years after owner birth year ${ownerBirth}; Treas. Reg. §1.401(a)(9)-4(e)(6) measures birth-date to birth-date and a ≥11-year gap is certain) — correct ownerBirthYear, beneficiaryBirthYear, or edbCategory`,
        )
      }
      // Gap of exactly 10 birth years is date-ambiguous unless the owner's full
      // birth date is December 31 — then every feasible beneficiary date in the
      // later birth year is at most exactly 10 years after the owner's date.
      if (gap === 10) {
        const ownerDec31 =
          b.ownerBirthMonth === 12 && b.ownerBirthDay === 31
        if (!ownerDec31) {
          disclosures.push('edb-category-year-precision-unverified')
        }
      }
    }
  }

  // edbCategory 'none' contradicted by certain not-more-than-10-years-younger arithmetic.
  if (edb === 'none' && benBirth !== undefined && ownerBirth !== undefined) {
    const gap = birthYearGap(ownerBirth, benBirth)
    // Beneficiary not younger, or younger by ≤ 9 birth years → certainly an EDB
    // under the not-more-than-10-years-younger class, contradicting 'none'.
    if (gap <= 9) {
      return refusal(
        'needs-review',
        'X5',
        `edbCategory 'none' is contradicted by birth years (beneficiary birth year ${benBirth} and owner birth year ${ownerBirth} place the beneficiary as not more than 10 years younger under Treas. Reg. §1.401(a)(9)-4(e)(6)); assert edbCategory 'not-more-than-10-years-younger' (or another applicable EDB class) or correct the birth years`,
      )
    }
    if (gap === 10) {
      const ownerDec31 =
        b.ownerBirthMonth === 12 && b.ownerBirthDay === 31
      if (ownerDec31) {
        return refusal(
          'needs-review',
          'X5',
          `edbCategory 'none' is contradicted by birth dates (owner born December 31, ${ownerBirth}, beneficiary birth year ${benBirth} places the beneficiary as not more than 10 years younger under Treas. Reg. §1.401(a)(9)-4(e)(6); the December 31 boundary makes the gap certain) — assert edbCategory 'not-more-than-10-years-younger' (or another applicable EDB class) or correct the birth facts`,
        )
      }
      disclosures.push('edb-category-year-precision-unverified')
    }
  }

  return { disclosures }
}

/**
 * Classify an inherited IRA into a matrix regime row or a typed refusal.
 * Precedence: X rows → S rows → R/K rows. Total over parsed plan facts.
 *
 * @see DOCS/domain/inherited-ira-regime-matrix.md §3
 */
export function classifyInheritedRegime(input: {
  accountType: 'traditional' | 'roth'
  /** IRA vs employer plan; employer plans are refused before X1. */
  accountKind: 'ira' | 'employer'
  inherited: InheritedAccount
}): InheritedRegimeResult {
  const { accountType, accountKind, inherited } = input
  const deathYear = inherited.ownerDeathYear
  const b = inherited.beneficiary

  if (accountKind === 'employer') {
    return refusal(
      'unsupported',
      'X5',
      'this matrix scopes inherited support to IRAs (DOCS/domain/inherited-ira-regime-matrix.md scope note); employer-plan beneficiary rules — plan-permitted elections, still-working RBD, §402(c)(11) transfers — are not modeled — supply an IRA account or leave the employer account on the legacy path',
    )
  }

  // X1: pre-SECURE deaths (even with a full beneficiary block).
  if (deathYear < 2020) {
    return refusal(
      'legacy-planning-approximation',
      'X1',
      `ownerDeathYear ${deathYear} is before 2020 (SECURE Act §401(b)(1) boundary); pre-SECURE beneficiary regimes are not modeled — use the labeled legacy-planning-approximation path`,
    )
  }

  // Without a beneficiary block: traditional → X1-style legacy approximation; Roth → required facts (never legacy).
  if (b === undefined) {
    if (accountType === 'roth') {
      // No legacy path exists for Roth (the two-field era never covered it),
      // so the refusal is a missing-facts needs-review, not X1.
      return refusal(
        'needs-review',
        'X5',
        'beneficiary block is required on inherited Roth accounts (no legacy approximation covers Roth); supply beneficiaryClass, edbCategory, beneficiaryBirthYear, soleBeneficiary, and provenance',
      )
    }
    return refusal(
      'legacy-planning-approximation',
      'X1',
      "beneficiary block is missing on this traditional inherited account; supply beneficiaryClass, edbCategory, beneficiaryBirthYear, soleBeneficiary, and provenance, or keep the labeled legacy-planning-approximation path",
    )
  }

  // X2: successor beneficiary.
  if (b.beneficiaryClass === 'successor-beneficiary') {
    return refusal(
      'unsupported',
      'X2',
      "beneficiaryClass 'successor-beneficiary' is unsupported (IRC §401(a)(9)(H)(iii); Treas. Reg. §1.401(a)(9)-5(e)(3)); successor 10-year schedules are out of scope",
    )
  }

  // X3: estate / trust / entity.
  if (
    b.beneficiaryClass === 'estate' ||
    b.beneficiaryClass === 'trust' ||
    b.beneficiaryClass === 'entity'
  ) {
    return refusal(
      'unsupported',
      'X3',
      `beneficiaryClass '${b.beneficiaryClass}' is unsupported (see-through trust and non-individual rules of Treas. Reg. §1.401(a)(9)-4(f) are not modeled)`,
    )
  }

  // From here the beneficiary is a designated individual.
  // X4: multiple beneficiaries without separate-account facts.
  if (b.soleBeneficiary === false) {
    return refusal(
      'unsupported',
      'X4',
      'soleBeneficiary is false (multiple beneficiaries without separate-account facts are unsupported under Treas. Reg. §1.401(a)(9)-8(a)); set soleBeneficiary to true or supply separate-account facts outside this engine',
    )
  }
  // Missing sole-beneficiary status is a missing required fact (matrix §2): the
  // parser requires it for designated individuals, but the classifier is total
  // over its input type and never lets an unknown status reach an R/S/K row.
  if (b.beneficiaryClass === 'designated-individual' && b.soleBeneficiary === undefined) {
    return refusal(
      'needs-review',
      'X5',
      'soleBeneficiary is required for a designated-individual beneficiary (matrix §2; the R/S/K rows bind only for a sole beneficiary); set it to true or false',
    )
  }
  if (b.beneficiaryClass === 'designated-individual' && b.beneficiaryBirthYear === undefined) {
    return refusal(
      'needs-review',
      'X5',
      "beneficiaryBirthYear is required for a designated-individual beneficiary (matrix §2: required for any regime with an annual life-expectancy amount and for consistency checks); supply the beneficiary's birth year",
    )
  }

  // Fact consistency (X5).
  const consistency = factConsistencyScreen(input)
  if ('kind' in consistency) return consistency
  const baseDisclosures = [...consistency.disclosures]

  // Roth is always before-RBD (§1.408A-6, A-14(b)); an asserted post-RBD fact is contradictory.
  if (accountType === 'roth' && inherited.decedentHadStartedRmds) {
    return refusal(
      'needs-review',
      'X5',
      'decedentHadStartedRmds true is contradictory for an inherited Roth account (Treas. Reg. §1.408A-6, A-14(b) treats a Roth owner as dying before the RBD; the account has no lifetime RMDs and cannot have started RMDs) — set decedentHadStartedRmds to false',
    )
  }

  // RBD derivation — traditional only. Roth is always before-RBD (§1.408A-6, A-14(b)).
  let rbdComparison: 'before-rbd' | 'on-or-after-rbd'
  if (accountType === 'roth') {
    rbdComparison = 'before-rbd'
  } else {
    const derivation = deriveRbdComparison({
      ownerDeathYear: deathYear,
      decedentHadStartedRmds: inherited.decedentHadStartedRmds,
      ownerBirthYear: b.ownerBirthYear,
      ownerBirthMonth: b.ownerBirthMonth,
      ownerBirthDay: b.ownerBirthDay,
    })
    if (derivation.kind === 'needs-review') {
      return refusal('needs-review', 'X5', derivation.detail)
    }
    rbdComparison = derivation.comparison
  }

  // S3x: ten-year-election when derived (or asserted) post-RBD.
  if (b.election === 'ten-year-election' && rbdComparison === 'on-or-after-rbd') {
    return refusal(
      'needs-review',
      'S3x',
      "election 'ten-year-election' applies only when death is before the RBD (Treas. Reg. §1.401(a)(9)-3(c)(5)(iii)); the derived RBD comparison is on-or-after-rbd — set decedentHadStartedRmds/owner birth facts consistently or clear the election",
      [...CITATIONS.S3x],
    )
  }

  const edb = b.edbCategory
  const election = b.election
  const isSpouse = edb === 'surviving-spouse'
  const isNonSpouseEdb =
    edb === 'minor-child' ||
    edb === 'disabled' ||
    edb === 'chronically-ill' ||
    edb === 'not-more-than-10-years-younger'

  // Spouse life-expectancy regimes (S0/S1 and the K2 spouse arm) depend on the
  // §1.401(a)(9)-3(d) deferral end year — the year the owner would have
  // attained the applicable age — whenever death is before the RBD (always,
  // for Roth). That year is underivable without the owner's birth year and
  // contested for a born-1959 owner, so both classify needs-review rather
  // than commencing the spouse schedule on a guessed year. Non-deferral
  // spouse rows (S2, S3) are unaffected.
  if (
    isSpouse &&
    (election === 'remain-beneficiary' || election === 'none' || election === undefined) &&
    (accountType === 'roth' || rbdComparison === 'before-rbd')
  ) {
    if (b.ownerBirthYear === undefined) {
      return refusal(
        'needs-review',
        'X5',
        'ownerBirthYear is required for a spouse remain-beneficiary classification when death is before the RBD (the Treas. Reg. §1.401(a)(9)-3(d) commencement deferral runs to the year the owner would have attained the applicable age); supply ownerBirthYear',
      )
    }
    const attainYears = applicableAgeAttainYears(b.ownerBirthYear, b.ownerBirthMonth)
    // Ambiguity matters only when it survives the §-3(d) "later of" clamp:
    // commencement is the later of deathYear+1 and the attain year, so attain
    // years that both fall at or before deathYear+1 yield one start year.
    const startYears = new Set(attainYears.map((y) => Math.max(deathYear + 1, y)))
    if (startYears.size > 1) {
      return refusal(
        'needs-review',
        'X5',
        `owner born ${b.ownerBirthYear} has an ambiguous applicable-age attain year (${attainYears.join(' vs ')}), so the spouse life-expectancy deferral end year under Treas. Reg. §1.401(a)(9)-3(d) cannot be settled; supply owner birth month or a settled applicable-age resolution`,
      )
    }
  }

  const rothTaxabilityDisclosure = (): RegimeDisclosure[] => {
    if (accountType === 'roth' && b.roth5YearStartYear === undefined) {
      return ['roth-taxability-needs-review']
    }
    return []
  }

  // ---- Spouse rows (S0–S3) ----
  if (isSpouse) {
    if (election === 'treat-as-own') {
      // spouseUnlimitedWithdrawalRight false is a parse error; undefined → needs-review.
      if (b.spouseUnlimitedWithdrawalRight !== true) {
        return refusal(
          'needs-review',
          'X5',
          "election 'treat-as-own' requires spouseUnlimitedWithdrawalRight true (Treas. Reg. §1.408-8(c)(1)); set spouseUnlimitedWithdrawalRight to true or choose a different election",
        )
      }
      // Parse-optional for migration: pre-WS4 plans may carry treat-as-own
      // without a year. Refuse closed so the ledger falls onto the labeled
      // legacy path rather than inventing a flip year.
      if (b.treatAsOwnElectionYear === undefined) {
        return refusal(
          'needs-review',
          'X5',
          "election 'treat-as-own' requires treatAsOwnElectionYear (the calendar year the spouse redesignates this account as their own IRA, Treas. Reg. §1.408-8(c)(1)-(2)); supply treatAsOwnElectionYear on or after ownerDeathYear",
        )
      }
      return {
        kind: 'regime',
        regime: 'spouse-treat-as-own-transition',
        row: 'S2',
        classification: 'settled',
        rbdComparison: accountType === 'roth' ? 'before-rbd' : rbdComparison,
        citations: [...CITATIONS.S2],
        disclosures: [
          ...baseDisclosures,
          'treat-as-own-timing-gate-unverified',
          ...rothTaxabilityDisclosure(),
        ],
      }
    }

    if (election === 'ten-year-election') {
      // Before-RBD only (S3x handled above). Traditional or Roth → S3.
      return {
        kind: 'regime',
        regime: 'spouse-ten-year-elected',
        row: 'S3',
        classification: 'unsettled',
        rbdComparison: accountType === 'roth' ? 'before-rbd' : rbdComparison,
        citations: [...CITATIONS.S3],
        disclosures: [
          ...baseDisclosures,
          'ira-agreement-election',
          ...rothTaxabilityDisclosure(),
        ],
        finalDeadlineYear: deathYear + 10,
      }
    }

    // remain-beneficiary (S1) or none/undefined (S0).
    const isExplicitRemain = election === 'remain-beneficiary'
    const row: MatrixRow = isExplicitRemain ? 'S1' : 'S0'
    const disclosures: RegimeDisclosure[] = [...baseDisclosures, 'successor-clock-out-of-scope']
    if (!isExplicitRemain) disclosures.push('deemed-election-risk')

    if (accountType === 'roth') {
      // Roth spouse remain/none → K2 (always before-RBD arm; §327 disclosure only from 2024 commencement).
      const commencementYear = spouseDeferralStartYear(
        deathYear,
        b.ownerBirthYear,
        b.ownerBirthMonth,
      )
      const section327Unsettled = commencementYear >= 2024
      if (section327Unsettled) {
        disclosures.push('prop-reg-spouse-as-employee')
      }
      disclosures.push(...rothTaxabilityDisclosure())
      return {
        kind: 'regime',
        regime: 'roth-edb-life-expectancy',
        row: 'K2',
        classification: section327Unsettled ? 'unsettled' : 'settled',
        rbdComparison: 'before-rbd',
        citations: [...CITATIONS.K2],
        disclosures,
      }
    }

    // Traditional spouse remain/none.
    let spouseClassification: 'settled' | 'unsettled'
    if (rbdComparison === 'on-or-after-rbd') {
      spouseClassification = 'settled'
    } else {
      const commencementYear = spouseDeferralStartYear(
        deathYear,
        b.ownerBirthYear,
        b.ownerBirthMonth,
      )
      if (commencementYear >= 2024) {
        disclosures.push('prop-reg-spouse-as-employee')
        spouseClassification = 'unsettled'
      } else {
        spouseClassification = 'settled'
      }
    }
    return {
      kind: 'regime',
      regime: 'spouse-remain-beneficiary',
      row,
      classification: spouseClassification,
      rbdComparison,
      citations: [...(isExplicitRemain ? CITATIONS.S1 : CITATIONS.S0)],
      disclosures,
    }
  }

  // ---- Non-spouse EDB (R3 / R3a / K2) ----
  if (isNonSpouseEdb) {
    if (election === 'ten-year-election') {
      return {
        kind: 'regime',
        regime: 'edb-ten-year-elected',
        row: 'R3a',
        classification: 'unsettled',
        rbdComparison: accountType === 'roth' ? 'before-rbd' : rbdComparison,
        citations: [...CITATIONS.R3a],
        disclosures: [
          ...baseDisclosures,
          'ira-agreement-election',
          ...rothTaxabilityDisclosure(),
        ],
        finalDeadlineYear: deathYear + 10,
      }
    }

    // Life-expectancy default.
    if (accountType === 'roth') {
      return {
        kind: 'regime',
        regime: 'roth-edb-life-expectancy',
        row: 'K2',
        classification: 'settled',
        rbdComparison: 'before-rbd',
        citations: [...CITATIONS.K2],
        disclosures: [
          ...baseDisclosures,
          'successor-clock-out-of-scope',
          ...rothTaxabilityDisclosure(),
        ],
        ...(edb === 'minor-child' && b.beneficiaryBirthYear !== undefined
          ? {
              minorMajorityYear: b.beneficiaryBirthYear + 21,
              finalDeadlineYear: b.beneficiaryBirthYear + 21 + 10,
            }
          : {}),
      }
    }

    // Traditional R3.
    const minorFields =
      edb === 'minor-child' && b.beneficiaryBirthYear !== undefined
        ? {
            minorMajorityYear: b.beneficiaryBirthYear + 21,
            finalDeadlineYear: b.beneficiaryBirthYear + 21 + 10,
          }
        : {}
    return {
      kind: 'regime',
      regime: 'edb-life-expectancy',
      row: 'R3',
      classification: 'settled',
      rbdComparison,
      citations: [...CITATIONS.R3],
      disclosures: [...baseDisclosures, 'successor-clock-out-of-scope'],
      ...minorFields,
    }
  }

  // ---- Designated individual, edbCategory 'none' (R1 / R2 / K1) ----
  if (edb === 'none') {
    if (accountType === 'roth') {
      return {
        kind: 'regime',
        regime: 'roth-ten-year-no-annual',
        row: 'K1',
        classification: 'settled',
        rbdComparison: 'before-rbd',
        citations: [...CITATIONS.K1],
        disclosures: [...baseDisclosures, ...rothTaxabilityDisclosure()],
        finalDeadlineYear: deathYear + 10,
      }
    }
    if (rbdComparison === 'on-or-after-rbd') {
      return {
        kind: 'regime',
        regime: 'ten-year-with-annual-rmds',
        row: 'R1',
        classification: 'settled',
        rbdComparison,
        citations: [...CITATIONS.R1],
        disclosures: [...baseDisclosures],
        finalDeadlineYear: deathYear + 10,
      }
    }
    return {
      kind: 'regime',
      regime: 'ten-year-no-annual',
      row: 'R2',
      classification: 'settled',
      rbdComparison,
      citations: [...CITATIONS.R2],
      disclosures: [...baseDisclosures],
      finalDeadlineYear: deathYear + 10,
    }
  }

  // Completeness: any combination the rows above do not claim is an X5 defect.
  return refusal(
    'needs-review',
    'X5',
    `inherited-IRA facts do not match any supported regime row (accountType '${accountType}', beneficiaryClass '${b.beneficiaryClass}', edbCategory '${edb ?? 'undefined'}', election '${election ?? 'undefined'}'); correct the beneficiary facts or see DOCS/domain/inherited-ira-regime-matrix.md §3`,
  )
}

// ---- Annual requirement calculator ------------------------------------------------

export type InheritedRequirementKind =
  | 'year-of-death-rmd'
  | 'annual-rmd'
  | 'none'
  | 'final-sweep'

export interface InheritedRequirementEvidence {
  year: number
  kind: InheritedRequirementKind
  /** Required minimum for the year, before comparing to the balance. 0 when kind is 'none'. */
  requiredAmount: number
  /** The divisor applied, when kind is 'annual-rmd' or 'year-of-death-rmd'. */
  divisor?: number
  /** Which arm produced the divisor. */
  divisorArm?:
    | 'beneficiary-fixed'
    | 'spouse-redetermined'
    | 'owner-fixed'
    | 'uniform-lifetime'
    | 'joint-life'
  /** True for R1 amounts due 2021–2024 for deaths 2020–2023 (Notices 2022-53/2023-54/2024-35). */
  noticeWaived?: boolean
  /**
   * Distribution calendar years before 2022 were governed by the formerly
   * applicable §1.401(a)(9)-9 tables (§1.401(a)(9)-9(f)(1)), which this engine
   * does not carry; the amount for such a year is not computed rather than
   * computed from the wrong table. From 2022 on, the fixed-expectancy formula
   * over the current tables is exactly the §1.401(a)(9)-9(f)(2)(ii)(A) reset.
   *
   * 'treat-as-own-election-year-not-carried': retained for the standalone
   * calculator path. The plan schema records `treatAsOwnElectionYear` since
   * WS4, and the projection ledger executes the S2 flip year-by-year; this
   * limitation remains only when `inheritedRequirementForYear` is called on
   * an S2 classification without that year-aware path (standalone users).
   *
   * 'joint-life-gap-unresolved-at-year-precision': an exact 10-birth-year gap
   * cannot resolve "more than 10 years younger" at year precision
   * (§1.401(a)(9)-5(c)(2)(i)).
   *
   * 'pre-horizon-year-of-death-rmd-unresolved': the decedent died on or after
   * the RBD with `ownerYearOfDeathRmdSatisfied !== true`, and the death year
   * predates the projection start year. Treas. Reg. §1.408-8(e)(4)(i) still
   * makes the year-of-death RMD an obligation of the beneficiary, but that
   * obligation predates the horizon and is not modeled as satisfied — no
   * amount is forced; the evidence row carries this limitation on the first
   * projection year only.
   */
  limitation?:
    | 'pre-2022-tables-not-carried'
    | 'treat-as-own-election-year-not-carried'
    | 'joint-life-gap-unresolved-at-year-precision'
    | 'pre-horizon-year-of-death-rmd-unresolved'
  citations: string[]
}

function amountFromDivisor(priorYearEndBalance: number, divisor: number): number {
  if (priorYearEndBalance <= 0) return 0
  if (divisor <= 0) return priorYearEndBalance
  return priorYearEndBalance / divisor
}

/**
 * Owner fixed-minus-one arm under Treas. Reg. §1.401(a)(9)-5(d)(3)(ii): Single
 * Life at the owner's attained age in the death year, reduced by one per
 * calendar year elapsed after the death year. In deathYear+1 the arm is already
 * entry−1.
 */
function ownerFixedDivisor(
  pack: ParameterPack,
  ownerBirthYear: number,
  ownerDeathYear: number,
  year: number,
): number {
  const ageInDeathYear = ownerDeathYear - ownerBirthYear
  const entry = singleLifeExpectancyYears(pack, ageInDeathYear)
  const elapsedAfterDeath = year - ownerDeathYear
  return entry - elapsedAfterDeath
}

/**
 * Beneficiary fixed arm via the existing subtract-one helper
 * (§1.401(a)(9)-5(d)(3)(iii)).
 */
function beneficiaryFixedDivisor(
  pack: ParameterPack,
  beneficiaryBirthYear: number,
  ownerDeathYear: number,
  year: number,
): number {
  const beneficiaryAge = year - beneficiaryBirthYear
  return beneficiaryRemainingLifeExpectancy(pack, {
    year,
    ownerDeathYear,
    beneficiaryAge,
  })
}

/**
 * Spouse redetermined arm: Single Life at the spouse's attained age in `year`,
 * recomputed each year (§1.401(a)(9)-5(d)(3)(iv)).
 */
function spouseRedeterminedDivisor(
  pack: ParameterPack,
  spouseBirthYear: number,
  year: number,
): number {
  const age = year - spouseBirthYear
  return singleLifeExpectancyYears(pack, age)
}

function noneEvidence(year: number, citations: string[]): InheritedRequirementEvidence {
  return { year, kind: 'none', requiredAmount: 0, citations }
}

/**
 * Final deadline sweep evidence. The stated requiredAmount uses the same prior-
 * December-31 balance base as every other evidence amount (Treas. Reg.
 * §1.401(a)(9)-5(b)); WS4 reconciles the entire remaining interest at execution
 * time against the live balance in the ledger.
 */
function finalSweepEvidence(
  year: number,
  priorYearEndBalance: number,
  citations: string[],
): InheritedRequirementEvidence {
  return {
    year,
    kind: 'final-sweep',
    requiredAmount: Math.max(0, priorYearEndBalance),
    citations,
  }
}

function annualEvidence(input: {
  year: number
  divisor: number
  arm: InheritedRequirementEvidence['divisorArm']
  priorYearEndBalance: number
  citations: string[]
  noticeWaived?: boolean
}): InheritedRequirementEvidence {
  const { year, divisor, arm, priorYearEndBalance, citations, noticeWaived } = input
  // Divisor ≤ 1 (or exhausted ≤ 0) → entire remaining interest (§1.401(a)(9)-5(d)(1)).
  // An exhaustion sweep in a relief year is still a specified-RMD annual amount
  // (not the 10-year deadline), so the notice-waived mark rides along.
  if (divisor <= 1) {
    return {
      ...finalSweepEvidence(year, priorYearEndBalance, [
        ...citations,
        'Treas. Reg. §1.401(a)(9)-5(d)(1)',
      ]),
      ...(noticeWaived === true ? { noticeWaived } : {}),
    }
  }
  return {
    year,
    kind: 'annual-rmd',
    requiredAmount: amountFromDivisor(priorYearEndBalance, divisor),
    divisor,
    divisorArm: arm,
    ...(noticeWaived !== undefined ? { noticeWaived } : {}),
    citations,
  }
}

/**
 * First calendar year spouse/owner life-expectancy amounts begin when death is
 * before the RBD: the later of deathYear+1 and the latest applicable-age attain
 * year (§1.401(a)(9)-3(d)).
 */
function spouseDeferralStartYear(
  ownerDeathYear: number,
  ownerBirthYear: number | undefined,
  ownerBirthMonth: number | undefined,
): number {
  if (ownerBirthYear === undefined) return ownerDeathYear + 1
  const attainYears = applicableAgeAttainYears(ownerBirthYear, ownerBirthMonth)
  const latestAttain = attainYears[attainYears.length - 1] ?? ownerDeathYear + 1
  return Math.max(ownerDeathYear + 1, latestAttain)
}

/**
 * Annual (or year-of-death / final-sweep) required amount for one calendar year
 * under a classified inherited-IRA regime. Pure evidence: does not mutate
 * balances; WS4 reconciles to the live ledger.
 *
 * @see DOCS/domain/inherited-ira-regime-matrix.md §4
 */
export function inheritedRequirementForYear(input: {
  pack: ParameterPack
  classification: InheritedRegimeClassification
  inherited: InheritedAccount
  year: number
  /** Prior-year-end (Dec 31) balance — the RMD denominator base. */
  priorYearEndBalance: number
}): InheritedRequirementEvidence {
  const { pack, classification, inherited, year, priorYearEndBalance } = input
  const deathYear = inherited.ownerDeathYear
  const b = inherited.beneficiary
  const citations = classification.citations
  const rbd = classification.rbdComparison
  const regime = classification.regime

  // Before the death year: nothing is due from this inherited account.
  if (year < deathYear) {
    return noneEvidence(year, citations)
  }

  // Year-of-death RMD: post-RBD only, when not already satisfied (§1.408-8(e)(4)(i)).
  // The schema carries only ownerYearOfDeathRmdSatisfied (a boolean); evidence here
  // states the decedent's gross death-year RMD. Partial amounts the decedent already
  // took net out in WS4 ledger execution against actual distributions, mirroring the
  // catch-up helper's gross-hypotheticals contract.
  if (year === deathYear) {
    if (
      rbd === 'on-or-after-rbd' &&
      b?.ownerYearOfDeathRmdSatisfied !== true &&
      b?.ownerBirthYear !== undefined
    ) {
      // Calendar-year-2020 RMDs were waived entirely (IRC §401(a)(9)(I), CARES
      // Act §2203) — no death-year obligation exists for a 2020 death.
      if (deathYear === 2020) {
        return noneEvidence(year, [
          ...citations,
          'IRC §401(a)(9)(I) (CARES Act §2203)',
        ])
      }
      // A 2021 death-year RMD was computed under the formerly applicable tables
      // (§1.401(a)(9)-9(f)(1)), which this engine does not carry — the amount is
      // not computed rather than computed wrongly.
      if (deathYear < 2022) {
        return {
          year,
          kind: 'year-of-death-rmd',
          requiredAmount: 0,
          limitation: 'pre-2022-tables-not-carried',
          citations: [...citations, 'Treas. Reg. §1.401(a)(9)-9(f)(1)'],
        }
      }
      const ownerAge = deathYear - b.ownerBirthYear
      let divisor = uniformLifetimeDivisor(pack, ownerAge)
      let arm: InheritedRequirementEvidence['divisorArm'] = 'uniform-lifetime'
      const extraCitations: string[] = ['Treas. Reg. §1.408-8(e)(4)(i)']
      let jointLifeLimitation: InheritedRequirementEvidence['limitation'] | undefined
      // The decedent's lifetime denominator — which the death-year RMD is —
      // uses the Joint and Last Survivor Table when the sole beneficiary is a
      // spouse more than 10 years younger (§1.401(a)(9)-5(c)(2)(i)).
      if (
        b.edbCategory === 'surviving-spouse' &&
        b.soleBeneficiary === true &&
        b.beneficiaryBirthYear !== undefined
      ) {
        const spouseAge = deathYear - b.beneficiaryBirthYear
        const ageGap = ownerAge - spouseAge
        if (ageGap > 10) {
          const joint = jointLifeTableDivisor(ownerAge, spouseAge)
          // §1.401(a)(9)-5(c)(2)(i) selects the Joint table when the condition
          // holds — not a greater-of against Uniform Lifetime.
          if (joint !== undefined && joint > 0) {
            divisor = joint
            arm = 'joint-life'
            extraCitations.push('Treas. Reg. §1.401(a)(9)-5(c)(2)(i)')
          }
        } else if (ageGap === 10) {
          // Owner born December 31: every feasible spouse birth date in the
          // later birth year is at most exactly 10 years after the owner's,
          // so the spouse is not more than 10 years younger and Uniform
          // Lifetime is conclusive — no joint-life-gap limitation.
          const ownerDec31 =
            b.ownerBirthMonth === 12 && b.ownerBirthDay === 31
          if (!ownerDec31) {
            jointLifeLimitation = 'joint-life-gap-unresolved-at-year-precision'
            extraCitations.push('Treas. Reg. §1.401(a)(9)-5(c)(2)(i)')
          }
        }
      }
      // Post-RBD deaths from 2022 on always have an attained age on the
      // current Uniform Lifetime Table; a miss means the pack is wrong.
      if (divisor === undefined || !(divisor > 0)) {
        throw new RangeError(
          `Uniform Lifetime Table has no usable divisor for age ${ownerAge} (year-of-death RMD, death year ${deathYear})`,
        )
      }
      return {
        year,
        kind: 'year-of-death-rmd',
        requiredAmount: amountFromDivisor(priorYearEndBalance, divisor),
        divisor,
        divisorArm: arm,
        ...(jointLifeLimitation !== undefined ? { limitation: jointLifeLimitation } : {}),
        citations: [...citations, ...extraCitations],
      }
    }
    return noneEvidence(year, citations)
  }

  // Final deadline sweep (10-year rows and minor-child majority+10).
  if (
    classification.finalDeadlineYear !== undefined &&
    year >= classification.finalDeadlineYear
  ) {
    return finalSweepEvidence(year, priorYearEndBalance, citations)
  }

  // Regimes with no annual amounts during the window.
  if (
    regime === 'ten-year-no-annual' ||
    regime === 'roth-ten-year-no-annual' ||
    regime === 'edb-ten-year-elected' ||
    regime === 'spouse-ten-year-elected'
  ) {
    return noneEvidence(year, citations)
  }

  // S2 standalone calculator: the schema records treatAsOwnElectionYear
  // since WS4, but this pure calculator has no year-aware ledger flip, so
  // beneficiary RMDs between death and the election cannot be placed here —
  // a typed limitation, not a silent zero (matrix §7). The projection ledger
  // executes the transition against the real election year and does not
  // consult this arm for pre-election S0 schedules.
  if (regime === 'spouse-treat-as-own-transition') {
    return {
      ...noneEvidence(year, citations),
      limitation: 'treat-as-own-election-year-not-carried',
    }
  }

  // --- Life-expectancy / R1 annual amounts (year > deathYear) ---

  const ownerBirth = b?.ownerBirthYear
  const benBirth = b?.beneficiaryBirthYear
  // The classifier refuses a designated individual without a birth year, so a
  // classification reaching an annual-amount regime always carries one; a miss
  // here is an invariant violation, not a zero-requirement year.
  if (benBirth === undefined) {
    throw new RangeError(
      `beneficiaryBirthYear is missing on a '${regime}' classification (year ${year}); the classifier refuses this fact set, so the classification was not produced by classifyInheritedRegime`,
    )
  }

  // Spouse deferral (S0/S1, K2-spouse) before the generic pre-2022 limitation:
  // when death is before the RBD, no annual obligation exists until the later
  // of deathYear+1 and the owner's applicable-age attain year — years inside
  // that deferral are plain none, not a pre-2022-table limitation.
  if (
    (regime === 'spouse-remain-beneficiary' ||
      (regime === 'roth-edb-life-expectancy' && b?.edbCategory === 'surviving-spouse')) &&
    (rbd === 'before-rbd' || rbd === 'not-applicable')
  ) {
    const startYear = spouseDeferralStartYear(deathYear, ownerBirth, b?.ownerBirthMonth)
    if (year < startYear) {
      return noneEvidence(year, citations)
    }
  }

  // Annual amounts for distribution calendar years before 2022 were governed
  // by the formerly applicable tables (§1.401(a)(9)-9(f)(1)); reachable only
  // for a 2020 death's 2021 first distribution year. The amount is not
  // computed rather than computed from the wrong table; from 2022 on the fixed
  // formula over the current tables is the §1.401(a)(9)-9(f)(2)(ii)(A) reset.
  if (year < 2022) {
    const noticeWaived =
      regime === 'ten-year-with-annual-rmds' &&
      deathYear >= 2020 &&
      deathYear <= 2023 &&
      year >= 2021 &&
      year <= 2024
    return {
      year,
      kind: 'annual-rmd',
      requiredAmount: 0,
      limitation: 'pre-2022-tables-not-carried',
      citations: [
        ...citations,
        'Treas. Reg. §1.401(a)(9)-9(f)(1)',
        ...(noticeWaived ? (['Notices 2022-53/2023-54/2024-35'] as const) : []),
      ],
      ...(noticeWaived ? { noticeWaived: true } : {}),
    }
  }

  // R1: greater-of beneficiary fixed and owner fixed; notice waiver 2021–2024
  // for deaths 2020–2023 (Notices 2022-53/2023-54/2024-35).
  if (regime === 'ten-year-with-annual-rmds') {
    const benDiv = beneficiaryFixedDivisor(pack, benBirth, deathYear, year)
    let divisor = benDiv
    let arm: InheritedRequirementEvidence['divisorArm'] = 'beneficiary-fixed'
    if (ownerBirth !== undefined) {
      const ownDiv = ownerFixedDivisor(pack, ownerBirth, deathYear, year)
      if (ownDiv > divisor) {
        divisor = ownDiv
        arm = 'owner-fixed'
      }
    }
    const noticeWaived =
      deathYear >= 2020 &&
      deathYear <= 2023 &&
      year >= 2021 &&
      year <= 2024
    return annualEvidence({
      year,
      divisor,
      arm,
      priorYearEndBalance,
      citations,
      noticeWaived,
    })
  }

  // R3 / K2 non-spouse: beneficiary fixed; traditional post-RBD also greater-of owner.
  // Spouse K2 (edbCategory surviving-spouse) uses the redetermined path below.
  if (
    (regime === 'edb-life-expectancy' || regime === 'roth-edb-life-expectancy') &&
    b?.edbCategory !== 'surviving-spouse'
  ) {
    const benDiv = beneficiaryFixedDivisor(pack, benBirth, deathYear, year)
    let divisor = benDiv
    let arm: InheritedRequirementEvidence['divisorArm'] = 'beneficiary-fixed'
    // Greater-of only for traditional on-or-after-RBD (§1.401(a)(9)-5(d)(1)(ii));
    // K2 has no post-RBD arm; before-RBD R3 uses beneficiary only (§(d)(2)).
    if (
      regime === 'edb-life-expectancy' &&
      rbd === 'on-or-after-rbd' &&
      ownerBirth !== undefined
    ) {
      const ownDiv = ownerFixedDivisor(pack, ownerBirth, deathYear, year)
      if (ownDiv > divisor) {
        divisor = ownDiv
        arm = 'owner-fixed'
      }
    }
    return annualEvidence({
      year,
      divisor,
      arm,
      priorYearEndBalance,
      citations,
    })
  }

  // S0/S1 and K2-spouse: spouse redetermined arm.
  if (
    regime === 'spouse-remain-beneficiary' ||
    (regime === 'roth-edb-life-expectancy' && b?.edbCategory === 'surviving-spouse')
  ) {
    // Death before RBD: defer until the later of deathYear+1 and applicable-age attain year.
    if (rbd === 'before-rbd' || rbd === 'not-applicable') {
      const startYear = spouseDeferralStartYear(deathYear, ownerBirth, b?.ownerBirthMonth)
      if (year < startYear) {
        return noneEvidence(year, citations)
      }
      // Before-RBD: spouse redetermined only — no greater-of owner arm (§(d)(2)).
      const divisor = spouseRedeterminedDivisor(pack, benBirth, year)
      return annualEvidence({
        year,
        divisor,
        arm: 'spouse-redetermined',
        priorYearEndBalance,
        citations,
      })
    }

    // On-or-after RBD: greater of spouse redetermined vs owner fixed.
    const spouseDiv = spouseRedeterminedDivisor(pack, benBirth, year)
    let divisor = spouseDiv
    let arm: InheritedRequirementEvidence['divisorArm'] = 'spouse-redetermined'
    if (ownerBirth !== undefined) {
      const ownDiv = ownerFixedDivisor(pack, ownerBirth, deathYear, year)
      if (ownDiv > divisor) {
        divisor = ownDiv
        arm = 'owner-fixed'
      }
    }
    return annualEvidence({
      year,
      divisor,
      arm,
      priorYearEndBalance,
      citations,
    })
  }

  return noneEvidence(year, citations)
}

/**
 * Pure bounded schedule of annual requirement evidence for tests and WS5.
 * Uses a constant prior-year-end balance model; WS4 owns real balances.
 */
export function inheritedRequirementSchedule(input: {
  pack: ParameterPack
  classification: InheritedRegimeClassification
  inherited: InheritedAccount
  fromYear: number
  toYear: number
  /** Balance model for evidence: constant prior-year-end balance (tests) — WS4 owns real balances. */
  priorYearEndBalance: number
}): InheritedRequirementEvidence[] {
  const out: InheritedRequirementEvidence[] = []
  for (let year = input.fromYear; year <= input.toYear; year++) {
    out.push(
      inheritedRequirementForYear({
        pack: input.pack,
        classification: input.classification,
        inherited: input.inherited,
        year,
        priorYearEndBalance: input.priorYearEndBalance,
      }),
    )
  }
  return out
}

/**
 * Hypothetical required minimum distributions gating a late treat-as-own
 * election (Treas. Reg. §1.408-8(c)(1)(iii)–(iv) via §1.402(c)-2(j)(4)).
 *
 * The timing bar reaches only a surviving spouse to whom the 10-year rule of
 * §1.401(a)(9)-3(c)(3) applies (§1.402(c)-2(j)(4)(i)) — a spouse under the
 * life-expectancy default owes ordinary beneficiary RMDs each year instead,
 * and missing one triggers the out-of-scope §1.408-8(c)(2)(i) deemed
 * election. The hypothetical amount for each catch-up year is the RMD that
 * would have applied had the §1.401(a)(9)-5(g)(3)(i) spouse-as-employee
 * election been in effect — the Uniform Lifetime denominator at the SPOUSE's
 * attained age (§1.402(c)-2(j)(4)(iii)) — not the spouse's Single Life
 * beneficiary amount. The catch-up period runs from the first applicable year
 * (the later of the year the spouse attains the applicable age and the year
 * the owner would have, §1.402(c)-2(j)(4)(iv)) through the election year
 * inclusive (§1.402(c)-2(j)(4)(v); §1.408-8(c)(1)(iv) permits the election
 * only after that year's amount is out).
 *
 * Evidence only: amounts are gross hypotheticals on the caller's per-year
 * balances; the §1.402(c)-2(j)(4)(ii)–(iii) netting of actual distributions
 * against adjusted balances is not performed here (the projection ledger
 * does not yet schedule the catch-up — matrix §7 residual). Traditional
 * accounts only (an inherited Roth under treat-as-own has no lifetime RMDs).
 * Throws when the (j)(4) computation cannot be settled from the supplied
 * facts — never silently computing past an ambiguity (fail closed, matrix §2).
 *
 * The plan schema records `treatAsOwnElectionYear` since WS4; this helper
 * remains evidence-only and is not wired into the ledger's S2 flip.
 *
 * `spouseWasUnderTenYearRule` is the (j)(4)(i) applicability fact: the gate
 * reaches only a spouse to whom the §1.401(a)(9)-3(c)(3) 10-year rule applied
 * before the election — for an IRA, a death-before-RBD spouse under an
 * affirmative ten-year election. The schema's single election field cannot
 * record that prior ten-year-election state alongside 'treat-as-own', so the
 * caller asserts it (see disclosure `treat-as-own-timing-gate-unverified`).
 * A spouse under the §1.401(a)(9)-3(c)(5)(i) life-expectancy default owed
 * ordinary beneficiary RMDs each year instead (the S0/S1 schedule), and a
 * missed one triggers the out-of-scope §1.408-8(c)(2)(i) deemed election —
 * no (j)(4) catch-up exists for them.
 */
export function spouseTreatAsOwnCatchUp(input: {
  pack: ParameterPack
  accountType: 'traditional' | 'roth'
  inherited: InheritedAccount
  electionYear: number
  /** §1.402(c)-2(j)(4)(i): was the spouse under the 10-year rule before electing? */
  spouseWasUnderTenYearRule: boolean
  priorYearEndBalancesByYear: Record<number, number>
}): InheritedRequirementEvidence[] {
  const {
    pack,
    accountType,
    inherited,
    electionYear,
    spouseWasUnderTenYearRule,
    priorYearEndBalancesByYear,
  } = input
  const b = inherited.beneficiary

  if (accountType === 'roth') {
    throw new Error(
      'spouse treat-as-own catch-up does not apply to inherited Roth IRAs (a spouse who treats a Roth as their own has no lifetime RMDs under Treas. Reg. §1.408-8(b)(1)(ii)); no Uniform Lifetime catch-up exists',
    )
  }

  if (inherited.ownerDeathYear < 2020) {
    throw new Error(
      `spouse treat-as-own catch-up requires ownerDeathYear on or after 2020 (SECURE Act §401(b)(1) boundary); the §1.401(a)(9)-3(c)(3) ten-year rule is a SECURE Act regime for deaths after 12/31/2019 — ownerDeathYear ${inherited.ownerDeathYear} cannot have a spouse under it`,
    )
  }

  if (
    b === undefined ||
    b.edbCategory !== 'surviving-spouse' ||
    b.soleBeneficiary !== true
  ) {
    // (c)(1)(ii) is the eligibility subparagraph — sole beneficiary with an
    // unlimited withdrawal right — verified against the eCFR text 2026-08-08.
    throw new Error(
      'spouse treat-as-own catch-up requires a sole surviving-spouse beneficiary (Treas. Reg. §1.408-8(c)(1)(ii)); the §1.402(c)-2(j)(4) hypothetical-RMD gate has no other addressee',
    )
  }

  if (b.spouseUnlimitedWithdrawalRight !== true) {
    throw new Error(
      "spouse treat-as-own catch-up requires spouseUnlimitedWithdrawalRight true (Treas. Reg. §1.408-8(c)(1)(ii) eligibility requires the unlimited withdrawal right)",
    )
  }

  // §1.402(c)-2(j)(4)(i): the gate reaches only a spouse under the
  // §1.401(a)(9)-3(c)(3) 10-year rule, which exists only for a
  // death-before-RBD spouse. The life-expectancy-default spouse owes the
  // ordinary S0/S1 schedule instead and has no (j)(4) catch-up.
  if (!spouseWasUnderTenYearRule) return []
  if (inherited.decedentHadStartedRmds) {
    throw new Error(
      'spouseWasUnderTenYearRule contradicts decedentHadStartedRmds: the §1.401(a)(9)-3(c)(3) 10-year rule exists only for a death before the RBD, so a post-RBD-death spouse was never under it; correct one of the two facts',
    )
  }
  if (b.beneficiaryBirthYear === undefined || b.ownerBirthYear === undefined) {
    throw new Error(
      'spouse treat-as-own catch-up requires both beneficiaryBirthYear and ownerBirthYear (the §1.402(c)-2(j)(4)(iv) first applicable year is the later of the year each would attain the applicable age)',
    )
  }

  const rbdDerivation = deriveRbdComparison({
    ownerDeathYear: inherited.ownerDeathYear,
    decedentHadStartedRmds: inherited.decedentHadStartedRmds,
    ownerBirthYear: b.ownerBirthYear,
    ownerBirthMonth: b.ownerBirthMonth,
    ownerBirthDay: b.ownerBirthDay,
  })
  if (
    rbdDerivation.kind === 'needs-review' ||
    (rbdDerivation.kind === 'resolved' && rbdDerivation.comparison === 'on-or-after-rbd')
  ) {
    const outcome =
      rbdDerivation.kind === 'needs-review'
        ? `needs-review (${rbdDerivation.reason})`
        : 'on-or-after-rbd'
    throw new Error(
      `spouse treat-as-own catch-up requires death before the RBD under Treas. Reg. §1.401(a)(9)-3(c)(3) (the §1.402(c)-2(j)(4) gate reaches only a spouse under the 10-year rule); RBD derivation outcome: ${outcome}`,
    )
  }

  const spouseAttainYears = applicableAgeAttainYears(b.beneficiaryBirthYear)
  const ownerAttainYears = applicableAgeAttainYears(b.ownerBirthYear, b.ownerBirthMonth)
  const deathClampedStart = inherited.ownerDeathYear
  const firstApplicableCandidates = new Set(
    spouseAttainYears.flatMap((s) =>
      ownerAttainYears.map((o) => Math.max(s, o, deathClampedStart)),
    ),
  )
  if (firstApplicableCandidates.size > 1) {
    throw new Error(
      'spouse treat-as-own catch-up cannot settle the §1.402(c)-2(j)(4)(iv) first applicable year (an applicable-age attain year is contested or birth-date precision is insufficient); resolve the applicable age before computing the catch-up',
    )
  }

  const firstApplicableYear = [...firstApplicableCandidates][0]!

  if (electionYear < inherited.ownerDeathYear) {
    throw new Error(
      'spouse treat-as-own catch-up cannot apply when electionYear precedes ownerDeathYear (a spouse cannot elect before inheriting); supply electionYear on or after the owner\'s death year',
    )
  }
  // §1.408-8(c)(1)(iii): the bar exists only in years the (j)(4) rule would
  // apply — an election before the first applicable year needs no catch-up.
  if (electionYear < firstApplicableYear) return []

  const catchUpCitations = [
    'Treas. Reg. §1.408-8(c)(1)(iii)–(iv)',
    'Treas. Reg. §1.402(c)-2(j)(4)(i)–(v)',
    'Treas. Reg. §1.401(a)(9)-5(g)(3)(i)',
  ] as const

  const out: InheritedRequirementEvidence[] = []
  for (let year = firstApplicableYear; year <= electionYear; year++) {
    if (priorYearEndBalancesByYear[year] === undefined) {
      throw new Error(
        `spouse treat-as-own catch-up requires a prior-year-end balance for every year from ${firstApplicableYear} through ${electionYear} (year ${year} is missing); a missing balance must not publish a zero hypothetical`,
      )
    }
    if (year < 2022) {
      out.push({
        year,
        kind: 'annual-rmd',
        requiredAmount: 0,
        limitation: 'pre-2022-tables-not-carried',
        citations: [...catchUpCitations, 'Treas. Reg. §1.401(a)(9)-9(f)(1)'],
      })
      continue
    }
    const balance = priorYearEndBalancesByYear[year]
    const spouseAge = year - b.beneficiaryBirthYear
    const divisor = uniformLifetimeDivisor(pack, spouseAge)
    // The first applicable year is at or after the spouse attains the
    // applicable age, so the Uniform Lifetime Table always has the row.
    if (divisor === undefined || !(divisor > 0)) {
      throw new RangeError(
        `Uniform Lifetime Table has no usable divisor for age ${spouseAge} (treat-as-own catch-up year ${year})`,
      )
    }
    out.push({
      year,
      kind: 'annual-rmd',
      requiredAmount: amountFromDivisor(balance, divisor),
      divisor,
      divisorArm: 'uniform-lifetime',
      citations: [...catchUpCitations],
    })
  }
  return out
}
