/**
 * Probabilistic long-term-care shock for Monte Carlo (roadmap V6 §4).
 *
 * Each path may draw a paid-care episode per person — incidence, onset age, and
 * duration — so an LTC policy's risk reduction shows up in the success-rate and
 * ending-balance distribution, not just the single deterministic "LTC stress"
 * what-if. The sampled episode is injected as a plan careEvent, so the existing
 * engine offset (monthly cap × inflation rider, elimination period, benefit
 * period) applies unchanged.
 *
 * Default distribution (planning precision, editable in the UI):
 *  - incidence: ~50% of people 65+ need a significant period of *paid* LTSS
 *    (HHS/ASPE, "Long-Term Services and Supports for Older Americans").
 *  - duration: right-skewed — most need <2 years, a meaningful tail needs 5+.
 *  - annual cost: ~$75k, near the national median for assisted living / a year
 *    of substantial home care (Genworth Cost of Care survey range).
 */

import type { CareEvent } from '../model/plan'
import type { Rng } from './rng'

export interface LtcShockParams {
  /** Probability a person experiences a paid-care episode in late life. */
  incidence: number
  /** Onset age sampled uniformly in [minOnsetAge, maxOnsetAge]. */
  minOnsetAge: number
  maxOnsetAge: number
  /** Discrete duration distribution (years → relative weight). */
  durations: ReadonlyArray<{ years: number; weight: number }>
  /** Annual care cost, today's dollars. */
  annualCost: number
}

export const DEFAULT_LTC_SHOCK: LtcShockParams = {
  incidence: 0.5,
  minOnsetAge: 80,
  maxOnsetAge: 90,
  durations: [
    { years: 1, weight: 0.3 },
    { years: 2, weight: 0.3 },
    { years: 3, weight: 0.2 },
    { years: 5, weight: 0.15 },
    { years: 8, weight: 0.05 },
  ],
  annualCost: 75_000,
}

function pickDuration(rng: Rng, durations: LtcShockParams['durations']): number {
  const total = durations.reduce((sum, d) => sum + d.weight, 0)
  let r = rng.next() * total
  for (const d of durations) {
    r -= d.weight
    if (r <= 0) return d.years
  }
  return durations[durations.length - 1]?.years ?? 1
}

/**
 * Sample zero or one care episode per person for one path. Onset is clamped to
 * be no earlier than the person's current age so the spike lands in the future.
 */
export function sampleCareEvents(rng: Rng, people: ReadonlyArray<{ id: string; dob: string }>, startYear: number, params: LtcShockParams): CareEvent[] {
  const events: CareEvent[] = []
  for (const p of people) {
    if (rng.next() >= params.incidence) continue
    const span = Math.max(0, params.maxOnsetAge - params.minOnsetAge)
    const currentAge = startYear - Number(p.dob.slice(0, 4))
    const startAge = Math.max(currentAge, params.minOnsetAge + rng.nextInt(span + 1))
    events.push({
      id: `ltc-shock-${p.id}`,
      personId: p.id,
      startAge,
      durationYears: pickDuration(rng, params.durations),
      annualCost: params.annualCost,
    })
  }
  return events
}
