/**
 * The year function's earnings test and marital status, as the projection
 * publishes them (decision D-SS-ANALYSIS-EARNINGS-TEST). Every case is a
 * worksheet case of the decision's derivation (section E) or of its
 * independent check, priced by hand there under 42 U.S.C. 402 and 403, 20 CFR
 * 404.412 and 404.434 to 404.440 and the POMS, and reproduced by two models
 * that import nothing from the engine.
 *
 * Every plan starts in 2026 with no inflation (a COLA factor of 1, and the
 * 2026 exempt amounts, $24,480 and $65,160, every year), no benefit cut, no tax
 * and a large cash account. A claim at a whole age pays the whole calendar year
 * it is attained (the claim-year convention).
 */
import { expect, it } from 'vitest'

import type { FormerSpouse, IncomeStream, Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, testIds, validate } from '../projection/simulate.test-support.js'
import { describeRule } from '../rules/describeRule.js'

type Person = Plan['household']['people'][number]

function person(id: string, dob: string, planningAge = 95): Person {
  return { id, name: id, dob, sex: 'average', retirementAge: 67, longevity: { planningAge, source: 'manual' } }
}

function ss(personId: string, pia: number, years: number, months = 0, formerSpouses?: FormerSpouse[]): IncomeStream {
  return { type: 'socialSecurity', id: testIds(), personId, piaMonthly: pia, earnings: null, claimAge: { years, months }, ...(formerSpouses ? { formerSpouses } : {}) }
}

/** Wages paid in the years the person's attained age is below `endAge`. */
function wages(personId: string, annualGross: number, endAge: number): IncomeStream {
  return { type: 'wages', id: testIds(), personId, annualGross, endAge, realGrowthPct: 0 }
}

/** Each person's published Social Security, by year: the sum of the person's stream rows, to the cent. */
function paidBy(people: Person[], incomes: IncomeStream[], inflationPct = 0): (personId: string, year: number) => number {
  const plan = basePlan()
  plan.assumptions.inflationPct = inflationPct
  plan.household.people = people
  if (people.length === 2) plan.household.filingStatus = 'marriedFilingJointly'
  plan.incomes = incomes
  plan.accounts = [cash(10_000_000)]
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
  return (personId, year) => {
    const row = result.years.find((y) => y.year === year)!
    const paid = (row.socialSecurityStreams ?? []).filter((s) => s.personId === personId).reduce((sum, s) => sum + s.annualAmount, 0)
    return Math.round(paid * 100) / 100
  }
}

// Worksheet E5: W, born 1964-01-15, PIA 2,000, claims at 62 (1,400 a month), with
// $60,000 of 2026 wages; S, born 1964-01-20, PIA 400, claims at 62 (own 280, spouse
// part (1,000 - 400) x 0.65 = 390). W's excess floor((60,000 - 24,480)/2) = 17,760
// is charged against the family benefit on his record, 1,790 a month: January-
// September 16,110; October 1,650, leaving 140, shared 2,000 : 1,000 (93.33, 46.67).
// W is paid 2,893.33 and S 4,186.67; each has 10 crediting months (W's own, S's
// spouse), so from January 2031 W is paid 50 months early, 17,800, and S
// 280 + 600 x 0.691667 = 695 a month, 8,340. Charging his wages against his own
// benefit only (the engine to 2026-09-29): W 0 and S 8,040; 18,000 and 8,040.
describeRule('usc-42-403-b-1-worker-excess-charged-to-family', {
  note: 'the family charge and the two-to-one partial month',
  readings: {
    familyChargeSharedTwoToOne: { w2026: 2_893.33, s2026: 4_186.67, w2031: 17_800, s2031: 8_340 },
    workerExcessAgainstHisOwnBenefitOnly: { w2026: 0, s2026: 8_040, w2031: 18_000, s2031: 8_040 },
  },
  accepted: 'familyChargeSharedTwoToOne',
}, ({ accepted, readings }) => {
  it('charges the worker\'s excess against his benefit and the spouse benefit on his record (E5)', () => {
    const paid = paidBy([person('W', '1964-01-15'), person('S', '1964-01-20')], [ss('W', 2_000, 62), ss('S', 400, 62), wages('W', 60_000, 63)])
    const observed = { w2026: paid('W', 2026), s2026: paid('S', 2026), w2031: paid('W', 2031), s2031: paid('S', 2031) }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.workerExcessAgainstHisOwnBenefitOnly)
  })
})

// Worksheet E7b: E5's couple with $36,000 of S's wages too. W's charge takes her
// spouse part January-September and all but 46.67 of October; her own excess
// floor((36,000 - 24,480)/2) = 5,760 is then charged against what is left of her
// benefits: her own 280 in January-September (2,520), 326.67 in October and 670
// in November and December, 4,186.67 in all, so she is paid nothing (42 U.S.C.
// 403(b)(1); POMS RS 02501.150 A.1). Sparing her own old-age benefit in months
// his excess took her spouse benefit pays her 2,520; charging her wages against
// her whole 670 with his charge left out (the engine to 2026-09-29) pays 2,280.
describeRule('usc-42-403-b-1-worker-excess-charged-to-family', {
  note: 'her own excess against her own benefit after his',
  readings: {
    remainingAfterEarlierDeductions: 0,
    ownBenefitSparedWhileSpouseBenefitWithheld: 2_520,
    workerChargeLeftOut: 2_280,
  },
  accepted: 'remainingAfterEarlierDeductions',
}, ({ accepted, readings }) => {
  it('charges her excess against her own old-age benefit in months his excess took her spouse benefit (E7b)', () => {
    const paid = paidBy(
      [person('W', '1964-01-15'), person('S', '1964-01-20')],
      [ss('W', 2_000, 62), ss('S', 400, 62), wages('W', 60_000, 63), wages('S', 36_000, 63)],
    )
    expect(paid('S', 2026)).toBe(accepted)
    expect(paid('S', 2026)).not.toBe(readings.ownBenefitSparedWhileSpouseBenefitWithheld)
    expect(paid('S', 2026)).not.toBe(readings.workerChargeLeftOut)
    expect(paid('W', 2026)).toBe(2_893.33)
    // Twelve crediting months on each of her benefits: 400 x 0.75 + 600 x 0.70 = 720 a month.
    expect(paid('S', 2031)).toBe(8_640)
  })
})

// Worksheet E2: born 1960-07-15 (full retirement age 67 in July 2027), claimed at
// 62 in 2022 (1,400 a month), $100,000 of wages in 2026 and 2027. 2026 is withheld
// in full, 12 crediting months. In 2027 January-June earn 50,000, under 65,160:
// nothing is withheld; from July she is paid 48 months early, 1,500: 2027 pays
// 8,400 + 9,000 = 17,400. E2b, $150,000: floor((75,000 - 65,160)/3) = 3,280, charged
// January-March, 3 more months: 5,120 + 6 x 1,525 = 14,270. E2c, born 1960-01-15
// (FRA month January 2027): no month before it, no FRA-year test, 18,000. Testing
// the whole year's wages (the engine to 2026-09-29): 6,386.67, 0 and 6,386.67.
describeRule('usc-42-403-f-3-fra-year-months-before-fra', {
  readings: {
    monthsBeforeTheFraMonth: { e2: 17_400, e2b: 14_270, e2c: 18_000 },
    wholeYearsWagesInTheFraYear: { e2: 6_386.67, e2b: 0, e2c: 6_386.67 },
  },
  accepted: 'monthsBeforeTheFraMonth',
}, ({ accepted, readings }) => {
  it('tests only the earnings of the months before the FRA month in its year (E2, E2b, E2c)', () => {
    const fraYear = (dob: string, amount: number) => paidBy([person('P', dob)], [ss('P', 2_000, 62), wages('P', amount, 68)])('P', 2027)
    const observed = { e2: fraYear('1960-07-15', 100_000), e2b: fraYear('1960-07-15', 150_000), e2c: fraYear('1960-01-15', 100_000) }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.wholeYearsWagesInTheFraYear)
  })
})

// Worksheet E1: born 1964-03-10 (FRA month March 2031), PIA 2,000, claims at 62,
// $40,000 of 2026 wages. The claim is entitled from March 2026; the claim-year
// convention pays January and February, which cannot be charged (403(f)(1)(A)).
// The 7,760 excess is charged March-July and 760 of August: 6 crediting months.
// From March 2031 she is paid 54 months early, 2,000 x 0.725 = 1,450: 2031 pays
// 2 x 1,400 + 10 x 1,450 = 17,300, and 2032 17,400. Taking effect from January:
// 17,400 in 2031. Charging January and February, before entitlement, and
// crediting neither (the engine until the implementation review): 17,133.33.
describeRule('cfr-20-404-412-b-arf-effective-fra-month', {
  readings: {
    fromTheFraMonth: 17_300,
    fromJanuaryOfTheFraYear: 17_400,
  },
  accepted: 'fromTheFraMonth',
}, ({ accepted, readings }) => {
  it('pays the months before the FRA month at the unadjusted rate (E1, 2031)', () => {
    const paid = paidBy([person('P', '1964-03-10')], [ss('P', 2_000, 62), wages('P', 40_000, 63)])
    expect(paid('P', 2026)).toBe(9_040)
    expect(paid('P', 2031)).toBe(accepted)
    expect(paid('P', 2031)).not.toBe(readings.fromJanuaryOfTheFraYear)
    expect(paid('P', 2031)).not.toBe(17_133.33)
    expect(paid('P', 2032)).toBe(17_400)
  })
})

// The check's C.7 item 4: H, born 1964-01-15, PIA 2,000, claims at 62 and earns
// $60,000 a year 2026-2028, so all 36 months are withheld and credited; he dies in
// December 2032. W, born 1964-01-20, PIA 1,200 (no spouse benefit, half of his PIA
// being less), claims at 67. From 2033 she is paid the widow's limit on his
// benefit as if he were alive, 24 months early from his January 2031 FRA month:
// 2,000 x 0.866667 = 1,733.33 a month, 20,800. His benefit as claimed, 1,400,
// holds her at 82.5% of his PIA, 1,650 a month, 19,800.
describeRule('poms-rs-00615-320-b-2-c-deceased-crediting-months', {
  readings: {
    deceasedBenefitWithHisCreditingMonths: 20_800,
    deceasedBenefitAsClaimed: 19_800,
  },
  accepted: 'deceasedBenefitWithHisCreditingMonths',
}, ({ accepted, readings }) => {
  it('holds the widow to the limit on the deceased\'s credited benefit', () => {
    const paid = paidBy(
      [person('H', '1964-01-15', 68), person('W', '1964-01-20')],
      [ss('H', 2_000, 62), ss('W', 1_200, 67), wages('H', 60_000, 65)],
    )
    expect(paid('H', 2031)).toBe(20_800)
    expect(paid('W', 2033)).toBe(accepted)
    expect(paid('W', 2033)).not.toBe(readings.deceasedBenefitAsClaimed)
  })
})

// L9: E1's $40,000 of 2026 work entered as a recurring "Part-time work" income:
// the benefit claimed at 62 is paid in full, 16,800; as wages it withholds
// 7,760 and pays 9,040.
describeRule('usc-42-403-f-5-earnings-counted', {
  readings: {
    workIncomeCountsAsEarnings: 9_040,
    onlyWageStreamsCount: 16_800,
  },
  accepted: 'workIncomeCountsAsEarnings',
  produced: 'onlyWageStreamsCount',
}, ({ accepted, produced }) => {
  it('does not test a recurring income, which names no person', () => {
    const recurring: IncomeStream = {
      type: 'recurring', id: testIds(), label: 'Part-time work', annualAmount: 40_000, startYear: 2026, endYear: 2026, inflationAdjusted: false, taxTreatment: 'ordinary',
    }
    const paid = paidBy([person('P', '1964-03-10')], [ss('P', 2_000, 62), recurring])
    expect(paid('P', 2026)).toBe(produced)
    expect(paid('P', 2026)).not.toBe(accepted)
  })
})

// The implementation review's case B: J, born 1964-02-10, PIA 600, claims at 62
// (February 2026, 420 a month). Her first husband died: PIA 3,000, claimed at his
// full retirement age, married 20 years. She remarried at 55, to H, born
// 1962-03-20, PIA 1,000 (half of it is below hers, so no spouse benefit), who
// claims at 67 and dies in December 2030. The remarriage before 60 bars the
// benefit on her first husband while it lasts; from January 2031 she is
// unmarried, and entitlement can begin then (POMS RS 00207.003 A), so the
// reduction runs from that month (402(q)(6)(A)(iii)): 803 months, 1 month before
// her survivor full retirement age, 3,000 x (1 - 0.285 x 1/84) = 2,989.82 a
// month, 35,877.86. Reduced from her own claim at 744 months: 2,389.29,
// 28,671.43. As a bar for life (the engine before this decision): the widow
// benefit on H, 996.61 a month, 11,959.29.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'a remarriage before 60 that ends with the current spouse\'s death',
  readings: {
    entitledFromTheJanuaryAfterTheDeath: 35_877.86,
    reducedFromTheOwnClaim: 28_671.43,
    barredForLife: 11_959.29,
  },
  accepted: 'entitledFromTheJanuaryAfterTheDeath',
}, ({ accepted, readings }) => {
  it('reduces the benefit freed by the end of a pre-60 remarriage from its own first month of entitlement (case B)', () => {
    const first: FormerSpouse = { id: 'first', relationship: 'deceased', dob: '1958-05-10', piaMonthly: 3_000, marriageYears: 20, remarriedAtAge: 55 }
    const paid = paidBy([person('H', '1962-03-20', 68), person('J', '1964-02-10')], [ss('H', 1_000, 67), ss('J', 600, 62, 0, [first])])
    expect(paid('J', 2029)).toBe(5_040)
    expect(paid('J', 2030)).toBe(5_040)
    expect(paid('J', 2031)).toBe(accepted)
    expect(paid('J', 2031)).not.toBe(readings.reducedFromTheOwnClaim)
    expect(paid('J', 2031)).not.toBe(readings.barredForLife)
    // Claiming at 67 (February 2031), both readings pay the unreduced 3,000.
    const at67 = paidBy([person('H', '1962-03-20', 68), person('J', '1964-02-10')], [ss('H', 1_000, 67), ss('J', 600, 67, 0, [first])])
    expect(at67('J', 2031)).toBe(36_000)
  })
})

// The second verification's gap S3, the age-60 boundary of case B's rule. J,
// born 1964-02-10, PIA 1,200, claims at 62 (February 2026). Her first husband
// died: PIA 3,000, claimed at his full retirement age, married 20 years. H, born
// 1962-03-20, PIA 2,200, claims at 67 and dies in December 2032. A remarriage at
// 60 is disregarded (42 U.S.C. 402(e)(3)(A): "marries after attaining age 60"),
// so the benefit on her first husband is paid from her own claim and reduced
// from it, 744 months: 3,000 x (1 - 0.285 x 60/84) = 2,389.29 a month, 28,671.43
// in 2033, more than the widow benefit on H, 2,200. Remarried at 59, the
// benefit is barred until H's death and starts in January 2033, at 827 months,
// past her survivor full retirement age: 3,000 a month, 36,000, which is what a
// remarriage at 60 would pay if it barred the benefit too.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'a remarriage at exactly 60 does not bar the benefit, so its reduction runs from the own claim',
  readings: {
    remarriageAt60Disregarded: 28_671.43,
    remarriageAt60BarsUntilTheDeath: 36_000,
  },
  accepted: 'remarriageAt60Disregarded',
}, ({ accepted, readings }) => {
  it('reduces from the own claim when the remarriage was at 60, and from the January after the death when it was at 59', () => {
    const first = (remarriedAtAge: number): FormerSpouse => ({ id: 'first', relationship: 'deceased', dob: '1958-05-10', piaMonthly: 3_000, marriageYears: 20, remarriedAtAge })
    const paidAt = (remarriedAtAge: number) =>
      paidBy([person('H', '1962-03-20', 70), person('J', '1964-02-10')], [ss('H', 2_200, 67), ss('J', 1_200, 62, 0, [first(remarriedAtAge)])])
    expect(paidAt(60)('J', 2033)).toBe(accepted)
    expect(paidAt(60)('J', 2033)).not.toBe(readings.remarriageAt60BarsUntilTheDeath)
    expect(paidAt(59)('J', 2033)).toBe(readings.remarriageAt60BarsUntilTheDeath)
  })
})

// L11: H, born 1961-02-15, PIA 800, claimed at 64, dies in December 2027. J, born
// 1962-02-15, PIA 400, claimed at 64 (320 a month), has a living ex with a 4,000
// PIA after a 12-year marriage. From January 2028 J is unmarried: the divorced-
// spouse benefit, reduced for her 791 months then, 320 + 1,600 x (1 - 13 x 25/36%)
// = 1,775.56 a month, 21,306.67, is larger than the widow benefit on H, 660 a month.
describeRule('usc-42-402-b-1-C-divorced-spouse-after-widowhood', {
  readings: {
    unmarriedFromJanuaryAfterTheDeath: 21_306.67,
    marriedForLife: 7_920,
  },
  accepted: 'unmarriedFromJanuaryAfterTheDeath',
}, ({ accepted, readings }) => {
  it('pays a widowed couple member on a living ex\'s record from January after the death', () => {
    const ex: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: '1958-06-15', piaMonthly: 4_000, marriageYears: 12, remarriedAtAge: null }
    const paid = paidBy([person('H', '1961-02-15', 66), person('J', '1962-02-15')], [ss('H', 800, 64), ss('J', 400, 64, 0, [ex])])
    expect(paid('J', 2027)).toBe(3_840)
    expect(paid('J', 2028)).toBe(accepted)
    expect(paid('J', 2028)).not.toBe(readings.marriedForLife)
  })
})

// L10 / worksheet E9: a single woman born 1960-01-15 (old-age FRA January 2027,
// survivor FRA 66y8m, September 2026), own PIA 500 claimed at 62 in 2022, with a
// deceased spouse (PIA 2,000, claimed at FRA, 20 years married): widow(er)
// benefit 1 - 0.285 x 56/80, 1,601 a month. $60,000 of 2026 wages: 17,760 is
// charged January-August (12,808), then against 1,658 from September; 11 deduction
// months, of which January-August are in the widow(er) reduction period. From
// 2027 she is paid 48 months early: 0.829 x 2,000 x 12 = 19,896. Crediting all 11
// months (the engine to 2026-09-29): 20,152.50.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'months withheld after the survivor full-retirement-age month are not credited',
  readings: {
    onlyMonthsOfTheWidowReductionPeriod: 19_896,
    everyMonthWithheldWhileTheWidowBenefitWasPaid: 20_152.5,
  },
  accepted: 'onlyMonthsOfTheWidowReductionPeriod',
}, ({ accepted, readings }) => {
  it('credits the widow(er) benefit only with months before the survivor FRA month (E9)', () => {
    const deceased: FormerSpouse = { id: 'dec', relationship: 'deceased', dob: '1957-06-10', piaMonthly: 2_000, marriageYears: 20, remarriedAtAge: null }
    const paid = paidBy([person('P', '1960-01-15')], [ss('P', 500, 62, 0, [deceased]), wages('P', 60_000, 67)])
    expect(paid('P', 2026)).toBe(1_680)
    expect(paid('P', 2027)).toBe(accepted)
    expect(paid('P', 2027)).not.toBe(readings.everyMonthWithheldWhileTheWidowBenefitWasPaid)
  })
})

// The implementation review's gap ET14: the worker's two-thirds share of a
// partial month is held to his own benefit (20 CFR 404.440). W, born
// 1964-01-15, PIA 2,000, claims at 62 (1,400 a month) with $24,680 of 2026
// wages: an excess of 100. S, born 1959-01-20, PIA 100, claims at 67: her own
// 101.33 (two months of credits) and the spouse benefit on his record bring her
// total to 1,000 (the combination without her credits, POMS RS 00615.694), 898.67
// on his record. January's family benefit is 2,298.67; the 100 charged leaves
// 2,198.67, whose two thirds, 1,465.78, is more than his 1,400, so his share is
// 1,400 and hers the rest: he is paid 16,800 and she 12,000 - 100 = 11,900.
// Uncapped, he would be paid 16,865.78 and she 11,834.22.
describeRule('usc-42-403-b-1-worker-excess-charged-to-family', {
  note: 'the worker\'s share of a partial month held to his own benefit',
  readings: {
    workerShareHeldToHisBenefit: { w: 16_800, s: 11_900 },
    workerShareUncapped: { w: 16_865.78, s: 11_834.22 },
  },
  accepted: 'workerShareHeldToHisBenefit',
}, ({ accepted, readings }) => {
  it('gives the other the part of the worker\'s share above his own benefit (404.440)', () => {
    const paid = paidBy([person('W', '1964-01-15'), person('S', '1959-01-20')], [ss('W', 2_000, 62), ss('S', 100, 67), wages('W', 24_680, 63)])
    const observed = { w: paid('W', 2026), s: paid('S', 2026) }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.workerShareUncapped)
  })
})

// The implementation review's gap ET15: E5 with W's wages at $57,700, an excess
// of 16,610. January-September take 9 x 1,790 = 16,110; October the last 500,
// leaving 1,290, of which her third, 430, is more than her 390, so she is paid
// her whole 390 that month. His excess was still charged to that month, so it
// is one of her 10 spouse crediting months (POMS RS 00615.482 B.2): from January
// 2031 she is paid 280 + 600 x 0.691667 = 695 a month, 8,340. Crediting only a
// month in which her own share was reduced: 9 months, 8,310.
describeRule('poms-rs-00615-482-arf-crediting-months', {
  note: 'a spouse month the worker\'s excess was charged to, her prorated share paid in full',
  readings: {
    creditedWheneverHisExcessWasCharged: 8_340,
    creditedOnlyWhenHerShareWasReduced: 8_310,
  },
  accepted: 'creditedWheneverHisExcessWasCharged',
}, ({ accepted, readings }) => {
  it('credits the spouse benefit in a partial month whose prorated share is her whole benefit (RS 00615.482 B.2)', () => {
    const paid = paidBy([person('W', '1964-01-15'), person('S', '1964-01-20')], [ss('W', 2_000, 62), ss('S', 400, 62), wages('W', 57_700, 63)])
    expect(paid('S', 2031)).toBe(accepted)
    expect(paid('S', 2031)).not.toBe(readings.creditedOnlyWhenHerShareWasReduced)
  })
})

// The implementation review's gap HY21: a former spouse's widow(er) benefit is
// charged, and credited, only from its first month of entitlement. P, born
// 1964-06-15, own PIA 500, claims at 62, entitled from June 2026; a deceased
// former spouse's record, PIA 2,000 claimed at his full retirement age: the
// widow(er) benefit, reduced at 744 months, is 1,592.86 a month. $60,000 of 2026
// wages, an excess of 17,760, withholds June-December, 7 months, all credited;
// January-May are paid under the claim-year convention, 7,964.29. From her June
// 2031 survivor full-retirement-age month she is priced at 751 months, 1,640.36:
// 2031 pays 5 x 1,592.86 + 7 x 1,640.36 = 19,446.79. Charged and credited from
// January: 1,354.29 in 2026 and 19,684.29 in 2031.
describeRule('poms-rs-00615-482-arf-crediting-months', {
  note: 'a former spouse\'s widow(er) benefit, from its first month of entitlement',
  readings: {
    fromItsFirstMonthOfEntitlement: { y2026: 7_964.29, y2031: 19_446.79 },
    fromJanuaryOfTheClaimYear: { y2026: 1_354.29, y2031: 19_684.29 },
  },
  accepted: 'fromItsFirstMonthOfEntitlement',
}, ({ accepted, readings }) => {
  it('charges and credits a former spouse\'s widow(er) benefit only from its first month of entitlement', () => {
    const deceased: FormerSpouse = { id: 'dec', relationship: 'deceased', dob: '1962-05-10', piaMonthly: 2_000, marriageYears: 20, remarriedAtAge: null }
    const paid = paidBy([person('P', '1964-06-15')], [ss('P', 500, 62, 0, [deceased]), wages('P', 60_000, 63)])
    const observed = { y2026: paid('P', 2026), y2031: paid('P', 2031) }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.fromJanuaryOfTheClaimYear)
  })
})

// The implementation review's gaps HY12 and HY26: after the latest published
// year the exempt amounts grow at the plan's inflation (the recorded stand-in).
// At 2.5% inflation with the COLA matching it: born 1964-01-15, PIA 2,000,
// claims at 62, $40,000 of wages in 2026 and 2027 (41,000 in 2027): the 2027
// lower amount is 24,480 x 1.025 = 25,092, the excess floor((41,000 - 25,092)/2)
// = 7,954, and 2027 pays 12 x 1,435 - 7,954 = 9,266 (at 24,480: 8,960). Born
// 1960-07-15 (FRA month July 2027), claimed at 62, $150,000 a year: 2027's six
// months before July earn 76,875 against 65,160 x 1.025 = 66,789, an excess of
// 3,362, charged January to March; from July, 15 crediting months, 2,050 x 0.7625
// = 1,563.13: 2027 pays 6 x 1,435 - 3,362 + 6 x 1,563.13 = 14,626.75 (at 65,160:
// 14,083.75).
describeRule('usc-42-403-f-8-earnings-test-exempt-amounts', {
  note: 'carried past the latest published year at the plan\'s inflation, in the ledger',
  readings: {
    carriedAtThePlansInflation: { lower2027: 9_266, higher2027: 14_626.75 },
    heldAtThe2026Amounts: { lower2027: 8_960, higher2027: 14_083.75 },
  },
  accepted: 'carriedAtThePlansInflation',
}, ({ accepted, readings }) => {
  it('tests 2027 against the 2026 amounts grown at the plan\'s inflation', () => {
    const lower = paidBy([person('P', '1964-01-15')], [ss('P', 2_000, 62), wages('P', 40_000, 64)], 2.5)
    const higher = paidBy([person('P', '1960-07-15')], [ss('P', 2_000, 62), wages('P', 150_000, 68)], 2.5)
    const observed = { lower2027: lower('P', 2027), higher2027: higher('P', 2027) }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.heldAtThe2026Amounts)
  })
})
