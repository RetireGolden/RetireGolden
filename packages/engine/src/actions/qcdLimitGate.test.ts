/**
 * The named-QCD gate waits only on the QCD limit (decision D-2027-ROLLOVER,
 * 2026-09-28).
 *
 * IRC 408(d)(8)(A) excludes a qualified charitable distribution "to the extent
 * the aggregate amount of such distributions ... does not exceed" the limit,
 * which 408(d)(8)(G) indexes and the IRS publishes each November in its
 * notice of retirement-plan limits (for 2026, Notice 2025-67: "is increased
 * from $108,000 to $111,000"). The engine executes a named gift only in a tax
 * year whose limit is published, because a limit projected at the plan's
 * inflation is not evidence of what the law allows. Until this change the
 * gate asked whether the WHOLE parameter set was published for the year, so a
 * 2027 gift would have stayed refused until HUD's December letter; now it
 * asks only about the notice's component.
 */

import { describe, expect, it } from 'vitest'

import { parameterComponentsForYear, type ParameterComponentLookups } from '../params/index.js'
import { qcdLimitPublishedFor } from './annualQcdTaxCharacterPostPass.js'

/** A year's lookups with the named components' publication overridden. */
function lookupsWith(
  year: number,
  published: Partial<Record<keyof ParameterComponentLookups, number>>,
): { components: ParameterComponentLookups } {
  const components = { ...parameterComponentsForYear(year) }
  for (const [key, baseYear] of Object.entries(published)) {
    const k = key as keyof ParameterComponentLookups
    components[k] = { ...components[k], baseYear: baseYear!, standIn: baseYear !== year }
  }
  return { components }
}

describe('the named-QCD gate', () => {
  it('opens in 2026, whose notice is published, and stays shut in 2027 today', () => {
    expect(qcdLimitPublishedFor({ components: parameterComponentsForYear(2026) }, 2026)).toBe(true)
    expect(qcdLimitPublishedFor({ components: parameterComponentsForYear(2027) }, 2027)).toBe(false)
  })

  it('opens for 2027 once the notice lands, while the brackets are still projected', () => {
    const lookup = lookupsWith(2027, { irsRetirementPlanLimits: 2027 })
    expect(lookup.components.irsIncomeTax.standIn).toBe(true)
    expect(qcdLimitPublishedFor(lookup, 2027)).toBe(true)
  })

  it('stays shut for 2027 when everything but the notice has landed', () => {
    const lookup = lookupsWith(2027, { irsIncomeTax: 2027, ssaProgram: 2027, cmsMedicare: 2027, hudHecm: 2027 })
    expect(qcdLimitPublishedFor(lookup, 2027)).toBe(false)
  })

  it('never reads a published limit for another year as this one', () => {
    expect(qcdLimitPublishedFor(lookupsWith(2028, { irsRetirementPlanLimits: 2027 }), 2028)).toBe(false)
  })
})
