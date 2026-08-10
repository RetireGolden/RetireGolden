import type { Detector, InsightCard } from '../types.js'

function planAsOf(ctx: Parameters<Detector['screen']>[0]): { year: number; month: string } | null {
  const match = /^(\d{4})-(\d{2})/.exec(ctx.plan.updatedAtIso)
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || month < 1 || month > 12) return null

  return { year, month: match[2]! }
}

/** Advises when the plan's saved facts predate the active planning year. */
export const stalePlanData: Detector = {
  id: 'stale-plan-data',
  category: 'accounts-contributions',
  version: 1,
  screen(ctx): InsightCard | null {
    const stamped = planAsOf(ctx)
    if (stamped === null) return null

    const gapYears = ctx.params.year - stamped.year
    if (gapYears < 1) return null

    return {
      id: 'stale-plan-data',
      category: 'accounts-contributions',
      title: `Plan data was last updated in ${stamped.year}`,
      rationale:
        `This plan was last updated in ${stamped.year}, while its current rules and data are for ${ctx.params.year}. ` +
        'Balances and incomes may no longer reflect reality; review them before relying on the projections.',
      impact: {
        qualitative: 'Refresh balances and income amounts so the projection reflects the household\'s current facts.',
      },
      exact: false,
      confidence: 'high',
      severity: gapYears >= 2 ? 'attention' : 'info',
      evidence: [
        { label: 'Plan last updated', value: `${stamped.year}-${stamped.month}`, year: stamped.year },
        { label: 'Current parameter year', value: String(ctx.params.year), year: ctx.params.year },
        { label: 'Data gap', value: `${gapYears} year${gapYears === 1 ? '' : 's'}` },
      ],
      action: { kind: 'advisory' },
    }
  },
}
