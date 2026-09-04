/**
 * Close the year's non-portfolio holdings: property events and growth, then the
 * permanent-life cash-value and death-benefit transitions.
 *
 * **Why these two together.** They are adjacent in the year for a reason — both
 * are pure application loops over a sibling phase's rows, both deposit into the
 * same annual cash channel, and both write a live map the year publishes from.
 * Grouping them lets `inflRateAt` stop being a phase-wide callback: it has
 * exactly one caller in the whole funding phase, the property row producer, and
 * it now lives in this sub-phase's own input instead.
 *
 * **What it owns and what it does not.** `propertyEventsAndGrowth` owns the
 * growth, the legacy tax-free sale and the HECM line accrual;
 * `annualPermanentLifeTransitions` owns the cash-value and payout rules. This
 * block owns every write, applied per row in the same statement order the
 * inlined phase used — close the line, deposit, publish, write the value back,
 * then compound what is left open. `plan.accounts` order is load-bearing three
 * ways at once: deposit order, value compounding, and whether a same-id line
 * accrues before a later row closes it.
 *
 * Move-only out of `annualFundingApplicationAndClosePhase`: every expression,
 * the statement order inside both loops, and the deliberate gating of the
 * legacy-sale payload are unchanged.
 */
import type { Account, Person } from '../../model/plan.js'
import type {
  PersonYearState,
  YearCashFlowTransferEndpoint,
} from '../types.js'
import { annualPermanentLifeTransitions } from './annualPermanentLifeTransitions.js'
import { propertyEventsAndGrowth } from './propertyEventsAndGrowth.js'

type HecmLineState = { loanBalance: number; principalLimit: number }

export interface AnnualPropertyAndInsuranceClosePhaseInput {
  readonly year: number
  readonly accounts: readonly Account[]
  readonly policies: Parameters<
    typeof annualPermanentLifeTransitions
  >[0]['policies']
  /** Live; the property loop writes every value back. */
  readonly propertyValues: Map<string, number>
  /** Live; a closing row deletes its line and an open one compounds. */
  readonly hecmStates: Map<string, HecmLineState>
  /** Live; each transition writes its policy's cash value back. */
  readonly insuranceCashValues: Map<string, number>
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly lifeAgeOf: (person: Readonly<Person>) => number
  /**
   * Property inflation. Its only caller in the whole funding phase is the
   * property row producer below, which is why it belongs to this group.
   */
  readonly inflRateAt: (year: number) => number
  readonly deposit: (amount: number) => void
  /** Capture channels; null when the projection captures no cash flow. */
  readonly legacyPropertySaleDeposits: {
    propertyAccountId: string
    amount: number
    destination: YearCashFlowTransferEndpoint
  }[] | null
  readonly deathBenefits: {
    policyId: string
    insuredPersonId: string
    amount: number
    destination: YearCashFlowTransferEndpoint
  }[] | null
  readonly surplusDestination: YearCashFlowTransferEndpoint | null
}

export interface AnnualPropertyAndInsuranceClosePhaseResult {
  readonly deathBenefitPaid: number
}

export function annualPropertyAndInsuranceClosePhase(
  input: AnnualPropertyAndInsuranceClosePhaseInput,
): AnnualPropertyAndInsuranceClosePhaseResult {
  const {
    year,
    propertyValues,
    hecmStates,
    insuranceCashValues,
    personById,
    stateOf,
    lifeAgeOf,
    deposit,
    legacyPropertySaleDeposits,
    deathBenefits,
    surplusDestination,
  } = input

  // --- property events + growth ------------------------------------------
  // The phase itself lives in `internal/propertyEventsAndGrowth.ts`. It owns
  // the growth, the legacy tax-free sale and the line accrual; this loop owns
  // every write, applied per row in the same statement order the inlined
  // phase used (close the line, deposit, publish, write the value back, then
  // compound what is left open). `plan.accounts` order is load-bearing three
  // ways at once — deposit order, value compounding, and whether a same-id
  // line accrues before a later row closes it. The helper carries a private
  // numeric shadow of both maps, plus an accrued-id set so each actual HECM
  // line receives its annual multiplier exactly once.
  for (const row of propertyEventsAndGrowth({
    accounts: input.accounts,
    year,
    propertyValues,
    inflRateAt: input.inflRateAt,
    hecmStates,
    // Gated on the ARRAY this payload feeds, which is what the inlined phase
    // gated on: it built its literal inside `legacyPropertySaleDeposits?.push(
    // { … })`. Both are assigned in the same `if (publishCashFlow)` block, so
    // this is a no-op today; writing it this way makes the payload's laziness
    // hold by construction rather than by that coincidence.
    surplusDestination: legacyPropertySaleDeposits === null ? null : surplusDestination,
  })) {
    if (row.closesHecmForAccountId !== null) hecmStates.delete(row.closesHecmForAccountId)
    if (row.deposit !== null) deposit(row.deposit)
    if (row.record !== null) legacyPropertySaleDeposits?.push(row.record)
    propertyValues.set(row.propertyAccountId, row.value)
    if (row.hecmGrowth !== null) {
      const line = hecmStates.get(row.propertyAccountId)!
      line.principalLimit *= row.hecmGrowth
      line.loanBalance *= row.hecmGrowth
    }
  }

  // --- insurance: permanent-life cash value + death benefit --------------
  const permanentLife = annualPermanentLifeTransitions({
    policies: input.policies,
    insuranceCashValues,
    resolveInsured: (personId) => {
      const insured = personById.get(personId)
      return insured === undefined
        ? null
        : {
            deathAge: lifeAgeOf(insured),
            ageAttained: stateOf(personId).ageAttained,
          }
    },
  })
  const deathBenefitPaid = permanentLife.deathBenefitPaid
  for (const transition of permanentLife.transitions) {
    if (transition.payout !== null) {
      deposit(transition.payout)
      if (transition.payout > 0) {
        deathBenefits?.push({
          policyId: transition.policyId,
          insuredPersonId: transition.insuredPersonId,
          amount: transition.payout,
          destination: surplusDestination!,
        })
      }
    }
    insuranceCashValues.set(transition.policyId, transition.cashValue)
  }

  return { deathBenefitPaid }
}
