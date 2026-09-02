import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import type { AcaResult } from '../../tax/aca.js'
import {
  annualAcaResultPublication,
  type AnnualAcaResultPublicationInput,
} from './annualAcaResultPublication.js'

const pack = packForYear(2026).pack

function quote(
  fplPct = 200,
  overCliff = false,
): AcaResult {
  return {
    fplPct,
    expectedContribution: 3_000,
    credit: 5_000,
    netAnnualPremium: 7_000,
    grossEnrollmentPremium: 12_000,
    applicableSlcspPremium: 8_000,
    modeledAllowablePtc: 5_000,
    economicNetPremium: 7_000,
    overCliff,
    belowEligibilityFloor: false,
  }
}

function input(
  overrides: Partial<AnnualAcaResultPublicationInput> = {},
): AnnualAcaResultPublicationInput {
  return {
    active: true,
    evaluation: {
      requiredNeed: 100.75,
      withdrawalTotal: 100,
      withdrawalShortfall: 0,
      acaSupportCodes: [],
      acaQuote: quote(),
      acaMagiProbe: {
        magi: 55_000,
        components: {
          federalAgi: 45_000,
          nontaxableSocialSecurity: 3_000,
          taxExemptInterest: 2_000,
          foreignExclusionAddback: 0,
          requiredFilerDependentMagi: 5_000,
        },
        dependents: [{
          personId: 'dependent',
          requiredToFile: 'required',
          magi: 5_000,
          includedMagi: 5_000,
        }],
      },
    },
    fixedPointFailed: false,
    converged: true,
    conflictingCliffBasins: false,
    evaluationCount: 7,
    maxEvaluationCount: 5,
    contract: {
      fplRegion: 'alaska',
      taxFamilyMembers: [
        {
          personId: 'primary',
          relationship: 'primary',
          requiredToFile: 'required',
          magi: 0,
        },
        {
          personId: 'dependent',
          relationship: 'dependent',
          requiredToFile: 'required',
          magi: 5_000,
        },
      ],
      coveredMembers: [{
        personId: 'primary',
        enrollmentPremiumByMonth: [500, 0, 600],
        slcspBenchmarkPremiumByMonth: [700, 900, 800],
      }],
    },
    contractCount: 1,
    exampleContractInputMismatch: false,
    isStandIn: false,
    people: [{ personId: 'primary', alive: true }],
    marketplaceMonthsByPersonPosition: [12],
    pre65MonthlyPremiumPerPerson: 100,
    healthInflationScale: 1.1,
    parameterPack: pack,
    fplInflationScale: 1.05,
    federalAgi: 40_000,
    grossSocialSecurity: 10_000,
    taxableSocialSecurity: 6_000,
    taxExemptInterest: 2_000,
    foreignExclusionAddback: 1_000,
    grossEnrollmentPremium: 12_000,
    slcspBenchmarkPremiums: [700, 900, 800],
    healthcare: 15_000,
    healthcareExcludingAcaEnrollment: 8_000,
    ...overrides,
  }
}

describe('annualAcaResultPublication', () => {
  it('is a strict no-op for an inactive ACA year', () => {
    const unread = new Proxy(
      { active: false },
      {
        get(target, property) {
          if (property === 'active') return target.active
          throw new Error(`inactive ACA read ${String(property)}`)
        },
      },
    ) as AnnualAcaResultPublicationInput

    expect(annualAcaResultPublication(unread)).toEqual({
      yearAcaResult: undefined,
      warnings: [],
    })
  })

  it('publishes actionable contract evidence, covered-month SLCSP, and an above-cliff warning', () => {
    const acaQuote = quote(450, true)
    const source = input({
      evaluation: {
        ...input().evaluation,
        acaSupportCodes: [
          'tax-exempt-interest-plan-derived',
          'tax-exempt-interest-plan-derived',
        ],
        acaQuote,
      },
    })

    const result = annualAcaResultPublication(source)

    expect(result.warnings).toEqual([
      'Some pre-65 years exceed 400% of the federal poverty line: no ACA credit (the cliff).',
    ])
    expect(result.yearAcaResult).toMatchObject({
      readiness: 'actionable',
      supportCodes: ['actionable', 'tax-exempt-interest-plan-derived'],
      householdMagi: 55_000,
      fplRegion: 'alaska',
      fplPct: 450,
      taxFamilySize: 2,
      grossEnrollmentPremium: 12_000,
      applicableSlcspPremium: 2_400,
      modeledAllowablePtc: 5_000,
      economicNetPremium: 7_000,
      cliffState: 'above-cliff',
      convergence: {
        converged: true,
        iterations: 5,
        maxIterations: 5,
        residualDollars: 0.75,
        grossPremiumFallback: false,
      },
    })
    expect(result.yearAcaResult?.federalPovertyLine).toBe(
      (pack.federalPovertyLine.alaska.firstPerson +
        pack.federalPovertyLine.alaska.perAdditionalPerson) * 1.05,
    )
    expect(result.yearAcaResult?.taxFamilyMembers).toEqual([
      expect.objectContaining({ personId: 'primary', includedMagi: 0 }),
      expect.objectContaining({ personId: 'dependent', includedMagi: 5_000 }),
    ])
    expect(result.yearAcaResult?.coveredMembers).toEqual([{
      personId: 'primary',
      coveredMonths: [1, 3],
      grossEnrollmentPremium: 1_100,
      applicableSlcspPremium: 1_500,
    }])
    expect(result.yearAcaResult?.taxFamilyMembers).not.toBe(
      source.contract?.taxFamilyMembers,
    )
    expect(result.yearAcaResult?.coveredMembers).not.toBe(
      source.contract?.coveredMembers,
    )
  })

  it('deduplicates blockers, publishes fallback evidence, and preserves warning order', () => {
    const result = annualAcaResultPublication(input({
      evaluation: {
        requiredNeed: 90,
        withdrawalTotal: 75,
        withdrawalShortfall: 5,
        acaSupportCodes: ['missing-year-contract', 'missing-year-contract'],
        acaQuote: null,
        acaMagiProbe: null,
      },
      fixedPointFailed: true,
      converged: false,
      conflictingCliffBasins: true,
      contract: null,
      people: [
        { personId: 'alive', alive: true },
        { personId: 'dead', alive: false },
      ],
      marketplaceMonthsByPersonPosition: [2, 12],
    }))

    expect(result.warnings).toEqual([
      'Some Marketplace years use gross enrollment premium because required ACA reconciliation facts are missing or unsupported.',
    ])
    expect(result.yearAcaResult).toMatchObject({
      readiness: 'nonActionable',
      supportCodes: [
        'missing-year-contract',
        'fixed-point-nonconvergent',
        'conflicting-cliff-fixed-points',
      ],
      householdMagi: null,
      magiComponents: {
        federalAgi: 40_000,
        nontaxableSocialSecurity: 4_000,
        taxExemptInterest: 2_000,
        foreignExclusionAddback: 1_000,
        requiredFilerDependentMagi: 0,
      },
      fplRegion: null,
      federalPovertyLine: null,
      taxFamilySize: null,
      coveredMembers: [{
        personId: 'alive',
        coveredMonths: [1, 2],
        grossEnrollmentPremium: 220.00000000000003,
        applicableSlcspPremium: 220.00000000000003,
      }],
      applicableSlcspPremium: null,
      modeledAllowablePtc: null,
      cliffState: 'unsupported',
      convergence: {
        converged: false,
        iterations: 5,
        maxIterations: 5,
        residualDollars: 10,
        grossPremiumFallback: true,
      },
    })
  })

  it('suppresses fallback member synthesis for duplicate contracts and pins both lower cliff states', () => {
    const duplicate = annualAcaResultPublication(input({
      evaluation: {
        ...input().evaluation,
        acaSupportCodes: ['duplicate-year-contract'],
        acaQuote: null,
      },
      contract: null,
      contractCount: 2,
    }))
    expect(duplicate.yearAcaResult?.coveredMembers).toEqual([])

    const belowFloor = annualAcaResultPublication(input({
      evaluation: {
        ...input().evaluation,
        acaSupportCodes: ['below-100-fpl-exception-unsupported'],
      },
    }))
    expect(belowFloor.yearAcaResult?.cliffState).toBe(
      'below-eligibility-floor',
    )

    const atCliff = annualAcaResultPublication(input({
      evaluation: {
        ...input().evaluation,
        acaQuote: quote(pack.aca.maxFplPctForCredit),
      },
    }))
    expect(atCliff.yearAcaResult?.cliffState).toBe('at-cliff')
  })
})
