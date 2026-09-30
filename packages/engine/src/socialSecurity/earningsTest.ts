/**
 * The retirement earnings test (42 U.S.C. 403(b) and (f); 20 CFR 404.415 to
 * 404.440), one year at a time. Every Social Security figure the engine
 * publishes goes through the two functions here: the ledger's Social Security
 * pass (socialSecurity/householdYear.ts#socialSecurityYear, which the
 * projection's annualSocialSecurity.ts delegates to), and the analysis page's
 * models, which price each year of each path with that same year function
 * (analysis/expectedValue.ts through analysis/householdPaths.ts, and
 * analysis/breakEven.ts) or, for survivor switching, compose a widow(er)'s two
 * claimed benefits and charge them here (analysis/survivorSwitching.ts).
 *
 * - #excessEarnings: the year's excess earnings. Half the wages above the lower
 *   exempt amount before the calendar year of the full-retirement-age month; in
 *   that year, a third of the wages of the months before that month above the
 *   higher exempt amount, the year's wages spread evenly over its months (the
 *   plan has no monthly wages); nothing after it (403(f)(3), (f)(1)(B); 20 CFR
 *   404.430, 404.434(c)). The excess is reduced to the next lower multiple of $1
 *   (403(f)(3)).
 * - #earningsTestYear: the excess charged month by month from January, only to
 *   months that fall before the person's full-retirement-age month and only
 *   against benefits the person is entitled to that month (403(f)(1)(A), (B)):
 *   a month the plan pays before a benefit's first month of entitlement (the
 *   claim-year convention pays a claim at a whole age for the whole calendar
 *   year, social-security-payable-months) is paid in full and never charged,
 *   so it is never a crediting month either. The worker whose record a household member's spouse
 *   benefit is paid on is charged first, against all of his benefits and the
 *   family benefit on his record: his old-age benefit, any benefit he is paid
 *   on another record (a former spouse's) and that spouse benefit (403(b)(1)(A)
 *   and (B); POMS RS 02501.095 B.2, RS 02501.145 A and B.1). Where the excess
 *   left is less than that total, it is charged to each record in proportion
 *   to what the record pays him that month (RS 02501.145 B.2), and what is left
 *   of the family benefit on his record is paid to the two in the proportion of
 *   their original benefits, the worker's PIA to half of it, two to one,
 *   neither share above the person's own benefit, any excess going to the other
 *   (20 CFR 404.434(b)(1), 404.439, 404.440; POMS RS 02501.110). Each other
 *   person's excess is then charged against what is left of that person's
 *   benefits (403(b)(1), "only to the extent of the total of his benefits
 *   remaining after such earlier deductions"; 404.434(b)(3); POMS RS 02501.095
 *   B.4): a person paid on two records is charged on both, a partial month in
 *   proportion to the benefits due on each before any deduction for work, and
 *   the other record no more than what the worker's charge left of it (RS
 *   02501.145 B.2, RS 02501.150 A.2). Excess not charged by December lapses
 *   (POMS RS 02501.095 B.1).
 * - A crediting month is reported for each benefit with a full or partial
 *   deduction in a month of its reduction period, each record's benefit on its
 *   own (402(q)(7)(A); POMS RS 00615.482 B, "grant ARFs separately on each
 *   record"): the worker's old-age benefit or his benefit on another record
 *   when part of it was withheld, a spouse benefit whenever the worker's excess
 *   was charged to his record, even when her prorated share of a partial month
 *   is her whole benefit (RS 00615.482 B.2), and each benefit of a person whose
 *   own excess was charged against it. Because a partial month is apportioned
 *   to both records, a person paid on two records whose own excess is charged
 *   in a month has a deduction from both benefits that month. The caller says
 *   which months are in each benefit's reduction period.
 *
 * Nothing here is rounded but the excess: the benefits, the apportioned parts
 * and the partial-month shares stay unrounded, as the ledger's benefits are (20
 * CFR 404.304(f) rounds a benefit to the dollar, and RS 02501.145 B.2 rounds an
 * apportioned part down to a multiple of $.10; the engine does neither).
 *
 * @see usc-42-403-f-3-retirement-earnings-test in rules/records/socialSecurity.ts
 * @see usc-42-403-b-1-worker-excess-charged-to-family in rules/records/socialSecurity.ts
 */

/** A deduction below this many dollars is floating-point noise, not a withheld month. */
const DOLLAR_NOISE = 1e-9

/**
 * The excess is reduced to the next lower multiple of $1. This much is added
 * before the floor so that a whole-dollar excess computed a few ulps low (a
 * wage row grown by inflation factors) is not floored a dollar short.
 */
const FLOOR_TOLERANCE = 1e-6

export interface ExcessEarningsInput {
  /** The person's earnings for the calendar year: the plan's wage rows. */
  readonly wages: number
  /**
   * The month the person attains full retirement age, as `year * 12 + (month
   * - 1)`: the old-age full retirement age, even for a widow(er) (403(f)(9)).
   */
  readonly fraMonthIndex: number
  readonly year: number
  /** The year's annual exempt amount before the full-retirement-age year. */
  readonly belowFraExemptAnnual: number
  /** The year's annual exempt amount in the full-retirement-age year. */
  readonly fraYearExemptAnnual: number
}

/**
 * The year's excess earnings, reduced to the next lower multiple of $1:
 * (wages − the lower exempt amount) / 2 before the calendar year of the
 * full-retirement-age month; in that year (wages × b / 12 − the higher exempt
 * amount) / 3, with b the months before that month (0 when it is January, so
 * nothing); 0 after it, and never below 0.
 */
export function excessEarnings(input: ExcessEarningsInput): number {
  const { wages, fraMonthIndex, year, belowFraExemptAnnual, fraYearExemptAnnual } = input
  if (!(wages > 0)) return 0
  const fraYear = Math.floor(fraMonthIndex / 12)
  let excess: number
  if (year < fraYear) {
    excess = (wages - belowFraExemptAnnual) / 2
  } else if (year === fraYear) {
    const monthsBefore = fraMonthIndex - year * 12
    if (monthsBefore <= 0) return 0
    excess = ((wages * monthsBefore) / 12 - fraYearExemptAnnual) / 3
  } else {
    return 0
  }
  return excess > 0 ? Math.floor(excess + FLOOR_TOLERANCE) : 0
}

/** One person's benefits due in a month, before the earnings test, in the year's dollars. */
export interface EarningsTestMonthlyDue {
  /** The person's own old-age benefit this month (on the person's own record); 0 when none is due. */
  readonly own: number
  /** Any benefit on another record this month (spouse, divorced spouse or widow(er)), above the own benefit; 0 when none. */
  readonly auxiliary: number
  /**
   * For a spouse benefit on the record of another person in the household,
   * that worker's id: his excess is charged against it before hers. Null for
   * any other auxiliary benefit (a former spouse's record carries no plan
   * earnings, and a deceased spouse's none).
   */
  readonly auxiliaryWorkerId: string | null
  /**
   * Whether the person is entitled to the own benefit this month: the month is
   * at or after its first month of entitlement. A month the plan pays before it
   * (the claim-year convention) is paid in full and not charged (403(f)(1)(A)).
   */
  readonly ownEntitled: boolean
  /** Whether the person is entitled to the auxiliary benefit this month (its first month of entitlement or later). */
  readonly auxiliaryEntitled: boolean
  /** Whether this month is in the own benefit's reduction period, so a deduction from it is a crediting month. */
  readonly ownInReductionPeriod: boolean
  /** Whether this month is in the auxiliary benefit's reduction period. */
  readonly auxiliaryInReductionPeriod: boolean
}

export interface EarningsTestPerson {
  readonly id: string
  /** The year's excess earnings (#excessEarnings); 0 when none. */
  readonly excess: number
  /** The month the person attains full retirement age: no month from it on is charged (403(f)(1)(B)). */
  readonly fraMonthIndex: number
}

export interface EarningsTestYearInput {
  readonly year: number
  /** Every person whose excess is charged or whose benefits can be charged, in household order. */
  readonly people: readonly EarningsTestPerson[]
  /**
   * The person charged first against the family benefit on his record (in a
   * couple, the one a spouse benefit is paid on: the higher PIA), or null.
   */
  readonly workerId: string | null
  /**
   * The benefits due in month `month` (0 for January) by person id. Called once
   * for each month in order, after the crediting months of the months before it
   * were delivered through `credit`, so a composition that turns on them (the
   * adjustment of the reduction factor from a full-retirement-age month) reads
   * them.
   */
  readonly due: (month: number) => ReadonlyMap<string, EarningsTestMonthlyDue>
  /** Called for each crediting month: the benefit of `personId` had a full or partial deduction in `month`. */
  readonly credit: (month: number, personId: string, benefit: 'own' | 'auxiliary') => void
}

export interface EarningsTestYearResult {
  /** The benefits paid in each month (12 entries) by person id, for everyone the due callback named. */
  readonly paidByMonth: ReadonlyMap<string, readonly number[]>
  /** The year's benefits withheld by person id. */
  readonly withheldByPerson: ReadonlyMap<string, number>
  /** The part of each person's excess charged this year (the rest lapses). */
  readonly excessChargedByPerson: ReadonlyMap<string, number>
}

/** What is left of a person's benefits in a month that can still be charged: those the person is entitled to. */
interface MonthPosition {
  own: number
  auxiliary: number
}

/**
 * The part of a person's own excess charged this month that falls on the
 * benefit paid on another record (RS 02501.145 B.2, RS 02501.150 A.2): all of
 * what is left of it when the charge takes every benefit left; otherwise the
 * charge in proportion to the benefits due on the two records before any
 * deduction for work, and no more than what is left of that benefit after the
 * worker's charge. The rest falls on the old-age benefit.
 */
function chargedToOtherRecord(position: MonthPosition, due: EarningsTestMonthlyDue, charged: number): number {
  if (charged >= position.own + position.auxiliary - DOLLAR_NOISE) return position.auxiliary
  const ownBasis = due.ownEntitled ? due.own : 0
  const auxiliaryBasis = due.auxiliaryEntitled ? due.auxiliary : 0
  if (ownBasis + auxiliaryBasis <= 0) return 0
  return Math.min(position.auxiliary, (charged * auxiliaryBasis) / (ownBasis + auxiliaryBasis))
}

/**
 * Charge each person's excess earnings for the year, month by month (see the
 * module comment), and report what is paid, what is withheld and each
 * crediting month.
 */
export function earningsTestYear(input: EarningsTestYearInput): EarningsTestYearResult {
  const { people, workerId } = input
  const remaining = new Map<string, number>()
  const fraMonthIndexOf = new Map<string, number>()
  for (const person of people) {
    fraMonthIndexOf.set(person.id, person.fraMonthIndex)
    if (person.excess > 0) remaining.set(person.id, person.excess)
  }
  const paidByMonth = new Map<string, number[]>()
  const withheldByPerson = new Map<string, number>()
  const excessChargedByPerson = new Map<string, number>()
  const charge = (id: string, amount: number): void => {
    remaining.set(id, (remaining.get(id) ?? 0) - amount)
    excessChargedByPerson.set(id, (excessChargedByPerson.get(id) ?? 0) + amount)
  }

  for (let month = 0; month < 12; month++) {
    const monthIndex = input.year * 12 + month
    const dueNow = input.due(month)
    // Only the benefits the person is entitled to this month can be charged
    // (403(f)(1)(A)); a benefit the plan pays before its first month of
    // entitlement is paid in full.
    const positions = new Map<string, MonthPosition>()
    const unchargeable = new Map<string, number>()
    for (const [id, due] of dueNow) {
      positions.set(id, { own: due.ownEntitled ? due.own : 0, auxiliary: due.auxiliaryEntitled ? due.auxiliary : 0 })
      unchargeable.set(id, (due.ownEntitled ? 0 : due.own) + (due.auxiliaryEntitled ? 0 : due.auxiliary))
    }
    const ownCredits = new Set<string>()
    const auxiliaryCredits = new Set<string>()
    // Each record's benefit is credited on its own (RS 00615.482 B.3 note):
    // a month counts for a benefit when that benefit had a deduction.
    const creditsFor = (id: string, due: EarningsTestMonthlyDue, fromOwn: number, fromAuxiliary: number): void => {
      if (fromOwn > DOLLAR_NOISE && due.own > 0 && due.ownEntitled && due.ownInReductionPeriod) ownCredits.add(id)
      if (fromAuxiliary > DOLLAR_NOISE && due.auxiliary > 0 && due.auxiliaryEntitled && due.auxiliaryInReductionPeriod) auxiliaryCredits.add(id)
    }
    const chargeable = (id: string): boolean => {
      const position = positions.get(id)
      return position !== undefined && position.own + position.auxiliary > DOLLAR_NOISE && monthIndex < (fraMonthIndexOf.get(id) ?? -Infinity)
    }

    // 1. The worker's excess against all of his benefits and the family benefit on his record.
    if (workerId !== null && (remaining.get(workerId) ?? 0) > 0 && chargeable(workerId)) {
      const worker = positions.get(workerId)!
      const workerDue = dueNow.get(workerId)!
      let spouseId: string | null = null
      let spouseOnRecord = 0
      for (const [id, due] of dueNow) {
        if (id !== workerId && due.auxiliaryWorkerId === workerId && due.auxiliaryEntitled && due.auxiliary > 0) {
          spouseId = id
          spouseOnRecord = positions.get(id)!.auxiliary
        }
      }
      // His own record pays his old-age benefit and the spouse benefit; the
      // other record pays any benefit he has on a former spouse's.
      const onOwnRecord = worker.own + spouseOnRecord
      const onOtherRecord = worker.auxiliary
      const total = onOwnRecord + onOtherRecord
      const charged = Math.min(remaining.get(workerId)!, total)
      charge(workerId, charged)
      let ownDeducted: number
      let auxiliaryDeducted: number
      let spouseDeducted: number
      let chargedToOwnRecord: number
      if (charged >= total - DOLLAR_NOISE) {
        ownDeducted = worker.own
        auxiliaryDeducted = worker.auxiliary
        spouseDeducted = spouseOnRecord
        chargedToOwnRecord = onOwnRecord
      } else {
        // RS 02501.145 B.2: charged to each record in proportion to what it
        // pays him this month; the rest falls on his own record.
        auxiliaryDeducted = (charged * onOtherRecord) / total
        chargedToOwnRecord = charged - auxiliaryDeducted
        if (spouseOnRecord > 0) {
          // 20 CFR 404.439: what is left of the family benefit on his record is
          // paid in proportion to the original benefits, the worker's PIA and
          // half of it, before the family maximum, the dual-entitlement and the
          // age reductions; 404.440: a share above what the person is due goes
          // to the other.
          const left = onOwnRecord - chargedToOwnRecord
          let workerShare = (left * 2) / 3
          let spouseShare = left / 3
          if (spouseShare > spouseOnRecord) {
            spouseShare = spouseOnRecord
            workerShare = left - spouseOnRecord
          }
          if (workerShare > worker.own) {
            workerShare = worker.own
            spouseShare = left - worker.own
          }
          ownDeducted = worker.own - workerShare
          spouseDeducted = spouseOnRecord - spouseShare
        } else {
          ownDeducted = chargedToOwnRecord
          spouseDeducted = 0
        }
      }
      worker.own = Math.max(0, worker.own - ownDeducted)
      worker.auxiliary = Math.max(0, worker.auxiliary - auxiliaryDeducted)
      creditsFor(workerId, workerDue, ownDeducted, auxiliaryDeducted)
      if (spouseId !== null) {
        const spouse = positions.get(spouseId)!
        spouse.auxiliary -= spouseDeducted
        if (spouse.auxiliary < 0) spouse.auxiliary = 0
        // POMS RS 00615.482 B.2: a spouse month counts whenever the worker's
        // excess is charged to his record, even when her prorated share is
        // paid in full.
        const spouseDue = dueNow.get(spouseId)!
        if (chargedToOwnRecord > DOLLAR_NOISE && spouseDue.auxiliaryInReductionPeriod) auxiliaryCredits.add(spouseId)
      }
    }

    // 2. Each other person's own excess against what is left of that person's benefits.
    for (const person of people) {
      if (person.id === workerId) continue
      if ((remaining.get(person.id) ?? 0) <= 0 || !chargeable(person.id)) continue
      const position = positions.get(person.id)!
      const due = dueNow.get(person.id)!
      const left = position.own + position.auxiliary
      const charged = Math.min(remaining.get(person.id)!, left)
      charge(person.id, charged)
      const fromAuxiliary = chargedToOtherRecord(position, due, charged)
      const fromOwn = charged - fromAuxiliary
      position.auxiliary = Math.max(0, position.auxiliary - fromAuxiliary)
      position.own = Math.max(0, position.own - fromOwn)
      creditsFor(person.id, due, fromOwn, fromAuxiliary)
    }

    for (const [id, due] of dueNow) {
      const position = positions.get(id)!
      const paid = position.own + position.auxiliary + unchargeable.get(id)!
      let months = paidByMonth.get(id)
      if (months === undefined) {
        months = new Array<number>(12).fill(0)
        paidByMonth.set(id, months)
      }
      months[month] = paid
      const withheld = due.own + due.auxiliary - paid
      if (withheld > 0) withheldByPerson.set(id, (withheldByPerson.get(id) ?? 0) + withheld)
    }
    for (const id of ownCredits) input.credit(month, id, 'own')
    for (const id of auxiliaryCredits) input.credit(month, id, 'auxiliary')
  }
  return { paidByMonth, withheldByPerson, excessChargedByPerson }
}
