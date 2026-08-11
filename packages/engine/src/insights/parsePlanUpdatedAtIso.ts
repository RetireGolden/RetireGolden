/**
 * Full ISO-8601 timestamp shape used by plan stamps
 * (`YYYY-MM-DDTHH:mm:ss[.fraction]Z` or `±HH:mm` offset). Fractional seconds
 * accept one or more digits (milliseconds, microseconds, …). A year-month
 * prefix alone is not enough — `"2025-02-not-a-date"` must not emit insight
 * evidence (GOVERNANCE silence on malformed input).
 *
 * Hour `24` is accepted only as end-of-day `24:00:00` (ISO-8601). Date resolves
 * that to the following midnight. For every accepted form — Z, numeric offset,
 * and 24:00 — year/month are taken from the parsed **instant's** UTC components
 * (so `2025-12-31T24:00:00Z` and `2025-12-31T23:30:00-02:00` are both Jan-1
 * 2026 saves).
 */
const FULL_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

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
    hour > 24 ||
    minute > 59 ||
    second > 59
  ) {
    return null
  }

  // ISO-8601 end-of-day: only 24:00:00 (no non-zero minutes/seconds/fraction).
  if (hour === 24) {
    if (minute !== 0 || second !== 0) return null
    const frac = /\.(\d+)(?:Z|[+-])/.exec(iso)
    if (frac !== null && !/^0+$/.test(frac[1]!)) return null

    // The calendar day being closed must itself be valid (reject Feb 30, etc.).
    const dayStartMs = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
    if (!Number.isFinite(dayStartMs)) return null
    const dayStart = new Date(dayStartMs)
    if (
      dayStart.getUTCFullYear() !== year ||
      dayStart.getUTCMonth() + 1 !== month ||
      dayStart.getUTCDate() !== day
    ) {
      return null
    }

    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return null
    const d = new Date(ms)
    // Attribute to the resolved following midnight (Date's UTC components).
    return {
      year: d.getUTCFullYear(),
      month: String(d.getUTCMonth() + 1).padStart(2, '0'),
    }
  }

  // Deterministic Date consistency: reject impossible calendar dates that the
  // regex accepts (e.g. 2025-02-30). Civil components are re-parsed as a Z stamp
  // so both Z-suffixed and numeric-offset forms get the same UTC round-trip
  // (offset stamps must not skip calendar validity).
  if (!Number.isFinite(Date.parse(iso))) return null
  const civilIso =
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
  const civilMs = Date.parse(civilIso)
  if (!Number.isFinite(civilMs)) return null
  const civil = new Date(civilMs)
  if (
    civil.getUTCFullYear() !== year ||
    civil.getUTCMonth() + 1 !== month ||
    civil.getUTCDate() !== day ||
    civil.getUTCHours() !== hour ||
    civil.getUTCMinutes() !== minute ||
    civil.getUTCSeconds() !== second
  ) {
    return null
  }

  // Attribute year/month to the parsed instant's UTC components — not the
  // civil wall-clock prefix — so numeric-offset stamps that cross a UTC year
  // boundary match the 24:00 handling (e.g. 2025-12-31T23:30:00-02:00 → 2026-01).
  const instantMs = Date.parse(iso)
  if (!Number.isFinite(instantMs)) return null
  const instant = new Date(instantMs)
  return {
    year: instant.getUTCFullYear(),
    month: String(instant.getUTCMonth() + 1).padStart(2, '0'),
  }
}
