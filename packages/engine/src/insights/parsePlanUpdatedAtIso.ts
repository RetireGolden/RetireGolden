/**
 * Full ISO-8601 timestamp shape used by plan stamps
 * (`YYYY-MM-DDTHH:mm:ss[.fraction]Z` or `±HH:mm` offset). Fractional seconds
 * accept one or more digits (milliseconds, microseconds, …). A year-month
 * prefix alone is not enough — `"2025-02-not-a-date"` must not emit insight
 * evidence (GOVERNANCE silence on malformed input).
 *
 * Hour `24` is accepted only as end-of-day `24:00:00` (ISO-8601). Date resolves
 * that to the following midnight. Leap seconds (`ss = 60`) are accepted only at
 * instants where a leap second can occur — UTC 23:59:60 on 30 June or 31
 * December (offset stamps must resolve to that UTC minute). Other `:60` forms
 * are malformed and silent. Accepted leap seconds normalize to the following
 * minute (Date.parse rejects `:60` in many engines). For every accepted form —
 * Z, numeric offset, 24:00, and leap-second — year/month are taken from the
 * parsed **instant's** UTC components (so `2025-12-31T24:00:00Z`,
 * `2025-12-31T23:30:00-02:00`, and `2016-12-31T23:59:60Z` are Jan-1 saves of
 * the following year).
 */
const FULL_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export interface ParsedPlanUpdatedAtIso {
  year: number
  month: string
}

/** True when `d` is the last UTC second of 30 Jun or 31 Dec (pre-leap :59). */
function isUtcLeapSecondCandidateMinute(d: Date): boolean {
  if (
    d.getUTCHours() !== 23 ||
    d.getUTCMinutes() !== 59 ||
    d.getUTCSeconds() !== 59
  ) {
    return false
  }
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return (month === 6 && day === 30) || (month === 12 && day === 31)
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
    second > 60
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

  // Leap second (ss = 60): only at UTC 23:59:60 on 30 Jun or 31 Dec. Date.parse
  // rejects `:60`; rewrite to :59 with the stamp's offset/Z, require that UTC
  // instant to be the leap-second candidate minute, then +1s for the following
  // minute (drop leap fraction — next minute :00). Other :60 → silent null.
  if (second === 60) {
    const as59 = iso.replace(/:60(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/, ':59$1')
    const ms59 = Date.parse(as59)
    if (!Number.isFinite(ms59)) return null
    const at59 = new Date(ms59)
    if (!isUtcLeapSecondCandidateMinute(at59)) return null

    const instant = new Date(ms59 + 1000)
    return {
      year: instant.getUTCFullYear(),
      month: String(instant.getUTCMonth() + 1).padStart(2, '0'),
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
