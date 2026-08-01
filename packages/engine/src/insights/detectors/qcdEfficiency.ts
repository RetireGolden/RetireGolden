import type { Detector } from '../types.js'

export const QCD_EFFICIENCY_EXPLORATORY_REASON =
  'This calculation-only QCD preview does not identify a donor, eligible owned IRA, execution date, charity designation, or complete eligibility evidence.'

export function qcdEfficiencyRationale(charitable: number): string {
  const charitableStr = '$' + Math.round(charitable).toLocaleString('en-US')
  return `You are donating ${charitableStr} per year outside a QCD. The model can price an exploratory QCD comparison, but it cannot call the transfer implementation-ready until a donor, eligible owned IRA, exact execution date, charity designation, and complete eligibility evidence are supplied.`
}

export const qcdEfficiency: Detector = {
  id: 'qcd-efficiency',
  category: 'withdrawals-charitable',
  screen(ctx) {
    const charitable = ctx.plan.strategies.itemizedDeductions?.charitable ?? 0
    if (charitable <= 0) return null
    if (ctx.plan.strategies.qcdAnnual >= charitable) return null
    const qcdTargetYears = ctx.projection.result.years.map((year) => year.year)
    if (
      qcdTargetYears.length === 0 ||
      qcdTargetYears.some((year, index) =>
        !Number.isSafeInteger(year) ||
        year < 1 ||
        (index > 0 && year <= qcdTargetYears[index - 1]!),
      )
    ) return null

    return {
      id: 'qcd-efficiency',
      category: 'withdrawals-charitable',
      title: 'Compare QCDs for your charitable giving',
      rationale: qcdEfficiencyRationale(charitable),
      impact: {
        qualitative: 'Previews donating pre-tax IRA assets directly to charity, which counts toward RMDs and lowers modeled taxable income.',
      },
      exact: false,
      confidence: 'medium',
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
        retirementActionReadiness: {
          state: 'exploratoryNonActionable',
          reason: QCD_EFFICIENCY_EXPLORATORY_REASON,
        },
        candidateMetadata: { qcdTargetYears },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('QCD efficiency not eligible')
    return { action: card.action, impact: card.impact }
  },
}
