/**
 * Pins for three `approximated` registry records — two in the federal tax
 * engine's itemized-deduction build, one in the Roth withdrawal split.
 *
 * Each fixture states the figure the authority supports and the figure this
 * engine actually returns, and asserts the engine returns the second. The day
 * the gap closes, the assertion fails and names the record that has to be
 * reclassified. That is the whole point: an `approximated` record is a claim
 * about what this engine gets wrong, and left unwatched it rots in the
 * direction of looking more responsible than the code is.
 *
 * The scenarios below deliberately avoid the OBBBA senior deduction
 * (`peopleAged65Plus: 0`) so the deduction figures are fixed by the inputs and
 * the SALT/standard figures alone, and the gap being pinned is the only thing
 * moving between the two readings.
 */

import { describe, expect, it } from 'vitest'
import { describeRule } from '../describeRule.js'
import { computeFederalTax } from '../../tax/federalTax.js'
import { splitRothWithdrawal, type RothBasisState } from '../../strategies/rothBasis.js'
import type { TaxYearInput } from '../../projection/types.js'

/**
 * A single filer in 2026 with no preferential income and no Social Security,
 * so AGI is the ordinary line and the only thing under test is the deduction.
 */
function singleFiler(
  ordinaryIncome: number,
  itemizedDeductions: TaxYearInput['itemizedDeductions'],
): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    itemizedDeductions,
  }
}

/**
 * Both federal gaps below are *missing inputs*, not mis-sized arithmetic, and
 * that is what makes them awkward to pin: an assertion that only feeds the
 * fields which exist today stays green forever, including on the day someone
 * adds the field and closes the gap. So each fixture also feeds the facts the
 * statute needs under the names a fix would plausibly give them, and asserts
 * the answer does not move. The first commit that honours any of these keys
 * fails the fixture and names the record to reclassify.
 */
function withExtraFacts(
  items: NonNullable<TaxYearInput['itemizedDeductions']>,
  facts: Readonly<Record<string, number>>,
): NonNullable<TaxYearInput['itemizedDeductions']> {
  return { ...items, ...facts } as NonNullable<TaxYearInput['itemizedDeductions']>
}

describe('federal tax and Roth basis approximations', () => {
  // IRC 213(a) allows unreimbursed medical care above 7.5% of AGI, and 67(b)(5)
  // keeps it out of the miscellaneous class that 67(h) disallows. The engine's
  // `itemizedTotal` (packages/engine/src/tax/federalTax.ts:111) sums SALT,
  // mortgage interest and charitable and nothing else, and `TaxYearInput` has
  // no medical field at all, so the deduction is not merely mis-sized — it
  // cannot be expressed.
  //
  // The household below has $200,000 of AGI and $80,000 of unreimbursed care
  // costs, so the 7.5% floor is $15,000 and $65,000 is deductible. Its other
  // itemized items are $30,000 SALT (under the $40,400 2026 cap), $20,000 of
  // mortgage interest and a $10,000 gift, of which 170(b)(1)(I) allows only the
  // excess over 0.5% of the $200,000 contribution base: $10,000 - $1,000 =
  // $9,000. 68 reaches nothing here, because AGI of $200,000 is far below the
  // $640,600 start of the 37% bracket 68(a)(2) measures from, so the base is
  // zero under both readings. That leaves $59,000 of allowable items,
  // comfortably past the $16,100 standard deduction, so both readings itemize
  // and the flip is not what separates them: the statutory deduction is
  // $59,000 + $65,000 = $124,000, the engine's is $59,000.
  //
  // The statutory reading is computed by the same engine call with the $65,000
  // deductible amount routed through the MORTGAGE INTEREST line, so the
  // comparison is between two real engine outputs and not against a
  // hand-arithmetic figure. It used to ride the charitable line, which was the
  // uncapped itemized dollar until 170(b)(1)(I) was wired in. It no longer is:
  // the floor would now bite the synthesised figure, and the reading would only
  // stay clean while the household's genuine gift happened to exceed the floor
  // on its own — an accident of these inputs rather than a property of the
  // synthesis. Mortgage interest carries the amount through untouched (the
  // engine takes `items.mortgageInterest` at face value, which is the very
  // thing the 163(h)(3)(F) fixture below pins), so the gap between the two
  // readings is the medical deduction and nothing else. Both readings pay the
  // same $1,000 charitable floor, so it cancels out of the difference.
  describeRule('irc-213-a-medical-expense-deduction', {
    readings: { statute: 124_000, engineOmitsMedicalEntirely: 59_000 },
    accepted: 'statute',
    produced: 'engineOmitsMedicalEntirely',
    note: 'deductible medical above the 7.5% floor for a household already itemizing',
  }, ({ accepted, produced }) => {
    const medicalExpenses = 80_000
    const grossIncome = 200_000
    const otherItemized = { stateAndLocalTaxes: 30_000, mortgageInterest: 20_000, charitable: 10_000 }
    /** The 213(a) amount, routed through an itemized line the engine does floor. */
    const asMortgageInterest = (
      items: { stateAndLocalTaxes: number, mortgageInterest: number, charitable: number },
      deductibleMedical: number,
    ) => ({ ...items, mortgageInterest: items.mortgageInterest + deductibleMedical })

    it('omits deductible medical expenses from the itemized total', () => {
      const detail = computeFederalTax(singleFiler(grossIncome, otherItemized))

      expect(detail.agi).toBe(grossIncome)
      // 7.5% of AGI is 15,000, so 65,000 of the 80,000 is deductible.
      const deductibleMedical = medicalExpenses - 0.075 * detail.agi
      expect(deductibleMedical).toBe(65_000)

      expect(detail.itemized).toBe(true)
      // 30,000 SALT + 20,000 interest + (10,000 - 0.5% x 200,000) gift = 59,000,
      // with no 68 reduction against a 200,000 AGI.
      expect(detail.section68Limitation).toBe(0)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
    })

    it('ignores unreimbursed medical costs however they are supplied', () => {
      const supplied = computeFederalTax(singleFiler(grossIncome, withExtraFacts(otherItemized, {
        medical: medicalExpenses,
        medicalExpenses,
        unreimbursedMedical: medicalExpenses,
        medicalAndDental: medicalExpenses,
      })))

      expect(supplied.deduction).toBe(produced)
    })

    it('reaches the statutory deduction only when the medical amount is smuggled in as another itemized dollar', () => {
      const statutory = computeFederalTax(
        singleFiler(grossIncome, asMortgageInterest(otherItemized, 65_000)),
      )

      // 30,000 + (20,000 + 65,000) + 9,000 = 124,000.
      expect(statutory.deduction).toBe(accepted)
      // The whole understatement is the deductible medical amount: the 1,000
      // charitable floor is paid on both sides and cancels.
      expect(accepted - produced).toBe(65_000)
    })

    it('overstates tax, by the deduction it cannot see at the marginal rate', () => {
      const engine = computeFederalTax(singleFiler(grossIncome, otherItemized))
      const statutory = computeFederalTax(
        singleFiler(grossIncome, asMortgageInterest(otherItemized, 65_000)),
      )

      expect(engine.taxableIncome).toBe(141_000) // 200,000 - 59,000
      expect(statutory.taxableIncome).toBe(76_000) // 200,000 - 124,000
      // errorDirection: 'overstatesTax'.
      expect(engine.totalTax).toBeGreaterThan(statutory.totalTax)
    })

    it('cannot see the election flip a heavy medical year forces', () => {
      // Other itemized items of 6,000 gross, 5,000 after the 1,000 charitable
      // floor, lose to the 16,100 standard deduction; adding the 65,000 of
      // deductible medical takes the total to 70,000 and the household should
      // itemize. The engine keeps the standard deduction.
      const sparse = { stateAndLocalTaxes: 4_000, mortgageInterest: 0, charitable: 2_000 }
      const engine = computeFederalTax(singleFiler(grossIncome, sparse))
      const statutory = computeFederalTax(
        singleFiler(grossIncome, asMortgageInterest(sparse, 65_000)),
      )

      expect(engine.itemized).toBe(false)
      expect(statutory.itemized).toBe(true)
      expect(statutory.deduction).toBe(70_000) // 4,000 + 65,000 + (2,000 - 1,000)
    })
  })

  // IRC 163(h)(3)(F)(i)(II) caps acquisition indebtedness taken into account at
  // $750,000 for debt incurred after 15 December 2017. The engine takes
  // `items.mortgageInterest` at face value (federalTax.ts:118) with no
  // principal figure anywhere in `TaxYearInput`, so it has no way to apply the
  // cap and none of the interest is disallowed.
  //
  // $1,500,000 of post-2017 acquisition debt at $90,000 of interest is exactly
  // twice the cap, so half the interest is qualified: $45,000. With $20,000 of
  // SALT (under the $40,400 2026 cap) the statutory itemized total is $65,000
  // and the engine's is $110,000. Both beat the standard deduction, so the
  // $45,000 gap is the disallowed interest and nothing else.
  describeRule('irc-163-h-3-F-acquisition-indebtedness-limit', {
    readings: { statute: 65_000, engineOmitsPrincipalCap: 110_000 },
    accepted: 'statute',
    produced: 'engineOmitsPrincipalCap',
    note: 'interest on acquisition debt of $1.5M, twice the $750,000 limit',
  }, ({ accepted, produced }) => {
    const acquisitionDebt = 1_500_000
    const mortgageInterest = 90_000
    const qualifiedShare = 750_000 / acquisitionDebt
    const qualifiedInterest = mortgageInterest * qualifiedShare
    const salt = 20_000

    it('deducts the whole interest figure with no principal limit applied', () => {
      expect(qualifiedInterest).toBe(45_000)

      const detail = computeFederalTax(singleFiler(300_000, {
        stateAndLocalTaxes: salt,
        mortgageInterest,
        charitable: 0,
      }))

      expect(detail.itemized).toBe(true)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
      // The whole overstatement is the disallowed half of the interest.
      expect(detail.deduction - accepted).toBe(mortgageInterest - qualifiedInterest)
    })

    it('ignores the acquisition-debt principal however it is supplied', () => {
      // The grandfather in 163(h)(3)(F)(i)(IV) means the cap cannot be applied
      // from the principal alone, so a fix needs the incurred date too; both
      // are offered here so either shape of fix trips this assertion.
      const supplied = computeFederalTax(singleFiler(300_000, withExtraFacts({
        stateAndLocalTaxes: salt,
        mortgageInterest,
        charitable: 0,
      }, {
        acquisitionDebt: acquisitionDebt,
        acquisitionIndebtedness: acquisitionDebt,
        mortgagePrincipal: acquisitionDebt,
        homeEquityIndebtedness: 0,
        debtIncurredYear: 2019,
      })))

      expect(supplied.deduction).toBe(produced)
    })

    it('understates tax against the return that respects the cap', () => {
      const engine = computeFederalTax(singleFiler(300_000, {
        stateAndLocalTaxes: salt,
        mortgageInterest,
        charitable: 0,
      }))
      const statutory = computeFederalTax(singleFiler(300_000, {
        stateAndLocalTaxes: salt,
        mortgageInterest: qualifiedInterest,
        charitable: 0,
      }))

      expect(statutory.deduction).toBe(accepted)
      expect(engine.taxableIncome).toBe(190_000)
      expect(statutory.taxableIncome).toBe(235_000)
      // errorDirection: 'understatesTax'.
      expect(engine.totalTax).toBeLessThan(statutory.totalTax)
    })
  })

  // IRC 408A(d)(2) makes a distribution qualified only if BOTH an (A) event has
  // happened AND the distribution falls after the 5-taxable-year period that
  // begins with the first year the individual contributed to any Roth IRA.
  // `splitRothWithdrawal` (packages/engine/src/strategies/rothBasis.ts:81)
  // tests `age >= ROTH_QUALIFIED_AGE` and nothing else, and `RothBasisState`
  // carries no first-Roth-year at all, so the five-year period is absent from
  // the type as well as from the arithmetic.
  //
  // The case this misses is the one a late conversion ladder produces: a
  // 62-year-old whose first Roth IRA was opened in 2024 takes a 2026
  // distribution. The (A)(i) age event is met, the 5-taxable-year period
  // (2024–2028) is not, so the $50,000 of earnings is ordinary income. The
  // engine reports $0.
  describeRule('irc-408A-d-2-roth-qualified-distribution', {
    readings: { statute: 50_000, engineTestsAttainedAgeOnly: 0 },
    accepted: 'statute',
    produced: 'engineTestsAttainedAgeOnly',
    note: 'earnings taxed inside the five-taxable-year period, past the age event',
  }, ({ accepted, produced }) => {
    const firstRothContributionYear = 2024
    const distributionYear = 2026
    const state: RothBasisState = { contributionBasis: 10_000, conversionLayers: [] }

    it('treats earnings as tax-free inside the five-taxable-year period', () => {
      // The period runs 2024 through 2028, so a 2026 distribution is inside it.
      expect(distributionYear - firstRothContributionYear).toBeLessThan(5)

      const split = splitRothWithdrawal(state, 60_000, distributionYear, 62)

      expect(split.contributions).toBe(10_000)
      expect(split.conversions).toBe(0)
      expect(split.earnings).toBe(accepted)
      // The earnings came out; the engine simply does not tax them.
      expect(split.taxableOrdinary).toBe(produced)
      expect(split.taxableOrdinary).not.toBe(accepted)
      // 408A(d)(2)(B) failing also costs the 408A(d)(1) exclusion for 72(t)
      // purposes; at 62 the (A)(i) event spares the additional tax, so the
      // understatement here is income tax on the full earnings layer.
      expect(split.penalty).toBe(0)
    })

    it('has nowhere to put the first-Roth-year fact that would change the answer', () => {
      // Asserted on the state the ENGINE builds, not on the literal above: a
      // first-contribution-year field added to `RothBasisState` would surface
      // here and fail, which is the point.
      const carried = splitRothWithdrawal(state, 60_000, distributionYear, 62).next
      expect(Object.keys(carried).sort()).toEqual(['contributionBasis', 'conversionLayers'])

      // And supplying the fact under the names a fix would give it changes
      // nothing, because nothing reads it.
      const supplied = splitRothWithdrawal({
        ...state,
        firstRothContributionYear,
        firstContributionYear: firstRothContributionYear,
        rothEstablishedYear: firstRothContributionYear,
      } as RothBasisState, 60_000, distributionYear, 62)
      expect(supplied.taxableOrdinary).toBe(produced)
    })

    it('runs the other way too, on the attained-age-60 proxy for 59.5', () => {
      // Someone who turns 60 in 2026 attained 59.5 during 2025, so a 2025
      // distribution of a seasoned Roth is qualified under (A)(i). The engine's
      // calendar-year age test says 59, not qualified, and charges income tax
      // and the 10% additional tax on the whole earnings layer.
      const split = splitRothWithdrawal(state, 60_000, 2025, 59)

      expect(split.earnings).toBe(50_000)
      expect(split.taxableOrdinary).toBe(50_000)
      expect(split.penalty).toBe(5_000)
    })
  })
})
