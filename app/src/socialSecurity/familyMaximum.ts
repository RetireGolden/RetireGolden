/**
 * Retirement/survivor family maximum (MFB), using SSA's PIA-based formula.
 *
 * The worker's own benefit is never reduced by the family maximum; auxiliary
 * benefits payable on that worker's record share the remaining room. RetireGolden
 * currently models only the current-spouse auxiliary on a worker record (no child
 * dependents), so the capping helper applies that single auxiliary conservatively.
 *
 * @see https://www.ssa.gov/oact/cola/familymax.html
 */

import type { ClaimAge } from './claimFactor'
import { effectiveBirthYear } from './nra'
import { familyMaximumBendPointsForEligibilityYearOrLatest } from './ssaWageData'

function floorToDime(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10
}

/** Year of eligibility for the retirement/survivor family maximum. */
export function familyMaximumEligibilityYearFromDobParts(year: number, month: number, day: number): number {
  return effectiveBirthYear(year, month, day) + 62
}

/**
 * Monthly family maximum for a retirement/survivor worker record, before COLA
 * and trust-fund haircut.
 */
export function familyMaximumMonthlyFromPia(piaMonthly: number, eligibilityYear: number): number {
  if (piaMonthly <= 0) return 0
  const bp = familyMaximumBendPointsForEligibilityYearOrLatest(eligibilityYear)
  const first = Math.min(piaMonthly, bp.first)
  const second = Math.max(0, Math.min(piaMonthly, bp.second) - bp.first)
  const third = Math.max(0, Math.min(piaMonthly, bp.third) - bp.second)
  const above = Math.max(0, piaMonthly - bp.third)
  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34 + above * 1.75)
}

export interface AuxiliaryFamilyMaximumInput {
  /** Worker PIA on whose record the auxiliary is paid, today's dollars. */
  workerPiaMonthly: number
  /** Worker payable monthly benefit on that record, before COLA/haircut. */
  workerActualMonthly: number
  /** Worker date of birth, used to pick the eligibility-year bend points. */
  workerDob: { year: number; month: number; day: number }
  /** Proposed auxiliary benefit on the worker record, before COLA/haircut. */
  auxiliaryMonthly: number
}

/**
 * Cap a single auxiliary benefit to the available room under the worker's MFB.
 * With no child benefits modeled, this is the full current-spouse allocation.
 */
export function capAuxiliaryForFamilyMaximum(input: AuxiliaryFamilyMaximumInput): number {
  if (input.auxiliaryMonthly <= 0 || input.workerPiaMonthly <= 0) return 0
  const eligibilityYear = familyMaximumEligibilityYearFromDobParts(
    input.workerDob.year,
    input.workerDob.month,
    input.workerDob.day,
  )
  const familyMaximum = familyMaximumMonthlyFromPia(input.workerPiaMonthly, eligibilityYear)
  const roomForAuxiliaries = Math.max(0, familyMaximum - Math.max(0, input.workerActualMonthly))
  return Math.min(input.auxiliaryMonthly, roomForAuxiliaries)
}

export function claimAgeTotalMonths(claimAge: ClaimAge): number {
  return claimAge.years * 12 + claimAge.months
}
