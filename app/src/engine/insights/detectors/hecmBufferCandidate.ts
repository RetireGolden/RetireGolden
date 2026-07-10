import type { Detector, InsightCard } from '../types'
import type { Account } from '../../model/plan'
import { hecmPrincipalLimitFactorPct } from '../../params'

/**
 * "House-rich, portfolio-thin: a HECM line of credit could buffer sequence
 * risk" (annuity-pension-and-home-equity, step 5). Fires when a primary
 * residence's value rivals the investable portfolio, the youngest borrower is
 * 62+, and no HECM is modeled. Pfau's research: opening the line early and
 * drawing after down years lets the portfolio recover — the line's unused
 * credit grows regardless of home value. The action previews a coordinated
 * line as a scenario; deterministic runs price only the last-resort backstop,
 * so the Monte Carlo comparison is where the coordinated policy shows up.
 */
export const hecmBufferCandidate: Detector = {
  id: 'hecm-buffer-candidate',
  category: 'longevity-insurance-geography',
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    const startYear = ctx.projection.startYear
    if (plan.household.people.length === 0) return null
    const youngestAge = Math.min(...plan.household.people.map((p) => startYear - Number(p.dob.slice(0, 4))))
    if (youngestAge < 62) return null

    const home = plan.accounts.find(
      (a): a is Extract<Account, { type: 'property' }> =>
        a.type === 'property' && a.primaryResidence === true && a.hecm === undefined && a.value > 100_000 &&
        // A planned sale makes the buffer moot (the line closes at sale).
        (a.plannedSaleYear === null || a.plannedSaleYear === undefined),
    )
    if (!home) return null

    let investable = 0
    for (const a of plan.accounts) {
      if (
        a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp' ||
        a.type === 'traditional' || a.type === 'roth' || a.type === 'hsa'
      ) {
        investable += 'balance' in a ? a.balance : 0
      }
    }
    // House-rich / portfolio-thin: the home is a major share of net worth.
    if (investable <= 0 || home.value < investable * 0.75) return null

    const pack = ctx.params
    const plfPct = hecmPrincipalLimitFactorPct(pack, youngestAge)
    const lineSize = (plfPct / 100) * home.value
    const patchedHome = {
      ...home,
      hecm: {
        openYear: startYear,
        growthRatePct: pack.hecm.defaultGrowthRatePct,
        drawPolicy: 'coordinated' as const,
      },
    }

    return {
      id: 'hecm-buffer-candidate',
      category: 'longevity-insurance-geography',
      title: 'Your home equity could backstop market downturns',
      rationale:
        `${home.name} (~$${Math.round(home.value).toLocaleString()}) rivals your $${Math.round(investable).toLocaleString()} portfolio. ` +
        `A HECM line of credit opened now would start near $${Math.round(lineSize).toLocaleString()} (${plfPct.toFixed(1)}% of value at age ${youngestAge}, published factor tables) ` +
        `and grow ~${pack.hecm.defaultGrowthRatePct}%/yr regardless of home value. Drawing tax-free after down years — instead of selling depressed assets — is the coordinated buffer strategy; ` +
        'costs are real (financed fees, a growing loan) and the loan is repaid from the home, non-recourse.',
      impact: {
        qualitative:
          'Preview the line against your full plan (best seen on the Monte Carlo page, where down-year draws actually trigger): steadier bad-path spending at the cost of home equity in the estate.',
      },
      exact: false,
      confidence: 'medium',
      plannerRoute: 'accounts',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Open a HECM line of credit (coordinated draws)',
        patch: { accounts: plan.accounts.map((a) => (a.id === home.id ? patchedHome : a)) },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('HECM buffer not eligible')
    return { action: card.action, impact: card.impact }
  },
}
