/**
 * Stage-1 discriminating fixtures for approximated TY2026 annual-parameter
 * records (Louisiana and Oregon only). Accepted readings are hand-oracle values
 * from the primary gate worksheets; produced readings are immutable pre-fix
 * observations from the unchanged TY2026 pack, reproduced here as stale-pack
 * worksheet pins and not derived by running the calculator during authoring.
 *
 * Parameter cells, runtime code, and sibling settled records (for example
 * `or-stat-316-054-social-security-exclusion`) are intentionally untouched.
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
const LA_PRODUCED_TAX: Record<LaCoordKey, number> = {
  singleBase: 11.25,
  singleDollarAbove: 11.28,
  mfjBase: 22.5,
  single100k: 2_625,
  mfj100k: 2_250,
}

const LA_PRODUCED_TAXABLE: Record<LaCoordKey, number> = {
  singleBase: 375,
  singleDollarAbove: 376,
  mfjBase: 750,
  single100k: 87_500,
  mfj100k: 75_000,
}

describeRule('la-ldr-it540es-2026-standard-deduction', {
  readings: {
    it540EsTy2026StandardDeduction: LA_ACCEPTED_TAX,
    staleTy2025PackHeldForward: LA_PRODUCED_TAX,
  },
  accepted: 'it540EsTy2026StandardDeduction',
  produced: 'staleTy2025PackHeldForward',
}, ({ accepted, produced }) => {
  it('pins the CPI-indexed IT-540ESi deduction against the stale pack at boundary and 100k coordinates', () => {
    for (const coord of LA_COORDS) {
      const scenario = input({
        state: 'LA',
        filingStatus: coord.filingStatus,
        ordinaryIncome: coord.ordinaryIncome,
      })
      const tax = computeStateTax(pack('LA'), scenario)
      const taxable = computeStateTaxableIncome(pack('LA'), scenario)

      expect(tax).toBeCloseTo(produced[coord.key], 6)
      expect(tax).not.toBeCloseTo(accepted[coord.key], 6)
      expect(taxable).toBeCloseTo(LA_PRODUCED_TAXABLE[coord.key], 6)
      expect(taxable).not.toBeCloseTo(LA_ACCEPTED_TAXABLE[coord.key], 6)
    }
  })
})

type OrTaxCoordKey =
  | 'singleFirstBandCeiling'
  | 'singleSecondBandCeiling'
  | 'jointFirstBandCeiling'
  | 'jointSecondBandCeiling'

type OrDeltaCoordKey = 'single100kWholePackDelta' | 'mfj100kWholePackDelta'


type OrBaselineFilingStatus = 'single' | 'marriedFilingJointly'

type OrTaxCoord = {
  readonly key: OrTaxCoordKey
  readonly filingStatus: OrBaselineFilingStatus
  readonly ordinaryIncome: number
  readonly kind: 'tax'
}

type OrDeltaCoord = {
  readonly key: OrDeltaCoordKey
  readonly filingStatus: OrBaselineFilingStatus
  readonly ordinaryIncome: number
  readonly kind: 'delta'
}

type OrCoord = OrTaxCoord | OrDeltaCoord

const OR_COORDS: readonly OrCoord[] = [
  { key: 'singleFirstBandCeiling', filingStatus: 'single', ordinaryIncome: 7_460, kind: 'tax' },
  { key: 'singleSecondBandCeiling', filingStatus: 'single', ordinaryIncome: 14_310, kind: 'tax' },
  { key: 'jointFirstBandCeiling', filingStatus: 'marriedFilingJointly', ordinaryIncome: 14_920, kind: 'tax' },
  { key: 'jointSecondBandCeiling', filingStatus: 'marriedFilingJointly', ordinaryIncome: 28_620, kind: 'tax' },
  { key: 'single100kWholePackDelta', filingStatus: 'single', ordinaryIncome: 100_000, kind: 'delta' },
  { key: 'mfj100kWholePackDelta', filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, kind: 'delta' },
]

// LRO TY2026 continuous marginal worksheets at the gate's taxable coordinates.
const OR_ACCEPTED_TAX: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 216.125,
  singleSecondBandCeiling: 678.50,
  jointFirstBandCeiling: 432.25,
  jointSecondBandCeiling: 1_357.00,
}

const OR_ACCEPTED_TAXABLE: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 4_550,
  singleSecondBandCeiling: 11_400,
  jointFirstBandCeiling: 9_100,
  jointSecondBandCeiling: 22_800,
}

// Observed stale-pack receipt at the same pre-deduction coordinates.
const OR_PRODUCED_TAX: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 231.1875,
  singleSecondBandCeiling: 719.0625,
  jointFirstBandCeiling: 462.375,
  jointSecondBandCeiling: 1_438.125,
}

const OR_PRODUCED_TAXABLE: Record<OrTaxCoordKey, number> = {
  singleFirstBandCeiling: 4_625,
  singleSecondBandCeiling: 11_475,
  jointFirstBandCeiling: 9_250,
  jointSecondBandCeiling: 22_950,
}

const OR_OBSERVED_100K_TAX: Record<OrBaselineFilingStatus, number> = {
  single: 8_216.9375,
  marriedFilingJointly: 7_683.875,
}

describeRule('or-lro-2026-rate-schedule-and-standard-deduction', {
  readings: {
    lroTy2026ContinuousSchedule: {
      ...OR_ACCEPTED_TAX,
      single100kWholePackDelta: -40.5625,
      mfj100kWholePackDelta: -81.125,
    },
    staleTy2025PackHeldForward: {
      ...OR_PRODUCED_TAX,
      single100kWholePackDelta: 0,
      mfj100kWholePackDelta: 0,
    },
  },
  accepted: 'lroTy2026ContinuousSchedule',
  produced: 'staleTy2025PackHeldForward',
}, ({ accepted, produced }) => {
  it('pins LRO TY2026 continuous brackets and deductions against the stale pack', () => {
    for (const coord of OR_COORDS) {
      const scenario = input({
        state: 'OR',
        filingStatus: coord.filingStatus,
        ordinaryIncome: coord.ordinaryIncome,
      })

      if (coord.kind === 'tax') {
        const tax = computeStateTax(pack('OR'), scenario)
        const taxable = computeStateTaxableIncome(pack('OR'), scenario)

        expect(tax).toBeCloseTo(produced[coord.key], 6)
        expect(tax).not.toBeCloseTo(accepted[coord.key], 6)
        expect(taxable).toBeCloseTo(OR_PRODUCED_TAXABLE[coord.key], 6)
        expect(taxable).not.toBeCloseTo(OR_ACCEPTED_TAXABLE[coord.key], 6)
        continue
      }

      const observedBaseline = OR_OBSERVED_100K_TAX[coord.filingStatus]
      const delta = computeStateTax(pack('OR'), scenario) - observedBaseline
      expect(delta).toBeCloseTo(produced[coord.key], 6)
      expect(delta).not.toBeCloseTo(accepted[coord.key], 6)
    }
  })
})
