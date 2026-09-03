/**
 * The statutory-indexing rule the ledger, the optimizer's LP and the widow's
 * penalty detector now share.
 *
 * Two of those sites carried a comment asserting the copy was exact when it was
 * not: they measured from different base years, and only the ledger followed a
 * per-year inflation series. The cases below pin the shared half of the rule --
 * the cut at the latest pack year and the base year each call site supplies --
 * across a synthetic two-pack world, because a second published pack is exactly
 * the condition the copies would have disagreed under and there is only one pack
 * today. The unshared half, the inflation path, is asserted to stay unshared.
 */
import { describe, expect, it } from 'vitest'

import { LATEST_PACK_YEAR, packForYear } from './index.js'
import { flatInflationPath, indexingScaleFor, type InflationPath } from './indexingScale.js'

const RATE = 0.025

/**
 * `packForYear`'s selection rule over an arbitrary pack-year list: an exact
 * year uses its own pack, a later year stands in on the newest, and an earlier
 * year stands in on the oldest.
 */
function packLookupIn(
  packYears: readonly number[],
  year: number,
): { packYear: number; isStandIn: boolean } {
  const sorted = [...packYears].sort((left, right) => left - right)
  if (sorted.includes(year)) return { packYear: year, isStandIn: false }
  const latest = sorted[sorted.length - 1]!
  return year > latest
    ? { packYear: latest, isStandIn: true }
    : { packYear: sorted[0]!, isStandIn: true }
}

/** The real published pack years, read through the real lookup. */
const REAL_PACK_YEARS = [LATEST_PACK_YEAR]

describe('statutory indexing scale', () => {
  it('is exactly 1 at and below the latest published pack year', () => {
    const path = flatInflationPath(RATE)
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR, path)).toBe(1)
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR - 1, path)).toBe(1)
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR - 40, path)).toBe(1)
  })

  it('never deflates a year earlier than every published pack', () => {
    // `packForYear` hands a year below the earliest pack the EARLIEST pack, so a
    // bare `year - packYear` would go negative there. The cut at the latest pack
    // year is what keeps that year priced at face value.
    const early = packForYear(LATEST_PACK_YEAR - 50)
    expect(early.isStandIn).toBe(true)
    expect(indexingScaleFor(early.pack.year, LATEST_PACK_YEAR - 50, flatInflationPath(RATE)))
      .toBe(1)
  })

  it('compounds the supplied path above the latest pack year, with no floor at 1', () => {
    const path = flatInflationPath(RATE)
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR + 3, path))
      .toBe(Math.pow(1 + RATE, 3))

    // A deflation assumption must produce a scale below 1 rather than a frozen
    // one: the optimizer scales IRMAA thresholds by this same factor.
    const deflating = flatInflationPath(-0.01)
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR + 2, deflating))
      .toBe(Math.pow(0.99, 2))
    expect(indexingScaleFor(LATEST_PACK_YEAR, LATEST_PACK_YEAR + 2, deflating))
      .toBeLessThan(1)
  })

  it('resolves every stand-in year to the latest pack, so the three base years agree', () => {
    // The ledger and the LP pass `packForYear(year).pack.year`; the detector has
    // no pack in hand and passes LATEST_PACK_YEAR. This is why those are the
    // same number for every year the rule actually computes for.
    for (const year of [LATEST_PACK_YEAR + 1, LATEST_PACK_YEAR + 5, LATEST_PACK_YEAR + 60]) {
      const lookup = packForYear(year)
      expect(lookup.isStandIn).toBe(true)
      expect(lookup.pack.year).toBe(LATEST_PACK_YEAR)
    }
  })

  it('mirrors the real pack lookup, so the two-pack fixture below is not fiction', () => {
    // `packLookupIn` reproduces `packForYear` over an arbitrary pack-year list.
    // Checked against the real one on the real packs before it stands in for
    // a world with two.
    for (const year of [LATEST_PACK_YEAR - 3, LATEST_PACK_YEAR, LATEST_PACK_YEAR + 7]) {
      const real = packForYear(year)
      expect(packLookupIn(REAL_PACK_YEARS, year))
        .toEqual({ packYear: real.pack.year, isStandIn: real.isStandIn })
    }
  })

  it('agrees across the three call sites in a two-pack world', () => {
    // The published packs are 2026-only today. A second pack is the condition
    // the three copies would have disagreed under, so it is modelled here: two
    // packs, and a jump year past both.
    const packYears = [2030, 2032]
    const latest = 2032
    const jumpYear = 2036
    const path = flatInflationPath(RATE)

    // The ledger: `limitScale(pack, isStandIn, year)`, where the pack is the one
    // `packForYear(year)` hands back for the year being priced.
    const ledgerLookup = packLookupIn(packYears, jumpYear)
    const ledger = ledgerLookup.isStandIn
      ? indexingScaleFor(ledgerLookup.packYear, jumpYear, path, latest)
      : 1
    // The optimizer's LP: `packForYear(p.year).pack.year`, the same lookup.
    const optimizer =
      indexingScaleFor(packLookupIn(packYears, jumpYear).packYear, jumpYear, path, latest)
    // The detector: LATEST_PACK_YEAR directly, having no pack in hand.
    const detector = indexingScaleFor(latest, jumpYear, path, latest)

    expect(ledger).toBe(Math.pow(1 + RATE, jumpYear - latest))
    expect(optimizer).toBe(ledger)
    expect(detector).toBe(ledger)

    // And the mistake the detector's comment warns about, which is what the
    // second pack makes reachable: measuring from the pack a projection STARTED
    // in over-indexes the survivor's thresholds by the gap between packs.
    const measuredFromStartingPack = indexingScaleFor(2030, jumpYear, path, latest)
    expect(measuredFromStartingPack).toBeGreaterThan(ledger)
  })

  it('is 1 for a year between two published packs', () => {
    // A gap year is a stand-in, but it is at or below the latest pack and so is
    // priced at face value rather than projected.
    expect(indexingScaleFor(2030, 2031, flatInflationPath(RATE), 2032)).toBe(1)
  })

  it('leaves the inflation path to the caller', () => {
    // The one difference between the three sites that is real and must survive:
    // the ledger follows a per-year Monte Carlo series, the LP and the detector
    // compound a flat assumption. A series that varies by year is not the same
    // number as a flat one, and the helper must not quietly pick either.
    const series: InflationPath = (fromYear, toYear) => {
      let factor = 1
      for (let y = fromYear; y < toYear; y++) factor *= 1 + (y % 2 === 0 ? 0.04 : 0.01)
      return factor
    }
    const flat = flatInflationPath(RATE)

    const withSeries = indexingScaleFor(2032, 2036, series, 2032)
    const withFlat = indexingScaleFor(2032, 2036, flat, 2032)

    expect(withSeries).not.toBe(withFlat)
    expect(withSeries).toBe(1.04 * 1.01 * 1.04 * 1.01)
  })

  it('treats a flat path as 1 for a non-advancing span', () => {
    expect(flatInflationPath(RATE)(2032, 2032)).toBe(1)
    expect(flatInflationPath(RATE)(2032, 2031)).toBe(1)
  })
})
