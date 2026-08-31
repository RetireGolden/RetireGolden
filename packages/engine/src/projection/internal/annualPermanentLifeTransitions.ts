/**
 * Pure permanent-life state transition for one annual projection pass.
 *
 * The caller owns the live cash-value map, deposits, and cash-flow publication.
 * This helper only computes the ordered writes and the death-benefit fold. Its
 * private shadow is load-bearing: duplicate policy ids are accepted by the
 * plan schema, so a later policy row must observe an earlier row's write.
 */
import type { InsurancePolicy } from '../../model/plan.js'

export interface PermanentLifeInsuredState {
  readonly ageAttained: number
  readonly deathAge: number
}

export interface AnnualPermanentLifeTransitionsInput {
  /** `plan.insurance`; iteration order is also the death-benefit fold order. */
  readonly policies: readonly Readonly<InsurancePolicy>[]
  /** Cash values at entry to this annual pass. */
  readonly insuranceCashValues: ReadonlyMap<string, number>
  /**
   * Resolves the insured's state for this pass. A missing insured returns null;
   * it retains the inlined phase's `-Infinity < Infinity` alive behavior.
   */
  readonly resolveInsured: (personId: string) => Readonly<PermanentLifeInsuredState> | null
}

export interface AnnualPermanentLifeTransition {
  readonly policyId: string
  readonly insuredPersonId: string
  /** Cash value to write after this row, in row order. */
  readonly cashValue: number
  /**
   * Settlement amount to deposit, including zero. Null means this row does not
   * settle; callers must not collapse the distinction between zero and null.
   */
  readonly payout: number | null
}

export interface AnnualPermanentLifeTransitionsResult {
  readonly transitions: readonly AnnualPermanentLifeTransition[]
  /** Exact left-to-right `+=` fold of settlement payouts. */
  readonly deathBenefitPaid: number
}

/** Linear interpolation with endpoint clamping, lifted verbatim from simulate. */
function interpolateByAge(
  schedule: readonly Readonly<{ age: number; value: number }>[],
  age: number,
): number {
  if (schedule.length === 0) return 0
  const sorted = [...schedule].sort((a, b) => a.age - b.age)
  if (age <= sorted[0]!.age) return sorted[0]!.value
  if (age >= sorted[sorted.length - 1]!.age) return sorted[sorted.length - 1]!.value
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!
    const hi = sorted[i + 1]!
    if (age >= lo.age && age <= hi.age) {
      const t = (age - lo.age) / (hi.age - lo.age)
      return lo.value + t * (hi.value - lo.value)
    }
  }
  return sorted[sorted.length - 1]!.value
}

export function annualPermanentLifeTransitions(
  input: AnnualPermanentLifeTransitionsInput,
): AnnualPermanentLifeTransitionsResult {
  const transitions: AnnualPermanentLifeTransition[] = []
  const shadowCashValues = new Map<string, number>()
  const cashValueFor = (policyId: string): number =>
    shadowCashValues.has(policyId)
      ? shadowCashValues.get(policyId)!
      : (input.insuranceCashValues.get(policyId) ?? 0)
  let deathBenefitPaid = 0

  for (const policy of input.policies) {
    if (policy.kind !== 'permanentLife') continue

    const insured = input.resolveInsured(policy.insured)
    const deathAge = insured?.deathAge ?? Infinity
    const ageAttained = insured?.ageAttained ?? -Infinity
    let cashValue: number
    let payout: number | null = null

    if (ageAttained < deathAge) {
      if (policy.cashValueMode === 'schedule' && policy.cashValueSchedule) {
        cashValue = interpolateByAge(policy.cashValueSchedule, ageAttained)
      } else {
        const previousCashValue = cashValueFor(policy.id)
        cashValue = previousCashValue * (1 + (policy.cashValueGrowthPct ?? 0) / 100)
      }
    } else if (ageAttained === deathAge) {
      payout = Math.max(policy.deathBenefit, cashValueFor(policy.id))
      deathBenefitPaid += payout
      cashValue = 0
    } else {
      cashValue = 0
    }

    shadowCashValues.set(policy.id, cashValue)
    transitions.push({
      policyId: policy.id,
      insuredPersonId: policy.insured,
      cashValue,
      payout,
    })
  }

  return { transitions, deathBenefitPaid }
}
