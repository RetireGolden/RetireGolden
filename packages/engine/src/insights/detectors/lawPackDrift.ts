import type { Detector, InsightCard } from '../types.js'
import { parsePlanUpdatedAtIso } from '../parsePlanUpdatedAtIso.js'
import { PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '../../params/index.js'

/** Advises after an annual parameter-pack refresh changes the governing rules. */
export const lawPackDrift: Detector = {
  id: 'law-pack-drift',
  category: 'tax-brackets',
  version: 1,
  screen(ctx): InsightCard | null {
    const planAsOfYear = parsePlanUpdatedAtIso(ctx.plan.updatedAtIso)?.year ?? null
    if (planAsOfYear === null || planAsOfYear >= ctx.params.year) return null

    return {
      id: 'law-pack-drift',
      category: 'tax-brackets',
      title: `${ctx.params.year} rules need a plan review`,
      rationale:
        `The plan was last saved in ${planAsOfYear}, but brackets, limits, and tables now reflect the ${ctx.params.year} parameter set ` +
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
