/**
 * A CHARITABLE DISTRIBUTION PAST THE 408(d)(8)(D) CAP IS NOT A QCD, AND BOTH
 * ARMS NOW PUT IT BACK ON FORM 8606 LINE 7.
 *
 * THE STATUTE. IRC 408(d)(8)(B)'s closing sentence: "A distribution shall be
 * treated as a qualified charitable distribution only to the extent that the
 * distribution would be includible in gross income without regard to
 * subparagraph (A)." IRC 408(d)(8)(D) caps that includible amount at the
 * owner's aggregate includible amount -- all their individual retirement plans
 * treated as one contract, less basis. A charitable distribution beyond that
 * cap is NOT a qualified charitable distribution: it is an ordinary
 * distribution that stays in the section 72 computation. The Form 8606 line-7
 * instructions exclude "Qualified charitable distributions (QCDs)" from line 7
 * BY NAME and nothing else, so a charitable distribution that is not a QCD
 * belongs on line 7, in the line-9 denominator, and recovers basis pro rata.
 *
 * WHAT THIS FILE PINS, AND WHAT IT USED TO PIN. It began as an adversarial
 * probe CHARACTERIZING a defect: `applicationShape` returned
 * `form8606Line: null` for every `legacyQcd` occurrence unconditionally, so the
 * whole moving gift left line 7 and the line-9 denominator including the part
 * that never qualified. The annual ledger had it right all along -- its
 * beyond-requirement arm ran the remainder through the pro-rata split -- but
 * `simulate.ts` writes the REPLAY's `nextYearOpeningBasisAmount` into
 * `iraBasisByOwner`, so the replay's chain was the one every later year was
 * priced from. On the shape below it handed forward 92,845.36 where the form
 * says 80,000.00, overstating by exactly the 12,845.36 that was never a gift.
 *
 * The assertions are now the hand-computed Form 8606 lines themselves, and each
 * one names the figure the engine used to produce so a regression is legible as
 * a return to a known defect rather than as an unexplained number.
 *
 * SCOPE, STATED HONESTLY. The `noRoutedHalf` shape reached the settlement
 * before the gift-settlement slice too, so the defect predated it; the slice
 * expanded its REACH, because a gift routed out of a required distribution used
 * to be refused with `qcdStageRequired` and priced by the legacy fallback,
 * which carried the ledger's own correct basis. Both shapes are fixed here.
 *
 * WHY NO TAX MOVES IN THE YEAR ITSELF, on this fixture. A year with any
 * non-qualified excess is by construction a year whose ledger denominator is
 * exactly the owner's basis (`preDistribution - qualified` with
 * `qualified === preDistribution - basis`), so the pro-rata fraction is 1 and
 * nothing is taxable on either chain at a flat return. The damage was entirely
 * in the basis the year handed forward, which is what the third case follows.
 */
import { describe, expect, it } from 'vitest'

import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearResult } from '../projection/types.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

/** 100,000 of IRA carrying 98,000 of basis: only 2,000 of it can ever be a QCD. */
const IRA_BALANCE = 100_000
const IRA_BASIS = 98_000
const AGGREGATE_INCLUDIBLE = IRA_BALANCE - IRA_BASIS
const GIFT = 20_000

/**
 * The hand Form 8606, exact at a 0 percent return and identical for both
 * shapes below, because the two differ only in which occurrence carried the
 * dollars and the form does not ask:
 *
 *   distributions            = 20,000.00 (requirement and gift together)
 *   QCD allowable under (B)  = min(20,000, 100,000 - 98,000)     =  2,000.00
 *   line 6 (Dec 31 value)    = 100,000 - 20,000                  = 80,000.00
 *   line 7                   = 20,000 - 2,000                    = 18,000.00
 *   line 9                   = 80,000 + 18,000                   = 98,000.00
 *   line 10                  = 98,000 / 98,000                   =  1.000
 *   line 13 (basis returned) = 18,000 x 1.000                    = 18,000.00
 *   line 14 (basis forward)  = 98,000 - 18,000                   = 80,000.00
 */
const FORM_LINE_7 = GIFT - AGGREGATE_INCLUDIBLE
const FORM_LINE_9 = IRA_BASIS
const FORM_BASIS_FORWARD = IRA_BASIS - FORM_LINE_7

function ira(balance: number, basis: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount('ira', balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0, nondeductibleBasis: basis }
}

/**
 * `dob` is the only variable: 1945 is past the RMD age so part of the gift is
 * routed out of a required distribution and the nonmoving overlay is minted;
 * 1955 is 71 -- eligible under 408(d)(8)(B)(ii), below the RMD age -- so there
 * is no requirement, no overlay, and the whole gift moves on its own.
 */
function giftPlan(dob: string): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 90 })
  plan.id = `nonqualified-remainder-${dob}`
  plan.accounts = [
    { ...(cashAccount('cash', 200_000) as Extract<Account, { type: 'cash' }>),
      annualReturnPct: 0 },
    ira(IRA_BALANCE, IRA_BASIS),
  ]
  plan.strategies.qcdAnnual = GIFT
  return plan
}

function years(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return structuredClone(simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR, horizonEndYear: endYear, taxCalculator: noTax,
  }).years) as YearResult[]
}

describe('the non-qualified part of an aggregate gift stays on Form 8606', () => {
  // THE SHAPE THE GIFT-SETTLEMENT SLICE NEWLY EXPOSED. Age 81, so the gift is
  // 5,154.64 routed out of the requirement plus 14,845.36 moving on its own,
  // and the year settles instead of falling to the fallback.
  it('reports the whole unqualified remainder when part of the gift is routed', () => {
    const year = years(giftPlan('1945-01-01'))[0]!

    // The shape: a routed half, and a moving half larger than the QCD ceiling.
    const overlay = year.retirementRuntimeSource!.nonmovingLegacyQcdOverlay!
    expect(year.qcd).toBeCloseTo(GIFT, 6)
    expect(overlay.grossAmountPlanDollars).toBeCloseTo(year.rmd, 6)
    // Nothing routed qualified: the whole 2,000 ceiling is spent on the moving
    // half, which the (D) block charges the non-qualified excess against first.
    expect(overlay.ownerAttributions[0]!.qualifiedLine7ExclusionPlanDollars)
      .toBe(0)
    // And the moving draw says so per occurrence: 12,845.36 of its 14,845.36
    // was never a gift.
    const characterizations =
      year.retirementRuntimeSource!.legacyQcdCharacterizations
    expect(characterizations).toHaveLength(1)
    expect(characterizations[0]!.nonQualifiedLine7GrossPlanDollars)
      .toBeCloseTo(GIFT - year.rmd - AGGREGATE_INCLUDIBLE, 6)
    expect(GIFT - year.rmd - AGGREGATE_INCLUDIBLE).toBeCloseTo(12_845.36, 2)
    expect(year.ownedNonRothIraAnnualReplay).toBeDefined()

    const owner = year.ownedNonRothIraAnnualReplay!
      .annualReplay.ownerReplays[0]!

    // Line 7 is the requirement PLUS the unqualified part of the moving draw,
    // which is the whole 18,000 the form asks for. It used to be the
    // requirement alone -- 5,154.64 -- because every legacyQcd occurrence left
    // the line whether or not it had qualified.
    expect(owner.line7AllocationEvidence.annualGrossAmount)
      .toBe(planDollarsToLedgerCents(FORM_LINE_7))
    expect(owner.line7AllocationEvidence.annualGrossAmount)
      .not.toBe(planDollarsToLedgerCents(year.rmd))

    // The denominator carries the same dollars, so line 9 is the 98,000 the
    // form computes rather than the 85,154.64 the hole used to leave.
    expect(owner.annualBasisRatio.denominatorMinorUnits)
      .toBe(planDollarsToLedgerCents(FORM_LINE_9))
    expect(owner.annualBasisRatio.denominatorMinorUnits)
      .not.toBe(planDollarsToLedgerCents(IRA_BALANCE - GIFT + year.rmd))

    // AND THE CONSEQUENCE, which is the part that outlives the year: the basis
    // handed to the next year is the form's 80,000.00 and not the 92,845.36
    // that `simulate.ts` used to write back into `iraBasisByOwner`.
    expect(owner.nextYearOpeningBasisAmount)
      .toBe(planDollarsToLedgerCents(FORM_BASIS_FORWARD))
    expect(owner.nextYearOpeningBasisAmount)
      .not.toBe(planDollarsToLedgerCents(IRA_BASIS - year.rmd))

    // No tax moves this year on either chain, because an excess year's fraction
    // is pinned at 1. The correction is entirely forward-looking.
    expect(year.magi).toBe(0)
  })

  // THE SAME SHAPE WITHOUT ANY ROUTED HALF, which is how the defect was known
  // to predate the gift-settlement slice: a 71-year-old donor has no
  // requirement, mints no overlay, was never refused with `qcdStageRequired`,
  // and settled the same wrong way. Kept so the scope claim stays checkable.
  it('reports it identically for a pre-RMD donor, which predated the slice', () => {
    const year = years(giftPlan('1955-01-01'))[0]!

    expect(year.rmd).toBe(0)
    expect(year.qcd).toBeCloseTo(GIFT, 6)
    expect(year.retirementRuntimeSource!.nonmovingLegacyQcdOverlay).toBeNull()
    expect(year.ownedNonRothIraAnnualReplay).toBeDefined()

    const owner = year.ownedNonRothIraAnnualReplay!
      .annualReplay.ownerReplays[0]!
    // Line 7 was empty here where the form asks for 18,000.00, so the whole
    // basis survived where the form retires 18,000 of it.
    expect(owner.line7AllocationEvidence.annualGrossAmount)
      .toBe(planDollarsToLedgerCents(FORM_LINE_7))
    expect(owner.line7AllocationEvidence.annualGrossAmount).not.toBe(0)
    expect(owner.annualBasisRatio.denominatorMinorUnits)
      .toBe(planDollarsToLedgerCents(FORM_LINE_9))
    expect(owner.nextYearOpeningBasisAmount)
      .toBe(planDollarsToLedgerCents(FORM_BASIS_FORWARD))
    expect(owner.nextYearOpeningBasisAmount)
      .not.toBe(planDollarsToLedgerCents(IRA_BASIS))
  })

  // THE DAMAGE THE YEAR USED TO HAND FORWARD, followed one year further. The
  // basis the settlement commits is what the NEXT year opens on, so a year that
  // overstates it hands a larger nontaxable share to every distribution after
  // it. This is the assertion that would have caught the defect without anyone
  // reading a Form 8606 line at all.
  it('opens the following year on the basis the form leaves', () => {
    const projected = years(giftPlan('1945-01-01'), TAX_YEAR + 1)

    expect(projected).toHaveLength(2)
    const nextYear = projected[1]!.ownedNonRothIraAnnualReplay!
      .annualReplay.ownerReplays[0]!
    // `planSeed` rather than `priorYearCarryforward` because the settlement
    // runs one year at a time: the carryforward is committed into
    // `iraBasisByOwner` and becomes the NEXT year's seed, which is exactly the
    // write-back path that made the replay's chain the authoritative one.
    expect(nextYear.openingBasisSource).toBe('planSeed')
    expect(nextYear.openingBasisAmount)
      .toBe(planDollarsToLedgerCents(FORM_BASIS_FORWARD))
    expect(nextYear.openingBasisAmount)
      .not.toBe(planDollarsToLedgerCents(IRA_BASIS - projected[0]!.rmd))
  })

  // THE INVISIBILITY CASE, because a fix that reached further than the statute
  // would be just as wrong. A gift inside the owner's aggregate includible
  // amount is a QCD in full: nothing about it belongs on line 7, every
  // characterization is zero, and the denominator is the pool less the gift.
  it('leaves a gift inside the aggregate includible amount wholly off line 7', () => {
    const plan = giftPlan('1955-01-01')
    plan.id = 'nonqualified-remainder-none'
    plan.accounts = [
      { ...(cashAccount('cash', 200_000) as Extract<Account, { type: 'cash' }>),
        annualReturnPct: 0 },
      ira(IRA_BALANCE, 10_000),
    ]

    const year = years(plan)[0]!
    const characterizations =
      year.retirementRuntimeSource!.legacyQcdCharacterizations
    const owner = year.ownedNonRothIraAnnualReplay!
      .annualReplay.ownerReplays[0]!

    expect(year.qcd).toBeCloseTo(GIFT, 6)
    expect(GIFT).toBeLessThan(IRA_BALANCE - 10_000)
    expect(characterizations).toHaveLength(1)
    expect(characterizations[0]!.nonQualifiedLine7GrossPlanDollars).toBe(0)
    expect(owner.line7AllocationEvidence.annualGrossAmount).toBe(0)
    expect(owner.annualBasisRatio.denominatorMinorUnits)
      .toBe(planDollarsToLedgerCents(IRA_BALANCE - GIFT))
    // The gift returned no basis, so the whole of it survives the year.
    expect(owner.nextYearOpeningBasisAmount)
      .toBe(planDollarsToLedgerCents(10_000))
  })
})
