/**
 * Plan the annual pension and annuity income phase without mutating simulator
 * state. The coordinator preserves Plan account order, the legacy duplicate-
 * person lookup asymmetry, and every IEEE-754 fold performed by the former
 * inline block. The caller remains responsible for committing the returned
 * exclusion-state writes, contract-value debits, runtime journal rows and
 * cash-flow records at the phase's original orchestration point.
 */
import type { Account, PensionSourceKind, Person } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { socialSecurityDobParts } from '../../socialSecurity/annualTiming.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'
import {
  annuityExclusionMultiple,
  annuityPayoutForm,
  annuityPayoutFraction,
} from '../annuityForms.js'
import type {
  PersonYearState,
  QualifiedAnnuityPaymentActivity,
  SimulatorRetirementRuntimeApplication,
  StateRetirementDistributionFactInput,
} from '../types.js'
import {
  characterizePensionDistribution,
  ageOnDate,
  inferEarlyDistributionDisqualifier,
  isPublicPensionSourceKind,
  type AnnualPensionDistributionCharacterization,
} from './stateRetirementFactsAdapter.js'

type RetirementRuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
    ? Application extends SimulatorRetirementRuntimeApplication
      ? Omit<Application, 'mutationOrdinal'>
      : never
    : never

export interface AnnualAnnuityExclusionState {
  readonly ratio: number
  readonly remaining: number
}

export interface AnnualPensionCashFlowRecord {
  readonly accountId: string
  readonly payeePersonId: string
  readonly amount: number
  readonly source: PensionSourceKind
}

export interface AnnualAnnuityCashFlowRecord {
  readonly accountId: string
  readonly recipientPersonId: string
  readonly paid: number
  readonly nonqualifiedExcludable: number
  readonly qualifiedIraFunded: boolean
  readonly fundingOwnerPersonId: string | null
}

export interface AnnualQualifiedAnnuityContractDistribution {
  readonly annuityAccountId: string
  readonly poolOwnerPersonId: string
  readonly grossAmountPlanDollars: number
  readonly contractValueAfter: number
  readonly occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>
  readonly application: Readonly<RetirementRuntimeApplicationWithoutOrdinal>
}

export type AnnualPensionAndAnnuityIncomeRow =
  | Readonly<{
      kind: 'pension'
      accountId: string
      record: AnnualPensionCashFlowRecord | null
    }>
  | Readonly<{
      kind: 'annuity'
      accountId: string
      record: AnnualAnnuityCashFlowRecord | null
      exclusionStateWrite: Readonly<{
        accountId: string
        value: AnnualAnnuityExclusionState
      }> | null
      contractDistribution: AnnualQualifiedAnnuityContractDistribution | null
    }>

export interface AnnualPensionAndAnnuityIncomeInput {
  readonly accounts: readonly Readonly<Account>[]
  readonly people: readonly Readonly<Person>[]
  /** Last duplicate person ID wins, matching simulatePlan's personById map. */
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  /** First duplicate person ID wins, matching simulatePlan's stateOf lookup. */
  readonly peopleStates: readonly Readonly<PersonYearState>[]
  readonly anyAlive: boolean
  readonly primaryPersonId: string
  readonly lifeAgeOf: (person: Readonly<Person>) => number
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly pack: Readonly<ParameterPack>
  readonly year: number
  readonly recordCashFlow: boolean
  readonly opening: Readonly<{
    annuityIncome: number
    pensionIncome: number
    ordinaryIncome: number
    privateRetirementOrdinary: number
    publicPensionOrdinary: number
  }>
  readonly annuityInvestmentInContract: ReadonlyMap<string, number>
  readonly annuityExclusionState: ReadonlyMap<
    string,
    Readonly<AnnualAnnuityExclusionState>
  >
  readonly annuityContractValue: ReadonlyMap<string, number>
  readonly annuityContractPoolOwner: ReadonlyMap<string, string>
}

export interface AnnualPensionAndAnnuityIncomeResult {
  readonly annuityIncome: number
  readonly pensionIncome: number
  readonly ordinaryIncome: number
  readonly privateRetirementOrdinary: number
  readonly publicPensionOrdinary: number
  readonly qualifiedAnnuityPayments: readonly QualifiedAnnuityPaymentActivity[]
  readonly rows: readonly AnnualPensionAndAnnuityIncomeRow[]
  /**
   * Characterized pension distributions for state tax adapters. Present whenever
   * any pension payment was recognized this year. Empty when none paid.
   * Authoritative for source identity when present; legacy private/public
   * aggregates remain for feature-off / uncharacterized plans.
   */
  readonly characterizedRetirementDistributions: readonly AnnualPensionDistributionCharacterization[]
  /** Flat leaf-shaped facts derived from `characterizedRetirementDistributions`. */
  readonly stateRetirementDistributionFacts: readonly StateRetirementDistributionFactInput[]
}

function dobYear(person: Readonly<Person>): number {
  return socialSecurityDobParts(person).y
}

type QualifiedAnnuityStateSource =
  | Readonly<{
      sourceKind: 'ira'
      accountTaxTreatment: 'traditional'
      qualifiedPlanType: 'ira'
    }>
  | Readonly<{
      sourceKind: 'employerPlan'
      accountTaxTreatment: 'traditional'
      qualifiedPlanType?: '401k' | '403b' | '457b'
    }>
  | Readonly<{ sourceKind: 'ordinaryPrivatePension' }>

/** Funding account type is the only plan-authored source identity for qualified annuities. */
function characterizeQualifiedAnnuityFunding(
  purchase: NonNullable<Extract<Account, { type: 'annuity' }>['purchase']>,
  accounts: readonly Readonly<Account>[],
): QualifiedAnnuityStateSource {
  const funding = accounts.find((account) => account.id === purchase.fundingAccountId)
  if (funding === undefined || funding.type !== 'traditional') {
    return { sourceKind: 'ordinaryPrivatePension' }
  }
  if (funding.kind === 'ira') {
    return {
      sourceKind: 'ira',
      accountTaxTreatment: 'traditional',
      qualifiedPlanType: 'ira',
    }
  }
  if (funding.kind === 'employer') {
    const qualifiedPlanType = funding.employerPlanType
    return {
      sourceKind: 'employerPlan',
      accountTaxTreatment: 'traditional',
      ...(qualifiedPlanType === '401k' ||
        qualifiedPlanType === '403b' ||
        qualifiedPlanType === '457b'
        ? { qualifiedPlanType }
        : {}),
    }
  }
  return { sourceKind: 'ordinaryPrivatePension' }
}

/** Pure with respect to every caller-owned input and map value. */
export function annualPensionAndAnnuityIncome(
  input: AnnualPensionAndAnnuityIncomeInput,
): AnnualPensionAndAnnuityIncomeResult {
  let annuityIncome = input.opening.annuityIncome
  let pensionIncome = input.opening.pensionIncome
  let ordinaryIncome = input.opening.ordinaryIncome
  let privateRetirementOrdinary = input.opening.privateRetirementOrdinary
  let publicPensionOrdinary = input.opening.publicPensionOrdinary
  const qualifiedAnnuityPayments: QualifiedAnnuityPaymentActivity[] = []
  const rows: AnnualPensionAndAnnuityIncomeRow[] = []
  const characterizedRetirementDistributions: AnnualPensionDistributionCharacterization[] = []
  const annuityStateFacts: StateRetirementDistributionFactInput[] = []
  if (!input.accounts.some(
    (account) => account.type === 'pension' || account.type === 'annuity',
  )) {
    return {
      annuityIncome,
      pensionIncome,
      ordinaryIncome,
      privateRetirementOrdinary,
      publicPensionOrdinary,
      qualifiedAnnuityPayments,
      rows,
      characterizedRetirementDistributions,
      stateRetirementDistributionFacts: [],
    }
  }
  // These private shadows preserve ordered duplicate-account consumption even
  // when cash-flow capture is off; caller-owned map values remain untouched.
  const exclusionState = new Map(
    [...input.annuityExclusionState].map(([accountId, state]) => [
      accountId,
      { ratio: state.ratio, remaining: state.remaining },
    ]),
  )
  const contractValues = new Map(input.annuityContractValue)
  const stateOf = (personId: string): Readonly<PersonYearState> =>
    input.peopleStates.find((state) => state.personId === personId)!

  for (const account of input.accounts) {
    if (account.type !== 'pension' && account.type !== 'annuity') continue
    // A commuted pension pays only until its election year; the election-year
    // offer is handled separately as a rollover.
    if (
      account.type === 'pension' &&
      account.lumpSumElection &&
      account.lumpSumOffer &&
      input.year >= account.lumpSumOffer.electionYear
    ) {
      continue
    }

    const ownerId = account.ownerPersonId ?? input.primaryPersonId
    const owner = input.personById.get(ownerId)!
    const ownerState = stateOf(ownerId)
    const startCalendarYear = dobYear(owner) + account.startAge
    if (input.year < startCalendarYear) continue
    // A purchase year is a separate gate from attained start age: no contract
    // can pay before its premium has been funded.
    if (
      account.type === 'annuity' &&
      account.purchase &&
      input.year < account.purchase.year
    ) {
      continue
    }

    const yearsSinceStart = input.year - startCalendarYear
    const grown = account.monthlyAmount * 12 *
      Math.pow(1 + account.colaPct / 100, yearsSinceStart)

    if (account.type === 'pension') {
      const survivor = input.peopleStates.find(
        (state) => state.personId !== ownerId && state.alive,
      )
      const ownerStartedBeforeDeath = input.lifeAgeOf(owner) >= account.startAge
      let amount = 0
      let payeePersonId: string | null = null
      if (ownerState.alive) {
        amount = grown
        payeePersonId = ownerId
      } else if (survivor && ownerStartedBeforeDeath) {
        amount = grown * (account.survivorPct / 100)
        payeePersonId = survivor.personId
      }
      if (payeePersonId === null) continue

      pensionIncome += amount
      ordinaryIncome += amount
      const source = account.source ?? 'private'
      if (isPublicPensionSourceKind(source)) publicPensionOrdinary += amount
      else privateRetirementOrdinary += amount
      const recipientAgeYears = input.peopleStates.find((state) => state.personId === payeePersonId)?.ageAttained ?? 0
      const payee = input.personById.get(payeePersonId)
      characterizedRetirementDistributions.push(
        characterizePensionDistribution({
          account,
          sourceOwnerPersonId: ownerId,
          payeePersonId,
          federallyIncludedAmount: amount,
          recipientAgeYears,
          taxYear: input.year,
          ...(payee !== undefined ? { payeeDateOfBirth: payee.dob } : {}),
        }),
      )
      rows.push({
        kind: 'pension',
        accountId: account.id,
        record: input.recordCashFlow
          ? {
              accountId: account.id,
              payeePersonId,
              amount,
              source,
            }
          : null,
      })
      continue
    }

    const otherState = input.peopleStates.find(
      (state) => state.personId !== ownerId,
    )
    const paidFraction = annuityPayoutFraction(annuityPayoutForm(account), {
      ownerAlive: ownerState.alive,
      otherAlive: otherState?.alive ?? false,
      anyAlive: input.anyAlive,
      yearsSinceStart,
    })
    if (paidFraction <= 0) continue

    const paid = grown * paidFraction
    annuityIncome += paid
    let annuityTaxable: number
    let nonqualifiedExcludable = 0
    let exclusionStateWrite: Extract<
      AnnualPensionAndAnnuityIncomeRow,
      { kind: 'annuity' }
    >['exclusionStateWrite'] = null
    let contractDistribution: AnnualQualifiedAnnuityContractDistribution | null = null

    if (account.purchase?.taxQualification === 'qualified') {
      const fundingOwnerPersonId = input.annuityContractPoolOwner.get(account.id)
      if (fundingOwnerPersonId !== undefined && paid > 0) {
        qualifiedAnnuityPayments.push({
          annuityAccountId: account.id,
          payment: paid,
          fundingOwnerPersonId,
        })
      }
      // IRC 408(d)(2)(B) and Pub. 590-B put the full payment on line 7 here;
      // the annual settlement later subtracts its aggregate Form 8606 basis.
      annuityTaxable = paid
      const contractValueBefore = contractValues.get(account.id)
      const poolOwnerPersonId = input.annuityContractPoolOwner.get(account.id)
      if (
        contractValueBefore !== undefined &&
        poolOwnerPersonId !== undefined &&
        paid > 0
      ) {
        const kind = 'annuityContractDistribution' as const
        const producerOccurrenceKey = input.runtimeOccurrenceKey(kind, account.id)
        // Line 7 keeps the whole payment while the line-6 contract channel can
        // debit only its remaining value and therefore floors at zero.
        const applied = Math.min(paid, contractValueBefore)
        const contractValueAfter = contractValueBefore - applied
        contractValues.set(account.id, contractValueAfter)
        contractDistribution = {
          annuityAccountId: account.id,
          poolOwnerPersonId,
          grossAmountPlanDollars: paid,
          contractValueAfter,
          occurrence: {
            producerOccurrenceKey,
            kind,
            grossAmountPlanDollars: paid,
            ownerPersonId: ownerId,
            sourceAccountId: account.id,
            executionDate: null,
            executionSequence: null,
            movementAuthorityId: null,
          },
          application: {
            applicationKind: 'debit',
            producerOccurrenceKey,
            simulatorPhase: 'annuityContractDistribution',
            ownerPersonId: ownerId,
            sourceAccountId: account.id,
            sourceBalanceBeforePlanDollars: contractValueBefore,
            appliedAmountPlanDollars: applied,
            sourceBalanceAfterPlanDollars: contractValueAfter,
          },
        }
      }
    } else if (account.purchase) {
      let state = exclusionState.get(account.id)
      if (state === undefined) {
        const investment = input.annuityInvestmentInContract.get(account.id) ?? 0
        const jointAnnuitant = input.people.find((person) => person.id !== ownerId)
        const expectedReturn = grown * annuityExclusionMultiple(
          input.pack,
          account,
          owner,
          jointAnnuitant,
        )
        state = {
          ratio: expectedReturn > 0
            ? Math.min(1, investment / expectedReturn)
            : 0,
          remaining: investment,
        }
      }
      const excludable = Math.min(paid * state.ratio, state.remaining)
      state = { ratio: state.ratio, remaining: state.remaining - excludable }
      exclusionState.set(account.id, state)
      exclusionStateWrite = { accountId: account.id, value: state }
      nonqualifiedExcludable = excludable
      annuityTaxable = paid - excludable
    } else {
      annuityTaxable = paid * (account.taxablePct / 100)
    }

    ordinaryIncome += annuityTaxable
    privateRetirementOrdinary += annuityTaxable
    const recipientPersonId = ownerState.alive
      ? ownerId
      : input.peopleStates.find(
          (state) => state.personId !== ownerId && state.alive,
        )?.personId
    const qualified = account.purchase?.taxQualification === 'qualified'
    const fundingCharacterization = qualified && account.purchase !== undefined
      ? characterizeQualifiedAnnuityFunding(account.purchase, input.accounts)
      : { sourceKind: 'ordinaryPrivatePension' as const }
    const qualifiedIraFunded = fundingCharacterization.sourceKind === 'ira'
    const qualifiedPlanType = 'qualifiedPlanType' in fundingCharacterization
      ? fundingCharacterization.qualifiedPlanType
      : undefined
    if (recipientPersonId !== undefined && paid > 0) {
      const recipient = input.personById.get(recipientPersonId)
      const minimumAgeAtDistributionYears = qualified && recipient !== undefined
        ? ageOnDate(recipient.dob, `${input.year}-01-01`)
        : undefined
      annuityStateFacts.push({
        accountId: account.id,
        sourceOwnerPersonId: ownerId,
        ownerPersonId: recipientPersonId,
        sourceKind: fundingCharacterization.sourceKind,
        ...(fundingCharacterization.sourceKind === 'ordinaryPrivatePension'
          ? {}
          : {
              accountTaxTreatment: fundingCharacterization.accountTaxTreatment,
            }),
        ...(qualifiedPlanType === undefined
          ? {}
          : { qualifiedPlanType }),
        grossDistribution: paid,
        federallyIncludedAmount: annuityTaxable,
        recipientAgeYears: input.peopleStates.find((state) => state.personId === recipientPersonId)?.ageAttained ?? 0,
        recipientAgeKnown: recipient !== undefined,
        cause: ownerState.alive ? 'ordinary' : 'death',
        earlyDistributionDisqualifier: inferEarlyDistributionDisqualifier({
          minimumAgeAtDistributionYears,
        }),
        ...(minimumAgeAtDistributionYears === undefined
          ? {}
          : { minimumAgeAtDistributionYears }),
      })
    }
    rows.push({
      kind: 'annuity',
      accountId: account.id,
      record: !input.recordCashFlow || recipientPersonId === undefined
        ? null
        : {
            accountId: account.id,
            recipientPersonId,
            paid,
            nonqualifiedExcludable,
            qualifiedIraFunded,
            fundingOwnerPersonId:
              input.annuityContractPoolOwner.get(account.id) ?? null,
          },
      exclusionStateWrite,
      contractDistribution,
    })
  }

  return {
    annuityIncome,
    pensionIncome,
    ordinaryIncome,
    privateRetirementOrdinary,
    publicPensionOrdinary,
    qualifiedAnnuityPayments,
    rows,
    characterizedRetirementDistributions,
    stateRetirementDistributionFacts: [...characterizedRetirementDistributions.map(
      (row) => row.fact,
    ), ...annuityStateFacts],
  }
}
