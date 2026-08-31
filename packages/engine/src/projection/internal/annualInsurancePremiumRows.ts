/**
 * Pure annual insurance-premium selection.
 *
 * Rows retain `plan.insurance` order because the caller folds premiums with
 * ordered IEEE-754 additions and publishes each policy occurrence separately.
 * Policy ids are not used as keys: duplicate ids must not collapse a row.
 */
import type { InsurancePolicy } from '../../model/plan.js'
import type { RecordedPolicyPremium } from '../annualCashFlowYearSites.js'

export interface InsurancePremiumSubjectState {
  readonly alive: boolean
  readonly ageAttained: number
}

export interface AnnualInsurancePremiumRowsInput {
  /** `plan.insurance`; iteration order is load-bearing. */
  readonly policies: readonly Readonly<InsurancePolicy>[]
  /** Resolves the LTC owner or permanent-life insured for this annual pass. */
  readonly resolveSubject: (
    personId: string,
  ) => Readonly<InsurancePremiumSubjectState>
}

export interface AnnualInsurancePremiumRow {
  readonly amount: number
  /** Passed through to the recorder without rebuilding. */
  readonly record: RecordedPolicyPremium
}

export function annualInsurancePremiumRows(
  input: AnnualInsurancePremiumRowsInput,
): AnnualInsurancePremiumRow[] {
  const rows: AnnualInsurancePremiumRow[] = []

  for (const policy of input.policies) {
    if (policy.premiumMode === 'paidUp') continue

    const subjectPersonId = policy.kind === 'ltc' ? policy.owner : policy.insured
    const subject = input.resolveSubject(subjectPersonId)
    if (!subject.alive) continue
    if (
      policy.premiumMode === 'untilAge' &&
      policy.premiumEndAge !== undefined &&
      subject.ageAttained >= policy.premiumEndAge
    ) {
      continue
    }

    rows.push({
      amount: policy.annualPremium,
      record: {
        policyId: policy.id,
        subjectPersonId,
        amount: policy.annualPremium,
      },
    })
  }

  return rows
}
