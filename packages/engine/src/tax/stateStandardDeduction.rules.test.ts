/**
 * Discriminating fixture for Maine §5124-C(2) standard-deduction phase-out.
 *
 * Independent worksheet (36 M.R.S. §5124-C(1-B)+(2); MRS 2026 phase-out
 * worksheet rev. Dec 2025; MRS 2026 rate schedule rev. May 20, 2026).
 * Modeled pack taxable-income / tax component only — personal exemption
 * omitted, so these are not Form 1040ME liabilities.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { packForYear } from '../params/index.js'
import { conformStateStandardDeduction, stateParamsFor } from '../params/state/index.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { phaseOutStandardDeduction } from './stateStandardDeduction.js'
import { computeStateTaxableIncome, computeStateTaxYearTotal } from './stateTax.js'

const TAX_YEAR = 2026
const RAW_SINGLE_65 = 15_700 + 2_050

type CoordKey =
  | 'single65Low'
  | 'single65JustAboveStart'
  | 'single65Half'
  | 'single65Full'
  | 'mfjTwo65Half'
  | 'halfYearHalf'

type Coord = {
  key: CoordKey
  ordinaryIncome: number
  filingStatus?: TaxYearInput['filingStatus']
  peopleAged65Plus: number
  agesAlive: number[]
  stateResidency?: TaxYearInput['stateResidency']
  tax?: boolean
}

const COORDS: Coord[] = [
  { key: 'single65Low', ordinaryIncome: 30_000, peopleAged65Plus: 1, agesAlive: [65] },
  { key: 'single65JustAboveStart', ordinaryIncome: 102_251, peopleAged65Plus: 1, agesAlive: [65] },
  { key: 'single65Half', ordinaryIncome: 139_750, peopleAged65Plus: 1, agesAlive: [65] },
  { key: 'single65Full', ordinaryIncome: 177_250, peopleAged65Plus: 1, agesAlive: [65] },
  {
    key: 'mfjTwo65Half',
    ordinaryIncome: 279_550,
    filingStatus: 'marriedFilingJointly',
    peopleAged65Plus: 2,
    agesAlive: [65, 65],
  },
  {
    key: 'halfYearHalf',
    ordinaryIncome: 139_750,
    peopleAged65Plus: 1,
    agesAlive: [65],
    stateResidency: [{ state: 'ME', months: 6 }],
    tax: true,
  },
]

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    inflationScale: 1,
    ...over,
  }
}

function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

function resolved(params: StateTaxParams): StateTaxParams {
  const { pack: yearPack } = packForYear(TAX_YEAR)
  return conformStateStandardDeduction(params, yearPack.federalTax.age65Addition, 1)
}

function scenarioFromCoord(coord: Coord): TaxYearInput {
  return input({
    state: 'ME',
    ordinaryIncome: coord.ordinaryIncome,
    filingStatus: coord.filingStatus ?? 'single',
    peopleAged65Plus: coord.peopleAged65Plus,
    agesAlive: coord.agesAlive,
    stateResidency: coord.stateResidency,
  })
}

function runCoord(
  params: StateTaxParams,
  coord: Coord,
  mapParams?: (params: StateTaxParams) => StateTaxParams,
): number {
  const scen = scenarioFromCoord(coord)
  if (coord.tax) {
    return computeStateTaxYearTotal(scen, mapParams ? { mapParams } : {})
  }
  return computeStateTaxableIncome(mapParams ? mapParams(params) : params, scen)
}

function expectVector(
  params: StateTaxParams,
  expected: Record<CoordKey, number>,
  mapParams?: (params: StateTaxParams) => StateTaxParams,
): void {
  for (const coord of COORDS) {
    expect(runCoord(params, coord, mapParams)).toBeCloseTo(expected[coord.key], 6)
  }
}

describeRule('mrs-36-5124-c-2-standard-deduction-phaseout', {
  readings: {
    proportionalPhaseout: {
      single65Low: 12_250,
      single65JustAboveStart: 84_501 + RAW_SINGLE_65 / 75_000,
      single65Half: 130_875,
      single65Full: 177_250,
      mfjTwo65Half: 262_200,
      halfYearHalf: 4_418.93125,
    },
    noPhaseout: {
      single65Low: 12_250,
      single65JustAboveStart: 84_501,
      single65Half: 122_000,
      single65Full: 159_500,
      mfjTwo65Half: 244_850,
      halfYearHalf: 4_101.65,
    },
    fullThresholdCliff: {
      single65Low: 12_250,
      single65JustAboveStart: 84_501,
      single65Half: 122_000,
      single65Full: 177_250,
      mfjTwo65Half: 244_850,
      halfYearHalf: 4_101.65,
    },
  },
  accepted: 'proportionalPhaseout',
}, ({ accepted, readings }) => {
  it('phases out the total Maine standard deduction proportionally above the published start', () => {
    const meResolved = resolved(pack('ME'))

    expectVector(meResolved, accepted)

    // Exact-ratio worksheet fraction at the first dollar above the start:
    // allowed = 17,750 − 17,750 / 75,000 (not a four-decimal 0.0000 fraction).
    expect(
      phaseOutStandardDeduction(RAW_SINGLE_65, 102_251, 102_250, 75_000),
    ).toBeCloseTo(RAW_SINGLE_65 - RAW_SINGLE_65 / 75_000, 10)

    expectVector(
      meResolved,
      readings.noPhaseout,
      (params) => ({ ...params, standardDeductionPhaseout: undefined }),
    )

    expectVector(meResolved, readings.fullThresholdCliff, (params) => ({
      ...params,
      standardDeductionPhaseout: {
        startsAt: { single: 177_249, marriedFilingJointly: 354_549 },
        range: { single: 1, marriedFilingJointly: 1 },
      },
    }))

    expect(accepted.single65Half).not.toBe(readings.noPhaseout.single65Half)
    expect(accepted.single65Half).not.toBe(readings.fullThresholdCliff.single65Half)
    expect(accepted.single65Full).not.toBe(readings.noPhaseout.single65Full)
    expect(accepted.mfjTwo65Half).not.toBe(readings.noPhaseout.mfjTwo65Half)
    expect(accepted.halfYearHalf).not.toBe(readings.noPhaseout.halfYearHalf)
  })
})
