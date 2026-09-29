import { formatGroupedNumber, formatWholeUsd } from '../../internal/evidenceFormat.js'
import type { Detector, DetectorContext } from '../types.js'
import { componentPackView, irmaaTierForMagi, irmaaTierThreshold, packForYear } from '../../params/index.js'
import type { ParameterPack } from '../../params/types.js'
import { medicareAnnualPremiumPerPerson } from '../../tax/medicare.js'

/**
 * The Medicare figures a premium year is priced on, as the ledger's expense
 * assembly reads them (`projection/simulate.ts`): the CMS component's view,
 * whose `year` is the latest year CMS's figures are loaded for. The
 * thresholds and the Part B premium grow from that year, not from the base
 * pack's (decision D-2027-ROLLOVER, PR #768 review issue 1): once CMS's
 * figures for a year are loaded they are used as they are.
 */
function medicareFiguresFor(premiumYear: number): ParameterPack {
  return componentPackView(packForYear(premiumYear), 'cmsMedicare')
}

/** The plan's general inflation from one year to a later one; 1 when `toYear` is not later. */
function inflationScaleBetween(ctx: DetectorContext, fromYear: number, toYear: number): number {
  if (toYear <= fromYear) return 1
  return Math.pow(1 + ctx.plan.assumptions.inflationPct / 100, toYear - fromYear)
}

function healthcarePremiumScaleFrom(ctx: DetectorContext, fromYear: number, toYear: number): number {
  if (toYear <= fromYear) return 1
  const annualRate =
    1 + (ctx.plan.assumptions.inflationPct + ctx.plan.assumptions.healthcareExtraInflationPct) / 100
  return Math.pow(annualRate, toYear - fromYear)
}

function trimmedConversionPatch(ctx: DetectorContext, year: number, trimAmount: number) {
  const conversions = ctx.projection.result.years
    .map((projectionYear) => ({
      year: projectionYear.year,
      amount: Math.max(0, projectionYear.rothConversion - (projectionYear.year === year ? trimAmount : 0)),
    }))
    .filter((conversion) => conversion.amount > 1)

  return {
    strategies: {
      rothConversion: {
        mode: 'manual',
        conversions,
      },
    },
  }
}

export const irmaaTierEdge: Detector = {
  id: 'irmaa-tier-edge',
  category: 'tax-brackets',
  version: 1,
  screen(ctx) {
    const filingStatus = ctx.plan.household.filingStatus

    // Scan years for an IRMAA cliff proximity
    for (const y of ctx.projection.result.years) {
      const premiumYearNumber = y.year + 2
      const medicare = medicareFiguresFor(premiumYearNumber)
      // The premium year travels with the inflation path rather than as a
      // pre-multiplied factor, because the top IRMAA row indexes from a
      // different base year than the rows beneath it. Multiplying magiOver by
      // one factor here, which is what this detector used to do, moved a
      // boundary that 42 USC 1395r(i)(5)(C) holds still through 2027.
      const thresholdYear = {
        premiumYear: premiumYearNumber,
        inflationFactorToYear: (year: number): number => inflationScaleBetween(ctx, medicare.year, year),
        inflationFactorBetween: (fromYear: number, toYear: number): number =>
          inflationScaleBetween(ctx, fromYear, toYear),
      }
      const tier = irmaaTierForMagi(medicare, y.magi, filingStatus, thresholdYear)
      if (tier > 0 && tier <= medicare.medicare.irmaaTiers.length) {
        const threshold = irmaaTierThreshold(medicare, tier - 1, filingStatus, thresholdYear)
        const diff = y.magi - threshold
        if (diff > 0 && diff <= 5000) {
          const magiStr = formatWholeUsd(y.magi)
          const threshStr = formatWholeUsd(threshold)
          const premiumYear = ctx.projection.result.years.find((candidate) => candidate.year === premiumYearNumber)
          if (!premiumYear) continue
          const medicarePeople = premiumYear.people.filter((p) => p.alive && p.ageAttained >= 65).length
          if (medicarePeople === 0) continue
          const premiumScale = healthcarePremiumScaleFrom(ctx, medicare.year, premiumYearNumber)
          const premiumAbove = medicareAnnualPremiumPerPerson(
            medicare,
            y.magi,
            filingStatus,
            thresholdYear,
            premiumScale,
          )
          const premiumBelow = medicareAnnualPremiumPerPerson(
            medicare,
            Math.max(0, threshold - 1),
            filingStatus,
            thresholdYear,
            premiumScale,
          )
          const annualPremiumCliff =
            medicarePeople *
            Math.max(
              0,
              premiumAbove.partBAnnual +
                premiumAbove.partDSurchargeAnnual -
                premiumBelow.partBAnnual -
                premiumBelow.partDSurchargeAnnual,
            )
          const trimAmount = Math.ceil(diff + 250)
          const conversionDriven = y.rothConversion > trimAmount

          return {
            id: 'irmaa-tier-edge',
            category: 'tax-brackets',
            title: 'IRMAA tier-edge proximity',
            rationale: `Your nominal MAGI of ${magiStr} in ${y.year} is just over the ${premiumYearNumber} IRMAA tier threshold of ${threshStr}. This will trigger higher Medicare premiums in ${premiumYearNumber}.`,
            impact: {
              endingAfterTaxEstateDelta: annualPremiumCliff > 0 ? annualPremiumCliff : undefined,
              qualitative:
                annualPremiumCliff > 0
                  ? `Avoiding this tier could save roughly ${formatWholeUsd(annualPremiumCliff)} of Medicare premiums in ${premiumYearNumber}.`
                  : 'Limit conversion-driven nominal MAGI to stay just under the IRMAA threshold.',
            },
            exact: false,
            confidence: 'high',
            severity: 'attention',
            evidence: [
              { label: `Nominal MAGI in ${y.year}`, value: magiStr, year: y.year },
              { label: `IRMAA tier threshold (${premiumYearNumber} premiums)`, value: threshStr, year: premiumYearNumber },
              { label: 'Amount over threshold', value: `$${formatGroupedNumber(Math.ceil(diff))}`, year: y.year },
              { label: `Medicare premium cliff in ${premiumYearNumber}`, value: formatWholeUsd(annualPremiumCliff), year: premiumYearNumber },
            ],
            learnSlug: 'irmaa-two-year-lookback',
            plannerRoute: 'optimize',
            action: conversionDriven
              ? {
                  kind: 'preview-scenario',
                  scenarioName: 'Trim conversion below IRMAA tier',
                  patch: trimmedConversionPatch(ctx, y.year, trimAmount),
                }
              : {
                  kind: 'advisory',
                },
          }
        }
      }
    }

    return null
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) {
      throw new Error('IRMAA tier edge not eligible')
    }
    return {
      action: card.action,
      impact: card.impact,
    }
  },
}
