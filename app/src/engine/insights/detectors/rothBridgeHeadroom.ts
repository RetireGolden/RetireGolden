import type { Detector } from '../types'

export const rothBridgeHeadroom: Detector = {
  id: 'roth-bridge-headroom',
  category: 'tax-brackets',
  screen(ctx) {
    if (ctx.plan.strategies.rothConversion.mode !== 'none') {
      return null
    }

    // Check if the plan has owner-convertible traditional balance. Inherited
    // traditional accounts follow beneficiary distribution rules and cannot be
    // converted into the beneficiary's Roth IRA.
    const tradBalance = ctx.plan.accounts
      .filter((a) => a.type === 'traditional' && !a.inherited)
      .reduce((sum, a) => sum + (ctx.projection.result.years[0]?.balances[a.id] ?? 0), 0)

    if (tradBalance < 10000) {
      return null
    }

    // Find bridge years
    let firstYear: number | null = null
    let lastYear: number | null = null

    for (const y of ctx.projection.result.years) {
      const allRetired = y.incomes.wages < 10000
      const anyPreRmd = y.people.some((p) => p.alive && p.ageAttained < 73)
      const hasTradFunds = ctx.plan.accounts
        .filter((a) => a.type === 'traditional' && !a.inherited)
        .reduce((sum, a) => sum + (y.balances[a.id] ?? 0), 0) > 10000

      if (allRetired && anyPreRmd && hasTradFunds) {
        if (firstYear === null) {
          firstYear = y.year
        }
        lastYear = y.year
      } else if (firstYear !== null) {
        // Contiguous block complete
        break
      }
    }

    if (firstYear === null || lastYear === null) {
      return null
    }

    return {
      id: 'roth-bridge-headroom',
      category: 'tax-brackets',
      title: 'Test Roth conversion bridge years',
      rationale: `You have low-income bridge years from ${firstYear} to ${lastYear} before RMDs begin. A bracket-fill Roth conversion scenario is worth previewing against your full projection before treating it as a recommendation.`,
      impact: { qualitative: 'Preview a lower-bracket conversion scenario; taxes, healthcare cliffs, and liquidity can still make it unattractive.' },
      exact: false,
      confidence: 'medium',
      learnSlug: 'roth-conversion-basics',
      plannerRoute: 'strategy',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Convert to top of 12% bracket',
        patch: {
          strategies: {
            rothConversion: {
              mode: 'fillToTarget',
              target: 'topOfBracket',
              targetValue: 12,
              startYear: firstYear,
              endYear: lastYear,
            },
          },
        },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) {
      throw new Error('Roth bridge headroom not eligible')
    }
    return {
      action: card.action,
      impact: card.impact,
    }
  },
}
