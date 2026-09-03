/**
 * Drive the owned non-Roth IRA settlement attempts around one annual pass.
 *
 * The coordinator receives the transaction bindings, basis/rollback ledger,
 * immutable attempt facts, and a callback that executes one post-contribution
 * pass. It owns attempt ordering, rollback authorization, retry/fallback, and
 * optional replay attachment, then returns the settled YearResult and probe.
 * It does not execute earlier annual domains or publish either result channel;
 * simulatePlan retains those outer orchestration responsibilities.
 */
import type { Account, Person, Plan } from '../../model/plan.js'
import type { TraditionalAccount } from '../../strategies/accountEligibility.js'
import type { ActionId } from '../../actions/index.js'
import type { AnnualLiabilityRunTaxInput } from '../../actions/annualLiabilityRunIdentity.js'
import type { ConversionTaxFundingTaxUnitEvidence } from '../../actions/conversionTaxFundingEvidence.js'
import type { SimulatorAnnualPassStateBindings } from '../annualPassTransaction.js'
import type { OptimizerYearProbe, YearResult } from '../types.js'

import {
  isAggregatedIra,
  isConvertibleToRoth,
  isTreatAsOwnEffective,
  rothConversionSourceContextForPerson,
} from '../../strategies/accountEligibility.js'
import { ledgerCentsToPlanDollars } from '../../actions/index.js'
import {
  annualConversionLinkedWithdrawalFunding,
  type AnnualConversionLinkedWithdrawalFundingPassRequest,
} from './annualConversionLinkedWithdrawalFunding.js'
import {
  captureOwnedNonRothIraAnnualAttemptStateEvidence,
  ownedNonRothIraAnnualSettlementRollbackDisqualification,
  runOwnedNonRothIraAnnualSettlementAttempts,
  type OwnedNonRothIraAnnualSettlementEffect,
} from '../../internal/ownedNonRothIraAnnualAttemptSettlement.js'
import {
  committedOwnedNonRothIraAnnualReplayPublication,
} from '../../internal/ownedNonRothIraAnnualReplayPublication.js'
import {
  runCounterfactualAnnualLiability,
  type SimulateAnnualCounterfactualRequest,
} from '../../internal/counterfactualAnnualLiability.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'
import type { PhaseLedgerScalarBindings } from './phaseLedgerScalars.js'

type TreatAsOwnAccount = Parameters<typeof isTreatAsOwnEffective>[0]

export type AnnualPostContributionPassRunner = (
  assumedEffects: readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
  omittedRetirementActionIds?: ReadonlySet<ActionId>,
  annualLiabilityBaseline?: import('../../actions/index.js').ConversionLinkedWithdrawalGroupLiabilityRun | null,
  linkedGroupRelease?: import('./annualConversionLinkedWithdrawalFunding.js').AnnualConversionLinkedWithdrawalRelease,
  publishCashFlow?: boolean,
) => { yearResult: YearResult; optimizerProbe: OptimizerYearProbe | null }

export interface AnnualOwnedNonRothIraSettlementPhaseFacts {
  readonly year: number
  readonly plan: Readonly<Plan>
  readonly primary: Readonly<Person>
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly balances: readonly PhysicalBalanceState[]
  readonly startOfYearPositionalBalances: readonly number[]
  readonly annualLinkedGroupOmissionIds: readonly ActionId[]
  readonly conversionFundingTaxUnitEvidence: ConversionTaxFundingTaxUnitEvidence | null
  readonly annualLiabilityNonGroupTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
  readonly captureAnnualCashFlow: boolean
  readonly annualCounterfactual: Readonly<SimulateAnnualCounterfactualRequest> | undefined
}

export interface AnnualOwnedNonRothIraSettlementPhaseLedger {
  iraBasisByOwner: Map<string, number>
  ownedNonRothIraSettlementRolledBackOwners: Set<string>
  /**
   * The one scalar latch this phase sets, bound rather than copied back.
   *
   * The owner latch beside it is a `Set` the phase mutates in place; this one
   * is a boolean, and used to travel home through a hand-written assignment at
   * the call site that no type checked.
   */
  readonly scalars: PhaseLedgerScalarBindings<AnnualOwnedNonRothIraSettlementPhaseScalars>
}

/** The scalar simulator locals the owned-IRA settlement phase latches. */
export interface AnnualOwnedNonRothIraSettlementPhaseScalars {
  ownedNonRothIraSettlementRolledBackHousehold: boolean
}

export interface AnnualOwnedNonRothIraSettlementPhaseCallbacks {
  readonly isTreatAsOwnEffective: (
    account: Readonly<TreatAsOwnAccount>,
    taxYear: number,
  ) => boolean
  readonly ownedNonRothIraSettlementEnabled: () => boolean
  readonly ownedNonRothIraSettlementOwnerEnabled: (ownerId: string) => boolean
  readonly runPostContributionAnnualPass: AnnualPostContributionPassRunner
}

export interface AnnualOwnedNonRothIraSettlementPhaseInput {
  readonly facts: AnnualOwnedNonRothIraSettlementPhaseFacts
  readonly state: SimulatorAnnualPassStateBindings
  readonly ledger: AnnualOwnedNonRothIraSettlementPhaseLedger
  readonly callbacks: AnnualOwnedNonRothIraSettlementPhaseCallbacks
}

export interface AnnualOwnedNonRothIraSettlementPhaseResult {
  readonly yearResult: YearResult
  readonly optimizerProbe: OptimizerYearProbe | null
}

export function annualOwnedNonRothIraSettlementPhase(
  input: AnnualOwnedNonRothIraSettlementPhaseInput,
): AnnualOwnedNonRothIraSettlementPhaseResult {
  const { facts, state: annualPassState, ledger, callbacks } = input
  const {
    year,
    plan,
    primary,
    personById,
    balances,
    startOfYearPositionalBalances,
    annualLinkedGroupOmissionIds,
    conversionFundingTaxUnitEvidence,
    annualLiabilityNonGroupTaxInputs,
    captureAnnualCashFlow,
    annualCounterfactual,
  } = facts
  const {
    iraBasisByOwner,
    ownedNonRothIraSettlementRolledBackOwners,
  } = ledger
  const {
    isTreatAsOwnEffective,
    ownedNonRothIraSettlementEnabled,
    ownedNonRothIraSettlementOwnerEnabled,
    runPostContributionAnnualPass,
  } = callbacks

    /**
     * One funding decision per settlement attempt. The callback closes over the
     * attempt's Form-8606 assumption vector, so T0, provisional staging, and the
     * committed run all evaluate the same annual inputs. The coordinator owns
     * rollback, fail-closed authorization, and attempt ordering; the callback
     * retains the economic commits inside one annual pass.
     */
    const linkedGroupFundingForAttempt = (
      assumedEffects:
        readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
    ) => annualConversionLinkedWithdrawalFunding(Object.freeze({
      state: annualPassState,
      planId: plan.id,
      taxYear: year,
      taxUnitId: conversionFundingTaxUnitEvidence?.taxUnitId ?? null,
      omitActionIds: annualLinkedGroupOmissionIds,
      nonGroupTaxInputs: annualLiabilityNonGroupTaxInputs,
      runPass: (
        request: Readonly<AnnualConversionLinkedWithdrawalFundingPassRequest>,
      ) => runPostContributionAnnualPass(
        assumedEffects,
        request.omittedRetirementActionIds,
        request.annualLiabilityBaseline,
        request.release,
      ),
    }))

    // The counterfactual pre-pass, before anything commits this year.
    //
    // It has to precede the run that commits, not follow it: the pass writes the
    // year's mutable state directly, so the only run that can be discarded
    // wholesale is one that nothing downstream has read yet. The transaction
    // inside the helper is what makes discarding it safe, and it is
    // unconditional.
    //
    // The assumption vector here is empty — the same vector the fallback call
    // sites below use. This caller-supplied observation is deliberately outside
    // the settlement attempt driver, preserving the pre-extraction pre-pass.
    if (annualCounterfactual !== undefined) {
      const counterfactual = annualCounterfactual
      counterfactual.capture(runCounterfactualAnnualLiability({
        state: annualPassState,
        request: {
          planId: plan.id,
          taxUnitId: counterfactual.taxUnitId,
          taxYear: year,
          omitActionIds: counterfactual.omitActionIds,
          nonGroupTaxInputs: counterfactual.nonGroupTaxInputs,
        },
        runPass: (omittedRetirementActionIds) =>
          runPostContributionAnnualPass([], omittedRetirementActionIds),
      }))
    }

    const basisSeededOwners = new Set<string>()
    const settlementOpeningByAccount = new Map<Account, number>(
      balances.map((state, balanceIndex) => [
        state.account,
        startOfYearPositionalBalances[balanceIndex]!,
      ]),
    )
    // Seed nondeductible basis with the same year-aware aggregation the ledger
    // uses inside the pass (`isAggregatedIraThisYear`), so an S2-flipped
    // account is in the settlement pool the same way it is in the live
    // Form-8606 denominator. Inlined here because the helper is pass-scoped.
    const isAggregatedIraForSettlementYear = (
      account: Account,
    ): account is TraditionalAccount => {
      if (account.type !== 'traditional' || account.kind !== 'ira') return false
      if (account.inherited === undefined) return true
      if (!isTreatAsOwnEffective(account, year)) return false
      // §1.408-8(c)(3): same-year death flip — owner aggregation begins the
      // following year (mirrors pass-scoped `isAggregatedIraThisYear`).
      if (year === account.inherited.ownerDeathYear) return false
      return true
    }
    const annualSettlementPlan: Plan = {
      ...plan,
      accounts: plan.accounts.map((account): Account => {
        const openingBalance = settlementOpeningByAccount.get(account)
        const annualAccount = openingBalance === undefined
          ? account
          : { ...account, balance: openingBalance }
        if (!isAggregatedIraForSettlementYear(annualAccount)) return annualAccount
        const ownerPersonId = annualAccount.ownerPersonId ?? primary.id
        const nondeductibleBasis = basisSeededOwners.has(ownerPersonId)
          ? 0
          : iraBasisByOwner.get(ownerPersonId) ?? 0
        basisSeededOwners.add(ownerPersonId)
        return { ...annualAccount, nondeductibleBasis }
      }),
    }

    let settledAnnualPass: ReturnType<typeof runPostContributionAnnualPass>
    if (ownedNonRothIraSettlementEnabled()) {
      let finalAttempt:
        ReturnType<typeof runPostContributionAnnualPass> | null = null
      const settlement = runOwnedNonRothIraAnnualSettlementAttempts({
        state: annualPassState,
        plan: annualSettlementPlan,
        projectionStartTaxYear: year,
        initialAssumedEffects: [],
        runAttempt: (context) => {
          const permission = linkedGroupFundingForAttempt(
            context.assumedEffects,
          )
          const attempt = runPostContributionAnnualPass(
            context.assumedEffects,
            undefined,
            permission.baseline,
            permission.release,
            captureAnnualCashFlow,
          )
          finalAttempt = attempt
          return [attempt.yearResult]
        },
        captureAttemptStateEvidence: (context, yearResult) =>
          captureOwnedNonRothIraAnnualAttemptStateEvidence({
            state: annualPassState,
            planId: context.stable.planId,
            taxYear: yearResult.year,
            attemptNumber: context.attemptNumber,
          }),
      })
      if (settlement.status === 'committed' && finalAttempt !== null) {
        settledAnnualPass = finalAttempt
        if (settledAnnualPass.optimizerProbe !== null) {
          const annualReplay = settlement.pendingSettlement.replay
            .annualReplays[0]!
          const taxableFractionByOwner = new Map<string, number>(
            annualReplay.ownerReplays.map((owner) => {
              const ratio = owner.annualBasisRatio
              const nontaxableFraction =
                ratio.representation === 'exactMinorUnitRational'
                  ? ratio.numeratorMinorUnits / ratio.denominatorMinorUnits
                  : 0
              return [
                owner.ownerPersonId,
                Math.min(1, Math.max(0, 1 - nontaxableFraction)),
              ] as const
            }),
          )
          const optimizerEvidenceAccountById = new Map(
            plan.accounts.map((account) => [account.id, account] as const),
          )
          const weightedTaxableFraction = (
            eligible: (account: Account) => boolean,
          ): number | null => {
            let gross = 0
            let taxable = 0
            for (const account of optimizerEvidenceAccountById.values()) {
              if (!eligible(account)) continue
              const balance = Math.max(
                0,
                settledAnnualPass.yearResult.balances[account.id] ?? 0,
              )
              if (balance <= 0) continue
              const fraction = isAggregatedIra(account)
                ? taxableFractionByOwner.get(
                  account.ownerPersonId ?? primary.id,
                ) ?? 1
                : 1
              gross += balance
              taxable += balance * fraction
            }
            return gross > 0 ? taxable / gross : null
          }
          const traditionalFraction = weightedTaxableFraction((account) =>
            account.type === 'traditional' && !account.inherited)
          const conversionFraction = weightedTaxableFraction((account) =>
            isConvertibleToRoth(
              account,
              rothConversionSourceContextForPerson(
                personById.get(account.ownerPersonId ?? primary.id),
                year,
              ),
            ),
          )
          settledAnnualPass = {
            ...settledAnnualPass,
            optimizerProbe: {
              ...settledAnnualPass.optimizerProbe,
              traditionalWithdrawalTaxableFraction:
                settledAnnualPass.optimizerProbe
                  .incumbentTraditionalDistribution > 0
                  ? settledAnnualPass.optimizerProbe
                    .traditionalWithdrawalTaxableFraction
                  : traditionalFraction ?? settledAnnualPass.optimizerProbe
                    .traditionalWithdrawalTaxableFraction,
              rothConversionTaxableFraction:
                settledAnnualPass.optimizerProbe.incumbentRothConversion > 0
                  ? settledAnnualPass.optimizerProbe
                    .rothConversionTaxableFraction
                  : conversionFraction ?? settledAnnualPass.optimizerProbe
                    .rothConversionTaxableFraction,
            },
          }
        }
        for (const carryforward of settlement.committedCarryforwards) {
          // A disqualified owner keeps the legacy figure this year's pass
          // already committed. Re-seeding them from a replay that opened on
          // their stale basis would republish the very numerator the earlier
          // rollback disqualified.
          if (!ownedNonRothIraSettlementOwnerEnabled(
            carryforward.ownerPersonId,
          )) continue
          const openingBasis = ledgerCentsToPlanDollars(
            carryforward.openingBasisAmount,
          )
          if (openingBasis > 0) {
            iraBasisByOwner.set(carryforward.ownerPersonId, openingBasis)
          } else {
            iraBasisByOwner.delete(carryforward.ownerPersonId)
          }
        }
        // The publication is one joined household replay, and the module
        // refuses to emit a partial one. When a disqualified owner appears in
        // it the whole publication is withheld: an unaffected owner keeps the
        // settled economics that drive their conversions, but nothing states a
        // disqualified owner's basis as settled.
        const publishableOwners = settlement.pendingSettlement.replay
          .annualReplays.every((annual) => annual.ownerReplays.every((owner) =>
            ownedNonRothIraSettlementOwnerEnabled(owner.ownerPersonId)))
        const publication = publishableOwners
          ? committedOwnedNonRothIraAnnualReplayPublication(
            settlement,
            settledAnnualPass.yearResult,
          )
          : null
        if (publication !== null) {
          settledAnnualPass = {
            ...settledAnnualPass,
            yearResult: {
              ...settledAnnualPass.yearResult,
              ownedNonRothIraAnnualReplay: publication,
            },
          }
        }
      } else {
        const disqualification =
          ownedNonRothIraAnnualSettlementRollbackDisqualification(
            settlement,
            new Set(iraBasisByOwner.keys()),
          )
        // A year-scoped disqualification writes no latch at all. The year it
        // names is already falling back below -- that IS the disqualification --
        // and leaving both latches untouched is what lets the next year attempt
        // settlement again. The withheld-publication window is one year wide
        // rather than the rest of the horizon.
        if (disqualification.horizon === 'remainingProjection') {
          if (disqualification.ownerPersonId === null) {
            ledger.scalars.ownedNonRothIraSettlementRolledBackHousehold.write(true)
          } else {
            ownedNonRothIraSettlementRolledBackOwners.add(
              disqualification.ownerPersonId,
            )
          }
        }
        const permission = linkedGroupFundingForAttempt([])
        settledAnnualPass = runPostContributionAnnualPass(
          [],
          undefined,
          permission.baseline,
          permission.release,
          captureAnnualCashFlow,
        )
      }
    } else {
      const permission = linkedGroupFundingForAttempt([])
      settledAnnualPass = runPostContributionAnnualPass(
        [],
        undefined,
        permission.baseline,
        permission.release,
        captureAnnualCashFlow,
      )
    }

  return settledAnnualPass
}
