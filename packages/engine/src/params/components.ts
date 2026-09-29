/**
 * The annual parameter set, split by the publisher that sets each figure, so
 * each part lands when its agency publishes it (decision D-2027-ROLLOVER,
 * 2026-09-28).
 *
 * The 2027 figures arrive on five calendars: SSA's cost-of-living fact sheet
 * in mid-October, the IRS revenue procedure of inflation adjustments in
 * October, the IRS notice of retirement-plan limits and CMS's Medicare
 * premiums in mid-November, and HUD's HECM limit in mid-December (the HSA
 * limits came in May, and the premium tax credit's table in July). A single
 * 2027 pack would have to wait for the last of them, less than three weeks
 * before 1 January, and until then every figure, published or not, would be
 * the 2026 one grown at the plan's inflation. Worse, a gate that asked "is
 * the whole pack exact for this year" would keep refusing a figure long after
 * its own agency had published it: the named-QCD gate is the case the
 * decision names, which must wait only on the QCD limit.
 *
 * So each published figure belongs to exactly one component here, named by
 * its publisher, and each component has its own published years. A year's
 * parameter view (`packForYear`) takes every component from its latest
 * published year at or before that year, and says, component by component,
 * which year that is and whether it is projected. A consumer scales a figure
 * from its OWN component's year (`componentScale`), so a component that has
 * landed for 2027 is read as published while the others are still projected
 * from 2026. Figures no one republishes each year (a statute's fixed amounts,
 * a regulation's tables, RetireGolden's own planning defaults) are components
 * too, never projected.
 *
 * Today every component the pack holds has 2026 as its latest year, so every
 * view is the 2026 pack exactly as before, and every figure the engine
 * publishes for 2026 is unchanged (the equivalence corpus and the example
 * goldens hold it). Two components resolve their figures in modules of their
 * own and already list 2027: the HSA limits (hsaLimitYears.ts, Rev. Proc.
 * 2026-24) and the premium tax credit's coverage years. What changes is that a
 * year's view says which of its figures are projected, and that landing one
 * agency's 2027 figures is one record here: every reader already reads its
 * own publisher's year (below).
 *
 * How to land a component's year: add a record to its `years` list, in year
 * order, whose `values` give every one of the component's field paths (a
 * test holds it), with the publication named in `source`.
 *
 * Every reader takes its year and its growth from the publisher whose figures
 * it reads, never from the base pack or from the income-tax figures. The base
 * pack's year (`packForYear(year).pack.year`) stays the latest base pack's,
 * 2026, however many components land 2027, and the income-tax figures'
 * projection factor becomes 1 in a year the IRS is loaded for, so either
 * agrees with every component only while all of them are at 2026. Nine
 * readers that did not were found and have moved, so nothing is left to move
 * at the first landing (decision D-2027-ROLLOVER; review V1 and PR #768
 * review issues 1 and 7, 2026-09-29):
 * - The state calculator (`tax/stateTax.ts`, both the year total and the
 *   detailed result) conformed a federal-following deduction (Colorado's)
 *   by scaling the state pack's copy of the 2026 federal basic by the
 *   income-tax factor, so it fell back to 2026's once the IRS landed. It
 *   now conforms to the year's federal basic in the composed view
 *   (`conformStateStandardDeduction`'s `federalBasicAmounts`).
 * - The statutory indexing of the District's deduction (from 2027) and
 *   Washington's (from 2029) ran at the same factor, so it stopped once the
 *   IRS landed. The state calculator and the optimizer LP now index it at
 *   the plan's own inflation from `LATEST_STATE_PACK_YEAR`
 *   (`TaxYearInput.stateIndexingScale`).
 * - The widow's-penalty detector (`insights/detectors/widowsPenalty.ts`)
 *   grew the survivor's tax tables from LATEST_PACK_YEAR, so once the IRS's
 *   figures for the year landed it grew them a second time. It now reads the
 *   income-tax component's factor (`componentScale`), as the ledger does.
 * - The law-pack detector (`insights/detectors/lawPackDrift.ts`, "rules need
 *   a plan review") compared the plan's save year with `ctx.params.year`, so
 *   it would never say a year's figures had landed. It now compares it with
 *   the latest year a yearly publisher's figures for the plan's first year
 *   are loaded for, and names those figures.
 * - The IRMAA tier-edge detector (`insights/detectors/irmaaTierEdge.ts`)
 *   scaled the IRMAA thresholds and the Part B premium from
 *   `ctx.params.year`. It now reads them through
 *   `componentPackView(lookup, 'cmsMedicare')`, as the ledger's expense
 *   assembly does (`projection/simulate.ts`).
 * - The optimizer LP (`projection/optimizePlan.ts`) scaled its IRMAA
 *   thresholds by the `irsIncomeTax` component's factor. It now uses the
 *   `cmsMedicare` component's (`componentScale`).
 * - `params/indexingScale.ts#indexingScaleFor` defaulted its latest year to
 *   LATEST_PACK_YEAR. Every caller now names its publication's.
 * - The HSA limits read `hsaLimitYears.ts` (review M1).
 * `params/landing.readers.test.ts` and `tax/stateDeductionLanding.test.ts`
 * land the IRS's income-tax figures alone and CMS's alone and hold each
 * reader to its own publisher; `params/baseYearReaders.contract.test.ts`
 * fails on any new read of the base pack's year in engine source that is not
 * listed with a reason. `DOCS/maintenance-schedule.md` ("How a refresh
 * lands", step 1) says the same.
 */

import { ACA_COVERAGE_YEARS } from './acaCoverageYears.js'
import { HSA_LIMIT_YEARS } from './hsaLimitYears.js'
import type { ParameterPack } from './types.js'

/** Who publishes a figure, as a component key. */
export type ParameterComponentKey =
  | 'irsIncomeTax'
  | 'irsRetirementPlanLimits'
  | 'irsHsaLimits'
  | 'ssaProgram'
  | 'cmsMedicare'
  | 'hudHecm'
  | 'hhsPovertyAndAca'
  | 'statute'
  | 'tablesAndDefaults'

/** One published year of one component. */
export interface ParameterComponentYear {
  readonly year: number
  /** The publication, as a provenance row names it. */
  readonly source: string
  /**
   * The figures, by field path, for a year after the base pack's. Absent on
   * the base year, whose figures are the base pack's own (`year2026`).
   */
  readonly values?: Readonly<Record<string, unknown>>
}

export interface ParameterComponent {
  readonly key: ParameterComponentKey
  /** The publisher and the document, in plain words. */
  readonly publisher: string
  /** When the next year's figures are usually published, or null when they are not republished yearly. */
  readonly publishes: string | null
  /** Whether a year after the latest published one is projected (grown at the plan's inflation). */
  readonly projectedWhenUnpublished: boolean
  /** What a page calls the figures, in the "projected" mark ("tax brackets"). */
  readonly label: string
  /** The dotted `ParameterPack` paths this component owns. */
  readonly fields: readonly string[]
  /** Published years, ascending. The first is the base pack's year. */
  readonly years: readonly ParameterComponentYear[]
  /**
   * True when the component's figures are resolved by year in a module of
   * their own rather than read from the pack: the HSA limits
   * (`hsaLimitsForYear`) and the premium tax credit's
   * coverage years (`acaParametersForCoverageYear`). Its years are listed here
   * so a page can say which are published, but the pack's own fields for it
   * are never overlaid.
   */
  readonly resolvedOutsideThePack?: true
}

const BASE_YEAR = 2026

/**
 * Every component, by key. The field lists are disjoint and together cover
 * every leaf of the pack (`components.test.ts` holds both).
 */
export const PARAMETER_COMPONENTS: Readonly<Record<ParameterComponentKey, ParameterComponent>> = Object.freeze({
  irsIncomeTax: {
    key: 'irsIncomeTax',
    publisher: 'IRS, revenue procedure of annual inflation adjustments',
    publishes: 'October',
    projectedWhenUnpublished: true,
    label: 'tax brackets',
    fields: [
      'federalTax.brackets',
      'federalTax.standardDeduction',
      'federalTax.age65Addition',
      'federalTax.amt.exemption',
      'federalTax.amt.exemptionPhaseOutStart',
      'federalTax.amt.rate28StartsAbove',
      'capitalGains',
      'transferTax',
    ],
    years: [{ year: BASE_YEAR, source: 'Rev. Proc. 2025-32' }],
  },
  irsRetirementPlanLimits: {
    key: 'irsRetirementPlanLimits',
    publisher: 'IRS, notice of retirement-plan limits',
    publishes: 'November',
    projectedWhenUnpublished: true,
    label: 'retirement-plan limits (with the QCD limit)',
    fields: [
      'contributionLimits.employee401k',
      'contributionLimits.catchUp50',
      'contributionLimits.superCatchUp60to63',
      'contributionLimits.rothCatchUpWageThreshold',
      'contributionLimits.ira',
      'contributionLimits.iraCatchUp50',
      'contributionLimits.section415cLimit',
      'rmd.qcdAnnualLimit',
      'annuities.qlacPremiumCap',
    ],
    years: [{ year: BASE_YEAR, source: 'Notice 2025-67' }],
  },
  // The HSA base limits have their own year table (hsaLimitYears.ts, the May
  // revenue procedures), which the ledger reads directly (simulate.ts
  // `hsaLimitsFor`): 2027's are loaded while 2027's income-tax figures are
  // still projected. The component lists those years, so a page marks 2027's
  // HSA limits as loaded and 2028's as projected from 2027, and never
  // overlays the pack's copy of the 2026 block.
  irsHsaLimits: {
    key: 'irsHsaLimits',
    publisher: 'IRS, revenue procedure of HSA limits (hsaLimitYears.ts)',
    publishes: 'May',
    projectedWhenUnpublished: true,
    label: 'HSA limits',
    fields: ['contributionLimits.hsaSelfOnly', 'contributionLimits.hsaFamily'],
    years: HSA_LIMIT_YEARS.map((block) => ({ year: block.year, source: block.source })),
    resolvedOutsideThePack: true,
  },
  ssaProgram: {
    key: 'ssaProgram',
    publisher: 'SSA, cost-of-living adjustment fact sheet',
    publishes: 'mid-October',
    projectedWhenUnpublished: true,
    label: 'Social Security figures',
    fields: ['socialSecurity'],
    years: [{ year: BASE_YEAR, source: 'SSA 2026 COLA fact sheet; 90 FR 49047' }],
  },
  cmsMedicare: {
    key: 'cmsMedicare',
    publisher: 'CMS, Medicare Parts A and B premiums and IRMAA',
    publishes: 'mid-November',
    projectedWhenUnpublished: true,
    label: 'Medicare premiums',
    fields: ['medicare'],
    years: [{ year: BASE_YEAR, source: 'CMS 2026 Medicare Parts A & B premiums and deductibles' }],
  },
  hudHecm: {
    key: 'hudHecm',
    publisher: 'HUD, mortgagee letter of the HECM maximum claim amount',
    publishes: 'mid-December',
    projectedWhenUnpublished: false,
    label: 'the HECM limit',
    fields: ['hecm.maximumClaimAmount'],
    years: [{ year: BASE_YEAR, source: 'Mortgagee Letter 2025-22' }],
  },
  hhsPovertyAndAca: {
    key: 'hhsPovertyAndAca',
    publisher: 'HHS poverty guidelines and the IRS applicable percentage table, by coverage year (acaCoverageYears.ts)',
    publishes: 'January (HHS) and summer (IRS)',
    projectedWhenUnpublished: false,
    label: 'premium tax credit figures',
    fields: ['federalPovertyLine', 'aca'],
    years: ACA_COVERAGE_YEARS.map((block) => ({
      year: block.coverageYear,
      source: `${block.applicablePercentageSource}; ${block.povertyGuidelineSource}`,
    })),
    resolvedOutsideThePack: true,
  },
  statute: {
    key: 'statute',
    publisher: 'Statute (no yearly publication)',
    publishes: null,
    projectedWhenUnpublished: false,
    label: 'statutory amounts',
    fields: [
      'federalTax.saltCap',
      'federalTax.capitalLossOrdinaryOffsetLimit',
      'federalTax.section121Exclusion',
      'federalTax.seniorDeduction',
      'federalTax.amt.exemptionPhaseOutRatePct',
      'federalTax.amt.rate26Pct',
      'federalTax.amt.rate28Pct',
      'niit',
      'ssBenefitTaxation',
      'contributionLimits.hsaCatchUp55',
    ],
    years: [{ year: BASE_YEAR, source: 'Internal Revenue Code' }],
  },
  tablesAndDefaults: {
    key: 'tablesAndDefaults',
    publisher: 'Regulation tables and RetireGolden planning defaults (no yearly publication)',
    publishes: null,
    projectedWhenUnpublished: false,
    label: 'life-expectancy tables and planning defaults',
    fields: [
      'rmd.uniformLifetimeTable',
      'rmd.singleLifeTable',
      'annuities.expectedReturnMultiples',
      'hecm.principalLimitFactorPctByAge',
      'hecm.plfExpectedRatePct',
      'hecm.defaultGrowthRatePct',
      'hecm.initialMipPct',
      'hecm.annualMipPct',
    ],
    years: [{ year: BASE_YEAR, source: 'Treas. Reg. 1.401(a)(9)-9; IRS Pub. 939; HUD HECM tables' }],
  },
} satisfies Record<ParameterComponentKey, ParameterComponent>)

/** The components in a fixed order: the order a page lists them in. */
export const PARAMETER_COMPONENT_KEYS: readonly ParameterComponentKey[] = Object.freeze([
  'irsIncomeTax',
  'irsRetirementPlanLimits',
  'irsHsaLimits',
  'ssaProgram',
  'cmsMedicare',
  'hudHecm',
  'hhsPovertyAndAca',
  'statute',
  'tablesAndDefaults',
])

type ComponentTable = Readonly<Record<ParameterComponentKey, ParameterComponent>>

// The table every reader resolves a year from: PARAMETER_COMPONENTS, except
// inside `params/index.ts#withParameterComponents`, the test seam that lands
// an illustrative publication end to end (review L10, 2026-09-29).
let activeComponents: ComponentTable = PARAMETER_COMPONENTS

/** The component table in force: PARAMETER_COMPONENTS outside the test seam. */
export function activeParameterComponents(): ComponentTable {
  return activeComponents
}

/**
 * Replace the table in force and return the one it replaces. Only
 * `withParameterComponents` calls this, because it also clears the year
 * cache that a bare swap would leave stale.
 */
export function swapActiveParameterComponents(next: ComponentTable): ComponentTable {
  const previous = activeComponents
  activeComponents = next
  return previous
}

/** Where one component's figures for a year come from. */
export interface ParameterComponentLookup {
  readonly key: ParameterComponentKey
  /** The published year the figures are read from. */
  readonly baseYear: number
  /**
   * True when the year has no publication of its own for this component and
   * a published year stands in: grown at the plan's inflation for an indexed
   * component, carried as published for one that is not
   * (`projectedWhenUnpublished`). Never true of a statute or a table.
   */
  readonly standIn: boolean
  /** The publication the figures come from. */
  readonly source: string
}

/**
 * The published year of `key` that `year` reads: the exact year when it is
 * published, else the latest before it, else the earliest (a year before the
 * first publication reads the first, flagged as a stand-in, the way
 * `packForYear` always has).
 */
export function parameterComponentForYear(
  key: ParameterComponentKey,
  year: number,
  components: Readonly<Record<ParameterComponentKey, ParameterComponent>> = activeComponents,
): ParameterComponentLookup {
  const component = components[key]
  const years = component.years
  const annual = component.publishes !== null
  const exact = years.find((entry) => entry.year === year)
  if (exact) return { key, baseYear: exact.year, standIn: false, source: exact.source }
  const earlier = years.filter((entry) => entry.year < year)
  const chosen = earlier.length > 0 ? earlier[earlier.length - 1]! : years[0]!
  return { key, baseYear: chosen.year, standIn: annual, source: chosen.source }
}

/** Every component's lookup for one year. */
export type ParameterComponentLookups = Readonly<Record<ParameterComponentKey, ParameterComponentLookup>>

export function parameterComponentsForYear(
  year: number,
  components: Readonly<Record<ParameterComponentKey, ParameterComponent>> = activeComponents,
): ParameterComponentLookups {
  const lookups = {} as Record<ParameterComponentKey, ParameterComponentLookup>
  for (const key of PARAMETER_COMPONENT_KEYS) lookups[key] = parameterComponentForYear(key, year, components)
  return Object.freeze(lookups)
}

/**
 * The components a year reads from an earlier publication and grows at the
 * plan's inflation: what a page marks as "projected" for that year. A
 * component that is not grown when unpublished (the HECM limit, which the
 * validated HECM mode refuses instead, and the premium tax credit figures,
 * which are refused or carried by their own coverage-year rule) is not
 * listed, and neither is a statute or a table.
 */
export function projectedParameterComponents(
  year: number,
  components: Readonly<Record<ParameterComponentKey, ParameterComponent>> = activeComponents,
): readonly ParameterComponentKey[] {
  return PARAMETER_COMPONENT_KEYS.filter((key) => {
    const component = components[key]
    return component.projectedWhenUnpublished && parameterComponentForYear(key, year, components).standIn
  })
}

/**
 * Path segments no field path may name: reading or writing one would reach an
 * object's prototype rather than a field of the pack. The component field
 * lists name none (a test holds every path to a real field), and the readers
 * below refuse them rather than trust that.
 */
const PROTOTYPE_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

/** One own data field of `node`, or undefined; never a prototype's. */
function ownField(node: unknown, segment: string): unknown {
  if (typeof node !== 'object' || node === null || PROTOTYPE_SEGMENTS.has(segment)) return undefined
  return Object.hasOwn(node, segment) ? (node as Record<string, unknown>)[segment] : undefined
}

/** Read the value at a dotted path of a pack. */
export function packFieldValue(pack: ParameterPack, path: string): unknown {
  return path.split('.').reduce<unknown>(ownField, pack)
}

function withFieldValue(pack: ParameterPack, path: string, value: unknown): ParameterPack {
  const segments = path.split('.')
  const unsafe = segments.find((segment) => PROTOTYPE_SEGMENTS.has(segment))
  if (unsafe !== undefined) throw new RangeError(`parameter field path ${path} names ${unsafe}`)
  const write = (node: Record<string, unknown>, depth: number): Record<string, unknown> => {
    const key = segments[depth]!
    if (depth === segments.length - 1) return { ...node, [key]: value }
    return { ...node, [key]: write(ownField(node, key) as Record<string, unknown>, depth + 1) }
  }
  return write(pack as unknown as Record<string, unknown>, 0) as unknown as ParameterPack
}

/**
 * The parameter view for `year` built on `base`: every component's figures
 * from its latest published year at or before `year`. A component read at the
 * base pack's own year keeps the base's figures (the same objects), so while
 * every component's latest year is the base year the view IS the base pack.
 */
export function composeParameterPack(
  base: ParameterPack,
  lookups: ParameterComponentLookups,
  components: Readonly<Record<ParameterComponentKey, ParameterComponent>> = activeComponents,
): ParameterPack {
  let pack = base
  for (const key of PARAMETER_COMPONENT_KEYS) {
    const lookup = lookups[key]
    if (lookup.baseYear === base.year || components[key].resolvedOutsideThePack) continue
    const record = components[key].years.find((entry) => entry.year === lookup.baseYear)
    if (record?.values === undefined) {
      throw new RangeError(`parameter component ${key} has no figures for ${lookup.baseYear}`)
    }
    for (const field of components[key].fields) {
      if (!(field in record.values)) {
        throw new RangeError(`parameter component ${key} ${lookup.baseYear} is missing ${field}`)
      }
      pack = withFieldValue(pack, field, record.values[field])
    }
  }
  return pack
}
