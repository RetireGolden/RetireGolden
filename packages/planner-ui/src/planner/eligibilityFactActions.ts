import {
  clearRetirementActionAnnualTaxFactsForOwners,
  type Account,
  type Plan,
} from '@retiregolden/engine/model/plan'

const CIVIL_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Return the calendar year containing this DOB's age-70½ date. Kept local so
 * the published planner remains compatible with its declared registry-engine
 * range, which predates the engine's public civil-date helpers. Exported so the
 * eligibility-facts editor lists exactly the years a DOB edit would keep. */
export function age70HalfThresholdYear(value: string): number | null {
  const match = CIVIL_ISO_DATE.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null
  }
  const thresholdYear = year + (month <= 6 ? 70 : 71)
  return thresholdYear <= 9999 ? thresholdYear : null
}

/** Remove durable facts whose source account no longer exists or is no longer
 * an owned, non-inherited traditional IRA. */
export function clearAccountEligibilityFacts(plan: Plan, accountId: string): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.iraClassifications = facts.iraClassifications.filter(
    (classification) => classification.sourceAccountId !== accountId,
  )
  facts.sepSimpleActivities = facts.sepSimpleActivities.filter(
    (activity) => activity.sourceAccountId !== accountId,
  )
}

interface OwnedIraPoolBinding {
  accountId: string
  ownerPersonId: string
}

function ownedIraPoolBinding(account: Account | undefined): OwnedIraPoolBinding | null {
  return account?.type === 'traditional' &&
    account.kind === 'ira' &&
    account.inherited === undefined &&
    account.ownerPersonId !== null
    ? { accountId: account.id, ownerPersonId: account.ownerPersonId }
    : null
}

function sameOwnedIraPoolBinding(
  left: OwnedIraPoolBinding | null,
  right: OwnedIraPoolBinding | null,
): boolean {
  return left?.accountId === right?.accountId &&
    left?.ownerPersonId === right?.ownerPersonId
}

/** Remove the exact rendered row, then clear facts bound to that account. The
 * index matters for malformed imports that contain duplicate account IDs. */
export function removeAccount(plan: Plan, accountIndex: number): void {
  const account = plan.accounts[accountIndex]
  if (account === undefined) return
  const affectedOwner = ownedIraPoolBinding(account)?.ownerPersonId ?? null
  plan.accounts.splice(accountIndex, 1)
  clearAccountEligibilityFacts(plan, account.id)
  if (affectedOwner !== null) {
    clearRetirementActionAnnualTaxFactsForOwners(plan, [affectedOwner])
  }
}

/** Apply an account edit and fail closed by dropping facts the new account
 * shape can no longer support. */
export function updateAccountField(
  plan: Plan,
  accountIndex: number,
  key: string,
  value: unknown,
): void {
  const account = plan.accounts[accountIndex]
  if (account === undefined) return
  const beforePoolBinding = ownedIraPoolBinding(account)
  ;(account as unknown as Record<string, unknown>)[key] = value
  const updated = plan.accounts[accountIndex]
  const afterPoolBinding = ownedIraPoolBinding(updated)
  if (!sameOwnedIraPoolBinding(beforePoolBinding, afterPoolBinding)) {
    clearRetirementActionAnnualTaxFactsForOwners(
      plan,
      [
        beforePoolBinding?.ownerPersonId,
        afterPoolBinding?.ownerPersonId,
      ].filter((owner): owner is string => owner !== undefined),
    )
  }
  if (
    updated !== undefined &&
    (updated.type !== 'traditional' ||
      updated.kind !== 'ira' ||
      updated.inherited !== undefined)
  ) {
    Reflect.deleteProperty(updated, 'nondeductibleBasis')
  }
  if (
    updated === undefined ||
    updated.type !== 'traditional' ||
    updated.kind !== 'ira' ||
    updated.ownerPersonId === null ||
    updated.inherited !== undefined
  ) {
    clearAccountEligibilityFacts(plan, account.id)
  }
}

/** Remove evidence bound to a person who no longer exists. */
export function clearDonorEligibilityFacts(plan: Plan, donorPersonId: string): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.deductibleIraContributions = facts.deductibleIraContributions.filter(
    (contribution) => contribution.donorPersonId !== donorPersonId,
  )
}

/** Apply a DOB correction and remove only contribution evidence that the new
 * age-70½ threshold makes impossible. */
export function updatePersonDob(
  plan: Plan,
  personIndex: number,
  dob: string,
): void {
  const person = plan.household.people[personIndex]
  if (person === undefined) return
  person.dob = dob
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  const thresholdYear = age70HalfThresholdYear(dob)
  if (thresholdYear === null) return
  facts.deductibleIraContributions = facts.deductibleIraContributions.filter(
    (contribution) =>
      contribution.donorPersonId !== person.id ||
      contribution.taxYear >= thresholdYear,
  )
}
