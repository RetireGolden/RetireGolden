import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { acaApplicablePct, acaFederalPovertyLine } from '../tax/aca.js'
import {
  ACA_COVERAGE_YEARS,
  EARLIEST_ACA_COVERAGE_YEAR,
  LATEST_ACA_COVERAGE_YEAR,
  acaCoverageYear2026,
  acaParametersForCoverageYear,
} from './acaCoverageYears.js'
import { EARLIEST_PACK_YEAR, LATEST_PACK_YEAR, packForYear } from './index.js'
import { year2026 } from './data/year2026.js'

const block2026 = acaParametersForCoverageYear(2026).params
const block2027 = acaParametersForCoverageYear(2027).params

describe('acaParametersForCoverageYear', () => {
  it('returns each published coverage year exactly and flags every other year as a stand-in', () => {
    expect(ACA_COVERAGE_YEARS.map((block) => block.coverageYear)).toEqual([2026, 2027])
    expect(EARLIEST_ACA_COVERAGE_YEAR).toBe(2026)
    expect(LATEST_ACA_COVERAGE_YEAR).toBe(2027)
    expect(acaParametersForCoverageYear(2026)).toEqual({ params: block2026, isStandIn: false })
    expect(acaParametersForCoverageYear(2027)).toEqual({ params: block2027, isStandIn: false })
    // After the latest block: the latest stands in, and the year is not priced.
    expect(acaParametersForCoverageYear(2028)).toEqual({ params: block2027, isStandIn: true })
    expect(acaParametersForCoverageYear(2040).isStandIn).toBe(true)
    // Before the earliest: the earliest stands in.
    expect(acaParametersForCoverageYear(2025)).toEqual({ params: block2026, isStandIn: true })
  })

  it('carries the guidelines of the year before each coverage year', () => {
    // 26 CFR 1.36B-1(h): the guidelines in effect when the year's open
    // enrollment begins, which is the HHS notice of January of the year before.
    for (const block of ACA_COVERAGE_YEARS) {
      expect(block.povertyGuidelineYear, `${block.coverageYear}`).toBe(block.coverageYear - 1)
    }
  })

  it('holds each published block\'s tables to the notices they come from: first person plus a fixed amount per added person', () => {
    // Eight-person rows printed by the notices (90 FR 5917; 91 FR 1797-1798):
    // the two numbers a block carries must reproduce them exactly.
    const printedEightPerson = {
      2026: { contiguous: 54_150, alaska: 67_710, hawaii: 62_300 },
      2027: { contiguous: 55_720, alaska: 69_650, hawaii: 64_070 },
    } as const
    for (const block of ACA_COVERAGE_YEARS) {
      const printed = printedEightPerson[block.coverageYear as 2026 | 2027]
      for (const region of ['contiguous', 'alaska', 'hawaii'] as const) {
        expect(acaFederalPovertyLine(block, 8, region), `${block.coverageYear} ${region}`).toBe(printed[region])
      }
    }
  })

  it('keeps every table in the shape the engine interpolates: a step at 133 and bands that open where the last one closed', () => {
    for (const block of ACA_COVERAGE_YEARS) {
      const points = block.aca.applicablePctBreakpoints
      expect(points.map((point) => point.fplPct)).toEqual([133, 150, 200, 250, 300, 400])
      expect(block.aca.minFplPctForCredit).toBe(100)
      expect(block.aca.maxFplPctForCredit).toBe(400)
      // The only discontinuity is at 133%: below it the flat rate, at it the
      // opening rate of the 133 to 150 band.
      expect(points[0]!.applicablePct).toBeGreaterThan(block.aca.applicablePctBelowFirstBreakpoint)
      // Flat from 300 to 400.
      expect(points[5]!.applicablePct).toBe(points[4]!.applicablePct)
    }
  })

  it('is the single source of every published pack\'s ACA figures, including a future full pack', () => {
    // Every income-tax pack year with its own pack must reference its own
    // coverage year's block object rather than repeat the numbers, so a
    // year2027 pack added in the fall cannot drift from the 2027 block.
    for (let year = EARLIEST_PACK_YEAR; year <= LATEST_PACK_YEAR; year++) {
      const { pack, isStandIn } = packForYear(year)
      if (isStandIn) continue
      const coverage = acaParametersForCoverageYear(year)
      expect(coverage.isStandIn, `pack ${year} has no published ACA block`).toBe(false)
      expect(pack.aca, `pack ${year}.aca must be the ${year} block's object`).toBe(coverage.params.aca)
      expect(
        pack.federalPovertyLine,
        `pack ${year}.federalPovertyLine must be the ${year} block's object`,
      ).toBe(coverage.params.federalPovertyLine)
    }
    expect(year2026.aca).toBe(acaCoverageYear2026.aca)
    expect(year2026.federalPovertyLine).toBe(acaCoverageYear2026.federalPovertyLine)
  })
})

describe('ACA coverage-year rule records', () => {
  // 175% of the poverty line is the midpoint of the 150 to 200 band:
  // 2027: 4.30 + 0.5 x (6.78 - 4.30) = 5.54; the 2026 table carried forward:
  // 4.19 + 0.5 x (6.60 - 4.19) = 5.395.
  describeRule('rev-proc-2026-26-aca-applicable-percentage-2027', {
    readings: { revProc2026Dash26: 5.54, revProc2025Dash25CarriedForward: 5.395 },
    accepted: 'revProc2026Dash26',
    note: 'Applicable percentage at 175% of the poverty line for 2027 coverage.',
  }, ({ accepted, readings }) => {
    it('prices 2027 on the Rev. Proc. 2026-26 table, not the 2026 one', () => {
      expect(acaApplicablePct(block2027, 175)).toBeCloseTo(accepted, 6)
      expect(acaApplicablePct(block2027, 175)).not.toBeCloseTo(readings.revProc2025Dash25CarriedForward, 2)
    })

    it('matches every 2027 band endpoint and the step at exactly 133%', () => {
      expect(acaApplicablePct(block2027, 132.999)).toBeCloseTo(2.15, 6)
      expect(acaApplicablePct(block2027, 133)).toBeCloseTo(3.23, 6)
      expect(acaApplicablePct(block2027, 150)).toBeCloseTo(4.3, 6)
      expect(acaApplicablePct(block2027, 200)).toBeCloseTo(6.78, 6)
      expect(acaApplicablePct(block2027, 250)).toBeCloseTo(8.66, 6)
      expect(acaApplicablePct(block2027, 300)).toBeCloseTo(10.22, 6)
      expect(acaApplicablePct(block2027, 400)).toBeCloseTo(10.22, 6)
    })
  })

  // A Hawaii family of three in 2027: 18,360 + 2 x 6,530 = 31,420. The 2025
  // guidelines give 17,990 + 2 x 6,330 = 30,650; counting every member at
  // the first-person figure gives 3 x 18,360 = 55,080.
  describeRule('hhs-2026-poverty-guidelines-2027-coverage', {
    readings: { hhs2026Guidelines: 31_420, hhs2025Guidelines: 30_650, firstPersonTimesSize: 55_080 },
    accepted: 'hhs2026Guidelines',
    note: 'Poverty line for a Hawaii tax family of three in the 2027 coverage year.',
  }, ({ accepted, readings }) => {
    it('reads the HHS 2026 Hawaii table for 2027 coverage', () => {
      expect(acaFederalPovertyLine(block2027, 3, 'hawaii')).toBe(accepted)
      expect(acaFederalPovertyLine(block2027, 3, 'hawaii')).not.toBe(readings.hhs2025Guidelines)
      expect(acaFederalPovertyLine(block2027, 3, 'hawaii')).not.toBe(readings.firstPersonTimesSize)
    })
  })

  // A two-person Alaska tax family in 2026: 19,550 + 6,880 = 26,430. The
  // guidelines published in January 2026 would give 19,950 + 7,100 = 27,050.
  describeRule('hhs-2025-poverty-guidelines-2026-coverage', {
    readings: { hhs2025Guidelines: 26_430, hhs2026GuidelinesOfTheCalendarYear: 27_050 },
    accepted: 'hhs2025Guidelines',
    note: 'Poverty line for a two-person Alaska tax family in the 2026 coverage year.',
  }, ({ accepted, readings }) => {
    it('reads the HHS 2025 Alaska table for 2026 coverage', () => {
      expect(acaFederalPovertyLine(block2026, 2, 'alaska')).toBe(accepted)
      expect(acaFederalPovertyLine(block2026, 2, 'alaska')).not.toBe(readings.hhs2026GuidelinesOfTheCalendarYear)
    })
  })
})
