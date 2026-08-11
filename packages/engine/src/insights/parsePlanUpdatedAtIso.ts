/**
 * Full ISO-8601 timestamp shape used by plan stamps
 * (`YYYY-MM-DDTHH:mm:ss[.sss]Z` or `±HH:mm` offset). A year-month prefix alone
 * is not enough — `"2025-02-not-a-date"` must not emit insight evidence
 * (GOVERNANCE silence on malformed input).
 */
const FULL_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

export interface ParsedPlanUpdatedAtIso {
  year: number
  month: string
}

export function parsePlanUpdatedAtIso(iso: string): ParsedPlanUpdatedAtIso | null {
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

  // Deterministic Date consistency: reject impossible calendar dates that the
  // regex accepts (e.g. 2025-02-30). Civil components are re-parsed as a Z stamp
  // so both Z-suffixed and numeric-offset forms get the same UTC round-trip
  // (offset stamps must not skip calendar validity).
  if (!Number.isFinite(Date.parse(iso))) return null
  const civilIso =
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
  const ms = Date.parse(civilIso)
  if (!Number.isFinite(ms)) return null
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

  return { year, month: match[2]! }
}
