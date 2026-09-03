import { formatGroupedNumber, formatWholeUsd } from '../../internal/evidenceFormat.js'
import type { Detector, DetectorContext } from '../types.js'
import { irmaaTierForMagi, irmaaTierThreshold } from '../../params/index.js'
import { medicareAnnualPremiumPerPerson } from '../../tax/medicare.js'

function inflationScaleFromPack(ctx: DetectorContext, toYear: number): number {
  if (toYear <= ctx.params.year) return 1
  return Math.pow(1 + ctx.plan.assumptions.inflationPct / 100, toYear - ctx.params.year)
}

function healthcarePremiumScaleFromPack(ctx: DetectorContext, toYear: number): number {
  if (toYear <= ctx.params.year) return 1
  const annualRate =
    1 + (ctx.plan.assumptions.inflationPct + ctx.plan.assumptions.healthcareExtraInflationPct) / 100
  return Math.pow(annualRate, toYear - ctx.params.year)
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
      // The premium year travels with the inflation path rather than as a
      // pre-multiplied factor, because the top IRMAA row indexes from a
      // different base year than the rows beneath it. Multiplying magiOver by
      // one factor here, which is what this detector used to do, moved a
      // boundary that 42 USC 1395r(i)(5)(C) holds still through 2027.
      const thresholdYear = {
        premiumYear: premiumYearNumber,
        inflationFactorToYear: (year: number): number => inflationScaleFromPack(ctx, year),
      }
      const tier = irmaaTierForMagi(ctx.params, y.magi, filingStatus, thresholdYear)
      if (tier > 0 && tier <= ctx.params.medicare.irmaaTiers.length) {
        const threshold = irmaaTierThreshold(ctx.params, tier - 1, filingStatus, thresholdYear)
        const diff = y.magi - threshold
        if (diff > 0 && diff <= 5000) {
          const magiStr = formatWholeUsd(y.magi)
          const threshStr = formatWholeUsd(threshold)
          const premiumYear = ctx.projection.result.years.find((candidate) => candidate.year === premiumYearNumber)
          if (!premiumYear) continue
          const medicarePeople = premiumYear.people.filter((p) => p.alive && p.ageAttained >= 65).length
          if (medicarePeople === 0) continue
          const premiumScale = healthcarePremiumScaleFromPack(ctx, premiumYearNumber)
          const premiumAbove = medicareAnnualPremiumPerPerson(
            ctx.params,
            y.magi,
            filingStatus,
            thresholdYear,
            premiumScale,
          )
          const premiumBelow = medicareAnnualPremiumPerPerson(
            ctx.params,
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
