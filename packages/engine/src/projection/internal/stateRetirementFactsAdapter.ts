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
  StateNjIraOwnerPoolLedgerAccountInput,
  StateQcdEventFactsInput,
  StateQcdYearFactsInput,
  StateRetirementDistributionFactInput,
} from '../types.js'
import type { StateAgeAttainmentConvention } from '../../params/state/types.js'

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
      cause,
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

/**
 * The claimants' dates of birth for a projected year: supplied or stored ones
 * as given, else one per claimant in claimant order. A date that does not
 * parse is kept, so every reader fails closed on it; when a claimant id names
 * no household person there is no date to publish for that claimant, so the
 * list is left out rather than published short, and a reader cannot derive
 * an age count from the claimants it does know.
 */
function claimantDatesOfBirthFor(
  plan: Readonly<Plan>,
  projected: StateHouseholdTaxFactsInput,
  stored: readonly string[] | undefined,
): { claimantDatesOfBirth?: string[] } {
  const given = projected.claimantDatesOfBirth ?? stored
  if (given !== undefined) return { claimantDatesOfBirth: [...given] }
  const claimantIds = projected.claimantPersonIds ?? plan.household.people.map((person) => person.id)
  const dates = claimantIds.map((id) => plan.household.people.find((person) => person.id === id)?.dob)
  return dates.every((dob) => dob !== undefined) ? { claimantDatesOfBirth: dates as string[] } : {}
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
  // A stored count is the plan's assertion for every state and is the only
  // thing published as `age65EligibleCount`. Otherwise the count comes from
  // the claimants' dates of birth under each convention and is published only
  // as `age65EligibleCountByConvention`, so a caller that later sets
  // `age65EligibleCount` asserts it whatever value the derivation had.
  const derivedAge65ByConvention = storedAge65 === undefined && allClaimantsKnown
    ? age65EligibleCountsByConvention(ownerPeople.map((person) => person.dob), year)
    : undefined
  return {
    ...household,
    ...projected,
    ...(projected === undefined ? {} : { ownerStateTaxFacts: mergedOwners }),
    ...(storedAge65 === undefined ? {} : { age65EligibleCount: storedAge65 }),
    ...(derivedAge65ByConvention === undefined ? {} : { age65EligibleCountByConvention: derivedAge65ByConvention }),
    ...(row?.stateFilingStatus === undefined ? {} : { stateFilingStatus: row.stateFilingStatus }),
    ...(projected === undefined ? {} : claimantDatesOfBirthFor(plan, projected, household.claimantDatesOfBirth)),
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
 * Per-account HSA facts for a tax year and residence state, the year-level
 * selection the state calculator prices
 * (state-hsa-evidence-runtime-merge-and-completeness):
 * - No residence state -> undefined. Evidence rows and completeness marks are
 *   keyed by state, so none can be chosen, and rows from several states are
 *   never mixed into one collection.
 * - The plan marks that state's HSA year unknown -> undefined, even when
 *   evidence or runtime rows exist: a partial collection is not priced as the
 *   whole year.
 * - Otherwise the state's persisted evidence for the year is merged with the
 *   runtime rows. An empty runtime list is merged the same way, so an
 *   asserted row is returned rather than dropped.
 * - No rows at all -> `[]` (known empty) when a runtime list was passed or
 *   the plan marks the year complete; else undefined (unavailable).
 * The funding caller passes `federalHsaDeduction: 0` when it did not model a
 * contribution. That default does not replace an asserted deduction. A
 * present non-zero deduction does. Every other present runtime amount,
 * including a measured zero from a characterized withdrawal, replaces
 * evidence. Omitted runtime members stay evidence-backed or `{ known: false }`.
 * Basis asserted for another state is never reused. No New Jersey
 * cash-withdrawal income category.
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
  // Every evidence row and completeness mark names one state, and the CA and
  // NJ consumers each keep their own HSA basis (ca-hsa-state-basis-nonconformity,
  // nj-hsa-state-basis-nonconformity). Without a state none can be selected,
  // and returning every state's rows would put one account's CA and NJ facts
  // into a single computation. Fail closed instead.
  const stateCode = residenceState?.trim().toUpperCase()
  if (stateCode === undefined || stateCode === '') return undefined
  // A year the plan marks unknown for this state stays unavailable even with
  // rows, as a QCD-unknown year does: the rows observed are not the year.
  const mark = evidenceMark(plan, year, stateCode, 'hsa')
  if (mark === 'unknown') return undefined
  const persisted = plan.stateTaxFacts.hsaYearEvidence.filter((row) =>
    row.taxYear === year && row.state.toUpperCase() === stateCode)
  const rows: Array<Partial<StateHsaYearEvidence> & Pick<StateHsaYearEvidence, 'accountId' | 'ownerPersonId'>> = [...persisted]
  for (const actual of projected ?? []) {
    const index = rows.findIndex((row) => row.accountId === actual.accountId && row.ownerPersonId === actual.ownerPersonId)
    const evidence = index < 0 ? undefined : rows[index]
    // Present runtime fields replace evidence, including a measured zero.
    // federalHsaDeduction is the exception: the funding caller passes 0 for
    // every account whose contribution was not modeled, and that default is
    // not a finding that an asserted federal deduction is zero. An omitted
    // runtime category stays evidence-backed or unknown, never fabricated.
    const present = Object.fromEntries(Object.entries(actual).filter(([key, value]) => {
      if (value === undefined) return false
      if (key !== 'federalHsaDeduction' || value !== 0 || evidence === undefined) return true
      return typeof evidence.federalHsaDeduction !== 'number'
    }))
    const merged = { ...(evidence ?? {}), ...present,
      accountId: actual.accountId, ownerPersonId: actual.ownerPersonId }
    if (index < 0) rows.push(merged)
    else rows[index] = merged
  }
  // An empty runtime list is a known-empty year only after the state's
  // persisted evidence has been read (an asserted row is kept above).
  if (rows.length === 0) return projected !== undefined || mark === 'complete' ? [] : undefined
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
 * Derive NJ owner pools for a tax year.
 *
 * Evidence rows win when any New Jersey row exists for the year. A missing
 * unrecovered-basis field stays `{ known: false }` and is never zero-filled.
 * An omitted exempt-obligation adjustment contributes none of that income; it
 * does not drop an amount another IRA of the same owner asserted. A negative
 * adjustment is passed through so Worksheet C rejects the pool.
 *
 * An owner with no New Jersey basis evidence in a New Jersey year gets a
 * ledger pool when `ledger` is supplied: line 1 is the modeled December 31
 * value after the year's investment return and line 2 the year's IRA
 * distributions (njIraLedgerOwnerPools). Its basis is unknown here. The
 * annual state enrichment fills it from the accepted prior-year Worksheet C
 * Part II carry, or drops the pool, so a year with no basis evidence in any
 * year keeps no pool and Worksheet C reports nj-qcd-basis-unknown. A year
 * the plan marks `iraBasis: 'unknown'`, or certifies complete, gets no
 * ledger pool.
 */
export function njIraOwnerPoolsForYear(
  plan: Readonly<Plan>,
  year: number,
  ledger?: NjIraLedgerYear,
): readonly StateNjIraOwnerPoolFactsInput[] | undefined {
  const rows = plan.stateTaxFacts.iraBasisYearEvidence.filter(
    (row) => row.taxYear === year && isNjState(row.state),
  )
  const basisList = evidenceMark(plan, year, 'NJ', 'iraBasis')
  const ledgerPools = basisList === undefined && ledger !== undefined && njIraResidentInYear(plan, year)
    ? njIraLedgerOwnerPools(ledger).filter((pool) => !rows.some((row) => row.ownerPersonId === pool.ownerPersonId))
    : []
  if (rows.length === 0) {
    if (basisList === 'complete') return []
    return ledgerPools.length === 0 ? undefined : ledgerPools
  }
  const byOwner = new Map<string, typeof rows>()
  for (const row of rows) byOwner.set(row.ownerPersonId, [...(byOwner.get(row.ownerPersonId) ?? []), row])
  const evidencePools = [...byOwner.entries()].map(([ownerPersonId, ownerRows]) => {
    const fieldsComplete = ownerRows.every((row) => row.yearEndAccountValue !== undefined &&
      row.distributionsDuringYear !== undefined && row.postYearContributionsThroughFilingDeadline !== undefined &&
      row.unrecoveredStateBasis !== undefined && row.annualDistributionsComplete === true) &&
      new Set(ownerRows.map((row) => row.accountId ?? '__ownerPool')).size === ownerRows.length &&
      !(ownerRows.length > 1 && ownerRows.some((row) => row.accountId === undefined))
    const adjustments = ownerRows.flatMap((row) =>
      row.exemptObligationAdjustment === undefined ? [] : [row.exemptObligationAdjustment])
    const invalidAdjustment = adjustments.find((value) => !Number.isFinite(value) || value < 0)
    const adjustmentInvalid = invalidAdjustment !== undefined
    const assertedLiquidation = ownerRows.flatMap((row) =>
      row.fullLiquidation === undefined ? [] : [row.fullLiquidation])
    const liquidationConflict = assertedLiquidation.includes(true) && assertedLiquidation.includes(false)
    // The leaf's denominator is numeric. A missing component poisons the basis
    // evidence, so placeholders cannot be interpreted as a valid zero ratio.
    const december31IraValue = ownerRows.reduce((sum, row) => sum + (row.yearEndAccountValue ?? 0) +
      (row.postYearContributionsThroughFilingDeadline ?? 0), 0)
    const allAnnualDistributions = ownerRows.reduce((sum, row) => sum + (row.distributionsDuringYear ?? 0), 0)
    const complete = fieldsComplete && !liquidationConflict
    const fullLiquidation = liquidationConflict
      ? false
      : assertedLiquidation.length > 0
        ? assertedLiquidation.every((value) => value)
        : fieldsComplete && december31IraValue === 0 && allAnnualDistributions > 0
    return {
      ownerPersonId, december31IraValue, allAnnualDistributions,
      unrecoveredNjTaxedContributions: fieldsComplete
        ? knownAmount(ownerRows.reduce((sum, row) => sum + (row.unrecoveredStateBasis ?? 0), 0))
        : unknownAmount(),
      ...(adjustments.length === 0 || invalidAdjustment === undefined ? {} : {
        exemptObligationIncome: invalidAdjustment,
      }),
      ...(adjustments.length === 0 || adjustmentInvalid ? {} : {
        exemptObligationIncome: adjustments.reduce((sum, value) => sum + value, 0),
      }),
      fullLiquidation,
      accounts: ownerRows,
      annualInputsComplete: complete,
    }
  })
  return ledgerPools.length === 0 ? evidencePools : [...evidencePools, ...ledgerPools]
}

/** One owned traditional IRA on the projected year's ledger, with its owner. */
export interface NjIraLedgerAccount extends StateNjIraOwnerPoolLedgerAccountInput {
  readonly ownerPersonId: string
  /**
   * The owner's IRA aggregate holds an IRA-funded annuity contract this year.
   * The ledger rows do not carry the contract, so line 1 would omit it.
   */
  readonly ownerHoldsIraAnnuityContract?: boolean
}

/** The ledger a projected New Jersey owner pool is built from. */
export interface NjIraLedgerYear {
  readonly accounts: readonly NjIraLedgerAccount[]
  /** The priced input's retirement distribution rows, including pending ones. */
  readonly distributions?: readonly StateRetirementDistributionFactInput[]
  readonly qcdEvents?: readonly StateQcdEventFactsInput[]
  /** Gross on the priced input that the ledger has not debited yet, by account. */
  readonly pendingGrossByAccount?: ReadonlyMap<string, number>
}

/**
 * The owner's IRAs on the year's ledger, one row per logical account.
 *
 * `growthFactors` is positional over `balances`: the factor the year's
 * post-solve growth phase multiplies each physical row by. A logical account
 * whose rows grow by different factors has no single factor, but still has
 * a grown balance: each row's balance times its own factor, summed.
 */
export function njIraLedgerAccounts(input: {
  readonly balances: readonly { readonly account: Account; readonly balance: number }[]
  readonly growthFactors: readonly number[]
  readonly isOwnerIraThisYear: (account: Account) => boolean
  readonly primaryPersonId: string
  /** Owners whose IRA aggregate holds an IRA-funded annuity contract this year. */
  readonly iraAnnuityContractOwners?: ReadonlySet<string>
}): readonly NjIraLedgerAccount[] {
  const byId = new Map<string, { account: Account; balance: number; factors: number[]; grown: number }>()
  for (const [index, state] of input.balances.entries()) {
    if (!input.isOwnerIraThisYear(state.account)) continue
    const row = byId.get(state.account.id) ?? { account: state.account, balance: 0, factors: [], grown: 0 }
    const factor = input.growthFactors[index] ?? Number.NaN
    row.balance += state.balance
    row.factors.push(factor)
    row.grown += state.balance * factor
    byId.set(state.account.id, row)
  }
  return [...byId.values()].map(({ account, balance, factors, grown }) => {
    const known = factors.every((factor) => Number.isFinite(factor) && factor >= 0)
    const first = factors[0]!
    const growthFactor = known && factors.every((factor) => factor === first) ? first : undefined
    const ownerPersonId = account.ownerPersonId ?? input.primaryPersonId
    return {
      accountId: account.id,
      ownerPersonId,
      balance,
      ...(growthFactor === undefined ? {} : { growthFactor }),
      ...(known && Number.isFinite(grown) ? { grownBalance: grown } : {}),
      treatedAsOwn: account.type === 'traditional' && account.inherited !== undefined,
      ...(input.iraAnnuityContractOwners?.has(ownerPersonId) === true ? { ownerHoldsIraAnnuityContract: true } : {}),
    }
  })
}

/**
 * New Jersey Worksheet C lines 1 and 2 for each owner, from the ledger.
 *
 * GIT-1 & 2 (January 2026) and the 2025 NJ-1040 Worksheet C: line 1 is the
 * value of the IRA on December 31, and line 2 is all IRA distributions
 * during the year. The projection debits the year's distributions and then
 * grows the remaining balance (annualPostSolveAccountGrowth), so the
 * December 31 value is each account's balance less its pending gross, times
 * that growth factor. Line 2 counts each QCD once and each other traditional
 * IRA distribution row once (a Roth conversion is one such row), restricted
 * to the owner's own IRAs, the same reconciliation the state calculator
 * makes. Contributions are in the ledger balance already; the projection
 * makes none after December 31.
 *
 * An account with nothing pending contributes its grown balance, each
 * physical row grown by its own factor. A pending draw is not split across
 * physical rows, so an account with one needs a single growth factor.
 *
 * A pool is not complete when an account's growth is unknown, a pending
 * draw falls on an account whose rows grow apart, a pending gross exceeds
 * its balance, or a spouse's inherited IRA treated as the owner's own joins
 * the pool (its New Jersey basis is not carried).
 */
export function njIraLedgerOwnerPools(ledger: NjIraLedgerYear): readonly StateNjIraOwnerPoolFactsInput[] {
  const owners = [...new Set(ledger.accounts.map((account) => account.ownerPersonId))]
  return owners.map((ownerPersonId) => {
    const pool = njIraLedgerOwnerPool(ownerPersonId,
      ledger.accounts.filter((account) => account.ownerPersonId === ownerPersonId), ledger)
    const annuity = ledger.accounts.some((account) => account.ownerPersonId === ownerPersonId && account.ownerHoldsIraAnnuityContract === true)
    return annuity ? { ...pool, unvaluedIraAnnuityContract: true } : pool
  })
}

/**
 * Rebuild ledger pools for a priced input that adds pending distributions
 * (a funding candidate's need-based draws). Evidence pools are unchanged.
 */
export function refreshNjIraLedgerOwnerPools(
  pools: readonly StateNjIraOwnerPoolFactsInput[] | undefined,
  priced: Omit<NjIraLedgerYear, 'accounts'>,
): readonly StateNjIraOwnerPoolFactsInput[] | undefined {
  if (pools === undefined || !pools.some((pool) => pool.projectedLedger !== undefined)) return pools
  return pools.map((pool) => pool.projectedLedger === undefined
    ? pool
    : {
        ...njIraLedgerOwnerPool(pool.ownerPersonId, pool.projectedLedger.accounts, priced),
        ...(pool.unvaluedIraAnnuityContract === true ? { unvaluedIraAnnuityContract: true } : {}),
      })
}

function njIraLedgerOwnerPool(
  ownerPersonId: string,
  accounts: readonly StateNjIraOwnerPoolLedgerAccountInput[],
  priced: Omit<NjIraLedgerYear, 'accounts'>,
): StateNjIraOwnerPoolFactsInput {
  const ids = new Set(accounts.map((account) => account.accountId))
  const qcd = (priced.qcdEvents ?? []).filter((event) => event.ownerPersonId === ownerPersonId && ids.has(event.accountId))
  const other = (priced.distributions ?? []).filter((row) =>
    row.ownerPersonId === ownerPersonId && row.sourceKind === 'ira' && row.accountTaxTreatment !== 'roth' &&
    row.accountId !== undefined && ids.has(row.accountId) &&
    !qcd.some((event) => event.eventId === row.eventId && event.accountId === row.accountId))
  const allAnnualDistributions = other.reduce((sum, row) => sum + Math.max(0, row.grossDistribution ?? 0), 0) +
    qcd.reduce((sum, event) => sum + Math.max(0, event.grossIraDistribution), 0)
  let complete = Number.isFinite(allAnnualDistributions)
  let december31 = 0
  for (const account of accounts) {
    const pending = Math.max(0, priced.pendingGrossByAccount?.get(account.accountId) ?? 0)
    const remaining = account.balance - pending
    // A pending draw leaves line 1 only when the priced input carries it on line 2.
    const carried = other.reduce((sum, row) => row.accountId === account.accountId ? sum + Math.max(0, row.grossDistribution ?? 0) : sum, 0)
    const idle = pending <= 0.005 && account.grownBalance !== undefined
    if ((!idle && account.growthFactor === undefined) || account.treatedAsOwn || !Number.isFinite(remaining) || remaining < -0.005 ||
      carried < pending - 0.005) complete = false
    december31 += idle ? Math.max(0, account.grownBalance!) : Math.max(0, remaining) * (account.growthFactor ?? 1)
  }
  // A drained ledger leaves cents of floating-point residue, not an IRA value.
  const december31IraValue = Math.abs(december31) < 0.005 ? 0 : december31
  return {
    ownerPersonId,
    december31IraValue,
    allAnnualDistributions,
    unrecoveredNjTaxedContributions: unknownAmount(),
    fullLiquidation: december31IraValue === 0 && allAnnualDistributions > 0,
    annualInputsComplete: complete,
    projectedLedger: { accounts: accounts.map((account) => ({
      accountId: account.accountId, balance: account.balance,
      ...(account.growthFactor === undefined ? {} : { growthFactor: account.growthFactor }),
      ...(account.grownBalance === undefined ? {} : { grownBalance: account.grownBalance }),
      treatedAsOwn: account.treatedAsOwn,
    })) },
  }
}

/** True when any part of the year is a New Jersey residency segment. */
export function njIraResidentInYear(plan: Readonly<Plan>, year: number): boolean {
  return stateResidencySegmentsForYear(plan.household, year).some((segment) => isNjState(segment.state))
}

function isNjState(state: string | undefined): boolean {
  return state?.toUpperCase() === 'NJ'
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


function evidenceMark(plan: Readonly<Plan>, year: number, state: string | undefined,
  category: 'hsa' | 'qcd' | 'iraBasis'): 'complete' | 'unknown' | undefined {
  if (state === undefined) return undefined
  const row = plan.stateTaxFacts.annualEvidenceCompleteness?.find((candidate) =>
    candidate.taxYear === year && candidate.state.toUpperCase() === state.toUpperCase())
  const mark = row?.[category]
  return mark === 'complete' || mark === 'unknown' ? mark : undefined
}

function evidenceComplete(plan: Readonly<Plan>, year: number, state: string | undefined,
  category: 'hsa' | 'qcd' | 'iraBasis'): boolean {
  return evidenceMark(plan, year, state, category) === 'complete'
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
  /**
   * Whether the event is a distribution "made to a beneficiary ... on or
   * after the death of the employee" (IRC 72(t)(2)(A)(ii)): true for an
   * inherited account the year's owner-treatment facts leave inherited, false
   * for an owned account or an inherited IRA a surviving spouse's effective
   * election has made the spouse's own, and absent when the producer cannot
   * tell. It is the row's cause (`death`, or `unknown` otherwise) unless the
   * plan states a distribution reason; the two person ids never decide it.
   */
  paidToBeneficiaryAfterDeath?: boolean
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
  return [...byId.values()].map(({ paidToBeneficiaryAfterDeath, ...event }) => {
    const recipient = plan.household.people.find((person) => person.id === event.recipientPersonId)
    const age = recipient === undefined ? undefined : ageOnDate(recipient.dob, `${year}-12-31`)
    const distributionAge = recipient === undefined || event.distributionDate === undefined ? undefined
      : ageOnDate(recipient.dob, event.distributionDate)
    const minimumAgeAtDistributionYears = recipient === undefined || distributionAge !== undefined
      ? undefined
      : ageOnDate(recipient.dob, `${year}-01-01`)
    // The producer classifies the event from the account's inherited marker
    // and the year's owner treatment; a recipient who differs from the source
    // owner does not by itself make the distribution a death distribution.
    const cause = event.eligibility?.distributionReason ??
      (paidToBeneficiaryAfterDeath === true ? 'death' as const : 'unknown' as const)
    return {
      ...event, ...mapEligibility(event.eligibility),
      ownerPersonId: event.recipientPersonId,
      sourceKind: mapPensionSourceToStateKind(event.source),
      recipientAgeYears: age ?? 0, recipientAgeKnown: age !== undefined,
      ...(distributionAge === undefined
        ? { minimumAgeAtDistributionYears }
        : { ageAtDistributionYears: distributionAge }),
      cause,
      earlyDistributionDisqualifier: inferEarlyDistributionDisqualifier({
        explicit: event.eligibility?.earlyDistributionDisqualifier,
        ageAtDistributionYears: distributionAge,
        minimumAgeAtDistributionYears,
        military: event.source === 'militaryRetirement' || event.source === 'militarySurvivor',
        cause,
      }),
    }
  })
}

/**
 * Infer Box 7 / premature-penalty disqualification from explicit facts, the
 * distribution's cause, or a proved distribution-age lower bound. Year-end
 * recipient age never establishes eligibility; crossing-year undated
 * withdrawals stay unknown. Military retired pay and a Survivor Benefit Plan
 * annuity are paid under title 10 of the U.S. Code, not from a qualified plan,
 * so IRC 72(t) never reaches them: `false` at any age unless the plan asserts
 * otherwise. A distribution "made to a beneficiary (or to the estate of the
 * employee) on or after the death of the employee" is excepted by IRC
 * 72(t)(2)(A)(ii) at any age (Form 1099-R code 4), so a `death` cause is
 * `false` too (irc-72-t-2-A-ii-death-beneficiary-exception). An explicit
 * `true` still wins over both.
 */
export function inferEarlyDistributionDisqualifier(input: {
  readonly explicit?: 'true' | 'false' | 'unknown'
  readonly ageAtDistributionYears?: number
  readonly minimumAgeAtDistributionYears?: number
  readonly military?: boolean
  readonly cause?: StateRetirementDistributionFactInput['cause']
}): 'true' | 'false' | 'unknown' {
  if (input.explicit === 'true') return 'true'
  if (input.explicit === 'false' || input.military || input.cause === 'death') return 'false'
  if (input.ageAtDistributionYears !== undefined) {
    return input.ageAtDistributionYears >= EARLY_DISTRIBUTION_MIN_AGE_YEARS ? 'false' : 'unknown'
  }
  if (input.minimumAgeAtDistributionYears !== undefined) {
    return input.minimumAgeAtDistributionYears >= EARLY_DISTRIBUTION_MIN_AGE_YEARS ? 'false' : 'unknown'
  }
  return 'unknown'
}

/**
 * The date a state's "65 or older on December 31" test reads the age at.
 * Under `dayBeforeBirthday` an age is attained the day before the birthday,
 * which is the age on the following January 1.
 */
export function stateAgeTestDate(taxYear: number, convention: StateAgeAttainmentConvention): string {
  return convention === 'dayBeforeBirthday' ? `${taxYear + 1}-01-01` : `${taxYear}-12-31`
}

/**
 * The number of claimants 65 or older at the end of the tax year under each
 * age-attainment convention. Undefined when any date of birth does not parse
 * or falls after the test date.
 */
export function age65EligibleCountsByConvention(
  datesOfBirth: readonly string[],
  taxYear: number,
): Readonly<Record<StateAgeAttainmentConvention, number>> | undefined {
  const count = (convention: StateAgeAttainmentConvention): number | undefined => {
    const ages = datesOfBirth.map((dob) => ageOnDate(dob, stateAgeTestDate(taxYear, convention)))
    return ages.every((age) => age !== undefined) ? ages.filter((age) => age !== undefined && age >= 65).length : undefined
  }
  const lastDayOfTaxYear = count('lastDayOfTaxYear')
  const dayBeforeBirthday = count('dayBeforeBirthday')
  return lastDayOfTaxYear === undefined || dayBeforeBirthday === undefined ? undefined : { lastDayOfTaxYear, dayBeforeBirthday }
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
