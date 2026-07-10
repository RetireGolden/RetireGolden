import type { Detector, DetectorContext } from '../types'
import { irmaaTierForMagi } from '../../params'
import { medicareAnnualPremiumPerPerson } from '../../tax/medicare'

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
  screen(ctx) {
    const filingStatus = ctx.plan.household.filingStatus

    // Scan years for an IRMAA cliff proximity
    for (const y of ctx.projection.result.years) {
      const premiumYearNumber = y.year + 2
      const thresholdScale = inflationScaleFromPack(ctx, premiumYearNumber)
      const tier = irmaaTierForMagi(ctx.params, y.magi, filingStatus, thresholdScale)
      if (tier > 0 && tier <= ctx.params.medicare.irmaaTiers.length) {
        const threshold = ctx.params.medicare.irmaaTiers[tier - 1]!.magiOver[filingStatus] * thresholdScale
        const diff = y.magi - threshold
        if (diff > 0 && diff <= 5000) {
          const magiStr = '$' + Math.round(y.magi).toLocaleString()
          const threshStr = '$' + Math.round(threshold).toLocaleString()
          const premiumYear = ctx.projection.result.years.find((candidate) => candidate.year === premiumYearNumber)
          if (!premiumYear) continue
          const medicarePeople = premiumYear.people.filter((p) => p.alive && p.ageAttained >= 65).length
          if (medicarePeople === 0) continue
          const premiumScale = healthcarePremiumScaleFromPack(ctx, premiumYearNumber)
          const premiumAbove = medicareAnnualPremiumPerPerson(
            ctx.params,
            y.magi,
            filingStatus,
            thresholdScale,
            premiumScale,
          )
          const premiumBelow = medicareAnnualPremiumPerPerson(
            ctx.params,
            Math.max(0, threshold - 1),
            filingStatus,
            thresholdScale,
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
                  ? `Avoiding this tier could save roughly $${Math.round(annualPremiumCliff).toLocaleString()} of Medicare premiums in ${premiumYearNumber}.`
                  : 'Limit conversion-driven nominal MAGI to stay just under the IRMAA threshold.',
            },
            exact: false,
            confidence: 'high',
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
