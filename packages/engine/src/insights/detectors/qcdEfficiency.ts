import type { Detector } from '../types.js'

export const qcdEfficiency: Detector = {
  id: 'qcd-efficiency',
  category: 'withdrawals-charitable',
  screen(ctx) {
    const charitable = ctx.plan.strategies.itemizedDeductions?.charitable ?? 0
    if (charitable <= 0) {
      return null
    }

    if (ctx.plan.strategies.qcdAnnual >= charitable) {
      return null
    }

    const firstYear = ctx.projection.result.years[0]
    if (!firstYear) {
      return null
    }

    // Check if anyone is age-eligible (age attained 71+ in the start year)
    const hasAgeEligible = firstYear.people.some((p) => p.alive && p.ageAttained >= 71)
    if (!hasAgeEligible) {
      return null
    }

    // Check if they have traditional assets to donate from
    const hasTrad = ctx.plan.accounts.some((a) => a.type === 'traditional' && (firstYear.balances[a.id] ?? 0) > 0)
    if (!hasTrad) {
      return null
    }

    const charitableStr = '$' + Math.round(charitable).toLocaleString()

    return {
      id: 'qcd-efficiency',
      category: 'withdrawals-charitable',
      title: 'Compare QCDs for your charitable giving',
      rationale: `You are donating ${charitableStr} per year without Qualified Charitable Distributions (QCDs). Since you are over 70½, the model prices donations routed directly from your pre-tax IRA as more tax-efficient — preview the difference as a scenario.`,
      impact: { qualitative: 'Previews donating pre-tax IRA assets directly to charity, which counts toward RMDs and lowers modeled taxable income.' },
      exact: false,
      confidence: 'high',
      learnSlug: 'qcds-qualified-charitable-distributions',
      plannerRoute: 'strategy',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Donations routed as QCDs',
        patch: {
          strategies: {
            qcdAnnual: charitable,
            itemizedDeductions: {
              ...ctx.plan.strategies.itemizedDeductions,
              charitable: 0,
            },
          },
        },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) {
      throw new Error('QCD efficiency not eligible')
    }
    return {
      action: card.action,
      impact: card.impact,
    }
  },
}
