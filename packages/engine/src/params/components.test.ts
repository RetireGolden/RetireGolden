/**
 * The parameter set split by publisher (decision D-2027-ROLLOVER, 2026-09-28).
 *
 * What is pinned: every figure of the pack belongs to exactly one publisher's
 * component; today every component's latest published year is 2026, so every
 * year's view is the 2026 pack itself (the same object, so nothing the engine
 * publishes for 2026 can move); a year after 2026 names exactly the components
 * it projects; and landing one agency's 2027 figures moves that agency's
 * figures alone, with its own year, while the others stay projected from 2026.
 */

import { describe, expect, it } from 'vitest'

import {
  PARAMETER_COMPONENTS,
  PARAMETER_COMPONENT_KEYS,
  composeParameterPack,
  packFieldValue,
  parameterComponentForYear,
  parameterComponentsForYear,
  projectedParameterComponents,
  type ParameterComponent,
  type ParameterComponentKey,
} from './components.js'
import { year2026 } from './data/year2026.js'
import { packForYear } from './index.js'

/** Every leaf path of a value: arrays and plain records are walked as objects. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return [prefix]
  return entries.flatMap(([key, child]) => leafPaths(child, prefix === '' ? key : `${prefix}.${key}`))
}

function ownersOf(path: string): ParameterComponentKey[] {
  return PARAMETER_COMPONENT_KEYS.filter((key) =>
    PARAMETER_COMPONENTS[key].fields.some((field) => path === field || path.startsWith(`${field}.`)),
  )
}

describe('the parameter set, by publisher', () => {
  it('gives every figure of the 2026 pack exactly one publisher', () => {
    const leaves = leafPaths(year2026).filter((path) => path !== 'year')
    expect(leaves.length).toBeGreaterThan(100)
    const unowned = leaves.filter((path) => ownersOf(path).length === 0)
    const doubled = leaves.filter((path) => ownersOf(path).length > 1)
    expect(unowned).toEqual([])
    expect(doubled).toEqual([])
    // And every listed field is a real path of the pack.
    for (const key of PARAMETER_COMPONENT_KEYS) {
      for (const field of PARAMETER_COMPONENTS[key].fields) {
        expect(packFieldValue(year2026, field), `${key}: ${field}`).not.toBeUndefined()
      }
    }
  })

  it('lists its years in order, starting with the base pack year', () => {
    for (const key of PARAMETER_COMPONENT_KEYS) {
      const years = PARAMETER_COMPONENTS[key].years.map((entry) => entry.year)
      expect(years[0], key).toBe(year2026.year)
      expect([...years].sort((a, b) => a - b), key).toEqual(years)
    }
  })

  it('reads 2026 as published for every component, and projects nothing', () => {
    for (const key of PARAMETER_COMPONENT_KEYS) {
      expect(parameterComponentForYear(key, 2026)).toMatchObject({ baseYear: 2026, standIn: false })
    }
    expect(projectedParameterComponents(2026)).toEqual([])
  })

  it('names what 2027 projects: every figure an agency has not yet published for it', () => {
    expect(projectedParameterComponents(2027)).toEqual([
      'irsIncomeTax',
      'irsRetirementPlanLimits',
      'ssaProgram',
      'cmsMedicare',
    ])
    // The HSA limits for 2027 are loaded (Rev. Proc. 2026-24, hsaLimitYears.ts),
    // so they are projected only from 2028, from 2027's.
    expect(parameterComponentForYear('irsHsaLimits', 2027)).toMatchObject({ baseYear: 2027, standIn: false })
    expect(parameterComponentForYear('irsHsaLimits', 2028)).toMatchObject({ baseYear: 2027, standIn: true })
    expect(projectedParameterComponents(2028)).toContain('irsHsaLimits')
    // The HECM limit is not projected: the validated HECM mode refuses a year
    // HUD has not published. The premium tax credit's 2027 figures are out.
    expect(parameterComponentForYear('hudHecm', 2027)).toMatchObject({ baseYear: 2026, standIn: true })
    expect(parameterComponentForYear('hhsPovertyAndAca', 2027)).toMatchObject({ baseYear: 2027, standIn: false })
    expect(parameterComponentForYear('statute', 2040)).toMatchObject({ baseYear: 2026, standIn: false })
  })

  it('reads a year before the first publication from the first, flagged', () => {
    expect(parameterComponentForYear('irsIncomeTax', 2020)).toMatchObject({ baseYear: 2026, standIn: true })
  })

  it('is the 2026 pack itself for every year today, so no published figure moves', () => {
    for (const year of [2020, 2026, 2027, 2030, 2060]) {
      expect(composeParameterPack(year2026, parameterComponentsForYear(year))).toBe(year2026)
      expect(packForYear(year).pack).toBe(year2026)
      expect(packForYear(year).components.irsIncomeTax.baseYear).toBe(2026)
    }
    expect(packForYear(2026).isStandIn).toBe(false)
    expect(packForYear(2027).isStandIn).toBe(true)
  })
})

describe('landing one agency’s year', () => {
  // A hypothetical SSA 2027 publication, to prove the mechanism: the figures
  // below are illustrative, not SSA's.
  const ssa2027 = {
    colaPct: 2.5,
    taxableWageBase: 190_000,
    earningsTestBelowFraAnnual: 25_000,
    earningsTestFraYearAnnual: 66_000,
    sgaMonthlyNonBlind: 1_730,
  }
  const withSsa2027: Record<ParameterComponentKey, ParameterComponent> = {
    ...PARAMETER_COMPONENTS,
    ssaProgram: {
      ...PARAMETER_COMPONENTS.ssaProgram,
      years: [
        ...PARAMETER_COMPONENTS.ssaProgram.years,
        { year: 2027, source: 'illustrative', values: { socialSecurity: ssa2027 } },
      ],
    },
  }

  it('moves that agency’s figures alone, read at its own year', () => {
    const lookups = parameterComponentsForYear(2027, withSsa2027)
    const pack = composeParameterPack(year2026, lookups, withSsa2027)
    expect(pack.socialSecurity).toEqual(ssa2027)
    expect(pack.federalTax).toBe(year2026.federalTax)
    expect(pack.medicare).toBe(year2026.medicare)
    expect(pack.contributionLimits).toBe(year2026.contributionLimits)
    expect(lookups.ssaProgram).toMatchObject({ baseYear: 2027, standIn: false })
    expect(lookups.irsIncomeTax).toMatchObject({ baseYear: 2026, standIn: true })
    expect(projectedParameterComponents(2027, withSsa2027)).not.toContain('ssaProgram')
    expect(projectedParameterComponents(2027, withSsa2027)).toContain('irsIncomeTax')
  })

  it('projects a later year from the agency’s own latest year', () => {
    const lookups = parameterComponentsForYear(2028, withSsa2027)
    expect(lookups.ssaProgram).toMatchObject({ baseYear: 2027, standIn: true })
    expect(composeParameterPack(year2026, lookups, withSsa2027).socialSecurity).toEqual(ssa2027)
  })

  it('refuses a landed year that leaves out one of the component’s figures', () => {
    const partial: Record<ParameterComponentKey, ParameterComponent> = {
      ...PARAMETER_COMPONENTS,
      irsRetirementPlanLimits: {
        ...PARAMETER_COMPONENTS.irsRetirementPlanLimits,
        years: [
          ...PARAMETER_COMPONENTS.irsRetirementPlanLimits.years,
          { year: 2027, source: 'illustrative', values: { 'rmd.qcdAnnualLimit': 115_000 } },
        ],
      },
    }
    expect(() => composeParameterPack(year2026, parameterComponentsForYear(2027, partial), partial)).toThrow(
      /irsRetirementPlanLimits 2027 is missing contributionLimits\.employee401k/,
    )
  })

  it('reads and writes only a pack’s own fields, never a prototype', () => {
    // The field-path readers take no segment that would reach an object's
    // prototype (the code scanner's prototype-pollution-loop finding on PR
    // #768): a read returns undefined, and a landing that names one is refused.
    expect(packFieldValue(year2026, '__proto__')).toBeUndefined()
    expect(packFieldValue(year2026, 'federalTax.constructor')).toBeUndefined()
    expect(packFieldValue(year2026, 'federalTax.toString')).toBeUndefined()
    expect(packFieldValue(year2026, 'federalTax.saltCap')).toBe(year2026.federalTax.saltCap)
    const hostile: Record<ParameterComponentKey, ParameterComponent> = {
      ...PARAMETER_COMPONENTS,
      hudHecm: {
        ...PARAMETER_COMPONENTS.hudHecm,
        fields: ['hecm.__proto__.polluted'],
        years: [...PARAMETER_COMPONENTS.hudHecm.years, { year: 2027, source: 'illustrative', values: { 'hecm.__proto__.polluted': true } }],
      },
    }
    expect(() => composeParameterPack(year2026, parameterComponentsForYear(2027, hostile), hostile)).toThrow(
      /hecm\.__proto__\.polluted names __proto__/,
    )
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})
