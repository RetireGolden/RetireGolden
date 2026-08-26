import { expect, it } from 'vitest'

import type { QualifiedCharitableDistributionRequest } from '../../actions/contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from '../../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../../actions/money.js'
import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

/**
 * Fixtures for the three approximated records that had gone stale on main,
 * after each was retargeted onto the gap that is still real.
 *
 * All three described behaviour a parallel branch had already fixed — the
 * QCD/RMD conditioning gate, the calendar-age 71 QCD gate, and the undivided
 * spousal HSA family limit — and none failed anything on the way, because
 * until now no `approximated` record carried a fixture at all.
 *
 * Two of the three were closed by the same commit, which is the shape to
 * expect: one change closes several recorded gaps at once, and the records it
 * silently falsifies are the ones nobody thought to re-read.
 */

let counter = 0
const testIds = (): string => `approx-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

/** Age 73 in 2026, still working, so a post-70.5 deductible IRA contribution is live. */
function workingSeptuagenarian(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1953-03-15',
    sex: 'average',
    retirementAge: 80,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  return plan
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(balance: number, contribution = 0): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function rothIra(balance: number, contribution = 0): Account {
  return {
    type: 'roth',
    id: testIds(),
    name: 'Roth IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function hsa(balance: number, contribution: number): Account {
  return {
    type: 'hsa',
    id: testIds(),
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance,
    annualContribution: contribution,
  }
}

function wages(annualGross: number, endAge: number | null = null): IncomeStream {
  return { type: 'wages', id: testIds(), personId: 'p1', annualGross, endAge, realGrowthPct: 0 }
}

function traditionalIraWithId(id: string, balance: number, contribution = 0): Account {
  return {
    type: 'traditional',
    id,
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function preStartNamedQcd(
  sourceAccountId: string,
  taxYear: number,
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(6_000 * 100)
  return {
    actionId: asActionId('pre-start-qcd'),
    kind: 'qcd',
    year: taxYear,
    executionDate: `${taxYear}-08-01`,
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('pre-start-qcd-alloc'),
      sourceAccountId: asAccountId(sourceAccountId),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'pre-start-charity',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const noTax = createFlatTaxCalculator(0)
const pack2026 = packForYear(2026).pack

// The deductible IRA contribution the donor makes in the same year as the gift.
// Larger than the gift, so the statutory reduction swallows the exclusion whole
// and the two readings cannot be confused for a rounding difference.
const DEDUCTIBLE_IRA_CONTRIBUTION = pack2026.contributionLimits.ira
  + pack2026.contributionLimits.iraCatchUp50
const GIFT = 4_000

describeRule('irc-408-d-8-A-projection-post-70-half-contribution-offset', {
  readings: {
    // 408(d)(8)(A) second sentence: the exclusion is reduced, but not below
    // zero, by post-70.5 deductible section 219 contributions. The contribution
    // here exceeds the gift, so the whole exclusion is swept. Readings are the
    // MAGI reduction (ungifted MAGI − gifted MAGI). YearResult.qcd is the
    // gross gift on both readings.
    statuteSweepsTheWholeExclusion: 0,
    engineExcludesTheGiftRegardless: GIFT,
  },
  accepted: 'statuteSweepsTheWholeExclusion',
  note: 'same-year §219 contribution swallows the gift',
}, ({ accepted, readings }) => {
  it('sweeps a gift the statute offsets to nothing', () => {
    const withGift = workingSeptuagenarian()
    withGift.accounts = [cash(0), traditionalIra(265_000, DEDUCTIBLE_IRA_CONTRIBUTION), hsa(0, 0)]
    withGift.incomes = [wages(120_000)]
    withGift.strategies.qcdAnnual = GIFT
    const withoutGift = workingSeptuagenarian()
    withoutGift.accounts = [cash(0), traditionalIra(265_000, DEDUCTIBLE_IRA_CONTRIBUTION), hsa(0, 0)]
    withoutGift.incomes = [wages(120_000)]

    const gifted = simulatePlan(validate(withGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!
    const ungifted = simulatePlan(validate(withoutGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!

    // The setup only discriminates if the contribution actually happened; a
    // year in which the engine refused the contribution would produce the same
    // exclusion for an entirely different reason.
    expect(gifted.contributions).toBeGreaterThanOrEqual(DEDUCTIBLE_IRA_CONTRIBUTION)
    expect(gifted.qcd).toBeCloseTo(GIFT, 6)
    expect(ungifted.qcd).toBe(0)
    expect(ungifted.magi - gifted.magi).toBeCloseTo(accepted, 6)
    expect(ungifted.magi - gifted.magi).not.toBeCloseTo(readings.engineExcludesTheGiftRegardless, 6)
  })

  it('does not sweep the same gift when the contribution is Roth, not §219', () => {
    // Only deductions allowed under section 219 count. A Roth IRA contribution
    // is 408A, not 219, so the same dollars deposited after 70½ leave the
    // exclusion untouched.
    const withGift = workingSeptuagenarian()
    withGift.accounts = [
      cash(0),
      traditionalIra(265_000),
      rothIra(0, DEDUCTIBLE_IRA_CONTRIBUTION),
    ]
    withGift.incomes = [wages(120_000)]
    withGift.strategies.qcdAnnual = GIFT
    const withoutGift = workingSeptuagenarian()
    withoutGift.accounts = [
      cash(0),
      traditionalIra(265_000),
      rothIra(0, DEDUCTIBLE_IRA_CONTRIBUTION),
    ]
    withoutGift.incomes = [wages(120_000)]

    const gifted = simulatePlan(validate(withGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!
    const ungifted = simulatePlan(validate(withoutGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!

    expect(gifted.contributions).toBeGreaterThanOrEqual(DEDUCTIBLE_IRA_CONTRIBUTION)
    expect(gifted.qcd).toBeCloseTo(GIFT, 6)
    expect(ungifted.magi - gifted.magi).toBeCloseTo(readings.engineExcludesTheGiftRegardless, 6)
    expect(ungifted.magi - gifted.magi).not.toBeCloseTo(accepted, 6)
  })
})

/**
 * Pub. 590-B (2025), Jim’s illustrated QCD Adjustment Worksheets.
 *
 * Jim became 70½ in 2023 and deducted $5,000 in 2024 and $5,000 in 2025. No
 * contribution for 2026. QCD of $6,000 for 2025 and $6,500 for 2026. The 2025
 * worksheet reduces the exclusion to a $4,000 leftover; the 2026 worksheet
 * excludes $2,500 ($6,500 − $4,000).
 *
 * The parameter pack’s first year is 2026, so the two gift years map onto
 * 2026 and 2027. The $10,000 of §219 is seeded as declared facts for 2024 and
 * 2025 — Jim’s actual contribution years, which sit before the projection.
 * Inflation is exactly 6,500/6,000 − 1 so the second-year gift is the
 * worksheet’s $6,500, not a price forecast.
 *
 * https://www.irs.gov/publications/p590b
 */
const JIM_FIRST_YEAR_QCD = 6_000
const JIM_SECOND_YEAR_QCD = 6_500
const JIM_SECTION_219_PER_YEAR = 5_000

describeRule('irc-408-d-8-A-projection-post-70-half-contribution-offset', {
  readings: {
    statuteLifetimeCarryforward: { firstYear: 0, secondYear: 2_500 },
    noOffset: { firstYear: JIM_FIRST_YEAR_QCD, secondYear: JIM_SECOND_YEAR_QCD },
    annualOffsetNoCarryforward: { firstYear: 0, secondYear: JIM_SECOND_YEAR_QCD },
  },
  accepted: 'statuteLifetimeCarryforward',
  note: 'Pub. 590-B Jim multi-year carryforward',
}, ({ accepted, readings }) => {
  it('carries Jim’s unused §219 offset into the next gift year', () => {
    const plan = workingSeptuagenarian()
    plan.accounts = [cash(0), traditionalIra(265_000)]
    plan.strategies.qcdAnnual = JIM_FIRST_YEAR_QCD
    plan.assumptions.inflationPct =
      ((JIM_SECOND_YEAR_QCD / JIM_FIRST_YEAR_QCD) - 1) * 100
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [],
      sepSimpleActivities: [],
      deductibleIraContributions: [2024, 2025].map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: asUsdCents(JIM_SECTION_219_PER_YEAR * 100),
        evidenceId: `jim-219-${taxYear}`,
        provenance: { source: 'manual', sourceId: `p590b-jim-${taxYear}` },
      })),
    }

    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    })
    const first = result.years.find((y) => y.year === 2026)!
    const second = result.years.find((y) => y.year === 2027)!

    expect(first.qcd).toBeCloseTo(JIM_FIRST_YEAR_QCD, 6)
    expect(second.qcd).toBeCloseTo(JIM_SECOND_YEAR_QCD, 6)
    // Leftover is ordinary income and does not lower MAGI. Year 1 excludes
    // nothing, so MAGI is the whole required distribution. Year 2 excludes
    // $2,500. Those MAGI reductions are the statute's readings; YearResult.qcd
    // stays the gross gift.
    expect(first.rmd - first.magi).toBeCloseTo(accepted.firstYear, 6)
    expect(second.rmd - second.magi).toBeCloseTo(accepted.secondYear, 6)
    expect(second.rmd - second.magi).not.toBeCloseTo(readings.noOffset.secondYear, 6)
    expect(second.rmd - second.magi).not.toBeCloseTo(
      readings.annualOffsetNoCarryforward.secondYear, 6,
    )
    expect(first.magi).toBeCloseTo(first.rmd, 6)
    expect(second.magi).toBeCloseTo(second.rmd - accepted.secondYear, 6)
  })
})

/**
 * Born 1957-03-15: attains 70½ on 2027-09-15. The 2026 taxable year ends
 * 31 December 2026, before that date, so a 2026 §219 deduction is outside
 * limb (i) of 408(d)(8)(A).
 */
function crossesSeventyAndAHalfIn2027(): Plan {
  const plan = workingSeptuagenarian()
  plan.household.people[0]!.dob = '1957-03-15'
  return plan
}

const PRE_THRESHOLD_CONTRIBUTION = 5_000

describeRule('irc-408-d-8-A-projection-post-70-half-contribution-offset', {
  readings: {
    // Limb (i) is deductions for taxable years ending on or after the date
    // the taxpayer attains 70½. A 2026 contribution does not reduce a 2027
    // gift. There is no RMD at 70, so a wrongly applied offset shows up as
    // leftover ordinary income (gifted MAGI − ungifted MAGI), not as a
    // missing MAGI reduction — a fully excluded beyond-RMD gift never
    // entered income in the first place.
    statuteIgnoresYearsEndingBefore70Half: 0,
    countsAnyTraditionalIraContribution: GIFT,
  },
  accepted: 'statuteIgnoresYearsEndingBefore70Half',
  note: 'pre-70½ contributions do not reduce the exclusion',
}, ({ accepted, readings }) => {
  it('does not reduce a post-threshold gift by a contribution from a year that ended before 70½', () => {
    const withGift = crossesSeventyAndAHalfIn2027()
    withGift.accounts = [cash(0), traditionalIra(100_000, PRE_THRESHOLD_CONTRIBUTION)]
    withGift.incomes = [wages(50_000, 70)]
    withGift.strategies.qcdAnnual = GIFT
    const withoutGift = crossesSeventyAndAHalfIn2027()
    withoutGift.accounts = [cash(0), traditionalIra(100_000, PRE_THRESHOLD_CONTRIBUTION)]
    withoutGift.incomes = [wages(50_000, 70)]

    const giftedYears = simulatePlan(validate(withGift), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    }).years
    const ungiftedYears = simulatePlan(validate(withoutGift), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    }).years
    const gifted2026 = giftedYears.find((y) => y.year === 2026)!
    const gifted2027 = giftedYears.find((y) => y.year === 2027)!
    const ungifted2027 = ungiftedYears.find((y) => y.year === 2027)!

    expect(gifted2026.contributions).toBeGreaterThanOrEqual(PRE_THRESHOLD_CONTRIBUTION)
    expect(gifted2026.qcd).toBe(0)
    expect(gifted2027.contributions).toBe(0)
    expect(gifted2027.qcd).toBeCloseTo(GIFT, 6)
    expect(gifted2027.rmd).toBe(0)
    expect(gifted2027.magi - ungifted2027.magi).toBeCloseTo(accepted, 6)
    expect(gifted2027.magi - ungifted2027.magi)
      .not.toBeCloseTo(readings.countsAnyTraditionalIraContribution, 6)
  })

  it('does reduce the same gift when the contribution is for the threshold year', () => {
    const withGift = crossesSeventyAndAHalfIn2027()
    withGift.accounts = [cash(0), traditionalIra(100_000, PRE_THRESHOLD_CONTRIBUTION)]
    withGift.incomes = [wages(50_000)]
    withGift.strategies.qcdAnnual = GIFT
    const withoutGift = crossesSeventyAndAHalfIn2027()
    withoutGift.accounts = [cash(0), traditionalIra(100_000, PRE_THRESHOLD_CONTRIBUTION)]
    withoutGift.incomes = [wages(50_000)]

    const gifted = simulatePlan(validate(withGift), { startYear: 2027, taxCalculator: noTax })
      .years.find((y) => y.year === 2027)!
    const ungifted = simulatePlan(validate(withoutGift), { startYear: 2027, taxCalculator: noTax })
      .years.find((y) => y.year === 2027)!

    expect(gifted.contributions).toBeGreaterThanOrEqual(PRE_THRESHOLD_CONTRIBUTION)
    expect(gifted.qcd).toBeCloseTo(GIFT, 6)
    expect(gifted.magi - ungifted.magi).toBeCloseTo(readings.countsAnyTraditionalIraContribution, 6)
    expect(gifted.magi - ungifted.magi).not.toBeCloseTo(accepted, 6)
  })
})

const PRIOR_SECTION_219 = 3_000
const GIFT_LARGER_THAN_PRIOR_219 = 6_500
const PRE_START_IRA_ID = 'ira-p1'

describeRule('irc-408-d-8-A-projection-post-70-half-contribution-offset', {
  readings: {
    // Limb (ii) is reductions already taken. A named QCD the Plan declares
    // before the projection starts is a real gift; the run cannot prove how
    // much of the $3,000 §219 it absorbed. Substituting consumed = 0 would
    // exclude $3,500 of a $6,500 gift. Fail-closed claims none of the
    // exclusion. Readings are the MAGI reduction.
    statuteFailsClosedWhenLimbIiUnprovable: 0,
    assumesNoPriorReductions: GIFT_LARGER_THAN_PRIOR_219 - PRIOR_SECTION_219,
  },
  accepted: 'statuteFailsClosedWhenLimbIiUnprovable',
  note: 'pre-start named QCD makes limb (ii) unprovable',
}, ({ accepted, readings }) => {
  function priorSection219Facts(): NonNullable<Plan['retirementActionEligibilityFacts']> {
    return {
      iraClassifications: [{
        sourceAccountId: PRE_START_IRA_ID,
        subtype: 'traditional',
        evidenceId: 'classification-ira-p1',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [{
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(PRIOR_SECTION_219 * 100),
        evidenceId: 'prior-219-2025',
        provenance: { source: 'manual', sourceId: 'ledger-2025' },
      }],
    }
  }

  it('does not claim the exclusion when a pre-start named QCD makes prior reductions unprovable', () => {
    const withGift = workingSeptuagenarian()
    withGift.accounts = [cash(0), traditionalIraWithId(PRE_START_IRA_ID, 265_000)]
    withGift.strategies.qcdAnnual = GIFT_LARGER_THAN_PRIOR_219
    withGift.strategies.retirementActions = [preStartNamedQcd(PRE_START_IRA_ID, 2025)]
    withGift.retirementActionEligibilityFacts = priorSection219Facts()
    const withoutGift = workingSeptuagenarian()
    withoutGift.accounts = [cash(0), traditionalIraWithId(PRE_START_IRA_ID, 265_000)]
    withoutGift.strategies.retirementActions = [preStartNamedQcd(PRE_START_IRA_ID, 2025)]
    withoutGift.retirementActionEligibilityFacts = priorSection219Facts()

    const gifted = simulatePlan(validate(withGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!
    const ungifted = simulatePlan(validate(withoutGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!

    expect(gifted.qcd).toBeCloseTo(GIFT_LARGER_THAN_PRIOR_219, 6)
    expect(ungifted.qcd).toBe(0)
    expect(ungifted.magi - gifted.magi).toBeCloseTo(accepted, 6)
    expect(ungifted.magi - gifted.magi).not.toBeCloseTo(readings.assumesNoPriorReductions, 6)
  })

  it('applies the unused §219 when no pre-start gift has made limb (ii) unprovable', () => {
    const withGift = workingSeptuagenarian()
    withGift.accounts = [cash(0), traditionalIraWithId(PRE_START_IRA_ID, 265_000)]
    withGift.strategies.qcdAnnual = GIFT_LARGER_THAN_PRIOR_219
    withGift.retirementActionEligibilityFacts = priorSection219Facts()
    const withoutGift = workingSeptuagenarian()
    withoutGift.accounts = [cash(0), traditionalIraWithId(PRE_START_IRA_ID, 265_000)]
    withoutGift.retirementActionEligibilityFacts = priorSection219Facts()

    const gifted = simulatePlan(validate(withGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!
    const ungifted = simulatePlan(validate(withoutGift), { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!

    expect(gifted.qcd).toBeCloseTo(GIFT_LARGER_THAN_PRIOR_219, 6)
    expect(ungifted.magi - gifted.magi).toBeCloseTo(readings.assumesNoPriorReductions, 6)
    expect(ungifted.magi - gifted.magi).not.toBeCloseTo(accepted, 6)
  })
})

/** Crosses 70.5 on 30 December 2026, with two days of the year left. */
function crossesSeventyAndAHalfAtYearEnd(): Plan {
  const plan = workingSeptuagenarian()
  plan.household.people[0]!.dob = '1956-06-30'
  return plan
}

describeRule('irc-408-d-8-B-ii-projection-annual-age-proxy', {
  readings: {
    // The ledger holds one number for the year and no gift date, so the
    // statutory reading has to be stated for a gift the donor actually makes:
    // one dated before 30 December 2026 is not a QCD, and nothing about it is
    // excludable. That is the whole of the gift here.
    statuteExcludesNothingBeforeTheHalfBirthday: 0,
    engineExcludesTheWholeCrossingYear: GIFT,
  },
  accepted: 'statuteExcludesNothingBeforeTheHalfBirthday',
  produced: 'engineExcludesTheWholeCrossingYear',
  note: 'when in the crossing year eligibility starts',
}, ({ accepted, produced }) => {
  it('admits a donor from 1 January of the year they cross 70.5 in December', () => {
    const plan = crossesSeventyAndAHalfAtYearEnd()
    plan.accounts = [cash(0), traditionalIra(500_000)]
    plan.strategies.qcdAnnual = GIFT

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((y) => y.year === 2026)!

    // Age 70, so no RMD is due: the gift is funded entirely out of the
    // pre-RMD window, which is the arm that used to be closed altogether.
    expect(year.rmd).toBe(0)
    expect(year.qcd).toBeCloseTo(produced, 6)
    expect(year.qcd).not.toBeCloseTo(accepted, 6)
  })

  it('refuses a donor whose half-birthday falls in the following year', () => {
    // The control the permissive reading needs: eligibility is granted from 1
    // January of the crossing year and not before, so a July birth — 70.5 in
    // January 2027 — gets nothing in 2026. Without this the fixture could pass
    // on an engine that simply admitted everyone.
    const plan = crossesSeventyAndAHalfAtYearEnd()
    plan.household.people[0]!.dob = '1956-07-01'
    plan.accounts = [cash(0), traditionalIra(500_000)]
    plan.strategies.qcdAnnual = GIFT

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2026)!.qcd).toBe(0)
  })
})

describeRule('irc-223-b-2-7-projection-coverage-proration-and-medicare', {
  readings: {
    // 223(b)(7) sets the monthly limitation to zero for the first month of
    // Medicare entitlement and every month after. At 73 the taxpayer has been
    // entitled for eight years, so no month of the year carries a limit.
    statuteZeroOnceEntitledToMedicare: 0,
    engineAllowsAWholeSelfOnlyLimitPlusCatchUp:
      pack2026.contributionLimits.hsaSelfOnly + pack2026.contributionLimits.hsaCatchUp55,
  },
  accepted: 'statuteZeroOnceEntitledToMedicare',
  produced: 'engineAllowsAWholeSelfOnlyLimitPlusCatchUp',
  note: 'Medicare entitlement',
}, ({ accepted, produced }) => {
  it('allows a whole HSA limit to a taxpayer eight years into Medicare', () => {
    const plan = workingSeptuagenarian()
    // One person, so the coverage tier is self-only and 223(b)(5) division —
    // which IS implemented — never enters. This fixture is about (b)(7) alone.
    plan.accounts = [cash(0), hsa(0, 20_000)]
    plan.incomes = [wages(120_000)]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((y) => y.year === 2026)!

    expect(year.contributions).toBeCloseTo(produced, 6)
    expect(year.contributions).not.toBeCloseTo(accepted, 6)
  })
})

const HSA_EXCESS_CONTRIBUTION = 1_000
const STATUTORY_HSA_EXCISE = HSA_EXCESS_CONTRIBUTION * 0.06
// Observed produced pin (fixture run 2026-08-26): the projection imposes no
// section 4973 HSA excise; penalties stay 0.
const producedHsaExciseNone = 0

describeRule('irc-4973-a-g-hsa-excess-contribution-excise', {
  readings: {
    // The authority fact is that this taxpayer was Medicare-entitled before
    // 2026, so 223(b)(7) permits no 2026 HSA contribution. At a $1,000
    // year-end HSA value, Form 5329 Part VII line 49 gives min(1000, 1000)
    // × 0.06 = $60.
    statuteSixPercentExcise: STATUTORY_HSA_EXCISE,
    engineOmitsTheExcise: producedHsaExciseNone,
  },
  accepted: 'statuteSixPercentExcise',
  produced: 'engineOmitsTheExcise',
  note: 'Medicare-entitled HSA excess',
}, ({ accepted, produced }) => {
  it('does not add the section 4973 HSA excise to YearResult.penalties', () => {
    const plan = workingSeptuagenarian()
    plan.accounts = [cash(0), hsa(0, HSA_EXCESS_CONTRIBUTION)]
    plan.incomes = [wages(120_000)]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((candidate) => candidate.year === 2026)!

    expect(year.contributions).toBeCloseTo(HSA_EXCESS_CONTRIBUTION, 6)
    expect(year.penalties).toBeCloseTo(produced, 6)
    expect(year.penalties).not.toBeCloseTo(accepted, 6)
  })
})
