/**
 * Standard deterministic planner tax stack.
 *
 * Kept outside React so browser-free scenario builders, workers, and planner
 * views can price bounded ledger probes exactly like the full comparison.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'

export function taxCalculatorFor(plan: Plan) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}
