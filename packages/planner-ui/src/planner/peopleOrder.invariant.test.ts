/**
 * No figure a reader sees depends on the order a plan lists its people in, or
 * on what their ids are called (decision D-PEOPLE-ORDER, rule R8), on the 29
 * library examples as the app opens them. The engine's own invariant test
 * (engine/src/projection/peopleOrder.invariant.test.ts) runs the probe plans.
 *
 * Reversing `household.people` (every owner id, `phasesAgeOf` and
 * `contributionScheduleAgeOf` left as they are) leaves the parse outcome, the
 * whole ledger and summary (arrays keyed by id), the "How much can I spend?"
 * answer, the Social Security page's "Refine to the month" answer from the
 * current claims, and every Monte Carlo path in the headline, longevity and
 * care modes identical. Renaming every person id leaves the parse outcome,
 * the ledger, the summary and the spending answer identical once mapped back;
 * the Monte Carlo is held too, except where two people share a birth date and
 * a sex, the one case the canonical draw order settles by id.
 *
 * The surfaces that illustrate for one person, or publish one person's age,
 * are held the same way on the couples: every Insights card (the
 * annuitization illustration and the funded floor among them), the Monte
 * Carlo page's annuity sweep, the SPIA candidates, the funded-ratio card, and
 * the Compare page's headline comparison against another example.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { buildAnnuitizationSweep } from '@retiregolden/engine/decisions/annuitization'
import { createDecisionContext } from '@retiregolden/engine/decisions/evaluateCandidate'
import { annuityPurchaseGenerator } from '@retiregolden/engine/decisions/generators'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { runScreen } from '@retiregolden/engine/insights/runInsights'
import { computeFundedRatio, fundedRatioStart } from '@retiregolden/engine/ladder/fundedRatio'
import { EMBEDDED_REAL_YIELD_CURVE, packForYear } from '@retiregolden/engine/params'
import { toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { comparePlanHeadlines } from '@retiregolden/engine/scenarios/planHeadlines'
import { aggregateMonteCarlo } from '@retiregolden/engine/montecarlo/run'
import { DEFAULT_LTC_SHOCK } from '@retiregolden/engine/montecarlo/ltcShock'

import { runMcRequest } from '../mc/runRequest'
import { runSpendingSolveRequest } from '../optimize/runSpendingSolve'
import { taxCalculatorFor } from '../planTaxCalculator'
import { projectPlan } from '../projection'
import { appExamplePlans } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { estateSweep, refineFromClaims } from '../testSupport/refineFromClaims'
import { claimingPeople } from './ssAnalysis'
import { headlineMcRunOptions } from './useMcSuccessRate'

const START = EXAMPLE_FIXED_YEAR
const MC_PATHS = 20

const ID_KEYS = ['personId', 'id', 'accountId', 'streamId', 'incomeId', 'sourceAccountId', 'eventId', 'producerOccurrenceKey', 'ownerPersonId', 'key', 'year']
function canon(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canon)
    if (items.length > 0 && items.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) {
      for (const key of ID_KEYS) {
        const keys = items.map((x) => (x as Record<string, unknown>)[key])
        if (keys.every((k) => typeof k === 'string' || typeof k === 'number') && new Set(keys).size === keys.length) {
          return Object.fromEntries(
            items.map((x, i) => [`<${key}=${String(keys[i])}>`, x] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
          )
        }
      }
    }
    return items.map((x) => [JSON.stringify(x), x] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, x]) => x)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().filter((k) => (value as Record<string, unknown>)[k] !== undefined).map((k) => [k, canon((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}
const orderFree = (json: string): string => JSON.stringify(canon(JSON.parse(json)))
/**
 * The ledger's evidence ids are SHA-256 digests of content that includes the
 * person ids, so a renamed id gives a different digest and no different
 * figure. The rename comparison masks them; the reversal comparison does not
 * need to.
 */
const withoutDigests = (json: string): string => json.replace(/:[0-9a-f]{64}"/gu, ':<digest>"')

function reversed(plan: Plan): Plan {
  return { ...structuredClone(plan), household: { ...plan.household, people: [...plan.household.people].reverse() } }
}

/** Rename each person id everywhere it appears, inside other strings too. */
function rename(json: string, map: Record<string, string>): string {
  let out = json
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to)
  return out
}

function parseOutcome(plan: Plan): string {
  const parsed = parsePlan(plan)
  return parsed.ok ? 'ok' : parsed.issues.join(' | ')
}

/** The projection the Results page shows, as JSON before the order-free form. */
function projectionJson(plan: Plan): string {
  const view = projectPlan(plan, START)
  return JSON.stringify({ result: view.result, summary: view.summary })
}

function monteCarlo(plan: Plan, mode: 'headline' | 'longevity' | 'care') {
  const o = headlineMcRunOptions(plan, MC_PATHS, START)
  const run = runMcRequest({
    kind: 'monteCarlo', plan, startYear: START, seed: o.seed, model: o.model, pathCount: MC_PATHS, firstPathIndex: 0,
    progressEvery: MC_PATHS, stochasticLongevity: mode === 'longevity', ltcShock: mode === 'care' ? DEFAULT_LTC_SHOCK : null,
  } as never)
  return {
    rate: aggregateMonteCarlo(run).successRate,
    paths: run.paths.map((p) => JSON.stringify([p.endingNetWorth, p.depletionYear, Array.from(p.investableByYear)])),
  }
}

/** "Refine to the month" from the current claims, through the engine's route (testSupport/refineFromClaims.ts). */
function refineFromCurrentClaims(plan: Plan) {
  const people = claimingPeople(plan, START)
  if (people.length === 0) return null
  const current: Record<string, number> = {}
  for (const { person, stream } of people) current[person.id] = stream.claimAge.years
  const refined = refineFromClaims(plan, estateSweep(plan, START), current, START)
  return refined === null ? null : { claims: canon(refined.claimByPersonId), estate: refined.endingAfterTaxEstate, primary: refined.primaryValue }
}

/** Every Insights card as the page screens it. */
function insightCards(plan: Plan): string {
  const view = projectPlan(plan, START)
  const ctx = { plan, projection: detectorProjection(view.result, view.summary), params: packForYear(view.startYear).pack }
  return JSON.stringify(runScreen(ctx))
}

/** The funded-ratio card's figures (IncomeFloorSection.tsx#FundedRatioReadout) and whose retirement starts them. */
function fundedRatioCard(plan: Plan) {
  const view = projectPlan(plan, START)
  const start = fundedRatioStart(plan, view.startYear)
  const withFloor = start.fromYear === null ? null : computeFundedRatio({
    years: view.result.years,
    startYear: view.startYear,
    deflate: (y, a) => toTodayDollars(view.basis, y, a),
    curve: EMBEDDED_REAL_YIELD_CURVE,
    fromYear: start.fromYear,
  })
  return { start, ratio: withFloor }
}

/** The SPIA and QLAC candidates the Optimize page's tournament is given. */
function annuityCandidates(plan: Plan): string {
  const ctx = createDecisionContext(plan, { startYear: START, taxCalculator: taxCalculatorFor(plan) })
  return JSON.stringify(annuityPurchaseGenerator.generate(ctx))
}

/** The Monte Carlo page's annuity sweep, on the headline model, at a few paths. */
function annuitySweep(plan: Plan): string {
  const o = headlineMcRunOptions(plan, MC_PATHS, START)
  return JSON.stringify(buildAnnuitizationSweep(plan, {
    startYear: START, taxCalculator: taxCalculatorFor(plan), model: o.model, pathCount: MC_PATHS, seed: o.seed,
  }))
}

const EXAMPLES = appExamplePlans()
const COUPLES = EXAMPLES.filter(({ plan }) => plan.household.people.length === 2)

describe('the library examples do not depend on list order (D-PEOPLE-ORDER, R8)', () => {
  it('has the seven two-person examples', () => {
    expect(COUPLES.map(({ id }) => id).sort()).toEqual([
      'all-401k-no-bridge', 'annuity-purchases-estate', 'bracket-fill-roth', 'brokerage-bridge-401k',
      'example-couple', 'no-annuity-brokerage', 'survivor-years',
    ])
  })

  for (const { id, plan } of COUPLES) {
    it(`${id}, people reversed: parse, ledger, summary, spending answer, refinement and Monte Carlo`, () => {
      const flipped = reversed(plan)
      expect(parseOutcome(flipped)).toBe(parseOutcome(plan))
      expect(orderFree(projectionJson(flipped))).toBe(orderFree(projectionJson(plan)))
      expect(runSpendingSolveRequest({ plan: flipped, startYear: START }).maxBaseAnnual)
        .toBe(runSpendingSolveRequest({ plan, startYear: START }).maxBaseAnnual)
      expect(refineFromCurrentClaims(flipped)).toEqual(refineFromCurrentClaims(plan))
      for (const mode of ['headline', 'longevity', 'care'] as const) {
        expect(monteCarlo(flipped, mode), mode).toEqual(monteCarlo(plan, mode))
      }
    }, 600_000)
  }
})

describe('the surfaces that name one person do not depend on list order (D-PEOPLE-ORDER)', () => {
  const single = EXAMPLES.find(({ id }) => id === 'under-saved-single')!.plan
  for (const { id, plan } of COUPLES) {
    it(`${id}, people reversed: Insights cards, funded ratio, SPIA candidates, annuity sweep and the Compare headline`, () => {
      const flipped = reversed(plan)
      expect(orderFree(insightCards(flipped))).toBe(orderFree(insightCards(plan)))
      expect(fundedRatioCard(flipped)).toEqual(fundedRatioCard(plan))
      expect(annuityCandidates(flipped)).toBe(annuityCandidates(plan))
      expect(annuitySweep(flipped)).toBe(annuitySweep(plan))
      const headline = (a: Plan, b: Plan) => {
        const va = projectPlan(a, START)
        const vb = projectPlan(b, START)
        return comparePlanHeadlines({ plan: a, result: va.result, summary: va.summary }, { plan: b, result: vb.result, summary: vb.summary })
      }
      expect(headline(flipped, single)).toEqual(headline(plan, single))
      expect(headline(single, flipped)).toEqual(headline(single, plan))
    }, 600_000)
  }
})

describe('the library examples do not depend on person ids (D-PEOPLE-ORDER, R8)', () => {
  for (const { id, plan } of EXAMPLES) {
    it(`${id}, ids renamed: parse, ledger, summary and spending answer, mapped back`, () => {
      const map = Object.fromEntries(plan.household.people.map((person, i) => [person.id, `${i === 0 ? 'zz' : 'aa'}-renamed-person-${i}`]))
      const inverse = Object.fromEntries(Object.entries(map).map(([from, to]) => [to, from]))
      const renamed = JSON.parse(rename(JSON.stringify(plan), map)) as Plan
      expect(rename(parseOutcome(renamed), inverse)).toBe(parseOutcome(plan))
      expect(orderFree(withoutDigests(rename(projectionJson(renamed), inverse)))).toBe(orderFree(withoutDigests(projectionJson(plan))))
      expect(runSpendingSolveRequest({ plan: renamed, startYear: START }).maxBaseAnnual)
        .toBe(runSpendingSolveRequest({ plan, startYear: START }).maxBaseAnnual)
      if (plan.household.people.length === 2) {
        const [a, b] = plan.household.people
        if (a!.dob !== b!.dob || a!.sex !== b!.sex) {
          for (const mode of ['longevity', 'care'] as const) {
            expect(monteCarlo(renamed, mode), mode).toEqual(monteCarlo(plan, mode))
          }
        }
      }
    }, 600_000)
  }
})
