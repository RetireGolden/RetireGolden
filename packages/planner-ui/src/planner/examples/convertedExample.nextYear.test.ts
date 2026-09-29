/**
 * A plan saved from a library example keeps its premium tax credit from a
 * later start (decision D-2027-ROLLOVER, U4; review M6).
 *
 * Before main's #761 (D-EXAMPLE-SOURCE-SWITCH), a plan saved from
 * early-retiree-aca on 2026-10-15 and opened from 2027 refused its
 * Marketplace years with `example-contract-input-mismatch`, and told its
 * owner the example's inputs had been edited though nothing was. This holds
 * the rollover's view of it: saved in 2026, run from 2027, no year carries the
 * mismatch, and 2027's credit is priced.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { convertedFromExample } from '../../data/planStore'
import { exampleStorageId } from '../../data/planOrigin'
import { projectPlan } from '../../projection'
import { exampleFixedNow } from './buildContext'
import { EXAMPLE_PLANS } from './registry'

function stamped(exampleId: string): Plan {
  const example = EXAMPLE_PLANS.find((entry) => entry.id === exampleId)!
  const parsed = parsePlan({
    ...example.build(),
    id: exampleStorageId(example.id),
    name: example.title,
    origin: 'example',
    exampleSourceId: example.id,
    createdAtIso: exampleFixedNow().toISOString(),
    updatedAtIso: exampleFixedNow().toISOString(),
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 11))
})

afterAll(() => {
  vi.useRealTimers()
})

describe('early-retiree-aca saved as the household’s plan in 2026, run from 2027', () => {
  it('prices 2027’s credit and carries no example-contract mismatch in any year', () => {
    const converted = convertedFromExample(stamped('early-retiree-aca'), { newId: () => 'saved-early-retiree' })
    if (!converted.ok) throw new Error(converted.issues.join('; '))
    expect(converted.plan.origin).toBe('user')
    const years = projectPlan(converted.plan, 2027).result.years.filter((year) => year.aca !== undefined)
    expect(years.length).toBeGreaterThan(0)
    for (const year of years) expect(year.aca!.supportCodes).not.toContain('example-contract-input-mismatch')
    const first = years.find((year) => year.year === 2027)!
    expect(first.aca!.readiness).toBe('actionable')
    expect(first.aca!.modeledAllowablePtc).toBeGreaterThan(0)
  })
})
