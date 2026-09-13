/**
 * Characterized pension source vocabulary for the Accounts editor.
 * Labels mirror `pensionSourceKindSchema` in the engine; unknown and legacy
 * choices stay explicit so a 1040 line or a coarse default never certifies identity.
 */

import type { PensionSourceKind, PensionStateEligibility } from '@retiregolden/engine/model/plan'

export const PENSION_SOURCE_OPTIONS: ReadonlyArray<{ value: PensionSourceKind; label: string }> = [
  { value: 'unknownPrivate', label: 'Unknown private / employer (not yet characterized)' },
  { value: 'unknownPublic', label: 'Unknown public / military (not yet characterized)' },
  { value: 'ordinaryPrivatePension', label: 'Private pension (ordinary)' },
  { value: 'employerPlan', label: 'Employer qualified plan (401k/403b/457)' },
  { value: 'ira', label: 'IRA distributions' },
  { value: 'militaryRetirement', label: 'Military retirement' },
  { value: 'militarySurvivor', label: 'Military survivor benefit' },
  { value: 'federalCivilService', label: 'Federal civil service' },
  { value: 'stateLocalPublic', label: 'State or local public retirement' },
  { value: 'railroadTier1', label: 'Railroad Tier I' },
  { value: 'railroadTier2', label: 'Railroad Tier II' },
  { value: 'railroadRetirementAct', label: 'Railroad Retirement Act (other)' },
  { value: 'governmentSurvivor', label: 'Government survivor benefit' },
  { value: 'private', label: 'Legacy: private (pre-characterization)' },
]

export function pensionSourceLabel(source: PensionSourceKind | undefined): string {
  if (source === undefined) return 'Unknown private / employer (not yet characterized)'
  if (source === 'public') return 'Legacy: public / military (unconfirmed)'
  return PENSION_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source
}

/** Sources that must not be treated as characterized retirement identity. */
export function isPensionSourceUnconfirmed(source: PensionSourceKind | undefined): boolean {
  return source === undefined || source === 'unknownPrivate' || source === 'unknownPublic' || source === 'public'
}

/** Legacy coarse buckets the engine still accepts without re-characterization. */
export function isPensionSourceLegacy(source: PensionSourceKind | undefined): boolean {
  return source === 'private' || source === 'public'
}

export function pensionSourceNeedsEligibilityDetails(source: PensionSourceKind | undefined): boolean {
  return !isPensionSourceUnconfirmed(source)
}

export const QUALIFIED_PLAN_TYPE_OPTIONS: ReadonlyArray<{
  value: NonNullable<PensionStateEligibility['qualifiedPlanType']>
  label: string
}> = [
  { value: 'unknown', label: 'Unknown' },
  { value: '401a', label: '401(a)' },
  { value: '401k', label: '401(k)' },
  { value: '403b', label: '403(b)' },
  { value: '457b', label: '457(b)' },
  { value: 'ira', label: 'IRA' },
  { value: 'other', label: 'Other qualified plan' },
]

export const EARLY_DISTRIBUTION_OPTIONS: ReadonlyArray<{
  value: NonNullable<PensionStateEligibility['earlyDistributionDisqualifier']>
  label: string
}> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'true', label: 'Yes — premature distribution penalty applies' },
  { value: 'false', label: 'No — not a premature distribution' },
]

export const CONTRIBUTORY_STATUS_OPTIONS: ReadonlyArray<{
  value: NonNullable<PensionStateEligibility['contributoryStatus']>
  label: string
}> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'contributory', label: 'Contributory' },
  { value: 'noncontributory', label: 'Noncontributory' },
]

export const DISTRIBUTION_REASON_OPTIONS: ReadonlyArray<{
  value: NonNullable<PensionStateEligibility['distributionReason']>
  label: string
}> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'ordinary', label: 'Ordinary retirement' },
  { value: 'disability', label: 'Disability' },
  { value: 'death', label: 'Death / survivor' },
  { value: 'earlyDistributionCode1', label: 'Early distribution (code 1)' },
]

/** Jurisdictions for recorded pension plan and prior-tax facts. */
export const PENSION_STATE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Unknown — not recorded' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]
