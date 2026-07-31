import { describe, expect, it } from 'vitest'

import {
  capitalLossCarryforwardHighlight,
  hasCapitalLossCarryforward,
} from './capitalLossCarryforwardVisibility'

const year = (
  yearNumber: number,
  remaining = 0,
  usedAgainstGains = 0,
  usedAgainstOrdinary = 0,
) => ({
  year: yearNumber,
  capitalLossCarryforwardRemaining: remaining,
  capitalLossUsedAgainstGains: usedAgainstGains,
  capitalLossUsedAgainstOrdinary: usedAgainstOrdinary,
})

describe('results and report carryforward visibility', () => {
  it('shows carryforward detail when the projection creates a loss from an opening zero balance', () => {
    expect(
      hasCapitalLossCarryforward(0, [year(2026, 7_000)]),
    ).toBe(true)
  })

  it('stays hidden when neither the opening plan nor any projected year has a carryforward', () => {
    expect(hasCapitalLossCarryforward(0, [year(2026)])).toBe(false)
  })

  it('stays hidden when an opening-zero loss is fully used in-year with nothing remaining', () => {
    const years = [year(2026, 0, 0, 2_500)]

    expect(hasCapitalLossCarryforward(0, years)).toBe(false)
    expect(capitalLossCarryforwardHighlight(0, years)).toBeUndefined()
  })

  it('keeps opening carryforwards visible even after the projection exhausts them', () => {
    expect(hasCapitalLossCarryforward(25_000, [year(2026)])).toBe(true)
  })

  it('highlights the later year where a projection first creates carryforward activity', () => {
    const years = [
      year(2026),
      year(2027),
      year(2028, 7_000, 0, 3_000),
      year(2029, 4_000, 0, 3_000),
    ]

    expect(capitalLossCarryforwardHighlight(0, years)).toBe(years[2])
  })

  it('falls back to the first year only for an opening carryforward with no modeled activity', () => {
    const years = [year(2026), year(2027)]

    expect(capitalLossCarryforwardHighlight(25_000, years)).toBe(years[0])
    expect(capitalLossCarryforwardHighlight(0, years)).toBeUndefined()
  })
})
