/**
 * Post-parameter-fix discriminating fixtures for TY2026 annual-parameter records
 * (Louisiana and Oregon only). Accepted readings are hand-oracle values from the
 * primary gate worksheets; stale-pack readings are immutable pre-fix observations
 * from the Main-observed characterization receipt and are not derived by running
 * the calculator during authoring.
 *
 * Runtime functions and sibling records remain unchanged; these tests exercise
 * the current parameter pack. Pre-fix values were captured in the Main-observed
 * immutable characterization receipt.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { stateParamsFor } from '../params/state/index.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTax, computeStateTaxableIncome } from './stateTax.js'

const TAX_YEAR = 2026

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

type LaCoordKey =
  | 'singleBase'
  | 'singleDollarAbove'
  | 'mfjBase'
  | 'single100k'
  | 'mfj100k'

const LA_COORDS: readonly {
  key: LaCoordKey
  filingStatus: TaxYearInput['filingStatus']
  ordinaryIncome: number
}[] = [
  { key: 'singleBase', filingStatus: 'single', ordinaryIncome: 12_875 },
  { key: 'singleDollarAbove', filingStatus: 'single', ordinaryIncome: 12_876 },
  { key: 'mfjBase', filingStatus: 'marriedFilingJointly', ordinaryIncome: 25_750 },
  { key: 'single100k', filingStatus: 'single', ordinaryIncome: 100_000 },
  { key: 'mfj100k', filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000 },
]

// IT-540ESi TY2026 gate worksheets: 3% flat rate on (income − authorized deduction).
const LA_ACCEPTED_TAX: Record<LaCoordKey, number> = {
  singleBase: 0,
  singleDollarAbove: 0.03,
  mfjBase: 0,
  single100k: 2_613.75,
  mfj100k: 2_227.50,
}

const LA_ACCEPTED_TAXABLE: Record<LaCoordKey, number> = {
  singleBase: 0,
  singleDollarAbove: 1,
  mfjBase: 0,
  single100k: 87_125,
  mfj100k: 74_250,
}

// Observed stale-pack receipt (before param refresh).
const LA_STALE_TAX: Record<LaCoordKey, number> = {
  singleBase: 11.25,
  singleDollarAbove: 11.28,
  mfjBase: 22.5,
  single100k: 2_625,
  mfj100k: 2_250,
}

const LA_STALE_TAXABLE: Record<LaCoordKey, number> = {
  singleBase: 375,
  singleDollarAbove: 376,
  mfjBase: 750,
  single100k: 87_500,
  mfj100k: 75_000,
}

describeRule('la-ldr-it540es-2026-standard-deduction', {
  readings: {
    it540EsTy2026StandardDeduction: LA_ACCEPTED_TAX,
    staleTy2025PackHeldForward: LA_STALE_TAX,
  },
  accepted: 'it540EsTy2026StandardDeduction',
}, ({ accepted, readings }) => {
  it('pins the CPI-indexed IT-540ESi deduction at boundary and 100k coordinates', () => {
    for (const coord of LA_COORDS) {
      const scenario = input({
        state: 'LA',
        filingStatus: coord.filingStatus,
        ordinaryIncome: coord.ordinaryIncome,
      })
      const tax = computeStateTax(pack('LA'), scenario)
      const taxable = computeStateTaxableIncome(pack('LA'), scenario)

      expect(tax).toBeCloseTo(accepted[coord.key], 6)
      expect(taxable).toBeCloseTo(LA_ACCEPTED_TAXABLE[coord.key], 6)
      expect(tax).not.toBeCloseTo(readings.staleTy2025PackHeldForward[coord.key], 6)
      expect(taxable).not.toBeCloseTo(LA_STALE_TAXABLE[coord.key], 6)
    }
  })
})

type OrTaxCoordKey =
  | 'singleFirstBandCeiling'
  | 'singleSecondBandCeiling'
  | 'jointFirstBandCeiling'
  | 'jointSecondBandCeiling'

type OrBaselineFilingStatus = 'single' | 'marriedFilingJointly'

const OR_TAX_COORDS: readonly {
  key: OrTaxCoordKey
  filingStatus: OrBaselineFilingStatus
  ordinaryIncome: number
}[] = [
  { key: 'singleFirstBandCeiling', filingStatus: 'single', ordinaryIncome: 7_460 },
  { key: 'singleSecondBandCeiling', filingStatus: 'single', ordinaryIncome: 14_310 },
  { key: 'jointFirstBandCeiling', filingStatus: 'marriedFilingJointly', ordinaryIncome: 14_920 },
  { key: 'jointSecondBandCeiling', filingStatus: 'marriedFilingJointly', ordinaryIncome: 28_620 },
]

// LRO TY2026 printed whole-dollar base taxes at the gate's boundary taxable coordinates.
const OR_LRO_PRINTED_TAX: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 216,
  singleSecondBandCeiling: 679,
  jointFirstBandCeiling: 432,
  jointSecondBandCeiling: 1_357,
}

// Continuous marginal engine output after the TY2026 pack refresh.
const OR_CONTINUOUS_TAX: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 216.125,
  singleSecondBandCeiling: 678.5,
  jointFirstBandCeiling: 432.25,
  jointSecondBandCeiling: 1_357,
}

// Signed gap (produced − LRO printed) at each boundary coordinate.
const OR_SIGNED_GAPS: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 0.125,
  singleSecondBandCeiling: -0.5,
  jointFirstBandCeiling: 0.25,
  jointSecondBandCeiling: 0,
}

// Observed stale-pack receipt at the same pre-deduction coordinates.
const OR_STALE_TAX: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 231.1875,
  singleSecondBandCeiling: 719.0625,
  jointFirstBandCeiling: 462.375,
  jointSecondBandCeiling: 1_438.125,
}

const OR_CONTINUOUS_TAXABLE: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 4_550,
  singleSecondBandCeiling: 11_400,
  jointFirstBandCeiling: 9_100,
  jointSecondBandCeiling: 22_800,
}

const OR_STALE_TAXABLE: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 4_625,
  singleSecondBandCeiling: 11_475,
  jointFirstBandCeiling: 9_250,
  jointSecondBandCeiling: 22_950,
}

const OR_100K_BEFORE: Record<OrBaselineFilingStatus, number> = {
  single: 8_216.9375,
  marriedFilingJointly: 7_683.875,
}

const OR_100K_AFTER: Record<OrBaselineFilingStatus, number> = {
  single: 8_176.375,
  marriedFilingJointly: 7_602.75,
}

describeRule('or-lro-2026-rate-schedule-and-standard-deduction', {
  readings: {
    lroPrintedWholeDollarBoundaries: OR_LRO_PRINTED_TAX,
    continuousMarginalEngine: OR_CONTINUOUS_TAX,
    staleTy2025PackHeldForward: OR_STALE_TAX,
  },
  accepted: 'lroPrintedWholeDollarBoundaries',
  produced: 'continuousMarginalEngine',
}, ({ accepted, produced, readings }) => {
  it('pins LRO TY2026 continuous schedule against printed whole-dollar and stale-pack witnesses', () => {
    for (const coord of OR_TAX_COORDS) {
      const scenario = input({
        state: 'OR',
        filingStatus: coord.filingStatus,
        ordinaryIncome: coord.ordinaryIncome,
      })
      const tax = computeStateTax(pack('OR'), scenario)
      const taxable = computeStateTaxableIncome(pack('OR'), scenario)

      expect(tax).toBeCloseTo(produced[coord.key], 6)
      expect(tax).toBeCloseTo(accepted[coord.key] + OR_SIGNED_GAPS[coord.key], 6)
      expect(tax - accepted[coord.key]).toBeCloseTo(OR_SIGNED_GAPS[coord.key], 6)
      expect(taxable).toBeCloseTo(OR_CONTINUOUS_TAXABLE[coord.key], 6)
      expect(taxable).not.toBeCloseTo(OR_STALE_TAXABLE[coord.key], 6)
      expect(tax).not.toBeCloseTo(readings.staleTy2025PackHeldForward[coord.key], 6)
    }

    for (const filingStatus of ['single', 'marriedFilingJointly'] as const) {
      const tax = computeStateTax(
        pack('OR'),
        input({ state: 'OR', filingStatus, ordinaryIncome: 100_000 }),
      )
      expect(tax).toBeCloseTo(OR_100K_AFTER[filingStatus], 6)
      expect(tax).not.toBeCloseTo(OR_100K_BEFORE[filingStatus], 6)
    }
  })
})
