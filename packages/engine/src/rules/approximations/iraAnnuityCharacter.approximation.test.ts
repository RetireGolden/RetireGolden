/**
 * What an IRA-funded qualified annuity purchase IS, and what this engine now
 * makes of it.
 *
 * The statutory chain is short and it is not in dispute. Section 408(d)(1)
 * taxes only an amount "paid or distributed out of an individual retirement
 * plan"; buying an annuity contract with the account pays nothing out, whether
 * the result is a section 408(b) individual retirement annuity — which section
 * 7701(a)(37)(B) makes an individual retirement plan in its own right — or an
 * annuity contract held as an asset of the section 408(a) trust. Publication
 * 590-B states both halves in two sentences: not taxed on receipt of the
 * contract, taxed when the payments start. Section 408(d)(2) then treats every
 * individual retirement plan as one contract and every distribution in a year
 * as one distribution, so the contract sits inside the Form 8606 line 6
 * denominator and its payments take the same share of basis as everything else
 * the aggregate pays out that year.
 *
 * THE ENGINE USED TO GET THE FIRST SENTENCE RIGHT AND THE REST WRONG, for one
 * structural reason: a Plan annuity account has no balance, so the premium left
 * the owned-IRA pool at the purchase pass and there was nowhere for it to land.
 * Two of the three consequences that followed are closed here and the third is
 * elsewhere:
 *
 *   - the line 6 denominator lost the contract, so the basis fraction was too
 *     large and the residual IRA recovered basis too fast. A contract-value
 *     channel now carries it, credited by the premium and debited by the
 *     payments, and added to line 6 beside the December 31 pool;
 *   - the payments were taxed in full, taking no share of the basis at all.
 *     They are minted as their own line-7 occurrence now and priced at the
 *     year's own fraction;
 *   - the required-distribution base lost the contract, which the regulations
 *     permit only for a QLAC — closed on 2026-08-07 by refusing the shape
 *     rather than by pricing it, so that suite now pins a refusal.
 *
 * A fourth departure is registered here without being one of the three, because
 * it is about the QLAC cap rather than the character of the purchase: the cap is
 * one running total across every arrangement of an individual, and the engine
 * measures each contract against the whole of it (understates tax).
 *
 * EVERY FIXTURE BELOW RUNS AT A 0 PERCENT RETURN, and that is not decoration.
 * It makes the contract's December 31 value exactly the premium less the
 * payments — a single premium, no growth, and nothing for a valuation to be
 * uncertain about — so the figures are arithmetic from the quoted authority
 * rather than a reading of the engine's contract-value convention. That
 * convention is where the fair market value none of this can supply is
 * registered, at `irc-408-d-2-C-annuity-contract-close-of-year-value`, and it
 * is deliberately not exercised here: a fixture that ran at a return would be
 * measuring the convention and calling it aggregation.
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

let counter = 0
const testIds = (): string => `approx-annuity-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/** One person, flat dollars, flat returns: every figure below is the statutory one. */
function soloPlan(dob: string): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 95, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  // Spending is funded from cash so that nothing but the requirement, the
  // premium, the conversion and the contract's own payments moves through the
  // IRA, and the annuity purchase is the only variable between two runs.
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  return plan
}

interface AnnuityHousehold {
  /** Birth date, which fixes the age and so the Uniform Lifetime divisor. */
  readonly dob: string
  readonly iraBalance: number
  readonly basis: number
  /** Zero for the counterfactual household that buys no contract. */
  readonly premium: number
  readonly conversion?: number
  /** Owner age at which the contract starts paying. */
  readonly startAge?: number
  readonly monthlyAmount?: number
  readonly qlac?: boolean
}

function household(spec: AnnuityHousehold): Plan {
  const plan = soloPlan(spec.dob)
  const ira: Account = {
    type: 'traditional',
    id: 'annuity-fixture-ira',
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: spec.iraBalance,
    annualContribution: 0,
    nondeductibleBasis: spec.basis,
  }
  plan.accounts = [
    {
      type: 'cash',
      id: 'annuity-fixture-cash',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 500_000,
      annualContribution: 0,
    },
    ira,
    {
      type: 'roth',
      id: 'annuity-fixture-roth',
      name: 'Roth IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
    ...(spec.premium > 0
      ? [{
        type: 'annuity' as const,
        id: 'annuity-fixture-contract',
        name: 'Qualified annuity',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        // 76 is this household's age in the 2026 purchase year, so the default
        // contract is an immediate one. A deferred default would be refused at
        // parse for every suite below that does not opt into a QLAC: only a
        // QLAC may commence after the owner's required beginning date.
        startAge: spec.startAge ?? 76,
        monthlyAmount: spec.monthlyAmount ?? 0,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2026,
          premium: spec.premium,
          fundingAccountId: ira.id,
          taxQualification: 'qualified' as const,
          ...(spec.qlac === true ? { qlac: true } : {}),
        },
      }]
      : []),
  ]
  if (spec.conversion !== undefined && spec.conversion > 0) {
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2026, amount: spec.conversion }],
    }
  }
  return plan
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function project(plan: Plan) {
  return simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
}

function yearOf(plan: Plan, year: number) {
  return project(plan).years.find((y) => y.year === year)!
}

// --------------------------------------------------------------------------
// The shared household. A 76-year-old in 2026 with a 1,000,000 dollar IRA that
// is 20 percent basis, taking the Uniform Lifetime requirement on a divisor of
// 23.7, and paying a 200,000 dollar qualified premium out of that same IRA. The
// premium is a fifth of the account on purpose: large enough that dropping it
// out of the denominator is unmistakable, small enough that the account still
// funds the requirement and the conversion out of what remains.
const IRA_BALANCE = 1_000_000
const IRA_BASIS = 200_000
const PREMIUM = 200_000
const CONVERSION = 100_000
const REQUIRED_DISTRIBUTION = IRA_BALANCE / 23.7
/** Form 8606 lines 7 and 8: the requirement, plus the conversion. */
const ANNUAL_GROSS = REQUIRED_DISTRIBUTION + CONVERSION

/**
 * Form 8606 line 9 on the compelled reading, at a 0 percent return.
 *
 * Line 6 is the December 31 value of every traditional IRA, which is what the
 * account kept PLUS the contract the account bought — the premium moved value
 * between two line-6 assets and destroyed none of it. Adding lines 7 and 8 back
 * under 408(d)(2)(C) therefore returns the opening balance exactly, and the
 * purchase is invisible to the form. Written as the sum rather than as
 * `IRA_BALANCE` so the cancellation is on the page and not in a comment.
 */
const STATUTORY_LINE9 =
  (IRA_BALANCE - PREMIUM - ANNUAL_GROSS) + PREMIUM + ANNUAL_GROSS
/** The engine's pool once the premium has left it and nothing has replaced it. */
const ENGINE_DENOMINATOR = IRA_BALANCE - PREMIUM

describeRule('irc-408-d-2-A-annuity-contract-outside-the-form-8606-aggregate', {
  readings: {
    // 408(d)(2)(A) with 7701(a)(37)(B), or Form 8606 line 6 read against a
    // trust that still holds the contract: line 9 is 1,000,000, the fraction is
    // 0.2, and the year's 142,194.09 of lines 7 and 8 carries 113,755.27 of
    // ordinary income.
    statuteKeepsTheContractInTheAggregate:
      ANNUAL_GROSS * (1 - IRA_BASIS / STATUTORY_LINE9),
    // What the engine used to do: the premium left the pool and landed nowhere,
    // so the denominator was 800,000, the fraction 0.25, and the same
    // distributions carried 106,645.57. Kept as a reading rather than deleted,
    // because a fixture that named only the answer could not fail if the
    // contract quietly left line 6 again.
    poolWithoutTheContractItBought:
      ANNUAL_GROSS * (1 - IRA_BASIS / ENGINE_DENOMINATOR),
  },
  accepted: 'statuteKeepsTheContractInTheAggregate',
  note: 'the line 6 denominator',
}, ({ accepted, readings }) => {
  const withContract = () => household({
    dob: '1950-01-01', // 76 in 2026
    iraBalance: IRA_BALANCE,
    basis: IRA_BASIS,
    premium: PREMIUM,
    conversion: CONVERSION,
  })
  const withoutContract = () => household({
    dob: '1950-01-01',
    iraBalance: IRA_BALANCE,
    basis: IRA_BASIS,
    premium: 0,
    conversion: CONVERSION,
  })

  it('recovers basis at the fraction the whole aggregate produces', () => {
    const year = yearOf(withContract(), 2026)

    // The reading rests on this requirement and this conversion. If either
    // moves, the figures below stop being about the denominator.
    expect(year.rmd).toBeCloseTo(REQUIRED_DISTRIBUTION, 6)
    expect(year.rothConversion).toBeCloseTo(CONVERSION, 6)
    expect(year.qcd).toBe(0)

    // TO THE CENT, NOT TO THE FLOAT, and now that this shape settles it has to
    // be. The settlement allocates basis in whole cents and allocates Form 8606
    // lines 7 and 8 independently, so it agrees with the closed form above to
    // within those roundings and not beyond; a tighter tolerance would be
    // pinning the quantization rather than the aggregation.
    expect(year.magi).toBeCloseTo(accepted, 2)
    expect(year.magi).toBeCloseTo(113_755.27, 2)
    expect(year.magi).not.toBeCloseTo(readings.poolWithoutTheContractItBought, 6)
    // What the missing contract was worth to this household in one year, back
    // when it was missing.
    expect(accepted - readings.poolWithoutTheContractItBought)
      .toBeCloseTo(7_109.70, 2)
  })

  it('makes a purchase the form cannot see invisible to the engine too', () => {
    // The cleanest statement available, and it is now an equality rather than a
    // gap. On the compelled reading the premium is a move between two line-6
    // assets, so the household that bought the contract and the household that
    // did not report the SAME ordinary income — the form has no term that
    // distinguishes them. Neither does the engine, to the cent.
    const bought = yearOf(withContract(), 2026)
    const kept = yearOf(withoutContract(), 2026)

    expect(kept.magi).toBeCloseTo(accepted, 2)
    // The two households agree to the FLOAT, not merely to the cent, which is
    // stronger than either agrees with the closed form: both run the same
    // settled allocation over the same line 9, so the same roundings fall the
    // same way on each.
    expect(bought.magi).toBeCloseTo(kept.magi, 9)
    expect(bought.magi - kept.magi).toBeCloseTo(0, 9)

    // And both arms take the same code path now, which is the other half of the
    // change: the household with the contract used to be refused by the exact
    // settlement with `annuityStageRequired` and priced by the legacy fallback.
    expect(kept.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(bought.ownedNonRothIraAnnualReplay).toBeDefined()
  })

  it('carries the contract at the value the aggregate lost, and no more', () => {
    // The mechanism, pinned so a reader can check the denominator rather than
    // infer it from an income figure. The account keeps 657,805.91, the
    // contract holds the 200,000 premium, and the two plus the year's lines 7
    // and 8 are the 1,000,000 the household opened with.
    const year = yearOf(withContract(), 2026)
    const owner = year.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays[0]!
    expect(owner.annualObservation.aggregateYearEndApplicableBalanceAmount)
      .toBe(Math.round((IRA_BALANCE - PREMIUM - ANNUAL_GROSS) * 100))
    expect(owner.annualBasisRatio.denominatorMinorUnits)
      .toBe(Math.round(STATUTORY_LINE9 * 100))
    expect(owner.annualBasisRatio.numeratorMinorUnits)
      .toBe(IRA_BASIS * 100)
  })
})

// --------------------------------------------------------------------------
// The payment side. An 80-year-old, so the contract can start paying in the
// same year it is bought and the whole question fits inside one tax year: a
// 1,000,000 dollar IRA that is 20 percent basis, a 200,000 dollar premium, a
// 49,504.95 requirement on the age-80 divisor of 20.2, and 1,000 a month out of
// the contract from the start.
const PAYOUT_IRA_BALANCE = 1_000_000
const PAYOUT_BASIS = 200_000
const PAYOUT_PREMIUM = 200_000
const PAYOUT_MONTHLY = 1_000
const PAYOUT_ANNUAL = PAYOUT_MONTHLY * 12
const PAYOUT_REQUIRED_DISTRIBUTION = PAYOUT_IRA_BALANCE / 20.2
/**
 * The year's own taxable fraction, over the whole aggregate.
 *
 * Line 6 is the account's December 31 balance plus the contract's, and adding
 * the year's distributions back under 408(d)(2)(C) returns the opening balance
 * exactly: the premium moved value between two line-6 assets and the payment
 * came out of one of them, so at a flat return nothing was created or
 * destroyed. Written as the opening balance for that reason — line 9 is
 * 1,000,000 and the fraction is 0.2 — rather than as the sum of the parts,
 * which the suite above already pins from the other direction.
 */
const STATUTORY_TAXABLE_FRACTION =
  1 - PAYOUT_BASIS / PAYOUT_IRA_BALANCE

describeRule('irc-408-d-2-B-annuity-payment-outside-the-annual-basis-fraction', {
  readings: {
    // 408(d)(2)(B) with Publication 590-B: one distribution, one fraction. The
    // requirement and the annuity payment are 61,504.95 together; line 6 is the
    // 750,495.05 the account kept plus the 188,000 the contract still holds, so
    // line 9 is 1,000,000, the fraction is 0.2, and the year is 49,203.96.
    statuteAppliesOneFractionToEveryDistribution:
      (PAYOUT_REQUIRED_DISTRIBUTION + PAYOUT_ANNUAL) * STATUTORY_TAXABLE_FRACTION,
    // What the engine used to do: the year's fraction on the requirement and
    // 1.00 on the payment. Kept as a reading so the fixture still fails if the
    // fully-ordinary branch is ever quietly restored.
    paymentChargedInFullBesideTheRequirement:
      PAYOUT_REQUIRED_DISTRIBUTION * STATUTORY_TAXABLE_FRACTION + PAYOUT_ANNUAL,
  },
  accepted: 'statuteAppliesOneFractionToEveryDistribution',
  note: 'the payment’s share of basis',
}, ({ accepted, readings }) => {
  const paying = (monthlyAmount: number) => household({
    dob: '1946-01-01', // 80 in 2026, so the contract pays in its purchase year
    iraBalance: PAYOUT_IRA_BALANCE,
    basis: PAYOUT_BASIS,
    premium: PAYOUT_PREMIUM,
    startAge: 80,
    monthlyAmount,
  })

  it('prices the annuity payment at the fraction the aggregate produced', () => {
    const year = yearOf(paying(PAYOUT_MONTHLY), 2026)

    expect(year.rmd).toBeCloseTo(PAYOUT_REQUIRED_DISTRIBUTION, 6)
    expect(year.incomes.annuity).toBeCloseTo(PAYOUT_ANNUAL, 6)

    expect(year.magi).toBeCloseTo(accepted, 2)
    expect(year.magi).toBeCloseTo(49_203.96, 2)
    expect(year.magi)
      .not.toBeCloseTo(readings.paymentChargedInFullBesideTheRequirement, 6)
    // Exactly the basis share the payment used to be refused: 12,000 at 0.2.
    expect(readings.paymentChargedInFullBesideTheRequirement - accepted)
      .toBeCloseTo(2_400, 6)
  })

  it('adds the payment at its taxable share and not at its face', () => {
    // Isolating the claim from the size of the payment. Turning the contract's
    // payments on adds 9,600 to income, which is 12,000 at the year's own 0.8 —
    // and that is what "took its share of the basis" means arithmetically. The
    // full 12,000 is what it used to add.
    const silent = yearOf(paying(0), 2026)
    const paid = yearOf(paying(PAYOUT_MONTHLY), 2026)

    expect(silent.incomes.annuity).toBe(0)
    expect(paid.incomes.annuity).toBeCloseTo(PAYOUT_ANNUAL, 6)
    expect(paid.magi - silent.magi)
      .toBeCloseTo(PAYOUT_ANNUAL * STATUTORY_TAXABLE_FRACTION, 6)
    expect(paid.magi - silent.magi).toBeCloseTo(9_600, 6)
    expect(paid.magi - silent.magi).not.toBeCloseTo(PAYOUT_ANNUAL, 6)
    // THE SILENT RUN IS NOT A CONTROL FOR THE FRACTION, and saying so is the
    // point of asserting it separately: a contract that pays nothing still
    // holds its whole 200,000 premium in line 6, so its year runs at a
    // different denominator and a different fraction from the paying one. What
    // the difference above isolates is the payment, not the fraction.
    expect(silent.magi).toBeCloseTo(
      PAYOUT_REQUIRED_DISTRIBUTION *
        (1 - PAYOUT_BASIS / PAYOUT_IRA_BALANCE), 2,
    )
  })

  it('prices a payment the same whoever the contract is named for', () => {
    // THE OWNER KEY, INVERTED FROM A DEFECT PIN. This assertion existed as a
    // standalone probe that pinned the OPPOSITE figure, because the projection
    // looked the settled character up under the contract's own owner while the
    // settlement published it under the pool owner -- the funding IRA's. On a
    // Plan that names one spouse's contract against the other's IRA the lookup
    // missed, the payment kept its whole face amount in income, and the
    // settlement spent the basis on the allocation it had already published:
    // tax charged, basis gone, every paying year, permanently.
    //
    // The two households below differ in ONE field, whose name is on the
    // contract, and the statute has no term that reads it. Section 408(d)(2)
    // aggregates one individual's retirement plans; which individual is decided
    // by whose dollars bought the contract, not by whose name the Plan put on
    // it. So their settlements were always identical to the cent -- same
    // denominator, same line-7 allocations, same carryforward -- and now their
    // incomes are too.
    const crossOwnerHousehold = (contractOwner: string | null): Plan => {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        {
          id: 'p1', name: 'Pat', dob: '1946-01-01', sex: 'average',
          retirementAge: null, longevity: { planningAge: 95, source: 'manual' },
        },
        {
          id: 'p2', name: 'Sam', dob: '1946-01-01', sex: 'average',
          retirementAge: null, longevity: { planningAge: 95, source: 'manual' },
        },
      ]
      plan.assumptions.inflationPct = 0
      plan.assumptions.defaultReturnPct = 0
      plan.expenses.baseAnnual = 0
      plan.expenses.healthcare = {
        pre65MonthlyPremiumPerPerson: 0,
        applyAcaCredit: false,
        medicareExtrasMonthlyPerPerson: 0,
      }
      // p2 owns the IRA that pays the premium, so p2 owns the aggregate.
      plan.accounts = [
        {
          type: 'cash', id: 'cross-cash', name: 'Cash', ownerPersonId: null,
          annualReturnPct: 0, balance: 500_000, annualContribution: 0,
        },
        {
          type: 'traditional', id: 'cross-ira', name: 'IRA',
          ownerPersonId: 'p2', annualReturnPct: 0, kind: 'ira',
          balance: PAYOUT_IRA_BALANCE, annualContribution: 0,
          nondeductibleBasis: PAYOUT_BASIS,
        },
        {
          type: 'annuity', id: 'cross-contract', name: 'Qualified annuity',
          ownerPersonId: contractOwner, annualReturnPct: null, startAge: 80,
          monthlyAmount: PAYOUT_MONTHLY, colaPct: 0, taxablePct: 100,
          purchase: {
            year: 2026, premium: PAYOUT_PREMIUM,
            fundingAccountId: 'cross-ira', taxQualification: 'qualified',
          },
        },
      ]
      return plan
    }
    const settlementOf = (plan: Plan) => {
      const year = yearOf(plan, 2026)
      const owner = year.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays
        .find((entry) => entry.ownerPersonId === 'p2')!
      return { year, owner }
    }

    const sameOwner = settlementOf(crossOwnerHousehold('p2'))
    const crossOwner = settlementOf(crossOwnerHousehold('p1'))
    // A contract naming NOBODY takes the same route the cross-owner one does:
    // the payment owner falls back to the household's first person, who is not
    // the funding owner here.
    const unnamed = settlementOf(crossOwnerHousehold(null))

    // The settlements were never in question. Same pool, same denominator.
    for (const result of [sameOwner, crossOwner, unnamed]) {
      expect(result.owner.annualBasisRatio.denominatorMinorUnits)
        .toBe(PAYOUT_IRA_BALANCE * 100)
      expect(result.owner.line7AllocationEvidence.allocations.map((entry) => [
        entry.sourceAccountId, entry.grossAmount, entry.allocatedBasisAmount,
      ])).toEqual([
        ['cross-contract', PAYOUT_ANNUAL * 100, PAYOUT_ANNUAL * 20],
        ['cross-ira', 4_950_495, 990_099],
      ])
      expect(result.owner.nextYearOpeningBasisAmount)
        .toBe(sameOwner.owner.nextYearOpeningBasisAmount)
    }

    // AND NOW THE INCOMES AGREE, which is what changed. Each reports the one
    // statutory figure -- one fraction over the whole aggregate -- rather than
    // the 51,603.96 the cross-owner arm used to report by charging the payment
    // in full while its settlement handed the basis away.
    expect(sameOwner.year.magi).toBeCloseTo(accepted, 2)
    expect(crossOwner.year.magi).toBeCloseTo(accepted, 2)
    expect(unnamed.year.magi).toBeCloseTo(accepted, 2)
    expect(crossOwner.year.magi).toBeCloseTo(sameOwner.year.magi, 9)
    expect(unnamed.year.magi).toBeCloseTo(sameOwner.year.magi, 9)
    expect(crossOwner.year.magi).not.toBeCloseTo(
      readings.paymentChargedInFullBesideTheRequirement, 2)
    // The overstatement it used to carry, stated so the fixture names the size
    // of what it is preventing: the payment's whole basis share, every year.
    expect(readings.paymentChargedInFullBesideTheRequirement -
      accepted).toBeCloseTo(2_400, 2)
  })

  it('keeps a cross-owner contract whole across every paying year', () => {
    // The defect was permanent, not a purchase-year artefact: it recurred for
    // as long as the contract paid, and each year's overstatement was that
    // year's payment at that year's nontaxable fraction. A single-year fixture
    // could not have told a one-off from a recurrence, so this runs the shape
    // out and compares the whole series.
    const series = (contractOwner: string | null): number[] => {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        {
          id: 'p1', name: 'Pat', dob: '1950-01-01', sex: 'average',
          retirementAge: null, longevity: { planningAge: 84, source: 'manual' },
        },
        {
          id: 'p2', name: 'Sam', dob: '1950-01-01', sex: 'average',
          retirementAge: null, longevity: { planningAge: 84, source: 'manual' },
        },
      ]
      plan.assumptions.inflationPct = 0
      plan.assumptions.defaultReturnPct = 0
      plan.expenses.baseAnnual = 0
      plan.expenses.healthcare = {
        pre65MonthlyPremiumPerPerson: 0,
        applyAcaCredit: false,
        medicareExtrasMonthlyPerPerson: 0,
      }
      plan.accounts = [
        {
          type: 'cash', id: 'series-cash', name: 'Cash', ownerPersonId: null,
          annualReturnPct: 0, balance: 500_000, annualContribution: 0,
        },
        {
          type: 'traditional', id: 'series-ira', name: 'IRA',
          ownerPersonId: 'p2', annualReturnPct: 0, kind: 'ira',
          balance: 400_000, annualContribution: 0, nondeductibleBasis: 120_000,
        },
        {
          // Immediate, so the contract is one the regulations permit without
          // a QLAC declaration: 1.401(a)(9)-6(a)(3)(i) requires payments to
          // commence by the required beginning date, which for a 1950 birth is
          // age 76, and this owner is 76 in the purchase year.
          type: 'annuity', id: 'series-contract', name: 'Qualified annuity',
          ownerPersonId: contractOwner, annualReturnPct: null, startAge: 76,
          monthlyAmount: 500, colaPct: 0, taxablePct: 100,
          purchase: {
            year: 2026, premium: 60_000,
            fundingAccountId: 'series-ira', taxQualification: 'qualified',
          },
        },
      ]
      const parsed = parsePlan(plan)
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      return simulatePlan(parsed.plan, {
        startYear: 2026, horizonEndYear: 2032, taxCalculator: noTax,
      }).years.map((year) => year.magi)
    }

    const control = series('p2')
    const cross = series('p1')
    const unnamed = series(null)
    // Every year, to the float. The contract pays from its purchase year on, so
    // every year in the series carries a payment that could have diverged.
    expect(cross).toEqual(control)
    expect(unnamed).toEqual(control)
    expect(control).toHaveLength(7)
    expect(control.every((magi) => magi > 0)).toBe(true)
  })
})

// --------------------------------------------------------------------------
// The seed, which trusts a premium the engine never watched move
// --------------------------------------------------------------------------

// A contract bought BEFORE the projection starts had its premium paid in a year
// the ledger never ran, so the channel has to open somewhere. It opens at the
// Plan's quoted premium less the payments the contract made in the meantime —
// and the quoted premium is not always what the contract received. A purchase
// INSIDE the projection funds `min(premium, spendable)`, so a premium larger
// than its funding account leaves the account empty and the contract short; a
// purchase before the projection has no balance left to have been short of, and
// nothing in the Plan records the shortfall.
//
// So one contract has two values, decided by nothing but which year the
// projection starts in. Both households below are the SAME household at the
// SAME instant: the second is the first, reopened a year later with the balance
// the first ended that year holding.
const SEED_IRA_BALANCE = 30_000
const SEED_QUOTED_PREMIUM = 90_000
const SEED_MONTHLY = 500
const SEED_ANNUAL_PAYMENT = SEED_MONTHLY * 12

function seedHousehold(iraBalance: number): Plan {
  const plan = soloPlan('1950-01-01') // 76 in 2026, so the contract pays at once
  plan.accounts = [
    {
      type: 'cash', id: 'seed-cash', name: 'Cash', ownerPersonId: null,
      annualReturnPct: 0, balance: 500_000, annualContribution: 0,
    },
    {
      type: 'traditional', id: 'seed-ira', name: 'IRA', ownerPersonId: 'p1',
      annualReturnPct: 0, kind: 'ira', balance: iraBalance,
      annualContribution: 0, nondeductibleBasis: 0,
    },
    {
      type: 'annuity', id: 'seed-contract', name: 'Qualified annuity',
      ownerPersonId: 'p1', annualReturnPct: null, startAge: 76,
      monthlyAmount: SEED_MONTHLY, colaPct: 0, taxablePct: 100,
      purchase: {
        year: 2026, premium: SEED_QUOTED_PREMIUM,
        fundingAccountId: 'seed-ira', taxQualification: 'qualified',
      },
    },
  ]
  return plan
}

/** The contract value the given projection publishes for `year`. */
function seedContractValue(plan: Plan, startYear: number, year: number): number {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  const result = simulatePlan(parsed.plan, {
    startYear, horizonEndYear: year, taxCalculator: noTax,
  }).years.find((entry) => entry.year === year)!
  return result.ownedNonRothIraPostGrowthSource!.ownerPools[0]!
    .annuityContractValues![0]!.contractValuePlanDollars
}

describeRule('irc-408-d-2-C-annuity-contract-close-of-year-value', {
  readings: {
    // What the contract actually received. The funding IRA held 30,000 against
    // a 90,000 quote, so 30,000 is what moved, and by the end of 2027 two
    // annual payments of 6,000 have come back out of it.
    contractHoldsWhatTheAccountCouldPay:
      SEED_IRA_BALANCE - 2 * SEED_ANNUAL_PAYMENT,
    // What the seed assumes: the whole quoted premium, less the one payment
    // made before the later projection started, less the payment made in its
    // first year.
    seedTrustsTheQuotedPremium:
      SEED_QUOTED_PREMIUM - 2 * SEED_ANNUAL_PAYMENT,
  },
  accepted: 'contractHoldsWhatTheAccountCouldPay',
  produced: 'seedTrustsTheQuotedPremium',
  note: 'the pre-projection seed',
}, ({ accepted, produced }) => {
  it('opens a pre-projection contract at a premium it may never have received', () => {
    // The projection that watched the purchase happen. It funded what the
    // account could pay and the channel carries exactly that.
    const watched = seedContractValue(seedHousehold(SEED_IRA_BALANCE), 2026, 2027)
    expect(watched).toBeCloseTo(accepted, 6)
    expect(watched).toBeCloseTo(18_000, 6)

    // The same household reopened a year later, carrying the balance the first
    // projection ended 2026 with, so the two describe one household at one
    // instant and differ only in where the projection begins.
    const parsedWatched = parsePlan(seedHousehold(SEED_IRA_BALANCE))
    if (!parsedWatched.ok) throw new Error(parsedWatched.issues.join('; '))
    const balanceAfterPurchase = simulatePlan(parsedWatched.plan, {
      startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
    }).years[0]!.balances['seed-ira']!
    expect(balanceAfterPurchase).toBeCloseTo(0, 6)

    const reopened = seedContractValue(
      seedHousehold(balanceAfterPurchase), 2027, 2027,
    )
    expect(reopened).toBeCloseTo(produced, 6)
    expect(reopened).toBeCloseTo(78_000, 6)
    expect(reopened).not.toBeCloseTo(accepted, 6)
    // The gap is exactly the part of the quote the account could not pay.
    expect(reopened - watched)
      .toBeCloseTo(SEED_QUOTED_PREMIUM - SEED_IRA_BALANCE, 6)
  })

  it('overstates the line 6 denominator and never understates it', () => {
    // DIRECTION. Funding is `min(premium, spendable)`, so the quote is an upper
    // bound on what the contract received and the seed can only be too high.
    // Too high a contract value is too large a line 6, a smaller basis
    // fraction, less basis recovered, and more tax — the one direction, unlike
    // the growth question this record also covers, where the sign follows the
    // return.
    expect(produced).toBeGreaterThan(accepted)

    // And where the quote WAS payable the two agree exactly, which is what
    // makes the gap the shortfall rather than an artefact of reopening.
    const payable = SEED_QUOTED_PREMIUM
    const watched = seedContractValue(seedHousehold(payable), 2026, 2027)
    const parsedWatched = parsePlan(seedHousehold(payable))
    if (!parsedWatched.ok) throw new Error(parsedWatched.issues.join('; '))
    const balanceAfterPurchase = simulatePlan(parsedWatched.plan, {
      startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
    }).years[0]!.balances['seed-ira']!
    const reopened = seedContractValue(
      seedHousehold(balanceAfterPurchase), 2027, 2027,
    )
    expect(watched).toBeCloseTo(produced, 6)
    expect(reopened).toBeCloseTo(watched, 6)
  })
})

// --------------------------------------------------------------------------
// The required-distribution base. The same 76-year-old, no basis — basis plays
// no part in a required-distribution figure and leaving it out keeps the two
// arms below from borrowing anything from the two suites above. The contract
// starts paying at 85, which is nine years past this owner's required beginning
// date, and the two arms differ only in whether it is declared a QLAC.
const RMD_IRA_BALANCE = 1_000_000
const RMD_PREMIUM = 200_000
const DEFERRED_START_AGE = 85
/** 2026 is priced off the prior December 31, so the purchase cannot reach it. */
const FIRST_YEAR_DISTRIBUTION = RMD_IRA_BALANCE / 23.7
/** December 31, 2026 with the contract still counted, over the age-77 divisor. */
const BASE_WITH_CONTRACT =
  (RMD_IRA_BALANCE - RMD_PREMIUM - FIRST_YEAR_DISTRIBUTION) + RMD_PREMIUM
const SECOND_YEAR_WITH_CONTRACT = BASE_WITH_CONTRACT / 22.9
/** The same December 31, with the contract's value disregarded. */
const SECOND_YEAR_WITHOUT_CONTRACT =
  (RMD_IRA_BALANCE - RMD_PREMIUM - FIRST_YEAR_DISTRIBUTION) / 22.9

function deferredContract(qlac: boolean): Plan {
  return household({
    dob: '1950-01-01',
    iraBalance: RMD_IRA_BALANCE,
    basis: 0,
    premium: RMD_PREMIUM,
    startAge: DEFERRED_START_AGE,
    qlac,
  })
}

/**
 * The refusal that closed the gap, and what the gap used to be.
 *
 * This suite measured an arithmetic departure until 2026-08-07: a deferred
 * contract that was not a QLAC got the QLAC's exclusion from the
 * required-distribution base, and the second-year requirement came out at
 * 33,091.96 against a statutory 41,825.59 — 8,733.62 short, compounding. The
 * engine had exactly one mechanism (an annuity account holds no balance, so the
 * premium simply left the traditional one) and could not tell the contracts
 * apart because it never had a second.
 *
 * It still has one mechanism. What changed is which contracts may reach it:
 * plan validation now refuses a qualified purchase that is not flagged qlac and
 * whose payments commence later than the owner may defer them, so the shape the
 * old fixture measured has no expression in an accepted input. The readings
 * below therefore ask the question the rule now turns on — is the shape
 * admitted or refused — which is the same form the funding-arm fixture at the
 * bottom of this file takes for 408(d)(1). The figures the old fixture pinned
 * are not deleted; they are carried in the registry record's history, where a
 * later reader can find what the engine used to do without a fixture having to
 * construct a plan that no longer parses.
 */
describeRule('treas-reg-1-401-a-9-6-a-3-i-annuity-payments-commence-by-the-required-beginning-date', {
  readings: {
    // 1.401(a)(9)-5(a)(5)(iii) permits the bifurcation only if the contract
    // satisfies 1.401(a)(9)-6, and (a)(3)(i) requires its payments to commence
    // by the required beginning date. (q)(1)(iii) excuses a QLAC and nothing
    // else, so a contract starting at 85 for an owner who bought it at 76 is a
    // shape with no legal expression, and validation says so.
    parseRefusesADeferredContractThatIsNotAQlac: 'refused',
    // What the engine did until the refusal landed: admit it, and hand it the
    // exclusion 1.401(a)(9)-5(b)(4) reserves for a QLAC.
    schemaWouldAdmitItAndExcludeItFromTheBase: 'accepted',
  },
  accepted: 'parseRefusesADeferredContractThatIsNotAQlac',
  note: 'a deferred contract that is not a QLAC',
}, ({ accepted, readings }) => {
  it('refuses a deferred contract that is not a QLAC', () => {
    const parsed = parsePlan(deferredContract(false))
    const outcome = parsed.ok ? 'accepted' : 'refused'
    expect(outcome).toBe(accepted)
    expect(outcome).not.toBe(readings.schemaWouldAdmitItAndExcludeItFromTheBase)
    if (parsed.ok) throw new Error('expected the deferred non-QLAC contract to be refused')
    // Named on the contract's own start age, and naming the two controls that
    // fix it, because a refusal a household cannot act on is a lockout.
    expect(parsed.issues.join('; ')).toContain(
      'a qualified annuity purchase that is not a QLAC cannot defer past the owner\'s required beginning date',
    )
    expect(parsed.issues.join('; ')).toContain(
      'lower "Start age", or tick "QLAC (qualified longevity annuity)"',
    )
  })

  it('admits the same contract the moment it is declared a QLAC', () => {
    // The other side of the boundary, so the refusal above is about the
    // exemption in (q)(1)(iii) and not about some unrelated defect in the
    // fixture's plan. One field apart, opposite outcomes.
    expect(parsePlan(deferredContract(true)).ok).toBe(true)
  })

  it('admits an immediate contract bought after the required beginning date', () => {
    // The refusal is about DEFERRAL, not about age. This owner's required
    // beginning date went years ago, so every contract they could buy commences
    // after it; refusing on the required beginning date alone would forbid the
    // ordinary immediate annuity, which the regulation allows.
    const immediate = household({
      dob: '1950-01-01',
      iraBalance: RMD_IRA_BALANCE,
      basis: 0,
      premium: RMD_PREMIUM,
      startAge: 76, // the owner's age in the 2026 purchase year
    })
    expect(parsePlan(immediate).ok).toBe(true)
  })

  it('leaves the requirement on the household that bought no contract untouched', () => {
    // The figure the old accepted reading named, kept as a live assertion
    // because it is what the refusal protects: a household that keeps its
    // 1,000,000 in the IRA takes 41,825.59 in 2027, and no admissible plan can
    // now pay a premium out of that base and defer everything it buys.
    const untouched = household({
      dob: '1950-01-01', iraBalance: RMD_IRA_BALANCE, basis: 0, premium: 0,
    })
    expect(yearOf(untouched, 2027).rmd).toBeCloseTo(SECOND_YEAR_WITH_CONTRACT, 6)
    expect(yearOf(untouched, 2027).rmd).toBeCloseTo(41_825.59, 2)
  })
})

/**
 * The other end of the QLAC's deferral, and the reason the excuse above is not
 * the whole story.
 *
 * (q)(1)(iii) lets a QLAC ignore the required beginning date; (q)(1)(ii) then
 * requires the same contract to name an annuity starting date no later than the
 * first of the month after the owner's 85th birthday. A contract past that is
 * not a QLAC, so it holds neither the excuse nor 1.401(a)(9)-5(b)(4)'s
 * exclusion — and the engine has one mechanism, which would hand it both. The
 * readings are in the admitted/refused form the neighbouring suite takes,
 * because what the rule turns on is which shapes a Plan may express.
 */
function qlacStartingAt(startAge: number, dob = '1950-01-01'): Plan {
  return household({ dob, iraBalance: RMD_IRA_BALANCE, basis: 0, premium: RMD_PREMIUM, startAge, qlac: true })
}

describeRule('treas-reg-1-401-a-9-6-q-1-ii-qlac-commences-by-the-85th-birthday', {
  readings: {
    // A January-born owner's deadline is February 1 of the year they attain 85,
    // so a contract the engine commences on January 1 of the year they attain
    // 86 is late and validation says so.
    parseRefusesAQlacThatCommencesPastThe85thBirthday: 'refused',
    // What the schema alone would take: any start age up to 95, with the
    // required-distribution exclusion for every one of those years.
    schemaWouldAdmitAnyStartAgeUpTo95: 'accepted',
  },
  accepted: 'parseRefusesAQlacThatCommencesPastThe85thBirthday',
  note: 'a QLAC deferred past 85',
}, ({ accepted, readings }) => {
  it('refuses a QLAC that commences after the owner’s 85th birthday', () => {
    const parsed = parsePlan(qlacStartingAt(86))
    const outcome = parsed.ok ? 'accepted' : 'refused'
    expect(outcome).toBe(accepted)
    expect(outcome).not.toBe(readings.schemaWouldAdmitAnyStartAgeUpTo95)
    if (parsed.ok) throw new Error('expected the QLAC deferred past 85 to be refused')
    expect(parsed.issues.join('; ')).toContain(
      'a QLAC must commence by the first of the month after the owner\'s 85th birthday: it must start paying by age 85',
    )
  })

  it('admits the same contract one year earlier', () => {
    // One field apart, opposite outcomes, so the refusal is about the ceiling
    // and not about some unrelated defect in the fixture's plan.
    expect(parsePlan(qlacStartingAt(85)).ok).toBe(true)
  })

  it('gives a December-born owner the extra year the deadline actually gives them', () => {
    // (q)(1)(ii)'s deadline is the first day of the month NEXT FOLLOWING the
    // 85th anniversary. For a December birthday that day is January 1 of the
    // next calendar year, which is exactly where the projection commences a
    // contract with a start age of 86 — the last day the regulation permits. A
    // November birthday one day earlier gets no such year: its deadline is
    // December 1 of the previous calendar year.
    expect(parsePlan(qlacStartingAt(86, '1950-12-01')).ok).toBe(true)
    expect(parsePlan(qlacStartingAt(87, '1950-12-01')).ok).toBe(false)
    expect(parsePlan(qlacStartingAt(86, '1950-11-30')).ok).toBe(false)
  })

  it('does not send the household to a refusal the other box would give them', () => {
    // The remedy the message names has to be a remedy. Unticking QLAC on a
    // start age of 86 lands on the required-beginning-date bound, which for
    // this owner is 76 — lower still — so the message says why that would not
    // help rather than offering it.
    const parsed = parsePlan(qlacStartingAt(86))
    if (parsed.ok) throw new Error('expected a refusal')
    expect(parsed.issues.join('; ')).toContain(
      'unticking "QLAC (qualified longevity annuity)" would not help, because a qualified purchase that is not a QLAC must start paying by age 76',
    )
  })

  it('warns rather than staying silent for a caller that skips the parse', () => {
    // simulatePlan takes a Plan by type, not by parse, so the shape can still
    // reach the purchase pass in memory — and when it does, the premium leaves
    // the required-distribution base for a contract that is not a QLAC.
    const projected = simulatePlan(qlacStartingAt(86), { startYear: 2026, taxCalculator: noTax })
    expect([...projected.warnings].some((w) => w.includes('is not a QLAC; its premium still left'))).toBe(true)
  })
})

describeRule('treas-reg-1-401-a-9-5-b-4-qlac-excluded-from-the-rmd-account-balance', {
  readings: {
    // 1.401(a)(9)-5(b)(4), carried to IRAs by 1.408-8(h)(1): the QLAC's value
    // is out of the base, so the base is what stayed behind.
    regulationDisregardsTheQlacValue: SECOND_YEAR_WITHOUT_CONTRACT,
    // Without the carve-out a QLAC would be an ordinary deferred contract and
    // its value would drive a requirement for the twelve years before it pays.
    noCarveOutForALongevityContract: SECOND_YEAR_WITH_CONTRACT,
  },
  accepted: 'regulationDisregardsTheQlacValue',
  note: 'the QLAC carve-out',
}, ({ accepted, readings }) => {
  it('computes the requirement on what the account kept', () => {
    const second = yearOf(deferredContract(true), 2027)
    expect(second.rmd).toBeCloseTo(accepted, 6)
    expect(second.rmd).toBeCloseTo(33_091.96, 2)
    expect(second.rmd).not.toBeCloseTo(readings.noCarveOutForALongevityContract, 6)
  })

  it('reaches the regulation’s base by a mechanism that is not the regulation', () => {
    // Recorded because the coincidence is the whole reason this rule is settled
    // while its neighbour spent time approximated. The regulation excludes the
    // VALUE of a contract from a balance that still notionally contains it; the
    // engine never puts a value there, because an annuity account holds no
    // balance. On a QLAC the two agree exactly.
    //
    // This assertion used to run the same household with `qlac: false` and show
    // the two requirements were identical — the engine could not tell the
    // contracts apart. It cannot state that any more, and for the right reason:
    // the shape is refused at parse, so there is no ordinary-contract
    // requirement to compare against. The mirror is therefore drawn against the
    // refusal instead, and the figures this rule pins do not move, because the
    // mechanism that produces them never changed.
    const qlacYear = yearOf(deferredContract(true), 2027)
    expect(qlacYear.rmd).toBeCloseTo(SECOND_YEAR_WITHOUT_CONTRACT, 6)
    expect(parsePlan(deferredContract(false)).ok).toBe(false)
    expect(accepted).toBeCloseTo(SECOND_YEAR_WITHOUT_CONTRACT, 6)
  })
})

// --------------------------------------------------------------------------
// The QLAC premium cap, as a running total rather than a per-contract
// allowance. The same 76-year-old and the same 1,000,000 dollar IRA, buying TWO
// QLACs of 150,000 each in 2026. Neither premium reaches the 210,000 cap on its
// own, which is the point: the per-contract test the engine applies is silent,
// and the pair moves 300,000 out of the required-distribution base.
const QLAC_CAP_2026 = 210_000
const TWIN_QLAC_PREMIUM = 150_000
/** December 31, 2026 with only the statutory total outside the base. */
const SECOND_YEAR_AT_THE_RUNNING_TOTAL =
  (RMD_IRA_BALANCE - QLAC_CAP_2026 - FIRST_YEAR_DISTRIBUTION) / 22.9
/** The same December 31 with both premiums outside it. */
const SECOND_YEAR_AT_A_CAP_PER_CONTRACT =
  (RMD_IRA_BALANCE - 2 * TWIN_QLAC_PREMIUM - FIRST_YEAR_DISTRIBUTION) / 22.9

/** The shared household with a second QLAC of the same size and year. */
function twoQlacs(): Plan {
  const plan = household({
    dob: '1950-01-01',
    iraBalance: RMD_IRA_BALANCE,
    basis: 0,
    premium: TWIN_QLAC_PREMIUM,
    startAge: DEFERRED_START_AGE,
    qlac: true,
  })
  const first = plan.accounts.find((a) => a.type === 'annuity')!
  if (first.type !== 'annuity') throw new Error('fixture built no annuity contract')
  plan.accounts = [...plan.accounts, { ...first, id: 'annuity-fixture-contract-2', name: 'Second QLAC' }]
  return plan
}

describeRule('treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract', {
  readings: {
    // (q)(2)(ii) reduces the limitation by the premiums already paid for any
    // OTHER contract intended to be a QLAC under any 401(a)/403(a)/403(b)/408
    // arrangement, so the second purchase has 60,000 of allowance left and the
    // excess 90,000 stays in the base: 747,805.91 over 22.9.
    regulationSpendsOneRunningTotal: SECOND_YEAR_AT_THE_RUNNING_TOTAL,
    // The engine: each purchase is measured against the whole cap on its own,
    // neither one exceeds it, and 300,000 leaves the base.
    engineGivesEachContractTheWholeCap: SECOND_YEAR_AT_A_CAP_PER_CONTRACT,
  },
  accepted: 'regulationSpendsOneRunningTotal',
  produced: 'engineGivesEachContractTheWholeCap',
  note: 'two contracts against one cap',
}, ({ accepted, produced }) => {
  it('lets a second QLAC spend the whole cap again', () => {
    const projected = project(twoQlacs())
    const second = projected.years.find((y) => y.year === 2027)!

    expect(second.rmd).toBeCloseTo(produced, 6)
    expect(second.rmd).toBeCloseTo(28_725.15, 2)
    expect(second.rmd).not.toBeCloseTo(accepted, 6)
    expect(accepted).toBeCloseTo(32_655.28, 2)
    // What the unspent-total reading is worth in the second year alone.
    expect(accepted - produced).toBeCloseTo(3_930.13, 2)
  })

  it('says nothing while the pair passes the cap', () => {
    // The mechanism, not just the arithmetic. The engine's only guard is a
    // per-contract comparison, so two premiums that are each under the cap
    // raise no warning at all — the household is never told the total was
    // exceeded. A single over-cap purchase does warn, which is what makes the
    // silence here a statement about aggregation rather than about the cap.
    const pair = project(twoQlacs())
    const capWarnings = [...pair.warnings].filter((w) => w.includes('QLAC premium above'))
    expect(capWarnings).toEqual([])

    const single = project(household({
      dob: '1950-01-01',
      iraBalance: RMD_IRA_BALANCE,
      basis: 0,
      premium: 2 * TWIN_QLAC_PREMIUM,
      startAge: DEFERRED_START_AGE,
      qlac: true,
    }))
    expect([...single.warnings].some((w) => w.includes('QLAC premium above'))).toBe(true)
  })
})

// --------------------------------------------------------------------------
// The one thing the engine gets right, and the schema arm that keeps the
// contrary reading unreachable.
const CHARACTER_IRA_BALANCE = 1_000_000
const CHARACTER_PREMIUM = 200_000
/**
 * No basis, deliberately. With the account fully pre-tax the pro-rata fraction
 * is 1 and the two readings differ by exactly the premium, so the fixture
 * measures the character of the purchase and nothing else.
 */
const CHARACTER_REQUIRED_DISTRIBUTION = CHARACTER_IRA_BALANCE / 23.7

describeRule('irc-408-d-1-ira-annuity-premium-is-not-a-distribution', {
  readings: {
    // 408(d)(1) reaches only what is paid or distributed OUT. The premium is a
    // trustee-to-trustee transfer or an investment of the trust; either way the
    // year's income is the required distribution alone.
    statuteTaxesNothingAtPurchase: CHARACTER_REQUIRED_DISTRIBUTION,
    // The rejected reading: the premium is a distribution the owner then spends
    // on a contract, which would put the whole 200,000 on line 7.
    distributionAndPurchaseAddsThePremiumToLine7:
      CHARACTER_REQUIRED_DISTRIBUTION + CHARACTER_PREMIUM,
  },
  accepted: 'statuteTaxesNothingAtPurchase',
  note: 'the character of the premium',
}, ({ accepted, readings }) => {
  const noBasisHousehold = (premium: number) => household({
    dob: '1950-01-01',
    iraBalance: CHARACTER_IRA_BALANCE,
    basis: 0,
    premium,
  })

  it('reports no income for a 200,000 dollar premium paid out of the IRA', () => {
    const year = yearOf(noBasisHousehold(CHARACTER_PREMIUM), 2026)
    expect(year.magi).toBeCloseTo(accepted, 6)
    expect(year.magi).toBeCloseTo(42_194.09, 2)
    expect(year.magi).not.toBeCloseTo(readings.distributionAndPurchaseAddsThePremiumToLine7, 6)
  })

  it('reports the same income as the household that bought nothing', () => {
    const bought = yearOf(noBasisHousehold(CHARACTER_PREMIUM), 2026)
    const kept = yearOf(noBasisHousehold(0), 2026)
    expect(bought.magi).toBeCloseTo(kept.magi, 6)
  })
})

describeRule('irc-408-d-1-ira-annuity-premium-is-not-a-distribution', {
  readings: {
    // Plan validation refuses a non-qualified purchase drawn on a traditional
    // account, so the distribution-and-purchase shape has no expression in an
    // accepted input at all — the rejected reading above is not merely wrong
    // here, it is unreachable.
    schemaRefusesANonQualifiedPremiumDrawnOnAnIra: 'refused',
    schemaWouldAdmitADistributionAndPurchase: 'accepted',
  },
  accepted: 'schemaRefusesANonQualifiedPremiumDrawnOnAnIra',
  note: 'the funding arms',
}, ({ accepted, readings }) => {
  /**
   * The same plan with the tax qualification flipped. A `nonQualified` purchase
   * is the engine's name for the distribution-and-purchase shape: it prices the
   * payments under the section 72 exclusion ratio, which presupposes after-tax
   * dollars went into the contract.
   */
  function nonQualifiedFromTheIra(): Plan {
    const plan = household({
      dob: '1950-01-01', iraBalance: CHARACTER_IRA_BALANCE, basis: 0, premium: CHARACTER_PREMIUM,
    })
    const contract = plan.accounts.find((a) => a.type === 'annuity')!
    if (contract.type !== 'annuity' || contract.purchase === undefined) {
      throw new Error('fixture built no annuity purchase')
    }
    contract.purchase = { ...contract.purchase, taxQualification: 'nonQualified' }
    return plan
  }

  it('refuses to draw a non-qualified premium from a traditional account', () => {
    const parsed = parsePlan(nonQualifiedFromTheIra())
    const outcome = parsed.ok ? 'accepted' : 'refused'
    expect(outcome).toBe(accepted)
    expect(outcome).not.toBe(readings.schemaWouldAdmitADistributionAndPurchase)
    if (parsed.ok) throw new Error('expected the non-qualified IRA premium to be refused')
    expect(parsed.issues.join('; ')).toContain(
      'a non-qualified annuity purchase must be funded from cash, taxable, or equity-comp savings',
    )
  })

  it('admits the qualified arm from the same account', () => {
    // The other side of the boundary, so the assertion above is about the
    // funding rule and not about some unrelated defect in the fixture's plan.
    const parsed = parsePlan(household({
      dob: '1950-01-01', iraBalance: CHARACTER_IRA_BALANCE, basis: 0, premium: CHARACTER_PREMIUM,
    }))
    expect(parsed.ok).toBe(true)
  })
})
