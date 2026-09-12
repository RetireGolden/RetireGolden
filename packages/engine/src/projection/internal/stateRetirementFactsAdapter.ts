/**
 * Adapter from Plan / annual pension facts to state retirement leaf fact shapes.
 *
 * Preserves source evidence and unknown facts while preparing annual state
 * calculator inputs. Policy and tax arithmetic remain in the state leaves.
 */
import type {
  Account,
  PensionSourceKind,
  Plan,
  StateTaxYearHouseholdFacts,
  PensionStateEligibility,
  StateHsaYearEvidence,
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

function knownAmount(amount: number): KnownMoneyInput {
  return { known: true, amount }
}

function unknownAmount(): KnownMoneyInput {
  return { known: false }
}

function optionalKnownMoney(value: number | undefined): KnownMoneyInput {
  return value === undefined ? unknownAmount() : knownAmount(value)
}

/** Map persisted pension source to the leaf source-kind vocabulary. */
export function mapPensionSourceToStateKind(
  source: PensionSourceKind | undefined,
): StateRetirementSourceKind {
  switch (source) {
    case undefined:
    case 'private':
      return 'unknownPrivate'
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
}): AnnualPensionDistributionCharacterization {
  const source = input.account.source ?? 'private'
  const eligibility = input.account.stateEligibility
  const isSurvivorPayee = input.payeePersonId !== input.sourceOwnerPersonId
  const cause =
    input.causeOverride ??
    eligibility?.distributionReason ??
    (isSurvivorPayee ? 'death' : 'ordinary')
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
    earlyDistributionDisqualifier:
      eligibility?.earlyDistributionDisqualifier ?? 'unknown',
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
  const { year: householdYear, utahCreditElection: election, ...household } = row ?? { year }
  void householdYear
  return {
    ...household,
    ...projected,
    ...(projected === undefined ? {} : { ownerStateTaxFacts: plan.household.people.filter((person) =>
      projected.claimantPersonIds === undefined || projected.claimantPersonIds.includes(person.id)).map((person) => ({
      ...household.ownerStateTaxFacts?.find((owner) => owner.ownerPersonId === person.id),
      ...projected.ownerStateTaxFacts?.find((owner) => owner.ownerPersonId === person.id),
      ownerPersonId: person.id,
      recipientAgeYears: ageOnDate(person.dob, `${year}-12-31`),
    })) }),
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
 * evidence for that state â‡’ undefined (unavailable). Present rows keep omitted
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
    const coarse = event.source === 'private' || event.source === 'public' || event.source === 'unknownPrivate' || event.source === 'unknownPublic' || event.source === 'employerPlan'
    byId.set(event.eventId, { ...evidence, ...event,
      ...(evidence === undefined ? {} : { eligibility: { ...evidence.eligibility, ...event.eligibility } }),
      ...(coarse && evidence !== undefined ? { source: evidence.source } : {}),
    })
  }
  return [...byId.values()].map((event) => {
    const recipient = plan.household.people.find((person) => person.id === event.recipientPersonId)
    const age = recipient === undefined ? undefined : ageOnDate(recipient.dob, `${year}-12-31`)
    const distributionAge = recipient === undefined || event.distributionDate === undefined ? undefined
      : ageOnDate(recipient.dob, event.distributionDate)
    return {
      ...event, ...mapEligibility(event.eligibility),
      ownerPersonId: event.recipientPersonId,
      sourceKind: mapPensionSourceToStateKind(event.source),
      recipientAgeYears: age ?? 0, recipientAgeKnown: age !== undefined,
      ...(distributionAge === undefined ? { minimumAgeAtDistributionYears: recipient === undefined ? undefined : ageOnDate(recipient.dob, `${year}-01-01`) } : { ageAtDistributionYears: distributionAge }),
      cause: event.eligibility?.distributionReason ??
        (event.recipientPersonId !== event.sourceOwnerPersonId ? 'death' as const : 'unknown' as const),
      earlyDistributionDisqualifier: event.eligibility?.earlyDistributionDisqualifier ?? 'unknown' as const,
    }
  })
}

/** Calendar-month age preserves the 59.5 boundary without a 365.25-day proxy. */
function ageOnDate(dob: string, date: string): number | undefined {
  const birth = new Date(`${dob}T00:00:00Z`)
  const at = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(at.getTime()) || at < birth) return undefined
  const months = (at.getUTCFullYear() - birth.getUTCFullYear()) * 12 + at.getUTCMonth() - birth.getUTCMonth()
  return (months - (at.getUTCDate() < birth.getUTCDate() ? 1 : 0)) / 12
}

export function qcdEventFactsForYear(plan: Readonly<Plan>, year: number,
  events: readonly StateQcdEventFactsInput[] | undefined, state?: string): readonly StateQcdEventFactsInput[] | undefined {
  const asserted = plan.stateTaxFacts.qcdEventEvidence?.filter((row) => row.taxYear === year) ?? []
  const byId = new Map<string, StateQcdEventFactsInput>()
  for (const event of events ?? []) {
    const evidence = asserted.find((row) => row.eventId === event.eventId && row.accountId === event.accountId && row.ownerPersonId === event.ownerPersonId)
    byId.set(event.eventId, { ...evidence, ...event })
  }
  if (events === undefined && byId.size === 0 && !evidenceComplete(plan, year, state, 'qcd')) return undefined
  return [...byId.values()]
}
