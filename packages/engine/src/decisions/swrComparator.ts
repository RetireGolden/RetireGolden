/**
 * "Whose 4% rule?" comparator (spending-paths & SWR-lenses plan, Goal 3).
 *
 * Runs the currently-argued published safe-withdrawal-rate parameterizations
 * on the user's own plan — not a generic 60/40 backtest — through the same
 * deterministic exact ledger Results uses, so every rule prices taxes, ACA/
 * IRMAA cliffs, healthcare, debts, and survivor years identically (same-path
 * by construction). Presented as "published rules of thumb vs this plan's
 * solver": each rule sets a constant-real initial spending level from the
 * starting investable balance, which is the rules' own definition; none of
 * them is "the answer" — the plan's solver is the plan-specific number.
 *
 * Parameterizations (each per its citation):
 * - Bengen 2025: 4.7% — William Bengen, *A Richer Retirement* (Aug 2025);
 *   SAFEMAX raised from 4.15% to ~4.7% with a seven-asset-class portfolio.
 * - Morningstar 2026: 3.9% — Morningstar's *State of Retirement Income*
 *   (2025 edition, for 2026 retirees; 30-year horizon, 90% success).
 * - ERN CAPE: 1.75% + 0.5 × CAEY — Early Retirement Now's CAPE-based rule
 *   (SWR series part 18), CAEY = 100/CAPE; conditions the rate on valuations.
 */

import type { Plan } from '../model/plan.js'
import { startingInvestableOf } from '../montecarlo/riskBasedGuardrails.js'
import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan, type SimulateOptions } from '../projection/simulate.js'

export type SwrRuleId = 'bengen-2025' | 'morningstar-2026' | 'ern-cape'

/** Default CAPE for the ERN rule; matches the CAPE market-model default. */
export const SWR_DEFAULT_CAPE = 25

export interface SwrRuleSpec {
  id: SwrRuleId
  label: string
  /** One-line source citation shown with the number. */
  citation: string
  initialRatePct: (cape: number) => number
}

export const SWR_RULES: readonly SwrRuleSpec[] = [
  {
    id: 'bengen-2025',
    label: 'Bengen 4.7%',
    citation: 'William Bengen, A Richer Retirement (2025): SAFEMAX ≈ 4.7% with seven asset classes, 30-year horizon.',
    initialRatePct: () => 4.7,
  },
  {
    id: 'morningstar-2026',
    label: 'Morningstar 3.9%',
    citation: 'Morningstar, State of Retirement Income (2025, for 2026 retirees): 3.9% starting rate, 30 years, 90% success.',
    initialRatePct: () => 3.9,
  },
  {
    id: 'ern-cape',
    label: 'ERN CAPE rule',
    citation: 'Early Retirement Now, SWR series part 18: SWR = 1.75% + 0.5 × (100 ÷ CAPE).',
    initialRatePct: (cape) => 1.75 + 0.5 * (100 / cape),
  },
]

export interface SwrRuleResult {
  id: SwrRuleId
  label: string
  citation: string
  initialRatePct: number
  /** rate × starting investable balance — the rule's spending level (today's $). */
  initialAnnualSpend: number
  /** Exact-ledger outcome of spending that level constant-real on this plan. */
  depletionYear: number | null
  endYear: number
  endingAfterTaxEstate: number
  lifetimeTaxesAndPenalties: number
}

/**
 * Price every published rule on the user's plan with one deterministic ledger
 * run each. The variant plan spends the rule's level constant-real (phases
 * cleared — the rules are defined constant-real) with any dynamic spending
 * policy removed; everything else (accounts, taxes, healthcare, goals,
 * horizon) is the user's own.
 */
export function compareSwrRules(
  plan: Plan,
  opts: SimulateOptions,
  cape: number = SWR_DEFAULT_CAPE,
): SwrRuleResult[] {
  const startingInvestable = startingInvestableOf(plan)
  return SWR_RULES.map((rule) => {
    const ratePct = rule.initialRatePct(cape)
    const initialAnnualSpend = (ratePct / 100) * startingInvestable
    const variant: Plan = {
      ...plan,
      expenses: {
        ...plan.expenses,
        baseAnnual: initialAnnualSpend,
        phases: [],
        spendingPolicy: undefined,
        // The annual upside layers fund on top of baseAnnual in fixed-target
        // mode; a rule advertised as spending exactly rate × portfolio must
        // not inherit them or it simulates rule + upside and reads worse.
        // requiredAnnual is cleared too: it never adds spending, but clearing
        // it makes the variant's lifestyle stack exactly the rule level.
        idealAnnual: undefined,
        excessAnnual: undefined,
        requiredAnnual: undefined,
      },
    }
    const result = simulatePlan(variant, opts)
    const summary = summarizeProjection(variant, result)
    return {
      id: rule.id,
      label: rule.label,
      citation: rule.citation,
      initialRatePct: ratePct,
      initialAnnualSpend,
      depletionYear: summary.depletionYear,
      endYear: result.endYear,
      endingAfterTaxEstate: summary.endingAfterTaxEstate,
      lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
    }
  })
}
