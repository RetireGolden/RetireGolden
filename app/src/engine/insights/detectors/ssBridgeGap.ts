import type { Detector, InsightCard } from '../types'
import { EMBEDDED_REAL_YIELD_CURVE } from '../../params'
import { BRIDGE_FUNDING_MIN_FRACTION, sizeBridge } from '../../ladder/bridge'
import type { TipsLadder } from '../../model/plan'

/**
 * "Your gap years are unfunded — consider a bridge"
 * (social-security-bridge-and-tips-ladder, step 4). Fires when someone delays
 * Social Security past retirement with no TIPS ladder covering the gap years,
 * and liquid savings could fund one. The action previews the sized bridge as
 * a scenario, so the ledger (not the card) prices it.
 */
export const ssBridgeGap: Detector = {
  id: 'ss-bridge-gap',
  category: 'social-security',
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    const startYear = ctx.projection.startYear

    const liquid = plan.accounts
      .filter((a) => a.type === 'cash' || a.type === 'taxable')
      .sort((a, b) => ('balance' in b ? b.balance : 0) - ('balance' in a ? a.balance : 0))[0]
    if (!liquid || !('balance' in liquid)) return null

    const ladders: TipsLadder[] = []
    let totalCost = 0
    let firstYear = Number.POSITIVE_INFINITY
    let lastYear = 0
    let annualTotal = 0
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity' || stream.piaMonthly === null || stream.piaMonthly <= 0) continue
      const person = plan.household.people.find((p) => p.id === stream.personId)
      if (!person) continue
      const dobYear = Number(person.dob.slice(0, 4))
      const sized = sizeBridge({
        piaMonthly: stream.piaMonthly,
        dob: { year: dobYear, month: Number(person.dob.slice(5, 7)), day: Number(person.dob.slice(8, 10)) },
        claimAge: stream.claimAge,
        currentYear: startYear,
        retirementYear: person.retirementAge !== null ? dobYear + person.retirementAge : startYear,
        curve: EMBEDDED_REAL_YIELD_CURVE,
      })
      if (!sized) continue
      const covered = plan.incomeFloor?.ladders.some((l) => l.startYear <= sized.startYear && l.endYear >= sized.endYear)
      if (covered) continue
      totalCost += sized.ladderCost
      firstYear = Math.min(firstYear, sized.startYear)
      lastYear = Math.max(lastYear, sized.endYear)
      annualTotal += sized.annualRealAmount
      ladders.push({
        id: `ss-bridge-preview-${stream.personId}`,
        name: `SS bridge (${person.name})`,
        purpose: 'bridge',
        startYear: sized.startYear,
        endYear: sized.endYear,
        annualRealAmount: sized.annualRealAmount,
        purchase: { year: startYear, fundingAccountId: liquid.id },
      })
    }
    if (ladders.length === 0) return null
    // Don't suggest a bridge the plan clearly cannot buy (shared threshold).
    if (liquid.balance < totalCost * BRIDGE_FUNDING_MIN_FRACTION) return null

    return {
      id: 'ss-bridge-gap',
      category: 'social-security',
      title: 'Fund your Social Security gap years with a bridge',
      rationale:
        `You delay Social Security but retire earlier, leaving ${firstYear}–${lastYear} without your benefit. ` +
        `A TIPS bridge ladder (≈$${Math.round(totalCost).toLocaleString()} today) pays you the forgone age-62 benefit ` +
        `(~$${Math.round(annualTotal).toLocaleString()}/yr, inflation-protected) until your claim starts — the delayed claim's longevity insurance without the lifestyle gap.`,
      impact: {
        qualitative:
          'Preview the bridge against your full plan: guaranteed gap-year income and steadier withdrawals, at the cost of locking up liquid savings.',
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'social-security-bridge',
      plannerRoute: 'income-floor',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Add a Social Security bridge ladder',
        patch: { incomeFloor: { ladders: [...(plan.incomeFloor?.ladders ?? []), ...ladders] } },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('SS bridge gap not eligible')
    return { action: card.action, impact: card.impact }
  },
}
