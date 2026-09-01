/** Pure annual marketplace/Medicare expense and ACA-support planning. */
import type { Plan } from '../../model/plan.js'
import { stateForYear } from '../../model/plan.js'
import { irmaaTierThreshold } from '../../params/index.js'
import type { FilingStatus, ParameterPack } from '../../params/types.js'
import { medicareAnnualPremiumPerPerson } from '../../tax/medicare.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import type {
  AcaSupportCode,
  PersonYearState,
  ProjectedFilingStatus,
} from '../types.js'

const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

export type IrmaaLookbackMagiSource =
  | 'projected'
  | 'historicalInput'
  | 'planFallback'

type AcaContract = NonNullable<
  Plan['expenses']['healthcare']['acaYears']
>[number]

export interface AnnualHealthcareExpensesResult {
  readonly healthcare: number
  readonly healthInflFactor: number
  readonly acaContractsForYear: AcaContract[]
  readonly acaContract: AcaContract | undefined
  readonly acaEnrollmentPremiums: number[]
  readonly acaSlcspBenchmarkPremiums: number[]
  readonly acaGrossEnrollmentPremium: number
  readonly acaActive: boolean
  readonly healthcareExcludingAcaEnrollment: number
  readonly healthcareExcludingMarketplacePremium: number
  readonly acaInitialSupportCodes: AcaSupportCode[]
  readonly exampleContractInputMismatch: boolean
  readonly medicarePremiums: number
  readonly irmaaSurcharge: number
  readonly irmaaTier: number
  readonly irmaaMagi: number
  readonly irmaaLookbackMagiSource: IrmaaLookbackMagiSource
  readonly irmaaLookbackMagiYear: number
  readonly irmaaNextTierThreshold: number | null
  readonly warnings: string[]
  readonly marketplaceMonthsByPerson: ReadonlyMap<PersonYearState, number>
  readonly pre65MonthlyPremiumPerPerson: number
}

export interface AnnualHealthcareExpensesInput {
  readonly plan: Plan
  readonly pack: ParameterPack
  readonly year: number
  readonly startYear: number
  readonly peopleStates: readonly PersonYearState[]
  readonly birthMonthByPerson: ReadonlyMap<string, number>
  readonly resolveMagiFor: (year: number) => {
    magi: number
    source: IrmaaLookbackMagiSource
    year: number
  }
  readonly ssa44ActiveInYear: (year: number) => boolean
  readonly filingStatusForYear: ProjectedFilingStatus
  readonly taxFilingStatusForYear: FilingStatus
  readonly inflFactorFrom: (fromYear: number, toYear: number) => number
  readonly healthInflFactorFrom: (fromYear: number, toYear: number) => number
  readonly isStandIn: boolean
  readonly hasModeledPerson: (personId: string) => boolean
  readonly resolvePerson: (personId: string) => PersonYearState
  readonly planHasTaxExemptYieldAttestation: boolean
  readonly taxExemptInterest: number
}

export function annualHealthcareExpenses(
  input: AnnualHealthcareExpensesInput,
): AnnualHealthcareExpensesResult {
  const hc = input.plan.expenses.healthcare
  const healthInflFactor = input.healthInflFactorFrom(input.startYear, input.year)
  let healthcare = 0
  // ACA is monthly and household-wide. Premiums pool by calendar month so a
  // partial Medicare transition never consumes a full annual contribution.
  const legacyAcaMonthlyPremiums: number[] = new Array<number>(12).fill(0)
  const acaEnrollmentPremiums: number[] = new Array<number>(12).fill(0)
  const acaSlcspBenchmarkPremiums: number[] = new Array<number>(12).fill(0)
  let legacyMarketplacePremiumPaidDirectly = 0
  const acaContractsForYear =
    hc.acaYears?.filter((contract) => contract.year === input.year) ?? []
  const acaContract =
    acaContractsForYear.length === 1 ? acaContractsForYear[0] : undefined

  const lookbackPrimary = input.resolveMagiFor(input.year - 2)
  // SSA-44 selects the lower of the normal two-year lookback and the prior-year
  // stand-in; a tie deliberately keeps the standard lookback and its source.
  const lookbackSelected = input.ssa44ActiveInYear(input.year)
    ? (() => {
        const alternate = input.resolveMagiFor(input.year - 1)
        return alternate.magi < lookbackPrimary.magi
          ? alternate
          : lookbackPrimary
      })()
    : lookbackPrimary
  const irmaaMagi = lookbackSelected.magi
  const irmaaLookbackMagiSource = lookbackSelected.source
  const irmaaLookbackMagiYear = lookbackSelected.year
  const irmaaFilingStatus =
    input.filingStatusForYear === 'qualifyingSurvivingSpouse'
      ? 'single'
      : input.taxFilingStatusForYear
  let medicarePremiums = 0
  let irmaaSurcharge = 0
  let irmaaTier = 0
  let anyMedicareActivity = false
  const warnings: string[] = []
  const marketplaceMonthsBeforeMedicare = (
    person: PersonYearState,
  ): number =>
    !person.alive
      ? 0
      : person.ageAttained < 65
        ? 12
        : person.ageAttained === 65
          ? (input.birthMonthByPerson.get(person.personId) ?? 1) - 1
          : 0
  // Person ids are not globally unique unless a retirement action references
  // them. Key by the positional state object so an accepted duplicate id never
  // collapses another person's transition months in caller-side publication.
  const marketplaceMonthsByPerson = new Map(
    input.peopleStates.map((person) => [
      person,
      marketplaceMonthsBeforeMedicare(person),
    ]),
  )

  for (const state of input.peopleStates) {
    if (!state.alive) continue
    const acaMonths = marketplaceMonthsBeforeMedicare(state)
    const medicareMonths = 12 - acaMonths
    if (acaMonths > 0 && hc.pre65MonthlyPremiumPerPerson > 0) {
      if (hc.applyAcaCredit) {
        for (let month = 0; month < acaMonths; month++) {
          legacyAcaMonthlyPremiums[month]! +=
            hc.pre65MonthlyPremiumPerPerson * healthInflFactor
        }
      } else {
        const premium =
          hc.pre65MonthlyPremiumPerPerson * acaMonths * healthInflFactor
        healthcare += premium
        legacyMarketplacePremiumPaidDirectly += premium
      }
    }
    if (medicareMonths > 0) {
      anyMedicareActivity = true
      const medicare = medicareAnnualPremiumPerPerson(
        input.pack,
        irmaaMagi,
        irmaaFilingStatus,
        {
          // Each IRMAA tier owns its statutory indexing path, including the
          // frozen top tier, so the helper receives a year callback.
          premiumYear: input.year,
          inflationFactorToYear: (toYear) =>
            input.inflFactorFrom(input.pack.year, toYear),
        },
        input.healthInflFactorFrom(input.pack.year, input.year),
      )
      if (medicare.partDSurchargeUnverified) {
        warnings.push(
          'An IRMAA tier with an unverified Part D surcharge was hit; Part D surcharge omitted for that tier.',
        )
      }
      const premium =
        (medicare.partBAnnual + medicare.partDSurchargeAnnual) *
        (medicareMonths / 12)
      medicarePremiums += premium
      irmaaSurcharge +=
        medicare.irmaaSurchargeAnnual * (medicareMonths / 12)
      irmaaTier = medicare.irmaaTier
      healthcare +=
        premium +
        hc.medicareExtrasMonthlyPerPerson *
          medicareMonths *
          healthInflFactor
    }
  }

  const irmaaNextTierThreshold =
    !anyMedicareActivity ||
    irmaaTier >= input.pack.medicare.irmaaTiers.length
      ? null
      : irmaaTierThreshold(input.pack, irmaaTier, irmaaFilingStatus, {
          premiumYear: input.year,
          inflationFactorToYear: (toYear) =>
            input.inflFactorFrom(input.pack.year, toYear),
        })
  const exampleContractInputMismatch =
    input.plan.exampleSourceId !== undefined &&
    acaContract !== undefined &&
    (() => {
      const residenceState = stateForYear(input.plan.household, input.year)
      const expectedRegion =
        residenceState === 'AK'
          ? 'alaska'
          : residenceState === 'HI'
            ? 'hawaii'
            : 'contiguous'
      const expectedMonthlyPremium =
        hc.pre65MonthlyPremiumPerPerson * healthInflFactor
      return (
        acaContract.fplRegion !== expectedRegion ||
        acaContract.coveredMembers.some((member) => {
          const person = input.peopleStates.find(
            (state) => state.personId === member.personId,
          )
          const expectedMonths =
            person === undefined ? 0 : marketplaceMonthsBeforeMedicare(person)
          return member.enrollmentPremiumByMonth.some((premium, month) => {
            const expected = month < expectedMonths ? expectedMonthlyPremium : 0
            return Math.abs(premium - expected) > EPSILON
          })
        })
      )
    })()

  if (hc.applyAcaCredit && acaContract && !exampleContractInputMismatch) {
    for (const member of acaContract.coveredMembers) {
      for (let month = 0; month < 12; month++) {
        const enrollmentPremium =
          member.enrollmentPremiumByMonth[month] ?? 0
        acaEnrollmentPremiums[month]! += enrollmentPremium
        if (enrollmentPremium > 0) {
          acaSlcspBenchmarkPremiums[month]! +=
            member.slcspBenchmarkPremiumByMonth[month] ?? 0
        }
      }
    }
  } else if (hc.applyAcaCredit && acaContractsForYear.length > 1) {
    // Conflicting contracts are not reconcilable evidence. Preserve known
    // spending by taking the largest aggregate in each month without summing
    // accidental duplicates.
    for (let month = 0; month < 12; month++) {
      acaEnrollmentPremiums[month] = Math.max(
        ...acaContractsForYear.map((contract) =>
          contract.coveredMembers.reduce(
            (sum, member) =>
              sum + (member.enrollmentPremiumByMonth[month] ?? 0),
            0,
          ),
        ),
      )
    }
  } else if (hc.applyAcaCredit) {
    for (let month = 0; month < 12; month++) {
      acaEnrollmentPremiums[month] = legacyAcaMonthlyPremiums[month]!
      acaSlcspBenchmarkPremiums[month] = legacyAcaMonthlyPremiums[month]!
    }
  }

  const acaGrossEnrollmentPremium = acaEnrollmentPremiums.reduce(
    (sum, premium) => sum + premium,
    0,
  )
  const acaActive = hc.applyAcaCredit && acaGrossEnrollmentPremium > 0
  // Begin at gross premium. Only the caller's exact tax/withdrawal fixed point
  // may replace this with a supported economic net premium.
  healthcare += acaGrossEnrollmentPremium
  const healthcareExcludingAcaEnrollment =
    healthcare - acaGrossEnrollmentPremium
  const healthcareExcludingMarketplacePremium =
    healthcareExcludingAcaEnrollment - legacyMarketplacePremiumPaidDirectly
  const acaInitialSupportCodes: AcaSupportCode[] = []

  if (acaActive) {
    if (input.isStandIn) {
      acaInitialSupportCodes.push('tax-year-parameters-unsupported')
    }
    const spendingPolicy = input.plan.expenses.spendingPolicy
    if (spendingPolicy !== undefined && spendingPolicy.mode !== 'fixedTarget') {
      acaInitialSupportCodes.push('guardrail-interaction-unsupported')
    }
    if (acaContractsForYear.length === 0) {
      acaInitialSupportCodes.push('missing-year-contract')
    }
    if (acaContractsForYear.length > 1) {
      acaInitialSupportCodes.push('duplicate-year-contract')
    }
    if (acaContract) {
      const taxFamilyIds = new Set(
        acaContract.taxFamilyMembers.map((member) => member.personId),
      )
      const coveredIds = new Set(
        acaContract.coveredMembers.map((member) => member.personId),
      )
      const primaryCount = acaContract.taxFamilyMembers.filter(
        (member) => member.relationship === 'primary',
      ).length
      const spouseCount = acaContract.taxFamilyMembers.filter(
        (member) => member.relationship === 'spouse',
      ).length
      const expectedSpouseCount =
        input.filingStatusForYear === 'marriedFilingJointly' ? 1 : 0
      const omitsLivingModeledPerson = input.peopleStates.some(
        (person) => person.alive && !taxFamilyIds.has(person.personId),
      )
      if (
        primaryCount !== 1 ||
        spouseCount !== expectedSpouseCount ||
        omitsLivingModeledPerson ||
        (input.filingStatusForYear === 'qualifyingSurvivingSpouse' &&
          !acaContract.taxFamilyMembers.some(
            (member) => member.relationship === 'dependent',
          )) ||
        taxFamilyIds.size !== acaContract.taxFamilyMembers.length
      ) {
        acaInitialSupportCodes.push('tax-family-structure-unsupported')
      }
      if (coveredIds.size !== acaContract.coveredMembers.length) {
        acaInitialSupportCodes.push('covered-member-duplicate')
      }
      if (
        acaContract.coveredMembers.some((member) => {
          const person = input.peopleStates.find(
            (state) => state.personId === member.personId,
          )
          if (person === undefined || !person.alive) return false
          const marketplaceMonths = marketplaceMonthsBeforeMedicare(person)
          return member.enrollmentPremiumByMonth.some(
            (premium, month) =>
              premium > 0 && month >= marketplaceMonths,
          )
        })
      ) {
        acaInitialSupportCodes.push('medicare-overlap-unsupported')
      }
      if (
        acaContract.taxFamilyMembers.some(
          (member) =>
            member.relationship !== 'dependent' &&
            (!input.hasModeledPerson(member.personId) ||
              !input.resolvePerson(member.personId).alive ||
              member.requiredToFile === 'unknown'),
        ) ||
        acaContract.coveredMembers.some(
          (member) => !taxFamilyIds.has(member.personId),
        )
      ) {
        acaInitialSupportCodes.push('tax-family-member-unknown')
      }
      if (
        acaContract.taxFamilyMembers.some(
          (member) =>
            member.relationship === 'dependent' &&
            member.requiredToFile === 'unknown',
        )
      ) {
        acaInitialSupportCodes.push('dependent-filing-status-unknown')
      }
      if (
        acaContract.taxFamilyMembers.some(
          (member) =>
            member.relationship === 'dependent' &&
            input.hasModeledPerson(member.personId),
        )
      ) {
        acaInitialSupportCodes.push('dependent-modeled-person-overlap')
      }
      if (
        acaContract.taxExemptInterest.state === 'unknown' &&
        !(
          input.planHasTaxExemptYieldAttestation &&
          input.taxExemptInterest > 0
        )
      ) {
        acaInitialSupportCodes.push('tax-exempt-interest-unknown')
      }
      if (acaContract.foreignExclusionAddback.state === 'unknown') {
        acaInitialSupportCodes.push('foreign-exclusion-addback-unknown')
      }
      if (
        acaContract.coveredMembers.some((member) =>
          member.enrollmentPremiumByMonth.some(
            (premium, month) =>
              premium > 0 &&
              (member.slcspBenchmarkPremiumByMonth[month] ?? 0) <= 0,
          ),
        )
      ) {
        acaInitialSupportCodes.push('slcsp-benchmark-missing')
      }
      if (
        acaContract.coveredMembers.some((member) =>
          member.slcspBenchmarkPremiumByMonth.some(
            (benchmark, month) =>
              benchmark > 0 &&
              (member.enrollmentPremiumByMonth[month] ?? 0) <= 0,
          ),
        )
      ) {
        acaInitialSupportCodes.push('benchmark-only-coverage-unsupported')
      }
      if (exampleContractInputMismatch) {
        acaInitialSupportCodes.push('example-contract-input-mismatch')
      }
      if (acaContract.assertions.coverageEligibility !== 'supported') {
        acaInitialSupportCodes.push('coverage-eligibility-unsupported')
      }
      if (acaContract.assertions.form8814 !== 'notApplicable') {
        acaInitialSupportCodes.push('form-8814-unsupported')
      }
      if (acaContract.assertions.specialAllocation !== 'notApplicable') {
        acaInitialSupportCodes.push('special-allocation-unsupported')
      }
      if (
        acaContract.assertions.marriedFilingSeparatelyException !==
        'notApplicable'
      ) {
        acaInitialSupportCodes.push('mfs-exception-unsupported')
      }
      if (
        acaContract.assertions.selfEmployedHealthInsuranceDeduction !==
        'notApplicable'
      ) {
        acaInitialSupportCodes.push('self-employed-deduction-unsupported')
      }
      if (acaContract.assertions.otherMaterialFacts !== 'none') {
        acaInitialSupportCodes.push('other-material-facts-unsupported')
      }
    }
  }

  return {
    healthcare,
    healthInflFactor,
    acaContractsForYear,
    acaContract,
    acaEnrollmentPremiums,
    acaSlcspBenchmarkPremiums,
    acaGrossEnrollmentPremium,
    acaActive,
    healthcareExcludingAcaEnrollment,
    healthcareExcludingMarketplacePremium,
    acaInitialSupportCodes,
    exampleContractInputMismatch,
    medicarePremiums,
    irmaaSurcharge,
    irmaaTier,
    irmaaMagi,
    irmaaLookbackMagiSource,
    irmaaLookbackMagiYear,
    irmaaNextTierThreshold,
    warnings,
    marketplaceMonthsByPerson,
    pre65MonthlyPremiumPerPerson: hc.pre65MonthlyPremiumPerPerson,
  }
}
