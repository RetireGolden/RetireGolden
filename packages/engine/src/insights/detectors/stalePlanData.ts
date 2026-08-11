import type { Detector, InsightCard } from '../types.js'
import { parsePlanUpdatedAtIso } from '../parsePlanUpdatedAtIso.js'

/** Advises when the plan's saved facts predate the active planning year. */
export const stalePlanData: Detector = {
  id: 'stale-plan-data',
  category: 'accounts-contributions',
  version: 1,
  screen(ctx): InsightCard | null {
    const stamped = parsePlanUpdatedAtIso(ctx.plan.updatedAtIso)
    if (stamped === null) return null

    const currentYear = Math.max(ctx.params.year, ctx.projection.startYear)
    const gapYears = currentYear - stamped.year
    if (gapYears < 1) return null

    return {
      id: 'stale-plan-data',
      category: 'accounts-contributions',
      title: `Plan last saved in ${stamped.year}`,
      rationale:
        `This plan has not been saved since ${stamped.year}. Facts entered then may no longer reflect reality; ` +
        'review balances and incomes before relying on projections.',
      impact: {
        qualitative: 'Refresh balances and income amounts so the projection reflects the household\'s current facts.',
      },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: [
        { label: 'Plan last updated', value: `${stamped.year}-${stamped.month}`, year: stamped.year },
        { label: 'Current planning year', value: String(currentYear), year: currentYear },
        { label: 'Data gap', value: `${gapYears} year${gapYears === 1 ? '' : 's'}` },
      ],
      action: { kind: 'advisory' },
    }
  },
}
