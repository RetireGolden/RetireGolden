import type { Detector, InsightCard } from '../types.js'
import { PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '../../params/index.js'

/**
 * Full ISO-8601 timestamp shape used by plan stamps
 * (`YYYY-MM-DDTHH:mm:ss[.sss]Z` or `±HH:mm` offset). A year-month prefix alone
 * is not enough — `"2025-02-not-a-date"` must not emit drift evidence
 * (GOVERNANCE silence on malformed input).
 */
const FULL_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function planAsOf(ctx: Parameters<Detector['screen']>[0]): number | null {
  const iso = ctx.plan.updatedAtIso
  const match = FULL_ISO_TIMESTAMP.exec(iso)
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null
  }

  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  if (iso.endsWith('Z')) {
    const d = new Date(ms)
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day ||
      d.getUTCHours() !== hour ||
      d.getUTCMinutes() !== minute ||
      d.getUTCSeconds() !== second
    ) {
      return null
    }
  }

  return year
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
