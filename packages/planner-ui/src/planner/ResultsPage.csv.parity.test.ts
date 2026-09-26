/**
 * B2-P1 slice 1 parity: the Results "Download CSV" ledger's
 * `lossCarryforwardUsed` column is the engine's
 * `capitalLossCarryforwardUsed(row)` (family
 * display-loss-carryforward-used-annual), rounded to the dollar the way the
 * CSV rounds every number. The two examples carry a $12,000 carryforward that
 * 2026 uses up, so the column is not all zeros.
 */
import { describe, expect, it } from 'vitest'

import { capitalLossCarryforwardUsed } from '@retiregolden/engine/projection/yearFigures'
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
})
