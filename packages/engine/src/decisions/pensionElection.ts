/**
 * Pension lump-sum vs annuity decision module (annuity-pension-and-home-equity
 * decisions, step 3).
 *
 * Two complementary surfaces, verdicts framed as tradeoffs — never advice:
 *  - deterministic PV math: the pension annuity's present value at a chosen
 *    discount rate, its survivor-option value, and a sensitivity table over
 *    discount rate × longevity — the classic "what does the lump sum have to
 *    beat" view, golden-tested by hand;
 *  - a scenario pair for the exact ledger / shared-path Monte Carlo: keep the
 *    annuity vs take the lump sum (a tax-free direct rollover into a
 *    traditional account in the election year — see the ledger's
 *    pension-lump-sum block), so taxes, survivor interplay, and sequence risk
 *    are priced by the engine rather than a side model.
 */

import type { Account, Plan } from '../model/plan.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import type { CandidateGenerator, DecisionCandidate, DecisionContext } from './types.js'

type PensionAccount = Extract<Account, { type: 'pension' }>

export interface PensionPvInputs {
  monthlyAmount: number
  /** Annual COLA (percent); 0 = fixed nominal. */
  colaPct: number
  /** Percent of the benefit continuing to the survivor after the owner's death. */
  survivorPct: number
  /** Owner's age when payments start. */
  startAge: number
  /** Owner's age attained in the valuation year. */
  ownerCurrentAge: number
  /** Owner's last full year alive (planning age or a sensitivity override). */
  ownerDeathAge: number
  /** Survivor ages in the valuation year / at their planning horizon; omit for a single household. */
  survivor?: { currentAge: number; deathAge: number }
  /** Nominal annual discount rate (percent). */
  discountRatePct: number
}

/**
 * Present value (valuation-year dollars) of the pension's payment stream:
 * the full benefit while the owner lives (from startAge), then survivorPct of
 * it while the survivor lives — the same continuation rule the ledger applies
 * (survivor benefits require the owner to have reached the start age; a
 * survivor election on a pension that never started pays nothing here too).
 * Payments are nominal with COLA compounding from the start age; discounting
 * is annual at year offsets from the valuation year.
 */
export function pensionAnnuityPresentValue(inputs: PensionPvInputs): number {
  const annual = inputs.monthlyAmount * 12
  if (annual <= 0) return 0
  const discount = 1 + inputs.discountRatePct / 100
  const horizonAge = Math.max(
    inputs.ownerDeathAge,
    inputs.survivor ? inputs.ownerCurrentAge + (inputs.survivor.deathAge - inputs.survivor.currentAge) : 0,
  )
  let pv = 0
  for (let ownerAge = Math.max(inputs.startAge, inputs.ownerCurrentAge); ownerAge <= horizonAge; ownerAge++) {
    const t = ownerAge - inputs.ownerCurrentAge
    const grown = annual * Math.pow(1 + inputs.colaPct / 100, ownerAge - inputs.startAge)
    const ownerAlive = ownerAge <= inputs.ownerDeathAge
    let paid = 0
    if (ownerAlive) {
      paid = grown
    } else if (inputs.survivor && inputs.ownerDeathAge >= inputs.startAge) {
      const survivorAge = inputs.survivor.currentAge + t
      if (survivorAge <= inputs.survivor.deathAge) paid = grown * (inputs.survivorPct / 100)
    }
    if (paid <= 0) continue
    pv += paid / Math.pow(discount, t)
  }
  return pv
}

export interface PensionSensitivityCell {
  discountRatePct: number
  presentValue: number
  /** PV ÷ lump sum: > 1 means the annuity is worth more than the offer at this rate/longevity. */
  ratioToLumpSum: number
}

export interface PensionSensitivityRow {
  ownerDeathAge: number
  cells: PensionSensitivityCell[]
}

export interface PensionSensitivityTable {
  rows: PensionSensitivityRow[]
  discountRatesPct: number[]
  lumpSum: number
}

/**
 * Sensitivity of the annuity's PV to discount rate × owner longevity, against
 * the lump-sum offer. Bounded: at most 5 × 5 cells.
 */
export function pensionLumpSumSensitivity(
  base: Omit<PensionPvInputs, 'discountRatePct' | 'ownerDeathAge'>,
  lumpSum: number,
  discountRatesPct: readonly number[],
  ownerDeathAges: readonly number[],
): PensionSensitivityTable {
  const rates = discountRatesPct.slice(0, 5)
  const ages = ownerDeathAges.slice(0, 5)
  const rows: PensionSensitivityRow[] = ages.map((ownerDeathAge) => ({
    ownerDeathAge,
    cells: rates.map((discountRatePct) => {
      const presentValue = pensionAnnuityPresentValue({ ...base, ownerDeathAge, discountRatePct })
      return {
        discountRatePct,
        presentValue,
        ratioToLumpSum: lumpSum > 0 ? presentValue / lumpSum : 0,
      }
    }),
  }))
  return { rows, discountRatesPct: [...rates], lumpSum }
}

/**
 * Curve-anchored nominal discount rate (percent): the embedded TIPS par real
 * yield at the given horizon plus assumed inflation — the "market rate" column
 * of the sensitivity table (a corporate-bond-style spread is the user's call).
 */
export function curveNominalDiscountRatePct(horizonYears: number, inflationPct: number): number {
  const points = EMBEDDED_REAL_YIELD_CURVE.points
  if (points.length === 0) return inflationPct
  let real = points[points.length - 1]!.realYieldPct
  if (horizonYears <= points[0]!.maturityYears) {
    real = points[0]!.realYieldPct
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!
      const b = points[i + 1]!
      if (horizonYears >= a.maturityYears && horizonYears <= b.maturityYears) {
        real =
          a.realYieldPct +
          ((b.realYieldPct - a.realYieldPct) * (horizonYears - a.maturityYears)) / (b.maturityYears - a.maturityYears)
        break
      }
    }
  }
  return real + inflationPct
}

function dobYear(dob: string): number {
  return Number(dob.slice(0, 4))
}

/**
 * The concrete "take the lump sum" plan patch for a pension with an offer:
 * installs the election, rolling into the largest owner-matched traditional
 * account — or a new zero-balance rollover IRA when the plan has none. Shared
 * by the candidate generator and the pension-election insight so both surfaces
 * model the identical mechanics. Null when the pension carries no offer.
 */
export function pensionTakeLumpSumPatch(
  plan: Plan,
  pension: PensionAccount,
  startYear: number,
): { accounts: Account[] } | null {
  if (!pension.lumpSumOffer) return null
  const ownerId = pension.ownerPersonId ?? plan.household.people[0]?.id ?? null
  const existing = plan.accounts
    .filter(
      (a): a is Extract<Account, { type: 'traditional' }> =>
        a.type === 'traditional' && !a.inherited && (a.ownerPersonId === ownerId || a.ownerPersonId === null),
    )
    .sort((a, b) => b.balance - a.balance)[0]
  // Namespaced by pension id so the synthetic rollover IRA cannot collide
  // with a real user account id.
  const rollover: Account | undefined = existing
    ? undefined
    : {
        id: `pension-rollover-${startYear}-${pension.id}`,
        type: 'traditional',
        kind: 'ira',
        name: `${pension.name} rollover IRA`,
        ownerPersonId: ownerId,
        annualReturnPct: null,
        balance: 0,
        annualContribution: 0,
      }
  const rolloverAccountId = existing?.id ?? rollover!.id
  const accounts = plan.accounts.map((a) =>
    a.id === pension.id ? { ...pension, lumpSumElection: { rolloverAccountId } } : a,
  )
  return { accounts: rollover ? [...accounts, rollover] : accounts }
}

/**
 * Scenario-pair candidates for pensions with a lump-sum offer on record:
 * "take the lump sum" (via pensionTakeLumpSumPatch) and, when already
 * elected, "keep the annuity" (removes the election). Bounded: ≤ 2 pensions,
 * one candidate each; the exact ledger prices both.
 */
export const pensionLumpSumGenerator: CandidateGenerator = {
  id: 'pension-lump-sum',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const plan = ctx.plan
    const startYear = ctx.simulateOptions.startYear
    const candidates: DecisionCandidate[] = []
    const pensions = plan.accounts.filter(
      (a): a is PensionAccount => a.type === 'pension' && a.lumpSumOffer !== undefined,
    )
    for (const pension of pensions.slice(0, 2)) {
      const offer = pension.lumpSumOffer!
      if (offer.electionYear < startYear) continue // election already past; nothing to model
      if (pension.lumpSumElection) {
        candidates.push({
          id: `pension-keep-annuity-${pension.id}`,
          source: 'heuristic',
          category: 'guaranteed-income',
          label: `Keep the ${pension.name} annuity`,
          explanation:
            'Runs the plan with the lump-sum election removed, so the pension pays its lifetime annuity and the exact ledger prices what the lump sum gives up.',
          planPatch: {
            accounts: plan.accounts.map((a) => (a.id === pension.id ? { ...pension, lumpSumElection: undefined } : a)),
          },
        })
        continue
      }
      const patch = pensionTakeLumpSumPatch(plan, pension, startYear)
      if (!patch) continue
      candidates.push({
        id: `pension-lump-sum-${pension.id}`,
        source: 'heuristic',
        category: 'guaranteed-income',
        label: `Take the ${pension.name} lump sum`,
        explanation: `Rolls the $${Math.round(offer.amount).toLocaleString()} offer into a traditional IRA in ${offer.electionYear} (tax-free direct rollover) instead of the lifetime annuity, and reprices the whole plan on the exact ledger.`,
        planPatch: patch,
        metadata: { pensionId: pension.id, lumpSum: Math.round(offer.amount), electionYear: offer.electionYear },
      })
    }
    return candidates
  },
}

export interface PensionDecisionAnalysis {
  pensionId: string
  pensionName: string
  lumpSum: number
  electionYear: number
  /** PV at the curve-anchored rate, full survivor continuation as configured. */
  presentValueAtCurveRate: number
  curveRatePct: number
  /** PV with survivor continuation zeroed — the survivor option's PV value is the difference. */
  presentValueSingleLife: number
  sensitivity: PensionSensitivityTable
}

/**
 * The decision view's deterministic analysis for every pension carrying a
 * lump-sum offer. Discount rates: the curve-anchored rate ± 1% and two fixed
 * planning rates; longevity: planning age and ±3 years.
 */
export function analyzePensionElections(plan: Plan, startYear: number): PensionDecisionAnalysis[] {
  const analyses: PensionDecisionAnalysis[] = []
  for (const account of plan.accounts) {
    if (account.type !== 'pension' || !account.lumpSumOffer) continue
    const ownerId = account.ownerPersonId ?? plan.household.people[0]?.id
    const owner = plan.household.people.find((p) => p.id === ownerId) ?? plan.household.people[0]
    if (!owner) continue
    const other = plan.household.people.find((p) => p.id !== owner.id)
    const ownerCurrentAge = startYear - dobYear(owner.dob)
    const ownerPlanningAge = owner.longevity.planningAge
    const survivor =
      other !== undefined
        ? { currentAge: startYear - dobYear(other.dob), deathAge: other.longevity.planningAge }
        : undefined
    const base = {
      monthlyAmount: account.monthlyAmount,
      colaPct: account.colaPct,
      survivorPct: account.survivorPct,
      startAge: account.startAge,
      ownerCurrentAge,
      survivor,
    }
    const horizonYears = Math.max(5, ownerPlanningAge - ownerCurrentAge)
    const curveRatePct = curveNominalDiscountRatePct(horizonYears, plan.assumptions.inflationPct)
    const rates = [
      Math.max(0.5, Math.round((curveRatePct - 1) * 10) / 10),
      Math.round(curveRatePct * 10) / 10,
      Math.round((curveRatePct + 1) * 10) / 10,
      6,
      7,
    ].filter((r, i, arr) => arr.indexOf(r) === i)
    const deathAges = [ownerPlanningAge - 3, ownerPlanningAge, ownerPlanningAge + 3].filter((a) => a > ownerCurrentAge)
    analyses.push({
      pensionId: account.id,
      pensionName: account.name,
      lumpSum: account.lumpSumOffer.amount,
      electionYear: account.lumpSumOffer.electionYear,
      presentValueAtCurveRate: pensionAnnuityPresentValue({
        ...base,
        ownerDeathAge: ownerPlanningAge,
        discountRatePct: curveRatePct,
      }),
      curveRatePct,
      presentValueSingleLife: pensionAnnuityPresentValue({
        ...base,
        survivorPct: 0,
        ownerDeathAge: ownerPlanningAge,
        discountRatePct: curveRatePct,
      }),
      sensitivity: pensionLumpSumSensitivity(base, account.lumpSumOffer.amount, rates, deathAges),
    })
  }
  return analyses
}
