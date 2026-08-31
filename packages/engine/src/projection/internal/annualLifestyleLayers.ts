/**
 * Resolve the recurring lifestyle layers for one annual simulation pass.
 *
 * Phase order is load-bearing: phases are stably sorted by `fromAge`, then
 * every eligible row overwrites the multiplier, so equal-age phases retain
 * plan order and the last eligible row wins. The caller's array is not sorted
 * in place. ABW likewise preserves the original balance-order, left-associated
 * opening-portfolio fold, including duplicate account ids.
 */
import type { ExpensePlan } from '../../model/plan.js'
import { abwAnnualPayment } from '../../spending/abw.js'
import {
  splitAnnualSpendingLayers,
  type AnnualSpendingLayers,
} from '../../spending/layers.js'

export interface AnnualLifestyleBalance {
  readonly account: { readonly id: string }
}

export interface AnnualLifestyleLayersInput {
  readonly expenses: Readonly<ExpensePlan>
  readonly primaryAge: number
  readonly peopleStateCount: number
  readonly aliveCount: number
  readonly anyAlive: boolean
  readonly inflFactor: number
  readonly abwActive: boolean
  readonly abwRealReturnPct: number
  readonly abwTiltPct: number
  readonly abwHorizonYear: number
  readonly year: number
  readonly balances: readonly AnnualLifestyleBalance[]
  readonly startOfYearBalance: ReadonlyMap<string, number>
}

/** Build one eager, fresh lifestyle result without mutating any input. */
export function annualLifestyleLayers(
  input: AnnualLifestyleLayersInput,
): AnnualSpendingLayers {
  const {
    expenses,
    primaryAge,
    peopleStateCount,
    aliveCount,
    anyAlive,
    inflFactor,
    abwActive,
    abwRealReturnPct,
    abwTiltPct,
    abwHorizonYear,
    year,
    balances,
    startOfYearBalance,
  } = input

  let phaseMultiplier = 1
  for (const phase of [...expenses.phases].sort((a, b) => a.fromAge - b.fromAge)) {
    if (primaryAge >= phase.fromAge) phaseMultiplier = phase.multiplier
  }
  const survivorSpendingFactor =
    peopleStateCount > 1 && aliveCount === 1
      ? (expenses.survivorSpendingPct ?? 100) / 100
      : 1
  const lifestyleScale = anyAlive
    ? inflFactor * phaseMultiplier * survivorSpendingFactor
    : 0
  let scaledTargetLifestyle = expenses.baseAnnual * lifestyleScale
  const requiredAnnualToday = Math.min(
    expenses.requiredAnnual ?? expenses.baseAnnual,
    expenses.baseAnnual,
  )
  let requiredLifestyleNominal = requiredAnnualToday * lifestyleScale
  let idealLifestyleNominal = (expenses.idealAnnual ?? 0) * lifestyleScale
  let excessLifestyleNominal = (expenses.excessAnnual ?? 0) * lifestyleScale

  if (abwActive) {
    let startPortfolio = 0
    for (const balance of balances) {
      startPortfolio += startOfYearBalance.get(balance.account.id) ?? 0
    }
    scaledTargetLifestyle = anyAlive
      ? abwAnnualPayment(
          startPortfolio,
          abwRealReturnPct,
          abwTiltPct,
          abwHorizonYear - year + 1,
        )
      : 0
    requiredLifestyleNominal = 0
    idealLifestyleNominal = 0
    excessLifestyleNominal = 0
  }

  return splitAnnualSpendingLayers({
    baseAnnualNominal: scaledTargetLifestyle,
    requiredAnnualNominal: requiredLifestyleNominal,
    idealAnnualNominal: idealLifestyleNominal,
    excessAnnualNominal: excessLifestyleNominal,
  })
}
