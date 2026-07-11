/**
 * Spending-layer helpers (planning-depth roadmap §4). Pure functions the ledger
 * uses to split annual lifestyle spending into a required floor and a
 * discretionary layer, and to attribute a portfolio shortfall to the required
 * vs. target layers. Keeping these out of `simulate.ts` makes the layer math
 * unit-testable without running a full projection.
 *
 * System-computed costs (healthcare, debt service, property carrying costs,
 * insurance premiums, net long-term-care) are treated as required by the ledger
 * and are not modeled here; this file owns only the lifestyle split and the
 * shortfall attribution, which operate on the whole spending stack.
 */

export interface LifestyleSplit {
  /** Nominal required-floor lifestyle spending. */
  requiredLifestyle: number
  /** Nominal discretionary lifestyle spending (the layer a guardrail can cut). */
  discretionaryLifestyle: number
}

/**
 * Split a year's nominal lifestyle spending into required and discretionary
 * layers. The required floor is clamped to the target so the two layers always
 * sum back to `baseAnnualNominal` (the migrated fixed-target total).
 */
export function splitLifestyle(baseAnnualNominal: number, requiredAnnualNominal: number): LifestyleSplit {
  const requiredLifestyle = Math.min(Math.max(0, requiredAnnualNominal), Math.max(0, baseAnnualNominal))
  return {
    requiredLifestyle,
    discretionaryLifestyle: Math.max(0, baseAnnualNominal - requiredLifestyle),
  }
}

export interface AnnualSpendingLayers extends LifestyleSplit {
  /** Nominal target-lifestyle layer above the required floor. */
  targetLifestyle: number
  /** Nominal annual ideal layer above the target lifestyle. */
  idealLifestyle: number
  /** Nominal annual excess/opportunistic layer above ideal. */
  excessLifestyle: number
}

/**
 * Split annual lifestyle spending into the four modeled layers. `baseAnnual`
 * remains the target lifestyle for compatibility; ideal/excess are explicit
 * upside layers above that target and default to zero for older saved plans.
 */
export function splitAnnualSpendingLayers(input: {
  baseAnnualNominal: number
  requiredAnnualNominal: number
  idealAnnualNominal?: number
  excessAnnualNominal?: number
}): AnnualSpendingLayers {
  const { requiredLifestyle, discretionaryLifestyle } = splitLifestyle(
    input.baseAnnualNominal,
    input.requiredAnnualNominal,
  )
  return {
    requiredLifestyle,
    discretionaryLifestyle,
    targetLifestyle: discretionaryLifestyle,
    idealLifestyle: Math.max(0, input.idealAnnualNominal ?? 0),
    excessLifestyle: Math.max(0, input.excessAnnualNominal ?? 0),
  }
}

export interface ShortfallAttributionInput {
  /** Must-fund spending this year (system costs + required lifestyle + required goals). */
  requiredSpending: number
  /** Full target spending with no guardrail cut (required + target lifestyle/goals). */
  targetSpending: number
  /** Incremental ideal spending above the target lifestyle. */
  idealSpending?: number
  /** Incremental excess/opportunistic spending above ideal. */
  excessSpending?: number
  /** Spending actually attempted after any guardrail cut (`expenses.total`). */
  fundedSpending: number
  /** Dollars the withdrawal waterfall could not produce for the funded need. */
  withdrawalShortfall: number
}

export interface ShortfallAttribution {
  /** Required-floor spending the portfolio could not cover — the serious failure signal. */
  requiredShortfall: number
  /** Target-lifestyle miss: the guardrail's deliberate cut plus any shortfall that ate discretionary. */
  targetShortfall: number
  /** Ideal-layer miss after target spending has first claim on funded dollars. */
  idealShortfall: number
  /** Excess-layer miss after required, target, and ideal have first claim. */
  excessShortfall: number
}

/**
 * Attribute a portfolio shortfall across the spending layers.
 *
 * The target-lifestyle miss is a superset of the required-floor miss: it is
 * everything spent below the full target, i.e. the guardrail's deliberate
 * discretionary cut plus every dollar the portfolio could not produce.
 *
 * The required-floor miss is only the part of the withdrawal shortfall that eats
 * below the floor — a genuine shortfall is charged to funded discretionary
 * spending first and reaches the floor only once discretionary is exhausted — so
 * `requiredShortfall` stays a clean "ran out of money for essentials" signal.
 * Consequently `targetShortfall ≥ requiredShortfall` always.
 */
export function attributeShortfall(input: ShortfallAttributionInput): ShortfallAttribution {
  const requiredSpending = Math.max(0, input.requiredSpending)
  const targetSpending = Math.max(requiredSpending, input.targetSpending)
  const idealSpending = Math.max(0, input.idealSpending ?? 0)
  const excessSpending = Math.max(0, input.excessSpending ?? 0)
  const actualFunded = Math.max(0, input.fundedSpending - Math.max(0, input.withdrawalShortfall))
  const idealFunded = Math.max(0, Math.min(idealSpending, actualFunded - targetSpending))
  const excessFunded = Math.max(0, Math.min(excessSpending, actualFunded - targetSpending - idealSpending))
  return {
    requiredShortfall: Math.max(0, requiredSpending - actualFunded),
    targetShortfall: Math.max(0, targetSpending - actualFunded),
    idealShortfall: Math.max(0, idealSpending - idealFunded),
    excessShortfall: Math.max(0, excessSpending - excessFunded),
  }
}
