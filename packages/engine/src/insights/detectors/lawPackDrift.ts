import type { Detector, InsightCard } from '../types.js'
import { PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '../../params/index.js'

function planAsOf(ctx: Parameters<Detector['screen']>[0]): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(ctx.plan.updatedAtIso)
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  return Number.isInteger(year) && month >= 1 && month <= 12 ? year : null
}

/** Advises after an annual parameter-pack refresh changes the governing rules. */
export const lawPackDrift: Detector = {
  id: 'law-pack-drift',
  category: 'tax-brackets',
  version: 1,
  screen(ctx): InsightCard | null {
    const planAsOfYear = planAsOf(ctx)
    if (planAsOfYear === null || planAsOfYear >= ctx.params.year) return null

    return {
      id: 'law-pack-drift',
      category: 'tax-brackets',
      title: `${ctx.params.year} rules need a plan review`,
      rationale:
        `The plan was last saved in ${planAsOfYear}, but brackets, limits, and tables now reflect ${ctx.params.year} rules ` +
        `(data as of ${PARAMETER_DATA_AS_OF}). Re-review key thresholds after the annual update.`,
      impact: {
        qualitative: 'Annual rule changes can alter tax brackets, contribution limits, and program thresholds.',
      },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: [
        { label: 'Plan last-updated year', value: String(planAsOfYear), year: planAsOfYear },
        { label: 'Active parameter year', value: String(ctx.params.year), year: ctx.params.year },
        { label: 'Parameter data vintage', value: PARAMETER_DATA_AS_OF },
        { label: 'Parameter data basis', value: PARAMETER_DATA_BASIS },
      ],
      action: { kind: 'advisory' },
    }
  },
}
