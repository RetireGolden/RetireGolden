/**
 * What an IRA-funded qualified annuity purchase IS, and the three places this
 * engine models it as something else.
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
 * The engine gets the first sentence right and the rest wrong, for one
 * structural reason: a Plan annuity account has no balance. It is excluded from
 * the projection's balance ledger by construction, so the premium leaves the
 * owned-IRA pool at the purchase pass and there is nowhere for it to land. Three
 * consequences follow, and each has its own record because each has its own
 * authority and its own sign:
 *
 *   - the line 6 denominator loses the contract, so the basis fraction is too
 *     large and the residual IRA recovers basis too fast (understates tax);
 *   - the payments are taxed in full, taking no share of the basis at all
 *     (overstates tax);
 *   - the required-distribution base loses the contract, which the regulations
 *     permit only for a QLAC — closed on 2026-08-07 by refusing the shape
 *     rather than by pricing it, so that suite now pins a refusal.
 *
 * A fourth departure is registered here without being one of the three, because
 * it is about the QLAC cap rather than the character of the purchase: the cap is
 * one running total across every arrangement of an individual, and the engine
 * measures each contract against the whole of it (understates tax).
 *
 * EVERY FIXTURE BELOW RUNS AT A 0 PERCENT RETURN, and that is not decoration.
 * It collapses the measurement-instant question that
 * `irc-408-d-2-C-projection-pro-rata-measurement-instant` owns — at a flat
 * return the close-of-year denominator and the before-the-first-distribution
 * one agree — so what is left in the gap is the contract and nothing else. It
 * also makes the contract's December 31 value exactly the premium in the
 * purchase year: a single premium, no growth, and, where the fixture needs it,
 * no payments yet. The accepted figures are therefore arithmetic from the
 * quoted authority rather than a valuation convention, which matters here more
 * than usual, because the fair market value of an annuitized contract is the
 * one input none of this can supply.
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
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
    // The engine: the premium left the pool and landed nowhere, so the
    // denominator is 800,000, the fraction is 0.25, and the same distributions
    // carry 106,645.57.
    engineDropsTheContractAtPurchase:
      ANNUAL_GROSS * (1 - IRA_BASIS / ENGINE_DENOMINATOR),
  },
  accepted: 'statuteKeepsTheContractInTheAggregate',
  produced: 'engineDropsTheContractAtPurchase',
  note: 'the line 6 denominator',
}, ({ accepted, produced }) => {
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

  it('recovers basis at a fraction the premium was allowed to raise', () => {
    const year = yearOf(withContract(), 2026)

    // Both readings rest on this requirement and this conversion. If either
    // moves, the figures below stop being about the denominator.
    expect(year.rmd).toBeCloseTo(REQUIRED_DISTRIBUTION, 6)
    expect(year.rothConversion).toBeCloseTo(CONVERSION, 6)
    expect(year.qcd).toBe(0)

    expect(year.magi).toBeCloseTo(produced, 6)
    expect(year.magi).toBeCloseTo(106_645.57, 2)
    expect(year.magi).not.toBeCloseTo(accepted, 6)
    expect(accepted).toBeCloseTo(113_755.27, 2)
    // What the missing contract is worth to this household in one year.
    expect(accepted - produced).toBeCloseTo(7_109.70, 2)
  })

  it('treats a purchase the form cannot see as a taxable event anyway', () => {
    // The cleanest statement of the defect available. On the compelled reading
    // the premium is a move between two line-6 assets, so the household that
    // bought the contract and the household that did not report the SAME
    // ordinary income — the form has no term that distinguishes them. The
    // engine parts them by 7,109.70.
    const bought = yearOf(withContract(), 2026)
    const kept = yearOf(withoutContract(), 2026)

    expect(kept.magi).toBeCloseTo(accepted, 2)
    expect(bought.magi).toBeCloseTo(produced, 6)
    expect(kept.magi - bought.magi).toBeCloseTo(7_109.70, 2)

    // And the two arms are genuinely different code paths, which is why the
    // comparison is worth making: the household with the contract is refused by
    // the exact settlement (`annuityStageRequired`) and priced by the fallback,
    // the household without it settles.
    expect(kept.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(bought).not.toHaveProperty('ownedNonRothIraAnnualReplay')
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
 * The fraction the engine itself computed for this year, on its own pool.
 *
 * Held fixed across both readings on purpose. Whether that pool is the right
 * one is the question the record above owns; letting it move here would make
 * this fixture a second measurement of that defect instead of a measurement of
 * 408(d)(2)(B), and the two would then rise and fall together.
 */
const ENGINE_TAXABLE_FRACTION =
  1 - PAYOUT_BASIS / (PAYOUT_IRA_BALANCE - PAYOUT_PREMIUM)

describeRule('irc-408-d-2-B-annuity-payment-outside-the-annual-basis-fraction', {
  readings: {
    // 408(d)(2)(B) with Publication 590-B: one distribution, one fraction. The
    // requirement and the annuity payment are 61,504.95 together, and at the
    // year's own 0.75 that is 46,128.71.
    statuteAppliesOneFractionToEveryDistribution:
      (PAYOUT_REQUIRED_DISTRIBUTION + PAYOUT_ANNUAL) * ENGINE_TAXABLE_FRACTION,
    // The engine: 0.75 on the requirement, 1.00 on the payment, 49,128.71.
    engineTaxesTheAnnuityPaymentInFull:
      PAYOUT_REQUIRED_DISTRIBUTION * ENGINE_TAXABLE_FRACTION + PAYOUT_ANNUAL,
  },
  accepted: 'statuteAppliesOneFractionToEveryDistribution',
  produced: 'engineTaxesTheAnnuityPaymentInFull',
  note: 'the payment’s share of basis',
}, ({ accepted, produced }) => {
  const paying = (monthlyAmount: number) => household({
    dob: '1946-01-01', // 80 in 2026, so the contract pays in its purchase year
    iraBalance: PAYOUT_IRA_BALANCE,
    basis: PAYOUT_BASIS,
    premium: PAYOUT_PREMIUM,
    startAge: 80,
    monthlyAmount,
  })

  it('adds the whole annuity payment to income while the aggregate holds basis', () => {
    const year = yearOf(paying(PAYOUT_MONTHLY), 2026)

    expect(year.rmd).toBeCloseTo(PAYOUT_REQUIRED_DISTRIBUTION, 6)
    expect(year.incomes.annuity).toBeCloseTo(PAYOUT_ANNUAL, 6)

    expect(year.magi).toBeCloseTo(produced, 6)
    expect(year.magi).toBeCloseTo(49_128.71, 2)
    expect(year.magi).not.toBeCloseTo(accepted, 6)
    expect(accepted).toBeCloseTo(46_128.71, 2)
    // Exactly the basis share the payment was refused: 12,000 at 0.25.
    expect(produced - accepted).toBeCloseTo(3_000, 6)
  })

  it('charges the payment in full rather than at the fraction it charged the requirement', () => {
    // Isolating the claim from the size of the payment. Turning the contract's
    // payments on adds their full face amount to income and moves nothing else,
    // which is what "took no share of the basis" means arithmetically.
    const silent = yearOf(paying(0), 2026)
    const paid = yearOf(paying(PAYOUT_MONTHLY), 2026)

    expect(silent.incomes.annuity).toBe(0)
    expect(paid.magi - silent.magi).toBeCloseTo(PAYOUT_ANNUAL, 6)
    // The requirement is priced identically in both runs, so the difference
    // above is the payment and only the payment.
    expect(silent.magi).toBeCloseTo(
      PAYOUT_REQUIRED_DISTRIBUTION * ENGINE_TAXABLE_FRACTION, 6,
    )
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
