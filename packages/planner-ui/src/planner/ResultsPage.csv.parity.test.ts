/**
 * B2-P1 slice 1 parity: the Results "Download CSV" ledger's
 * `lossCarryforwardUsed` column is the engine's
 * `capitalLossCarryforwardUsed(row)` (family
 * display-loss-carryforward-used-annual), rounded to the dollar the way the
 * CSV rounds every number. The two examples carry a $12,000 carryforward that
 * 2026 uses up against gains, so the column is not all zeros; the constructed
 * household uses its carryforward against ordinary income only, so a column
 * that read only the part used against gains would print 0 there.
 */
import { describe, expect, it } from 'vitest'

import { capitalLossCarryforwardUsed } from '@retiregolden/engine/projection/yearFigures'
import {
  cashAccount,
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from '../projection'
import { getExampleById } from './examples/registry'
import { buildLedgerCsv } from './resultsRows'

describe('CSV lossCarryforwardUsed is the engine figure', () => {
  it.each(['glidepath-allocation', 'static-allocation-control'])('%s', (id) => {
    const plan = getExampleById(id)!.build()
    const view = projectPlan(plan, 2026)
    const lines = buildLedgerCsv(plan, view).split('\n')
    const header = lines[0]!.split(',')
    const column = header.indexOf('lossCarryforwardUsed')
    expect(column).toBeGreaterThan(0)
    const printed = lines.slice(1).map((line) => line.split(',')[column])
    expect(printed).toEqual(view.result.years.map((y) => String(Math.round(capitalLossCarryforwardUsed(y)))))
    // The retired expression, gains plus ordinary, is the same sum.
    expect(printed).toEqual(
      view.result.years.map((y) => String(Math.round(y.capitalLossUsedAgainstGains + y.capitalLossUsedAgainstOrdinary))),
    )
    expect(Number(printed[0])).toBeGreaterThan(0)
  })

  it('a carryforward with no gains to absorb: the $3,000 used against ordinary income (carryforward-used case B, gains-room household A)', () => {
    // Single filer, 2026, $40,000 of pension, a $10,000 carryforward and no
    // realized gain: the year uses $3,000 against ordinary income and nothing
    // against gains, carrying $7,000 forward.
    const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
    plan.accounts = [cashAccount('cash', 1_000)]
    plan.incomes = [recurringOrdinaryIncome('pension', 40_000)]
    plan.household.capitalLossCarryforward = 10_000
    const valid = validatePlan(plan)
    const view = projectPlan(valid, 2026)
    const first = view.result.years[0]!
    expect(first.capitalLossUsedAgainstGains).toBe(0)
    expect(first.capitalLossUsedAgainstOrdinary).toBe(3_000)
    const lines = buildLedgerCsv(valid, view).split('\n')
    const column = lines[0]!.split(',').indexOf('lossCarryforwardUsed')
    expect(lines[1]!.split(',')[0]).toBe('2026')
    expect(lines[1]!.split(',')[column]).toBe('3000')
    expect(lines[1]!.split(',')[column]).not.toBe(String(Math.round(first.capitalLossUsedAgainstGains)))
  })
})
