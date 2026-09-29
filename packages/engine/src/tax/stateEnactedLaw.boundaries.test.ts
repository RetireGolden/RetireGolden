/**
 * Boundaries and values of the provisions loaded with the survey of every
 * state's enacted law, each at the edge the statute draws. Written for the
 * test gaps the round-three review of decision D-2027-PUBLISHED-FIGURES found
 * by mutation (its F8): every assertion below fails if the edge moves.
 */
import { describe, expect, it } from 'vitest'

import { stateParamsFor } from '../params/state/index.js'
import type { TaxYearInput } from '../projection/types.js'
import {
  californiaMilitaryExclusions,
  marylandCapitalGainSurtax,
  marylandPublicSafetySubtraction,
  rhodeIslandSocialSecurityModification,
} from './stateEnactedLaw.js'
import type { StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { computeStateTaxYearResult } from './stateTax.js'

const fact = (change: Partial<StateRetirementDistributionFact>): StateRetirementDistributionFact => ({
  accountId: 'pension', ownerPersonId: 'owner', sourceKind: 'stateLocalPublic',
  federallyIncludedAmount: 30_000, grossDistribution: 30_000, recipientAgeYears: 60,
  recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false', ...change,
})

/** State tax on an amount of state taxable income (the deduction set to zero). */
function onTaxable(state: string, year: number, taxable: number, status: 'single' | 'marriedFilingJointly' | 'headOfHousehold'): number {
  const input: TaxYearInput = {
    year, state, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, ordinaryIncome: taxable,
    filingStatus: status === 'marriedFilingJointly' ? 'marriedFilingJointly' : 'single',
    agesAlive: status === 'marriedFilingJointly' ? [50, 50] : [50],
  }
  return computeStateTaxYearResult(input, { standardDeductionAllowedOverride: 0, householdFacts: { stateFilingStatus: status } }).amount
}

describe('Rhode Island Social Security modification (44-30-12(c)(8))', () => {
  const ri2026 = stateParamsFor('RI', 2026)!.rhodeIslandSocialSecurityModification!
  const ri2027 = stateParamsFor('RI', 2027)!.rhodeIslandSocialSecurityModification!

  it('requires federal AGI less than the limit: at the limit there is no modification', () => {
    const at = (federalAgi: number) => rhodeIslandSocialSecurityModification({ config: ri2026, joint: false, federalAgi, includedSocialSecurity: 20_000, claimantAges: [67] })
    expect(at(107_000).taxableIncomeDelta).toBe(0)
    expect(at(106_999).taxableIncomeDelta).toBe(-20_000)
  })

  it('carries the 2025 limit of $107,000 single into 2027, without the age test', () => {
    expect(ri2027).toEqual({ nonjointAgiLimit: 107_000, jointAgiLimit: 133_750 })
    const at = (federalAgi: number) => rhodeIslandSocialSecurityModification({ config: ri2027, joint: false, federalAgi, includedSocialSecurity: 20_000, claimantAges: [60] })
    expect(at(108_000).taxableIncomeDelta).toBe(0)
    expect(at(106_000).taxableIncomeDelta).toBe(-20_000)
  })

  it('in 2026 needs one spouse at full retirement age, and prorates by that spouse’s benefits', () => {
    const joint = (recipients?: { ageYears?: number; grossSocialSecurity: number }[]) => rhodeIslandSocialSecurityModification({
      config: ri2026, joint: true, federalAgi: 100_000, includedSocialSecurity: 25_500, claimantAges: [67, 60],
      ...(recipients ? { recipients } : {}),
    })
    // Without per-person benefits the whole included amount is subtracted.
    expect(joint().taxableIncomeDelta).toBe(-25_500)
    // The Division's worksheet: 25,500 x 20,000 / 30,000 = 17,000.
    expect(joint([{ ageYears: 67, grossSocialSecurity: 20_000 }, { ageYears: 60, grossSocialSecurity: 10_000 }]).taxableIncomeDelta).toBeCloseTo(-17_000, 6)
    // Both at full retirement age: 1.0000.
    expect(joint([{ ageYears: 67, grossSocialSecurity: 20_000 }, { ageYears: 68, grossSocialSecurity: 10_000 }]).taxableIncomeDelta).toBe(-25_500)
    // Neither: no modification.
    expect(rhodeIslandSocialSecurityModification({ config: ri2026, joint: true, federalAgi: 100_000, includedSocialSecurity: 25_500, claimantAges: [60, 61] }).taxableIncomeDelta).toBe(0)
  })
})

describe('Maryland capital-gain surtax and public-safety subtraction', () => {
  const md = stateParamsFor('MD', 2026)!

  it('charges the 2% only above $350,000 of federal AGI', () => {
    expect(md.marylandCapitalGainSurtax).toEqual({ ratePct: 2, federalAgiThreshold: 350_000 })
    const at = (federalAgi: number) => marylandCapitalGainSurtax({ config: md.marylandCapitalGainSurtax!, federalAgi, netCapitalGain: 100_000 })
    expect(at(350_000)).toBe(0)
    expect(at(350_001)).toBe(2_000)
    expect(at(320_000)).toBe(0)
  })

  it('subtracts public-safety income from 55, not only after it', () => {
    const at = (age: number) => marylandPublicSafetySubtraction({
      config: md.marylandPublicSafetySubtraction!,
      distributions: [fact({ planSystemCode: 'MD-PUBLIC-SAFETY', recipientAgeYears: age })],
    }).taxableIncomeDelta
    expect(at(55)).toBe(-16_000)
    expect(at(54)).toBe(0)
  })
})

describe('California military exclusions (RTC 17132.9, 17132.10)', () => {
  const ca = stateParamsFor('CA', 2026)!.californiaMilitaryExclusions!
  const military = (ownerPersonId: string) => fact({ ownerPersonId, sourceKind: 'militaryRetirement' })

  it('excludes at federal AGI of $125,000 single and not above, and the limit is $125,000', () => {
    const at = (federalAgi: number) => californiaMilitaryExclusions({ config: ca, joint: false, federalAgi, distributions: [military('owner')] }).taxableIncomeDelta
    expect(ca.agiLimitNonjoint).toBe(125_000)
    expect(at(125_000)).toBe(-20_000)
    expect(at(125_001)).toBe(0)
    expect(at(130_000)).toBe(0)
  })

  it('caps the exclusion per return, so two veterans on a joint return share one $20,000', () => {
    const joint = californiaMilitaryExclusions({ config: ca, joint: true, federalAgi: 200_000, distributions: [military('a'), military('b')] })
    expect(joint.taxableIncomeDelta).toBe(-20_000)
  })
})

describe('Hawaii and New York printed tables', () => {
  it('starts Hawaii’s 2027 single 2.5% band at $14,400', () => {
    // 14,200 x 1.4% = 198.80, below the $14,400 bound and its printed $202 base.
    expect(onTaxable('HI', 2027, 14_200, 'single')).toBeCloseTo(198.8, 6)
    expect(onTaxable('HI', 2027, 14_600, 'single')).toBeCloseTo(202 + 200 * 0.025, 6)
  })

  it('taxes Hawaii’s 2029 head-of-household band from $28,800 at 2.5%, the Act 24 rate', () => {
    // $403.00 plus 2.5% of the excess over $28,800.
    expect(onTaxable('HI', 2029, 30_000, 'headOfHousehold')).toBeCloseTo(403 + 1_200 * 0.025, 6)
  })

  it('prints New York’s 2027 joint base of $8,229 above $161,550', () => {
    // $8,229 plus 5.8% of the excess over $161,550.
    expect(onTaxable('NY', 2027, 200_000, 'marriedFilingJointly')).toBeCloseTo(8_229 + 38_450 * 0.058, 6)
  })
})
