import { formatEvidenceUsd } from '../evidenceFormat.js'
import type { Detector, InsightCard } from '../types.js'
import { packForYear } from '../../params/index.js'

/**
 * Format a positive FPL overage so it never rounds to zero and never uses
 * scientific notation. Two significant digits in plain decimal form keep tiny
 * gaps human-readable (e.g. 0.000040, not 4.0e-5 or 1.0e-7).
 */
function formatOverageDelta(delta: number): string {
  if (!(delta > 0) || !Number.isFinite(delta)) return '0'
  const precise = delta.toPrecision(2)
  if (!/[eE]/.test(precise)) return precise
  // toPrecision emits exponential form for tiny magnitudes; expand to a fixed
  // plain decimal with enough places to keep both significant digits.
  const expMatch = /[eE]([+-]?\d+)$/.exec(precise)
  const exp = expMatch ? Number(expMatch[1]) : 0
  if (exp >= 0) {
    return Number(precise).toLocaleString('en-US', {
      maximumSignificantDigits: 2,
      useGrouping: false,
    })
  }
  // "1.0e-7" → 8 decimal places → "0.00000010" (never "0", never scientific).
  return Number(precise).toFixed(-exp + 1)
}

/** Flags Marketplace years just above the parameter-pack ACA credit cliff. */
export const acaThresholdProximity: Detector = {
  id: 'aca-threshold-proximity',
  category: 'tax-brackets',
  version: 1,
  screen(ctx): InsightCard | null {
    for (const year of ctx.projection.result.years) {
      const aca = year.aca
      const boundary = packForYear(year.year).pack.aca.maxFplPctForCredit
      const justOverBoundary =
        aca !== undefined &&
        aca.fplPct !== null &&
        aca.fplPct > boundary &&
        aca.fplPct <= boundary + 25 &&
        aca.cliffState === 'above-cliff'
      const atCliff =
        aca !== undefined &&
        aca.cliffState === 'at-cliff' &&
        typeof aca.modeledAllowablePtc === 'number' &&
        Number.isFinite(aca.modeledAllowablePtc) &&
        // Dollar-rounded card evidence would show less than $1 as $0, so it is
        // not a meaningful modeled credit at stake for the at-cliff message.
        aca.modeledAllowablePtc >= 1
      if (
        aca === undefined ||
        aca.householdMagi === null ||
        aca.federalPovertyLine === null ||
        aca.fplPct === null ||
        !Number.isFinite(aca.householdMagi) ||
        !Number.isFinite(aca.federalPovertyLine) ||
        !Number.isFinite(aca.fplPct) ||
        (!justOverBoundary && !atCliff)
      ) {
        continue
      }

      const rationale = justOverBoundary
        ? `Household MAGI is slightly over the ${boundary}% FPL ACA credit boundary in ${year.year}. ` +
          "Reducing MAGI below the boundary can restore credit eligibility (subject to the credit's other conditions); whether a credit is payable then depends on benchmark premiums versus the required contribution — preview it before acting."
        : `Household MAGI is exactly at the ${boundary}% FPL ACA credit boundary in ${year.year}. ` +
          'A small increase can eliminate the modeled premium tax credit, so review income and conversion timing before the year closes.'

      // Main FPL figures stay at two decimals. Just-over cards carry an explicit
      // overage delta (significant digits, plain decimal — any positive gap stays
      // nonzero and human-readable in evidence).
      const fplPctEvidence = `${aca.fplPct.toFixed(2)}%`
      const boundaryEvidence = `${boundary.toFixed(2)}%`
      const overageEvidence = justOverBoundary
        ? [{
            label: `FPL overage above credit boundary in ${year.year}`,
            value: `${formatOverageDelta(aca.fplPct - boundary)} percentage points`,
            year: year.year,
          }]
        : []

      return {
        id: 'aca-threshold-proximity',
        category: 'tax-brackets',
        title: `ACA credit threshold proximity in ${year.year}`,
        rationale,
        impact: {
          qualitative: justOverBoundary
            ? 'A small MAGI reduction may restore premium-tax-credit eligibility; the payable credit depends on benchmark premiums vs required contribution.'
            : 'A small MAGI increase would eliminate the modeled premium tax credit; there is no headroom at the boundary.',
        },
        exact: false,
        confidence: 'medium',
        severity: justOverBoundary ? 'info' : 'attention',
        evidence: [
          { label: `Household MAGI in ${year.year}`, value: formatEvidenceUsd(aca.householdMagi), year: year.year },
          { label: `Federal poverty line in ${year.year}`, value: formatEvidenceUsd(aca.federalPovertyLine), year: year.year },
          { label: `FPL percentage in ${year.year}`, value: fplPctEvidence, year: year.year },
          { label: 'ACA credit boundary', value: boundaryEvidence, year: year.year },
          ...overageEvidence,
          ...(atCliff
            ? [{ label: 'Modeled premium tax credit at stake', value: formatEvidenceUsd(aca.modeledAllowablePtc ?? 0), year: year.year }]
            : []),
        ],
        plannerRoute: 'optimize',
        action: { kind: 'advisory' },
      }
    }

    return null
  },
}
