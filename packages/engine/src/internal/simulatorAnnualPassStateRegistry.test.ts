import { describe, expect, it } from 'vitest'

import {
  SIMULATOR_ANNUAL_PASS_STATE_REGISTRY,
  captureSimulatorAnnualPassStateKey,
  restoreSimulatorAnnualPassStateKey,
} from './simulatorAnnualPassStateRegistry.js'
import type { SimulatorAnnualPassStateBindings } from '../projection/annualPassTransaction.js'
import {
  applyHudModeledDraw,
  computeHudYearEndFromServicing,
} from '../projection/internal/hecmLineState.js'

const hecmEntry = SIMULATOR_ANNUAL_PASS_STATE_REGISTRY.hecmStates

function hudLineMap(modeledDebt = 10_000) {
  return new Map([
    [
      'home',
      {
        principalLimit: 500_000,
        loanBalance: 100_000 + modeledDebt,
        calculationMode: 'hudValidated' as const,
        observedServicingBaseline: 100_000,
        modeledDebt,
      },
    ],
  ])
}

function minimalBindings(
  hecmStates: SimulatorAnnualPassStateBindings['hecmStates'],
): Pick<SimulatorAnnualPassStateBindings, 'hecmStates'> {
  return { hecmStates }
}

describe('simulatorAnnualPassStateRegistry — HECM rollback clone', () => {
  it('captures HUD component fields and restores them after a probe mutates modeled debt', () => {
    const hecmStates = hudLineMap()
    const before = captureSimulatorAnnualPassStateKey(
      minimalBindings(hecmStates) as SimulatorAnnualPassStateBindings,
      'hecmStates',
    )

    const line = hecmStates.get('home')!
    applyHudModeledDraw(line, 5_000)
    expect(line.modeledDebt).toBe(15_000)

    restoreSimulatorAnnualPassStateKey(
      minimalBindings(hecmStates) as SimulatorAnnualPassStateBindings,
      'hecmStates',
      before,
    )
    expect(hecmStates.get('home')).toEqual({
      principalLimit: 500_000,
      loanBalance: 110_000,
      calculationMode: 'hudValidated',
      observedServicingBaseline: 100_000,
      modeledDebt: 10_000,
    })
  })

  it('capture/restore is idempotent for HUD split lines', () => {
    const hecmStates = hudLineMap()
    const bindings = minimalBindings(hecmStates) as SimulatorAnnualPassStateBindings
    const first = captureSimulatorAnnualPassStateKey(bindings, 'hecmStates')
    restoreSimulatorAnnualPassStateKey(bindings, 'hecmStates', first)
    const second = captureSimulatorAnnualPassStateKey(bindings, 'hecmStates')
    expect(second).toEqual(first)
  })

  it('preserves legacy lines with only principalLimit and loanBalance', () => {
    const hecmStates = new Map([
      ['home', { principalLimit: 200_000, loanBalance: 25_000 }],
    ])
    const captured = hecmEntry.capture(hecmStates)
    const line = hecmStates.get('home')!
    line.loanBalance = 99_999
    hecmEntry.restore(hecmStates, captured)
    expect(hecmStates.get('home')).toEqual({
      principalLimit: 200_000,
      loanBalance: 25_000,
    })
  })

  it('restores prior-year modeled debt so a complete ledger close still compounds it separately', () => {
    const hecmStates = hudLineMap(10_650)
    const bindings = minimalBindings(hecmStates) as SimulatorAnnualPassStateBindings
    const snapshot = captureSimulatorAnnualPassStateKey(bindings, 'hecmStates')

    const line = hecmStates.get('home')!
    line.observedServicingBaseline = 999
    line.modeledDebt = 0
    line.loanBalance = 999

    restoreSimulatorAnnualPassStateKey(bindings, 'hecmStates', snapshot)

    const restored = hecmStates.get('home')!
    const growth = 1.065
    const yearEnd = computeHudYearEndFromServicing(restored, growth, {
      status: 'complete',
      endingLoanBalance: 101_004.806,
      totalMipAccrued: 503.658574,
    })
    expect(yearEnd.observedServicingBaseline).toBeCloseTo(101_004.806, 3)
    expect(yearEnd.modeledDebt).toBeCloseTo(11_342.25, 2)
    expect(yearEnd.loanBalance).toBeCloseTo(112_347.056, 2)
  })
})
