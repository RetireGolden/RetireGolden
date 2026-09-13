/** Authority-derived annual-path regressions: NJ GIT Worksheet C, MA ch62,
 * UT 59-10-114(2)(i), WV 11-21-12, VT 5822(a)(6). */
import { describe, expect, it } from 'vitest'
import { createStateTaxCalculator, computeStateTaxYearResult } from './stateTax.js'
import { knownMoney, type StateRetirementDistributionFact } from './stateRetirementFacts.js'
import type { TaxYearInput } from '../projection/types.js'
import { coloradoHighAgiFederalDeductionAddback } from './stateColoradoTax.js'
import { newJerseyWorksheetCTaxableAmount } from './stateQcdHsa.js'

const input = (state: string, changes: Partial<TaxYearInput> = {}): TaxYearInput => ({ year: 2026, state, filingStatus: 'single', ordinaryIncome: 30_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, ...changes })
const distribution = (changes: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({ accountId: 'ira', ownerPersonId: 'owner', sourceKind: 'ira', federallyIncludedAmount: 4_000, grossDistribution: 4_000, recipientAgeYears: 60, cause: 'ordinary', earlyDistributionDisqualifier: 'false', knownPreviouslyTaxedBasis: 6_000, ...changes })

describe('rich annual state transport and basis', () => {
  it('keeps numeric and rich Utah credit amounts identical, including full-year residency', () => {
    // IRC86 worksheet: 30k other income + 10k benefits => 5350 taxable SS.
    // Utah 4.45% *35350 less4.45% *5350 =1335.
    const calculator = createStateTaxCalculator()
    const year = input('UT', { ssBenefits: 10_000, stateResidency: [{ state: 'UT', months: 12 }], stateRetirementDistributions: [], stateHouseholdFacts: { stateFilingStatus: 'single', federalAgi: 35_350, utahSection59_10_114Additions: 0, interestExcludedFromFederalAgi: 0, socialSecurityIncludedInUtahTaxableIncome: 5_350, claimantDatesOfBirth: ['1953-01-01'], utahCreditElection: 'socialSecurityAndMilitary' } })
    const rich = calculator.computeResult(year)
    expect(rich.amount).toBeCloseTo(1_335, 8)
    expect(calculator.compute(year)).toBe(rich.amount)
  })
  it('retains a split-year tax estimate and refuses exact basis allocation', () => {
    const result = createStateTaxCalculator().computeResult(input('CA', { ordinaryIncome: 100_000, stateResidency: [{ state: 'CA', months: 6 }, { state: 'NJ', months: 6 }] }))
    expect(result.amount).toBeGreaterThan(0)
    expect(result.issues.some((issue) => issue.code === 'state-rich-split-year-adapter-required')).toBe(true)
    expect(result.hsaBasisPools).toBeUndefined()
  })
  it.each(['MA', 'VA', 'UT'])('%s consumes account basis only once across two events', (state) => {
    const rows = [distribution({ qualifiedPlanType: '401a', priorTaxState: 'CA', sourceKind: 'employerPlan' }), distribution({ qualifiedPlanType: '401a', priorTaxState: 'CA', sourceKind: 'employerPlan' })]
    const result = computeStateTaxYearResult(input(state), { retirementDistributions: rows })
    expect(result.pensionBasisPools).toEqual([{ state, accountId: 'ira', ownerPersonId: 'owner', kind: state === 'MA' ? 'pension' : state === 'VA' ? 'eligiblePlan' : 'otherState401a', status: 'complete', openingBasis: 6_000, basisConsumed: 6_000, closingBasis: 0 }])
    const single = computeStateTaxYearResult(input(state), { retirementDistributions: [distribution({ qualifiedPlanType: '401a', priorTaxState: 'CA', sourceKind: 'employerPlan', federallyIncludedAmount: 8_000 })] })
    expect(result.taxableIncome).toBe(single.taxableIncome)
  })
  it('does not consume contribution basis for NJ exempt-obligation earnings', () => {
    // 100k pool =80k closing+20k distribution;20k basis and10k exempt earnings.
    // Taxable distribution14k; contribution recovery4k, exempt earnings2k.
    const result = newJerseyWorksheetCTaxableAmount({ pool: { ownerPersonId: 'owner', december31IraValue: 80_000, allAnnualDistributions: 20_000, unrecoveredNjTaxedContributions: knownMoney(20_000), exemptObligationIncome: 10_000, fullLiquidation: false }, correspondingGrossDistributions: 20_000 })
    expect(result.stateTaxableIraAmount).toBe(14_000)
    expect(result.basisRecovered).toBe(4_000)
  })
  it('allocates one NJ liquidation recovery across QCD and ordinary distributions', () => {
    const result = newJerseyWorksheetCTaxableAmount({ pool: { ownerPersonId: 'owner', december31IraValue: 0, allAnnualDistributions: 10_000, unrecoveredNjTaxedContributions: knownMoney(6_000), fullLiquidation: true }, correspondingGrossDistributions: 5_000 })
    expect(result.basisRecovered).toBe(3_000)
    expect(result.stateTaxableIraAmount).toBe(2_000)
  })
  it('refuses an NJ annual pool whose denominator omits an actual withdrawal', () => {
    const result = createStateTaxCalculator().computeResult(input('NJ', { stateRetirementDistributions: [distribution()], stateQcdEventFacts: [], stateNjIraOwnerPools: [{ ownerPersonId: 'owner', december31IraValue: 10_000, allAnnualDistributions: 0, unrecoveredNjTaxedContributions: knownMoney(6_000), fullLiquidation: false }] }))
    expect(result.njIraBasisPools?.[0]?.status).toBe('incomplete')
  })
  it('selects historical WV SS subtraction through the annual calculator', () => {
    // 2025 above50k: 65% of20k excluded, leaving7k taxable. At50k all excluded.
    const base = { retirementDistributions: [], householdFacts: { federalAgi: 50_001, federallyIncludedSocialSecurity: 20_000 } }
    const above = computeStateTaxYearResult(input('WV', { year: 2025 }), base)
    const boundary = computeStateTaxYearResult(input('WV', { year: 2025 }), { ...base, householdFacts: { ...base.householdFacts, federalAgi: 50_000 } })
    expect(above.taxableIncome - boundary.taxableIncome).toBe(7_000)
  })
  it('returns the CA HSA closing basis after taxed contributions and cash withdrawals', () => {
    const zero = knownMoney(0)
    const result = createStateTaxCalculator().computeResult(input('CA', { stateRetirementDistributions: [], stateQcdEventFacts: [], stateHsaAccountYearFacts: [{ accountId: 'hsa', ownerPersonId: 'owner', federalHsaDeduction: knownMoney(1_000), employerContributionExcludedFederally: zero, employerContributionAlreadyInStateWages: zero, interest: knownMoney(100), dividends: zero, realizedGains: zero, unrealizedAppreciation: zero, qualifiedCashWithdrawals: knownMoney(500), nonqualifiedCashWithdrawals: zero, nonqualifiedDistributionFederalAmount: zero, stateBasisBeforeYear: knownMoney(2_000), annualActivityComplete: true }] }))
    // 2000 opening+1000 contribution+100 taxed interest-500 withdrawal=2600.
    expect(result.hsaBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 2_000, basisAdded: 1_100, basisConsumed: 500, closingBasis: 2_600 })
  })
  it('keeps unknown HSA withdrawal activity from producing an exact closing pool', () => {
    const zero = knownMoney(0)
    const result = computeStateTaxYearResult(input('CA'), { hsaAccounts: [{ accountId: 'hsa', ownerPersonId: 'owner', federalHsaDeduction: zero, employerContributionExcludedFederally: zero, employerContributionAlreadyInStateWages: zero, interest: zero, dividends: zero, realizedGains: zero, unrealizedAppreciation: zero, qualifiedCashWithdrawals: zero, nonqualifiedDistributionFederalAmount: zero, stateBasisBeforeYear: knownMoney(2_000), annualActivityComplete: true }], qcdEvents: [] })
    expect(result.hsaBasisPools?.[0]?.closingBasis).toBeUndefined()
    expect(result.status).toBe('incomplete')
  })

  it('applies Act358of2023 military-below-cap ordinary remainder per Arkansas owner', () => {
    // �307(f)(2): military2000 + min(ordinary10000,6000-2000)=6000.
    const military = distribution({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 2_000 })
    const ordinary = distribution({ sourceKind: 'employerPlan', federallyIncludedAmount: 10_000 })
    const withBenefits = computeStateTaxYearResult(input('AR'), { retirementDistributions: [military, ordinary], qcdEvents: [] })
    const without = computeStateTaxYearResult(input('AR'), { retirementDistributions: [], qcdEvents: [] })
    expect(without.taxableIncome - withBenefits.taxableIncome).toBe(6_000)
    const aboveCap = computeStateTaxYearResult(input('AR'), { retirementDistributions: [{ ...military, federallyIncludedAmount: 8_000 }, ordinary], qcdEvents: [] })
    expect(without.taxableIncome - aboveCap.taxableIncome).toBe(8_000)
  })

  it('applies SC age65 deduction to a wages-only owner without fabricating a pension', () => {
    const facts = { retirementDistributions: [], householdFacts: { ownerStateTaxFacts: [{ ownerPersonId: 'owner', recipientAgeYears: 65, remainingScIncome: 30_000 }] } }
    const senior = computeStateTaxYearResult(input('SC'), facts)
    const younger = computeStateTaxYearResult(input('SC'), { ...facts, householdFacts: { ownerStateTaxFacts: [{ ownerPersonId: 'owner', recipientAgeYears: 64, remainingScIncome: 30_000 }] } })
    expect(younger.taxableIncome - senior.taxableIncome).toBe(15_000)
  })

  it('coordinates SC own military and ordinary deductions without stacking full caps', () => {
    // Section1170(C): ownmilitary2000 leaves1000 of the under65 ordinary3000 cap.
    const year = input('SC', { ordinaryIncome: 100_000 })
    const householdFacts = { federalAgi: 100_000, stateFilingStatus: 'single' as const }
    const base = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [] })
    const result = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [distribution({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 2_000 }), distribution({ sourceKind: 'employerPlan', federallyIncludedAmount: 12_000 })] })
    expect(base.taxableIncome - result.taxableIncome).toBe(3_000)
  })
  it('uses separate deceased-spouse SC retirement cap and preserves own age65 room', () => {
    // Own10000 + deceasedspouse10000 + residual ownage65(15000-10000)=25000.
    const year = input('SC', { ordinaryIncome: 100_000 })
    const householdFacts = { federalAgi: 100_000, stateFilingStatus: 'single' as const, ownerStateTaxFacts: [{ ownerPersonId: 'owner', recipientAgeYears: 65, remainingScIncome: 80_000 }] }
    const own = distribution({ sourceKind: 'employerPlan', recipientAgeYears: 65, federallyIncludedAmount: 12_000 })
    const survivor = distribution({ sourceKind: 'employerPlan', recipientAgeYears: 65, survivorSpouse: true, decedentAgeYears: 70, federallyIncludedAmount: 12_000 })
    const result = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [own, survivor] })
    expect(result.taxableIncome).toBe(75_000)
    const youngerDecedent = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [own, { ...survivor, decedentAgeYears: 60 }] })
    expect(youngerDecedent.taxableIncome).toBe(82_000)
    const missing = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [own, { ...survivor, decedentAgeYears: undefined }] })
    expect(missing.taxableIncome).toBe(85_000)
    expect(missing.warnings.some((warning) => warning.code === 'sc-survivor-decedent-age-unknown')).toBe(true)
  })
  it('counts Colorado recipient SS once for repeated withdrawals and includes SS-only recipients', () => {
    const year = input('CO', { ordinaryIncome: 30_000, ssBenefits: 10_000 })
    const householdFacts = { federalAgi: 35_350, stateFilingStatus: 'single' as const, recipientSocialSecurity: [{ ownerPersonId: 'owner', grossSocialSecurity: 10_000, federallyIncludedSocialSecurity: 5_350, grossRailroadTier1: 0, federallyIncludedRailroadTier1: 0 }], ownerStateTaxFacts: [{ ownerPersonId: 'owner', recipientAgeYears: 65 }] }
    const onlySs = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [] })
    const repeat = computeStateTaxYearResult(year, { householdFacts, retirementDistributions: [distribution({ federallyIncludedAmount: 0, recipientAgeYears: 65, taxableSocialSecurityAllocated: 5_350 }), distribution({ federallyIncludedAmount: 0, recipientAgeYears: 65, taxableSocialSecurityAllocated: 5_350 })] })
    expect(repeat.taxableIncome).toBe(onlySs.taxableIncome)
    expect(onlySs.taxableIncome).toBe(13_900)
  })

  it('limits the accepted KY Alex-only conversion to one recipient exclusion', () => {
    // Kentucky ScheduleP: 31110 perrecipient; KY2026 SD3360 once perreturn.
    // Accepted2028 ledger: (189819.68+47329.83031856932-31110-3360)*3.5%.
    const year = input('KY', { year: 2028, filingStatus: 'marriedFilingJointly', ordinaryIncome: 189_819.68, capitalGains: 47_329.83031856932, agesAlive: [66, 64], stateResidency: [{ state: 'KY', months: 12 }], stateRetirementDistributions: [distribution({ ownerPersonId: 'alex', sourceKind: 'employerPlan', recipientAgeYears: 66, federallyIncludedAmount: 189_819.68 })] })
    expect(createStateTaxCalculator().computeResult(year).amount).toBeCloseTo(7_093.782861149927, 8)
  })
  it('aggregates KY same-owner accounts and uses only the other spouse actual income', () => {
    // Alex's two events share31110. Sam's20282.14710019098 uses only that;
    // combinedexclusion51392.14710019098, not62220.
    const year = input('KY', { ordinaryIncome: 172_246.0309643629, filingStatus: 'marriedFilingJointly', agesAlive: [73, 71] })
    const rows = [distribution({ ownerPersonId: 'alex', accountId: 'alex-401k', federallyIncludedAmount: 55_241.33 }), distribution({ ownerPersonId: 'alex', accountId: 'alex-ira', federallyIncludedAmount: 96_722.55386417192 }), distribution({ ownerPersonId: 'sam', accountId: 'sam-ira', federallyIncludedAmount: 20_282.14710019098 })]
    const withEvents = computeStateTaxYearResult(year, { retirementDistributions: rows })
    const without = computeStateTaxYearResult(year, { retirementDistributions: [] })
    expect(without.taxableIncome - withEvents.taxableIncome).toBeCloseTo(51_392.14710019098, 8)
  })
  it.each([['AL', 6_000], ['GA', 65_000], ['ME', 49_824], ['NY', 20_000], ['OK', 10_000], ['RI', 20_000]] as const)('%s does not transfer an unused spouse per-recipient cap', (state, cap) => {
    // Each named jurisdiction's domain authority identifies a per-person cap.
    // Use the source-typed IRA path and override deduction only to isolate it.
    const year = input(state, { ordinaryIncome: 300_000, agesAlive: [70, 70], filingStatus: 'marriedFilingJointly' })
    const options = { standardDeductionAllowedOverride: 0, retirementDistributions: [distribution({ accountId: 'one', recipientAgeYears: 70, federallyIncludedAmount: 100_000 }), distribution({ accountId: 'two', recipientAgeYears: 70.25, federallyIncludedAmount: 100_000 })] }
    const actual = computeStateTaxYearResult(year, options)
    const baseline = computeStateTaxYearResult(year, { ...options, retirementDistributions: [] })
    expect(baseline.taxableIncome - actual.taxableIncome).toBe(cap)
  })
  it('keeps Michigan combined joint-return ceiling distinct from per-recipient caps', () => {
    // MI current statutory maximum:135220 MFJ combinedqualifyingbenefits.
    const year = input('MI', { ordinaryIncome: 300_000, agesAlive: [70, 70], filingStatus: 'marriedFilingJointly' })
    const actual = computeStateTaxYearResult(year, { standardDeductionAllowedOverride: 0, retirementDistributions: [distribution({ federallyIncludedAmount: 200_000, recipientAgeYears: 70 })] })
    expect(actual.taxableIncome).toBe(164_780)
  })
  it('refuses a retirement exemption without a recipient owner', () => {
    const result = computeStateTaxYearResult(input('KY', { ordinaryIncome: 100_000, agesAlive: [70, 70] }), { retirementDistributions: [distribution({ ownerPersonId: '', federallyIncludedAmount: 80_000 })] })
    expect(result.warnings.some((warning) => warning.code === 'state-retirement-owner-unknown')).toBe(true)
    expect(result.taxableIncome).toBe(96_640)
  })

  it('requires both Utah alternatives for auto election but only the explicit elected alternative', () => {
    // Military credit is 20000*4.45%=890. The general retirement alternative
    // cannot be compared when the claimant birth date is unknown.
    const year = input('UT', { ordinaryIncome: 20_000 })
    const rows = [distribution({ sourceKind: 'militaryRetirement', federallyIncludedAmount: 20_000 })]
    const householdFacts = { federalAgi: 20_000, interestExcludedFromFederalAgi: 0, utahSection59_10_114Additions: 0, stateFilingStatus: 'single' as const, socialSecurityIncludedInUtahTaxableIncome: 0 }
    const auto = computeStateTaxYearResult(year, { retirementDistributions: rows, householdFacts })
    expect(auto.totalTax).toBeCloseTo(890, 8)
    expect(auto.warnings.some((warning) => warning.code === 'ut-credit-election-incomplete')).toBe(true)
    const elected = computeStateTaxYearResult(year, { retirementDistributions: rows, householdFacts: { ...householdFacts, utahCreditElection: 'socialSecurityAndMilitary' } })
    expect(elected.totalTax).toBeCloseTo(0, 8)
    expect(elected.status).toBe('complete')
    // An eligible pre1953 claimant at MAGI20000 gets450 under section1019;
    // the unelected SS alternative's missing base does not void this election.
    const retirement = computeStateTaxYearResult(year, { retirementDistributions: [], householdFacts: { ...householdFacts, socialSecurityIncludedInUtahTaxableIncome: undefined, claimantDatesOfBirth: ['1952-12-31'], utahCreditElection: 'retirement' } })
    expect(retirement.totalTax).toBeCloseTo(440, 8)
    expect(retirement.status).toBe('complete')
  })
  it('requires actual Arkansas IRA timing or a sufficient proven age lower bound', () => {
    const year = input('AR')
    const row = distribution({ recipientAgeYears: 60, federallyIncludedAmount: 10_000 })
    const missing = computeStateTaxYearResult(year, { retirementDistributions: [row], qcdEvents: [] })
    expect(missing.warnings.some((warning) => warning.code === 'ar-ira-age-unknown')).toBe(true)
    const certain = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, minimumAgeAtDistributionYears: 59.5 }], qcdEvents: [] })
    expect(missing.taxableIncome - certain.taxableIncome).toBe(6_000)
    const crossing = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, minimumAgeAtDistributionYears: 59 }], qcdEvents: [] })
    expect(crossing.warnings.some((warning) => warning.code === 'ar-ira-age-unknown')).toBe(true)
    const explicitYoung = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, ageAtDistributionYears: 59, minimumAgeAtDistributionYears: 59.5 }], qcdEvents: [] })
    expect(explicitYoung.taxableIncome).toBe(missing.taxableIncome)
  })
  it('limits Delaware under60 ordinary relief to employer or government pensions', () => {
    // 30Del.C.1106(b)(3): IRA eligible retirement income enters only at60+;
    // under60 employer pension has2000 cap, with unknown source unproved.
    const year = input('DE', { ordinaryIncome: 30_000 })
    const baseline = computeStateTaxYearResult(year, { retirementDistributions: [] })
    const row = distribution({ recipientAgeYears: 55, federallyIncludedAmount: 10_000 })
    const ira = computeStateTaxYearResult(year, { retirementDistributions: [row] })
    expect(ira.taxableIncome).toBe(baseline.taxableIncome)
    const pension = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, sourceKind: 'employerPlan' }] })
    expect(baseline.taxableIncome - pension.taxableIncome).toBe(2_000)
    const older = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, recipientAgeYears: 60 }] })
    expect(baseline.taxableIncome - older.taxableIncome).toBe(10_000)
    const unknown = computeStateTaxYearResult(year, { retirementDistributions: [{ ...row, sourceKind: 'unknownPublic' }] })
    expect(unknown.taxableIncome).toBe(baseline.taxableIncome)
    expect(unknown.status).toBe('incomplete')
    expect(unknown.warnings.some((warning) => warning.code === 'de-pension-source-unknown')).toBe(true)
  })
  it('uses the supplied Colorado addback pack rather than parallel module amounts', () => {
    // Deliberately varied pack values discriminate the configuration path;
    // statutory2026 boundary cases remain in the production authority suite.
    const config = { agiTrigger: 400_000, retainSingle: 3_000, retainJoint: 6_000 }
    expect(coloradoHighAgiFederalDeductionAddback({ federalAgi: 350_000, federalDeductionUsed: 10_000, joint: false, config }).taxableIncomeDelta).toBe(0)
    expect(coloradoHighAgiFederalDeductionAddback({ federalAgi: 400_000, federalDeductionUsed: 10_000, joint: false, config }).taxableIncomeDelta).toBe(7_000)
    expect(coloradoHighAgiFederalDeductionAddback({ federalAgi: 400_000, federalDeductionUsed: 10_000, joint: true, config }).taxableIncomeDelta).toBe(4_000)
  })
  it('counts a taxable QCD retirement event only once in the NJ annual gross pool', () => {
    const year = input('NJ', { stateRetirementDistributions: [distribution({ eventId: 'qcd1', accountId: 'ira', grossDistribution: 10_000, federallyIncludedAmount: 2_000 })], stateQcdEventFacts: [{ eventId: 'qcd1', accountId: 'ira', ownerPersonId: 'owner', grossIraDistribution: 10_000, directCharityTransfer: 10_000, federalExcludedAmount: 8_000, federalTaxableAmount: 2_000, federalBasisAllocated: 0, residency: 'fullYearResident', splitInterest: false, directTransfer: true }], stateNjIraOwnerPools: [{ ownerPersonId: 'owner', december31IraValue: 90_000, allAnnualDistributions: 10_000, unrecoveredNjTaxedContributions: knownMoney(0), fullLiquidation: false }] })
    const result = createStateTaxCalculator().computeResult(year)
    expect(result.njIraBasisPools?.[0]?.status).toBe('complete')
    const differentAccount = createStateTaxCalculator().computeResult({ ...year, stateRetirementDistributions: [distribution({ eventId: 'qcd1', accountId: 'other', grossDistribution: 10_000 })] })
    expect(differentAccount.njIraBasisPools?.[0]?.status).toBe('incomplete')
  })
  it.each([[55, 10_000, 2_000], [65, 12_500, 12_500]] as const)('gates each Delaware distribution before pooling at age%s', (age, pensionAmount, exclusion) => {
    const year = input('DE', { ordinaryIncome: 50_000 })
    const pension = distribution({ accountId: 'pension', sourceKind: 'employerPlan', recipientAgeYears: age, federallyIncludedAmount: pensionAmount })
    const early = distribution({ accountId: 'early', sourceKind: 'ira', recipientAgeYears: age, federallyIncludedAmount: 5_000, earlyDistributionDisqualifier: 'true' })
    const baseline = computeStateTaxYearResult(year, { retirementDistributions: [] })
    for (const rows of [[pension, early], [early, pension]]) {
      expect(baseline.taxableIncome - computeStateTaxYearResult(year, { retirementDistributions: rows }).taxableIncome).toBe(exclusion)
    }
    const unknown = computeStateTaxYearResult(year, { retirementDistributions: [pension, { ...early, earlyDistributionDisqualifier: 'unknown' }] })
    expect(baseline.taxableIncome - unknown.taxableIncome).toBe(exclusion)
    expect(unknown.status).toBe('incomplete')
    const split = computeStateTaxYearResult(year, { retirementDistributions: [{ ...pension, federallyIncludedAmount: pensionAmount / 2 }, { ...pension, accountId: 'second', federallyIncludedAmount: pensionAmount / 2 }, early] })
    expect(baseline.taxableIncome - split.taxableIncome).toBe(exclusion)
    if (age === 55) {
      const mixed = computeStateTaxYearResult(year, { retirementDistributions: [pension, { ...pension, accountId: 'military', sourceKind: 'militaryRetirement', federallyIncludedAmount: 10_000 }, early] })
      // The eligible military10000 wins over ordinary2000; caps are not added.
      expect(baseline.taxableIncome - mixed.taxableIncome).toBe(10_000)
    }
    const disqualified = computeStateTaxYearResult(year, { retirementDistributions: [{ ...pension, earlyDistributionDisqualifier: 'true' }, early] })
    expect(disqualified.taxableIncome).toBe(baseline.taxableIncome)
  })
})
