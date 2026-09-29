import type { Detector, InsightCard } from '../types.js'
import { parsePlanUpdatedAtIso } from '../parsePlanUpdatedAtIso.js'
import {
  PARAMETER_COMPONENT_KEYS,
  PARAMETER_DATA_AS_OF,
  PARAMETER_DATA_BASIS,
  activeParameterComponents,
  packForYear,
} from '../../params/index.js'

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('')
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

/**
 * Advises when figures published for a year after the plan was last saved
 * are loaded for the plan's first year.
 *
 * Each publisher's figures are loaded on their own calendar (decision
 * D-2027-ROLLOVER, `params/components.ts`), so the year compared with the save
 * year is the latest year any yearly publisher's figures for the plan's first
 * year are loaded for, read from `packForYear(startYear).components`. It is
 * not the base pack's year (`ctx.params.year`), which stays at the base pack's
 * however many publishers land a later year, so the card would never say a
 * later year's figures had landed (PR #768 review issue 1). Statutes and
 * tables, which no one republishes yearly, are not counted.
 */
export const lawPackDrift: Detector = {
  id: 'law-pack-drift',
  category: 'tax-brackets',
  version: 2,
  screen(ctx): InsightCard | null {
    // On the start year's calendar when the host gives it (planSavedOn).
    const stampedYear = parsePlanUpdatedAtIso(ctx.plan.updatedAtIso)?.year ?? null
    const planAsOfYear = stampedYear === null ? null : ctx.planSavedOn?.year ?? stampedYear
    if (planAsOfYear === null) return null

    const components = activeParameterComponents()
    const yearly = PARAMETER_COMPONENT_KEYS.filter((key) => components[key].publishes !== null)
    const lookups = packForYear(ctx.projection.startYear).components
    const landed = yearly.filter((key) => !lookups[key].standIn && lookups[key].baseYear > planAsOfYear)
    if (landed.length === 0) return null
    const activeYear = Math.max(...landed.map((key) => lookups[key].baseYear))
    const everyPublisher = landed.length === yearly.length
    const figures = everyPublisher
      ? `brackets, limits, and tables now reflect the ${activeYear} parameter set`
      : `${joinWords(landed.map((key) => components[key].label))} now reflect ${activeYear} figures`

    return {
      id: 'law-pack-drift',
      category: 'tax-brackets',
      title: `${activeYear} rules need a plan review`,
      rationale:
        `The plan was last saved in ${planAsOfYear}, but ${figures} ` +
        `(data as of ${PARAMETER_DATA_AS_OF}). Re-review key thresholds after the annual update.`,
      impact: {
        qualitative: 'Annual rule changes can alter tax brackets, contribution limits, and program thresholds.',
      },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: [
        { label: 'Plan last-updated year', value: String(planAsOfYear), year: planAsOfYear },
        { label: 'Active parameter year', value: String(activeYear), year: activeYear },
        { label: 'Parameter data as of', value: PARAMETER_DATA_AS_OF },
        { label: 'Parameter data basis', value: PARAMETER_DATA_BASIS },
      ],
      action: { kind: 'advisory' },
    }
  },
}
