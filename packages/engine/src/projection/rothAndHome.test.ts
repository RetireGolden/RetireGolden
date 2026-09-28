/**
 * Engine tests for the V8-depth additions surfaced from a planning session:
 *   - Roth ordering + 5-year rules (contributions free, conversion recapture,
 *     pre-59½ earnings taxed + penalized).
 *   - Debt lump-sum payoff year.
 *   - Property carrying costs (tax + insurance) that outlive the mortgage.
 */

import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const ids = () => `rh-${++counter}`
const noTax = createFlatTaxCalculator(0)

function basePlan(age: number): Plan {
  const plan = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: `${2026 - age}-03-15`,
    sex: 'average',
    retirementAge: age,
    longevity: { planningAge: Math.max(60, age + 8), source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function run(plan: Plan) {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return simulatePlan(r.plan, { startYear: 2026, taxCalculator: noTax })
}

describe('Roth ordering + 5-year rules', () => {
  it('withdraws contributions tax- and penalty-free before 59½', () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 20_000
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 200_000, annualContribution: 0, contributionBasis: 200_000 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(20_000, 0)
    expect(y.penalties).toBe(0)
    expect(y.magi).toBeCloseTo(0, 0) // contributions are not income
  })

  it('penalizes a conversion tapped within 5 years before 59½ (the ladder rule)', () => {
    const plan = basePlan(55)
    plan.expenses.baseAnnual = 20_000
    // Convert the whole traditional balance into the (empty) Roth this year, then
    // live on it — so spending drains the freshly converted, unseasoned principal.
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    plan.accounts = [
      { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 } as Account,
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeGreaterThan(20_000) // had to gross up for the penalty
    expect(y.penalties).toBeCloseTo(y.withdrawals.roth * 0.1, 0) // 10% recapture on the conversion
  })

  it('waives the conversion recapture once age 60 is attained', () => {
    const plan = basePlan(62)
    plan.expenses.baseAnnual = 20_000
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    plan.accounts = [
      { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 } as Account,
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(20_000, 0)
    expect(y.penalties).toBe(0)
  })

  it('taxes and penalizes Roth earnings withdrawn before 59½', () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 20_000
    // contributionBasis 0 → the entire balance is earnings.
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 200_000, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.penalties).toBeCloseTo(y.withdrawals.roth * 0.1, 0)
    expect(y.magi).toBeCloseTo(y.withdrawals.roth, 0) // earnings are ordinary income → MAGI
  })

  // The owner's own five-taxable-year period (26 U.S.C. 408A(d)(2)(B); Treas.
  // Reg. 1.408A-6 A-2) runs from the first year any of her Roth IRAs was funded.
  // The plan does not collect that year; when her Roth IRAs hold nothing at the
  // start, the plan's own first conversion starts it (D-APPROX-FACTS fix (a)).
  // Born 1964-03-15, she converts her whole 100,000 IRA in 2026 into a Roth
  // IRA growing 20% a year and spends 110,000 from it later: 100,000 of
  // conversion principal first (408A(d)(4)(B)), then 10,000 of earnings. In
  // 2028 (age 64) the period 2026-2030 has not run, so the earnings are
  // ordinary income, with no 10% tax at 60 or older (72(t)(2)(A)(i)); in 2031
  // it has, and they are tax-free.
  function lateOpenerPlan(
    goalYear: number,
    rothStartBalance: number,
    options: { conversion?: 'aggregate' | 'named'; contributionBasis?: number } = {},
  ): Plan {
    const plan = basePlan(62)
    plan.household.people[0]!.longevity.planningAge = 75
    if (options.conversion === 'named') {
      // The same 100,000 conversion as a named retirement action, which
      // annualForcedDistributionQcdAndRetirementActionsPhase credits, rather
      // than the aggregate conversion phase.
      plan.retirementActionEligibilityFacts = {
        iraClassifications: [{ evidenceId: 'trad1-classification', provenance: { source: 'manual' }, sourceAccountId: 'trad1', subtype: 'traditional' }],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      }
      plan.strategies.retirementActions = [namedConversionRequest()]
    } else {
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 100_000 }] }
    }
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spending from the Roth IRA', year: goalYear, amount: 110_000 }]
    plan.accounts = [
      { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 100_000, annualContribution: 0 } as Account,
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 20, kind: 'ira', balance: rothStartBalance, annualContribution: 0, contributionBasis: options.contributionBasis ?? rothStartBalance } as Account,
    ]
    return plan
  }

  function namedConversionRequest() {
    const parsed = parseRetirementActionRequest({
      actionId: 'named-conversion',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2026,
      executionDate: '2026-06-15',
      executionSequence: 1,
      requestedAmount: 100_000_00,
      allocations: [{ allocationId: 'named-conversion-allocation', sourceAccountId: 'trad1', requestedAmount: 100_000_00 }],
      destinationRothAccountId: 'roth1',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.request
  }

  it('taxes earnings inside the five-year period started by the plan\'s own first conversion (Roth IRAs start empty)', () => {
    const y = run(lateOpenerPlan(2028, 0)).years.find((r) => r.year === 2028)!
    expect(y.withdrawals.roth).toBeCloseTo(110_000, 6)
    expect(y.magi).toBeCloseTo(10_000, 6)
    expect(y.penalties).toBe(0)
  })

  it('leaves the same earnings tax-free once the period has run (2031, five tax years after 2026)', () => {
    const y = run(lateOpenerPlan(2031, 0)).years.find((r) => r.year === 2031)!
    // At 67 the draw also pays the Medicare premium the engine adds from 65,
    // which comes out of the same Roth IRA.
    expect(y.withdrawals.roth).toBeGreaterThan(110_000)
    expect(y.magi).toBeCloseTo(0, 6)
    expect(y.penalties).toBe(0)
  })

  it('presumes the period met for a Roth IRA that holds money at the start', () => {
    // A dollar of contributions at the start means a first contribution no later
    // than this year, but the plan does not say when; the engine presumes five
    // or more years ago (the record's stated limit, which under-taxes a Roth IRA
    // funded less than five years before).
    const y = run(lateOpenerPlan(2028, 1)).years.find((r) => r.year === 2028)!
    expect(y.withdrawals.roth).toBeCloseTo(110_000, 6)
    expect(y.magi).toBeCloseTo(0, 6)
  })

  it('reads "holds money at the start" from the balance, not the basis: a funded Roth IRA with no contribution basis is presumed past its period', () => {
    // One dollar of earnings and no contributions is still a Roth IRA that was
    // funded before the plan starts, so the presumption above applies: the
    // 2028 draw takes the 100,000 conversion layer first (408A(d)(4)(B)), then
    // the earnings, and at 64 with the period presumed met they are qualified.
    // Were "empty" read from the basis, the 2026 conversion would start the
    // period and those earnings would be ordinary income.
    const y = run(lateOpenerPlan(2028, 1, { contributionBasis: 0 })).years.find((r) => r.year === 2028)!
    expect(y.withdrawals.roth).toBeCloseTo(110_000, 6)
    expect(y.magi).toBeCloseTo(0, 6)
  })

  describe('a named Roth conversion into Roth IRAs that start empty starts the period too', () => {
    // The late opener again, converting through a named retirement action.
    // A-2 of Treas. Reg. 1.408A-6 counts a conversion contribution the same
    // way whichever path makes it, so the expected figures are the aggregate
    // case's: 10,000 of earnings taxed in 2028, none in 2031.
    it('taxes the earnings inside the period (2028)', () => {
      const y = run(lateOpenerPlan(2028, 0, { conversion: 'named' })).years.find((r) => r.year === 2028)!
      expect(y.withdrawals.roth).toBeCloseTo(110_000, 6)
      expect(y.magi).toBeCloseTo(10_000, 6)
      expect(y.penalties).toBe(0)
    })

    it('leaves them tax-free once it has run (2031)', () => {
      const y = run(lateOpenerPlan(2031, 0, { conversion: 'named' })).years.find((r) => r.year === 2031)!
      expect(y.withdrawals.roth).toBeGreaterThan(110_000)
      expect(y.magi).toBeCloseTo(0, 6)
      expect(y.penalties).toBe(0)
    })

    it('does not start it for a Roth IRA that holds money at the start', () => {
      const y = run(lateOpenerPlan(2028, 1, { conversion: 'named' })).years.find((r) => r.year === 2028)!
      expect(y.withdrawals.roth).toBeCloseTo(110_000, 6)
      expect(y.magi).toBeCloseTo(0, 6)
    })
  })

  // A first regular contribution starts the period as well (A-2: "the first
  // taxable year for which the first regular contribution is made to any Roth
  // IRA"). Born 1964-03-15, she earns 60,000 a year until 65 and puts 7,000 a
  // year from 2026 into a Roth IRA that holds nothing at the start and grows
  // 25% a year, then takes 30,000 for a goal. Her three contributions, 21,000,
  // come out first (408A(d)(4)(B)); everything drawn past them is earnings. In
  // 2029 (age 65) the period that began in 2026 has run three years, not five,
  // so those earnings are ordinary income, with no 10% tax at 60 or older; in
  // 2031 it has run five and they are tax-free. At 65 the draw also pays the
  // Medicare premium the engine adds, so the draw is above the 30,000 goal and
  // the test reads the earnings as the draw less the 21,000.
  function contributorPlan(goalYear: number, rothStartBalance: number, kind: 'ira' | 'employer' = 'ira'): Plan {
    const plan = basePlan(62)
    plan.household.people[0]!.retirementAge = 65
    plan.household.people[0]!.longevity.planningAge = 75
    plan.incomes = [{ type: 'wages', id: 'w1', personId: 'p1', annualGross: 60_000, endAge: 65, realGrowthPct: 0 }]
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spending from the Roth account', year: goalYear, amount: 30_000 }]
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 25, kind, balance: rothStartBalance, annualContribution: 7_000, contributionBasis: rothStartBalance } as Account,
    ]
    return plan
  }
  const THREE_CONTRIBUTIONS = 3 * 7_000

  it("taxes earnings inside the five-year period started by the plan's own first contribution (Roth IRAs start empty)", () => {
    const y = run(contributorPlan(2029, 0)).years.find((r) => r.year === 2029)!
    expect(y.withdrawals.roth).toBeGreaterThan(30_000)
    expect(y.magi).toBeCloseTo(y.withdrawals.roth - THREE_CONTRIBUTIONS, 6)
    expect(y.penalties).toBe(0)
  })

  it('leaves the contributed Roth IRA earnings tax-free once the period has run (2031)', () => {
    const y = run(contributorPlan(2031, 0)).years.find((r) => r.year === 2031)!
    expect(y.withdrawals.roth).toBeGreaterThan(THREE_CONTRIBUTIONS)
    expect(y.magi).toBeCloseTo(0, 6)
    expect(y.penalties).toBe(0)
  })

  it('does not start the period with a contribution into a Roth IRA that holds money at the start', () => {
    const y = run(contributorPlan(2029, 1)).years.find((r) => r.year === 2029)!
    expect(y.withdrawals.roth).toBeGreaterThan(30_000)
    expect(y.magi).toBeCloseTo(0, 6)
  })

  it('gives a designated Roth account no five-year period, even one that starts empty and the plan funds (a stated limit)', () => {
    // The same contributions into an employer plan's designated Roth account.
    // 26 U.S.C. 402A(d)(2)(B) would make the 2029 distribution nonqualified
    // (the period began with the 2026 designated Roth contribution), but the
    // engine gives designated Roth accounts no five-year period at all, so at
    // 65 it is treated as qualified and nothing is taxed. Registered as
    // irc-402A-d-2-designated-roth-five-year-period.
    const y = run(contributorPlan(2029, 0, 'employer')).years.find((r) => r.year === 2029)!
    expect(y.withdrawals.roth).toBeGreaterThan(30_000)
    expect(y.magi).toBeCloseTo(0, 6)
  })

  it("aggregates an owner's Roth IRAs so basis in one covers a draw from another", () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      // Roth A is drained first and has zero basis of its own (all earnings)…
      { type: 'roth', id: 'rothA', name: 'Roth A', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0, contributionBasis: 0 } as Account,
      // …but the owner still has ample contribution basis in Roth B.
      { type: 'roth', id: 'rothB', name: 'Roth B', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 150_000, annualContribution: 0, contributionBasis: 150_000 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(40_000, 0)
    expect(y.penalties).toBe(0) // aggregated basis covers it — no spurious earnings penalty
    expect(y.magi).toBeCloseTo(0, 0)
  })
})

// Treas. Reg. 1.408A-6 A-7(b): a surviving spouse who treats the Roth IRA as her
// own has one five-year period for all her Roth IRAs, ending at the earlier of
// the decedent's and her own (D-APPROX-FACTS fix (b)). She was born 1947 and
// has no Roth IRA of her own; her late husband's first Roth year was 2024, so
// the period runs 2024 through 2028. From 2026 she owns his 300,000 Roth IRA,
// which holds 100,000 of his contributions, and spends 150,000 from it: past
// the contributions, the rest is earnings. Before the fix the handoff dropped
// his first year and every earnings dollar read as qualified.
describe('spousal treat-as-own carries the decedent\'s first Roth year', () => {
  function survivorPlan(goalYear: number, decedentFirstRothYear: number): Plan {
    const plan = createEmptyPlan({ newId: () => 'spousal-roth', now: () => new Date('2026-01-01T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'beneficiary', name: 'Beneficiary', dob: '1947-06-15',
      sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Goal', year: goalYear, amount: 150_000 }]
    plan.accounts = [
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 0 },
      {
        type: 'roth', id: 'inherited', name: 'Inherited', ownerPersonId: 'beneficiary', annualReturnPct: 0,
        kind: 'ira', balance: 300_000, annualContribution: 0,
        inherited: {
          ownerDeathYear: 2024, decedentHadStartedRmds: false,
          decedentId: 'spouse-decedent', ownerDeathDate: '2024-06-01',
          annualDistributionHistory: [{
            taxYear: 2025, requiredAmount: 0, distributedAmount: 0,
            observedAsOfDate: '2025-12-31', legalDistributionDeadline: '2025-12-31',
            provenance: { source: 'Custodian completed statutory distribution record', asOf: '2025-12-31' },
          }],
          beneficiary: {
            beneficiaryClass: 'designated-individual', edbCategory: 'surviving-spouse', beneficiaryBirthYear: 1947,
            soleBeneficiary: true, ownerBirthYear: 1945, election: 'treat-as-own', spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: 2026,
            provenance: { source: 'test', asOf: '2026-01-01' },
            spousalElectionFacts: {
              directSpouseNamedOnIra: 'verifiedYes', affirmativeElectionDate: '2026-01-15',
              affirmativeElectionYear: 2026, nonRolloverContributionYears: [], lateElectionCatchUp: null,
              preElectionDistributionMethod: 'lifeExpectancyRule',
              section402c2j4Inputs: {
                transaction: 'affirmativeTreatAsOwnElection', spouseBirthDate: '1947-06-15',
                decedentBirthDate: '1945-01-01', distributionYear: 2026, currentYearRmdReferenceBalance: 0,
                actualPriorYearDistributions: [], actualPreElectionDistributionsCurrentYear: 0,
                currentDistributionOrRemainingInterest: 0,
                provenance: { source: 'Custodian life-expectancy method evidence', asOf: '2026-01-15' },
              },
              provenance: { source: 'Executed custodian owner redesignation', asOf: '2026-01-15' },
            },
          },
        },
      },
    ] as Plan['accounts']
    plan.inheritedRothTaxCharacterPools = [{
      beneficiaryPersonId: 'beneficiary', decedentId: 'spouse-decedent',
      firstRothContributionTaxYear: decedentFirstRothYear, remainingRegularContributionBasis: 100_000,
      conversionLayers: [], priorDistributionsConsumedAmount: 0,
      provenance: { source: 'Complete decedent Roth records', asOf: '2026-01-01' },
    }]
    return plan
  }

  it('taxes her earnings inside his period (2028), with no 10% tax at 81', () => {
    const y = run(survivorPlan(2028, 2024)).years.find((r) => r.year === 2028)!
    expect(y.inheritedDistribution).toBe(0)
    // 150,000 of spending (plus her Medicare premium) against at most 100,000
    // of contributions: at least 50,000 of earnings are ordinary income.
    expect(y.withdrawals.roth).toBeGreaterThan(150_000)
    expect(y.magi).toBeGreaterThan(50_000)
    expect(y.penalties).toBe(0)
  })

  it('leaves them tax-free once his period has run (2029), and when it ran out before the start', () => {
    expect(run(survivorPlan(2029, 2024)).years.find((r) => r.year === 2029)!.magi).toBe(0)
    expect(run(survivorPlan(2028, 2019)).years.find((r) => r.year === 2028)!.magi).toBe(0)
  })

  it('gives an inherited designated Roth account she treats as her own no five-year period (2028): its earnings are not taxed', () => {
    // The same account in an employer plan (kind 'employer'), which the plan
    // schema admits with the same inherited facts, and with her election made
    // in 2025 so it is in force at the start (the projection models no
    // inherited distribution history for an employer account, so a 2026
    // election would never be honored). From 2026 she owns it, and its basis
    // pool is a designated Roth pool, which carries no five-year period in the
    // engine (irc-402A-d-2-designated-roth-five-year-period): the A-7(b) Roth
    // IRA period is not carried onto it. At 81 the 2028 distribution is
    // qualified, contributions and earnings alike, so nothing is taxed. The
    // same plan with a Roth IRA taxes the earnings inside his 2024-2028 period.
    const plan = survivorPlan(2028, 2024)
    const account = plan.accounts.find((a) => a.id === 'inherited')!
    const beneficiary = account.type === 'roth' ? account.inherited?.beneficiary : undefined
    const facts = beneficiary?.spousalElectionFacts
    if (account.type !== 'roth' || beneficiary === undefined || facts === undefined || facts.section402c2j4Inputs === undefined) {
      throw new Error('fixture drift: expected the inherited Roth account and its election facts')
    }
    beneficiary.treatAsOwnElectionYear = 2025
    facts.affirmativeElectionDate = '2025-01-15'
    facts.affirmativeElectionYear = 2025
    facts.section402c2j4Inputs.distributionYear = 2025
    const asRothIra = run(structuredClone(plan)).years.find((r) => r.year === 2028)!
    expect(asRothIra.magi).toBeGreaterThan(50_000)

    account.kind = 'employer'
    const y = run(plan).years.find((r) => r.year === 2028)!
    expect(y.withdrawals.roth).toBeGreaterThan(150_000)
    expect(y.magi).toBe(0)
    expect(y.penalties).toBe(0)
  })
})

describe('Debt lump-sum payoff', () => {
  function mortgagePlan(payoffYear: number | null): Plan {
    const plan = basePlan(62)
    plan.accounts = [
      { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 300_000, annualContribution: 0 } as Account,
      { type: 'debt', id: 'mort', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 100_000, interestPct: 5, monthlyPayment: 1_000, payoffYear } as Account,
    ]
    return plan
  }

  it('clears the whole balance in the payoff year and stops servicing it after', () => {
    const result = run(mortgagePlan(2028))
    const y2028 = result.years.find((r) => r.year === 2028)!
    const y2029 = result.years.find((r) => r.year === 2029)!
    expect(y2028.expenses.debtService).toBeGreaterThan(80_000) // ~remaining balance, not the 12k level payment
    expect(y2028.balances['mort'] ?? 0).toBeCloseTo(0, 2)
    expect(y2029.expenses.debtService).toBe(0)
  })

  it('runs to term at the level payment when no payoff year is set', () => {
    const y2028 = run(mortgagePlan(null)).years.find((r) => r.year === 2028)!
    expect(y2028.expenses.debtService).toBeCloseTo(12_000, 0)
    expect(y2028.balances['mort'] ?? 0).toBeGreaterThan(50_000)
  })
})

describe('Property carrying costs', () => {
  it('charges tax + insurance while owned and stops at the sale year', () => {
    const plan = basePlan(62)
    plan.accounts = [
      { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 100_000, annualContribution: 0 } as Account,
      { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 400_000, plannedSaleYear: 2028, expectedNetProceeds: null, propertyTaxAnnual: 6_000, insuranceAnnual: 2_000 } as Account,
    ]
    const years = run(plan).years
    expect(years.find((r) => r.year === 2026)!.expenses.propertyCosts).toBeCloseTo(8_000, 0)
    expect(years.find((r) => r.year === 2027)!.expenses.propertyCosts).toBeCloseTo(8_000, 0)
    expect(years.find((r) => r.year === 2028)!.expenses.propertyCosts).toBe(0) // sold
  })
})
