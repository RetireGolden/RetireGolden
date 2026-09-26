import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { applyCapitalLossCarryforward, computeFederalTax } from '../tax/federalTax.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  socialSecurityIncome,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput, YearResult } from './types.js'
import { premiumTaxCreditYear, taxFreeGainsRoom } from './yearFigures.js'

type Household = { pension: number; carryforward: number; socialSecurity: boolean }
type RoomRow = Pick<
  YearResult,
  'advisoryFederalTax' | 'capitalLossCarryforwardRemaining' | 'capitalLossUsedAgainstOrdinary' | 'capitalLossUsedAgainstGains'
>

/**
 * The worksheet's constructed 2026 single filers: one uninflated recurring
 * pension, one zero-return 1,000 cash account, the carryforward entering 2026,
 * and for D a PIA of 2,500 claimed at 66 years 10 months by a person born
 * 1959-06-15 (67 in 2026, so the 65-and-over additions apply). The others are
 * 63, so the base deduction.
 */
function householdRow(h: Household): YearResult {
  const plan = singlePersonPlan({ dob: h.socialSecurity ? '1959-06-15' : '1963-01-01', planningAge: 95 })
  plan.accounts = [cashAccount('cash', 1_000)]
  plan.incomes = [recurringOrdinaryIncome('pension', h.pension)]
  if (h.socialSecurity) {
    const benefit = socialSecurityIncome('ss', 2_500, 66)
    if (benefit.type === 'socialSecurity') benefit.claimAge = { years: 66, months: 10 }
    plan.incomes.push(benefit)
  }
  plan.household.capitalLossCarryforward = h.carryforward
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: productionTaxCalculator(),
  })
  return result.years[0]!
}

/** A function-level row: the advisory input and the published netting, nothing else. */
function inputRow(input: TaxYearInput, usedAgainstGains = 0, usedAgainstOrdinary = 0, remaining = 0): RoomRow {
  return {
    advisoryFederalTax: { input, detail: computeFederalTax(input) },
    capitalLossUsedAgainstGains: usedAgainstGains,
    capitalLossUsedAgainstOrdinary: usedAgainstOrdinary,
    capitalLossCarryforwardRemaining: remaining,
  }
}

/** F(g) - F(0): the year's federal tax with g of extra long-term gain netted through the pool, less the tax without it. */
function extraTax(row: RoomRow, extra: number): number {
  const input = row.advisoryFederalTax!.input
  const realized = input.realizedCapitalGainsBeforeCarryforward ?? 0
  const pool = row.capitalLossCarryforwardRemaining + row.capitalLossUsedAgainstOrdinary + row.capitalLossUsedAgainstGains - Math.max(0, -realized)
  const at = (g: number) => {
    const netting = applyCapitalLossCarryforward(pool, input.ordinaryIncome, realized + g, 3_000)
    return computeFederalTax({ ...input, capitalGains: netting.netCapitalGain, realizedCapitalGainsBeforeCarryforward: realized + g }).totalTax
  }
  return at(extra) - at(0)
}

const single2026 = (fields: Partial<TaxYearInput>): TaxYearInput => ({
  year: 2026,
  filingStatus: 'single',
  ordinaryIncome: 0,
  capitalGains: 0,
  realizedCapitalGainsBeforeCarryforward: 0,
  ssBenefits: 0,
  peopleAged65Plus: 0,
  ...fields,
})

describeCalculation(
  'display-tax-free-gains-room-annual',
  {
    example: {
      inputs: {
        A: { pension: 40_000, carryforward: 10_000, socialSecurity: false },
        B: { pension: 17_600, carryforward: 10_000, socialSecurity: false },
        C: { pension: 10_000, carryforward: 10_000, socialSecurity: false },
        D: { pension: 10_000, carryforward: 0, socialSecurity: true },
        E: { pension: 40_000, carryforward: 0, socialSecurity: false },
        G: { ordinaryIncome: 40_000, pool: 10_000, ownGain: 4_000 },
        H: { ordinaryIncome: 40_000, pool: 10_000, ownGain: -2_000 },
        niit: { year: 2060, inflationScale: 3, peopleAged65Plus: 1 },
        seniorPhaseOut: { year: 2027, ordinaryIncome: 20_500, ownGain: 11_241.03, inflationScale: 1.025, peopleAged65Plus: 1 },
        bracketBelow: 0.01,
        bracketAbove: 0.0001,
      },
      expected: {
        A: 7_000,
        B: 8_500,
        C: 65_550,
        D: Number('20352.941176470588'),
        E: 25_550,
        G: 3_000,
        H: 9_000,
        niit: 200_000,
        seniorPhaseOut: Number('43532.554905660377'),
        remainingA: 7_000,
        remainingB: 7_000,
        remainingC: 7_000,
        marginalA: 0.12,
        marginalB: 0.1,
        marginalC: 0.15,
        marginalD: 0.085,
        marginalE: 0.15,
        retiredSumA: 35_550,
        retiredSumACost: 360,
        retiredSumD: 38_100,
        retiredSumDCost: 1_135,
        retiredSumG: 31_550,
        retiredSumH: 37_550,
        reconClosedFormB: 7_000,
        reconClosedFormC: 10_000,
        niitZeroBandRoom: 202_800,
        niitZeroBandRoomCost: 106.4,
        seniorZeroBandRoom: 43_548.97,
        seniorZeroBandRoomCost: 2.61,
      },
      tolerance: { abs: 0.01 },
    },
    worksheet: 'DOCS/calculations/taxes/display-tax-free-gains-room-annual.md',
    mutation: 'DOCS/calculations/taxes/display-tax-free-gains-room-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>
    const below = inputs.bracketBelow as number
    const above = inputs.bracketAbove as number
    const inBracket = (value: number | null, root: number, label: string) => {
      expect(value, label).not.toBeNull()
      expect(value!, `${label}: ${value} is below ${root} - ${below}`).toBeGreaterThanOrEqual(root - below)
      expect(value!, `${label}: ${value} is above ${root} + ${above}`).toBeLessThanOrEqual(root + above)
    }

    for (const key of ['A', 'B', 'C', 'D', 'E'] as const) {
      it(`household ${key}: the room at no extra federal tax, and the segment ends`, () => {
        const row = householdRow(inputs[key] as Household)
        const room = taxFreeGainsRoom(row)
        inBracket(room, expected[key]!, key)
        // One dollar past the room tax rises at the worksheet's marginal rate.
        expect(extraTax(row, expected[key]! + 1)).toBeCloseTo(expected[`marginal${key}`]!, 9)
        if (key === 'A' || key === 'B' || key === 'C') {
          // The remaining carryforward absorbs gains with no change at all.
          expect(row.capitalLossCarryforwardRemaining).toBe(expected[`remaining${key}`])
          expect(extraTax(row, row.capitalLossCarryforwardRemaining)).toBe(0)
        }
        if (key === 'D') expect(row.incomes.socialSecurity).toBe(30_000)
      })
    }

    it('shows what the retired figure cost: the 0% band room plus the carryforward is not tax-free', () => {
      const a = householdRow(inputs.A as Household)
      expect(a.ltcgZeroHeadroom + a.capitalLossCarryforwardRemaining).toBeCloseTo(expected.retiredSumA!, 1)
      expect(extraTax(a, expected.retiredSumA!)).toBeCloseTo(expected.retiredSumACost!, 6)
      const d = householdRow(inputs.D as Household)
      expect(d.ltcgZeroHeadroom + d.capitalLossCarryforwardRemaining).toBeCloseTo(expected.retiredSumD!, 1)
      expect(extraTax(d, expected.retiredSumD!)).toBeCloseTo(expected.retiredSumDCost!, 6)
      // With no carryforward and no benefits the two agree (household E).
      const e = householdRow(inputs.E as Household)
      expect(Math.abs(taxFreeGainsRoom(e)! - e.ltcgZeroHeadroom)).toBeLessThan(0.02)
      // The recon check's closed form is wrong for B and C.
      const b = householdRow(inputs.B as Household)
      const c = householdRow(inputs.C as Household)
      expect(Math.abs(taxFreeGainsRoom(b)! - expected.reconClosedFormB!)).toBeGreaterThan(1_000)
      expect(Math.abs(taxFreeGainsRoom(c)! - expected.reconClosedFormC!)).toBeGreaterThan(1_000)
    })

    it('nets the extra gain through the pool when the year has a gain or a loss of its own (G, H)', () => {
      const g = inputs.G as { ordinaryIncome: number; pool: number; ownGain: number }
      const h = inputs.H as { ordinaryIncome: number; pool: number; ownGain: number }
      const gNet = applyCapitalLossCarryforward(g.pool, g.ordinaryIncome, g.ownGain, 3_000)
      const gRow = inputRow(single2026({ ordinaryIncome: g.ordinaryIncome, capitalGains: gNet.netCapitalGain, realizedCapitalGainsBeforeCarryforward: g.ownGain }), gNet.usedAgainstGains, gNet.usedAgainstOrdinary, gNet.remaining)
      inBracket(taxFreeGainsRoom(gRow), expected.G!, 'G')
      expect(extraTax(gRow, expected.retiredSumG!)).toBeCloseTo(expected.retiredSumACost!, 6)
      const hNet = applyCapitalLossCarryforward(h.pool, h.ordinaryIncome, h.ownGain, 3_000)
      const hRow = inputRow(single2026({ ordinaryIncome: h.ordinaryIncome, capitalGains: hNet.netCapitalGain, realizedCapitalGainsBeforeCarryforward: h.ownGain }), hNet.usedAgainstGains, hNet.usedAgainstOrdinary, hNet.remaining)
      inBracket(taxFreeGainsRoom(hRow), expected.H!, 'H')
      expect(extraTax(hRow, expected.retiredSumH!)).toBeCloseTo(expected.retiredSumACost!, 6)
      // Adding the extra gain to the already-netted gain, without the pool,
      // spends the $3,000 deduction first: household A would read 0.
      const a = householdRow(inputs.A as Household)
      const unnetted = (extra: number) =>
        computeFederalTax({ ...a.advisoryFederalTax!.input, capitalGains: a.advisoryFederalTax!.input.capitalGains + extra }).totalTax -
        computeFederalTax(a.advisoryFederalTax!.input).totalTax
      expect(unnetted(1)).toBeGreaterThan(0)
    })

    it('stops at the unindexed NIIT threshold, inside the indexed 0% band (2060)', () => {
      const n = inputs.niit as { year: number; inflationScale: number; peopleAged65Plus: number }
      const row = inputRow(single2026({ year: n.year, inflationScale: n.inflationScale, peopleAged65Plus: n.peopleAged65Plus }))
      inBracket(taxFreeGainsRoom(row), expected.niit!, 'NIIT')
      expect(row.advisoryFederalTax!.detail.zeroRateLtcgHeadroom).toBeCloseTo(expected.niitZeroBandRoom!, 1)
      expect(extraTax(row, expected.niitZeroBandRoom!)).toBeCloseTo(expected.niitZeroBandRoomCost!, 6)
    })

    it('stops where the senior-deduction phase-out starts to cost tax (2027)', () => {
      const s = inputs.seniorPhaseOut as { year: number; ordinaryIncome: number; ownGain: number; inflationScale: number; peopleAged65Plus: number }
      const row = inputRow(single2026({
        year: s.year,
        ordinaryIncome: s.ordinaryIncome,
        capitalGains: s.ownGain,
        realizedCapitalGainsBeforeCarryforward: s.ownGain,
        inflationScale: s.inflationScale,
        peopleAged65Plus: s.peopleAged65Plus,
      }))
      inBracket(taxFreeGainsRoom(row), expected.seniorPhaseOut!, 'senior phase-out')
      expect(row.advisoryFederalTax!.detail.zeroRateLtcgHeadroom).toBeCloseTo(expected.seniorZeroBandRoom!, 1)
      expect(extraTax(row, expected.seniorZeroBandRoom!)).toBeCloseTo(expected.seniorZeroBandRoomCost!, 6)
    })

    it('publishes null, not a guess, when the row carries no advisory input', () => {
      const a = householdRow(inputs.A as Household)
      expect(taxFreeGainsRoom({ ...a, advisoryFederalTax: undefined })).toBeNull()
      // A hand-built input that omits the gain before netting cannot rebuild the pool in a carryforward year.
      const input: TaxYearInput = { ...a.advisoryFederalTax!.input }
      delete input.realizedCapitalGainsBeforeCarryforward
      expect(taxFreeGainsRoom({ ...a, advisoryFederalTax: { input, detail: a.advisoryFederalTax!.detail } })).toBeNull()
    })

    it('marks the years with a modeled ACA premium credit', () => {
      expect(premiumTaxCreditYear({})).toBe(false)
      const aca = (modeledAllowablePtc: number | null) => ({ aca: { modeledAllowablePtc } as unknown as NonNullable<YearResult['aca']> })
      expect(premiumTaxCreditYear(aca(null))).toBe(false)
      expect(premiumTaxCreditYear(aca(0))).toBe(false)
      expect(premiumTaxCreditYear(aca(1_200))).toBe(true)
    })
  },
)
