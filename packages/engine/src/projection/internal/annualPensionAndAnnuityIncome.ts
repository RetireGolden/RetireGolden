/**
 * Plan the annual pension and annuity income phase without mutating simulator
 * state. The coordinator preserves Plan account order, the legacy duplicate-
 * person lookup asymmetry, and every IEEE-754 fold performed by the former
 * inline block. The caller remains responsible for committing the returned
 * exclusion-state writes, contract-value debits, runtime journal rows and
 * cash-flow records at the phase's original orchestration point.
 */
import type { Account, Person } from '../../model/plan.js'
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
} from '../types.js'

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
  readonly source: 'private' | 'public'
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
      record: AnnualPensionCashFlowRecord
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
  readonly primaryPersonId: string
  readonly lifeAgeOf: (person: Readonly<Person>) => number
  readonly pack: Readonly<ParameterPack>
  readonly year: number
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
}

function dobYear(person: Readonly<Person>): number {
  return socialSecurityDobParts(person).y
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
      if (source === 'public') publicPensionOrdinary += amount
      else privateRetirementOrdinary += amount
      rows.push({
        kind: 'pension',
        record: {
          accountId: account.id,
          payeePersonId,
          amount,
          source,
        },
      })
      continue
    }

    const otherState = input.peopleStates.find(
      (state) => state.personId !== ownerId,
    )
    const paidFraction = annuityPayoutFraction(annuityPayoutForm(account), {
      ownerAlive: ownerState.alive,
      otherAlive: otherState?.alive ?? false,
      anyAlive: input.peopleStates.some((state) => state.alive),
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
      annuityTaxable = paid
      const contractValueBefore = contractValues.get(account.id)
      const poolOwnerPersonId = input.annuityContractPoolOwner.get(account.id)
      if (
        contractValueBefore !== undefined &&
        poolOwnerPersonId !== undefined &&
        paid > 0
      ) {
        const kind = 'annuityContractDistribution' as const
        const producerOccurrenceKey = JSON.stringify([kind, account.id])
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
    rows.push({
      kind: 'annuity',
      accountId: account.id,
      record: recipientPersonId === undefined
        ? null
        : {
            accountId: account.id,
            recipientPersonId,
            paid,
            nonqualifiedExcludable,
            qualifiedIraFunded:
              account.purchase?.taxQualification === 'qualified',
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
  }
}
