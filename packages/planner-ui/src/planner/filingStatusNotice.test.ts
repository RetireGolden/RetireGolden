/**
 * The Single-with-two-people reading (#555). First the claim itself is held
 * against the engine, not the module constant: a two-person plan filed Single
 * is simulated, and every year is one household return with the Single status
 * while both people are alive — the fact the sentence states. Then the
 * sentence travels to every surface that echoes the filing status: on the
 * Assumptions snapshot it is a note on the "Household & longevity" group,
 * printed under the heading and in the text export, never a row (a row carries
 * a provenance chip, and this is how the engine reads the rows, not a setting
 * anyone made). Only that plan shape gets it.
 */
import { describe, expect, it } from 'vitest'

import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { assumptionsExportText, buildAssumptionsSnapshot } from './assumptionsExport'
import { createSamplePlan } from '../testSupport/samplePlan'
import { SINGLE_WITH_PARTNER_NOTE } from './filingStatusNotice'
import { taxCalculatorFor } from './useProjection'

const longevity = (plan: ReturnType<typeof createSamplePlan>) =>
  buildAssumptionsSnapshot(plan, 2026).groups.find((g) => g.id === 'longevity')!

describe('the reading the notice states is what the engine does (#555)', () => {
  it('a two-person plan filed Single is one Single return every year both people are alive', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    plan.household.hasQualifyingDependent = false
    const { years } = simulatePlan(plan, { startYear: 2026, taxCalculator: taxCalculatorFor(plan) })
    expect(years.length).toBeGreaterThan(0)
    const bothAlive = years.filter((y) => y.people.filter((p) => p.alive).length === 2)
    expect(bothAlive.length).toBeGreaterThan(0)
    // One return per year for the household, and its status is Single: never
    // joint, never qualifying surviving spouse, never one return per person.
    for (const y of years) expect(y.filingStatus).toBe('single')
    // The sentence promises exactly that, in these words.
    expect(SINGLE_WITH_PARTNER_NOTE).toBe(
      'RetireGolden prices each year as one household on one Single return; Married filing jointly is the only two-person filing status it models.',
    )
  })

  it('the same plan filed jointly is the two-person status the sentence names as the only one modeled', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    const { years } = simulatePlan(plan, { startYear: 2026, taxCalculator: taxCalculatorFor(plan) })
    const first = years[0]
    expect(first.people.filter((p) => p.alive)).toHaveLength(2)
    expect(first.filingStatus).toBe('marriedFilingJointly')
  })
})

describe('Assumptions snapshot: Single filing status with two people (#555)', () => {
  it('carries the shared reading as a note on the household group, not as a row', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    const group = longevity(plan)
    expect(group.note).toBe(`Two people on a Single-filing plan: ${SINGLE_WITH_PARTNER_NOTE}`)
    // No row presents the engine's reading with a provenance of its own.
    expect(group.rows.some((r) => r.value.includes(SINGLE_WITH_PARTNER_NOTE))).toBe(false)
    expect(group.rows.find((r) => r.id === 'filing')!.value.startsWith('Single ·')).toBe(true)
    expect(group.rows.filter((r) => r.id.startsWith('person-'))).toHaveLength(2)
  })

  it('the text export prints the note under the group heading, without a provenance label', () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    const text = assumptionsExportText(buildAssumptionsSnapshot(plan, 2026))
    const lines = text.split('\n')
    const heading = lines.indexOf('## Household & longevity')
    expect(heading).toBeGreaterThanOrEqual(0)
    expect(lines[heading + 1]).toBe(`Two people on a Single-filing plan: ${SINGLE_WITH_PARTNER_NOTE}`)
    expect(lines[heading + 1]).not.toContain('You set this')
  })

  it('has no note for a joint plan or a one-person Single plan', () => {
    const joint = createSamplePlan()
    joint.household.filingStatus = 'marriedFilingJointly'
    expect(longevity(joint).note).toBeUndefined()
    const alone = createSamplePlan()
    alone.household.filingStatus = 'single'
    alone.household.people = [alone.household.people[0]]
    expect(longevity(alone).note).toBeUndefined()
  })
})
