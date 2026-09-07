import { addCalendarMonths, parseCivilIsoDate, type CivilDate } from '../actions/civilDate.js'
import type { ClaimAge } from './claimFactor.js'
import { ageToTotalMonths, effectiveBirthYear, fraForBirthYear, fraTotalMonths } from './nra.js'

export interface OrdinarySimultaneousEarlyCurrentSpouseComponentsInput {
  readonly currentSpouseContext: boolean
  readonly bothAliveInPricedPeriod: boolean
  readonly spousalPayableMonths: number
  readonly claimantDob: string
  readonly workerDob: string
  readonly claimantClaimAge: Readonly<ClaimAge>
  readonly workerClaimAge: Readonly<ClaimAge>
  readonly claimantSocialSecurityStreamCount: number
  readonly workerSocialSecurityStreamCount: number
  readonly claimantDisabilityDeclared: boolean
  readonly workerDisabilityDeclared: boolean
  readonly ownPiaMonthly: number
  readonly ownActualMonthly: number
  readonly workerPiaMonthly: number
  readonly spousalFactor: number
}

export interface OrdinarySimultaneousEarlyCurrentSpouseComponents {
  readonly ownMonthly: number
  readonly auxiliaryMonthly: number
}

interface StrictConfiguredClaimDate {
  readonly iso: string
  readonly birth: CivilDate
  readonly claimAgeMonths: number
}

function strictConfiguredClaimDate(
  dob: string,
  claimAge: Readonly<ClaimAge>,
): StrictConfiguredClaimDate | null {
  const birth = parseCivilIsoDate(dob)
  if (birth === null) return null
  if (
    !Number.isSafeInteger(claimAge.years) ||
    !Number.isSafeInteger(claimAge.months) ||
    claimAge.months < 0 ||
    claimAge.months > 11
  ) {
    return null
  }
  const claimAgeMonths = ageToTotalMonths(claimAge.years, claimAge.months)
  if (claimAgeMonths < 62 * 12 || claimAgeMonths > 70 * 12) return null
  const iso = addCalendarMonths(dob, claimAgeMonths)
  if (iso === null) return null
  const configured = parseCivilIsoDate(iso)
  if (configured === null || configured.day !== birth.day) return null
  return { iso, birth, claimAgeMonths }
}

/**
 * Component arithmetic for the narrow product proxy registered at
 * usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement.
 *
 * `null` means the caller must preserve its existing legacy path. Configured
 * dates are guard facts only; this helper does not determine SSA eligibility,
 * application, insured status, or a legal month of entitlement.
 */
export function ordinarySimultaneousEarlyCurrentSpouseComponents(
  input: Readonly<OrdinarySimultaneousEarlyCurrentSpouseComponentsInput>,
): OrdinarySimultaneousEarlyCurrentSpouseComponents | null {
  if (!input.currentSpouseContext || !input.bothAliveInPricedPeriod) return null
  if (
    input.claimantSocialSecurityStreamCount !== 1 ||
    input.workerSocialSecurityStreamCount !== 1
  ) {
    return null
  }
  if (input.claimantDisabilityDeclared || input.workerDisabilityDeclared) return null
  if (
    !Number.isSafeInteger(input.spousalPayableMonths) ||
    input.spousalPayableMonths <= 0 ||
    input.spousalPayableMonths > 12
  ) {
    return null
  }

  const claimantDate = strictConfiguredClaimDate(input.claimantDob, input.claimantClaimAge)
  const workerDate = strictConfiguredClaimDate(input.workerDob, input.workerClaimAge)
  if (claimantDate === null || workerDate === null) return null
  const claimantFraMonths = fraTotalMonths(
    fraForBirthYear(
      effectiveBirthYear(
        claimantDate.birth.year,
        claimantDate.birth.month,
        claimantDate.birth.day,
      ),
    ),
  )
  // Branch selection is permanently tied to original Plan claim age. It must
  // never use attained age, an ARF-credited age, or the current benefit factor.
  if (claimantDate.claimAgeMonths >= claimantFraMonths) return null
  if (workerDate.iso > claimantDate.iso) return null

  const amounts = [
    input.ownPiaMonthly,
    input.ownActualMonthly,
    input.workerPiaMonthly,
    input.spousalFactor,
  ]
  if (amounts.some((amount) => !Number.isFinite(amount))) return null
  if (
    input.ownPiaMonthly < 0 ||
    input.ownActualMonthly < 0 ||
    input.workerPiaMonthly <= 0 ||
    input.spousalFactor <= 0 ||
    input.spousalFactor > 1
  ) {
    return null
  }

  const unreducedExcess = 0.5 * input.workerPiaMonthly - input.ownPiaMonthly
  if (!(unreducedExcess > 0)) return null
  return {
    ownMonthly: input.ownActualMonthly,
    auxiliaryMonthly: unreducedExcess * input.spousalFactor,
  }
}
