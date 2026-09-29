/**
 * Which of a year's tax, limit and benefit figures are projected rather than
 * published, in words, for every page that shows figures (decision
 * D-2027-ROLLOVER, 2026-09-28).
 *
 * The engine resolves each publisher's figures on its own calendar
 * (`@retiregolden/engine/params` components) and says, per year, which ones
 * stand in from an earlier publication and grow at the plan's inflation. This
 * module only words that: it reads years and labels, never dollars, so no
 * money math moves into the planner. One source for the Results note, the
 * year table's mark, the CSV column, the Assumptions pages, the Optimizer and
 * the report, so they cannot disagree.
 */

import {
  PARAMETER_COMPONENTS,
  parameterComponentsForYear,
  projectedParameterComponents,
  type ParameterComponentKey,
} from '@retiregolden/engine/params'
import { LATEST_STATE_PACK_YEAR, modeledStateCodes, stateParamsFor } from '@retiregolden/engine/params/state'

/** One projected component in a year: what it is called and the year it is projected from. */
export interface ProjectedComponent {
  readonly key: ParameterComponentKey
  readonly label: string
  readonly fromYear: number
}

/** The components `year` projects, in the engine's order. Empty when every indexed figure is published. */
export function projectedComponentsIn(year: number): readonly ProjectedComponent[] {
  const lookups = parameterComponentsForYear(year)
  return projectedParameterComponents(year).map((key) => ({
    key,
    label: PARAMETER_COMPONENTS[key].label,
    fromYear: lookups[key].baseYear,
  }))
}

/** True when some of `year`'s indexed figures are projected: the year table's mark. */
export function isParameterYearProjected(year: number): boolean {
  return projectedParameterComponents(year).length > 0
}

/**
 * State income tax in a later year (review M3, after the state-tax change):
 * each state's enacted schedules where RetireGolden has loaded them
 * (`params/state`, the enacted years), and otherwise the state's latest loaded
 * figures, held without growth, with two exceptions for the standard
 * deduction (the second verification's V2). One that follows the federal
 * deduction moves with it. One the state's own statute indexes (the
 * District's from 2027, Washington's from 2029: `statuteIndexedStateDeductions`)
 * grows at the plan's inflation, which the engine takes as the statute's
 * inflation (`tax/stateEnactedLaw.ts`). This is said beside the projected
 * federal figures, not among them: the state figures are not projected from
 * a publication, they are the law's own.
 */
function stateFiguresHeldAfter(year: number): boolean {
  return year > LATEST_STATE_PACK_YEAR
}

/** The names the sentence gives the states whose statute indexes their deduction. */
const STATUTE_INDEXED_STATE_NAMES: Readonly<Record<string, string>> = {
  DC: 'the District of Columbia',
  WA: 'Washington',
}

/**
 * The states whose own statute indexes their standard deduction in some year
 * from `firstYear` to `lastYear` after the state figures' year, each with the
 * first such year, in that order. Read from the engine's state figures (a
 * state's `standardDeductionStatutoryIndexing`), so a statute loaded later is
 * listed without a change here; a test holds that every one has a name.
 */
export function statuteIndexedStateDeductions(firstYear: number, lastYear: number): readonly { code: string; name: string; fromYear: number }[] {
  const found: { code: string; name: string; fromYear: number }[] = []
  for (const code of modeledStateCodes()) {
    for (let year = Math.max(firstYear, LATEST_STATE_PACK_YEAR + 1); year <= lastYear; year++) {
      const rule = stateParamsFor(code, year)?.standardDeductionStatutoryIndexing
      if (rule && year >= rule.firstIndexedYear) {
        found.push({ code, name: STATUTE_INDEXED_STATE_NAMES[code] ?? code, fromYear: year })
        break
      }
    }
  }
  return found.sort((a, b) => a.fromYear - b.fromYear || a.code.localeCompare(b.code))
}

/** What the CSV's "Parameter figures" column says for a year. No commas: the ledger CSV does not quote. */
export function parameterFiguresCsvValue(year: number): string {
  const projected = projectedComponentsIn(year)
  const fromYears = [...new Set(projected.map((component) => component.fromYear))].sort((a, b) => a - b)
  const federal = projected.length === 0 ? 'published' : `projected from ${fromYears.join(' and ')}`
  if (!stateFiguresHeldAfter(year)) return federal
  const indexed = statuteIndexedStateDeductions(year, year).map((state) => state.code)
  return (
    `federal ${federal}; state enacted where loaded else ${LATEST_STATE_PACK_YEAR} held; ` +
    'federal-following state deductions move with federal' +
    (indexed.length === 0 ? '' : `; ${indexed.join(' and ')} deduction${indexed.length === 1 ? '' : 's'} statute-indexed at plan inflation`)
  )
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('')
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

/** How many years past the start the scan looks: every later year repeats the last one. */
const SCAN_YEARS = 12

/** The growth a plan's projected figures follow: its inflation, and its healthcare premium on top for Medicare. */
export interface ProjectionGrowthAssumptions {
  readonly inflationPct: number
  readonly healthcareExtraInflationPct: number
}

const pct = (value: number): string => `${Number(value.toFixed(2))}%`

/**
 * The words a page shows for a plan starting in `startYear`: from which year
 * which federal figures are projected, from which year's figures, and at what
 * growth; and how later years' state income tax is set. Null when nothing in
 * the plan's first years is projected or held.
 *
 * Medicare premiums grow at the plan's healthcare inflation (its inflation
 * plus its healthcare premium: `projection/internal/annualHealthcareExpenses.ts`
 * grows the Part B premium and the IRMAA surcharges by it), every other
 * projected figure at the plan's inflation (review M1). Each is projected
 * until RetireGolden loads the agency's own figures, which is later than the
 * agency publishing them: a release reaches the planner only with a change
 * that loads it.
 */
export function projectedParametersSentence(
  startYear: number,
  assumptions: ProjectionGrowthAssumptions,
): string | null {
  const firsts = projectedParametersFrom(startYear)
  const sentences: string[] = []
  if (firsts.length > 0) {
    // One clause per (first projected year, projected-from year), in order.
    const groups: { fromYear: number; projectedFrom: number; labels: string[] }[] = []
    for (const entry of [...firsts].sort((a, b) => a.fromYear - b.fromYear || a.projectedFrom - b.projectedFrom)) {
      const group = groups.find((candidate) => candidate.fromYear === entry.fromYear && candidate.projectedFrom === entry.projectedFrom)
      if (group) group.labels.push(entry.figures)
      else groups.push({ fromYear: entry.fromYear, projectedFrom: entry.projectedFrom, labels: [entry.figures] })
    }
    const clauses = groups.map(
      (group, index) =>
        `${index === 0 ? 'From' : 'from'} ${group.fromYear}, ${joinWords(group.labels)} are projected from their ${group.projectedFrom} figures`,
    )
    sentences.push(`${clauses.join('; ')}.`)
    const medicare = firsts.some((entry) => entry.key === 'cmsMedicare')
    const others = firsts.some((entry) => entry.key !== 'cmsMedicare')
    const healthcare = pct(assumptions.inflationPct + assumptions.healthcareExtraInflationPct)
    const growth = [
      ...(others ? [`they grow at this plan's ${pct(assumptions.inflationPct)} inflation assumption`] : []),
      ...(medicare
        ? [`${others ? 'and ' : ''}Medicare premiums at its ${healthcare} healthcare inflation (its inflation plus its healthcare premium)`]
        : []),
    ]
    sentences.push(
      `Until RetireGolden loads each agency's own figures, ${growth.join(', ')}; the agencies' figures will differ.`,
    )
  }
  if (stateFiguresHeldAfter(startYear + SCAN_YEARS)) {
    const indexed = statuteIndexedStateDeductions(startYear, startYear + SCAN_YEARS)
    const statutes =
      indexed.length === 0
        ? ''
        : `, and ${joinWords(indexed.map((state) => `${state.name}'s from ${state.fromYear}`))}, which ` +
          `${indexed.length === 1 ? 'its statute indexes' : 'their own statutes index'} to inflation, ` +
          `${indexed.length === 1 ? 'grows' : 'grow'} at this plan's ${pct(assumptions.inflationPct)} inflation assumption`
    sentences.push(
      "State income tax uses each state's enacted schedules where RetireGolden has loaded them, and otherwise " +
        `the state's ${LATEST_STATE_PACK_YEAR} figures held without growth, except the standard deduction: one that ` +
        `follows the federal deduction moves with it${statutes}.`,
    )
  }
  return sentences.length === 0 ? null : sentences.join(' ')
}

/**
 * The plan's projected figures as data, for the assumptions export: from the
 * first year each publisher's figures are projected, and from which year's
 * publication. Scans the plan's first years; every later year repeats the last.
 */
export function projectedParametersFrom(
  startYear: number,
): readonly { key: ParameterComponentKey; fromYear: number; figures: string; projectedFrom: number }[] {
  const seen = new Map<ParameterComponentKey, { key: ParameterComponentKey; fromYear: number; figures: string; projectedFrom: number }>()
  for (let year = startYear; year <= startYear + SCAN_YEARS; year++) {
    for (const component of projectedComponentsIn(year)) {
      if (!seen.has(component.key)) {
        seen.set(component.key, { key: component.key, fromYear: year, figures: component.label, projectedFrom: component.fromYear })
      }
    }
  }
  return [...seen.values()]
}
