/**
 * Adapter from Plan / annual pension facts to state retirement leaf fact shapes.
 *
 * Preserves source evidence and unknown facts while preparing annual state
 * calculator inputs. Policy and tax arithmetic remain in the state leaves.
 */
import {
  stateResidencySegmentsForYear,
  type Account,
  type PensionSourceKind,
  type Plan,
  type StateTaxYearHouseholdFacts,
  type PensionStateEligibility,
  type StateHsaYearEvidence,
} from '../../model/plan.js'
import type {
  KnownMoneyInput,
  StateDirectQcdPolicyInput,
  StateHouseholdTaxFactsInput,
  StateHsaAccountYearFactsInput,
  StateNjIraOwnerPoolFactsInput,
  StateQcdEventFactsInput,
  StateQcdYearFactsInput,
  StateRetirementDistributionFactInput,
} from '../types.js'

export type StateRetirementSourceKind = StateRetirementDistributionFactInput['sourceKind']

/** IRC 72(t)(2)(A)(i) inclusive boundary; calendar-month age preserves 59.5 exactly. */
export const EARLY_DISTRIBUTION_MIN_AGE_YEARS = 59.5

function knownAmount(amount: number): KnownMoneyInput {
  return { known: true, amount }
}

function unknownAmount(): KnownMoneyInput {
  return { known: false }
}

function optionalKnownMoney(value: number | undefined): KnownMoneyInput {
  return value === undefined ? unknownAmount() : knownAmount(value)
}

type OwnerStateTaxFact = NonNullable<StateHouseholdTaxFactsInput['ownerStateTaxFacts']>[number]

function withoutRecipientAge(owner: OwnerStateTaxFact | undefined): Partial<Omit<OwnerStateTaxFact, 'recipientAgeYears'>> {
  if (owner === undefined) return {}
  const rest = { ...owner }
  delete rest.recipientAgeYears
  return rest
}

/** Map persisted pension source to the leaf source-kind vocabulary. */
export function mapPensionSourceToStateKind(
  source: PensionSourceKind | undefined,
): StateRetirementSourceKind {
  switch (source) {
    case undefined:
    case 'private':
      return 'ordinaryPrivatePension'
    case 'public':
      return 'unknownPublic'
    case 'ordinaryPrivatePension':
    case 'ira':
    case 'employerPlan':
    case 'militaryRetirement':
    case 'militarySurvivor':
    case 'federalCivilService':
    case 'stateLocalPublic':
    case 'railroadTier1':
    case 'railroadTier2':
    case 'railroadRetirementAct':
    case 'governmentSurvivor':
    case 'unknownPublic':
    case 'unknownPrivate':
      return source
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

/** Coarse private/public bucket for legacy aggregate TaxYearInput fields. */
export function isPublicPensionSourceKind(
  source: PensionSourceKind | StateRetirementSourceKind | undefined,
): boolean {
  switch (source) {
    case 'public':
    case 'militaryRetirement':
    case 'militarySurvivor':
    case 'federalCivilService':
    case 'stateLocalPublic':
    case 'railroadTier1':
    case 'railroadTier2':
    case 'governmentSurvivor':
    case 'unknownPublic':
      return true
    default:
      return false
  }
}

export interface AnnualPensionDistributionCharacterization {
  readonly accountId: string
  /** Current recipient for age/per-person limits (may differ from source owner). */
  readonly ownerPersonId: string
  /** Original account owner when the payee is a survivor. */
  readonly sourceOwnerPersonId: string
  readonly federallyIncludedAmount: number
  readonly recipientAgeYears: number
  readonly source: PensionSourceKind
  readonly fact: StateRetirementDistributionFactInput
}

export function characterizePensionDistribution(input: {
  readonly account: Extract<Account, { type: 'pension' }>
  readonly sourceOwnerPersonId: string
  readonly payeePersonId: string
  readonly federallyIncludedAmount: number
  readonly recipientAgeYears: number
  readonly causeOverride?: StateRetirementDistributionFactInput['cause']
  /** Tax year for Jan-1 minimum distribution age when payment date is absent. */
  readonly taxYear?: number
  /** Payee DOB paired with taxYear; year-end recipientAgeYears never clears early distribution. */
  readonly payeeDateOfBirth?: string
  /** The year this payee's payments began, when known; carried on military rows only. */
  readonly paymentsBeganYear?: number
}): AnnualPensionDistributionCharacterization {
  const source = input.account.source ?? 'private'
  const military = source === 'militaryRetirement' || source === 'militarySurvivor'
  const eligibility = input.account.stateEligibility
  const isSurvivorPayee = input.payeePersonId !== input.sourceOwnerPersonId
  const cause =
    input.causeOverride ??
    eligibility?.distributionReason ??
    (isSurvivorPayee ? 'death' : 'ordinary')
  const minimumAgeAtDistributionYears =
    input.taxYear !== undefined && input.payeeDateOfBirth !== undefined
      ? ageOnDate(input.payeeDateOfBirth, `${input.taxYear}-01-01`)
      : undefined
  const fact: StateRetirementDistributionFactInput = {
    ...mapEligibility(eligibility),
    ownerPersonId: input.payeePersonId,
    sourceOwnerPersonId: input.sourceOwnerPersonId,
    accountId: input.account.id,
    sourceKind: mapPensionSourceToStateKind(source),
    federallyIncludedAmount: input.federallyIncludedAmount,
    recipientAgeYears: input.recipientAgeYears,
    recipientAgeKnown: true,
    cause,
    earlyDistributionDisqualifier: inferEarlyDistributionDisqualifier({
      explicit: eligibility?.earlyDistributionDisqualifier,
      minimumAgeAtDistributionYears,
      military,
    }),
    ...(minimumAgeAtDistributionYears === undefined
      ? {}
      : { minimumAgeAtDistributionYears }),
    ...(military && input.paymentsBeganYear !== undefined ? { paymentsBeganYear: input.paymentsBeganYear } : {}),
    ...(eligibility?.planSystemCode !== undefined
      ? { planSystemCode: eligibility.planSystemCode }
      : {}),
    ...(eligibility?.survivorIssuer !== undefined
      ? { survivorIssuer: eligibility.survivorIssuer }
      : {}),
    ...(eligibility?.decedentWouldQualify !== undefined
      ? { decedentWouldQualify: eligibility.decedentWouldQualify }
      : {}),
    ...(eligibility?.survivorInsurableInterest !== undefined
      ? { survivorInsurableInterest: eligibility.survivorInsurableInterest }
      : {}),
    ...(eligibility?.knownPreviouslyTaxedBasis !== undefined
      ? { knownPreviouslyTaxedBasis: eligibility.knownPreviouslyTaxedBasis }
      : {}),
    ...(eligibility?.recipientDisabled !== undefined
      ? { recipientDisabled: eligibility.recipientDisabled }
      : {}),
    ...(eligibility?.contributoryStatus === undefined || eligibility.contributoryStatus === 'unknown'
      ? {}
      : {
          publicPlanContributory:
            eligibility.contributoryStatus === 'contributory',
        }),
    ...(eligibility?.reciprocitySatisfied === undefined
      ? {}
      : {
          reciprocitySatisfied: eligibility.reciprocitySatisfied
            ? 'true' as const
            : 'false' as const,
        }),
    ...(eligibility?.priorTaxState === undefined
      ? {} : { priorTaxState: eligibility.priorTaxState }),
  }
  return {
    accountId: input.account.id,
    ownerPersonId: input.payeePersonId,
    sourceOwnerPersonId: input.sourceOwnerPersonId,
    federallyIncludedAmount: input.federallyIncludedAmount,
    recipientAgeYears: input.recipientAgeYears,
    source,
    fact,
  }
}

export function householdFactsForYear(
  plan: Readonly<Plan>,
  year: number,
  projected?: StateHouseholdTaxFactsInput,
): StateHouseholdTaxFactsInput | undefined {
  const row = plan.stateTaxFacts.householdYearFacts.find((entry) => entry.year === year) as
    | StateTaxYearHouseholdFacts
    | undefined
  if (row === undefined && projected === undefined) return undefined
  const { year: householdYear, utahCreditElection: election, age65EligibleCount: storedAge65, ...household } = row ?? { year }
  void householdYear
  const claimantIds = projected?.claimantPersonIds
  const ownerPeople = claimantIds === undefined
    ? plan.household.people
    : plan.household.people.filter((person) => claimantIds.includes(person.id))
  const allClaimantsKnown = claimantIds === undefined || claimantIds.every((id) => ownerPeople.some((person) => person.id === id))
  const mergedOwners = projected === undefined ? undefined : ownerPeople.map((person) => {
    const age = ageOnDate(person.dob, `${year}-12-31`)
    const storedOwner = withoutRecipientAge(household.ownerStateTaxFacts?.find((owner) => owner.ownerPersonId === person.id))
    const projectedOwner = withoutRecipientAge(projected.ownerStateTaxFacts?.find((owner) => owner.ownerPersonId === person.id))
    return {
      ...storedOwner,
      ...projectedOwner,
      ownerPersonId: person.id,
      ...(age === undefined ? {} : { recipientAgeYears: age }),
    }
  })
  const claimantAges = ownerPeople.map((person) => ageOnDate(person.dob, `${year}-12-31`))
  const derivedAge65 = storedAge65 ?? (allClaimantsKnown && claimantAges.every((age) => age !== undefined)
    ? claimantAges.filter((age) => age !== undefined && age >= 65).length
    : undefined)
  return {
    ...household,
    ...projected,
    ...(projected === undefined ? {} : { ownerStateTaxFacts: mergedOwners }),
    ...(derivedAge65 === undefined ? {} : { age65EligibleCount: derivedAge65 }),
    ...(row?.stateFilingStatus === undefined ? {} : { stateFilingStatus: row.stateFilingStatus }),
    ...(projected === undefined ? {} : { claimantDatesOfBirth: projected.claimantDatesOfBirth ?? household.claimantDatesOfBirth ?? plan.household.people.map((person) => person.dob) }),
    ...(election === undefined
      ? {}
      : {
          utahCreditElection:
            election === 'retirement'
              ? 'retirement' as const
              : election === 'military' || election === 'socialSecurityAndMilitary'
                ? 'socialSecurityAndMilitary' as const
                : 'auto' as const,
        }),
  }
}

/**
 * Per-account HSA facts for a tax year and residence state. Missing Plan
 * evidence for that state -> undefined (unavailable). Present rows keep omitted
 * numeric members as `{ known: false }` rather than inventing known zero. Basis
 * asserted for another state is never reused. No New Jersey cash-withdrawal
 * income category.
 */
export type ProjectedStateHsaAccountYearFacts = Pick<StateHsaYearEvidence, 'accountId' | 'ownerPersonId'> &
  Partial<Pick<StateHsaYearEvidence,
    'federalHsaDeduction' | 'employerContributionExcludedFederally' |
    'employerContributionAlreadyInStateWages' | 'employeePayrollContributions' |
    'employeeDirectContributions' | 'afterTaxContributionsAlreadyInStateIncome' |
    'interest' | 'dividends' | 'realizedGains' | 'unrealizedAppreciation' |
    'grossDistributions' | 'nonqualifiedCashWithdrawals' | 'qualifiedCashWithdrawals' | 'nonqualifiedDistributionFederalAmount' |
    'annualActivityComplete' | 'activityCategoriesComplete'>>

export function hsaAccountYearFactsForYear(
  plan: Readonly<Plan>,
  year: number,
  residenceState?: string,
  projected?: readonly ProjectedStateHsaAccountYearFacts[],
): readonly StateHsaAccountYearFactsInput[] | undefined {
  if (projected !== undefined && projected.length === 0) return []
  const stateCode = residenceState?.toUpperCase()
  const persisted = plan.stateTaxFacts.hsaYearEvidence.filter((row) => {
    if (row.taxYear !== year) return false
    if (stateCode === undefined) return true
    return row.state.toUpperCase() === stateCode
  })
  const rows: Array<Partial<StateHsaYearEvidence> & Pick<StateHsaYearEvidence, 'accountId' | 'ownerPersonId'>> = [...persisted]
  for (const actual of projected ?? []) {
    const index = rows.findIndex((row) => row.accountId === actual.accountId && row.ownerPersonId === actual.ownerPersonId)
    // Only present runtime fields replace evidence. An omitted runtime category
    // remains evidence-backed or unknown, never fabricated as zero.
    const present = Object.fromEntries(Object.entries(actual).filter(([, value]) => value !== undefined))
    const merged = { ...(index < 0 ? {} : rows[index]), ...present,
      accountId: actual.accountId, ownerPersonId: actual.ownerPersonId }
    if (index < 0) rows.push(merged)
    else rows[index] = merged
  }
  if (rows.length === 0) return evidenceComplete(plan, year, stateCode, 'hsa') ? [] : undefined
  return rows.map((row) => {
    const fact = {
      ...row,
      documentedOtherStateTaxed401aBasis: optionalKnownMoney(row.documentedOtherStateTaxed401aBasis),
      accountId: row.accountId,
      ownerPersonId: row.ownerPersonId,
      federalHsaDeduction: optionalKnownMoney(row.federalHsaDeduction),
      employerContributionExcludedFederally: optionalKnownMoney(
        row.employerContributionExcludedFederally,
      ),
      employerContributionAlreadyInStateWages: optionalKnownMoney(
        row.employerContributionAlreadyInStateWages,
      ),
      interest: optionalKnownMoney(row.interest),
      dividends: optionalKnownMoney(row.dividends),
      realizedGains: optionalKnownMoney(row.realizedGains),
      unrealizedAppreciation: optionalKnownMoney(row.unrealizedAppreciation),
      qualifiedCashWithdrawals: optionalKnownMoney(row.qualifiedCashWithdrawals),
      nonqualifiedCashWithdrawals: optionalKnownMoney(row.nonqualifiedCashWithdrawals),
      nonqualifiedDistributionFederalAmount: optionalKnownMoney(
        row.nonqualifiedDistributionFederalAmount,
      ),
      stateBasisBeforeYear: optionalKnownMoney(row.stateBasisBeforeYear),
      ...(row.documentedOtherStateTaxed401aBasis !== undefined
        ? {
            documentedOtherStateTaxed401aBasis: knownAmount(
              row.documentedOtherStateTaxed401aBasis,
            ),
          }
        : {}),
      ...(row.njAssetDispositions !== undefined
        ? { njAssetDispositions: row.njAssetDispositions }
        : {}),
      ...(row.californiaAssetDispositions !== undefined
        ? { californiaAssetDispositions: row.californiaAssetDispositions }
        : {}),
      ...(row.annualActivityComplete !== undefined
        ? { annualActivityComplete: row.annualActivityComplete }
        : {}),
    }
    return fact
  })
}

/**
 * @deprecated Prefer `hsaAccountYearFactsForYear`. Returns undefined whenever any
 * required numeric member is unknown so callers cannot treat incomplete evidence
 * as a complete numeric zero aggregate.
 */
export function hsaYearFactsForYear(
  plan: Readonly<Plan>,
  year: number,
): undefined {
  void plan
  void year
  // Legacy aggregate path intentionally disabled: absent members must not become 0.
  return undefined
}

/**
 * Resolve QCD policy from versioned state parameters when available.
 * Never invents a conforming policy from Plan user input.
 */
export function resolveStateDirectQcdPolicy(input: {
  readonly stateParamsPolicy?: StateDirectQcdPolicyInput
}): StateDirectQcdPolicyInput {
  return input.stateParamsPolicy ?? { kind: 'unknown' }
}

export function buildStateQcdEventFacts(input: {
  readonly eventId: string
  readonly accountId: string
  readonly ownerPersonId: string
  readonly grossIraDistribution: number
  readonly directCharityTransfer: number
  readonly federalExcludedAmount: number
  readonly federalTaxableAmount: number
  readonly federalBasisAllocated: number
  readonly residency: StateQcdEventFactsInput['residency']
  readonly splitInterest: boolean
  readonly priorAnnualQcdAmountUsed?: number
  readonly otherwiseTaxableAmount?: number
  readonly directTransfer?: boolean
  readonly transferDate?: string
  readonly transactionKind?: 'directQcd' | 'splitInterest' | 'other' | 'unknown'
  readonly stateAllocation?: readonly { state: string; fraction: number }[]
  readonly kansasCoveredCharitableCreditClaimed?: boolean
}): StateQcdEventFactsInput {
  return {
    ...input,
    eventId: input.eventId,
    accountId: input.accountId,
    ownerPersonId: input.ownerPersonId,
    grossIraDistribution: input.grossIraDistribution,
    directCharityTransfer: input.directCharityTransfer,
    federalExcludedAmount: input.federalExcludedAmount,
    federalTaxableAmount: input.federalTaxableAmount,
    federalBasisAllocated: input.federalBasisAllocated,
    residency: input.residency,
    splitInterest: input.splitInterest,
    ...(input.priorAnnualQcdAmountUsed !== undefined
      ? { priorAnnualQcdAmountUsed: input.priorAnnualQcdAmountUsed }
      : {}),
    ...(input.otherwiseTaxableAmount !== undefined
      ? { otherwiseTaxableAmount: input.otherwiseTaxableAmount }
      : {}),
    ...(input.directTransfer !== undefined
      ? { directTransfer: input.directTransfer }
      : {}),
  }
}

/** Build NJ Worksheet C owner pool facts from Plan IRA basis evidence + year totals. */
export function buildNjIraOwnerPoolFacts(input: {
  readonly ownerPersonId: string
  readonly december31IraValue: number
  readonly allAnnualDistributions: number
  readonly unrecoveredNjTaxedContributions: KnownMoneyInput
  readonly exemptObligationIncome?: number
  readonly fullLiquidation: boolean
}): StateNjIraOwnerPoolFactsInput {
  return {
    ownerPersonId: input.ownerPersonId,
    december31IraValue: input.december31IraValue,
    allAnnualDistributions: input.allAnnualDistributions,
    unrecoveredNjTaxedContributions: input.unrecoveredNjTaxedContributions,
    ...(input.exemptObligationIncome !== undefined
      ? { exemptObligationIncome: input.exemptObligationIncome }
      : {}),
    fullLiquidation: input.fullLiquidation,
  }
}

/**
 * Derive NJ owner pools from Plan state IRA basis evidence for a tax year.
 * Unknown unrecovered basis stays `{ known: false }` — never zero-filled.
 */
export function njIraOwnerPoolsForYear(
  plan: Readonly<Plan>,
  year: number,
): readonly StateNjIraOwnerPoolFactsInput[] | undefined {
  const rows = plan.stateTaxFacts.iraBasisYearEvidence.filter(
    (row) => row.taxYear === year && row.state === 'NJ',
  )
  if (rows.length === 0) return evidenceComplete(plan, year, 'NJ', 'iraBasis') ? [] : undefined
  const byOwner = new Map<string, typeof rows>()
  for (const row of rows) byOwner.set(row.ownerPersonId, [...(byOwner.get(row.ownerPersonId) ?? []), row])
  return [...byOwner.entries()].map(([ownerPersonId, ownerRows]) => {
    const complete = ownerRows.every((row) => row.yearEndAccountValue !== undefined &&
      row.distributionsDuringYear !== undefined && row.postYearContributionsThroughFilingDeadline !== undefined &&
      row.unrecoveredStateBasis !== undefined && row.annualDistributionsComplete === true) &&
      new Set(ownerRows.map((row) => row.accountId ?? '__ownerPool')).size === ownerRows.length &&
      !(ownerRows.length > 1 && ownerRows.some((row) => row.accountId === undefined))
    // The leaf's denominator is numeric. A missing component poisons the basis
    // evidence, so placeholders cannot be interpreted as a valid zero ratio.
    const december31IraValue = ownerRows.reduce((sum, row) => sum + (row.yearEndAccountValue ?? 0) +
      (row.postYearContributionsThroughFilingDeadline ?? 0), 0)
    const allAnnualDistributions = ownerRows.reduce((sum, row) => sum + (row.distributionsDuringYear ?? 0), 0)
    return {
      ownerPersonId, december31IraValue, allAnnualDistributions,
      unrecoveredNjTaxedContributions: complete
        ? knownAmount(ownerRows.reduce((sum, row) => sum + (row.unrecoveredStateBasis ?? 0), 0))
        : unknownAmount(),
      ...(ownerRows.every((row) => row.exemptObligationAdjustment !== undefined)
        ? { exemptObligationIncome: ownerRows.reduce((sum, row) => sum + (row.exemptObligationAdjustment ?? 0), 0) } : {}),
      fullLiquidation: complete && december31IraValue === 0 && allAnnualDistributions > 0,
      accounts: ownerRows,
      annualInputsComplete: complete,
    }
  })
}

/** @deprecated Prefer buildStateQcdEventFacts + pack-authoritative policy. */
export function buildStateQcdYearFacts(input: {
  readonly ownerPersonId: string
  readonly grossIraDistribution: number
  readonly directCharityTransfer: number
  readonly federalExcludedAmount: number
  readonly federalTaxableAmount: number
  readonly federalBasisAllocated: number
  readonly stateBasisFactsKnown: boolean
  readonly stateBasisRecovery: number
  readonly residency: StateQcdYearFactsInput['residency']
  readonly policy: StateDirectQcdPolicyInput
  readonly splitInterest: boolean
}): StateQcdYearFactsInput {
  return {
    ownerPersonId: input.ownerPersonId,
    grossIraDistribution: input.grossIraDistribution,
    directCharityTransfer: input.directCharityTransfer,
    federalExcludedAmount: input.federalExcludedAmount,
    federalTaxableAmount: input.federalTaxableAmount,
    federalBasisAllocated: input.federalBasisAllocated,
    stateBasisFactsKnown: input.stateBasisFactsKnown,
    stateBasisRecovery: input.stateBasisRecovery,
    residency: input.residency,
    policy: input.policy,
    splitInterest: input.splitInterest,
  }
}


function evidenceComplete(plan: Readonly<Plan>, year: number, state: string | undefined,
  category: 'hsa' | 'qcd' | 'iraBasis'): boolean {
  return state !== undefined && plan.stateTaxFacts.annualEvidenceCompleteness?.some((row) =>
    row.taxYear === year && row.state.toUpperCase() === state.toUpperCase() && row[category] === 'complete') === true
}

function mapEligibility(eligibility: PensionStateEligibility | undefined) {
  const { reciprocitySatisfied, ...rest } = eligibility ?? {}
  return {
    ...rest,
    ...(eligibility?.qualifiedPlanType === undefined ? {} : { qualifiedPlanType: eligibility.qualifiedPlanType }),
    ...(eligibility?.contributoryStatus === undefined || eligibility.contributoryStatus === 'unknown'
      ? {} : { publicPlanContributory: eligibility.contributoryStatus === 'contributory' }),
    ...(reciprocitySatisfied === undefined ? {} : {
      reciprocitySatisfied: reciprocitySatisfied ? 'true' as const : 'false' as const,
    }),
  }
}

export interface AnnualStateRetirementEvent {
  eventId: string
  accountId: string
  sourceOwnerPersonId: string
  recipientPersonId: string
  source: PensionSourceKind
  federallyIncludedAmount: number
  distributionDate?: string
  eligibility?: PensionStateEligibility
  stateAllocation?: readonly { state: string; fraction: number }[]
}

/** Characterize each actual action, preserving the original owner and current payee. */
export function retirementDistributionFactsForYear(plan: Readonly<Plan>, year: number,
  events: readonly AnnualStateRetirementEvent[]): readonly StateRetirementDistributionFactInput[] {
  const asserted = plan.stateTaxFacts.retirementDistributionEvidence?.filter((row) => row.taxYear === year) ?? []
  const byId = new Map<string, AnnualStateRetirementEvent>()
  for (const event of events) {
    // Persisted characterization can supplement eligibility/date, but cannot
    // replace the projected amount or recipient of an executed event.
    const evidence = asserted.find((row) => row.eventId === event.eventId && row.accountId === event.accountId &&
      row.sourceOwnerPersonId === event.sourceOwnerPersonId && row.recipientPersonId === event.recipientPersonId)
    byId.set(event.eventId, { ...evidence, ...event,
      ...(evidence === undefined ? {} : { eligibility: { ...evidence.eligibility, ...event.eligibility } }),
    })
  }
  return [...byId.values()].map((event) => {
    const recipient = plan.household.people.find((person) => person.id === event.recipientPersonId)
    const age = recipient === undefined ? undefined : ageOnDate(recipient.dob, `${year}-12-31`)
    const distributionAge = recipient === undefined || event.distributionDate === undefined ? undefined
      : ageOnDate(recipient.dob, event.distributionDate)
    const minimumAgeAtDistributionYears = recipient === undefined || distributionAge !== undefined
      ? undefined
      : ageOnDate(recipient.dob, `${year}-01-01`)
    return {
      ...event, ...mapEligibility(event.eligibility),
      ownerPersonId: event.recipientPersonId,
      sourceKind: mapPensionSourceToStateKind(event.source),
      recipientAgeYears: age ?? 0, recipientAgeKnown: age !== undefined,
      ...(distributionAge === undefined
        ? { minimumAgeAtDistributionYears }
        : { ageAtDistributionYears: distributionAge }),
      cause: event.eligibility?.distributionReason ??
        (event.recipientPersonId !== event.sourceOwnerPersonId ? 'death' as const : 'unknown' as const),
      earlyDistributionDisqualifier: inferEarlyDistributionDisqualifier({
        explicit: event.eligibility?.earlyDistributionDisqualifier,
        ageAtDistributionYears: distributionAge,
        minimumAgeAtDistributionYears,
        military: event.source === 'militaryRetirement' || event.source === 'militarySurvivor',
      }),
    }
  })
}

/**
 * Infer Box 7 / premature-penalty disqualification from explicit facts or a
 * proved distribution-age lower bound. Year-end recipient age never establishes
 * eligibility; crossing-year undated withdrawals stay unknown. Military retired
 * pay and a Survivor Benefit Plan annuity are paid under title 10 of the U.S.
 * Code, not from a qualified plan, so IRC 72(t) never reaches them: `false`
 * at any age unless the plan asserts otherwise.
 */
export function inferEarlyDistributionDisqualifier(input: {
  readonly explicit?: 'true' | 'false' | 'unknown'
  readonly ageAtDistributionYears?: number
  readonly minimumAgeAtDistributionYears?: number
  readonly military?: boolean
}): 'true' | 'false' | 'unknown' {
  if (input.explicit === 'true') return 'true'
  if (input.explicit === 'false' || input.military) return 'false'
  if (input.ageAtDistributionYears !== undefined) {
    return input.ageAtDistributionYears >= EARLY_DISTRIBUTION_MIN_AGE_YEARS ? 'false' : 'unknown'
  }
  if (input.minimumAgeAtDistributionYears !== undefined) {
    return input.minimumAgeAtDistributionYears >= EARLY_DISTRIBUTION_MIN_AGE_YEARS ? 'false' : 'unknown'
  }
  return 'unknown'
}

/** Calendar-month age preserves the 59.5 boundary without a 365.25-day proxy. */
export function ageOnDate(dob: string, date: string): number | undefined {
  const birth = parseCivilDate(dob)
  const at = parseCivilDate(date)
  if (birth === undefined || at === undefined || at < birth) return undefined
  const months = (at.getUTCFullYear() - birth.getUTCFullYear()) * 12 + at.getUTCMonth() - birth.getUTCMonth()
  return (months - (at.getUTCDate() < birth.getUTCDate() ? 1 : 0)) / 12
}

/** Parse a schema-shaped YYYY-MM-DD as a real civil date without JS rollover. */
function parseCivilDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined
  return parsed
}

type QcdEventEvidenceRow = NonNullable<Plan['stateTaxFacts']['qcdEventEvidence']>[number]
type QcdTransactionKind = NonNullable<StateQcdEventFactsInput['transactionKind']>

/** Identity is the custodian row, not the event id alone. Two accounts can share an id. */
function qcdFactKey(row: { eventId: string; accountId: string; ownerPersonId: string }): string {
  // JSON encoding keeps schema-valid ids that contain NUL distinct. A raw
  // separator would collapse `a` + `b\0c` with `a\0b` + `c`.
  return JSON.stringify([row.eventId, row.accountId, row.ownerPersonId])
}

/** One representative of each identity that appears more than once. */
export function repeatedQcdIdentities<T extends { eventId: string; accountId: string; ownerPersonId: string }>(
  rows: readonly T[],
): readonly T[] {
  const seen = new Set<string>()
  const repeated = new Map<string, T>()
  for (const row of rows) {
    const key = qcdFactKey(row)
    if (repeated.has(key)) continue
    if (seen.has(key)) repeated.set(key, row)
    else seen.add(key)
  }
  return [...repeated.values()]
}

function identityRepeated(rows: readonly { eventId: string; accountId: string; ownerPersonId: string }[]): boolean {
  return repeatedQcdIdentities(rows).length > 0
}

/** Year-end state plus any state left during the year. A move year prices both. */
function qcdActivityStates(plan: Readonly<Plan>, year: number, state: string | undefined): readonly string[] {
  const states = stateResidencySegmentsForYear(plan.household, year).map((segment) => segment.state)
  if (state !== undefined && !states.some((code) => code.toUpperCase() === state.toUpperCase())) {
    return [...states, state]
  }
  return states
}

/**
 * IRC 408(d)(8)(F) split-interest does not inherit direct-QCD treatment.
 * `other` and `unknown` are not a direct QCD either. A missing kind leaves
 * the runtime boolean, which is the projection's own direct-QCD execution.
 */
function qcdSplitInterest(kind: QcdTransactionKind | undefined, runtime: boolean): boolean {
  if (kind === 'splitInterest') return true
  if (kind === 'directQcd' || kind === 'other' || kind === 'unknown') return false
  return runtime
}

/**
 * The projection stamps `directTransfer: true` on every runtime QCD. That
 * default must not erase an attested false. `other` and `unknown` do not
 * become direct transfers by that default.
 */
function qcdDirectTransfer(
  kind: QcdTransactionKind | undefined,
  runtime: boolean | undefined,
  evidence: boolean | undefined,
): boolean | undefined {
  if (kind === 'other' || kind === 'unknown') return false
  if (runtime === true && evidence !== undefined) return evidence
  return runtime ?? evidence
}

function mergeQcdRuntimeWithEvidence(
  event: StateQcdEventFactsInput,
  evidence: QcdEventEvidenceRow | undefined,
): StateQcdEventFactsInput {
  const kind = evidence?.transactionKind ?? event.transactionKind
  const transferDate = event.transferDate ?? evidence?.transferDate
  const kansas = event.kansasCoveredCharitableCreditClaimed ?? evidence?.kansasCoveredCharitableCreditClaimed
  const stateAllocation = event.stateAllocation ?? evidence?.stateAllocation
  const directTransfer = qcdDirectTransfer(kind, event.directTransfer, evidence?.directTransfer)
  return {
    ...event,
    // Runtime residency 'unknown' is the unobserved default, not a finding.
    residency: event.residency === 'unknown' && evidence !== undefined ? evidence.residency : event.residency,
    splitInterest: qcdSplitInterest(kind, event.splitInterest),
    ...(directTransfer !== undefined ? { directTransfer } : {}),
    ...(kind !== undefined ? { transactionKind: kind } : {}),
    ...(transferDate !== undefined ? { transferDate } : {}),
    ...(kansas !== undefined ? { kansasCoveredCharitableCreditClaimed: kansas } : {}),
    ...(stateAllocation !== undefined ? { stateAllocation } : {}),
  }
}

function qcdMarkedUnknown(plan: Readonly<Plan>, year: number, state: string | undefined): boolean {
  const states = qcdActivityStates(plan, year, state)
  return plan.stateTaxFacts.annualEvidenceCompleteness?.some((row) =>
    row.taxYear === year && row.qcd === 'unknown' &&
    states.some((code) => code.toUpperCase() === row.state.toUpperCase())) === true
}

/**
 * An empty runtime list is a known-empty QCD year only when no custodian row
 * exists and no state being priced marks QCD activity unknown. Evidence rows
 * have no state column, so they are year-scoped.
 */
export function qcdEmptyRuntimeIsUnobserved(plan: Readonly<Plan>, year: number, state?: string): boolean {
  const yearEvidence = plan.stateTaxFacts.qcdEventEvidence?.some((row) => row.taxYear === year) === true
  return yearEvidence || qcdMarkedUnknown(plan, year, state)
}

export function qcdEventFactsForYear(plan: Readonly<Plan>, year: number,
  events: readonly StateQcdEventFactsInput[] | undefined, state?: string): readonly StateQcdEventFactsInput[] | undefined {
  const asserted = plan.stateTaxFacts.qcdEventEvidence?.filter((row) => row.taxYear === year) ?? []
  const runtime = events ?? []
  // Two custodian or runtime rows with one identity do not elect a dollar
  // amount by array order, and a later unmatched row must not replace the
  // executed distribution.
  if (identityRepeated(asserted) || identityRepeated(runtime)) return undefined
  const byKey = new Map<string, StateQcdEventFactsInput>()
  const matched = new Set<QcdEventEvidenceRow>()
  for (const event of runtime) {
    const evidence = asserted.find((row) => row.eventId === event.eventId && row.accountId === event.accountId && row.ownerPersonId === event.ownerPersonId)
    if (evidence !== undefined) matched.add(evidence)
    byKey.set(qcdFactKey(event), mergeQcdRuntimeWithEvidence(event, evidence))
  }
  // An unmatched custodian row was not debited and its federal taxable
  // amount is not in the projected base. Pricing it as a QCD would make the
  // NJ Worksheet C delta (state taxable minus federalTaxableAmount) land on
  // a federal base that omits that distribution. IRC 408(d)(8)(A) applies to
  // the executed transfer. The year stays incomplete instead.
  if (asserted.some((row) => !matched.has(row))) return undefined
  if (byKey.size === 0 && !evidenceComplete(plan, year, state, 'qcd')) {
    // An unobserved list, or a year the plan marks unknown, is not a
    // known-empty collection. The forced-distribution caller reaches this
    // by passing undefined when it executed no QCD and the year is unknown.
    // Unmatched custodian evidence returns above, also incomplete.
    if (events === undefined || qcdMarkedUnknown(plan, year, state)) return undefined
  }
  // One observed event does not make an explicitly unknown year complete.
  if (qcdMarkedUnknown(plan, year, state)) return undefined
  return [...byKey.values()]
}
