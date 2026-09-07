import { describe, expect, it } from 'vitest'

import {
  ordinarySimultaneousEarlyCurrentSpouseComponents,
  type OrdinarySimultaneousEarlyCurrentSpouseComponentsInput,
} from './currentSpouseBenefit.js'

/**
 * Guard/transport contracts for ordinarySimultaneousEarlyCurrentSpouseComponents.
 * These are not statutory oracles — the registered describeRule fixture in
 * simulate.social-security.test.ts owns the discriminating dollar vector.
 */
const base: OrdinarySimultaneousEarlyCurrentSpouseComponentsInput = {
  currentSpouseContext: true,
  bothAliveInPricedPeriod: true,
  spousalPayableMonths: 12,
  claimantDob: '1964-01-02',
  workerDob: '1964-01-02',
  claimantClaimAge: { years: 62, months: 0 },
  workerClaimAge: { years: 62, months: 0 },
  claimantSocialSecurityStreamCount: 1,
  workerSocialSecurityStreamCount: 1,
  claimantDisabilityDeclared: false,
  workerDisabilityDeclared: false,
  ownPiaMonthly: 800,
  ownActualMonthly: 560,
  workerPiaMonthly: 4_000,
  spousalFactor: 0.65,
}

type AcceptedRow = readonly [
  label: string,
  patch: Partial<OrdinarySimultaneousEarlyCurrentSpouseComponentsInput>,
  ownActualMonthly: number,
]

type RefusalRow = readonly [
  label: string,
  patch: Partial<OrdinarySimultaneousEarlyCurrentSpouseComponentsInput>,
]

const acceptedRows: AcceptedRow[] = [
  ['simultaneous early pair preserves supplied ownActualMonthly', {}, 560],
  [
    'credited own at early 62 preserves supplied ownActualMonthly',
    { ownActualMonthly: 800, spousalFactor: 1 },
    800,
  ],
]

const refusalRows: RefusalRow[] = [
  ['false current-spouse context', { currentSpouseContext: false }],
  ['deceased in priced period', { bothAliveInPricedPeriod: false }],
  ['zero payable months', { spousalPayableMonths: 0 }],
  ['thirteen payable months', { spousalPayableMonths: 13 }],
  ['fractional payable months', { spousalPayableMonths: 12.5 }],
  ['claimant disability declared', { claimantDisabilityDeclared: true }],
  ['worker disability declared', { workerDisabilityDeclared: true }],
  ['claimant multi-stream count', { claimantSocialSecurityStreamCount: 2 }],
  ['worker multi-stream count', { workerSocialSecurityStreamCount: 2 }],
  ['invalid claimant DOB', { claimantDob: 'not-a-date' }],
  ['invalid worker DOB', { workerDob: '1964-02-30' }],
  ['claim age below window', { claimantClaimAge: { years: 61, months: 0 } }],
  ['claim age above window', { claimantClaimAge: { years: 70, months: 1 } }],
  ['claim months out of range', { claimantClaimAge: { years: 62, months: 12 } }],
  ['leap-day DOB clamp mismatch', { claimantDob: '1964-02-29' }],
  ['month-end DOB clamp mismatch', { claimantDob: '1964-01-31', claimantClaimAge: { years: 62, months: 1 } }],
  ['claimant at FRA', { claimantClaimAge: { years: 67, months: 0 } }],
  ['claimant delayed past FRA', { claimantClaimAge: { years: 70, months: 0 }, workerClaimAge: { years: 70, months: 0 } }],
  ['later worker same calendar year', { workerDob: '1964-06-15' }],
  ['later worker claim date', { workerClaimAge: { years: 67, months: 0 } }],
  ['no positive unreduced excess', { ownPiaMonthly: 2_000 }],
  ['non-finite ownActualMonthly', { ownActualMonthly: Number.NaN }],
  ['non-positive worker PIA', { workerPiaMonthly: 0 }],
  ['spousal factor above one', { spousalFactor: 1.01 }],
]

function runGuard(
  patch: Partial<OrdinarySimultaneousEarlyCurrentSpouseComponentsInput>,
): ReturnType<typeof ordinarySimultaneousEarlyCurrentSpouseComponents> {
  return ordinarySimultaneousEarlyCurrentSpouseComponents({ ...base, ...patch })
}

describe('ordinarySimultaneousEarlyCurrentSpouseComponents guard contracts', () => {
  it.each(acceptedRows)('accepts %s', (_label, patch, ownActualMonthly) => {
    const result = runGuard({ ...patch, ownActualMonthly })
    expect(result).not.toBeNull()
    expect(result!.ownMonthly).toBe(ownActualMonthly)
  })

  it.each(refusalRows)('refuses %s', (_label, patch) => {
    expect(runGuard(patch)).toBeNull()
  })
})
