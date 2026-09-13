/**
 * State47 production worksheets. Expected amounts below are hand calculations
 * from the cited state statutes/instructions, not copies of helper output.
 * Every monetary assertion enters the annual state calculator. Projection
 * acceptance/rollback of basis is covered in the annual-ledger integration suite.
 */
import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxYearResult, createStateTaxCalculator, type StateTaxYearOptions } from './stateTax.js'
import { knownMoney, unknownMoney, type StateRetirementDistributionFact, type StateHouseholdTaxFacts, type StateHsaAccountYearFacts, type StateQcdEventFacts } from './stateRetirementFacts.js'

const input = (state: string, change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state, filingStatus: 'single', ordinaryIncome: 100_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60], ...change,
})
const fact = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  accountId: 'account', ownerPersonId: 'owner', sourceKind: 'ordinaryPrivatePension',
  federallyIncludedAmount: 12_000, grossDistribution: 12_000, recipientAgeYears: 60,
  recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false',
  ...change,
})
const household = (change: Partial<StateHouseholdTaxFacts> = {}): StateHouseholdTaxFacts => ({
  stateFilingStatus: 'single', federalAgi: 100_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
  exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
  section63fQualificationCount: 0, federalExemptionCount: { known: true, value: 1 },
  claimedAsDependent: false, ...change,
})
function annual(state: string, options: StateTaxYearOptions = {}, change: Partial<TaxYearInput> = {}) {
  return computeStateTaxYearResult(input(state, change), {
    retirementDistributions: [], hsaAccounts: [], qcdEvents: [], householdFacts: household(), ...options,
  })
}
function exclusion(state: string, rows: StateRetirementDistributionFact[], facts: StateHouseholdTaxFacts = household(), change: Partial<TaxYearInput> = {}) {
  const options = { householdFacts: facts }
  return annual(state, options, change).taxableIncome - annual(state, { ...options, retirementDistributions: rows }, change).taxableIncome
}
const hsa = (change: Partial<StateHsaAccountYearFacts> = {}): StateHsaAccountYearFacts => ({
  accountId: 'hsa', ownerPersonId: 'owner', federalHsaDeduction: knownMoney(0),
  employerContributionExcludedFederally: knownMoney(0), employerContributionAlreadyInStateWages: knownMoney(0),
  interest: knownMoney(0), dividends: knownMoney(0), realizedGains: knownMoney(0),
  unrealizedAppreciation: knownMoney(0), qualifiedCashWithdrawals: knownMoney(0),
  nonqualifiedDistributionFederalAmount: knownMoney(0), nonqualifiedCashWithdrawals: knownMoney(0),
  stateBasisBeforeYear: knownMoney(10_000), annualActivityComplete: true, ...change,
})
const qcd = (change: Partial<StateQcdEventFacts> = {}): StateQcdEventFacts => ({
  eventId: 'qcd', accountId: 'ira', ownerPersonId: 'owner', grossIraDistribution: 10_000,
  directCharityTransfer: 10_000, federalExcludedAmount: 10_000, federalTaxableAmount: 0,
  federalBasisAllocated: 0, residency: 'fullYearResident', splitInterest: false, directTransfer: true, ...change,
})

describeRule('iowa-code-422-7-19-a-retirement-income-exclusion', {
  readings: { qualifyingRecipient: 12_000, ageOnlyForDisabledSurvivor: 0 }, accepted: 'qualifyingRecipient',
}, ({ accepted }) => {
  // Iowa Code §422.7(19)-(21): independent age, disability and survivor limbs.
  it('selects each independently qualifying Iowa age disability survivor military and railroad limb', () => {
    const rows = [
    fact({ recipientAgeYears: 55 }),
    fact({ recipientAgeYears: 40, recipientDisabled: true }),
    fact({ recipientAgeYears: 40, cause: 'death', decedentWouldQualify: true, survivorSpouse: true }),
    fact({ recipientAgeYears: 40, cause: 'death', decedentWouldQualify: true, survivorInsurableInterest: true }),
    fact({ recipientAgeYears: 40, sourceKind: 'militaryRetirement' }),
    fact({ recipientAgeYears: 40, sourceKind: 'railroadTier1' }),
    ]
    for (const row of rows) expect(exclusion('IA', [row])).toBe(accepted)
  })
  it('denies each unproved Iowa under55 disability or survivor limb', () => {
    const rows = [
    fact({ recipientAgeYears: 54, recipientDisabled: false }),
    fact({ recipientAgeYears: 40, cause: 'death', decedentWouldQualify: false, survivorSpouse: true }),
    fact({ recipientAgeYears: 40, cause: 'death', decedentWouldQualify: true, survivorInsurableInterest: false }),
    ]
    for (const row of rows) expect(exclusion('IA', [row])).toBe(0)
  })
})

describeRule('iowa-code-422-5-alternate-minimum-tax', {
  readings: { jointAlternate: 21.5, ordinaryFlat: 532 }, accepted: 'jointAlternate',
}, ({ accepted }) => {
  it('applies the 4.3 percent alternative to joint income above $13,500', () => {
    // Iowa 422.5: $14,000 x3.8%=$532; joint alternative ($14,000-$13,500)x4.3%=$21.50.
    const hh = household({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 14_000, iowaTestNetIncome: 14_000, iowaSeniorForThreshold: false, iowaClaimedAsDependent: false, iowaSpouseNolCarryElection: false })
    expect(annual('IA', { standardDeductionAllowedOverride: 0, householdFacts: hh }, { filingStatus: 'marriedFilingJointly', ordinaryIncome: 14_000 }).amount).toBeCloseTo(accepted, 8)
  })
  it('uses single retention rather than granting the joint 4.3 percent alternative', () => {
    // Single $10,000: retain min($380 regular tax, $1,000 excess over $9,000).
    const hh = household({ federalAgi: 10_000, iowaTestNetIncome: 10_000, iowaSeniorForThreshold: false, iowaClaimedAsDependent: false })
    expect(annual('IA', { standardDeductionAllowedOverride: 0, householdFacts: hh }, { ordinaryIncome: 10_000 }).amount).toBeCloseTo(380, 8)
    expect(annual('IA', { standardDeductionAllowedOverride: 0, householdFacts: { ...hh, federalAgi: 9_000, iowaTestNetIncome: 9_000 } }, { ordinaryIncome: 9_000 }).amount).toBe(0)
  })
  it('uses the joint senior threshold separately and discloses missing test income', () => {
    expect(annual('IA', { householdFacts: household({ stateFilingStatus: 'marriedFilingJointly', iowaTestNetIncome: 32_000, iowaSeniorForThreshold: true, iowaClaimedAsDependent: false }) }, { filingStatus: 'marriedFilingJointly', ordinaryIncome: 32_000 }).amount).toBe(0)
    expect(annual('IA').warnings.some((w) => w.code === 'ia-alternate-tax-incomplete')).toBe(true)
  })
  it('prorates the married-separate alternative by each spouse taxable income and honors the NOL election', () => {
    // DOR worksheet: combined $21.50 x own taxable $10,000 / combined taxable $14,000.
    const hh = household({ stateFilingStatus: 'marriedFilingSeparately', federalAgi: 10_000, iowaTestNetIncome: 10_000, iowaSeniorForThreshold: false, iowaClaimedAsDependent: false, iowaCombinedSpouseTestNetIncome: 14_000, iowaSpouseTaxableIncome: 4_000, iowaSpouseNolCarryElection: false })
    const options = { standardDeductionAllowedOverride: 0, householdFacts: hh }
    expect(annual('IA', options, { ordinaryIncome: 10_000 }).amount).toBeCloseTo(21.5 * 10 / 14, 8)
    expect(annual('IA', { ...options, householdFacts: { ...hh, iowaSpouseNolCarryElection: true } }, { ordinaryIncome: 10_000 }).amount).toBeCloseTo(380, 8)
    const unknown = annual('IA', { ...options, householdFacts: { ...hh, iowaSpouseNolCarryElection: undefined } }, { ordinaryIncome: 10_000 })
    expect(unknown.status).toBe('incomplete')
    expect(unknown.amount).toBeCloseTo(380, 8)
    const below = { ...hh, iowaCombinedSpouseTestNetIncome: 13_000, iowaSpouseTaxableIncome: 3_000 }
    // DOR Line 04 requires both own <= $9,000 and combined <= $13,500.
    expect(annual('IA', { ...options, householdFacts: below }, { ordinaryIncome: 10_000 }).amount).toBeCloseTo(380, 8)
    expect(annual('IA', { ...options, householdFacts: { ...below, iowaSpouseNolCarryElection: true } }, { ordinaryIncome: 10_000 }).amount).toBeCloseTo(380, 8)
    const bothBelow = { ...below, federalAgi: 9_000, iowaTestNetIncome: 9_000, iowaSpouseTaxableIncome: 4_000 }
    expect(annual('IA', { ...options, householdFacts: bothBelow }, { ordinaryIncome: 9_000 }).amount).toBe(0)
    expect(annual('IA', { ...options, householdFacts: { ...bothBelow, iowaSpouseNolCarryElection: true } }, { ordinaryIncome: 9_000 }).amount).toBeCloseTo(342, 8)
  })
  it('conditions a dependent exemption on the claiming taxpayer income', () => {
    const hh = household({ federalAgi: 8_000, iowaTestNetIncome: 8_000, iowaSeniorForThreshold: false, iowaClaimedAsDependent: true, iowaClaimantJointThreshold: false, iowaClaimantTestNetIncome: 9_000 })
    const options = { standardDeductionAllowedOverride: 0, householdFacts: hh }
    expect(annual('IA', options, { ordinaryIncome: 8_000 }).amount).toBe(0)
    expect(annual('IA', { ...options, householdFacts: { ...hh, iowaClaimantTestNetIncome: 9_001 } }, { ordinaryIncome: 8_000 }).amount).toBeCloseTo(304, 8)
    expect(annual('IA', { ...options, householdFacts: { ...hh, iowaClaimantTestNetIncome: undefined } }, { ordinaryIncome: 8_000 }).status).toBe('incomplete')
  })
})

describeRule('ic-6-3-2-no-general-retirement-deduction', {
  readings: { noPrivatePensionSubtraction: 0, inventedPensionAllowance: 12_000 }, accepted: 'noPrivatePensionSubtraction',
}, ({ accepted }) => {
  it('keeps private pension in the Indiana annual base', () => expect(exclusion('IN', [fact()])).toBe(accepted))
})
describe('ND closed-list and MI permanent Social Security controls', () => {
  // ND closed-list record is metadata/approximation: do not invent a new
  // monetary exclusion merely to give the newly cited list a positive number.
  it('does not create an ND private-pension exclusion', () => expect(exclusion('ND', [fact()])).toBe(0))
  it.each([2026, 2028, 2029])('MI permanent SS subtraction survives the separate 2026–28 clause: %s', (year) => {
    expect(annual('MI', {}, { year, ssBenefits: 30_000 }).taxableIncome).toBe(annual('MI', {}, { year, ssBenefits: 0 }).taxableIncome)
  })
})

describe('Arkansas §26-51-307 distribution-age and source gates', () => {
  it('refuses to infer IRA distribution age from an eligible year-end age', () => {
    const ira = fact({ sourceKind: 'ira', recipientAgeYears: 60, ageAtDistributionYears: undefined })
    expect(exclusion('AR', [ira])).toBe(0)
    expect(annual('AR', { retirementDistributions: [ira] }).status).toBe('incomplete')
    expect(exclusion('AR', [{ ...ira, cause: 'death' }])).toBe(6_000)
    expect(exclusion('AR', [{ ...ira, recipientDisabled: true }])).toBe(6_000)
    expect(exclusion('AR', [{ ...ira, sourceKind: 'employerPlan' }])).toBe(6_000)
  })
  it.each([[59.49, 0], [59.5, 6_000], [60, 6_000]])('IRA at distribution age %s yields %s', (age, expected) => {
    expect(exclusion('AR', [fact({ sourceKind: 'ira', ageAtDistributionYears: age, recipientAgeYears: 60 })])).toBe(expected)
  })
  it('shares the $6,000 owner cap across two accounts, not between spouses', () => {
    expect(exclusion('AR', [fact({ accountId: 'a' }), fact({ accountId: 'b' })])).toBe(6_000)
    expect(exclusion('AR', [fact({ ownerPersonId: 'a' }), fact({ ownerPersonId: 'b' })])).toBe(12_000)
  })
  it('routes military separately and preserves missing-age disclosure', () => {
    expect(exclusion('AR', [fact({ sourceKind: 'militaryRetirement' })])).toBe(12_000)
    const result = annual('AR', { retirementDistributions: [fact({ sourceKind: 'ira', ageAtDistributionYears: undefined, recipientAgeKnown: false })] })
    expect(result.status).toBe('incomplete')
  })
})

describeRule('la-rs-47-44-2-social-security-federal-retirement', {
  readings: { federalOnly: 12_000, allRetirementExcluded: 0 }, accepted: 'federalOnly',
}, ({ accepted }) => {
  it('fully excludes proven federal and railroad sources, not a private under-65 pension', () => {
    expect(exclusion('LA', [fact({ sourceKind: 'federalCivilService' })])).toBe(accepted)
    expect(exclusion('LA', [fact({ sourceKind: 'railroadTier2' })])).toBe(12_000)
    expect(exclusion('LA', [fact()])).toBe(0)
  })
})
describeRule('la-rs-47-44-1-retirement-exemption', {
  readings: { ty2026Indexed: 12_324, staleBase: 12_000 }, accepted: 'ty2026Indexed',
}, ({ accepted }) => {
  it('applies the 2026 indexed cap once per age-65 owner', () => {
    expect(exclusion('LA', [fact({ recipientAgeYears: 65, federallyIncludedAmount: 30_000 })])).toBe(accepted)
    expect(exclusion('LA', [fact({ recipientAgeYears: 64, federallyIncludedAmount: 30_000 })])).toBe(0)
    expect(annual('LA', { retirementDistributions: [fact({ recipientAgeKnown: false })] }).status).toBe('incomplete')
  })
  it('limits each Louisiana recipient to own income and own indexed allowance', () => {
    const rows = [fact({ recipientAgeYears: 65, federallyIncludedAmount: 5_000 }), fact({ ownerPersonId: 'spouse', recipientAgeYears: 65, federallyIncludedAmount: 20_000 })]
    expect(exclusion('LA', rows, household({ stateFilingStatus: 'marriedFilingJointly' }), { filingStatus: 'marriedFilingJointly', agesAlive: [65, 65] })).toBe(17_324)
    expect(exclusion('LA', [rows[0]!])).toBe(5_000)
    expect(exclusion('LA', [{ ...rows[1]!, recipientAgeYears: 64 }])).toBe(0)
  })
})

describeRule('ca-hsa-state-basis-nonconformity', {
  readings: { separateStateIncome: 5_000, federalConformity: 0 }, accepted: 'separateStateIncome',
}, ({ accepted }) => {
  // CA Schedule CA HSA deduction/contribution adjustments plus annual earnings.
  it('adds deduction, excluded employer contribution and realized income once', () => {
    const result = annual('CA', { hsaAccounts: [hsa({ federalHsaDeduction: knownMoney(3_000), employerContributionExcludedFederally: knownMoney(1_000), interest: knownMoney(200), dividends: knownMoney(300), realizedGains: knownMoney(500), unrealizedAppreciation: knownMoney(9_000), qualifiedCashWithdrawals: knownMoney(2_000) })] })
    expect(result.taxableIncome - annual('CA').taxableIncome).toBe(accepted)
    expect(result.hsaBasisPools?.[0]).toMatchObject({ openingBasis: 10_000, basisAdded: 5_000, basisConsumed: 2_000, closingBasis: 13_000 })
  })
  it('removes an already federally included withdrawal without taxing it twice', () => {
    const result = annual('CA', { hsaAccounts: [hsa({ nonqualifiedDistributionFederalAmount: knownMoney(2_000), nonqualifiedCashWithdrawals: knownMoney(2_000) })] })
    expect(annual('CA').taxableIncome - result.taxableIncome).toBe(2_000)
  })
  it('distinguishes unavailable activity from an explicitly empty collection', () => {
    expect(annual('CA', { hsaAccounts: undefined }).status).toBe('incomplete')
    expect(annual('CA', { hsaAccounts: [hsa({ interest: unknownMoney(), annualActivityComplete: false })] }).status).toBe('incomplete')
    expect(annual('CA').warnings.some((w) => w.code.includes('hsa'))).toBe(false)
  })
})
describeRule('nj-hsa-state-basis-nonconformity', {
  readings: { realizedLotGainOnly: 200, wholeWithdrawal: 1_000 }, accepted: 'realizedLotGainOnly',
}, ({ accepted }) => {
  it('taxes a $1,000 sale with $800 NJ lot basis, not the cash withdrawal again', () => {
    const result = annual('NJ', { hsaAccounts: [hsa({ realizedGains: unknownMoney(), njAssetDispositions: [{ proceeds: 1_000, njLotBasis: 800 }], qualifiedCashWithdrawals: knownMoney(1_000), unrealizedAppreciation: knownMoney(5_000) })] })
    expect(result.taxableIncome - annual('NJ').taxableIncome).toBe(accepted)
  })
  it('includes $600 of interest dividends and realized gain while ignoring $500 unrealized appreciation', () => {
    // NJ category supplement: $100 interest + $200 dividends + $300 realized gain.
    const result = annual('NJ', { hsaAccounts: [hsa({ interest: knownMoney(100), dividends: knownMoney(200), realizedGains: knownMoney(300), unrealizedAppreciation: knownMoney(500) })] })
    expect(result.taxableIncome - annual('NJ').taxableIncome).toBe(600)
    const unrealizedOnly = annual('NJ', { hsaAccounts: [hsa({ unrealizedAppreciation: knownMoney(500) })] })
    expect(unrealizedOnly.taxableIncome).toBe(annual('NJ').taxableIncome)
  })
  it('does not re-add contributions already included in NJ wages', () => {
    const included = annual('NJ', { hsaAccounts: [hsa({ employerContributionExcludedFederally: knownMoney(2_000), employerContributionAlreadyInStateWages: knownMoney(2_000) })] })
    expect(included.taxableIncome).toBe(annual('NJ').taxableIncome)
    expect(annual('NJ', { hsaAccounts: [hsa({ stateBasisBeforeYear: unknownMoney(), annualActivityComplete: false })] }).status).toBe('incomplete')
  })
})
describeRule('state-direct-qcd-conformity-policies', {
  readings: { arkansasAdoptedCapAddition: 11_000, importedFederalCap: 0 }, accepted: 'arkansasAdoptedCapAddition',
}, ({ accepted }) => {
  it('adds the amount above Arkansas’s adopted $100,000 owner cap', () => {
    const event = qcd({ grossIraDistribution: 111_000, directCharityTransfer: 111_000, federalExcludedAmount: 111_000 })
    expect(annual('AR', { qcdEvents: [event] }).taxableIncome - annual('AR').taxableIncome).toBe(accepted)
  })
  it('aggregates events per owner and gives the second owner a separate cap', () => {
    const a = qcd({ grossIraDistribution: 60_000, directCharityTransfer: 60_000, federalExcludedAmount: 60_000 })
    const b = { ...a, eventId: 'second', accountId: 'second' }
    expect(annual('AR', { qcdEvents: [a, b] }).taxableIncome - annual('AR').taxableIncome).toBe(20_000)
    expect(annual('AR', { qcdEvents: [a, { ...b, ownerPersonId: 'spouse' }] }).taxableIncome).toBe(annual('AR').taxableIncome)
  })
})
describeRule('hi-direct-qcd-conformity', { readings: { conformingAddition: 0, denial: 10_000 }, accepted: 'conformingAddition' }, ({ accepted }) => {
  it('keeps a qualifying direct QCD excluded in Hawaii', () => expect(annual('HI', { qcdEvents: [qcd()] }).taxableIncome - annual('HI').taxableIncome).toBe(accepted))
})
describeRule('ks-direct-qcd-conformity', { readings: { coveredCreditAddback: 10_000, doubleBenefit: 0 }, accepted: 'coveredCreditAddback' }, ({ accepted }) => {
  it('allows ordinary conformity but adds a transfer used for a covered Kansas credit', () => {
    expect(annual('KS', { qcdEvents: [qcd({ kansasCoveredCharitableCreditClaimed: false })] }).taxableIncome).toBe(annual('KS').taxableIncome)
    expect(annual('KS', { qcdEvents: [qcd({ kansasCoveredCharitableCreditClaimed: true })] }).taxableIncome - annual('KS').taxableIncome).toBe(accepted)
  })
})
describeRule('nj-direct-qcd-ira-basis-treatment', { readings: { worksheetC: 4_000, blanketFederalExclusion: 0 }, accepted: 'worksheetC' }, ({ accepted }) => {
  it('taxes $32,000 of a $40,000 full liquidation after recovering $8,000 NJ basis', () => {
    // GIT-1&2 Worksheet C full-liquidation supplement: $40,000 minus $8,000.
    const event = qcd({ grossIraDistribution: 40_000, directCharityTransfer: 40_000, federalExcludedAmount: 40_000 })
    const pool = { ownerPersonId: 'owner', december31IraValue: 0, allAnnualDistributions: 40_000, unrecoveredNjTaxedContributions: knownMoney(8_000), fullLiquidation: true, annualInputsComplete: true }
    const result = annual('NJ', { qcdEvents: [event], njIraOwnerPools: [pool] })
    expect(result.taxableIncome - annual('NJ').taxableIncome).toBe(32_000)
    expect(result.njIraBasisPools?.[0]).toMatchObject({ basisConsumed: 8_000, closingBasis: 0 })
    const withoutBasis = annual('NJ', { qcdEvents: [event], njIraOwnerPools: [{ ...pool, unrecoveredNjTaxedContributions: knownMoney(0) }] })
    expect(withoutBasis.taxableIncome - annual('NJ').taxableIncome).toBe(40_000)
  })
  it('uses NJ basis for a full liquidation and conserves recovery across events', () => {
    const options = { qcdEvents: [qcd({ eventId: 'a', grossIraDistribution: 5_000, directCharityTransfer: 5_000, federalExcludedAmount: 5_000 }), qcd({ eventId: 'b', grossIraDistribution: 5_000, directCharityTransfer: 5_000, federalExcludedAmount: 5_000 })], njIraOwnerPools: [{ ownerPersonId: 'owner', december31IraValue: 0, allAnnualDistributions: 10_000, unrecoveredNjTaxedContributions: knownMoney(6_000), fullLiquidation: true, annualInputsComplete: true }] }
    const result = annual('NJ', options)
    expect(result.taxableIncome - annual('NJ').taxableIncome).toBe(accepted)
    expect(result.njIraBasisPools?.[0]).toMatchObject({ basisConsumed: 6_000, closingBasis: 0 })
    expect(annual('NJ', { qcdEvents: [qcd()] }).status).toBe('incomplete')
  })
})
describe('QCD classification controls shared by both original findings', () => {
  it.each(['AR', 'HI', 'KS', 'NJ'])('%s never certifies a nondirect transfer or missing activity as exact', (state) => {
    expect(annual(state, { qcdEvents: [qcd({ directTransfer: false })] }).status).toBe('incomplete')
    expect(annual(state, { qcdEvents: undefined }).status).toBe('incomplete')
  })
  it.each(['HI', 'KS'])('%s has no California/NJ HSA nonconformity addition', (state) => {
    expect(annual(state, { hsaAccounts: [hsa({ federalHsaDeduction: knownMoney(4_000), interest: knownMoney(1_000) })] }).taxableIncome).toBe(annual(state).taxableIncome)
  })
})

describe('Colorado §39-22-104 shared retirement cap and full Social Security limbs', () => {
  it('raises the age60 Social Security cap at $75,000 AGI but not $75,001', () => {
    // Section 39-22-104(4)(f)(III): the threshold includes exactly $75,000.
    const rows = [fact({ federallyIncludedAmount: 0, recipientAgeYears: 60, taxableSocialSecurityAllocated: 25_000 })]
    const hh = household({ federalAgi: 75_000, federalDeductionUsed: 16_100, federallyIncludedSocialSecurity: 25_000 })
    expect(exclusion('CO', rows, hh)).toBe(25_000)
    expect(exclusion('CO', rows, { ...hh, federalAgi: 75_001 })).toBe(20_000)
  })
  it('does not transfer unused spouse cap and preserves the under55 survivor exception', () => {
    const hh = household({ federalDeductionUsed: 32_200, stateFilingStatus: 'marriedFilingJointly' })
    const rows = [fact({ federallyIncludedAmount: 30_000, recipientAgeYears: 60 }), fact({ ownerPersonId: 'spouse', federallyIncludedAmount: 1_000, recipientAgeYears: 65 })]
    expect(exclusion('CO', rows, hh, { filingStatus: 'marriedFilingJointly', agesAlive: [60, 65] })).toBe(21_000)
    const survivor = fact({ recipientAgeYears: 50, federallyIncludedAmount: 30_000, deathOrDisabilitySurvivorUnder55: true })
    expect(exclusion('CO', [survivor], hh)).toBe(20_000)
    expect(exclusion('CO', [{ ...survivor, deathOrDisabilitySurvivorUnder55: false }], hh)).toBe(0)
  })
  it('uses each spouse share of jointly included Social Security without pooling age eligibility', () => {
    // Gross $30,000:$10,000 gives 3:1 allocation of the $30,000 federal inclusion.
    const hh = household({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 95_000, federalDeductionUsed: 32_200, federallyIncludedSocialSecurity: 30_000 })
    const rows = [fact({ recipientAgeYears: 60, federallyIncludedAmount: 0, taxableSocialSecurityAllocated: 22_500 }), fact({ ownerPersonId: 'spouse', recipientAgeYears: 54, federallyIncludedAmount: 0, taxableSocialSecurityAllocated: 7_500 })]
    expect(exclusion('CO', rows, hh, { filingStatus: 'marriedFilingJointly' })).toBe(22_500)
    expect(exclusion('CO', [{ ...rows[0]!, recipientAgeYears: 54 }, rows[1]!], hh, { filingStatus: 'marriedFilingJointly' })).toBe(0)
  })
  it('does not cap age-65 included Social Security at the pension ceiling', () => {
    // $50k ordinary and $40k benefits => $34k included under IRC86.
    const hh = household({ federalAgi: 84_000, federalDeductionUsed: 16_100, federallyIncludedSocialSecurity: 34_000 })
    expect(exclusion('CO', [fact({ federallyIncludedAmount: 0, recipientAgeYears: 65, taxableSocialSecurityAllocated: 34_000 })], hh, { ordinaryIncome: 50_000, ssBenefits: 40_000 })).toBe(34_000)
  })
  it('uses $24,000 age65 pension cap, and shared $20,000 age60 room', () => {
    const hh = household({ federalDeductionUsed: 16_100 })
    expect(exclusion('CO', [fact({ federallyIncludedAmount: 30_000, recipientAgeYears: 65, taxableSocialSecurityAllocated: 0 })], hh)).toBe(24_000)
    expect(exclusion('CO', [fact({ federallyIncludedAmount: 30_000, recipientAgeYears: 60, taxableSocialSecurityAllocated: 0 })], hh)).toBe(20_000)
    expect(exclusion('CO', [fact({ recipientAgeYears: 54, taxableSocialSecurityAllocated: 0 })], hh)).toBe(0)
  })
  it('keeps railroad income outside that cap and discloses missing SS allocation', () => {
    expect(exclusion('CO', [fact({ sourceKind: 'railroadTier2', federallyIncludedAmount: 40_000 })], household({ federalDeductionUsed: 16_100 }))).toBe(40_000)
    expect(annual('CO', { retirementDistributions: [fact()], householdFacts: household({ federallyIncludedSocialSecurity: 20_000, federalDeductionUsed: 16_100 }) }).status).toBe('incomplete')
  })
})
describeRule('co-39-22-104-p-7-high-income-addback', { readings: { retainOneThousand: 15_100, retainFederalDeduction: 0 }, accepted: 'retainOneThousand' }, ({ accepted }) => {
  it('starts the addback at $300,000 and retains $1,000 single or $2,000 joint', () => {
    const below = annual('CO', { householdFacts: household({ federalAgi: 299_999, federalDeductionUsed: 16_100 }) })
    const boundary = annual('CO', { householdFacts: household({ federalAgi: 300_000, federalDeductionUsed: 16_100 }) })
    expect(boundary.taxableIncome - below.taxableIncome).toBe(accepted)
    const joint = annual('CO', { householdFacts: household({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 300_000, federalDeductionUsed: 32_200 }) }, { filingStatus: 'marriedFilingJointly' })
    const jointBelow = annual('CO', { householdFacts: household({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 299_999, federalDeductionUsed: 32_200 }) }, { filingStatus: 'marriedFilingJointly' })
    expect(joint.taxableIncome - jointBelow.taxableIncome).toBe(30_200)
  })
})

describe('Delaware §1106 pension sources and early-distribution guidance', () => {
  it('takes greater-of under60 ordinary/military, not the sum', () => {
    const rows = [fact({ recipientAgeYears: 55, federallyIncludedAmount: 1_500 }), fact({ recipientAgeYears: 55, sourceKind: 'militaryRetirement', federallyIncludedAmount: 10_000 })]
    expect(exclusion('DE', rows)).toBe(10_000)
    expect(exclusion('DE', [fact({ recipientAgeYears: 55 })])).toBe(2_000)
    // Enacted future military tiers must not increase the TY2026 cap.
    expect(exclusion('DE', [fact({ sourceKind: 'militaryRetirement', recipientAgeYears: 55, federallyIncludedAmount: 20_000 })])).toBe(12_500)
    expect(exclusion('DE', [fact({ recipientAgeYears: 60, federallyIncludedAmount: 20_000 })])).toBe(12_500)
  })
  it.each([55, 65])('withholds a premature or unknown distribution at age %s', (age) => {
    expect(exclusion('DE', [fact({ recipientAgeYears: age, earlyDistributionDisqualifier: 'true', cause: 'earlyDistributionCode1' })])).toBe(0)
    expect(exclusion('DE', [fact({ recipientAgeYears: age, earlyDistributionDisqualifier: 'unknown' })])).toBe(0)
    expect(annual('DE', { retirementDistributions: [fact({ recipientAgeYears: age, earlyDistributionDisqualifier: 'unknown' })] }).status).toBe('incomplete')
  })
})
describeRule('de-early-distribution-gate', { readings: { excludedEarlyDistribution: 0, automaticAgeAllowance: 12_000 }, accepted: 'excludedEarlyDistribution' }, ({ accepted }) => {
  it('applies the latest-final Box7/penalty gate to age60-plus pension income', () => expect(exclusion('DE', [fact({ recipientAgeYears: 65, earlyDistributionDisqualifier: 'true', cause: 'earlyDistributionCode1' })])).toBe(accepted))
})
describeRule('dc-code-47-1803-03-government-survivor-exclusion', { readings: { currentSurvivorLimb: 12_000, expiredPensionCap: 3_000 }, accepted: 'currentSurvivorLimb' }, ({ accepted }) => {
  it.each(['dc', 'federal'] as const)('excludes proven %s survivor income from age62', (survivorIssuer) => expect(exclusion('DC', [fact({ sourceKind: 'governmentSurvivor', survivorIssuer, recipientAgeYears: 62 })])).toBe(accepted))
  it('does not extend the survivor limb to age61, other issuers or ordinary pensions', () => {
    expect(exclusion('DC', [fact({ sourceKind: 'governmentSurvivor', survivorIssuer: 'federal', recipientAgeYears: 61 })])).toBe(0)
    expect(exclusion('DC', [fact({ sourceKind: 'governmentSurvivor', survivorIssuer: 'other', recipientAgeYears: 62 })])).toBe(0)
    expect(exclusion('DC', [fact({ sourceKind: 'federalCivilService', recipientAgeYears: 65 })])).toBe(0)
    expect(annual('DC', { retirementDistributions: [fact({ sourceKind: 'governmentSurvivor', recipientAgeYears: 62 })] }).status).toBe('incomplete')
  })
})
describeRule('ct-personal-exemption-and-ct-agi-schedule', { readings: { discreteStep: 9_000, continuousProration: 9_999 }, accepted: 'discreteStep' }, ({ accepted }) => {
  it('uses Connecticut AGI, and a dollar into the next thousand removes $1,000', () => {
    const at = annual('CT', { householdFacts: household({ connecticutAgi: 35_000 }) }, { ordinaryIncome: 35_001 })
    const over = annual('CT', { householdFacts: household({ connecticutAgi: 35_001 }) }, { ordinaryIncome: 35_001 })
    expect(35_001 - over.taxableIncome).toBe(accepted)
    expect(over.taxableIncome - at.taxableIncome).toBe(1_000)
  })
  it.each([
    ['single', 30_000, 15_000], ['marriedFilingSeparately', 24_000, 12_000],
    ['headOfHousehold', 38_000, 19_000], ['marriedFilingJointly', 48_000, 24_000],
    ['qualifyingSurvivingSpouse', 48_000, 24_000],
  ] as const)('selects %s statutory exemption schedule', (stateFilingStatus, connecticutAgi, amount) => {
    expect(100_000 - annual('CT', { householdFacts: household({ stateFilingStatus, connecticutAgi }) }).taxableIncome).toBe(amount)
  })
  it('does not use known federal AGI as a substitute for unknown Connecticut AGI', () => expect(annual('CT').status).toBe('incomplete'))
})

describeRule('hi-head-of-household-rate-schedule', { readings: { hohFirstBand: 201.6, singleBand: 374.4 }, accepted: 'hohFirstBand' }, ({ accepted }) => {
  it('prices the $21,600 second HOH band edge at $432', () => {
    // Hawaii HOH schedule: $14,400 x 1.4% + $7,200 x 3.2%.
    const options = { standardDeductionAllowedOverride: 0, householdFacts: household({ stateFilingStatus: 'headOfHousehold' }) }
    expect(annual('HI', options, { ordinaryIncome: 21_600 }).amount).toBeCloseTo(432, 8)
    expect(annual('HI', options, { ordinaryIncome: 21_601 }).amount).toBeCloseTo(432.055, 8)
  })
  it('prices $14,400 taxable income using HOH schedule rather than single', () => {
    const result = annual('HI', { standardDeductionAllowedOverride: 0, householdFacts: household({ stateFilingStatus: 'headOfHousehold' }) }, { ordinaryIncome: 14_400 })
    expect(result.amount).toBeCloseTo(accepted, 6)
    expect(annual('HI', { standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 14_400 }).amount).not.toBeCloseTo(accepted, 6)
  })
})
describeRule('id-code-63-3022a-qualified-retirement-deduction', { readings: { namedPlanOffset: 39_824, ignoreSocialSecurity: 49_824 }, accepted: 'namedPlanOffset' }, ({ accepted }) => {
  it('applies the published $49,824 cap less $10,000 gross SS to CSRS', () => {
    const hh = household({ householdGrossSocialSecurity: 10_000 })
    expect(exclusion('ID', [fact({ sourceKind: 'federalCivilService', planSystemCode: 'CSRS', recipientAgeYears: 65, federallyIncludedAmount: 60_000 })], hh)).toBe(accepted)
    expect(exclusion('ID', [fact({ sourceKind: 'federalCivilService', planSystemCode: 'FERS', recipientAgeYears: 65, federallyIncludedAmount: 60_000 })], hh)).toBe(0)
    expect(exclusion('ID', [fact({ sourceKind: 'ordinaryPrivatePension', recipientAgeYears: 65 })], hh)).toBe(0)
  })
  it('keeps the MFS refusal and age/disability boundary', () => {
    const csrs = fact({ sourceKind: 'federalCivilService', planSystemCode: 'CSRS', recipientAgeYears: 61, recipientDisabled: true })
    expect(exclusion('ID', [csrs])).toBe(0)
    expect(exclusion('ID', [{ ...csrs, recipientAgeYears: 62 }])).toBe(12_000)
    expect(exclusion('ID', [{ ...csrs, recipientAgeYears: 65 }], household({ stateFilingStatus: 'marriedFilingSeparately' }))).toBe(0)
  })
})
describeRule('il-ita-203-a-2-F-retirement-income-subtraction', { readings: { includedQualifiedPlan: 12_000, taxableRetirement: 0 }, accepted: 'includedQualifiedPlan' }, ({ accepted }) => {
  it('removes qualifying IRA income already in federal AGI', () => {
    expect(exclusion('IL', [fact({ sourceKind: 'ira' })])).toBe(accepted)
  })
  it('removes qualifying employer-plan income already in federal AGI', () => {
    expect(exclusion('IL', [fact({ sourceKind: 'employerPlan' })])).toBe(accepted)
  })
  it('removes qualifying private-pension income already in federal AGI', () => {
    expect(exclusion('IL', [fact({ sourceKind: 'ordinaryPrivatePension' })])).toBe(accepted)
  })
})
describeRule('il-personal-exemption-2026', { readings: { personalPlusAge: 3_925, personalOnly: 2_925 }, accepted: 'personalPlusAge' }, ({ accepted }) => {
  it('uses $2,925 plus $1,000 age65 and removes it above the income cutoff', () => {
    expect(100_000 - annual('IL', { householdFacts: household({ age65EligibleCount: 1 }) }).taxableIncome).toBe(accepted)
    expect(annual('IL', { householdFacts: household({ federalAgi: 250_001, age65EligibleCount: 1 }) }).taxableIncome).toBe(100_000)
  })
})
describeRule('ks-stat-79-32-117-public-pension-exclusion', { readings: { namedPublicSystem: 12_000, genericPublicLabel: 0 }, accepted: 'namedPublicSystem' }, ({ accepted }) => {
  it('subtracts each enumerated Kansas and federal retirement-system family', () => {
    // K.S.A. 79-32,117 source enumeration, including city/BPU/Washburn/Overland Park.
    const systems = ['KPERS', 'KP&F', 'KSRS', 'US-CSRS', 'US-FERS', 'US-MILITARY', 'RRB', 'KS-13-14-106-CITY', 'KS-BPU', 'KS-WASHBURN', 'KS-OVERLAND-PARK-POLICE-FIRE']
    for (const planSystemCode of systems) {
      expect(exclusion('KS', [fact({ sourceKind: 'stateLocalPublic', planSystemCode })]), planSystemCode).toBe(accepted)
    }
    expect(exclusion('KS', [fact({ sourceKind: 'railroadTier2' })])).toBe(12_000)
    expect(exclusion('KS', [fact({ sourceKind: 'ordinaryPrivatePension', planSystemCode: 'KS-BPU' })])).toBe(0)
  })
  it('requires a named system such as KPERS', () => {
    expect(exclusion('KS', [fact({ sourceKind: 'stateLocalPublic', planSystemCode: 'KPERS' })])).toBe(accepted)
    expect(exclusion('KS', [fact({ sourceKind: 'stateLocalPublic', planSystemCode: 'CITY-OTHER' })])).toBe(0)
    expect(exclusion('KS', [fact({ sourceKind: 'ordinaryPrivatePension' })])).toBe(0)
  })
})
describeRule('ky-dor-2026-standard-deduction-once-per-return', { readings: { oncePerReturn: 6_640, twiceForJoint: 3_280 }, accepted: 'oncePerReturn' }, ({ accepted }) => {
  it('deducts $3,360 once from $10,000 on a joint return', () => expect(annual('KY', {}, { filingStatus: 'marriedFilingJointly', ordinaryIncome: 10_000 }).taxableIncome).toBe(accepted))
})

describe('Maryland §10-209 actual-plan/benefit worksheet', () => {
  it('prices the known coarse maximum and identifies the required offset discriminator', () => {
    // The coarse implementation is deliberately still classified approximated.
    // It grants40600; authority requires min(50000,40600-20000)=20600.
    const baseline = annual('MD', {}, { ordinaryIncome: 100_000, agesAlive: [65] })
    const coarse = computeStateTaxYearResult(input('MD', { ordinaryIncome: 100_000, privateRetirementIncome: 50_000, agesAlive: [65], ssBenefits: 20_000 }), { qcdEvents: [], hsaAccounts: [] })
    expect(baseline.taxableIncome - coarse.taxableIncome).toBe(40_600)
    expect(baseline.taxableIncome - coarse.taxableIncome).not.toBe(20_600)
  })
})
describeRule('ma-personal-exemptions-and-surtax', { readings: { marginalSurtax: 63_690, surtaxWholeIncome: 108_000 }, accepted: 'marginalSurtax' }, ({ accepted }) => {
  it('adds 4% only to $1.2m minus the $1,107,750 threshold', () => {
    expect(annual('MA', { standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 1_200_000 }).amount).toBeCloseTo(accepted, 8)
    expect(annual('MA', { standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 1_107_750 }).amount).toBeCloseTo(55_387.5, 8)
  })
  it.each([['single', 0, 4_400], ['headOfHousehold', 1, 7_500], ['marriedFilingJointly', 2, 10_200]] as const)('selects %s personal/age exemptions', (stateFilingStatus, age65EligibleCount, expected) => {
    expect(100_000 - annual('MA', { householdFacts: household({ stateFilingStatus, age65EligibleCount }) }).taxableIncome).toBe(expected)
  })
})
describeRule('ma-private-pension-basis-recovery', { readings: { stateBasis: 6_000, federalBasisAssumption: 0 }, accepted: 'stateBasis' }, ({ accepted }) => {
  it('recovers known Massachusetts basis once across two distributions', () => {
    const rows = [fact({ federallyIncludedAmount: 4_000, knownPreviouslyTaxedBasis: 6_000 }), fact({ federallyIncludedAmount: 4_000, knownPreviouslyTaxedBasis: 6_000 })]
    expect(exclusion('MA', rows)).toBe(accepted)
    expect(annual('MA', { retirementDistributions: rows }).pensionBasisPools?.[0]).toMatchObject({ basisConsumed: 6_000, closingBasis: 0 })
    expect(annual('MA', { retirementDistributions: [fact({ knownPreviouslyTaxedBasis: undefined })] }).status).toBe('incomplete')
  })
})
describeRule('ma-rrb-and-public-pension-exclusions', { readings: { provenContributory: 12_000, taxableNoncontributory: 0 }, accepted: 'provenContributory' }, ({ accepted }) => {
  it('requires contributory in-state or reciprocal public-system proof', () => {
    expect(exclusion('MA', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: true, priorTaxState: 'MA' })])).toBe(accepted)
    expect(exclusion('MA', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: true, priorTaxState: 'CA', reciprocitySatisfied: 'true' })])).toBe(12_000)
    expect(exclusion('MA', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: true, priorTaxState: 'CA', reciprocitySatisfied: 'false' })])).toBe(0)
    expect(exclusion('MA', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: false, priorTaxState: 'MA' })])).toBe(0)
    expect(annual('MA', { retirementDistributions: [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: true })] }).status).toBe('incomplete')
  })
  it.each(['militaryRetirement', 'militarySurvivor', 'railroadTier1', 'railroadTier2', 'railroadRetirementAct'] as const)('selects the separate %s exclusion', (sourceKind) => expect(exclusion('MA', [fact({ sourceKind })])).toBe(12_000))
})
describeRule('nj-stat-54a-6-26-military-pension-exclusion', { readings: { military: 80_000, ordinaryPensionCap: 0 }, accepted: 'military' }, ({ accepted }) => {
  it('excludes military at age50 while OPM remains taxable', () => {
    const changes = { agesAlive: [50] }
    expect(exclusion('NJ', [fact({ sourceKind: 'militaryRetirement', recipientAgeYears: 50, federallyIncludedAmount: 80_000 })], household(), changes)).toBe(accepted)
    expect(exclusion('NJ', [fact({ sourceKind: 'federalCivilService', recipientAgeYears: 50, federallyIncludedAmount: 80_000 })], household(), changes)).toBe(0)
    expect(exclusion('NJ', [fact({ sourceKind: 'militarySurvivor', recipientAgeYears: 50 })], household(), changes)).toBe(12_000)
  })
})

describe('South Carolina separate §1170/§1171 source and owner pools', () => {
  it('caps ordinary public income but fully excludes qualifying military', () => {
    expect(exclusion('SC', [fact({ sourceKind: 'stateLocalPublic', recipientAgeYears: 50, federallyIncludedAmount: 60_000 })])).toBe(3_000)
    expect(exclusion('SC', [fact({ sourceKind: 'militaryRetirement', recipientAgeYears: 50, federallyIncludedAmount: 60_000 })])).toBe(60_000)
    expect(exclusion('SC', [fact({ recipientAgeYears: 65, federallyIncludedAmount: 20_000 })])).toBe(10_000)
  })
  it('rejects premature and unknown-penalty distributions', () => {
    expect(exclusion('SC', [fact({ earlyDistributionDisqualifier: 'true' })])).toBe(0)
    expect(exclusion('SC', [fact({ earlyDistributionDisqualifier: 'unknown' })])).toBe(0)
    expect(annual('SC', { retirementDistributions: [fact({ earlyDistributionDisqualifier: 'unknown' })] }).status).toBe('incomplete')
  })
})
describeRule('sc-code-12-6-1170-b-age-65-deduction', { readings: { sharedOwnerLimit: 15_000, stackedLimits: 25_000 }, accepted: 'sharedOwnerLimit' }, ({ accepted }) => {
  it('grants $10,000 pension plus $5,000 residual age65 allowance', () => {
    const hh = household({ ownerStateTaxFacts: [{ ownerPersonId: 'owner', remainingScIncome: 30_000 }] })
    expect(exclusion('SC', [fact({ recipientAgeYears: 65, federallyIncludedAmount: 20_000 })], hh)).toBe(accepted)
  })
  it('tracks two eligible owners separately', () => {
    const hh = household({ ownerStateTaxFacts: [{ ownerPersonId: 'a', remainingScIncome: 30_000 }, { ownerPersonId: 'b', remainingScIncome: 30_000 }] })
    expect(exclusion('SC', [fact({ recipientAgeYears: 65, ownerPersonId: 'a' }), fact({ recipientAgeYears: 65, ownerPersonId: 'b' })], hh)).toBe(30_000)
  })
})
describeRule('sc-sciad-act-110-retirement-income-deduction', { readings: { roundedReduction: 12_280, federalStandardDeduction: 16_100 }, accepted: 'roundedReduction' }, ({ accepted }) => {
  it('reduces $15,000 by floor(($10k/$55k)*$15k / $10)*$10', () => {
    expect(50_000 - annual('SC', { householdFacts: household({ federalAgi: 50_000 }) }, { ordinaryIncome: 50_000 }).taxableIncome).toBe(accepted)
    expect(annual('SC', { householdFacts: household({ federalAgi: 95_000 }) }, { ordinaryIncome: 95_000 }).taxableIncome).toBe(95_000)
  })
  it.each([['headOfHousehold', 22_500], ['marriedFilingJointly', 30_000], ['qualifyingSurvivingSpouse', 30_000], ['marriedFilingSeparately', 15_000]] as const)('keeps %s distinct', (stateFilingStatus, expected) => {
    expect(40_000 - annual('SC', { householdFacts: household({ stateFilingStatus, federalAgi: 40_000 }) }, { ordinaryIncome: 40_000 }).taxableIncome).toBe(expected)
  })
})

describeRule('mo-retirement-income-deduction', { readings: { phasedPrivate: 3_000, ignoreHouseholdIncome: 6_000 }, accepted: 'phasedPrivate' }, ({ accepted }) => {
  it('phases private pension dollar-for-dollar above $25,000 single', () => {
    expect(exclusion('MO', [fact({ federallyIncludedAmount: 6_000 })], household({ federalAgi: 28_000, missouriIncome: 28_000 }), { ordinaryIncome: 28_000 })).toBe(accepted)
    expect(exclusion('MO', [fact({ federallyIncludedAmount: 6_000 })], household({ federalAgi: 31_000, missouriIncome: 31_000 }), { ordinaryIncome: 31_000 })).toBe(0)
  })
  it('uses a different public limit and independent military/RRB exclusions', () => {
    const hh = household({ missouriIncome: 100_000, federallyIncludedSocialSecurity: 10_000 })
    expect(exclusion('MO', [fact({ sourceKind: 'stateLocalPublic', federallyIncludedAmount: 50_000, taxableSocialSecurityAllocated: 10_000 })], hh)).toBe(38_967)
    expect(exclusion('MO', [fact({ sourceKind: 'militaryRetirement' })], hh)).toBe(12_000)
    expect(exclusion('MO', [fact({ sourceKind: 'railroadTier2' })], hh)).toBe(12_000)
    expect(annual('MO', { retirementDistributions: [fact()] }).status).toBe('incomplete')
  })
})
describeRule('mt-long-term-capital-gain-schedule', { readings: { stackedGainTax: 35.5, allAtLowerRate: 30 }, accepted: 'stackedGainTax' }, ({ accepted }) => {
  it('uses distinct HOH and MFS ordinary thresholds and stacks gains across their edges', () => {
    // HB337: HOH boundary $71,250, MFS $47,500; $500 of gain on each side.
    for (const [stateFilingStatus, boundary] of [['headOfHousehold', 71_250], ['marriedFilingSeparately', 47_500]] as const) {
      const hh = household({ stateFilingStatus, montanaNetTaxableLtcg: 0 })
      const options = { standardDeductionAllowedOverride: 0, householdFacts: hh }
      expect(annual('MT', options, { ordinaryIncome: boundary }).amount).toBeCloseTo(boundary * 0.047, 8)
      expect(annual('MT', options, { ordinaryIncome: boundary + 1_000 }).amount).toBeCloseTo(boundary * 0.047 + 56.5, 8)
      const noGain = annual('MT', options, { ordinaryIncome: boundary - 500 })
      const withGain = annual('MT', { ...options, householdFacts: { ...hh, montanaNetTaxableLtcg: 1_000 } }, { ordinaryIncome: boundary - 500, capitalGains: 1_000 })
      expect(withGain.amount - noGain.amount).toBeCloseTo(35.5, 8)
    }
  })
  it('stacks $1,000 gain after $47,000 ordinary taxable income', () => {
    // MCA15-30-2103: 3% to47500,4.1% thereafter.500*3%+500*4.1%=35.50.
    const options = { standardDeductionAllowedOverride: 0, householdFacts: household({ montanaNetTaxableLtcg: 1_000 }) }
    const withGain = annual('MT', options, { ordinaryIncome: 47_000, capitalGains: 1_000 })
    const noGain = annual('MT', { ...options, householdFacts: household({ montanaNetTaxableLtcg: 0 }) }, { ordinaryIncome: 47_000 })
    expect(withGain.amount - noGain.amount).toBeCloseTo(accepted, 8)
    expect(annual('MT', { standardDeductionAllowedOverride: 0, householdFacts: household({ montanaNetTaxableLtcg: 10_000 }) }, { ordinaryIncome: 0, capitalGains: 10_000 }).amount).toBeCloseTo(300, 8)
  })
})
describeRule('or-316-157-retirement-income-credit', { readings: { ninePercent: 675, omittedCredit: 0 }, accepted: 'ninePercent' }, ({ accepted }) => {
  it('includes IRA federal public and Armed Forces pension sources under section 316.157', () => {
    // ORS 316.157(2)(e): $7,500 qualified pension x 9% with no offset.
    for (const sourceKind of ['ira', 'employerPlan', 'ordinaryPrivatePension', 'federalCivilService', 'stateLocalPublic', 'militaryRetirement'] as const) {
      const result = annual('OR', { standardDeductionAllowedOverride: 0, householdFacts: household({ oregonHouseholdIncome: 15_000 }), retirementDistributions: [fact({ sourceKind, recipientAgeYears: 62, federallyIncludedAmount: 7_500 })] }, { ordinaryIncome: 15_000 })
      expect(result.taxCredit, sourceKind).toBe(accepted)
    }
  })
  it('offsets Tier I but not Tier II and cannot borrow an older nonpension recipient age', () => {
    const pension = fact({ sourceKind: 'ira', recipientAgeYears: 62, federallyIncludedAmount: 7_500 })
    const hh = household({ oregonHouseholdIncome: 15_000, householdGrossRailroadBenefits: 2_000, recipientSocialSecurity: [{ ownerPersonId: 'owner', ageYears: 62, grossSocialSecurity: 0, grossRailroadTier1: 0 }] })
    const options = { standardDeductionAllowedOverride: 0, householdFacts: hh, retirementDistributions: [pension] }
    expect(annual('OR', options, { ordinaryIncome: 15_000 }).taxCredit).toBe(675)
    expect(annual('OR', { ...options, householdFacts: { ...hh, recipientSocialSecurity: [{ ...hh.recipientSocialSecurity![0]!, grossRailroadTier1: 2_000 }] } }, { ordinaryIncome: 15_000 }).taxCredit).toBe(495)
    const young = { ...pension, recipientAgeYears: 61 }
    const olderRailroad = fact({ ownerPersonId: 'spouse', sourceKind: 'railroadTier2', recipientAgeYears: 70, federallyIncludedAmount: 2_000 })
    expect(annual('OR', { ...options, retirementDistributions: [young, olderRailroad] }, { ordinaryIncome: 15_000 }).taxCredit).toBe(0)
  })
  it('credits 9% of the $7,500 ceiling for a qualifying age62 taxpayer', () => {
    const result = annual('OR', { retirementDistributions: [fact({ recipientAgeYears: 62, federallyIncludedAmount: 7_500 })], householdFacts: household({ federalAgi: 15_000, oregonHouseholdIncome: 15_000 }), standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 15_000 })
    expect(result.taxCredit).toBe(accepted)
    expect(result.amount).toBeGreaterThanOrEqual(0)
  })
  it('offsets SS and excess household income, and never refunds unused credit', () => {
    const rows = [fact({ recipientAgeYears: 62, federallyIncludedAmount: 7_500 })]
    const offset = annual('OR', { retirementDistributions: rows, householdFacts: household({ oregonHouseholdIncome: 17_000, householdGrossSocialSecurity: 1_000 }), standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 17_000 })
    expect(offset.taxCredit).toBe(405) // (7500-2000-1000)*9%
    const small = annual('OR', { retirementDistributions: [fact({ recipientAgeYears: 62, federallyIncludedAmount: 1_000 })], householdFacts: household({ oregonHouseholdIncome: 1_000 }), standardDeductionAllowedOverride: 0 }, { ordinaryIncome: 1_000 })
    expect(small.amount).toBe(0)
    expect(small.taxCredit).toBeLessThanOrEqual(90)
    expect(annual('OR', { retirementDistributions: [fact({ recipientAgeYears: 61 })], householdFacts: household({ oregonHouseholdIncome: 15_000 }) }).taxCredit).toBe(0)
  })
})

const utHousehold = (change: Partial<StateHouseholdTaxFacts> = {}) => household({
  federalAgi: 30_000, interestExcludedFromFederalAgi: 0, utahSection59_10_114Additions: 0,
  socialSecurityIncludedInUtahTaxableIncome: 0, claimantDatesOfBirth: ['1953-01-01'],
  utahCreditElection: 'socialSecurityAndMilitary', utahCreditApportionment: 1, ...change,
})
describeRule('ut-code-59-10-1043-military-retirement-credit', { readings: { creditAt445: 890, former45Rate: 900 }, accepted: 'creditAt445' }, ({ accepted }) => {
  it('limits the $890 military credit to $500 of precredit Utah liability', () => {
    // Section 1043 is nonrefundable. Net income after other losses produces
    // $500 liability at 4.45%; the included $20,000 military benefit yields $890.
    const netIncome = 500 / 0.0445
    const facts = utHousehold({ federalAgi: netIncome })
    const baseline = annual('UT', { householdFacts: facts }, { ordinaryIncome: netIncome })
    expect(baseline.amount).toBeCloseTo(500, 8)
    const result = annual('UT', { householdFacts: facts, retirementDistributions: [fact({ sourceKind: 'militaryRetirement', grossDistribution: 20_000, federallyIncludedAmount: 20_000 })] }, { ordinaryIncome: netIncome })
    expect(result.taxCredit).toBeCloseTo(500, 8)
    expect(result.amount).toBe(0)
  })
  it('credits the current 4.45% of $20,000 qualifying military income', () => {
    const result = annual('UT', { householdFacts: utHousehold(), retirementDistributions: [fact({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 20_000 })] }, { ordinaryIncome: 30_000 })
    expect(result.taxCredit).toBe(accepted)
    expect(result.amount).toBeCloseTo(445, 8)
    expect(annual('UT', { householdFacts: utHousehold(), retirementDistributions: [fact({ sourceKind: 'federalCivilService', federallyIncludedAmount: 20_000 })] }, { ordinaryIncome: 30_000 }).taxCredit).toBe(0)
  })
})
describeRule('ut-code-59-10-114-social-security-tax-credit', { readings: { includedBenefitsOnly: 1_335, creditGrossBenefits: 1_128.075 }, accepted: 'includedBenefitsOnly' }, ({ accepted }) => {
  it('uses $5,350 federally taxable SS, not the $10,000 gross benefit', () => {
    // IRC86: ordinary30k+grossSS10k ->5350taxable.35350*.0445-5350*.0445=1335.
    const result = annual('UT', { householdFacts: utHousehold({ federalAgi: 35_350, socialSecurityIncludedInUtahTaxableIncome: 5_350 }) }, { ordinaryIncome: 30_000, ssBenefits: 10_000 })
    expect(result.amount).toBeCloseTo(accepted, 8)
    const invalid = annual('UT', { householdFacts: utHousehold({ federalAgi: 35_350, socialSecurityIncludedInUtahTaxableIncome: 10_000 }) }, { ordinaryIncome: 30_000, ssBenefits: 10_000 })
    expect(invalid.status).toBe('incomplete')
    expect(invalid.taxCredit).toBeLessThanOrEqual(238.075)
  })
  it('includes otherwise-excluded interest in statutory MAGI phaseout', () => {
    const base = { ordinaryIncome: 60_000, ssBenefits: 20_000 }
    const low = annual('UT', { householdFacts: utHousehold({ federalAgi: 77_000, socialSecurityIncludedInUtahTaxableIncome: 17_000 }) }, base)
    const high = annual('UT', { householdFacts: utHousehold({ federalAgi: 77_000, socialSecurityIncludedInUtahTaxableIncome: 17_000, interestExcludedFromFederalAgi: 1_000 }) }, base)
    expect(low.taxCredit - high.taxCredit).toBeCloseTo(25, 8)
  })
})
describeRule('ut-code-59-10-1019-retirement-credit', { readings: { twoEligibleCohorts: 700, perSpouseSeparateElection: 900 }, accepted: 'twoEligibleCohorts' }, ({ accepted }) => {
  it('uses the return-level $900 maximum less $200 phaseout', () => {
    const hh = utHousehold({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 40_000, claimantDatesOfBirth: ['1952-12-31', '1950-01-01'], utahCreditElection: 'retirement' })
    expect(annual('UT', { householdFacts: hh }, { filingStatus: 'marriedFilingJointly', ordinaryIncome: 40_000 }).taxCredit).toBe(accepted)
    expect(annual('UT', { householdFacts: utHousehold({ claimantDatesOfBirth: ['1953-01-01'], utahCreditElection: 'retirement' }) }, { ordinaryIncome: 30_000 }).taxCredit).toBe(0)
    expect(annual('UT', { householdFacts: utHousehold({ federalAgi: 0, claimantDatesOfBirth: ['1952-12-31'], utahCreditElection: 'retirement' }) }, { ordinaryIncome: 0 }).amount).toBe(0)
  })
})
describeRule('ut-code-59-10-114-2-d-railroad-benefits-not-modeled', { readings: { federalIncluded: 12_000, grossBenefit: 20_000 }, accepted: 'federalIncluded' }, ({ accepted }) => {
  it('subtracts only federally included Railroad Retirement and requires SS overlap facts', () => {
    const hh = utHousehold({ railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome: 0 })
    expect(exclusion('UT', [fact({ sourceKind: 'railroadTier2', grossDistribution: 20_000 })], hh)).toBe(accepted)
    expect(annual('UT', { householdFacts: utHousehold(), retirementDistributions: [fact({ sourceKind: 'railroadTier1' })] }).status).toBe('incomplete')
    expect(annual('UT', { householdFacts: hh, retirementDistributions: [fact({ sourceKind: 'railroadTier2', grossDistribution: 1_000 })] }).status).toBe('incomplete')
  })
})
describeRule('ut-code-59-10-114-2-i-401a-prior-state-tax-subtraction', { readings: { documented401aBasis: 6_000, allRetirementBasis: 0 }, accepted: 'documented401aBasis' }, ({ accepted }) => {
  it('recovers documented other-state §401(a) basis once and excludes 403b/IRA substitutes', () => {
    const row = fact({ sourceKind: 'employerPlan', qualifiedPlanType: '401a', knownPreviouslyTaxedBasis: 6_000, priorTaxState: 'CA', federallyIncludedAmount: 4_000 })
    expect(exclusion('UT', [row, row], utHousehold())).toBe(accepted)
    expect(exclusion('UT', [{ ...row, qualifiedPlanType: '403b' }], utHousehold())).toBe(0)
    expect(exclusion('UT', [{ ...row, sourceKind: 'ira', qualifiedPlanType: 'ira' }], utHousehold())).toBe(0)
    expect(annual('UT', { householdFacts: utHousehold(), retirementDistributions: [{ ...row, knownPreviouslyTaxedBasis: undefined }] }).status).toBe('incomplete')
  })
})

describeRule('va-code-58-1-322-02-28-military-retirement-subtraction', { readings: { currentPerOwnerCap: 40_000, priorYearCap: 30_000 }, accepted: 'currentPerOwnerCap' }, ({ accepted }) => {
  it('uses $40,000 per recipient at any age from2025, including qualified survivors', () => {
    const military = fact({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 50_000, recipientAgeYears: 50 })
    expect(exclusion('VA', [military])).toBe(accepted)
    expect(exclusion('VA', [military, { ...military, ownerPersonId: 'spouse', sourceKind: 'militarySurvivor' }])).toBe(80_000)
    expect(exclusion('VA', [{ ...military, sourceKind: 'federalCivilService' }])).toBe(0)
  })
})
describeRule('va-code-58-1-322-02-3-ss-tier1', { readings: { tier1: 12_000, tier2InParagraph3: 0 }, accepted: 'tier1' }, ({ accepted }) => {
  it('selects Tier I and does not claim ordinary annuity or Tier II under paragraph3', () => {
    expect(exclusion('VA', [fact({ sourceKind: 'railroadTier1' })])).toBe(accepted)
    expect(exclusion('VA', [fact({ sourceKind: 'railroadTier2' })])).toBe(0)
    expect(exclusion('VA', [fact()])).toBe(0)
    expect(annual('VA', {}, { ssBenefits: 30_000 }).taxableIncome).toBe(annual('VA').taxableIncome)
  })
})
describeRule('va-code-58-1-322-02-11-basis', { readings: { qualifyingPriorStateBasis: 6_000, unboundedRecovery: 8_000 }, accepted: 'qualifyingPriorStateBasis' }, ({ accepted }) => {
  it('recovers only documented prior-state contributions once across annual events', () => {
    const row = fact({ sourceKind: 'employerPlan', qualifiedPlanType: '401a', priorTaxState: 'CA', knownPreviouslyTaxedBasis: 6_000, federallyIncludedAmount: 4_000 })
    expect(exclusion('VA', [row, row])).toBe(accepted)
    expect(exclusion('VA', [{ ...row, priorTaxState: undefined }])).toBe(0)
    expect(exclusion('VA', [{ ...row, priorTaxState: 'VA', planSystemCode: 'VRS' }])).toBe(0)
    expect(annual('VA', { retirementDistributions: [{ ...row, knownPreviouslyTaxedBasis: undefined }] }).status).toBe('incomplete')
  })
})

const vtHousehold = (change: Partial<StateHouseholdTaxFacts> = {}) => household({
  federalAgi: 100_000, vermontUsObligationAdjustment: 0, vermontRetirementElection: 'civilService', ...change,
})
describeRule('vt-2026-rates-standard-deduction-minimum-tax', { readings: { continuousMfjBase: 18_915.55, roundedPreliminaryDisplay: 18_916 }, accepted: 'continuousMfjBase' }, ({ accepted }) => {
  it('uses the exact marginal arithmetic at the joint top threshold', () => {
    expect(annual('VT', { standardDeductionAllowedOverride: 0, householdFacts: vtHousehold({ stateFilingStatus: 'marriedFilingJointly', federalAgi: 312_050 }) }, { filingStatus: 'marriedFilingJointly', ordinaryIncome: 312_050 }).amount).toBeCloseTo(accepted, 8)
  })
  it.each([['single', 7_850], ['marriedFilingSeparately', 7_850], ['headOfHousehold', 11_800], ['marriedFilingJointly', 15_700], ['qualifyingSurvivingSpouse', 15_700]] as const)('uses statute/CPI-derived %s deduction plus exemption and §63f', (stateFilingStatus, sd) => {
    expect(100_000 - annual('VT', { householdFacts: vtHousehold({ stateFilingStatus, section63fQualificationCount: 1 }) }).taxableIncome).toBe(sd + 5_400 + 1_300)
  })
})
describeRule('vt-32-5822-a-6-minimum-tax', { readings: { threePercentFloor: 6_000, ordinaryOnly: 1_231.125 }, accepted: 'threePercentFloor' }, ({ accepted }) => {
  it('compares rather than adds the floor and supports the U.S.-obligation adjustment', () => {
    const rows = [fact({ sourceKind: 'railroadTier2', federallyIncludedAmount: 150_000, grossDistribution: 150_000 })]
    expect(annual('VT', { retirementDistributions: rows, householdFacts: vtHousehold({ federalAgi: 200_000 }) }, { ordinaryIncome: 200_000 }).amount).toBe(accepted)
    expect(annual('VT', { retirementDistributions: rows, householdFacts: vtHousehold({ federalAgi: 200_000, vermontUsObligationAdjustment: 600 }) }, { ordinaryIncome: 200_000, usGovernmentInterest: 20_000 }).amount).toBe(5_400)
    const boundary = annual('VT', { retirementDistributions: [fact({ sourceKind: 'railroadTier2', federallyIncludedAmount: 100_000, grossDistribution: 100_000 })], householdFacts: vtHousehold({ federalAgi: 150_000 }) }, { ordinaryIncome: 150_000 })
    expect(boundary.amount).toBeLessThan(4_500)
    expect(annual('VT', { householdFacts: vtHousehold({ federalAgi: 200_000, vermontUsObligationAdjustment: undefined }) }, { ordinaryIncome: 200_000 }).status).toBe('incomplete')
  })
})
describeRule('vt-32-5830e-retirement-election', { readings: { halfPhaseout: 5_000, flatFullDeduction: 10_000 }, accepted: 'halfPhaseout' }, ({ accepted }) => {
  it('phases CSRS at$60k and makes the civil/SS election exclusive', () => {
    const rows = [fact({ sourceKind: 'federalCivilService', planSystemCode: 'CSRS', publicPlanContributory: true })]
    expect(exclusion('VT', rows, vtHousehold({ federalAgi: 60_000 }), { ordinaryIncome: 60_000 })).toBe(accepted)
    expect(exclusion('VT', rows, vtHousehold({ federalAgi: 65_000 }), { ordinaryIncome: 65_000 })).toBe(0)
    expect(exclusion('VT', rows, vtHousehold({ federalAgi: 60_000, vermontRetirementElection: 'socialSecurity', federallyIncludedSocialSecurity: 0 }), { ordinaryIncome: 60_000 })).toBe(0)
    expect(exclusion('VT', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: false })], vtHousehold({ federalAgi: 55_000 }), { ordinaryIncome: 55_000 })).toBe(0)
  })
})
describeRule('vt-32-5830e-d-military-survivor', { readings: { halfMilitary: 6_000, noPhaseout: 12_000 }, accepted: 'halfMilitary' }, ({ accepted }) => {
  it('phases military at$150k and preserves the independent election', () => {
    const rows = [fact({ sourceKind: 'militarySurvivor' })]
    expect(exclusion('VT', rows, vtHousehold({ federalAgi: 150_000 }), { ordinaryIncome: 150_000 })).toBe(accepted)
    expect(exclusion('VT', rows, vtHousehold({ federalAgi: 175_000 }), { ordinaryIncome: 175_000 })).toBe(0)
    expect(exclusion('VT', [fact({ sourceKind: 'militaryRetirement' }), fact({ sourceKind: 'federalCivilService', planSystemCode: 'CSRS' })], vtHousehold({ federalAgi: 55_000 }), { ordinaryIncome: 55_000 })).toBe(22_000)
  })
})
describeRule('vt-32-5823-railroad-exclusion', { readings: { bothTiers: 24_000, tier1Only: 12_000 }, accepted: 'bothTiers' }, ({ accepted }) => {
  it('subtracts both included tiers without requiring a Social Security election', () => expect(exclusion('VT', [fact({ sourceKind: 'railroadTier1' }), fact({ sourceKind: 'railroadTier2' })], vtHousehold())).toBe(accepted))
})

describeRule('wi-2026-rates-standard-deduction-exemptions', { readings: { taxpayerAndAge: 950, personalOnly: 700 }, accepted: 'taxpayerAndAge' }, ({ accepted }) => {
  it('matches Form 1-ES cumulative taxes at all Schedule A B and C band edges', () => {
    // Form 1-ES TY2026 schedules: prior-band tax plus the width at its marginal rate.
    const schedules = [
      { status: 'single', edges: [15_110, 51_950, 332_720], taxes: [528.85, 528.85 + 36_840 * 0.044, 528.85 + 36_840 * 0.044 + 280_770 * 0.053] },
      { status: 'marriedFilingJointly', edges: [20_150, 69_260, 443_630], taxes: [705.25, 705.25 + 49_110 * 0.044, 705.25 + 49_110 * 0.044 + 374_370 * 0.053] },
      { status: 'marriedFilingSeparately', edges: [10_080, 34_630, 221_820], taxes: [352.8, 352.8 + 24_550 * 0.044, 352.8 + 24_550 * 0.044 + 187_190 * 0.053] },
    ] as const
    for (const schedule of schedules) {
      const options = { standardDeductionAllowedOverride: 0, householdFacts: household({ stateFilingStatus: schedule.status, exemptionTaxpayerCount: 0, claimedAsDependent: true, wisconsinIncomeForStandardDeduction: 500_000 }) }
      for (let index = 0; index < schedule.edges.length; index++) {
        expect(annual('WI', options, { ordinaryIncome: schedule.edges[index]! }).amount).toBeCloseTo(schedule.taxes[index]!, 8)
      }
      expect(annual('WI', options, { ordinaryIncome: schedule.edges[2] + 1_000 }).amount).toBeCloseTo(schedule.taxes[2] + 76.5, 8)
    }
  })
  it('adds the age65 exemption to the $700 personal allowance', () => {
    const noAge = annual('WI', { householdFacts: household({ wisconsinIncomeForStandardDeduction: 100_000 }) })
    const age = annual('WI', { householdFacts: household({ age65EligibleCount: 1, wisconsinIncomeForStandardDeduction: 100_000 }) })
    const dependent = annual('WI', { householdFacts: household({ claimedAsDependent: true, exemptionTaxpayerCount: 0, wisconsinIncomeForStandardDeduction: 100_000 }) })
    expect(noAge.taxableIncome - age.taxableIncome).toBe(250)
    expect(dependent.taxableIncome - age.taxableIncome).toBe(accepted)
  })
  it('uses the published2026 rates and floors the standard deduction at zero', () => {
    const result = annual('WI', { standardDeductionAllowedOverride: 0, householdFacts: household({ exemptionTaxpayerCount: 0, claimedAsDependent: true, wisconsinIncomeForStandardDeduction: 200_000 }) }, { ordinaryIncome: 10_000 })
    expect(result.amount).toBeCloseTo(350, 8)
    expect(annual('WI', { householdFacts: household({ exemptionTaxpayerCount: 0, claimedAsDependent: true, wisconsinIncomeForStandardDeduction: 200_000 }) }, { ordinaryIncome: 200_000 }).taxableIncome).toBe(200_000)
  })
})

describeRule('wv-code-11-21-exemptions-retirement-public-ss', { readings: { dependentSpecific: 500, everyFederalZero: 0 }, accepted: 'dependentSpecific' }, ({ accepted }) => {
  it('distinguishes §151(d)(2) and the surviving-spouse two-year addition', () => {
    expect(100_000 - annual('WV', { householdFacts: household({ federalExemptionCount: { known: true, value: 0 }, zeroFederalExemptionReason: 'irc151d2' }) }).taxableIncome).toBe(accepted)
    expect(100_000 - annual('WV', { householdFacts: household({ federalExemptionCount: { known: true, value: 2 } }) }).taxableIncome).toBe(4_000)
    expect(100_000 - annual('WV', { householdFacts: household({ survivingSpouseQualification: { deathYear: 2024, remarried: false } }) }).taxableIncome).toBe(4_000)
    expect(100_000 - annual('WV', { householdFacts: household({ survivingSpouseQualification: { deathYear: 2023, remarried: false } }) }).taxableIncome).toBe(2_000)
    expect(annual('WV', { householdFacts: household({ federalExemptionCount: { known: false } }) }).status).toBe('incomplete')
  })
})
describeRule('wv-code-11-21-12-c9-age-disability-residual', { readings: { residual: 5_000, stackedEightThousand: 8_000 }, accepted: 'residual' }, ({ accepted }) => {
  it('subtracts prior named modifications from each eligible owner’s $8,000 room', () => {
    const base = household()
    const hh = household({ ownerStateTaxFacts: [{ ownerPersonId: 'owner', westVirginiaEligibleAge65OrDisabled: true, westVirginiaRemainingFederalAgiIncome: 20_000, westVirginiaPriorNamedModifications: 3_000 }] })
    expect(annual('WV', { householdFacts: base }).taxableIncome - annual('WV', { householdFacts: hh }).taxableIncome).toBe(accepted)
    expect(annual('WV', { householdFacts: household({ ownerStateTaxFacts: [{ ownerPersonId: 'owner', westVirginiaEligibleAge65OrDisabled: true }] }) }).status).toBe('incomplete')
  })
})
describeRule('wv-code-11-21-12-c5-c6-public-retirement', { readings: { combinedCap: 2_000, eachSystemCap: 4_000 }, accepted: 'combinedCap' }, ({ accepted }) => {
  it('grants the $2,000 PERS or Teachers cap without a federal pension masking it', () => {
    // Section 11-21-12(c)(5) independently names both West Virginia systems.
    for (const planSystemCode of ['WV-PERS', 'WV-TEACHERS']) {
      expect(exclusion('WV', [fact({ sourceKind: 'stateLocalPublic', planSystemCode, federallyIncludedAmount: 3_000 })]), planSystemCode).toBe(accepted)
    }
    expect(exclusion('WV', [fact({ federallyIncludedAmount: 3_000 })])).toBe(0)
  })
  it('shares the public/federal limit and separates full police/fire benefits', () => {
    expect(exclusion('WV', [fact({ sourceKind: 'stateLocalPublic', planSystemCode: 'WV-PERS' }), fact({ sourceKind: 'federalCivilService', planSystemCode: 'CSRS' })])).toBe(accepted)
    expect(exclusion('WV', [fact({ sourceKind: 'stateLocalPublic', planSystemCode: 'WV-POLICE-FIRE' })])).toBe(12_000)
    expect(exclusion('WV', [fact({ sourceKind: 'federalCivilService' })])).toBe(0)
    expect(annual('WV', { retirementDistributions: [fact({ sourceKind: 'federalCivilService' })] }).status).toBe('incomplete')
  })
})
describeRule('wv-code-11-21-12-c7-military', { readings: { currentFullAmount: 30_000, historicalCap: 20_000 }, accepted: 'currentFullAmount' }, ({ accepted }) => {
  it('excludes military retirement without the historical $20,000 cap', () => {
    expect(exclusion('WV', [fact({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 30_000 })])).toBe(accepted)
  })
  it('excludes military survivor income without the historical $20,000 cap', () => {
    expect(exclusion('WV', [fact({ sourceKind: 'militarySurvivor', federallyIncludedAmount: 30_000 })])).toBe(accepted)
  })
})
describeRule('wv-code-11-21-12-c12-railroad', { readings: { protectedTier1: 12_000, ordinaryPension: 0 }, accepted: 'protectedTier1' }, ({ accepted }) => {
  it('removes included Tier I while a private pension remains taxable', () => {
    expect(exclusion('WV', [fact({ sourceKind: 'railroadTier1' })])).toBe(accepted)
    expect(exclusion('WV', [fact()])).toBe(0)
  })
})
describeRule('wv-code-11-21-12-c8-social-security-phase-in', { readings: { ty2025Residual: 7_000, prematurelyFullExempt: 0 }, accepted: 'ty2025Residual' }, ({ accepted }) => {
  it('selects 35 percent 65 percent and full Social Security relief in 2024 2025 and 2026', () => {
    for (const [year, expected] of [[2024, 13_000], [2025, 7_000], [2026, 0]] as const) {
      const low = annual('WV', { householdFacts: household({ federalAgi: 50_000, federallyIncludedSocialSecurity: 20_000 }) }, { year })
      const high = annual('WV', { householdFacts: household({ federalAgi: 50_001, federallyIncludedSocialSecurity: 20_000 }) }, { year })
      expect(high.taxableIncome - low.taxableIncome).toBe(expected)
      if (year === 2025) expect(high.taxableIncome - low.taxableIncome).toBe(accepted)
    }
  })
})

// Literal rule bindings for older records whose coarse approximation suites
// remain separate regressions. These callbacks assert the characterized law.
describeRule('aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate', { readings: { ageAtDistribution: 6_000, integerYearEndGate: 0 }, accepted: 'ageAtDistribution' }, ({ accepted }) => {
  it('uses fractional59½ distribution age', () => expect(exclusion('AR', [fact({ sourceKind: 'ira', ageAtDistributionYears: 59.5, recipientAgeYears: 59 })])).toBe(accepted))
})
describeRule('aca-26-51-307-e-uniformed-services-full-exemption', { readings: { militaryFull: 12_000, ordinaryCap: 6_000 }, accepted: 'militaryFull' }, ({ accepted }) => {
  it('keeps the full military source outside ordinary cap', () => expect(exclusion('AR', [fact({ sourceKind: 'militaryRetirement' })])).toBe(accepted))
})
describeRule('co-crs-39-22-104-federal-base-and-pension-cap', { readings: { age65Cap: 24_000, supersededDraftCap: 30_000 }, accepted: 'age65Cap' }, ({ accepted }) => {
  it('selects the statutory age65 pension limit', () => expect(exclusion('CO', [fact({ recipientAgeYears: 65, federallyIncludedAmount: 30_000, taxableSocialSecurityAllocated: 0 })], household({ federalDeductionUsed: 16_100 }))).toBe(accepted))
})
describeRule('co-crs-39-22-104-social-security-inclusion', { readings: { fullAge65SocialSecurity: 34_000, pensionCapAppliedToSs: 24_000 }, accepted: 'fullAge65SocialSecurity' }, ({ accepted }) => {
  it('raises subtraction room for fully excludable Social Security', () => expect(exclusion('CO', [fact({ recipientAgeYears: 65, federallyIncludedAmount: 0, taxableSocialSecurityAllocated: 34_000 })], household({ federalAgi: 84_000, federalDeductionUsed: 16_100, federallyIncludedSocialSecurity: 34_000 }), { ordinaryIncome: 50_000, ssBenefits: 40_000 })).toBe(accepted))
})
describeRule('de-code-30-1106-social-security-retirement-subtractions', {
  readings: { ordinaryUnder60Statute: 2_000, coarseAge60Gate: 0 }, accepted: 'ordinaryUnder60Statute', produced: 'coarseAge60Gate',
}, ({ accepted, produced }) => {
  it('keeps the legacy approximation distinguishable from the characterized result', () => {
    const empty = annual('DE', {}, { agesAlive: [55] })
    const coarse = computeStateTaxYearResult(input('DE', { agesAlive: [55], privateRetirementIncome: 12_000 }), { hsaAccounts: [], qcdEvents: [] })
    expect(empty.taxableIncome - coarse.taxableIncome).toBe(produced)
    expect(exclusion('DE', [fact({ recipientAgeYears: 55 })], household(), { agesAlive: [55] })).toBe(accepted)
  })
})
describeRule('ma-gen-laws-ch62-s2-public-pension-exclusion', { readings: { contributoryMaPlan: 12_000, noncontributoryPlan: 0 }, accepted: 'contributoryMaPlan' }, ({ accepted }) => {
  it('selects proved contributory Massachusetts income', () => expect(exclusion('MA', [fact({ sourceKind: 'stateLocalPublic', publicPlanContributory: true, priorTaxState: 'MA' })])).toBe(accepted))
})

describeRule('md-tax-10-209-pension-exclusion', { readings: { qualifyingPensionAfterGrossOffset: 20_600, coarseCapWithoutOffset: 40_600 }, accepted: 'qualifyingPensionAfterGrossOffset', produced: 'coarseCapWithoutOffset' }, ({ accepted, produced }) => {
  it('Maryland qualifies employer-plan income and offsets gross SS rather than taxable SS', () => {
    const hh = household({ householdGrossSocialSecurity: 20_000, federallyIncludedSocialSecurity: 17_000 })
    const changes = { agesAlive: [65], ssBenefits: 20_000 }
    expect(exclusion('MD', [fact({ sourceKind: 'employerPlan', qualifiedPlanType: '401a', recipientAgeYears: 65, federallyIncludedAmount: 50_000 })], hh, changes)).toBe(accepted)
    expect(exclusion('MD', [fact({ sourceKind: 'ira', recipientAgeYears: 65, federallyIncludedAmount: 50_000 })], hh, changes)).toBe(0)
    const coarse = computeStateTaxYearResult(input('MD', { ...changes, privateRetirementIncome: 50_000 }), { hsaAccounts: [], qcdEvents: [] })
    const coarseBaseline = computeStateTaxYearResult(input('MD', changes), { hsaAccounts: [], qcdEvents: [] })
    expect(coarseBaseline.taxableIncome - coarse.taxableIncome).toBe(produced)
  })
})
describeRule('sc-code-12-6-1170-retirement-income-deduction', { readings: { under65OrdinaryCap: 3_000, coarseAge65Only: 0 }, accepted: 'under65OrdinaryCap', produced: 'coarseAge65Only' }, ({ accepted, produced }) => {
  it('grants ordinary private and public retirement only the under65 statutory cap', () => {
    expect(exclusion('SC', [fact({ recipientAgeYears: 62 })])).toBe(accepted)
    expect(exclusion('SC', [fact({ recipientAgeYears: 62, sourceKind: 'stateLocalPublic' })])).toBe(accepted)
    const coarse = computeStateTaxYearResult(input('SC', { agesAlive: [62], privateRetirementIncome: 12_000 }), { hsaAccounts: [], qcdEvents: [] })
    const baseline = computeStateTaxYearResult(input('SC', { agesAlive: [62] }), { hsaAccounts: [], qcdEvents: [] })
    expect(baseline.taxableIncome - coarse.taxableIncome).toBe(produced)
  })
})
describeRule('sc-code-12-6-1171-military-retirement', { readings: { qualifyingMilitaryFull: 12_000, ordinaryPublicCap: 3_000 }, accepted: 'qualifyingMilitaryFull' }, ({ accepted }) => {
  it('excludes qualifying military fully while ordinary public retirement remains capped', () => {
    expect(exclusion('SC', [fact({ sourceKind: 'militaryRetirement' })])).toBe(accepted)
    expect(exclusion('SC', [fact({ sourceKind: 'stateLocalPublic' })])).toBe(3_000)
  })
  it('SC survivor military deduction does not consume the survivor’s own age65 room', () => {
    const hh = household({ ownerStateTaxFacts: [{ ownerPersonId: 'owner', remainingScIncome: 30_000 }] })
    expect(exclusion('SC', [fact({ sourceKind: 'militarySurvivor', recipientAgeYears: 65, cause: 'death', survivorSpouse: true })], hh)).toBe(27_000)
  })
})
describe('Remaining statutory source and survivor discriminators', () => {
  it('VT does not infer non-Social-Security-covered civil service from FERS alone', () => {
    expect(exclusion('VT', [fact({ sourceKind: 'federalCivilService', planSystemCode: 'FERS', publicPlanContributory: true })], vtHousehold({ federalAgi: 55_000 }), { ordinaryIncome: 55_000 })).toBe(0)
  })
  it('Iowa independent disability is not defeated by unknown age', () => {
    expect(exclusion('IA', [fact({ recipientAgeKnown: false, recipientDisabled: true, recipientAgeYears: 0 })])).toBe(12_000)
  })
})

describe('Annual input transport parity for every affected jurisdiction', () => {
  it.each(['IA', 'ND', 'IN', 'MI', 'SC', 'AR', 'LA', 'CA', 'NJ', 'CO', 'DE', 'DC', 'CT', 'HI', 'ID', 'IL', 'KS', 'KY', 'MD', 'MA', 'MO', 'MT', 'OR', 'UT', 'VA', 'VT', 'WI', 'WV'])('%s transports characterized facts through the production calculator interface', (state) => {
    const rows = [fact({ knownPreviouslyTaxedBasis: 0, qualifiedPlanType: '401a', priorTaxState: 'CA' })]
    const hh = household({ iowaTestNetIncome: 100_000, connecticutAgi: 100_000, federalDeductionUsed: 16_100, missouriIncome: 100_000, montanaNetTaxableLtcg: 0, oregonHouseholdIncome: 100_000, vermontUsObligationAdjustment: 0, vermontRetirementElection: 'civilService', wisconsinIncomeForStandardDeduction: 100_000, interestExcludedFromFederalAgi: 0, utahSection59_10_114Additions: 0, socialSecurityIncludedInUtahTaxableIncome: 0, claimantDatesOfBirth: ['1953-01-01'], utahCreditElection: 'socialSecurityAndMilitary', ownerStateTaxFacts: [{ ownerPersonId: 'owner', remainingScIncome: 88_000, westVirginiaEligibleAge65OrDisabled: false, westVirginiaRemainingFederalAgiIncome: 100_000, westVirginiaPriorNamedModifications: 0 }] })
    const year = input(state, { stateRetirementDistributions: rows, stateHouseholdFacts: hh, stateHsaAccountYearFacts: [], stateQcdEventFacts: [], stateResidency: [{ state, months: 12 }] })
    const calculator = createStateTaxCalculator()
    const rich = calculator.computeResult(year)
    const direct = annual(state, { retirementDistributions: rows, householdFacts: hh })
    expect(rich.amount).toBe(direct.amount)
    if (!('taxableIncome' in rich) || typeof rich.taxableIncome !== 'number') {
      throw new Error(`${state} state calculator omitted its numeric taxable-income result`)
    }
    expect(rich.taxableIncome).toBe(direct.taxableIncome)
    expect(calculator.compute(year)).toBe(rich.amount)
    expect(rich.issues.map((issue) => issue.code)).toEqual(direct.warnings.map((warning) => warning.code))
  })
})
