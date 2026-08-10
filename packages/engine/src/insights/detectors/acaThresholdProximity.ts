import type { Detector, InsightCard } from '../types.js'
import { packForYear } from '../../params/index.js'

function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
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
        aca.modeledAllowablePtc > 0
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
          'Reducing MAGI below it can restore the modeled premium tax credit; review income and conversion timing before the year closes.'
        : `Household MAGI is exactly at the ${boundary}% FPL ACA credit boundary in ${year.year}. ` +
          'A small increase can eliminate the modeled premium tax credit, so review income and conversion timing before the year closes.'

      return {
        id: 'aca-threshold-proximity',
        category: 'tax-brackets',
        title: `ACA credit threshold proximity in ${year.year}`,
        rationale,
        impact: {
          qualitative: justOverBoundary
            ? 'A small MAGI reduction may restore Marketplace premium-tax-credit eligibility.'
            : 'A small MAGI increase would eliminate the modeled premium tax credit; there is no headroom at the boundary.',
        },
        exact: false,
        confidence: 'medium',
        severity: 'attention',
        evidence: [
          { label: `Household MAGI in ${year.year}`, value: usd(aca.householdMagi), year: year.year },
          { label: `Federal poverty line in ${year.year}`, value: usd(aca.federalPovertyLine), year: year.year },
          { label: `FPL percentage in ${year.year}`, value: `${aca.fplPct.toFixed(1)}%`, year: year.year },
          { label: 'ACA credit boundary', value: `${boundary.toFixed(1)}%` },
          ...(atCliff
            ? [{ label: 'Modeled premium tax credit at stake', value: usd(aca.modeledAllowablePtc ?? 0), year: year.year }]
            : []),
        ],
        plannerRoute: 'optimize',
        action: { kind: 'advisory' },
      }
    }

    return null
  },
}
