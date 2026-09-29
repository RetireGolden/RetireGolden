/**
 * Illustrative publications for the parameter test seam (decision
 * D-2027-ROLLOVER, review L10, 2026-09-29).
 *
 * `landedComponents(['irsRetirementPlanLimits'], 2027, { 'rmd.qcdAnnualLimit':
 * 114_000 })` is the published component table with a 2027 record added to
 * each named component: every field the component owns, copied from the 2026
 * base pack, then any overrides. The figures are illustrative, never an
 * agency's; what they prove is the mechanism, that a landed publisher is read
 * as published while every other one is still projected. Pair it with
 * `params/index.ts#withParameterComponents`, which puts it in force for the
 * readers and clears the year cache.
 */
import {
  PARAMETER_COMPONENTS,
  type ParameterComponent,
  type ParameterComponentKey,
} from '../params/index.js'
import { packFieldValue } from '../params/components.js'
import { year2026 } from '../params/data/year2026.js'

export function landedComponents(
  keys: readonly ParameterComponentKey[],
  year: number,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<ParameterComponentKey, ParameterComponent>> {
  const table = { ...PARAMETER_COMPONENTS } as Record<ParameterComponentKey, ParameterComponent>
  for (const key of keys) {
    const component = PARAMETER_COMPONENTS[key]
    const values: Record<string, unknown> = {}
    for (const field of component.fields) {
      values[field] = field in overrides ? overrides[field] : structuredClone(packFieldValue(year2026, field))
    }
    table[key] = {
      ...component,
      years: [...component.years, { year, source: `illustrative ${year} publication (test)`, values }],
    }
  }
  return Object.freeze(table)
}
