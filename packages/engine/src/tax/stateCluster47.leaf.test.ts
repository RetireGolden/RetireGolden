/**
 * Authority-derived discriminating fixtures for state-47 audit cluster leafs.
 * Expected values come from cited statutes / agency guidance in the assignment
 * packets — not from reading the helpers under test.
 */

import { describe, expect, it } from 'vitest'

import { stateParamsFor } from '../params/state/index.js'
import { arkansasIraExclusionAmount } from './stateArkansasRetirement.js'
import {
  coloradoFlatTax,
  coloradoHighAgiFederalDeductionAddback,
  coloradoSsPensionSubtraction,
  CO_HIGH_AGI_TRIGGER,
} from './stateColoradoTax.js'
import { connecticutPersonalExemption, delawareUnder60PensionDeduction, newJerseyMilitaryExemption } from './stateNortheastExtras.js'
import { iowaAlternateOrMinimumTax, iowaDistributionExclusion } from './stateIowaRetirement.js'
import {
  illinoisPersonalExemptionAllowance,
  kansasNamedPlanExclusion,
  missouriPrivatePensionDeduction,
  westVirginiaExemptions,
  westVirginiaSocialSecuritySubtraction,
  wisconsinPersonalExemption,
  wisconsinStandardDeduction,
} from './stateMidwestExtras.js'
import {
  louisianaAge65RetirementExemption,
  louisianaFederalRailroadExclusion,
  LA_RETIREMENT_EXEMPTION_TY2026,
} from './stateLouisianaRetirement.js'
import {
  californiaHsaAdjustment,
  californiaHsaCollectionAdjustment,
  newJerseyHsaAccountAdjustment,
  newJerseyHsaAdjustment,
  stateDirectQcdAdjustment,
  stateDirectQcdCollectionAdjustment,
} from './stateQcdHsa.js'
import {
  scAge65Deduction,
  scMilitaryDeduction,
  scSciadDeduction,
  scSection1170Deduction,
} from './stateSouthCarolinaRetirement.js'
import {
  hawaiiTaxForStatus,
  HAWAII_HOH_BRACKETS_2026,
  idahoQualifiedRetirementDeduction,
  ID_CAP_SINGLE_2026,
  montanaLtcgTax,
  oregonRetirementIncomeCredit,
  utahMilitaryRetirementCredit,
  utahRetirementCredit,
  utahSelectNonrefundableCredit,
  utahSocialSecurityCredit,
  vermontOrdinaryTax,
  vermontMinimumTaxComparison,
  virginiaMilitarySubtraction,
  virginiaSsTier1Subtraction,
} from './stateWestExtras.js'
import { knownMoney, unknownMoney, type StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { computeStateTaxableIncome, computeStateTaxDetailResult, computeStateTaxYearResult } from './stateTax.js'
import type { TaxYearInput } from '../projection/types.js'

const TAX_YEAR = 2026

function baseInput(over: Partial<TaxYearInput> = {}): TaxYearInput {
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

function fact(over: Partial<StateRetirementDistributionFact>): StateRetirementDistributionFact {
  return {
    ownerPersonId: 'p1',
    sourceKind: 'ira',
    federallyIncludedAmount: 0,
    recipientAgeYears: 50,
    cause: 'ordinary',
    earlyDistributionDisqualifier: 'false',
    ...over,
  }
}

describe('rule-043 / vault-040-f004 Iowa disability/survivor/military limbs', () => {
  it('excludes a disabled under-55 qualifying distribution', () => {
    // Iowa Code §422.7(19)-(21): disabled recipient qualifies without age 55.
    const result = iowaDistributionExclusion(
      fact({
        sourceKind: 'employerPlan',
        federallyIncludedAmount: 8_000,
        recipientAgeYears: 50,
        recipientDisabled: true,
      }),
    )
    expect(-result.taxableIncomeDelta).toBe(8_000)
  })

  it('excludes an eligible survivor under 55', () => {
    const result = iowaDistributionExclusion(
      fact({
        sourceKind: 'employerPlan',
        federallyIncludedAmount: 5_000,
        recipientAgeYears: 40,
        cause: 'death',
        decedentWouldQualify: true,
        survivorInsurableInterest: true,
      }),
    )
    expect(-result.taxableIncomeDelta).toBe(5_000)
  })

  it('negative: under-55 ordinary IRA with no qualifying condition gets $0', () => {
    const result = iowaDistributionExclusion(
      fact({
        sourceKind: 'ira',
        federallyIncludedAmount: 5_000,
        recipientAgeYears: 40,
      }),
    )
    expect(result.taxableIncomeDelta).toBe(0)
  })
})

describe('rule-048 Arkansas IRA age-59½ gate', () => {
  it('allows IRA exclusion one day after age 59½', () => {
    // Act 141 §3 / A.C.A. 26-51-307(a)(2): after reaching 59½.
    expect(
      arkansasIraExclusionAmount(
        fact({
          sourceKind: 'ira',
          federallyIncludedAmount: 6_000,
          ageAtDistributionYears: 59.5 + 1 / 365,
          recipientAgeYears: 59,
        }),
        6_000,
      ),
    ).toBe(6_000)
  })

  it('allows disability IRA exclusion under 59½', () => {
    expect(
      arkansasIraExclusionAmount(
        fact({
          sourceKind: 'ira',
          federallyIncludedAmount: 4_000,
          recipientAgeYears: 50,
          cause: 'disability',
        }),
        6_000,
      ),
    ).toBe(4_000)
  })

  it('negative: age 59 years 5 months ordinary IRA gets $0', () => {
    expect(
      arkansasIraExclusionAmount(
        fact({
          sourceKind: 'ira',
          federallyIncludedAmount: 6_000,
          ageAtDistributionYears: 59 + 5 / 12,
          recipientAgeYears: 59,
        }),
        6_000,
      ),
    ).toBe(0)
  })
})

describe('rule-047 / vault-054 SC military vs §1170', () => {
  it('fully deducts military retirement under §1171', () => {
    const result = scMilitaryDeduction([
      fact({
        sourceKind: 'militaryRetirement',
        federallyIncludedAmount: 60_000,
        recipientAgeYears: 50,
      }),
    ])
    expect(-result.taxableIncomeDelta).toBe(60_000)
  })

  it('negative: nonmilitary public pension is capped at $3,000 under 65, never fully exempt', () => {
    const result = scSection1170Deduction({
      facts: [
        fact({
          sourceKind: 'stateLocalPublic',
          federallyIncludedAmount: 60_000,
          recipientAgeYears: 50,
          earlyDistributionDisqualifier: 'false',
        }),
      ],
      recipientAgeYears: 50,
    })
    expect(-result.taxableIncomeDelta).toBe(3_000)
  })

  it('age-65 §1170(A) uses the $10,000 tier', () => {
    const result = scSection1170Deduction({
      facts: [
        fact({
          sourceKind: 'ira',
          federallyIncludedAmount: 12_000,
          recipientAgeYears: 65,
          earlyDistributionDisqualifier: 'false',
        }),
      ],
      recipientAgeYears: 65,
    })
    expect(-result.taxableIncomeDelta).toBe(10_000)
  })

  it('SCIAD single AGI $50,000 → $12,280', () => {
    // floor(($15,000 × $10,000 / $55,000) / $10) × $10 = $2,720; $15,000 − $2,720 = $12,280.
    expect(scSciadDeduction({ filingStatus: 'single', federalAgi: 50_000, config: stateParamsFor('SC', TAX_YEAR)!.southCarolinaSciad }).deduction).toBe(12_280)
  })

  it('SCIAD helper fails closed when pack config is missing', () => {
    const result = scSciadDeduction({ filingStatus: 'single', federalAgi: 50_000 })
    expect(result).toMatchObject({ deduction: 0, base: 0, warnings: [{ code: 'sc-sciad-config-missing' }] })
  })
})

describe('rule-050 / vault-042 F003 Louisiana', () => {
  it('indexes TY2026 age-65 cap to $12,324', () => {
    expect(LA_RETIREMENT_EXEMPTION_TY2026).toBe(12_324)
    const pack = stateParamsFor('LA', TAX_YEAR)!
    expect(pack.retirementPrivate.capPerPerson).toBe(12_324)
  })

  it('excludes federal civil-service under §47:44.2', () => {
    expect(
      -louisianaFederalRailroadExclusion([
        fact({ sourceKind: 'federalCivilService', federallyIncludedAmount: 20_000 }),
      ]).taxableIncomeDelta,
    ).toBe(20_000)
  })

  it('negative: municipal public pension gets $0 under §47:44.2', () => {
    expect(
      -louisianaFederalRailroadExclusion([
        fact({ sourceKind: 'stateLocalPublic', federallyIncludedAmount: 20_000 }),
      ]).taxableIncomeDelta,
    ).toBe(0)
  })

  it('age-65 ordinary retirement uses the indexed cap', () => {
    expect(
      -louisianaAge65RetirementExemption({
        facts: [fact({ sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: 20_000, recipientAgeYears: 65 })],
      }).taxableIncomeDelta,
    ).toBe(12_324)
  })
})

describe('vault-036 Colorado limbs', () => {
  it('age-60 AGI at $75,000 threshold shares the $20,000 cap between SS and pension', () => {
    const result = coloradoSsPensionSubtraction({
      filingStatus: 'single',
      federalAgi: 75_000,
      recipients: [{ ownerPersonId: 'p1', ageYears: 60, taxableSocialSecurityAllocated: 18_000, qualifyingPensionAnnuity: 10_000 }],
    })
    expect(-result.taxableIncomeDelta).toBe(20_000)
  })

  it('age-65 $30,000 taxable Social Security is not truncated to the pension ceiling', () => {
    const result = coloradoSsPensionSubtraction({
      filingStatus: 'single', federalAgi: 100_000,
      recipients: [{ ownerPersonId: 'p1', ageYears: 65, taxableSocialSecurityAllocated: 30_000, qualifyingPensionAnnuity: 0 }],
    })
    expect(-result.taxableIncomeDelta).toBe(30_000)
  })

  it('age-60 over threshold caps shared SS+pension at $20,000', () => {
    const result = coloradoSsPensionSubtraction({
      filingStatus: 'single',
      federalAgi: 75_001,
      recipients: [
        { ownerPersonId: 'p1', ageYears: 60, taxableSocialSecurityAllocated: 25_000, qualifyingPensionAnnuity: 0 },
      ],
    })
    expect(-result.taxableIncomeDelta).toBe(20_000)
  })

  it('high-AGI federal deduction addback at the $300,000 boundary', () => {
    // Single: AGI 300000, federal SD 16100 → addback 15100; CO taxable 299000; tax 13156.
    const addback = coloradoHighAgiFederalDeductionAddback({
      federalAgi: CO_HIGH_AGI_TRIGGER,
      federalDeductionUsed: 16_100,
      joint: false,
    })
    expect(addback.taxableIncomeDelta).toBe(15_100)
    const coTaxable = 283_900 + 15_100
    expect(coTaxable).toBe(299_000)
    expect(coloradoFlatTax(coTaxable)).toBeCloseTo(13_156, 6)
  })

  it('negative: AGI $299,999 yields $0 addback', () => {
    expect(
      coloradoHighAgiFederalDeductionAddback({
        federalAgi: 299_999,
        federalDeductionUsed: 16_100,
        joint: false,
      }).taxableIncomeDelta,
    ).toBe(0)
  })
})

describe('vault-023/033 CA/NJ HSA and vault-024/033 QCD', () => {
  it('CA adds federal HSA deduction and employer contribution', () => {
    expect(californiaHsaCollectionAdjustment([{
      accountId: 'ca-hsa', ownerPersonId: 'p1', annualActivityComplete: true,
      federalHsaDeduction: knownMoney(4_000), employerContributionExcludedFederally: knownMoney(1_000),
      employerContributionAlreadyInStateWages: knownMoney(0), interest: knownMoney(0), dividends: knownMoney(0),
      realizedGains: knownMoney(0), unrealizedAppreciation: knownMoney(0), qualifiedCashWithdrawals: knownMoney(0),
      nonqualifiedDistributionFederalAmount: knownMoney(0), stateBasisBeforeYear: knownMoney(0),
    }]).taxableIncomeDelta).toBe(5_000)
  })

  it('CA production distinguishes unavailable HSA evidence from an explicit known-empty year', () => {
    const unavailable = computeStateTaxYearResult(baseInput({ state: 'CA' }), { qcdEvents: [] })
    const knownEmpty = computeStateTaxYearResult(baseInput({ state: 'CA' }), { hsaAccounts: [], qcdEvents: [] })
    expect(unavailable.status).toBe('incomplete')
    expect(knownEmpty.status).toBe('complete')
  })

  it('CA qualified withdrawal alone does not create negative income', () => {
    expect(
      californiaHsaAdjustment({
        federalHsaDeduction: 0,
        employerContributionExcludedFederally: 0,
        interest: 0,
        dividends: 0,
        realizedGains: 0,
        unrealizedAppreciation: 0,
        qualifiedCashWithdrawals: 10_000,
        stateBasisBeforeYear: 10_000,
      }).taxableIncomeDelta,
    ).toBe(0)
  })

  it('CA subtracts federally included nonqualified HSA distribution (Schedule CA 8f)', () => {
    expect(
      californiaHsaAdjustment({
        federalHsaDeduction: 0,
        employerContributionExcludedFederally: 0,
        interest: 0,
        dividends: 0,
        realizedGains: 0,
        unrealizedAppreciation: 0,
        qualifiedCashWithdrawals: 0,
        stateBasisBeforeYear: 0,
        nonqualifiedDistributionFederalAmount: 3_000,
      }).taxableIncomeDelta,
    ).toBe(-3_000)
  })

  it('NJ sale then qualified cash withdrawal taxes lot gain once with no second inclusion', () => {
    const result = newJerseyHsaAccountAdjustment({
      accountId: 'nj-hsa', ownerPersonId: 'p1', annualActivityComplete: true,
      federalHsaDeduction: knownMoney(0), employerContributionExcludedFederally: knownMoney(0),
      employerContributionAlreadyInStateWages: knownMoney(0), interest: knownMoney(0), dividends: knownMoney(0),
      realizedGains: unknownMoney(), unrealizedAppreciation: knownMoney(0), qualifiedCashWithdrawals: knownMoney(1_000),
      nonqualifiedDistributionFederalAmount: knownMoney(0), stateBasisBeforeYear: knownMoney(800),
      njAssetDispositions: [{ proceeds: 1_000, njLotBasis: 800 }],
    })
    expect(result.taxableIncomeDelta).toBe(200)
    expect(result.warnings).toHaveLength(0)
  })

  it('NJ unknown nonqualified category does not invent an inclusion', () => {
    const result = newJerseyHsaAdjustment({
      federalHsaDeduction: 0,
      employerContributionExcludedFederally: 0,
      employerContributionAlreadyInStateWages: 0,
      interest: 0,
      dividends: 0,
      realizedGains: 0,
      unrealizedAppreciation: 0,
      qualifiedCashWithdrawals: 0,
      stateBasisBeforeYear: 0,
      nonqualifiedDistributionFederalAmount: 5_000,
    })
    expect(result.taxableIncomeDelta).toBe(0)
    expect(result.warnings.some((w) => w.code === 'nj-hsa-distribution-category-unknown')).toBe(true)
  })

  it('unknown QCD policy fails closed without a fabricated addback', () => {
    const result = stateDirectQcdAdjustment({
      ownerPersonId: 'p1',
      grossIraDistribution: 10_000,
      directCharityTransfer: 10_000,
      federalExcludedAmount: 10_000,
      federalTaxableAmount: 0,
      federalBasisAllocated: 0,
      stateBasisFactsKnown: true,
      stateBasisRecovery: 0,
      residency: 'fullYearResident',
      policy: { kind: 'unknown' },
      splitInterest: false,
    })
    expect(result.taxableIncomeDelta).toBe(0)
    expect(result.warnings[0]?.code).toBe('state-qcd-policy-unknown')
  })

  it('pack policy overwrites a caller-supplied conforms claim for NJ', () => {
    const result = stateDirectQcdAdjustment(
      {
        ownerPersonId: 'p1',
        grossIraDistribution: 40_000,
        directCharityTransfer: 40_000,
        federalExcludedAmount: 40_000,
        federalTaxableAmount: 0,
        federalBasisAllocated: 0,
        stateBasisFactsKnown: true,
        stateBasisRecovery: 8_000,
        residency: 'fullYearResident',
        policy: { kind: 'conforms', citation: 'caller-override' },
        splitInterest: false,
      },
      { kind: 'noGeneralFederalExclusion', citation: 'N.J.S.A. 54A:5-1' },
    )
    // NJ taxable = 40000 - 8000 = 32000; federal taxable 0 → delta 32000.
    expect(result.taxableIncomeDelta).toBe(32_000)
  })

  it('NJ Worksheet C reconstructs taxable ratio from the annual owner pool', () => {
    const result = stateDirectQcdCollectionAdjustment({
      events: [
        {
          eventId: 'q1',
          accountId: 'ira1',
          ownerPersonId: 'p1',
          grossIraDistribution: 40_000,
          directCharityTransfer: 40_000,
          federalExcludedAmount: 40_000,
          federalTaxableAmount: 0,
          federalBasisAllocated: 0,
          residency: 'fullYearResident',
          splitInterest: false,
          directTransfer: true,
        },
      ],
      packPolicy: { kind: 'noGeneralFederalExclusion', citation: 'GIT-1/2 Worksheet C' },
      njPools: [
        {
          ownerPersonId: 'p1',
          december31IraValue: 60_000,
          allAnnualDistributions: 40_000,
          unrecoveredNjTaxedContributions: { known: true, amount: 20_000 },
          fullLiquidation: false,
        },
      ],
    })
    // totalValue=100000; taxableRatio=(100000-20000)/100000=0.8; NJ taxable=32000; fed=0.
    expect(result.taxableIncomeDelta).toBe(32_000)
  })

  it('AR adopted-cap QCD: federal $111,000 exclusion → $11,000 state addition', () => {
    expect(
      stateDirectQcdAdjustment({
        ownerPersonId: 'p1',
        grossIraDistribution: 111_000,
        directCharityTransfer: 111_000,
        federalExcludedAmount: 111_000,
        federalTaxableAmount: 0,
        federalBasisAllocated: 0,
        stateBasisFactsKnown: true,
        stateBasisRecovery: 0,
        residency: 'fullYearResident',
        policy: {
          kind: 'conformsWithAdoptedCap',
          annualCap: 100_000,
          citation: '2017 Ark. Acts, Act 155 §18',
        },
        splitInterest: false,
      }, stateParamsFor('AR', TAX_YEAR)!.directQcdPolicy).taxableIncomeDelta,
    ).toBe(11_000)
  })

  it('AR annual owner cap aggregates two $75k events to a $50k second-event addition', () => {
    const result = stateDirectQcdCollectionAdjustment({
      events: [
        {
          eventId: 'e1',
          accountId: 'a1',
          ownerPersonId: 'owner',
          grossIraDistribution: 75_000,
          directCharityTransfer: 75_000,
          federalExcludedAmount: 75_000,
          federalTaxableAmount: 0,
          federalBasisAllocated: 0,
          residency: 'fullYearResident',
          splitInterest: false,
          directTransfer: true,
        },
        {
          eventId: 'e2',
          accountId: 'a2',
          ownerPersonId: 'owner',
          grossIraDistribution: 75_000,
          directCharityTransfer: 75_000,
          federalExcludedAmount: 75_000,
          federalTaxableAmount: 0,
          federalBasisAllocated: 0,
          residency: 'fullYearResident',
          splitInterest: false,
          directTransfer: true,
        },
      ],
      packPolicy: {
        kind: 'conformsWithAdoptedCap',
        annualCap: 100_000,
        citation: '2017 Ark. Acts, Act 155 §18',
      },
    })
    // First event excludes 75k; second has 25k remaining → 50k addition; total addition 50k.
    expect(result.taxableIncomeDelta).toBe(50_000)
  })

  it('AR two owners each receive an independent $100k adopted cap', () => {
    const result = stateDirectQcdCollectionAdjustment({
      events: [
        {
          eventId: 'e1',
          accountId: 'a1',
          ownerPersonId: 'a',
          grossIraDistribution: 75_000,
          directCharityTransfer: 75_000,
          federalExcludedAmount: 75_000,
          federalTaxableAmount: 0,
          federalBasisAllocated: 0,
          residency: 'fullYearResident',
          splitInterest: false,
          directTransfer: true,
        },
        {
          eventId: 'e2',
          accountId: 'a2',
          ownerPersonId: 'b',
          grossIraDistribution: 75_000,
          directCharityTransfer: 75_000,
          federalExcludedAmount: 75_000,
          federalTaxableAmount: 0,
          federalBasisAllocated: 0,
          residency: 'fullYearResident',
          splitInterest: false,
          directTransfer: true,
        },
      ],
      packPolicy: {
        kind: 'conformsWithAdoptedCap',
        annualCap: 100_000,
        citation: '2017 Ark. Acts, Act 155 §18',
      },
    })
    expect(result.taxableIncomeDelta).toBe(0)
  })

  it('computeStateTaxDetailResult keeps QCD unknown-policy warnings and marks incomplete', () => {
    const nj = stateParamsFor('NJ', TAX_YEAR)!
    const result = computeStateTaxDetailResult(nj, baseInput({ state: 'NJ', ordinaryIncome: 50_000 }), {
      qcdFacts: {
        ownerPersonId: 'p1',
        grossIraDistribution: 10_000,
        directCharityTransfer: 10_000,
        federalExcludedAmount: 10_000,
        federalTaxableAmount: 0,
        federalBasisAllocated: 0,
        stateBasisFactsKnown: false,
        stateBasisRecovery: 0,
        residency: 'fullYearResident',
        policy: { kind: 'conforms', citation: 'caller-should-be-ignored' },
        splitInterest: false,
      },
    })
    // Pack NJ policy is noGeneralFederalExclusion; missing Worksheet C pool → incomplete.
    expect(result.status).toBe('incomplete')
    expect(result.warnings.some((w) => w.code === 'nj-qcd-basis-unknown')).toBe(true)
  })
})

describe('vault-037 CT/DE and vault-039 HI/IA', () => {
  it('CT personal exemption uses discrete $1,000 steps', () => {
    expect(connecticutPersonalExemption({ filingStatus: 'single', connecticutAgi: 35_000 })).toBe(10_000)
    expect(connecticutPersonalExemption({ filingStatus: 'single', connecticutAgi: 35_001 })).toBe(9_000)
  })

  it('DE under-60 greater-of military vs ordinary', () => {
    expect(
      -delawareUnder60PensionDeduction({
        recipientAgeYears: 55,
        ordinaryPensionIncluded: 1_500,
        militaryPensionIncluded: 10_000,
        earlyDistributionDisqualifier: 'false',
      }).taxableIncomeDelta,
    ).toBe(10_000)
    expect(
      -delawareUnder60PensionDeduction({
        recipientAgeYears: 55,
        ordinaryPensionIncluded: 10_000,
        militaryPensionIncluded: 0,
        earlyDistributionDisqualifier: 'false',
      }).taxableIncomeDelta,
    ).toBe(2_000)
  })

  it('HI HOH first bracket is not the MFJ schedule', () => {
    // 14,400 × 1.4% = 201.60
    expect(
      hawaiiTaxForStatus({
        filingStatus: 'headOfHousehold',
        taxableIncome: 14_400,
        singleBrackets: stateParamsFor('HI', TAX_YEAR)!.brackets.single,
        mfjBrackets: stateParamsFor('HI', TAX_YEAR)!.brackets.marriedFilingJointly,
        hohBrackets: HAWAII_HOH_BRACKETS_2026,
      }),
    ).toBeCloseTo(201.6, 6)
  })

  it('IA single minimum retention is distinct from the joint 4.3% alternate', () => {
    const householdFacts = { iowaClaimedAsDependent: false, iowaSpouseNolCarryElection: false }
    expect(iowaAlternateOrMinimumTax({ ordinaryTax: 100, filingStatus: 'single', testNetIncome: 9_000, seniorForThreshold: false, householdFacts }).tax).toBe(0)
    expect(iowaAlternateOrMinimumTax({ ordinaryTax: 100, filingStatus: 'single', testNetIncome: 10_000, seniorForThreshold: false, householdFacts }).tax).toBe(100)
    expect(iowaAlternateOrMinimumTax({ ordinaryTax: 100, filingStatus: 'marriedFilingJointly', testNetIncome: 14_000, seniorForThreshold: false, householdFacts }).tax).toBe(21.5)
  })
})

describe('vault-040/041/042/045 midwest and KY/MD pack pins', () => {
  it('Idaho single cap derivation is $49,824', () => {
    expect(ID_CAP_SINGLE_2026).toBe(4_152 * 12)
    expect(
      -idahoQualifiedRetirementDeduction({
        filingStatus: 'single',
        qualifyingFederallyIncludedBenefits: 60_000,
        householdGrossSocialSecurity: 10_000,
        householdGrossRailroadBenefits: 0,
        factsProveQualifyingPlan: true,
      }).taxableIncomeDelta,
    ).toBe(39_824)
  })

  it('Illinois age-65 single allowance is $3,925 below AGI cutoff', () => {
    expect(
      -illinoisPersonalExemptionAllowance({
        federalAgi: 100_000,
        joint: false,
        eligibleTaxpayerCount: 1,
        eligibleDependentCount: 0,
        age65EligibleCount: 1,
      }).taxableIncomeDelta,
    ).toBe(3_925)
  })

  it('Kansas named plan excludes listed codes and not unlisted municipal', () => {
    expect(
      -kansasNamedPlanExclusion(
        fact({ sourceKind: 'stateLocalPublic', federallyIncludedAmount: 12_000, planSystemCode: 'KPERS' }),
      ).taxableIncomeDelta,
    ).toBe(12_000)
    // Unlisted municipal: delta is +0; avoid unary-minus Object.is(-0, 0) failure.
    expect(
      kansasNamedPlanExclusion(
        fact({ sourceKind: 'stateLocalPublic', federallyIncludedAmount: 12_000, planSystemCode: 'CITY-OTHER' }),
      ).taxableIncomeDelta,
    ).toBe(0)
  })

  it('KY MFJ standard deduction is once $3,360, not $6,720', () => {
    const ky = stateParamsFor('KY', TAX_YEAR)!
    expect(ky.standardDeduction.marriedFilingJointly).toBe(3_360)
    const taxable = computeStateTaxableIncome(
      ky,
      baseInput({
        state: 'KY',
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 10_000,
      }),
    )
    expect(taxable).toBe(10_000 - 3_360)
  })

  it('MD pack pension cap is $40,600 for TY2026', () => {
    expect(stateParamsFor('MD', TAX_YEAR)!.retirementPrivate.capPerPerson).toBe(40_600)
  })

  it('Missouri private phaseout is dollar-for-dollar above $25,000 single', () => {
    expect(
      missouriPrivatePensionDeduction({
        filingStatus: 'single',
        missouriIncome: 28_000,
        privatePension: 6_000,
      }),
    ).toBe(3_000)
  })
})

describe('vault-046/048/053/055/056/057/058/059 remaining leaves', () => {
  it('Montana LTCG stacks after ordinary income', () => {
    expect(
      montanaLtcgTax({ filingStatus: 'single', ordinaryTaxableIncome: 0, netTaxableLtcg: 10_000 }),
    ).toBeCloseTo(300, 6)
    expect(
      montanaLtcgTax({ filingStatus: 'single', ordinaryTaxableIncome: 47_000, netTaxableLtcg: 1_000 }),
    ).toBeCloseTo(35.5, 6)
  })

  it('NJ military exemption does not treat OPM civil-service as military', () => {
    expect(
      -newJerseyMilitaryExemption([
        fact({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 80_000 }),
      ]).taxableIncomeDelta,
    ).toBe(80_000)
    expect(
      -newJerseyMilitaryExemption([
        fact({ sourceKind: 'federalCivilService', federallyIncludedAmount: 80_000 }),
      ]).taxableIncomeDelta,
    ).toBe(0)
  })

  it('Oregon retirement credit is nonrefundable at 9% of net pension', () => {
    expect(
      oregonRetirementIncomeCredit({
        recipientAgeYears: 62,
        qualifyingPension: 7_500,
        householdSocialSecurityAndTier1: 0,
        householdIncome: 15_000,
        joint: false,
        precreditOregonTax: 1_000,
      }).taxCredit,
    ).toBe(675)
    expect(
      oregonRetirementIncomeCredit({
        recipientAgeYears: 62,
        qualifyingPension: 7_500,
        householdSocialSecurityAndTier1: 0,
        householdIncome: 15_000,
        joint: false,
        precreditOregonTax: 400,
      }).taxCredit,
    ).toBe(400)
  })

  it('Utah military credit is 4.45% before the return-level liability cap', () => {
    expect(
      utahMilitaryRetirementCredit({
        federallyIncludedMilitaryRetirement: 20_000,
        taxRate: stateParamsFor('UT', TAX_YEAR)!.utahRetirementCredits!.taxRate,
      }).taxCredit,
    ).toBe(890)
  })

  it('Utah 2026 SS credit applies statutory MAGI phaseout and the retirement alternative is return-wide', () => {
    const cfg = stateParamsFor('UT', TAX_YEAR)!.utahRetirementCredits!
    // Utah Code §§59-10-1042 and -1019: $10,000 SS at $54k/$60k MAGI = $445/$295;
    // two eligible joint claimants at $40k MAGI = $900 - ($8k × 2.5%) = $700.
    expect(utahSocialSecurityCredit({ socialSecurityIncludedInUtahTaxableIncome: 10_000, utahMagi: 54_000, filingStatus: 'single', config: cfg }).taxCredit).toBe(445)
    expect(utahSocialSecurityCredit({ socialSecurityIncludedInUtahTaxableIncome: 10_000, utahMagi: 60_000, filingStatus: 'single', config: cfg }).taxCredit).toBe(295)
    const retirement = utahRetirementCredit({ claimantDatesOfBirth: ['1952-12-31', '1950-01-01'], utahMagi: 40_000, filingStatus: 'marriedFilingJointly', config: cfg })
    expect(retirement.taxCredit).toBe(700)
    expect(utahSelectNonrefundableCredit({ retirementCredit: 700, militaryCredit: 200, socialSecurityCredit: 445, election: 'auto', precreditUtahTax: 1_000 }).taxCredit).toBe(700)
  })

  it('selects Utah credits through the rich annual state calculator', () => {
    // IRC §86: $30,000 ordinary plus $10,000 gross SS yields $5,350 taxable
    // SS. Utah credit is $5,350 × 4.45%, not a credit on gross benefits.
    const result = computeStateTaxYearResult(baseInput({ state: 'UT', ordinaryIncome: 30_000, ssBenefits: 10_000 }), {
      householdFacts: {
        stateFilingStatus: 'single',
        federalAgi: 35_350,
        interestExcludedFromFederalAgi: 0,
        utahSection59_10_114Additions: 0,
        socialSecurityIncludedInUtahTaxableIncome: 5_350,
        claimantDatesOfBirth: ['1953-01-01'],
      },
      retirementDistributions: [],
    })
    expect(result.taxCredit).toBe(238.075)
    expect(result.stateTax).toBeCloseTo(1_335, 8)
    expect(result.status).toBe('complete')
  })

  it('Virginia military subtraction caps at $40,000 per recipient', () => {
    expect(
      -virginiaMilitarySubtraction([
        fact({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 45_000, recipientAgeYears: 45 }),
      ]).taxableIncomeDelta,
    ).toBe(40_000)
  })

  it('Virginia SS + Tier I subtraction uses federally included amounts', () => {
    expect(
      virginiaSsTier1Subtraction({
        federallyIncludedSocialSecurity: 20_000,
        federallyIncludedRailroadTier1: 20_000,
      }),
    ).toBe(40_000)
  })

  it('Vermont TY2026 MFJ top threshold continuous tax is $18,915.55', () => {
    expect(vermontOrdinaryTax('marriedFilingJointly', 312_050)).toBeCloseTo(18_915.55, 2)
  })

  it('Vermont 3% minimum tax triggers only when federal AGI > $150,000', () => {
    expect(
      vermontMinimumTaxComparison({
        ordinaryTax: 1_000,
        federalAgi: 150_000,
        usObligationAdjustment: 0,
      }).tax,
    ).toBe(1_000)
    expect(
      vermontMinimumTaxComparison({
        ordinaryTax: 1_000,
        federalAgi: 200_000,
        usObligationAdjustment: 0,
      }).tax,
    ).toBe(6_000)
  })

  it('Wisconsin single SD max and complete phaseout', () => {
    expect(wisconsinStandardDeduction({ filingStatus: 'single', wisconsinIncome: 20_119 })).toBe(13_960)
    expect(wisconsinStandardDeduction({ filingStatus: 'single', wisconsinIncome: 20_120 })).toBe(13_960)
    expect(wisconsinStandardDeduction({ filingStatus: 'single', wisconsinIncome: 20_121 })).toBeCloseTo(
      13_960 - 0.12,
      6,
    )
    expect(wisconsinStandardDeduction({ filingStatus: 'single', wisconsinIncome: 136_453 })).toBe(0)
  })

  it('Wisconsin HOH max is $18,030 with two-segment phase-down', () => {
    expect(wisconsinStandardDeduction({ filingStatus: 'headOfHousehold', wisconsinIncome: 20_119 })).toBe(18_030)
    expect(wisconsinStandardDeduction({ filingStatus: 'headOfHousehold', wisconsinIncome: 20_120 })).toBe(18_030)
    const mid = wisconsinStandardDeduction({ filingStatus: 'headOfHousehold', wisconsinIncome: 40_000 })
    expect(mid).toBeCloseTo(18_030 - 0.22515 * (40_000 - 20_120), 6)
    const second = wisconsinStandardDeduction({ filingStatus: 'headOfHousehold', wisconsinIncome: 58_827 })
    const singleAt = wisconsinStandardDeduction({ filingStatus: 'single', wisconsinIncome: 58_827 })
    expect(second).toBeCloseTo(singleAt, 6)
  })

  it('Wisconsin MFJ/MFS exact phase-start boundaries', () => {
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingJointly', wisconsinIncome: 29_039 })).toBe(25_840)
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingJointly', wisconsinIncome: 29_040 })).toBe(25_840)
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingJointly', wisconsinIncome: 159_690 })).toBe(0)
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingSeparately', wisconsinIncome: 13_779 })).toBe(12_280)
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingSeparately', wisconsinIncome: 13_780 })).toBe(12_280)
    expect(wisconsinStandardDeduction({ filingStatus: 'marriedFilingSeparately', wisconsinIncome: 75_869 })).toBe(0)
  })

  it('Wisconsin MFJ exemptions: 2 adults + 2 dependents + one age65 = $3,050', () => {
    expect(
      -wisconsinPersonalExemption({
        eligibleTaxpayerCount: 2,
        eligibleDependentCount: 2,
        age65EligibleCount: 1,
        claimedAsDependent: false,
      }).taxableIncomeDelta,
    ).toBe(3_050)
  })

  it('WV exemptions: known count 3 → $6,000; §151(d)(2) zero → $500; unknown zero reason incomplete', () => {
    expect(
      -westVirginiaExemptions({ federalExemptionCount: { known: true, value: 3 } }).taxableIncomeDelta,
    ).toBe(6_000)
    expect(
      -westVirginiaExemptions({
        federalExemptionCount: { known: true, value: 0 },
        zeroFederalExemptionReason: 'irc151d2',
      }).taxableIncomeDelta,
    ).toBe(500)
    expect(
      westVirginiaExemptions({
        federalExemptionCount: { known: true, value: 0 },
        zeroFederalExemptionReason: 'unknown',
      }).warnings.length,
    ).toBeGreaterThan(0)
  })

  it('WV SS phase-in: TY2025 above threshold uses 65%; TY2026 is full', () => {
    expect(
      westVirginiaSocialSecuritySubtraction({
        taxYear: 2025,
        filingStatus: 'single',
        federalAgi: 50_001,
        federallyIncludedSocialSecurity: 20_000,
      }),
    ).toBe(13_000)
    expect(
      westVirginiaSocialSecuritySubtraction({
        taxYear: 2026,
        filingStatus: 'single',
        federalAgi: 50_001,
        federallyIncludedSocialSecurity: 20_000,
      }),
    ).toBe(20_000)
  })

  it('SC age-65 (B) room is reduced by own retirement, not surviving-spouse deduction', () => {
    expect(
      -scAge65Deduction({
        recipientAgeYears: 70,
        remainingScIncome: 20_000,
        ownRetirementDeduction: 10_000,
        ownMilitaryDeduction: 0,
        survivingSpouseRetirementDeduction: 15_000,
      }).taxableIncomeDelta,
    ).toBe(5_000)
  })
})
