/**
 * Deterministic annual-ledger simulation (roadmap V1).
 *
 * Year ordering: ages → income → expenses (incl. debt service) → capped
 * contributions → fixed-point tax/withdrawal iteration → apply flows →
 * property events → growth → snapshot. All amounts are nominal dollars;
 * today's-dollar display is a render-time transform.
 *
 * V1 simplifications (each lifts in a later roadmap phase):
 * - Wages, contributions, base spending, and goals inflate at the general rate;
 *   wages stop in the year the person attains retirement age.
 * - SS COLA compounds from the projection start, and first-year benefits are
 *   prorated by claim months only (no birthday-month precision). PIA comes
 *   from the stream directly or from its earnings history (AIME → bend
 *   points). The earnings test withholds own, spousal, and survivor benefits
 *   annually ($1/$2 below FRA, $1/$3 in the FRA year) and credits the withheld
 *   months back at FRA (ARF, annual approximation). Spousal benefits apply the
 *   retirement/survivor family maximum; survivors step up to the deceased's
 *   benefit with the early-claim widow(er) reduction and RIB-LIM widow's-limit cap.
 * - RMDs are forced from traditional accounts at SECURE 2.0 start ages
 *   (Uniform Lifetime Table; no April-1 first-year deferral). QCDs route
 *   charitable dollars out of the RMD (age 70½ ≈ age attained 71).
 *   Early-withdrawal penalties: 10% traditional pre-59½ (≈ age < 60), 20%
 *   HSA non-medical pre-65. Healthcare expenses: ACA-credited marketplace
 *   premiums pre-65 (credit vs prior-year MAGI; 400% FPL cliff), Medicare
 *   Part B + IRMAA (MAGI 2-year lookback) + Part D surcharge + extras from
 *   65. Roth conversions run after RMDs (manual amounts or fill-to-target
 *   sized against the federal engine; conversion taxes ride the normal
 *   withdrawal flow, so they come from cash/taxable first and are never
 *   penalized). Annuities end at owner death; pensions pay survivorPct to a
 *   surviving spouse once payments have started.
 * - Contribution limits beyond the latest parameter pack are indexed forward
 *   at the assumed inflation rate (statutory limits are inflation-indexed).
 */

import type { Account, AssetAllocationPolicy, Person, Plan } from '../model/plan.js'
import { ASSET_CLASS_IDS, stateForYear, stateResidencySegmentsForYear } from '../model/plan.js'
import {
  accountAllocation,
  blendedTaxableYield,
  driftWeights,
  rebalanceTurnoverFraction,
  resolveAssetClassParams,
  targetWeightsAt,
} from '../allocation/assetClasses.js'
import { packForYear, LATEST_PACK_YEAR, hecmPrincipalLimitFactorPct, EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { annuityExclusionMultiple, annuityPayoutForm, annuityPayoutFraction } from './annuityForms.js'
import { buildLadder, ladderRealFlowsAtOffset, ladderRemainingFace, type LadderRung } from '../ladder/ladderMath.js'
import { stateParamsFor } from '../params/state/index.js'
import type { ParameterPack } from '../params/types.js'
import { requiredMinimumDistribution } from '../rmd/rmd.js'
import { claimFactor, spousalBenefitFactor, type ClaimAge } from '../socialSecurity/claimFactor.js'
import { bestMaritalBenefit } from '../socialSecurity/maritalBenefits.js'
import { capAuxiliaryForFamilyMaximum, claimAgeTotalMonths } from '../socialSecurity/familyMaximum.js'
import { sizeRothConversion } from '../strategies/rothConversion.js'
import { splitRothWithdrawal, type RothBasisState } from '../strategies/rothBasis.js'
import { seppActive, seppAnnualAmount } from '../strategies/sepp.js'
import { inheritedForcedAmount } from '../strategies/inheritedIra.js'
import {
  acceptsContributions,
  followsOwnerRmds,
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  isConvertibleToRoth,
  isSpendableInYear,
  traditionalWithdrawalPenaltyRate,
} from '../strategies/accountEligibility.js'
import { openIraProRataYear, splitIraDistribution, type IraProRataYear } from '../strategies/iraBasis.js'
import { propertySaleTax } from '../tax/propertySale.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '../socialSecurity/nra.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '../socialSecurity/piaFromEarnings.js'
import { survivorBenefitMonthly } from '../socialSecurity/survivorBenefit.js'
import { inSsdiWindow, ssdiMonthlyBenefit, ssdiSuspendedBySga } from '../socialSecurity/disability.js'
import { attributeShortfall, splitAnnualSpendingLayers } from '../spending/layers.js'
import { ABW_DEFAULTS, abwAnnualPayment, abwExpectedRealReturnPct } from '../spending/abw.js'
import { jointSurvivalPercentileAge, survivalPercentileAge } from '../montecarlo/survival.js'
import {
  nextBalanceGuardrailMultiplier,
  nextGuardrailMultiplier,
  type GuardrailAction,
  type GuardrailPolicy,
} from '../spending/guardrails.js'
import { createGoalScheduler, toSchedulableGoal, type GoalScheduler } from '../spending/flexibleGoals.js'
import { acaNetAnnualPremiumByMonth } from '../tax/aca.js'
import { applyCapitalLossCarryforward, computeFederalTax, taxableSocialSecurity } from '../tax/federalTax.js'
import { medicareAnnualPremiumPerPerson } from '../tax/medicare.js'
import {
  taxParameterFilingStatus,
  type MarketSeries,
  type OptimizerYearProbe,
  type PersonYearState,
  type ProjectedFilingStatus,
  type ProjectionResult,
  type TaxCalculator,
  type YearExpenses,
  type YearIncomes,
  type YearResult,
  type YearWithdrawals,
} from './types.js'

export interface SimulateOptions {
  startYear: number
  taxCalculator: TaxCalculator
  /**
   * Per-year stochastic returns/inflation (Monte Carlo, roadmap V4). Omitted =
   * deterministic run using the plan's assumptions every year.
   */
  market?: MarketSeries
  /**
   * Per-person age at death (last full year alive), overriding longevity.planningAge.
   * Used by stochastic-longevity Monte Carlo (roadmap V6); omitted = use planningAge.
   */
  deathAgeByPersonId?: Record<string, number>
  /**
   * Force the projection's end year, independent of lifespans, so every Monte
   * Carlo path shares a year grid even when sampled death ages differ.
   */
  horizonEndYear?: number
  /**
   * Optional sink for the V8 optimizer's per-year linearization inputs. A no-op
   * when omitted, so a normal projection is unaffected. @see OptimizerYearProbe
   */
  captureOptimizerInputs?: (probe: OptimizerYearProbe) => void
}

const EPSILON = 0.005
const MAX_TAX_ITERATIONS = 8

interface BalanceState {
  account: Extract<Account, { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa' }>
  balance: number
  costBasis: number // meaningful for taxable only
}

interface WithdrawalPlanResult {
  byCategory: YearWithdrawals
  byAccountId: Map<string, number>
  realizedGains: number
  shortfall: number
  /** Dollars taken out of the taxable safety-net reserve as a last resort. */
  reserveUsed: number
}

function dobParts(person: Person): { y: number; m: number; d: number } {
  return {
    y: Number(person.dob.slice(0, 4)),
    m: Number(person.dob.slice(5, 7)),
    d: Number(person.dob.slice(8, 10)),
  }
}

function claimAgeFromTotalMonths(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

/** Annual-ledger approximation: a same-year claim pays only months after the claim month. */
function payableMonthsAtAge(ageAttained: number, claimAge: ClaimAge): number {
  if (ageAttained < claimAge.years) return 0
  if (ageAttained > claimAge.years) return 12
  return Math.max(0, 12 - claimAge.months)
}

/**
 * Linear interpolation of an illustration cash-value table by age. Clamps to the
 * endpoints outside the table's range (front-loaded-poor / back-loaded-rich whole-
 * life cash value is exactly why a schedule beats a flat rate).
 */
function interpolateByAge(schedule: { age: number; value: number }[], age: number): number {
  if (schedule.length === 0) return 0
  const sorted = [...schedule].sort((a, b) => a.age - b.age)
  if (age <= sorted[0]!.age) return sorted[0]!.value
  if (age >= sorted[sorted.length - 1]!.age) return sorted[sorted.length - 1]!.value
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!
    const hi = sorted[i + 1]!
    if (age >= lo.age && age <= hi.age) {
      const t = (age - lo.age) / (hi.age - lo.age)
      return lo.value + t * (hi.value - lo.value)
    }
  }
  return sorted[sorted.length - 1]!.value
}

const SEQUENTIAL_ORDER = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const
const PROPORTIONAL_POOL = ['cash', 'taxable', 'equityComp', 'traditional', 'roth'] as const

function spendableBalance(state: BalanceState, year: number): number {
  return isSpendableInYear(state.account, year) ? state.balance : 0
}

/** Strategy with year-specific parameters resolved (bracket headroom in dollars). */
type ResolvedWithdrawalStrategy =
  | { mode: 'sequential' }
  | { mode: 'proportional' }
  | { mode: 'bracketTargeted'; traditionalCap: number }

/** Drain plan over a copy of balances; pure with respect to engine state. */
function planWithdrawals(
  amount: number,
  states: BalanceState[],
  strategy: ResolvedWithdrawalStrategy = { mode: 'sequential' },
  year = 0,
  liquidReserve = 0,
): WithdrawalPlanResult {
  const byCategory: YearWithdrawals = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 }
  const byAccountId = new Map<string, number>()
  const available = new Map(states.map((s) => [s.account.id, spendableBalance(s, year)]))
  let realizedGains = 0
  let remaining = amount

  // Taxable safety-net floor (step 7): hold `liquidReserve` back from the
  // liquid (cash/taxable/vested equity-comp) accounts so other account types
  // fund spending first. Protection is allocated to the last-drained accounts
  // first, and released below only when everything else still falls short —
  // the floor is a preference, never a manufactured shortfall.
  const reservedByAccount = new Map<string, number>()
  if (liquidReserve > 0) {
    let toReserve = liquidReserve
    for (const type of ['equityComp', 'taxable', 'cash'] as const) {
      for (let i = states.length - 1; i >= 0 && toReserve > EPSILON; i--) {
        const s = states[i]!
        if (s.account.type !== type) continue
        const avail = available.get(s.account.id) ?? 0
        const hold = Math.min(avail, toReserve)
        if (hold <= 0) continue
        available.set(s.account.id, avail - hold)
        reservedByAccount.set(s.account.id, hold)
        toReserve -= hold
      }
    }
  }

  const takeFrom = (state: BalanceState, want: number): number => {
    const take = Math.min(available.get(state.account.id) ?? 0, want, remaining)
    if (take <= 0) return 0
    if ((state.account.type === 'taxable' || state.account.type === 'equityComp') && state.balance > 0) {
      const basisRatio = Math.min(1, state.costBasis / state.balance)
      realizedGains += take * (1 - basisRatio)
    }
    const category = state.account.type === 'equityComp' ? 'taxable' : state.account.type
    byCategory[category as keyof Omit<YearWithdrawals, 'total'>] += take
    byAccountId.set(state.account.id, (byAccountId.get(state.account.id) ?? 0) + take)
    available.set(state.account.id, (available.get(state.account.id) ?? 0) - take)
    remaining -= take
    return take
  }

  const drainCategory = (category: BalanceState['account']['type'], cap = Infinity): void => {
    let capLeft = cap
    for (const state of states) {
      if (state.account.type !== category) continue
      if (remaining <= EPSILON || capLeft <= EPSILON) break
      capLeft -= takeFrom(state, capLeft)
    }
  }

  if (strategy.mode === 'proportional') {
    // Pro-rata passes; accounts that empty shift their share to the rest.
    for (let pass = 0; pass < 6 && remaining > EPSILON; pass++) {
      const poolStates = states.filter(
        (s) => (PROPORTIONAL_POOL as readonly string[]).includes(s.account.type) && (available.get(s.account.id) ?? 0) > 0,
      )
      const poolTotal = poolStates.reduce((sum, s) => sum + (available.get(s.account.id) ?? 0), 0)
      if (poolTotal <= 0) break
      const target = remaining
      for (const state of poolStates) {
        takeFrom(state, (target * (available.get(state.account.id) ?? 0)) / poolTotal)
      }
    }
    for (const category of PROPORTIONAL_POOL) drainCategory(category) // numerical cleanup
    drainCategory('hsa')
  } else if (strategy.mode === 'bracketTargeted') {
    drainCategory('traditional', strategy.traditionalCap)
    drainCategory('cash')
    drainCategory('taxable')
    drainCategory('equityComp')
    drainCategory('roth')
    drainCategory('traditional')
    drainCategory('hsa')
  } else {
    for (const category of SEQUENTIAL_ORDER) drainCategory(category)
  }

  // Release the safety-net reserve as a last resort.
  let reserveUsed = 0
  if (remaining > EPSILON && reservedByAccount.size > 0) {
    const before = remaining
    for (const [id, hold] of reservedByAccount) {
      available.set(id, (available.get(id) ?? 0) + hold)
    }
    for (const category of ['cash', 'taxable', 'equityComp'] as const) drainCategory(category)
    reserveUsed = before - remaining
  }

  byCategory.total = byCategory.cash + byCategory.taxable + byCategory.traditional + byCategory.roth + byCategory.hsa
  return { byCategory, byAccountId, realizedGains, shortfall: Math.max(0, remaining), reserveUsed }
}

export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResult {
  const { startYear, taxCalculator, market } = opts
  const warnings = new Set<string>()
  const inflation = plan.assumptions.inflationPct / 100
  const people = plan.household.people
  const primary = people[0]!
  const personById = new Map(people.map((p) => [p.id, p]))
  // Clamped: the dob schema enforces YYYY-MM-DD shape but not month range, and
  // an out-of-range month must not produce negative or >12 coverage months.
  const birthMonthByPerson = new Map(people.map((p) => [p.id, Math.min(12, Math.max(1, dobParts(p).m || 1))]))
  const dobYear = (p: Person) => dobParts(p).y
  /** Last full year alive: a stochastic-longevity override if given, else the plan's planning age. */
  const lifeAgeOf = (p: Person) => opts.deathAgeByPersonId?.[p.id] ?? p.longevity.planningAge
  const lastAliveYearOf = (p: Person) => dobYear(p) + lifeAgeOf(p)

  const filingStatusFor = (year: number, aliveCount: number): ProjectedFilingStatus => {
    if (plan.household.filingStatus !== 'marriedFilingJointly') return plan.household.filingStatus
    if (aliveCount >= 2) return 'marriedFilingJointly'
    if (aliveCount === 1 && people.length === 2 && plan.household.hasQualifyingDependent) {
      const firstDeathYear = Math.min(...people.map(lastAliveYearOf))
      if (year > firstDeathYear && year <= firstDeathYear + 2) return 'qualifyingSurvivingSpouse'
    }
    return 'single'
  }

  // SSA-44 IRMAA redetermination (opt-in; domain rules §7). A qualifying
  // life-changing event — death of spouse, and optionally each person's work
  // stoppage — lets the beneficiary ask SSA to price IRMAA on the current
  // year's estimated MAGI instead of the two-year lookback. Planning-grade: in
  // the two years after an event, the premium MAGI is min(lookback, prior
  // year). The prior year stands in for the current-year estimate (current-year
  // MAGI would be circular with withdrawals — same convention as the ACA
  // credit), and the min reflects that a redetermination is only filed when it
  // helps. Two documented under-modelings of the real form follow from that
  // stand-in: (a) the event year itself stays on the plain lookback — a real
  // filing can re-price it, but the prior-year estimate there is pre-event
  // income, so modeling it would show no relief anyway; (b) in the first
  // post-event year the estimate is the event year's MAGI (a death year is
  // still a full joint year), so year-one relief is understated when income
  // runs high through the event. Off/absent = the plain two-year lookback.
  const ssa44 = plan.expenses.healthcare.ssa44
  const ssa44EventYears: number[] = []
  if (ssa44?.survivorYears && plan.household.filingStatus === 'marriedFilingJointly' && people.length === 2) {
    ssa44EventYears.push(Math.min(...people.map(lastAliveYearOf)))
  }
  if (ssa44?.retirementYears) {
    for (const p of people) {
      // Only a retirement that actually happens: someone who dies (planning
      // age or a stochastic/scenario override) before reaching retirementAge
      // never has a work-stoppage event to report.
      if (typeof p.retirementAge === 'number' && p.retirementAge <= lifeAgeOf(p)) {
        ssa44EventYears.push(dobYear(p) + p.retirementAge)
      }
    }
  }
  const ssa44ActiveInYear = (y: number) => ssa44EventYears.some((e) => y > e && y <= e + 2)

  const endYear = opts.horizonEndYear ?? Math.max(...people.map((p) => dobYear(p) + lifeAgeOf(p)))

  // --- per-year market series (deterministic assumptions unless overridden) --
  const horizon = endYear - startYear + 1
  const inflRateAt = (year: number): number => {
    const series = market?.inflationPct
    if (year < startYear || !series || series.length === 0) return inflation
    return (series[Math.min(year - startYear, series.length - 1)] ?? plan.assumptions.inflationPct) / 100
  }
  const returnShockAt = (year: number): number => {
    const series = market?.returnShockPct
    if (!series || series.length === 0) return 0
    return series[Math.min(year - startYear, series.length - 1)] ?? 0
  }
  /**
   * Additive shock for one asset class: its own series when supplied, else the
   * single-factor market shock for non-cash classes (cash is stable value).
   */
  const classShockAt = (year: number, classIndex: number): number => {
    const id = ASSET_CLASS_IDS[classIndex]!
    const series = market?.classReturnShockPct?.[id]
    if (series && series.length > 0) return series[Math.min(year - startYear, series.length - 1)] ?? 0
    return id === 'cash' ? 0 : returnShockAt(year)
  }
  const healthExtra = plan.assumptions.healthcareExtraInflationPct / 100
  // cum*[i] = cumulative factor from startYear through startYear + i (exclusive).
  const cumInfl: number[] = [1]
  const cumHealthInfl: number[] = [1]
  for (let i = 0; i < horizon; i++) {
    const r = inflRateAt(startYear + i)
    cumInfl.push(cumInfl[i]! * (1 + r))
    cumHealthInfl.push(cumHealthInfl[i]! * (1 + r + healthExtra))
  }
  const factorFrom = (cum: number[], preStartRate: number, fromYear: number, toYear: number): number => {
    if (toYear <= fromYear) return 1
    let f = 1
    if (fromYear < startYear) f = Math.pow(1 + preStartRate, Math.min(toYear, startYear) - fromYear)
    const a = Math.min(Math.max(fromYear, startYear) - startYear, horizon)
    const b = Math.min(Math.max(toYear, startYear) - startYear, horizon)
    return f * (cum[b]! / cum[a]!)
  }
  /** Cumulative general-inflation factor between two years (per-year series from startYear on). */
  const inflFactorFrom = (fromYear: number, toYear: number) => factorFrom(cumInfl, inflation, fromYear, toYear)
  /** Same for healthcare (general inflation + the healthcare premium). */
  const healthInflFactorFrom = (fromYear: number, toYear: number) =>
    factorFrom(cumHealthInfl, inflation + healthExtra, fromYear, toYear)
  /** Statutory limits are indexed; project them past the latest pack at the inflation path. */
  const limitScale = (pack: ParameterPack, isStandIn: boolean, year: number): number =>
    !isStandIn || year <= LATEST_PACK_YEAR ? 1 : inflFactorFrom(pack.year, year)

  // --- mutable engine state ---------------------------------------------
  const balances: BalanceState[] = []
  const propertyValues = new Map<string, number>()
  const debtBalances = new Map<string, number>()
  for (const account of plan.accounts) {
    if (
      account.type === 'cash' ||
      account.type === 'taxable' ||
      account.type === 'equityComp' ||
      account.type === 'traditional' ||
      account.type === 'roth' ||
      account.type === 'hsa'
    ) {
      balances.push({
        account,
        balance: account.balance,
        costBasis: account.type === 'taxable' || account.type === 'equityComp' ? account.costBasis : 0,
      })
    } else if (account.type === 'property') {
      propertyValues.set(account.id, account.value)
    } else if (account.type === 'debt') {
      debtBalances.set(account.id, account.balance)
    }
  }
  let unassignedCash = 0
  // Annuity purchases (guaranteed-income-and-estate-depth). The premium actually
  // funded becomes the contract's investment for the non-qualified exclusion
  // ratio; the ratio and remaining excludable investment are memoized on first
  // payout. Both persist across years (funding and payout can be years apart for
  // a QLAC), so they live at engine-state scope.
  const annuityInvestmentInContract = new Map<string, number>()
  const annuityExclusionState = new Map<string, { ratio: number; remaining: number }>()
  // A non-qualified purchase dated before the projection start already funded the
  // contract in the past — its premium is assumed already out of the funding
  // account — so the per-year funding transfer below never runs for it. Seed the
  // investment-in-contract directly so exclusion-ratio taxation still recovers the
  // premium instead of treating every payout as fully taxable. (Qualified/QLAC
  // purchases are fully ordinary regardless, so they need no seeding.)
  for (const account of plan.accounts) {
    if (account.type !== 'annuity' || account.purchase?.taxQualification !== 'nonQualified') continue
    if (account.purchase.year >= startYear) continue
    annuityInvestmentInContract.set(account.id, account.purchase.premium)
  }
  // HECM lines of credit (annuity-pension-and-home-equity, step 4), keyed by
  // property id. The principal limit and the loan balance both compound at the
  // line's growth rate; available credit is their difference. A sold property
  // repays the loan non-recourse (never more than the proceeds) and closes the
  // line, so a deleted entry means "closed", not "never opened".
  const hecmStates = new Map<string, { principalLimit: number; loanBalance: number }>()
  // Realized wealth-weighted portfolio return applied by the previous year's
  // growth pass (percent). The coordinated HECM draw policy triggers on an
  // actual portfolio loss — not on the raw additive shock, which can be
  // negative in a year the portfolio still gained. 0 before the first year.
  let priorYearPortfolioReturnPct = 0
  // TIPS income-floor ladders (social-security-bridge-and-tips-ladder). Rungs
  // are solved once from the embedded real-yield curve; per-year cash flows
  // scale with the path's inflation factors — exactly the TIPS indexation
  // (principal and coupons both track CPI). `scale` < 1 when a purchase-year
  // funding account couldn't cover the full quoted cost. A purchase dated
  // before the projection start is assumed already funded (like a seeded
  // annuity premium), so no transfer runs for it.
  const ladderStates: Array<{
    id: string
    anchorYear: number
    rungs: LadderRung[]
    costReal: number
    purchase: { year: number; fundingAccountId: string } | undefined
    scale: number
  }> = []
  // Last calendar year anyone is alive: after it, rungs stop maturing and the
  // remaining face is frozen as an estate asset (MC horizons run well past
  // death, and offset-space maturation must not evaporate unmatured principal).
  const ladderLastAliveYear = Math.max(...people.map((p) => dobYear(p) + lifeAgeOf(p)))
  for (const ladder of plan.incomeFloor?.ladders ?? []) {
    // Anchor = the year the rungs exist from: the purchase year, or (already
    // owned) the year before the projection so coupons pay from year one.
    const anchorYear = ladder.purchase ? ladder.purchase.year : startYear - 1
    const effectiveStartYear = Math.max(ladder.startYear, anchorYear + 1)
    if (ladder.endYear < effectiveStartYear || ladder.annualRealAmount <= 0) continue
    const build = buildLadder({
      annualRealIncome: ladder.annualRealAmount,
      firstPayoutOffset: effectiveStartYear - anchorYear,
      payoutYears: ladder.endYear - effectiveStartYear + 1,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    ladderStates.push({
      id: ladder.id,
      anchorYear,
      rungs: build.rungs,
      costReal: build.totalCost,
      purchase: ladder.purchase,
      scale: 1,
    })
  }

  // Opt-in asset allocation (asset-allocation-and-return-model-v2). Withdrawals
  // and deposits are assumed pro-rata across classes, so only differential class
  // growth moves an account's weights — tracking the weight vector (not class
  // dollars) is exact under that assumption. Accounts without an allocation are
  // untouched (feature-off is unchanged).
  const classParams = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const allocationTrack = new Map<string, { policy: AssetAllocationPolicy; weights: number[] }>()
  for (const state of balances) {
    const policy = accountAllocation(state.account)
    if (policy) allocationTrack.set(state.account.id, { policy, weights: targetWeightsAt(policy, startYear) })
  }
  // Permanent-life cash values, grown/interpolated each year; an asset on the
  // balance sheet but held out of withdrawals (no surrender/loan in v1).
  const insuranceCashValues = new Map<string, number>()
  for (const policy of plan.insurance) {
    if (policy.kind === 'permanentLife') insuranceCashValues.set(policy.id, policy.cashValue)
  }
  // Years each LTC policy has paid a benefit, to enforce benefitPeriodYears.
  const ltcBenefitYearsUsed = new Map<string, number>()
  /** First-year (fixed) 72(t) amortization payment per account id, cached for the series. */
  const seppAmortAmount = new Map<string, number>()
  // Capital-loss carryforward pool, depleting across years: nets against realized
  // gains first, then up to the annual limit against ordinary income. Entered in
  // today's $ but treated as flat nominal (capital losses never index), so it's
  // not inflation-scaled. @see DOCS/features/taxes.md
  let capitalLossPool = plan.household.capitalLossCarryforward
  // Roth basis pools (contributions + conversion 5-year clocks) driving the Roth
  // ordering rules. The IRS aggregates an owner's Roth IRAs for ordering, so all
  // of one owner's Roth IRAs share a single pool; employer Roth (401k) accounts
  // stay separate. An omitted contributionBasis means "treat the whole starting
  // balance as seasoned basis" — the penalty-free default.
  const rothPoolKey = (account: Extract<Account, { type: 'roth' }>): string =>
    account.kind === 'ira' ? `rothira:${account.ownerPersonId ?? primary.id}` : `roth:${account.id}`
  const rothBasis = new Map<string, RothBasisState>()
  for (const account of plan.accounts) {
    if (account.type !== 'roth') continue
    const key = rothPoolKey(account)
    const startBasis = account.contributionBasis ?? account.balance
    const existing = rothBasis.get(key)
    if (existing) existing.contributionBasis += startBasis
    else rothBasis.set(key, { contributionBasis: startBasis, conversionLayers: [] })
  }
  // HSA medical-expense subledger (account/HSA/fixed-asset depth plan, steps
  // 2–3). Qualified withdrawals from cap-mode HSAs are limited to the
  // household's modeled medical costs each year; with reimburse-later enabled,
  // unreimbursed expenses accumulate in this pool (nominal $) and lift the cap
  // in later years — the "pay out of pocket now, reimburse yourself later"
  // strategy. Legacy HSAs (no withdrawalTreatment) keep v1 behavior exactly.
  const hsaReimburseLaterActive = plan.accounts.some(
    (a) => a.type === 'hsa' && a.withdrawalTreatment === 'capByMedicalExpenses' && a.reimburseLater === true,
  )
  let hsaReimbursablePool = 0
  // Nondeductible traditional-IRA basis pools (Form 8606 pro-rata, step 5),
  // aggregated per owner across their own (non-inherited) IRAs. Depletes as
  // distributions/conversions return basis.
  const iraBasisByOwner = new Map<string, number>()
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const basis = account.nondeductibleBasis ?? 0
    if (basis <= 0) continue
    const ownerId = account.ownerPersonId ?? primary.id
    iraBasisByOwner.set(ownerId, (iraBasisByOwner.get(ownerId) ?? 0) + basis)
  }
  // Taxable safety-net floor (step 7): a minimum liquid (cash/taxable/vested
  // equity-comp) reserve, in today's dollars, that withdrawals preserve and
  // fill-to-target conversions respect. 0 = off (today's behavior).
  const safetyNetFloorToday = plan.strategies.taxableSafetyNetFloor ?? 0
  /**
   * Realized MAGI by year. Before the projection, prefer an exact tax-year
   * history entry and retain recentAnnualMagi as the legacy fallback.
   */
  const magiHistory = new Map<number, number>()
  const magiFor = (y: number) =>
    magiHistory.get(y) ??
    plan.assumptions.historicalAnnualMagiByYear?.[String(y)] ??
    plan.assumptions.recentAnnualMagi

  const deposit = (amount: number) => {
    if (amount <= 0) return
    const target =
      balances.find((b) => b.account.type === 'cash') ?? balances.find((b) => b.account.type === 'taxable')
    if (!target) {
      warnings.add('Surplus cash had no cash/taxable account to land in; tracked as unassigned (0% growth).')
      unassignedCash += amount
      return
    }
    target.balance += amount
    if (target.account.type === 'taxable' || target.account.type === 'equityComp') target.costBasis += amount
  }

  // Resolve each SS stream's PIA once: entered directly, or derived from the
  // earnings history via the AIME → bend-point engine.
  const resolvedPiaByStreamId = new Map<string, number>()
  for (const stream of plan.incomes) {
    if (stream.type !== 'socialSecurity') continue
    if (stream.piaMonthly !== null) {
      resolvedPiaByStreamId.set(stream.id, stream.piaMonthly)
      continue
    }
    if (!stream.earnings || stream.earnings.length === 0) {
      warnings.add('A Social Security stream has no PIA amount and no earnings history; it was skipped.')
      continue
    }
    const person = personById.get(stream.personId)!
    const { y, m, d } = dobParts(person)
    const projection = resolveEarningsProjection(stream.earningsProjection, person.retirementAge)
    const result = computePiaFromEarnings(piaInputFromEarnings(y, m, d, stream.earnings, projection))
    if (isPiaFromEarningsError(result)) {
      warnings.add(`A Social Security earnings history could not be used (${result.code}); the stream was skipped.`)
      continue
    }
    if (result.usesStandInForFutureTables) {
      warnings.add('PIA from earnings uses stand-in SSA tables for years beyond the published data.')
    }
    resolvedPiaByStreamId.set(stream.id, result.piaMonthly)
  }

  const years: YearResult[] = []
  let depletionYear: number | null = null

  // Spending policy (planning-depth roadmap §4). Under withdrawal-rate or
  // risk-based guardrails the ledger rations the discretionary spending layer
  // path by path and routes flexible goals through a scheduler; fixed-target (or
  // absent) keeps today's behavior. The two modes share the rationing machinery
  // and differ only in the trigger signal: withdrawal-rate compares the current
  // withdrawal rate to the starting rate; risk-based compares the real balance
  // to solver-derived probability-band thresholds (% of the starting portfolio).
  // The running multiplier and starting signal persist across the year loop
  // (path state), so this is set up once per simulation.
  const spendingPolicy = plan.expenses.spendingPolicy
  const riskBasedGuardrails = spendingPolicy?.mode === 'riskBasedGuardrails'
  const guardrailsActive = spendingPolicy?.mode === 'withdrawalRateGuardrails' || riskBasedGuardrails
  const guardrailPolicy: GuardrailPolicy = {
    mode: riskBasedGuardrails ? 'risk-based' : 'withdrawal-rate',
    upperGuardrailPct: spendingPolicy?.upperGuardrailPct,
    lowerGuardrailPct: spendingPolicy?.lowerGuardrailPct,
    lowerBalanceThresholdPct: spendingPolicy?.lowerBalanceThresholdPct,
    upperBalanceThresholdPct: spendingPolicy?.upperBalanceThresholdPct,
    adjustmentPct: spendingPolicy?.adjustmentPct,
    allowRaisesAboveTarget: spendingPolicy?.allowRaisesAboveTarget,
  }
  // Amortization-based withdrawal (spending-paths & SWR-lenses plan, Goal 2).
  // Under 'abw' the year's lifestyle target is the actual start-of-year
  // portfolio re-amortized over the remaining horizon (engine/spending/abw.ts)
  // instead of baseAnnual × phases; the payment funds through the same
  // tax/withdrawal cascade as every other expense. The horizon and expected
  // real return are resolved once here — presets-don't-drift style — so every
  // year of one simulation amortizes toward the same end age.
  const abwActive = spendingPolicy?.mode === 'abw'
  const abwRealReturnPct = abwActive ? abwExpectedRealReturnPct(spendingPolicy?.abw) : 0
  const abwTiltPct = abwActive ? (spendingPolicy?.abw?.tiltPct ?? ABW_DEFAULTS.tiltPct) : 0
  let abwHorizonYear = endYear
  if (abwActive) {
    const horizonMode = spendingPolicy?.abw?.horizon ?? ABW_DEFAULTS.horizon
    if (horizonMode === 'survival25' || horizonMode === 'survival10') {
      // Deliberately the unadjusted SSA table (hazard = 1): the ledger never
      // reads questionnaire state, and a health-adjusted percentile pick on
      // Household is provenance on that person's planning age, not a plan-wide
      // mortality override. The UI labels this horizon "unadjusted SSA".
      const pct = horizonMode === 'survival25' ? 25 : 10
      const partner = people[1]
      const primaryAgeNow = startYear - dobYear(primary)
      const horizonAge = partner
        ? jointSurvivalPercentileAge(
            { age: primaryAgeNow, sex: primary.sex },
            { age: startYear - dobYear(partner), sex: partner.sex },
            pct,
          )
        : survivalPercentileAge(primaryAgeNow, primary.sex, pct)
      abwHorizonYear = dobYear(primary) + horizonAge
    }
  }

  const goalScheduler: GoalScheduler | null = guardrailsActive
    ? createGoalScheduler(plan.expenses.oneTimeGoals.map((g, i) => toSchedulableGoal(g, i)))
    : null
  let discretionaryMultiplier = 1
  let startingWithdrawalRate: number | null = null
  let startingRealPortfolio: number | null = null

  // Earnings-test FRA credit: months of benefit fully withheld before FRA are
  // credited back at FRA by recomputing the benefit as if claimed that many
  // months later. Accumulated across the pre-FRA years (persists across the loop).
  const withheldMonthsByPerson = new Map<string, number>()
  const creditedClaimAgeFor = (person: Person, claimAge: ClaimAge, ageAttained: number, capMonths: number): ClaimAge => {
    const originalMonths = claimAgeTotalMonths(claimAge)
    if (originalMonths >= capMonths || ageAttained < Math.floor(capMonths / 12)) return claimAge
    const credited = Math.min(capMonths, originalMonths + (withheldMonthsByPerson.get(person.id) ?? 0))
    return claimAgeFromTotalMonths(credited)
  }

  for (let year = startYear; year <= endYear; year++) {
    const inflFactor = inflFactorFrom(startYear, year)
    const { pack, isStandIn } = packForYear(year)
    const limitGrowth = limitScale(pack, isStandIn, year)

    // Prior Dec 31 balances (RMD base) — captured before this year's flows.
    const startOfYearBalance = new Map(balances.map((b) => [b.account.id, b.balance]))

    // --- annual rebalance to target (start-of-year trade) -------------------
    // Allocated accounts trade drifted weights back to this year's glidepath
    // target. Taxable sells realize gains pro-rata through the same basis-ratio
    // machinery as withdrawals (basis rises by the realized gain: sold basis
    // leaves, the reinvested proceeds enter at market); traditional/Roth/HSA
    // rebalances are tax-free. rebalancing: 'none' opts out — weights drift.
    let rebalanceRealizedGains = 0
    if (year > startYear) {
      for (const state of balances) {
        const track = allocationTrack.get(state.account.id)
        if (!track || track.policy.rebalancing === 'none') continue
        const target = targetWeightsAt(track.policy, year)
        const turnover = rebalanceTurnoverFraction(track.weights, target)
        if (turnover > 1e-9 && state.account.type === 'taxable' && state.balance > 0) {
          const sellAmount = turnover * state.balance
          const basisRatio = Math.min(1, state.costBasis / state.balance)
          const gain = sellAmount * (1 - basisRatio)
          rebalanceRealizedGains += gain
          state.costBasis += gain
        }
        track.weights = target
      }
    }

    // --- annuity purchase funding (guaranteed-income-and-estate-depth) -------
    // A purchased annuity trades a premium out of a funding account in its
    // purchase year. The move is a transfer, not spending: cash and qualified
    // (traditional) sources move at book value; a taxable/equity-comp source
    // realizes gains pro-rata like any sale, folded into this year's realized
    // gains, and the premium leaves the account. A qualified premium leaving a
    // traditional balance shrinks future RMDs automatically. A QLAC premium is
    // held to the statutory cap. The premium actually funded becomes the
    // contract's investment for the non-qualified exclusion ratio.
    for (const account of plan.accounts) {
      if (account.type !== 'annuity' || !account.purchase || account.purchase.year !== year) continue
      const funding = balances.find((b) => b.account.id === account.purchase!.fundingAccountId)
      if (!funding) continue
      let premium = account.purchase.premium
      const qlacCap = pack.annuities.qlacPremiumCap * limitGrowth
      if (account.purchase.qlac && premium > qlacCap) {
        premium = qlacCap
        warnings.add(
          `A QLAC premium above the $${Math.round(qlacCap).toLocaleString()} cap was reduced to the cap (the excess is not QLAC-eligible).`,
        )
      }
      // Only spendable funds can pay the premium: cliff-vesting equity comp with
      // a future vest date is not liquidatable yet, so it cannot fund a purchase
      // (mirrors the withdrawal planner's isSpendableInYear gate).
      const funded = Math.min(premium, spendableBalance(funding, year))
      if (funded < premium - EPSILON) {
        warnings.add('An annuity premium exceeded its funding account balance and was reduced to the available amount.')
      }
      if ((funding.account.type === 'taxable' || funding.account.type === 'equityComp') && funding.balance > 0) {
        const basisRatio = Math.min(1, funding.costBasis / funding.balance)
        rebalanceRealizedGains += funded * (1 - basisRatio)
        funding.costBasis = Math.max(0, funding.costBasis - funded * basisRatio)
      }
      funding.balance -= funded
      annuityInvestmentInContract.set(account.id, (annuityInvestmentInContract.get(account.id) ?? 0) + funded)
    }

    // --- pension lump-sum rollover (annuity-pension-and-home-equity, step 3) -
    // An elected lump sum commutes the pension: the offer amount arrives as a
    // tax-free direct rollover into the named traditional account in the
    // election year (external plan money — nothing leaves another account),
    // and the pension income stream never pays (skipped in the income block).
    for (const account of plan.accounts) {
      if (account.type !== 'pension' || !account.lumpSumElection || !account.lumpSumOffer) continue
      if (account.lumpSumOffer.electionYear !== year) continue
      const target = balances.find((b) => b.account.id === account.lumpSumElection!.rolloverAccountId)
      if (!target) continue
      target.balance += account.lumpSumOffer.amount
    }

    // --- HECM line open (annuity-pension-and-home-equity, step 4) -----------
    // The initial principal limit is the user's quoted percent of the home's
    // value at open (or the pack's published PLF approximation by the youngest
    // borrower's age); financed upfront costs start the loan balance. A line
    // dated before the projection opens in the first projection year at
    // today's value (its pre-projection growth is not reconstructed).
    for (const account of plan.accounts) {
      if (account.type !== 'property' || !account.hecm) continue
      if (year !== Math.max(account.hecm.openYear, startYear)) continue
      if (hecmStates.has(account.id)) continue
      const value = propertyValues.get(account.id) ?? 0
      if (value <= 0) continue
      const youngestAge = Math.min(...people.map((p) => year - dobYear(p)))
      if (youngestAge < 62) {
        warnings.add('A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).')
      }
      const plfPct = account.hecm.principalLimitPct ?? hecmPrincipalLimitFactorPct(pack, youngestAge)
      hecmStates.set(account.id, {
        principalLimit: (plfPct / 100) * value,
        loanBalance: ((account.hecm.upfrontCostPct ?? 0) / 100) * value,
      })
    }

    // --- TIPS-ladder purchase funding ---------------------------------------
    // Same transfer semantics as an annuity premium: the quoted real cost
    // (inflated to the purchase year) leaves the funding account at book value
    // for cash, realizing gains pro-rata for taxable/equity-comp. A partial
    // fill scales every rung down so the ladder delivers exactly what the
    // money bought.
    for (const ls of ladderStates) {
      if (!ls.purchase || ls.purchase.year !== year) continue
      const funding = balances.find((b) => b.account.id === ls.purchase!.fundingAccountId)
      if (!funding) continue
      const cost = ls.costReal * inflFactor
      const funded = Math.min(cost, spendableBalance(funding, year))
      if (funded < cost - EPSILON) {
        ls.scale = cost > 0 ? funded / cost : 0
        warnings.add(
          'A TIPS ladder purchase exceeded its funding account balance; the ladder was scaled down to what the available money buys.',
        )
      }
      if ((funding.account.type === 'taxable' || funding.account.type === 'equityComp') && funding.balance > 0) {
        const basisRatio = Math.min(1, funding.costBasis / funding.balance)
        rebalanceRealizedGains += funded * (1 - basisRatio)
        funding.costBasis = Math.max(0, funding.costBasis - funded * basisRatio)
      }
      funding.balance -= funded
    }

    const peopleStates: PersonYearState[] = people.map((p) => {
      const ageAttained = year - dobYear(p)
      return { personId: p.id, ageAttained, alive: ageAttained <= lifeAgeOf(p) }
    })
    const stateOf = (personId: string) => peopleStates.find((s) => s.personId === personId)!
    const anyAlive = peopleStates.some((s) => s.alive)
    const aliveCount = peopleStates.filter((s) => s.alive).length
    const filingStatusForYear = filingStatusFor(year, aliveCount)
    const taxFilingStatusForYear = taxParameterFilingStatus(filingStatusForYear)

    // --- income ----------------------------------------------------------
    const incomes: YearIncomes = {
      wages: 0,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      total: 0,
    }
    let ordinaryIncome = 0
    /** Subsets of income eligible for state retirement-income exclusions. */
    let privateRetirementOrdinary = 0
    let publicPensionOrdinary = 0
    let oneTimeGains = 0
    let taxableYieldReinvested = 0
    const taxableYieldByAccountId = new Map<string, { gross: number; totalYieldPct: number; reinvest: boolean }>()
    const wagesByPerson = new Map<string, number>()

    for (const state of balances) {
      if (state.account.type !== 'taxable') continue
      const startBalance = Math.max(0, startOfYearBalance.get(state.account.id) ?? state.balance)
      if (startBalance <= 0) continue
      // An allocated brokerage account derives its yield fields from the class
      // blend at this year's weights (step 2 of the allocation plan); explicit
      // account-level fields still override the blend.
      const track = allocationTrack.get(state.account.id)
      const blendedYield = track ? blendedTaxableYield(track.weights, classParams) : null
      const interestYieldPct = Math.max(0, state.account.interestYieldPct ?? blendedYield?.interestYieldPct ?? 0)
      const dividendYieldPct = Math.max(0, state.account.dividendYieldPct ?? blendedYield?.dividendYieldPct ?? 0)
      const totalYieldPct = interestYieldPct + dividendYieldPct
      if (totalYieldPct <= 0) continue
      const interest = startBalance * (interestYieldPct / 100)
      const dividends = startBalance * (dividendYieldPct / 100)
      const qualified = dividends * Math.min(1, Math.max(0, state.account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? 0.85))
      const ordinaryDividends = dividends - qualified
      const gross = interest + dividends

      incomes.taxableInterest += interest
      incomes.ordinaryDividends += ordinaryDividends
      incomes.qualifiedDividends += qualified
      incomes.taxableYield += gross
      ordinaryIncome += interest + ordinaryDividends

      const reinvest = state.account.reinvestDividends ?? true
      if (reinvest) taxableYieldReinvested += gross
      taxableYieldByAccountId.set(state.account.id, { gross, totalYieldPct, reinvest })
    }

    // Pass 1: wages (must precede Social Security for the earnings test).
    for (const stream of plan.incomes) {
      if (stream.type !== 'wages') continue
      const person = personById.get(stream.personId)!
      const s = stateOf(stream.personId)
      const stopAge = stream.endAge ?? person.retirementAge
      if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
      const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
      const amount = stream.annualGross * raiseFactor * inflFactor
      incomes.wages += amount
      ordinaryIncome += amount
      wagesByPerson.set(stream.personId, (wagesByPerson.get(stream.personId) ?? 0) + amount)
    }

    // Pass 2: other non-SS streams.
    for (const stream of plan.incomes) {
      if (stream.type === 'recurring') {
        if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
        if (!anyAlive) continue
        const amount = stream.annualAmount * (stream.inflationAdjusted ? inflFactor : 1)
        incomes.recurring += amount
        if (stream.taxTreatment === 'ordinary') ordinaryIncome += amount
      } else if (stream.type === 'oneTime') {
        if (stream.year !== year) continue
        incomes.oneTime += stream.amount
        if (stream.taxTreatment === 'ordinary') ordinaryIncome += stream.amount
        if (stream.taxTreatment === 'capitalGain') oneTimeGains += stream.amount
      }
    }

    // Pass 3: Social Security. Benefits are computed for everyone (a deceased
    // spouse's hypothetical benefit drives the survivor step-up), then the
    // earnings test withholds from living workers, then survivors step up to
    // max(own, deceased's) — the v1 couples simplification of survivor rules.
    const ssColaFactor =
      plan.assumptions.ssCola.mode === 'matchInflation'
        ? inflFactorFrom(startYear, year)
        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
    const ssHaircutFactor =
      plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
        ? 1 - plan.assumptions.ssHaircut.cutPct / 100
        : 1
    const ssOwnByPerson = new Map<string, number>()
    const ssActualMonthlyByPerson = new Map<string, number>()
    /** PIA + claim age per SS-claiming person, for the spousal top-up below. */
    const ssStreamByPerson = new Map<string, { pia: number; claimAge: { years: number; months: number } }>()
    /** Per-person SSDI info this year (onset age + the pre-SGA annual benefit), for SGA gating + reporting. */
    const ssdiByPerson = new Map<string, { onsetAge: number; benefit: number; fraYears: number }>()
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity') continue
      const pia = resolvedPiaByStreamId.get(stream.id)
      if (pia === undefined) continue // warned during resolution
      ssStreamByPerson.set(stream.personId, { pia, claimAge: stream.claimAge })
      const person = personById.get(stream.personId)!
      const s = stateOf(stream.personId)
      const { y, m, d } = dobParts(person)
      const fra = fraForBirthYear(effectiveBirthYear(y, m, d))

      // SSDI path: a disabled worker receives their full PIA (no early-retirement
      // reduction) from the onset age, gated by SGA pre-FRA, converting to the
      // retirement benefit at FRA at the same dollar amount (no delayed credits).
      // SSDI cannot start at/after FRA (it would have already converted), so an
      // onsetAge >= FRA is treated as invalid — fall through to normal retirement.
      const onsetAge = stream.disability?.onsetAge
      if (onsetAge !== undefined && onsetAge < fra.years) {
        if (s.ageAttained >= onsetAge) {
          const monthly = ssdiMonthlyBenefit(pia)
          const annual = monthly * 12 * ssColaFactor * ssHaircutFactor
          ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
          ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
          ssdiByPerson.set(stream.personId, { onsetAge, benefit: annual, fraYears: fra.years })
        }
        continue // SSDI replaces the retirement-claim path for this stream
      }

      const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
      if (payableMonths <= 0) continue
      // From FRA on, credit any months the earnings test withheld earlier by
      // treating the benefit as if claimed that many months later (capped at FRA).
      const fraMonths = fraTotalMonths(fra)
      const claimForFactor = creditedClaimAgeFor(person, stream.claimAge, s.ageAttained, fraMonths)
      const factor = claimFactor(y, m, d, claimForFactor)
      const monthly = pia * factor
      let annual = monthly * payableMonths * ssColaFactor
      annual *= ssHaircutFactor
      ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
      ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
    }

    // Marital-history menu: a divorced-spousal or survivor benefit on a *former*
    // spouse's record. A person receives the larger of their own benefit and the
    // best eligible such benefit, at their claim age. Divorced-spousal needs a
    // currently-unmarried claimant; survivor is governed by remarriage rules.
    // Runs before the earnings test so that benefit is withheld too (SSA applies
    // the earnings test to dependent/survivor benefits, not just retirement).
    const householdIsSingle = people.length === 1
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity') continue
      if (!stream.formerSpouses || stream.formerSpouses.length === 0) continue
      const s = stateOf(stream.personId)
      const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
      if (!s.alive || payableMonths <= 0) continue
      const claimant = personById.get(stream.personId)!
      const { y, m, d } = dobParts(claimant)
      const retirementFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
      const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
      const best = bestMaritalBenefit(stream.formerSpouses, {
        claimantDob: { year: y, month: m, day: d },
        claimantClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, retirementFraMonths),
        claimantSurvivorClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, survivorFraMonths),
        claimantAge: s.ageAttained,
        year,
        claimantIsSingle: householdIsSingle,
      })
      if (best) {
        const annual = best.monthly * payableMonths * ssColaFactor * ssHaircutFactor
        if (annual > (ssOwnByPerson.get(stream.personId) ?? 0)) ssOwnByPerson.set(stream.personId, annual)
      }
    }

    // Spousal top-up: while both spouses are alive and both have claimed, the
    // lower earner receives max(own, 50% of the higher earner's PIA reduced for
    // the lower earner's claim age). Runs before the earnings test so auxiliary
    // benefits can be withheld, and caps the current-spouse auxiliary to the room
    // left under the worker's retirement/survivor family maximum.
    if (people.length === 2) {
      const [a, b] = people
      const aSs = ssStreamByPerson.get(a!.id)
      const bSs = ssStreamByPerson.get(b!.id)
      if (aSs && bSs) {
        const higher = aSs.pia >= bSs.pia ? { p: a!, ss: aSs } : { p: b!, ss: bSs }
        const lower = aSs.pia >= bSs.pia ? { p: b!, ss: bSs } : { p: a!, ss: aSs }
        const lowerState = stateOf(lower.p.id)
        const higherState = stateOf(higher.p.id)
        const lowerPayableMonths = payableMonthsAtAge(lowerState.ageAttained, lower.ss.claimAge)
        const higherPayableMonths = payableMonthsAtAge(higherState.ageAttained, higher.ss.claimAge)
        const spousalPayableMonths = Math.min(lowerPayableMonths, higherPayableMonths)
        if (lowerState.alive && higherState.alive && spousalPayableMonths > 0) {
          const { y, m, d } = dobParts(lower.p)
          const lowerFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
          const spousalClaimAge = creditedClaimAgeFor(lower.p, lower.ss.claimAge, lowerState.ageAttained, lowerFraMonths)
          const rawSpousalMonthly = 0.5 * higher.ss.pia * spousalBenefitFactor(y, m, d, spousalClaimAge)

          const higherDob = dobParts(higher.p)
          const workerActualMonthly =
            ssActualMonthlyByPerson.get(higher.p.id) ??
            higher.ss.pia *
              claimFactor(
                higherDob.y,
                higherDob.m,
                higherDob.d,
                creditedClaimAgeFor(
                  higher.p,
                  higher.ss.claimAge,
                  higherState.ageAttained,
                  fraTotalMonths(fraForBirthYear(effectiveBirthYear(higherDob.y, higherDob.m, higherDob.d))),
                ),
              )
          // Only the auxiliary excess (spousal rate above the lower earner's own
          // benefit) is paid on the higher earner's record, so only that excess is
          // subject to the worker's family maximum. The lower earner's own benefit
          // is on their own record and is preserved, then the capped excess is added.
          const lowerOwnMonthly = ssActualMonthlyByPerson.get(lower.p.id) ?? 0
          const excessSpousalMonthly = Math.max(0, rawSpousalMonthly - lowerOwnMonthly)
          const cappedExcessMonthly = capAuxiliaryForFamilyMaximum({
            workerPiaMonthly: higher.ss.pia,
            workerActualMonthly,
            workerDob: { year: higherDob.y, month: higherDob.m, day: higherDob.d },
            auxiliaryMonthly: excessSpousalMonthly,
          })
          const spousalTotalMonthly = lowerOwnMonthly + cappedExcessMonthly
          const spousalAnnual = spousalTotalMonthly * spousalPayableMonths * ssColaFactor * ssHaircutFactor
          const own = ssOwnByPerson.get(lower.p.id) ?? 0
          if (spousalAnnual > own) ssOwnByPerson.set(lower.p.id, spousalAnnual)
        }
      }
    }

    // Survivor step-up before the earnings test, then the withholding pass below
    // can reduce survivor benefits for a working survivor before FRA. The
    // survivor keeps the larger of their own benefit and the deceased's benefit,
    // computed with full precision: the survivor base is the deceased's actual
    // monthly benefit, RIB-LIM floors it at 82.5% of the deceased's PIA when the
    // deceased claimed early, and the early-claim widow(er) reduction applies to
    // the survivor's credited claim age.
    if (people.length === 2) {
      const [a, b] = people
      for (const [deceased, survivor] of [
        [a!, b!],
        [b!, a!],
      ] as const) {
        const survivorState = stateOf(survivor.id)
        if (stateOf(deceased.id).alive || !survivorState.alive) continue
        const survivorStream = ssStreamByPerson.get(survivor.id)
        const deceasedPia = ssStreamByPerson.get(deceased.id)?.pia
        const deceasedActualMonthly = ssActualMonthlyByPerson.get(deceased.id) ?? 0
        if (!survivorStream || deceasedPia === undefined || deceasedActualMonthly <= 0) continue
        const payableMonths = payableMonthsAtAge(survivorState.ageAttained, survivorStream.claimAge)
        if (payableMonths <= 0) continue
        const ownBenefit = ssOwnByPerson.get(survivor.id) ?? 0
        const { y, m, d } = dobParts(survivor)
        const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
        const survivorClaimAge = creditedClaimAgeFor(survivor, survivorStream.claimAge, survivorState.ageAttained, survivorFraMonths)
        const survivorAnnual =
          survivorBenefitMonthly({
            deceasedPiaMonthly: deceasedPia,
            deceasedActualMonthly,
            survivorClaimAge,
            survivorFraMonths,
          }) *
          payableMonths *
          ssColaFactor *
          ssHaircutFactor
        if (survivorAnnual > ownBenefit) ssOwnByPerson.set(survivor.id, survivorAnnual)
      }
    }

    // Earnings test: claiming before FRA while working withholds benefits
    // ($1 per $2 below FRA; $1 per $3 in the FRA calendar year — annual
    // approximation). Withheld whole months accumulate and are credited back at
    // FRA above (the benefit is recomputed as if claimed that many months later).
    // SSDI recipients are gated by Substantial Gainful Activity instead (SSA
    // replaces the retirement earnings test with SGA for disabled workers).
    let ssEarningsTestWithheld = 0
    let ssdiPaid = 0
    for (const [personId, benefit] of ssOwnByPerson) {
      const s = stateOf(personId)
      if (!s.alive || benefit <= 0) continue
      const ssdi = ssdiByPerson.get(personId)
      if (ssdi) {
        // SSDI recipient: SGA gates the pre-FRA window only (post-FRA it has
        // converted to retirement; before onset no benefit is paid). No ARF.
        let paid = benefit
        if (inSsdiWindow(s.ageAttained, ssdi.onsetAge, ssdi.fraYears)) {
          const wages = wagesByPerson.get(personId) ?? 0
          const annualSga = pack.socialSecurity.sgaMonthlyNonBlind * 12 * limitGrowth
          if (wages > 0 && ssdiSuspendedBySga(wages, annualSga)) {
            paid = 0
            ssOwnByPerson.set(personId, 0)
            warnings.add(
              'Earnings above Substantial Gainful Activity (SGA) suspended Social Security disability (SSDI) for a working year.',
            )
          }
        }
        ssdiPaid += paid
        continue // no retirement earnings test for SSDI recipients
      }
      const wages = wagesByPerson.get(personId) ?? 0
      if (wages <= 0) continue
      const person = personById.get(personId)!
      const { y, m, d } = dobParts(person)
      const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
      let withheld = 0
      if (s.ageAttained < fraYears) {
        withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth) / 2)
      } else if (s.ageAttained === fraYears) {
        withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth) / 3)
      }
      withheld = Math.min(withheld, benefit)
      if (withheld > 0) {
        ssOwnByPerson.set(personId, benefit - withheld)
        ssEarningsTestWithheld += withheld
        // Whole months of benefit withheld this year (annual approximation),
        // credited back at FRA. COLA cancels in the ratio. Capped at the months
        // actually payable this year — the first claim year is prorated when the
        // claim starts mid-year, so it has fewer than 12 payable months.
        const claimAge = ssStreamByPerson.get(personId)?.claimAge
        const payableMonths = claimAge ? payableMonthsAtAge(s.ageAttained, claimAge) : 12
        const monthsWithheld = Math.min(payableMonths, Math.round((withheld / benefit) * payableMonths))
        withheldMonthsByPerson.set(personId, (withheldMonthsByPerson.get(personId) ?? 0) + monthsWithheld)
        warnings.add(
          'The earnings test withheld benefits for working early claimants; withheld months are credited back at full retirement age (annual approximation).',
        )
      }
    }

    // Sum the living household's post-withholding Social Security benefits.
    for (const [personId, benefit] of ssOwnByPerson) {
      if (stateOf(personId).alive) incomes.socialSecurity += benefit
    }

    for (const account of plan.accounts) {
      if (account.type === 'pension' || account.type === 'annuity') {
        // A commuted pension (lump-sum election) stops paying once the
        // election takes effect — the offer amount rolls over in the election
        // year instead. A pension already in pay before a later election year
        // keeps its normal payments until then.
        if (
          account.type === 'pension' &&
          account.lumpSumElection &&
          account.lumpSumOffer &&
          year >= account.lumpSumOffer.electionYear
        ) {
          continue
        }
        const ownerId = account.ownerPersonId ?? primary.id
        const owner = personById.get(ownerId)!
        const ownerState = stateOf(ownerId)
        const startCalendarYear = dobYear(owner) + account.startAge
        if (year < startCalendarYear) continue
        // A purchased annuity cannot pay before its premium is funded — the
        // contract begins in the purchase year. Guard against a startAge that
        // would otherwise pay (and cache an investment=0 exclusion state that
        // stays fully taxable) in years before the premium is withdrawn.
        if (account.type === 'annuity' && account.purchase && year < account.purchase.year) continue
        const yearsSinceStart = year - startCalendarYear
        const grown = account.monthlyAmount * 12 * Math.pow(1 + account.colaPct / 100, yearsSinceStart)
        if (account.type === 'annuity') {
          // Payout form (life-only / period-certain / joint & survivor) sets
          // how much of the full payment is paid this year; life-only (the
          // default) pays only while the owner is alive, exactly as before.
          const otherState = peopleStates.find((s) => s.personId !== ownerId)
          const paidFraction = annuityPayoutFraction(annuityPayoutForm(account), {
            ownerAlive: ownerState.alive,
            otherAlive: otherState?.alive ?? false,
            anyAlive,
            yearsSinceStart,
          })
          if (paidFraction <= 0) continue
          const paid = grown * paidFraction
          incomes.annuity += paid
          // Taxable portion of the payment:
          //  - qualified purchase  → fully ordinary (pre-tax dollars funded it);
          //  - non-qualified purchase → IRS Pub 939 exclusion ratio, so a fixed
          //    share of each payment is a tax-free return of the premium until
          //    the whole investment has been recovered, then fully taxable
          //    (the ratio reflects the payout form; a survivor/beneficiary
          //    continues the same excludable share);
          //  - no purchase (already-owned stream) → the entered taxablePct.
          let annuityTaxable: number
          if (account.purchase?.taxQualification === 'qualified') {
            annuityTaxable = paid
          } else if (account.purchase) {
            let ex = annuityExclusionState.get(account.id)
            if (!ex) {
              const investment = annuityInvestmentInContract.get(account.id) ?? 0
              const jointAnnuitant = plan.household.people.find((p) => p.id !== ownerId)
              // Expected return = full annual payment × the form's multiple
              // (the multiple already weights any reduced survivor share).
              const expectedReturn = grown * annuityExclusionMultiple(pack, account, owner, jointAnnuitant)
              const ratio = expectedReturn > 0 ? Math.min(1, investment / expectedReturn) : 0
              ex = { ratio, remaining: investment }
              annuityExclusionState.set(account.id, ex)
            }
            const excludable = Math.min(paid * ex.ratio, ex.remaining)
            ex.remaining -= excludable
            annuityTaxable = paid - excludable
          } else {
            annuityTaxable = paid * (account.taxablePct / 100)
          }
          ordinaryIncome += annuityTaxable
          privateRetirementOrdinary += annuityTaxable
        } else {
          const survivor = peopleStates.find((s) => s.personId !== ownerId && s.alive)
          // Survivor benefit requires payments to have started before the owner died.
          const ownerStartedBeforeDeath = lifeAgeOf(owner) >= account.startAge
          if (ownerState.alive) {
            incomes.pension += grown
            ordinaryIncome += grown
            if ((account.source ?? 'private') === 'public') publicPensionOrdinary += grown
            else privateRetirementOrdinary += grown
          } else if (survivor && ownerStartedBeforeDeath) {
            const amount = grown * (account.survivorPct / 100)
            incomes.pension += amount
            ordinaryIncome += amount
            if ((account.source ?? 'private') === 'public') publicPensionOrdinary += amount
            else privateRetirementOrdinary += amount
          }
        }
      }
    }
    // --- TIPS-ladder cash flows ---------------------------------------------
    // Coupons + maturing principal are cash income; the taxable amount is the
    // coupons plus this year's inflation accretion on the outstanding face
    // (the phantom-income OID a taxable TIPS holder reports) — maturing
    // principal itself is a tax-free return of already-taxed dollars. Federal
    // ordinary income (incl. NIIT); state-exempt as U.S. government interest.
    let ladderTaxableInterest = 0
    let ladderValueTotal = 0
    for (const ls of ladderStates) {
      const offset = year - ls.anchorYear
      if (offset < 1) {
        // Purchase year (offset 0): the rungs are owned — no flows yet, but
        // their full face rides in net worth so the transfer is value-neutral.
        if (ls.purchase && year >= ls.purchase.year) {
          ladderValueTotal += ladderRemainingFace(ls.rungs, 0) * ls.scale * inflFactor
        }
        continue
      }
      if (anyAlive) {
        const flows = ladderRealFlowsAtOffset(ls.rungs, offset)
        const cash = (flows.coupons + flows.maturingPrincipal) * ls.scale * inflFactor
        const prevInflFactor = inflFactorFrom(startYear, year - 1)
        const accretion = flows.outstandingFace * ls.scale * Math.max(0, inflFactor - prevInflFactor)
        const taxable = flows.coupons * ls.scale * inflFactor + accretion
        incomes.tipsLadder += cash
        ordinaryIncome += taxable
        ladderTaxableInterest += taxable
        ladderValueTotal += ladderRemainingFace(ls.rungs, offset) * ls.scale * inflFactor
      } else {
        // No one alive: rungs stop maturing — freeze the remaining face as of
        // the last living year (the rung maturing that year already paid cash)
        // so unmatured principal rides in the estate at its inflation-indexed
        // book value instead of shrinking as offset-space maturities pass.
        const lastAliveOffset = Math.max(0, ladderLastAliveYear - ls.anchorYear)
        ladderValueTotal += ladderRemainingFace(ls.rungs, lastAliveOffset) * ls.scale * inflFactor
      }
    }

    incomes.total =
      incomes.wages +
      incomes.socialSecurity +
      incomes.pension +
      incomes.annuity +
      incomes.tipsLadder +
      incomes.recurring +
      incomes.oneTime +
      incomes.taxableYield

    // --- expenses ---------------------------------------------------------
    const primaryAge = stateOf(primary.id).ageAttained
    let phaseMultiplier = 1
    for (const phase of [...plan.expenses.phases].sort((a, b) => a.fromAge - b.fromAge)) {
      if (primaryAge >= phase.fromAge) phaseMultiplier = phase.multiplier
    }
    // Survivor years (exactly one member of a multi-person household alive)
    // scale base + phase spending by the plan's survivor percentage. One-time
    // goals and the separately-modeled healthcare/debt/property costs are not
    // scaled — they carry their own person- or account-level lifecycles.
    const survivorSpendingFactor =
      peopleStates.length > 1 && aliveCount === 1 ? (plan.expenses.survivorSpendingPct ?? 100) / 100 : 1
    // Split the annual lifestyle target into required, target, ideal, and excess
    // layers. Absent optional fields keep older plans on the exact old shape:
    // baseAnnual is the target lifestyle, with no annual upside layers.
    const lifestyleScale = anyAlive ? inflFactor * phaseMultiplier * survivorSpendingFactor : 0
    let scaledTargetLifestyle = plan.expenses.baseAnnual * lifestyleScale
    const requiredAnnualToday = Math.min(
      plan.expenses.requiredAnnual ?? plan.expenses.baseAnnual,
      plan.expenses.baseAnnual,
    )
    let requiredLifestyleNominal = requiredAnnualToday * lifestyleScale
    let idealLifestyleNominal = (plan.expenses.idealAnnual ?? 0) * lifestyleScale
    let excessLifestyleNominal = (plan.expenses.excessAnnual ?? 0) * lifestyleScale
    if (abwActive) {
      // ABW replaces the whole recurring lifestyle stack: baseAnnual, phases,
      // survivor scaling, and the required/ideal/excess layers are ignored and
      // the target is the amortized payment from the actual start-of-year
      // portfolio (nominal — the payment ratio is inflation-invariant, see
      // engine/spending/abw.ts). Healthcare, debt, property, insurance, and
      // one-time goals stay separately modeled on top.
      let startPortfolio = 0
      for (const b of balances) startPortfolio += startOfYearBalance.get(b.account.id) ?? 0
      scaledTargetLifestyle = anyAlive
        ? abwAnnualPayment(startPortfolio, abwRealReturnPct, abwTiltPct, abwHorizonYear - year + 1)
        : 0
      requiredLifestyleNominal = 0
      idealLifestyleNominal = 0
      excessLifestyleNominal = 0
    }
    const {
      requiredLifestyle,
      targetLifestyle,
      idealLifestyle,
      excessLifestyle,
    } = splitAnnualSpendingLayers({
      baseAnnualNominal: scaledTargetLifestyle,
      requiredAnnualNominal: requiredLifestyleNominal,
      idealAnnualNominal: idealLifestyleNominal,
      excessAnnualNominal: excessLifestyleNominal,
    })
    let debtService = 0
    for (const account of plan.accounts) {
      if (account.type !== 'debt') continue
      let bal = debtBalances.get(account.id) ?? 0
      if (bal <= 0) continue
      bal *= 1 + account.interestPct / 100
      // A scheduled payoff year clears the whole remaining balance at once
      // (funded by the withdrawal waterfall below); otherwise pay the level
      // annual amount, capped at the balance so the loan self-terminates.
      const payoff = typeof account.payoffYear === 'number' && year >= account.payoffYear
      const payment = payoff ? bal : Math.min(bal, account.monthlyPayment * 12)
      bal -= payment
      debtBalances.set(account.id, bal)
      debtService += payment
    }
    // Healthcare: ACA-credited marketplace pre-65, Medicare + IRMAA from 65.
    // Medicare eligibility begins in the birth month of the year a member
    // turns 65 (planning-grade: the born-on-the-1st prior-month rule is not
    // modeled), so the transition year splits into birthMonth − 1 months of
    // marketplace coverage and the remainder on Medicare instead of flipping
    // the whole year at once.
    const hc = plan.expenses.healthcare
    const healthInflFactor = healthInflFactorFrom(startYear, year)
    let healthcare = 0
    // The ACA credit is a household calculation and a MONTHLY one: covered
    // members' premiums pool per calendar month, and each covered month earns
    // max(0, premium − expectedContribution/12) — so a transition-year member
    // covered five months owes 5/12 of the household expected contribution,
    // not all of it, and the contribution is never subtracted per person.
    const acaMonthlyPremiums: number[] = new Array<number>(12).fill(0)
    // SSA-44 (see setup above): in the two years after a qualifying event, the
    // premium MAGI is the lower of the lookback and the prior-year stand-in.
    const irmaaMagi = ssa44ActiveInYear(year)
      ? Math.min(magiFor(year - 2), magiFor(year - 1))
      : magiFor(year - 2)
    // IRMAA's filing categories differ from the income-tax tables: SSA groups
    // qualifying-surviving-spouse filers with single/HOH on the individual
    // threshold table (POMS HI 01101.020), so QSS years price premiums at the
    // single thresholds even though their income tax uses the joint tables.
    const irmaaFilingStatus = filingStatusForYear === 'qualifyingSurvivingSpouse' ? 'single' : taxFilingStatusForYear
    let medicarePremiums = 0
    let irmaaTier = 0
    for (const s of peopleStates) {
      if (!s.alive) continue
      const acaMonths = s.ageAttained < 65 ? 12 : s.ageAttained === 65 ? (birthMonthByPerson.get(s.personId) ?? 1) - 1 : 0
      const medicareMonths = 12 - acaMonths
      if (acaMonths > 0 && hc.pre65MonthlyPremiumPerPerson > 0) {
        if (hc.applyAcaCredit) {
          for (let m = 0; m < acaMonths; m++) acaMonthlyPremiums[m]! += hc.pre65MonthlyPremiumPerPerson * healthInflFactor
        } else {
          healthcare += hc.pre65MonthlyPremiumPerPerson * acaMonths * healthInflFactor
        }
      }
      if (medicareMonths > 0) {
        const med = medicareAnnualPremiumPerPerson(
          pack,
          irmaaMagi,
          irmaaFilingStatus,
          inflFactorFrom(pack.year, year),
          healthInflFactorFrom(pack.year, year),
        )
        if (med.partDSurchargeUnverified) {
          warnings.add('An IRMAA tier with an unverified Part D surcharge was hit; Part D surcharge omitted for that tier.')
        }
        const premium = (med.partBAnnual + med.partDSurchargeAnnual) * (medicareMonths / 12)
        medicarePremiums += premium
        irmaaTier = med.irmaaTier
        healthcare += premium + hc.medicareExtrasMonthlyPerPerson * medicareMonths * healthInflFactor
      }
    }
    if (acaMonthlyPremiums.some((premium) => premium > 0)) {
      // Credit estimated against last year's MAGI (current-year MAGI would
      // be circular with withdrawals; reconciliation differences ignored).
      const fplScale = inflFactorFrom(pack.year, year)
      const aca = acaNetAnnualPremiumByMonth(pack, aliveCount, magiFor(year - 1), acaMonthlyPremiums, fplScale)
      if (aca.overCliff) {
        warnings.add('Some pre-65 years exceed 400% of the federal poverty line: no ACA credit (the cliff).')
      }
      healthcare += aca.netAnnualPremium
    }

    // Insurance premiums: level (fixed nominal), charged while the insured/owner
    // is alive. paidUp charges nothing; untilAge stops at premiumEndAge.
    let insurancePremiums = 0
    for (const policy of plan.insurance) {
      if (policy.premiumMode === 'paidUp') continue
      const subjectId = policy.kind === 'ltc' ? policy.owner : policy.insured
      const s = stateOf(subjectId)
      if (!s.alive) continue
      if (policy.premiumMode === 'untilAge' && policy.premiumEndAge !== undefined && s.ageAttained >= policy.premiumEndAge) {
        continue
      }
      insurancePremiums += policy.annualPremium
    }

    // LTC care episodes: a deterministic late-life cost spike, additive to
    // baseline spending. An owned LTC policy offsets it up to its monthly cap
    // (grown by the inflation rider) after the elimination period, for at most
    // benefitPeriodYears. The net (careCost − ltcBenefit) is what hits spending.
    let careCost = 0
    let ltcBenefit = 0
    for (const event of plan.careEvents) {
      const s = stateOf(event.personId)
      if (!s.alive) continue
      const yearsIntoEpisode = s.ageAttained - event.startAge
      if (yearsIntoEpisode < 0 || yearsIntoEpisode >= event.durationYears) continue
      const gross = event.annualCost * healthInflFactor
      careCost += gross
      let remaining = gross
      for (const policy of plan.insurance) {
        if (policy.kind !== 'ltc' || policy.owner !== event.personId || remaining <= 0) continue
        const used = ltcBenefitYearsUsed.get(policy.id) ?? 0
        if (policy.benefitPeriodYears !== 'lifetime' && used >= policy.benefitPeriodYears) continue
        const rider = (policy.inflationRiderPct ?? 0) / 100
        let cap = policy.benefitMonthly * 12 * Math.pow(1 + rider, year - startYear)
        // Elimination period: the first eliminationPeriodDays of the episode are
        // out of pocket, so the episode's first year is prorated.
        if (yearsIntoEpisode === 0) cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
        const pay = Math.min(remaining, cap)
        if (pay > 0) {
          ltcBenefit += pay
          remaining -= pay
          ltcBenefitYearsUsed.set(policy.id, used + 1)
        }
      }
    }

    // Property carrying costs: tax + insurance charged while the property is
    // owned, continuing after any mortgage is paid off — the part of a PITI
    // payment the debt account deliberately excludes. Today's dollars, inflated;
    // skipped from the sale year on, and (like base spending) once nobody is alive.
    let propertyCosts = 0
    if (anyAlive) {
      for (const account of plan.accounts) {
        if (account.type !== 'property') continue
        if (account.plannedSaleYear !== null && year >= account.plannedSaleYear) continue
        propertyCosts += ((account.propertyTaxAnnual ?? 0) + (account.insuranceAnnual ?? 0)) * inflFactor
      }
    }

    // System-computed costs are required by default: a plan must never report
    // "floor success" after silently cutting healthcare, housing, debt, or care.
    const netCare = careCost - ltcBenefit // ltcBenefit is capped at careCost above
    const systemRequired = debtService + propertyCosts + healthcare + insurancePremiums + netCare

    // HSA qualified-withdrawal cap (steps 2–3): the household's modeled medical
    // costs this year (healthcare premiums + net care costs), plus the
    // accumulated reimburse-later pool when any HSA opts in. Cap-mode HSA
    // withdrawals are tax- and penalty-free only up to this.
    const qualifiedMedicalThisYear = healthcare + netCare
    const hsaQualifiedCap = qualifiedMedicalThisYear + (hsaReimburseLaterActive ? hsaReimbursablePool : 0)

    // Withdrawal-rate guardrail decision (before funding). The signal is this
    // year's recurring target spending over the start-of-year portfolio, compared
    // to the same ratio in the first solvent year. Cutting/raising moves the
    // discretionary multiplier; the required floor is never touched.
    let guardrailAction: GuardrailAction = 'hold'
    const earlyPullGoalBudget = guardrailsActive
      ? plan.expenses.oneTimeGoals.reduce((sum, goal) => {
          if (goalScheduler?.isResolved(goal.id)) return sum
          const flexibility = goal.flexibility ?? 'fixed'
          if (flexibility === 'fixed') return sum
          const earliestYear = Math.min(goal.earliestYear ?? goal.year, goal.year)
          if (year >= earliestYear && year < goal.year) return sum + goal.amount * inflFactor
          return sum
        }, 0)
      : 0
    const annualUpsideLifestyle = idealLifestyle + excessLifestyle
    const guardrailStepBasis = Math.max(targetLifestyle, annualUpsideLifestyle, 1)
    const allowRaisesAboveTarget = spendingPolicy?.allowRaisesAboveTarget ?? annualUpsideLifestyle + earlyPullGoalBudget > 0
    const maxGuardrailMultiplier =
      guardrailsActive && allowRaisesAboveTarget
        ? 1 + (annualUpsideLifestyle + earlyPullGoalBudget) / guardrailStepBasis
        : 1
    if (guardrailsActive && anyAlive) {
      let startPortfolio = 0
      for (const b of balances) startPortfolio += startOfYearBalance.get(b.account.id) ?? 0
      if (riskBasedGuardrails) {
        // Risk-based signal: the real (deflated) balance against dollar
        // thresholds expressed as a percent of the starting portfolio. The
        // thresholds come from the shared-path probability solver; when they
        // have not been solved the decision holds every year (mode is inert).
        const realBalance = startPortfolio / inflFactor
        if (startingRealPortfolio === null && startPortfolio > 0) startingRealPortfolio = realBalance
        if (startingRealPortfolio !== null) {
          const decision = nextBalanceGuardrailMultiplier(
            discretionaryMultiplier,
            realBalance,
            startingRealPortfolio,
            guardrailPolicy,
            maxGuardrailMultiplier,
          )
          discretionaryMultiplier = decision.multiplier
          guardrailAction = decision.action
        }
      } else {
        const targetRecurring = systemRequired + requiredLifestyle + targetLifestyle
        const currentRate = startPortfolio > 0 ? targetRecurring / startPortfolio : NaN
        if (startingWithdrawalRate === null && Number.isFinite(currentRate)) startingWithdrawalRate = currentRate
        if (startingWithdrawalRate !== null) {
          const decision = nextGuardrailMultiplier(
            discretionaryMultiplier,
            currentRate,
            startingWithdrawalRate,
            guardrailPolicy,
            maxGuardrailMultiplier,
          )
          discretionaryMultiplier = decision.multiplier
          guardrailAction = decision.action
        }
      }
    }
    const targetLifestyleFunded = guardrailsActive
      ? targetLifestyle * Math.min(1, discretionaryMultiplier)
      : targetLifestyle
    const upsideBudget = guardrailsActive
      ? Math.max(0, discretionaryMultiplier - 1) * guardrailStepBasis
      : annualUpsideLifestyle
    const idealLifestyleFunded = Math.min(idealLifestyle, upsideBudget)
    const excessLifestyleFunded = Math.min(excessLifestyle, Math.max(0, upsideBudget - idealLifestyleFunded))
    const remainingUpsideBudget = Math.max(0, upsideBudget - idealLifestyleFunded - excessLifestyleFunded)
    const cutting = guardrailsActive && discretionaryMultiplier < 1 - 1e-9
    const canPullForwardGoals = guardrailsActive && !cutting && (guardrailAction === 'raise' || discretionaryMultiplier > 1 + 1e-9)

    // One-time goals. Under guardrails they route through the scheduler (which
    // may delay/skip flexible goals when cutting); otherwise every goal funds in
    // its target year exactly, as it always has. A *skipped* goal is intended
    // spending that never happens, so its amount is tracked as a target miss (a
    // required-classified skip is also a required miss) rather than silently
    // vanishing from both sides of the ledger.
    let oneTimeGoalsFunded = 0
    let requiredGoalsFunded = 0
    let targetGoalsFunded = 0
    let idealGoalsFunded = 0
    let excessGoalsFunded = 0
    let skippedTargetNominal = 0
    let skippedIdealNominal = 0
    let skippedExcessNominal = 0
    let skippedRequiredNominal = 0
    const goalOutcomeCounts = { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 }
    if (anyAlive) {
      if (goalScheduler) {
        const plannedGoals = goalScheduler.planYear(year, {
          inflFactor,
          cutting,
          canPullForward: canPullForwardGoals,
          availableBudget: cutting ? 0 : canPullForwardGoals ? remainingUpsideBudget : null,
        })
        for (const r of plannedGoals.results) {
          if (r.outcome === 'funded' || r.outcome === 'partiallyFunded') {
            oneTimeGoalsFunded += r.fundedNominal
            if (r.classification === 'required') requiredGoalsFunded += r.fundedNominal
            else if (r.classification === 'target') targetGoalsFunded += r.fundedNominal
            else if (r.classification === 'ideal') idealGoalsFunded += r.fundedNominal
            else excessGoalsFunded += r.fundedNominal
            if (r.outcome === 'funded') goalOutcomeCounts.funded++
            else goalOutcomeCounts.partiallyFunded++
            goalOutcomeCounts.fundedAmount += r.fundedNominal
            goalOutcomeCounts.unfundedAmount += r.unfundedNominal
            if (r.unfundedNominal > 0) {
              if (r.classification === 'required') skippedRequiredNominal += r.unfundedNominal
              else if (r.classification === 'target') skippedTargetNominal += r.unfundedNominal
              else if (r.classification === 'ideal') skippedIdealNominal += r.unfundedNominal
              else skippedExcessNominal += r.unfundedNominal
            }
          } else if (r.outcome === 'deferred') {
            goalOutcomeCounts.deferred++
          } else {
            if (r.classification === 'required') skippedRequiredNominal += r.amountNominal
            else if (r.classification === 'target') skippedTargetNominal += r.amountNominal
            else if (r.classification === 'ideal') skippedIdealNominal += r.amountNominal
            else skippedExcessNominal += r.amountNominal
            goalOutcomeCounts.unfundedAmount += r.amountNominal
            goalOutcomeCounts.skipped++
          }
        }
      } else {
        for (const goal of plan.expenses.oneTimeGoals) {
          if (goal.year !== year) continue
          const amount = goal.amount * inflFactor
          oneTimeGoalsFunded += amount
          const classification = goal.classification ?? 'target'
          if (classification === 'required') requiredGoalsFunded += amount
          else if (classification === 'target') targetGoalsFunded += amount
          else if (classification === 'ideal') idealGoalsFunded += amount
          else excessGoalsFunded += amount
        }
      }
    }

    const baseSpending = requiredLifestyle + targetLifestyleFunded + idealLifestyleFunded + excessLifestyleFunded
    // Base layers are funding-consistent (they exclude skipped goals) so the
    // shortfall attribution below stays clean; skipped goals are folded back into
    // the *reported* required/target totals and the shortfalls as explicit deltas.
    const requiredSpendingBase = systemRequired + requiredLifestyle + requiredGoalsFunded
    const targetSpendingBase = systemRequired + requiredLifestyle + targetLifestyle + targetGoalsFunded + requiredGoalsFunded
    const idealSpendingBase = idealLifestyle + idealGoalsFunded
    const excessSpendingBase = excessLifestyle + excessGoalsFunded

    const expenses: YearExpenses = {
      baseSpending,
      oneTimeGoals: oneTimeGoalsFunded,
      debtService,
      propertyCosts,
      healthcare,
      insurancePremiums,
      careCost,
      ltcBenefit,
      requiredSpending: requiredSpendingBase + skippedRequiredNominal,
      targetSpending: targetSpendingBase + skippedTargetNominal + skippedRequiredNominal,
      idealSpending: idealSpendingBase + skippedIdealNominal,
      excessSpending: excessSpendingBase + skippedExcessNominal,
      intendedSpending:
        targetSpendingBase +
        idealSpendingBase +
        excessSpendingBase +
        skippedTargetNominal +
        skippedRequiredNominal +
        skippedIdealNominal +
        skippedExcessNominal,
      guardrailFactor: discretionaryMultiplier,
      total:
        baseSpending + oneTimeGoalsFunded + debtService + propertyCosts + healthcare + insurancePremiums + careCost - ltcBenefit,
    }

    // --- fixed-asset dispositions (step 6) ----------------------------------
    // With a cost basis on a property account, this year's planned sale is
    // priced exactly — selling costs, §121 primary-residence exclusion, and
    // depreciation recapture — and its gains join the year's tax base up
    // front. Net proceeds enter the cash flow (so the sale can fund its own
    // tax), and the property-events block below zeroes the value without the
    // legacy tax-free deposit. Without a cost basis the legacy
    // expectedNetProceeds path is untouched.
    let propertySaleProceedsTotal = 0
    for (const account of plan.accounts) {
      if (account.type !== 'property' || account.plannedSaleYear !== year || account.costBasis === undefined) continue
      const value = propertyValues.get(account.id) ?? 0
      if (value <= 0) continue
      // Match the property-events block: the sale year's inflation growth
      // accrues before the sale.
      const sale = propertySaleTax({
        salePrice: value * (1 + inflRateAt(year)),
        costBasis: account.costBasis,
        sellingCostPct: account.sellingCostPct,
        primaryResidence: account.primaryResidence,
        depreciationRecapture: account.depreciationRecapture,
        filingStatus: taxFilingStatusForYear,
        pack,
      })
      ordinaryIncome += sale.ordinaryGain
      oneTimeGains += sale.capitalGain
      // A HECM on the sold home is repaid from the proceeds, non-recourse:
      // the payoff never exceeds what the sale nets, and the line closes.
      // (Loan repayment does not change the taxable gain computed above.)
      const hecmState = hecmStates.get(account.id)
      let hecmPayoff = 0
      if (hecmState) {
        hecmPayoff = Math.min(hecmState.loanBalance, Math.max(0, sale.netProceeds))
        hecmStates.delete(account.id)
      }
      propertySaleProceedsTotal += sale.netProceeds - hecmPayoff
    }

    // --- contributions & employer match --------------------
    let contributions = 0
    let employerMatch = 0
    let preTaxContributions = 0
    // Deposit destinations for the optimizer probe: the LP models balances as
    // owner-traditional vs everything-else buckets, so contributions and match
    // must arrive in the matching compressed bucket, not vanish as spending.
    let traditionalInflow = 0
    let otherInflow = 0
    let taxableInflow = 0
    const groupUsed = new Map<string, number>()
    const addition415cUsed = new Map<string, number>()

    for (const state of balances) {
      const account = state.account
      const hasSchedule = 'contributionSchedule' in account && account.contributionSchedule && account.contributionSchedule.length > 0
      if (account.annualContribution <= 0 && !hasSchedule) continue
      if (!acceptsContributions(account)) continue // inherited accounts can't receive contributions
      const ownerId = account.ownerPersonId ?? primary.id
      const ownerState = stateOf(ownerId)
      if (!ownerState.alive) continue

      let desired = 0
      if (hasSchedule) {
        const owner = personById.get(ownerId)!
        const ownerBirthYear = dobYear(owner)
        const ownerAgeAtStartYear = startYear - ownerBirthYear
        for (const phase of account.contributionSchedule!) {
          const fromAge = phase.fromAge ?? 0
          const toAge = phase.toAge ?? 120
          const age = ownerState.ageAttained
          if (age >= fromAge && age <= toAge) {
            const phaseStartYear = phase.fromAge !== null
              ? startYear + (phase.fromAge - ownerAgeAtStartYear)
              : startYear
            const yearsElapsed = Math.max(0, year - phaseStartYear)
            desired += phase.annualAmount * Math.pow(1 + phase.escalationPct / 100, yearsElapsed) * inflFactor
          }
        }
        // Employer accounts require wages even with a schedule
        const isEmployer = (account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer'
        if (isEmployer && (wagesByPerson.get(ownerId) ?? 0) <= 0) {
          desired = 0
        }
      } else {
        // Legacy behavior: must have wages
        if ((wagesByPerson.get(ownerId) ?? 0) <= 0) {
          desired = 0
        } else {
          desired = account.annualContribution * inflFactor
        }
      }

      if (desired <= 0) continue

      let allowed = desired
      let groupKey: string | null = null
      let limit = Infinity
      const age = ownerState.ageAttained
      if ((account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer') {
        groupKey = `${ownerId}:employer`
        const catchUp =
          age >= 60 && age <= 63
            ? pack.contributionLimits.superCatchUp60to63
            : age >= 50
              ? pack.contributionLimits.catchUp50
              : 0
        limit = (pack.contributionLimits.employee401k + catchUp) * limitGrowth
      } else if ((account.type === 'traditional' || account.type === 'roth') && account.kind === 'ira') {
        groupKey = `${ownerId}:ira`
        const catchUp = age >= 50 ? pack.contributionLimits.iraCatchUp50 : 0
        limit = (pack.contributionLimits.ira + catchUp) * limitGrowth
      } else if (account.type === 'hsa') {
        groupKey = `${ownerId}:hsa`
        const base = people.length === 2 ? pack.contributionLimits.hsaFamily : pack.contributionLimits.hsaSelfOnly
        const catchUp = age >= 55 ? pack.contributionLimits.hsaCatchUp55 : 0
        limit = (base + catchUp) * limitGrowth
      }
      if (groupKey !== null) {
        const used = groupUsed.get(groupKey) ?? 0
        allowed = Math.max(0, Math.min(desired, limit - used))
        if (allowed < desired - EPSILON) {
          warnings.add('Some contributions were reduced to stay within IRS annual limits.')
        }
        groupUsed.set(groupKey, used + allowed)
      }
      if (allowed <= 0) continue

      // Update employee contribution inside 415(c) tracker
      const isEmployerAccount = (account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer'
      if (isEmployerAccount) {
        addition415cUsed.set(ownerId, (addition415cUsed.get(ownerId) ?? 0) + allowed)
      }

      state.balance += allowed
      if (account.type === 'taxable' || account.type === 'equityComp') state.costBasis += allowed
      // Direct Roth contributions add to the always-accessible basis (employer
      // Roth contributions are treated the same here, a planning simplification).
      if (account.type === 'roth') {
        const rb = rothBasis.get(rothPoolKey(account))
        if (rb) rb.contributionBasis += allowed
      }
      contributions += allowed
      if (account.type === 'traditional' || account.type === 'hsa') preTaxContributions += allowed
      if (account.type === 'traditional') traditionalInflow += allowed
      else otherInflow += allowed
      if (account.type === 'taxable' || account.type === 'equityComp') taxableInflow += allowed

      // Employer match calculation
      if (isEmployerAccount && 'employerMatch' in account && account.employerMatch) {
        const matchInfo = account.employerMatch
        const ownerWages = wagesByPerson.get(ownerId) ?? 0
        if (ownerWages > 0) {
          const matchCap = (matchInfo.capPctOfPay / 100) * ownerWages
          const baseMatch = Math.min(allowed, matchCap)
          let matchVal = baseMatch * (matchInfo.matchPct / 100)

          // Capped by §415(c) total additions limit
          const limit415c = pack.contributionLimits.section415cLimit * limitGrowth
          const usedSoFar = addition415cUsed.get(ownerId) ?? 0
          const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
          matchVal = Math.min(matchVal, remaining415cLimit)

          if (matchVal > 0) {
            state.balance += matchVal
            employerMatch += matchVal
            // Employer match only lands in traditional or Roth employer accounts,
            // never a taxable brokerage, so taxableInflow is unaffected here.
            if (account.type === 'traditional') traditionalInflow += matchVal
            else otherInflow += matchVal
            addition415cUsed.set(ownerId, usedSoFar + matchVal)
          }
        }
      }
    }

    // Fix this year's Form-8606 pro-rata fraction per owner (step 5) from the
    // aggregated pre-distribution IRA balance — after contributions, before
    // any RMD/SEPP/conversion/withdrawal depletes it. Forced flows and
    // conversions commit against this state as they happen; need-based
    // withdrawal probes stay pure and commit once at the end of the year.
    const iraProRata = new Map<string, IraProRataYear>()
    for (const [ownerId, basis] of iraBasisByOwner) {
      if (basis <= 0) continue
      let aggregateBalance = 0
      for (const state of balances) {
        if (!isAggregatedIra(state.account)) continue
        if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
        aggregateBalance += state.balance
      }
      iraProRata.set(ownerId, openIraProRataYear(basis, aggregateBalance))
    }
    let rmdNontaxable = 0
    let seppNontaxable = 0
    let conversionNontaxable = 0

    // --- RMDs: forced traditional distributions (SECURE 2.0) ---------------
    let rmdTotal = 0
    for (const state of balances) {
      if (state.account.type !== 'traditional') continue
      if (!followsOwnerRmds(state.account)) continue // inherited accounts follow the 10-year rule below, not Uniform Lifetime
      const ownerId = state.account.ownerPersonId ?? primary.id
      const owner = personById.get(ownerId)!
      const ownerState = stateOf(ownerId)
      if (!ownerState.alive) continue // a deceased owner's own account stops RMDs (no estate modeling)
      // Joint Life divisor only when the user marked the spouse the account's
      // sole beneficiary (the rule's precondition; the schema can't infer it) and
      // they're alive. Otherwise the Uniform Lifetime Table applies.
      const spousePerson = state.account.spouseSoleBeneficiary ? people.find((p) => p.id !== ownerId) : undefined
      const spouseState = spousePerson ? stateOf(spousePerson.id) : undefined
      const spouse =
        spousePerson && spouseState?.alive ? { ageAttained: spouseState.ageAttained, sex: spousePerson.sex } : undefined
      const rmd = requiredMinimumDistribution(
        pack,
        dobYear(owner),
        ownerState.ageAttained,
        startOfYearBalance.get(state.account.id) ?? 0,
        { ownerSex: owner.sex, spouse },
      )
      const take = Math.min(rmd, state.balance)
      if (take <= 0) continue
      state.balance -= take
      rmdTotal += take
      // Pro-rata return of basis on IRA RMDs (step 5); committed immediately.
      if (state.account.kind === 'ira') {
        const proRata = iraProRata.get(ownerId)
        if (proRata) {
          const split = splitIraDistribution(proRata, take)
          iraProRata.set(ownerId, split.next)
          rmdNontaxable += split.nontaxable
        }
      }
    }

    // --- 72(t) SEPP: forced penalty-free early distributions (roadmap V8) ----
    // A substantially-equal periodic payment is taken like an RMD — outside the
    // need-based withdrawal flow, so it never attracts the early-withdrawal
    // penalty — and is taxable ordinary income that also supplies spending cash.
    let seppTotal = 0
    for (const state of balances) {
      if (state.account.type !== 'traditional' || !state.account.sepp || state.account.inherited) continue
      const ownerState = stateOf(state.account.ownerPersonId ?? primary.id)
      if (!ownerState.alive) continue
      const election = state.account.sepp
      if (!seppActive(election.startAge, ownerState.ageAttained)) continue
      const ownerSex = personById.get(state.account.ownerPersonId ?? primary.id)!.sex
      const startBalance = startOfYearBalance.get(state.account.id) ?? 0
      let amount: number
      if (election.method === 'amortization') {
        // Fixed for the series: compute once from the first SEPP year's balance.
        let fixed = seppAmortAmount.get(state.account.id)
        if (fixed === undefined) {
          fixed = seppAnnualAmount('amortization', startBalance, ownerState.ageAttained, ownerSex)
          seppAmortAmount.set(state.account.id, fixed)
        }
        amount = fixed
      } else {
        amount = seppAnnualAmount('rmd', startBalance, ownerState.ageAttained, ownerSex)
      }
      const take = Math.min(amount, state.balance)
      if (take <= 0) continue
      state.balance -= take
      seppTotal += take
      // Pro-rata return of basis on IRA SEPP distributions (step 5).
      if (state.account.kind === 'ira') {
        const ownerId = state.account.ownerPersonId ?? primary.id
        const proRata = iraProRata.get(ownerId)
        if (proRata) {
          const split = splitIraDistribution(proRata, take)
          iraProRata.set(ownerId, split.next)
          seppNontaxable += split.nontaxable
        }
      }
    }

    // --- Inherited IRA: SECURE Act 10-year rule (roadmap V8) ----------------
    // A beneficiary takes an annual single-life RMD during the window (only if
    // the decedent had started RMDs) and must empty the account by year 10. Like
    // RMDs/SEPP it's a forced, taxable, penalty-free distribution that supplies
    // spending cash.
    let inheritedTotal = 0
    for (const state of balances) {
      if (state.account.type !== 'traditional' || !state.account.inherited) continue
      const beneficiary = personById.get(state.account.ownerPersonId ?? primary.id)!
      const beneficiaryState = stateOf(beneficiary.id)
      if (!beneficiaryState.alive) continue
      const take = inheritedForcedAmount({
        year,
        ownerDeathYear: state.account.inherited.ownerDeathYear,
        decedentHadStartedRmds: state.account.inherited.decedentHadStartedRmds,
        balance: state.balance,
        startBalance: startOfYearBalance.get(state.account.id) ?? 0,
        beneficiaryAge: beneficiaryState.ageAttained,
        beneficiarySex: beneficiary.sex,
      })
      if (take <= 0) continue
      state.balance -= take
      inheritedTotal += take
    }

    // QCD: charitable dollars routed out of the RMD, excluded from income.
    // Age 70½ eligibility approximated as age attained ≥ 71.
    let qcd = 0
    if (plan.strategies.qcdAnnual > 0 && rmdTotal > 0) {
      const anyEligible = peopleStates.some((s) => s.alive && s.ageAttained >= 71)
      if (anyEligible) {
        qcd = Math.min(plan.strategies.qcdAnnual * inflFactor, rmdTotal, pack.rmd.qcdAnnualLimit * limitGrowth)
      }
    }

    // --- Roth conversions (after RMDs — RMDs must be satisfied first) -------
    const peopleAged65Plus = peopleStates.filter((s) => s.alive && s.ageAttained >= 65).length
    // Forced IRA distributions count only their taxable (post-pro-rata) part
    // as ordinary income; QCD stays a full subtraction (planning-grade — the
    // IRS actually sources QCDs from pre-tax dollars first).
    const incomeBeforeConversion =
      ordinaryIncome - preTaxContributions + rmdTotal - rmdNontaxable - qcd + seppTotal - seppNontaxable + inheritedTotal

    // Itemized deductions (today's $ → nominal). The user's SALT estimate grows
    // with general inflation, like spending; federal tax takes the greater of
    // this and the standard deduction. Built here so the conversion/bracket
    // sizers below target the same deduction the tax engine will use.
    const itm = plan.strategies.itemizedDeductions
    const itemizedDeductions = itm
      ? {
          stateAndLocalTaxes: itm.stateAndLocalTaxes * inflFactor,
          mortgageInterest: itm.mortgageInterest * inflFactor,
          charitable: itm.charitable * inflFactor,
        }
      : undefined

    // State-tax inputs (resolved once per year, before conversions so the
    // safety-net trim below can price a conversion's full tax bill).
    // Retirement-income base = pension/annuity + taxable RMD/SEPP/inherited −
    // QCD; traditional spending withdrawals are added per iteration below.
    // Roth conversions are excluded (not exclusion-eligible).
    const residenceState = stateForYear(plan.household, year)
    const stateResidency = stateResidencySegmentsForYear(plan.household, year)
    const agesAlive = peopleStates.filter((s) => s.alive).map((s) => s.ageAttained)
    const privateRetirementBase = Math.max(
      0,
      privateRetirementOrdinary + rmdTotal - rmdNontaxable - qcd + seppTotal - seppNontaxable + inheritedTotal,
    )
    const publicPensionBase = Math.max(0, publicPensionOrdinary)
    if (plan.assumptions.stateEffectiveTaxPct <= 0) {
      for (const segment of stateResidency) {
        if (stateParamsFor(segment.state, year)) continue
        warnings.add(
          `State "${segment.state}" isn't modeled for per-state tax yet, so state income tax was treated as $0. ` +
            'If it taxes income, set a flat effective rate under Assumptions to approximate it.',
        )
      }
    }

    // Taxable safety-net floor, conversion side (step 7): trim a fill-to-target
    // conversion so its estimated tax bill stays payable from liquid dollars
    // above the floor after this year's pre-tax cash need. Manual/optimized
    // schedules are executed as requested (the user typed them); generated
    // fill-to-target candidates — including every decision-engine conversion
    // candidate — respect the floor here.
    const trimConversionForFloor = (desired: number): number => {
      const floorNominal = safetyNetFloorToday * inflFactor
      let liquid = 0
      for (const b of balances) {
        if (b.account.type === 'cash' || b.account.type === 'taxable' || b.account.type === 'equityComp') {
          liquid += spendableBalance(b, year)
        }
      }
      const preConversionInflows =
        incomes.total - taxableYieldReinvested + rmdTotal - qcd + seppTotal + inheritedTotal + propertySaleProceedsTotal
      // Liquid dollars available above the floor to pay a conversion's tax:
      // existing spendable liquid plus this year's surplus inflows, net of the
      // pre-tax cash need. Surplus inflows (inflows above expenses+contributions)
      // are real available cash — they land in liquid accounts at year end — so
      // they raise the headroom rather than being clamped away.
      const netLiquid = liquid + preConversionInflows - expenses.total - contributions
      const headroom = Math.max(0, netLiquid - floorNominal)
      const taxOf = (extraOrdinary: number): number => {
        const netted = applyCapitalLossCarryforward(
          capitalLossPool,
          Math.max(0, incomeBeforeConversion + extraOrdinary),
          oneTimeGains,
          pack.federalTax.capitalLossOrdinaryOffsetLimit,
        )
        return taxCalculator.compute({
          year,
          filingStatus: filingStatusForYear,
          ordinaryIncome: netted.ordinaryAfter,
          capitalGains: netted.netCapitalGain,
          realizedCapitalGainsBeforeCarryforward: oneTimeGains,
          taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
          usGovernmentInterest: ladderTaxableInterest,
          ordinaryDividends: incomes.ordinaryDividends,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          state: residenceState,
          stateResidency,
          privateRetirementIncome: privateRetirementBase,
          publicPensionIncome: publicPensionBase,
          agesAlive,
          itemizedDeductions,
        })
      }
      const baseTax = taxOf(0)
      let trimmed = desired
      for (let i = 0; i < 3; i++) {
        const conversionTax = Math.max(0, taxOf(trimmed) - baseTax)
        if (conversionTax <= headroom + EPSILON) break
        trimmed = conversionTax > 0 ? Math.max(0, trimmed * (headroom / conversionTax)) : 0
        if (trimmed <= 0.01) {
          trimmed = 0
          break
        }
      }
      if (trimmed < desired - 0.01) {
        warnings.add('Roth conversions were trimmed so their tax bill stays payable without breaching the taxable safety-net floor.')
      }
      return trimmed
    }

    let rothConversion = 0
    const rc = plan.strategies.rothConversion
    if (rc.mode !== 'none' && anyAlive) {
      let desired = 0
      if (rc.mode === 'manual' || rc.mode === 'optimized') {
        // `optimized` is an optimizer-produced schedule; identical to manual in
        // the ledger (the distinct mode only preserves provenance for the UI).
        for (const c of rc.conversions) if (c.year === year) desired += c.amount
      } else if (year >= rc.startYear && year <= rc.endYear) {
        const sized = sizeRothConversion(rc, {
          year,
          pack,
          filingStatus: taxFilingStatusForYear,
          ordinaryIncomeBase: incomeBeforeConversion,
          capitalGains: oneTimeGains + rebalanceRealizedGains,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          householdSize: aliveCount,
          inflationScale: inflFactorFrom(pack.year, year),
          itemizedDeductions,
        })
        if (sized.ok) {
          desired = sized.amount
          if (desired > 0.01 && safetyNetFloorToday > 0) desired = trimConversionForFloor(desired)
        } else if (sized.reason === 'bad_target') {
          warnings.add('The Roth-conversion target is invalid for this plan (unknown bracket or tier); no conversion made.')
        }
      }
      if (desired > 0.01) {
        const rothTarget = balances.find((b) => b.account.type === 'roth')
        if (!rothTarget) {
          warnings.add('Roth conversions were requested but the plan has no Roth account; conversions skipped.')
        } else {
          let remaining = desired
          for (const state of balances) {
            // Inherited accounts follow the 10-year rule and can't be converted.
            if (!isConvertibleToRoth(state.account) || remaining <= 0) continue
            const take = Math.min(state.balance, remaining)
            state.balance -= take
            remaining -= take
            // Pro-rata return of basis on converted IRA dollars (step 5): the
            // basis portion moves to Roth without creating ordinary income.
            if (take > 0 && state.account.kind === 'ira') {
              const ownerId = state.account.ownerPersonId ?? primary.id
              const proRata = iraProRata.get(ownerId)
              if (proRata) {
                const split = splitIraDistribution(proRata, take)
                iraProRata.set(ownerId, split.next)
                conversionNontaxable += split.nontaxable
              }
            }
          }
          rothConversion = desired - remaining
          rothTarget.balance += rothConversion
          // Converted principal starts its own 5-year recapture clock (the rule
          // that gates an early-retirement conversion ladder). The full amount
          // returns tax-free before earnings, but only the taxable portion is
          // subject to the 10% recapture penalty — nondeductible basis rolled in
          // was never included in income (IRS Pub 590-B). `conversionNontaxable`
          // accumulated only this conversion's basis above (it starts at 0).
          if (rothConversion > 0.01 && rothTarget.account.type === 'roth') {
            const rb = rothBasis.get(rothPoolKey(rothTarget.account))
            const conversionTaxable = Math.max(0, rothConversion - conversionNontaxable)
            if (rb) rb.conversionLayers.push({ year, amount: rothConversion, taxableAmount: conversionTaxable })
          }
          if (rothConversion < desired - 0.01) {
            warnings.add('A requested Roth conversion exceeded the available traditional balance and was reduced.')
          }
        }
      }
    }

    // --- fixed-point tax / withdrawal iteration ----------------------------
    // Only the taxable (post-pro-rata) part of a conversion is ordinary income.
    const ordinaryBase = incomeBeforeConversion + rothConversion - conversionNontaxable

    // --- HECM coordinated draws (annuity-pension-and-home-equity, step 4) ---
    // Pfau's coordinated strategy: in the year after the portfolio actually
    // lost money (the realized wealth-weighted return the growth pass applied,
    // covering allocated and single-return accounts alike — not the raw
    // additive shock, which can be negative in a year the portfolio still
    // gained), fund spending from the line's tax-free loan proceeds instead of
    // selling depressed assets. The draw covers this year's pre-tax cash need
    // up to available credit; the year's taxes still ride the normal
    // withdrawal flow. Deterministic runs (no market series) never have a
    // losing year, so coordinated draws are Monte Carlo / scenario behavior;
    // the last-resort backstop below works everywhere.
    let hecmDraw = 0
    {
      const baseInflows =
        incomes.total - taxableYieldReinvested + rmdTotal - qcd + seppTotal + inheritedTotal + propertySaleProceedsTotal
      let coordinatedNeed = Math.max(0, expenses.total + contributions - baseInflows)
      if (anyAlive && year > startYear && priorYearPortfolioReturnPct < 0 && coordinatedNeed > 0) {
        for (const account of plan.accounts) {
          if (account.type !== 'property' || account.hecm?.drawPolicy !== 'coordinated') continue
          const line = hecmStates.get(account.id)
          if (!line) continue
          const draw = Math.min(coordinatedNeed, Math.max(0, line.principalLimit - line.loanBalance))
          if (draw <= 0) continue
          line.loanBalance += draw
          hecmDraw += draw
          coordinatedNeed -= draw
        }
      }
    }

    // Exact-taxed property sale proceeds enter the cash flow here (their gains
    // are already in the tax base above), so a sale can fund its own tax bill.
    // HECM draws are loan proceeds — cash in, never income.
    const cashInflows =
      incomes.total - taxableYieldReinvested + rmdTotal - qcd + seppTotal + inheritedTotal + propertySaleProceedsTotal + hecmDraw

    // Resolve the year's withdrawal strategy. Bracket targeting reuses the
    // conversion solver to size remaining ordinary-income headroom.
    let withdrawalStrategy: ResolvedWithdrawalStrategy = { mode: 'sequential' }
    const ws = plan.strategies.withdrawalOrder
    if (ws.mode === 'proportional') {
      withdrawalStrategy = { mode: 'proportional' }
    } else if (ws.mode === 'bracketTargeted') {
      const sized = sizeRothConversion(
        { mode: 'fillToTarget', target: 'topOfBracket', targetValue: ws.bracketPct, startYear: year, endYear: year },
        {
          year,
          pack,
          filingStatus: taxFilingStatusForYear,
          ordinaryIncomeBase: ordinaryBase,
          capitalGains: oneTimeGains + rebalanceRealizedGains,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          householdSize: aliveCount,
          inflationScale: inflFactorFrom(pack.year, year),
          itemizedDeductions,
        },
      )
      if (!sized.ok && sized.reason === 'bad_target') {
        warnings.add('The bracket-targeted withdrawal strategy names an unknown bracket; sequential order was used.')
      } else {
        withdrawalStrategy = { mode: 'bracketTargeted', traditionalCap: sized.ok ? sized.amount : 0 }
      }
    }

    // Early-withdrawal penalties: 10% traditional pre-59½ (approximated as
    // age < 60), 20% HSA non-medical pre-65 (v1 treats HSA spending as
    // non-medical; HSA sits last in the drain order). The Rule of 55 waives the
    // traditional penalty for an EMPLOYER plan the owner separated from in/after
    // the year they turned 55 (IRAs never qualify); "separation" is approximated
    // by the owner's retirement age. 72(t) SEPP distributions are taken outside
    // this need-based flow (above), so they're already penalty-free.
    const penaltiesFor = (byAccountId: Map<string, number>): number => {
      let total = 0
      // Per-owner taxable fraction of aggregated-IRA draws (step 5). The 10%
      // additional tax applies only to the portion included in gross income
      // (IRS Topic 557), so nondeductible basis returned pro-rata is not
      // penalized. Computed against the same current pro-rata state as
      // `iraBasisEffect`, so the two stay consistent within an iteration.
      const iraTaxableFraction = new Map<string, number>()
      for (const [ownerId, proRata] of iraProRata) {
        let taken = 0
        for (const state of balances) {
          if (!isAggregatedIra(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          taken += byAccountId.get(state.account.id) ?? 0
        }
        if (taken <= 0) continue
        iraTaxableFraction.set(ownerId, splitIraDistribution(proRata, taken).taxable / taken)
      }
      for (const state of balances) {
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerId = state.account.ownerPersonId ?? primary.id
        const ownerAge = stateOf(ownerId).ageAttained
        if (state.account.type === 'traditional') {
          // Return-of-basis is excluded from gross income, so penalize only the
          // taxable portion of an IRA with nondeductible basis; other
          // traditional accounts (employer plans, no basis) penalize in full.
          const penalizable = isAggregatedIra(state.account)
            ? taken * (iraTaxableFraction.get(ownerId) ?? 1)
            : taken
          total +=
            penalizable *
            traditionalWithdrawalPenaltyRate(state.account, {
              ownerAgeAttained: ownerAge,
              ownerRetirementAge: personById.get(ownerId)?.retirementAge ?? null,
            })
        }
        // HSA penalties are computed by the subledger probe (hsaEffect below),
        // which knows how much of a withdrawal is qualified.
      }
      if (total > 0) warnings.add('Early-withdrawal penalties were charged (pre-59½ traditional or pre-65 HSA).')
      return total
    }

    // Roth withdrawals aggregated into their basis pools (an owner's Roth IRAs
    // share one pool per IRS aggregation; employer Roth stays per-account), so a
    // draw is ordered against the owner's whole Roth-IRA basis, not one account's.
    const rothPoolWithdrawals = (byAccountId: Map<string, number>): Map<string, { taken: number; age: number }> => {
      const byPool = new Map<string, { taken: number; age: number }>()
      for (const state of balances) {
        if (state.account.type !== 'roth') continue
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const key = rothPoolKey(state.account)
        const age = stateOf(state.account.ownerPersonId ?? primary.id).ageAttained
        const entry = byPool.get(key)
        if (entry) entry.taken += taken
        else byPool.set(key, { taken, age })
      }
      return byPool
    }

    // Roth ordering effect of a candidate Roth draw: the 10% penalty on pre-59½
    // earnings and unseasoned conversions, plus the earnings taxed as ordinary
    // income. Pure (probed against the uncommitted basis pools every iteration);
    // the pools are only mutated once, when the final plan is applied.
    const rothEarlyEffect = (byAccountId: Map<string, number>): { penalty: number; taxableOrdinary: number } => {
      let penalty = 0
      let taxableOrdinary = 0
      for (const [key, { taken, age }] of rothPoolWithdrawals(byAccountId)) {
        const rb = rothBasis.get(key)
        if (!rb) continue
        const split = splitRothWithdrawal(rb, taken, year, age)
        penalty += split.penalty
        taxableOrdinary += split.taxableOrdinary
      }
      return { penalty, taxableOrdinary }
    }

    // HSA subledger effect of a candidate HSA draw (steps 2–3): how much is a
    // qualified medical reimbursement (tax- and penalty-free) vs. non-qualified
    // (ordinary income, 20% penalty pre-65). Pure — probed against the year's
    // fixed qualified cap every iteration; the reimburse-later pool commits
    // once, after the final plan. Cap consumption runs in balances order.
    const hsaEffect = (
      byAccountId: Map<string, number>,
    ): { taxableOrdinary: number; penalty: number; qualified: number; nonQualified: number; capConsumed: number } => {
      let taxableOrdinary = 0
      let penalty = 0
      let qualified = 0
      let nonQualified = 0
      let capLeft = hsaQualifiedCap
      for (const state of balances) {
        if (state.account.type !== 'hsa') continue
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerAge = stateOf(state.account.ownerPersonId ?? primary.id).ageAttained
        const treatment = state.account.withdrawalTreatment
        if (treatment === 'capByMedicalExpenses') {
          const q = Math.min(taken, capLeft)
          capLeft -= q
          qualified += q
          const nq = taken - q
          nonQualified += nq
          taxableOrdinary += nq
          penalty += nq * hsaNonQualifiedPenaltyRate(ownerAge)
        } else if (treatment === 'assumeAllQualified') {
          // Explicit simplification: every withdrawal is qualified.
          qualified += taken
        } else {
          // Legacy v1 treatment: tax-free but conservatively penalized pre-65.
          qualified += taken
          penalty += taken * hsaNonQualifiedPenaltyRate(ownerAge)
        }
      }
      return { taxableOrdinary, penalty, qualified, nonQualified, capConsumed: hsaQualifiedCap - capLeft }
    }

    // Pro-rata (Form 8606) return-of-basis in a candidate's need-based IRA
    // draws (step 5). Pure — probed against the uncommitted per-owner year
    // state; the pools commit once, after the final plan.
    const iraBasisEffect = (byAccountId: Map<string, number>): number => {
      if (iraProRata.size === 0) return 0
      let nontaxable = 0
      for (const [ownerId, proRata] of iraProRata) {
        let taken = 0
        for (const state of balances) {
          if (!isAggregatedIra(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          taken += byAccountId.get(state.account.id) ?? 0
        }
        nontaxable += splitIraDistribution(proRata, taken).nontaxable
      }
      return nontaxable
    }

    // Withdrawals hold the safety-net floor (nominal) back from liquid accounts.
    const floorReserveNominal = safetyNetFloorToday > 0 ? safetyNetFloorToday * inflFactor : 0

    // Capital-loss carryforward (today's start-of-year pool, constant across the
    // iteration); netting reduces ordinary + gains before both federal and state
    // tax so the AGI cascade (taxable SS, IRMAA, ACA, state) falls out for free.
    const lossOffsetLimit = pack.federalTax.capitalLossOrdinaryOffsetLimit
    const spendingNeedBeforeTax = Math.max(0, expenses.total + contributions - cashInflows)
    const evaluateWithdrawalNeed = (need: number) => {
      const withdrawalPlan = planWithdrawals(need, balances, withdrawalStrategy, year, floorReserveNominal)
      const rothEffect = rothEarlyEffect(withdrawalPlan.byAccountId)
      const hsaProbe = hsaEffect(withdrawalPlan.byAccountId)
      const iraNontaxableProbe = iraBasisEffect(withdrawalPlan.byAccountId)
      const nettedProbe = applyCapitalLossCarryforward(
        capitalLossPool,
        ordinaryBase + withdrawalPlan.byCategory.traditional - iraNontaxableProbe + rothEffect.taxableOrdinary + hsaProbe.taxableOrdinary,
        oneTimeGains + rebalanceRealizedGains + withdrawalPlan.realizedGains,
        lossOffsetLimit,
      )
      const tax = taxCalculator.compute({
        year,
        filingStatus: filingStatusForYear,
        ordinaryIncome: nettedProbe.ordinaryAfter,
        capitalGains: nettedProbe.netCapitalGain,
        realizedCapitalGainsBeforeCarryforward: oneTimeGains + rebalanceRealizedGains + withdrawalPlan.realizedGains,
        taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
        usGovernmentInterest: ladderTaxableInterest,
        ordinaryDividends: incomes.ordinaryDividends,
        qualifiedDividends: incomes.qualifiedDividends,
        ssBenefits: incomes.socialSecurity,
        peopleAged65Plus,
        state: residenceState,
        stateResidency,
        privateRetirementIncome: privateRetirementBase + withdrawalPlan.byCategory.traditional - iraNontaxableProbe,
        publicPensionIncome: publicPensionBase,
        agesAlive,
        itemizedDeductions,
      })
      const penalties = penaltiesFor(withdrawalPlan.byAccountId) + rothEffect.penalty + hsaProbe.penalty
      return {
        withdrawalPlan,
        tax,
        penalties,
        requiredNeed: Math.max(0, expenses.total + contributions + tax + penalties - cashInflows),
      }
    }

    // The quick fixed-point pass covers the usual case.  Crucially, its
    // accepted evaluation includes the withdrawal plan that produced its tax,
    // rather than applying a new, unchecked plan after the loop.
    let need = spendingNeedBeforeTax
    let evaluation = evaluateWithdrawalNeed(need)
    let converged = Math.abs(evaluation.requiredNeed - need) <= EPSILON
    for (let i = 1; i < MAX_TAX_ITERATIONS && !converged; i++) {
      need = evaluation.requiredNeed
      evaluation = evaluateWithdrawalNeed(need)
      converged = Math.abs(evaluation.requiredNeed - need) <= EPSILON
    }

    if (!converged) {
      // Tax and penalties are a function of the withdrawal plan, so solve the
      // one-dimensional funding equation instead of silently accepting the
      // eighth provisional value.  A finite portfolio still brackets the root:
      // once all spendable balances are exhausted, requiredNeed is bounded
      // while the candidate need keeps growing.
      let lowerNeed = 0
      let lower = evaluateWithdrawalNeed(lowerNeed)
      let upperNeed = Math.max(1, need, evaluation.requiredNeed)
      let upper = evaluateWithdrawalNeed(upperNeed)
      let upperResidual = upper.requiredNeed - upperNeed
      for (let i = 0; i < 64 && upperResidual > EPSILON && upper.withdrawalPlan.shortfall <= EPSILON; i++) {
        upperNeed *= 2
        upper = evaluateWithdrawalNeed(upperNeed)
        upperResidual = upper.requiredNeed - upperNeed
      }

      // Once withdrawals are exhausted, requiredNeed is bounded by this
      // evaluation. Jump to that bound instead of doubling through nonsense
      // inputs; the saturated withdrawal mix makes this a useful endpoint.
      if (upperResidual > EPSILON && upper.withdrawalPlan.shortfall > EPSILON) {
        upperNeed = Math.max(upperNeed, upper.requiredNeed)
        upper = evaluateWithdrawalNeed(upperNeed)
        upperResidual = upper.requiredNeed - upperNeed
      }

      if (Math.abs(upperResidual) <= EPSILON) {
        evaluation = upper
        converged = true
      }

      // Bisection needs a true sign-change bracket. Tax rules can contain hard
      // steps, so also stop when the interval collapses and retain the endpoint
      // with the smallest funding residual instead of aborting the projection.
      for (let i = 0; i < 64 && !converged && upperResidual <= 0; i++) {
        const midpointNeed = (lowerNeed + upperNeed) / 2
        const midpoint = evaluateWithdrawalNeed(midpointNeed)
        const residual = midpoint.requiredNeed - midpointNeed
        if (Math.abs(residual) <= EPSILON) {
          evaluation = midpoint
          converged = true
          break
        }
        if (residual > 0) {
          lowerNeed = midpointNeed
          lower = midpoint
        } else {
          upperNeed = midpointNeed
          upper = midpoint
          upperResidual = residual
        }
        if (upperNeed - lowerNeed <= EPSILON) {
          break
        }
      }
      if (!converged) {
        const lowerResidual = Math.abs(lower.requiredNeed - lowerNeed)
        const closestResidual = Math.min(lowerResidual, Math.abs(upperResidual))
        evaluation = lowerResidual <= Math.abs(upperResidual) ? lower : upper
        warnings.add(
          `Tax and withdrawal funding could not reconcile within half a cent for ${year}; the closest result differs by $${closestResidual.toFixed(2)}.`,
        )
      }
    }

    const { withdrawalPlan, tax, penalties } = evaluation
    // Any open HECM line backstops a true portfolio shortfall regardless of
    // draw policy — no borrower defaults on spending with credit available.
    // The policy only controls proactive (coordinated) draws above.
    let hecmShortfallDraw = 0
    if (withdrawalPlan.shortfall > EPSILON && anyAlive) {
      let remaining = withdrawalPlan.shortfall
      for (const account of plan.accounts) {
        if (account.type !== 'property' || !account.hecm) continue
        const line = hecmStates.get(account.id)
        if (!line) continue
        const draw = Math.min(remaining, Math.max(0, line.principalLimit - line.loanBalance))
        if (draw <= 0) continue
        line.loanBalance += draw
        hecmShortfallDraw += draw
        remaining -= draw
        if (remaining <= EPSILON) break
      }
      hecmDraw += hecmShortfallDraw
    }
    const shortfallAfterHecm = Math.max(0, withdrawalPlan.shortfall - hecmShortfallDraw)
    const surplus = Math.max(0, cashInflows - expenses.total - contributions - tax - penalties)
    const rothEffectFinal = rothEarlyEffect(withdrawalPlan.byAccountId)
    const hsaEffectFinal = hsaEffect(withdrawalPlan.byAccountId)
    const iraNontaxableFinal = iraBasisEffect(withdrawalPlan.byAccountId)
    if (withdrawalPlan.reserveUsed > EPSILON) {
      warnings.add('Spending needs dipped into the taxable safety-net floor after all other accounts were exhausted.')
    }
    if (hsaEffectFinal.taxableOrdinary > EPSILON) {
      warnings.add(
        'Some HSA withdrawals exceeded modeled qualified medical expenses; the excess was taxed as ordinary income (and penalized before 65).',
      )
    }
    if (rothEffectFinal.penalty > 0) {
      warnings.add(
        'Early Roth distributions were penalized: earnings before 59½, or converted amounts tapped within 5 years (the conversion-ladder seasoning rule).',
      )
    }

    if (rc.mode === 'fillToTarget' && rothConversion > 0 && withdrawalPlan.byCategory.traditional > 0.01) {
      warnings.add(
        'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.',
      )
    }

    // Apply the carryforward to the final realized figures, then commit the
    // depleted pool to next year. Netted ordinary/gains feed MAGI, taxable SS,
    // and the gain-harvesting headroom below, so the AGI cascade is consistent.
    // IRA pro-rata basis reduces the taxable traditional draw; non-qualified
    // HSA withdrawals add ordinary income.
    const lossNetting = applyCapitalLossCarryforward(
      capitalLossPool,
      Math.max(
        0,
        ordinaryBase +
          withdrawalPlan.byCategory.traditional -
          iraNontaxableFinal +
          rothEffectFinal.taxableOrdinary +
          hsaEffectFinal.taxableOrdinary,
      ),
      oneTimeGains + rebalanceRealizedGains + withdrawalPlan.realizedGains,
      lossOffsetLimit,
    )
    capitalLossPool = lossNetting.remaining

    // Record realized MAGI (≈ AGI) for IRMAA's 2-year lookback and ACA. Non-
    // qualified Roth earnings are ordinary income, so they lift MAGI too.
    // gainsRealized is signed (a net capital loss is negative); floor MAGI at 0.
    const ordinaryRealized = lossNetting.ordinaryAfter
    const gainsRealized = lossNetting.netCapitalGain
    const realizedCapitalGainsBeforeCarryforward = oneTimeGains + rebalanceRealizedGains + withdrawalPlan.realizedGains
    const taxableSs = taxableSocialSecurity(
      pack,
      taxFilingStatusForYear,
      ordinaryRealized + gainsRealized + incomes.qualifiedDividends,
      incomes.socialSecurity,
    )
    magiHistory.set(year, Math.max(0, ordinaryRealized + gainsRealized + incomes.qualifiedDividends + taxableSs))

    // Gain-harvesting advisory: room left in the 0% LTCG bracket this year, given
    // the realized income and deductions (roadmap V8 §4). Advisory only — the
    // engine doesn't auto-harvest. Federal-law boundary, so computed federally.
    const federalDetail = computeFederalTax({
      year,
      filingStatus: filingStatusForYear,
      ordinaryIncome: ordinaryRealized,
      capitalGains: gainsRealized,
      realizedCapitalGainsBeforeCarryforward,
      taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
      usGovernmentInterest: ladderTaxableInterest,
      ordinaryDividends: incomes.ordinaryDividends,
      qualifiedDividends: incomes.qualifiedDividends,
      ssBenefits: incomes.socialSecurity,
      peopleAged65Plus,
      itemizedDeductions,
    })
    const ltcgZeroHeadroom = federalDetail.zeroRateLtcgHeadroom
    if (federalDetail.alternativeMinimumTax > EPSILON) {
      warnings.add('The planning-grade AMT screen bound in at least one year; tax includes the AMT excess.')
    }

    // V8 optimizer linearization probe (no-op unless a sink is supplied). The
    // ordinary base excludes all traditional distributions and conversions —
    // `incomeBeforeConversion` already nets out preTaxContributions and QCD and
    // includes RMD, so subtracting RMD leaves the non-traditional ordinary
    // income; the baseline taxable-SS portion is folded in as a constant.
    if (opts.captureOptimizerInputs) {
      let startTraditional = 0
      let startInheritedTraditional = 0
      for (const state of balances) {
        if (state.account.type === 'traditional' && !state.account.inherited) {
          startTraditional += startOfYearBalance.get(state.account.id) ?? 0
        } else if (state.account.type === 'traditional' && state.account.inherited) {
          startInheritedTraditional += startOfYearBalance.get(state.account.id) ?? 0
        }
      }
      opts.captureOptimizerInputs({
        year,
        ordinaryIncomeBase: Math.max(0, incomeBeforeConversion - rmdTotal - inheritedTotal) + taxableSs,
        spendingNeed: expenses.total + contributions,
        exogenousCash: incomes.total - taxableYieldReinvested,
        traditionalInflow,
        otherInflow,
        taxableInflow,
        ssBenefits: incomes.socialSecurity,
        taxableSsBase: taxableSs,
        // Gains EXCLUDING taxable-withdrawal realizations: the optimizer
        // re-decides taxable draws as its own `wtax` variable and adds their
        // gain share to provisional income / MAGI itself, so including the
        // baseline's withdrawal-driven gains here would double-count them.
        // (Pre-netting components; capital-loss carryforward refinement is
        // left to the exact ledger.)
        capitalGainsBase: Math.max(0, oneTimeGains + rebalanceRealizedGains) + incomes.qualifiedDividends,
        rmd: rmdTotal,
        startTraditional,
        inheritedDistribution: inheritedTotal,
        startInheritedTraditional,
        peopleAged65Plus,
        ssa44IrmaaRedetermination: ssa44ActiveInYear(year),
      })
    }

    // --- apply flows -------------------------------------------------------
    for (const state of balances) {
      const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
      if (taken <= 0) continue
      if ((state.account.type === 'taxable' || state.account.type === 'equityComp') && state.balance > 0) {
        const basisRatio = Math.min(1, state.costBasis / state.balance)
        state.costBasis = Math.max(0, state.costBasis - taken * basisRatio)
      }
      state.balance -= taken
    }
    // Commit the Roth basis ordering (contributions → conversions → earnings) once
    // per pool, so next year's seasoning + earnings are correct across the owner's
    // aggregated Roth IRAs.
    for (const [key, { taken, age }] of rothPoolWithdrawals(withdrawalPlan.byAccountId)) {
      const rb = rothBasis.get(key)
      if (rb) rothBasis.set(key, splitRothWithdrawal(rb, taken, year, age).next)
    }
    // Commit the year's Form-8606 IRA basis depletion from need-based draws
    // (RMD/SEPP/conversion basis already committed above as they happened).
    if (iraProRata.size > 0) {
      for (const [ownerId, proRata] of iraProRata) {
        let taken = 0
        for (const state of balances) {
          if (!isAggregatedIra(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          taken += withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        }
        const next = splitIraDistribution(proRata, taken).next
        iraBasisByOwner.set(ownerId, next.basis)
      }
    }
    // Reimburse-later accumulation (step 3): out-of-pocket qualified medical
    // expenses this year (modeled costs the cap-mode HSAs did NOT reimburse)
    // grow the pool; qualified HSA reimbursements draw it down. Grows in
    // nominal dollars alongside the expenses it defers. Only cap-mode
    // consumption (`capConsumed`) touches the pool — qualified draws from
    // `assumeAllQualified`/legacy HSAs are not measured against modeled
    // expenses and must not draw the pool down.
    if (hsaReimburseLaterActive) {
      const qualifiedDrawn = hsaEffectFinal.capConsumed
      const reimbursedFromCurrentYear = Math.min(qualifiedDrawn, qualifiedMedicalThisYear)
      const drawnFromPool = qualifiedDrawn - reimbursedFromCurrentYear
      const outOfPocketThisYear = Math.max(0, qualifiedMedicalThisYear - reimbursedFromCurrentYear)
      hsaReimbursablePool = Math.max(0, hsaReimbursablePool - drawnFromPool) + outOfPocketThisYear
    }
    deposit(surplus)

    if (shortfallAfterHecm > EPSILON && depletionYear === null) depletionYear = year

    // --- property events + growth ------------------------------------------
    for (const account of plan.accounts) {
      if (account.type !== 'property') continue
      let value = propertyValues.get(account.id) ?? 0
      value *= 1 + inflRateAt(year)
      if (account.plannedSaleYear === year && value > 0) {
        // Exact-taxed sales (costBasis set) already deposited their net
        // proceeds through the year's cash flow above; the legacy tax-free
        // expectedNetProceeds path deposits here — net of any HECM payoff,
        // which is non-recourse (never more than the sale nets).
        if (account.costBasis === undefined) {
          const proceeds = account.expectedNetProceeds ?? value
          const line = hecmStates.get(account.id)
          const hecmPayoff = line ? Math.min(line.loanBalance, Math.max(0, proceeds)) : 0
          if (line) hecmStates.delete(account.id)
          deposit(proceeds - hecmPayoff)
        }
        value = 0
      }
      propertyValues.set(account.id, value)
      // An open line compounds at the line's growth rate on both sides: the
      // unused principal limit grows regardless of home value (the buffer-
      // asset property), and the loan balance accrues rate + MIP.
      const line = hecmStates.get(account.id)
      if (line && account.hecm) {
        const growth = 1 + account.hecm.growthRatePct / 100
        line.principalLimit *= growth
        line.loanBalance *= growth
      }
    }

    // --- insurance: permanent-life cash value + death benefit --------------
    let deathBenefitPaid = 0
    for (const policy of plan.insurance) {
      if (policy.kind !== 'permanentLife') continue
      const insured = personById.get(policy.insured)
      const deathAge = insured ? lifeAgeOf(insured) : Infinity
      const ageAttained = insured ? stateOf(policy.insured).ageAttained : -Infinity
      if (ageAttained < deathAge) {
        // Alive, before the settlement year: cash value tracks the illustration
        // (schedule) or compounds (flatRate).
        if (policy.cashValueMode === 'schedule' && policy.cashValueSchedule) {
          insuranceCashValues.set(policy.id, interpolateByAge(policy.cashValueSchedule, ageAttained))
        } else {
          const prev = insuranceCashValues.get(policy.id) ?? 0
          insuranceCashValues.set(policy.id, prev * (1 + (policy.cashValueGrowthPct ?? 0) / 100))
        }
      } else if (ageAttained === deathAge) {
        // Final alive year = death settlement. Pay here (not at deathAge + 1,
        // which is past endYear for the last survivor — exactly the estate case
        // the policy models) so the benefit always lands in the projection. The
        // cash value rolls into the benefit and is zeroed so it isn't double-
        // counted in net worth; a real death benefit is never less than the cash
        // value, so max() also guards the flat-rate model drifting above face.
        const cashValue = insuranceCashValues.get(policy.id) ?? 0
        const payout = Math.max(policy.deathBenefit, cashValue)
        deposit(payout)
        deathBenefitPaid += payout
        insuranceCashValues.set(policy.id, 0)
      } else {
        insuranceCashValues.set(policy.id, 0)
      }
    }

    const shockPct = returnShockAt(year)
    // Wealth-weighted total return the ledger actually applies this year
    // (including distributed taxable yield — a distribution, not a loss).
    // Next year's coordinated HECM check reads it, so the down-market signal
    // is the realized portfolio return, not the raw additive shock.
    let returnWeightedSum = 0
    let returnWeightBase = 0
    for (const state of balances) {
      const taxableYieldPct = state.account.type === 'taxable' ? (taxableYieldByAccountId.get(state.account.id)?.totalYieldPct ?? 0) : 0
      const track = allocationTrack.get(state.account.id)
      if (track) {
        // Allocated account: growth is the class blend at this year's weights
        // (superseding annualReturnPct); distributed taxable yield is carved
        // out of price growth exactly like the single-return path. Weights
        // then drift with the differential class returns until the next
        // rebalance (or forever, when rebalancing is 'none').
        const classRates = ASSET_CLASS_IDS.map((id, i) => classParams[id].returnPct + classShockAt(year, i))
        const blendedPct = classRates.reduce((sum, r, i) => sum + r * (track.weights[i] ?? 0), 0)
        returnWeightedSum += state.balance * blendedPct
        returnWeightBase += state.balance
        state.balance *= Math.max(0, 1 + (blendedPct - taxableYieldPct) / 100)
        track.weights = driftWeights(track.weights, classRates)
        continue
      }
      const expectedPct = state.account.annualReturnPct ?? plan.assumptions.defaultReturnPct
      // Cash is a stable-value bucket: the market shock hits invested accounts only.
      const ratePct = state.account.type === 'cash' ? expectedPct : expectedPct + shockPct - taxableYieldPct
      returnWeightedSum += state.balance * (state.account.type === 'cash' ? expectedPct : expectedPct + shockPct)
      returnWeightBase += state.balance
      state.balance *= Math.max(0, 1 + ratePct / 100)
    }
    priorYearPortfolioReturnPct = returnWeightBase > 0 ? returnWeightedSum / returnWeightBase : 0
    for (const state of balances) {
      const taxableYield = taxableYieldByAccountId.get(state.account.id)
      if (!taxableYield?.reinvest || taxableYield.gross <= 0) continue
      state.balance += taxableYield.gross
      if (state.account.type === 'taxable') state.costBasis += taxableYield.gross
    }

    // --- snapshot ------------------------------------------------------------
    const balanceRecord: Record<string, number> = {}
    let investableTotal = unassignedCash
    for (const state of balances) {
      balanceRecord[state.account.id] = state.balance
      investableTotal += state.balance
    }
    let propertyTotal = 0
    for (const [id, value] of propertyValues) {
      balanceRecord[id] = value
      propertyTotal += value
    }
    let debtTotal = 0
    for (const [id, value] of debtBalances) {
      balanceRecord[id] = value
      debtTotal += value
    }
    // HECM loans net against net worth with the non-recourse floor honored:
    // the lender's claim never exceeds the home's value, so heirs are never
    // charged for a loan that outgrew the house.
    let hecmLoanTotal = 0
    let hecmEffectiveDebt = 0
    for (const [id, line] of hecmStates) {
      hecmLoanTotal += line.loanBalance
      hecmEffectiveDebt += Math.min(line.loanBalance, propertyValues.get(id) ?? 0)
    }
    let insuranceCashValueTotal = 0
    for (const [id, value] of insuranceCashValues) {
      balanceRecord[id] = value
      insuranceCashValueTotal += value
    }

    const reportedWithdrawals = {
      ...withdrawalPlan.byCategory,
      traditional: withdrawalPlan.byCategory.traditional + rmdTotal + seppTotal + inheritedTotal,
      total: withdrawalPlan.byCategory.total + rmdTotal + seppTotal + inheritedTotal,
    }
    // Attribute any portfolio shortfall across the spending layers: a deliberate
    // guardrail cut is a target-lifestyle miss, a genuine shortfall reaches the
    // required floor only after exhausting discretionary. Skipped goals are added
    // on top (a skipped goal is spending that never happened). Legacy `shortfall`
    // (and depletion-year logic) are left exactly as they were.
    const shortfallAttribution = attributeShortfall({
      requiredSpending: requiredSpendingBase,
      targetSpending: targetSpendingBase,
      idealSpending: idealSpendingBase,
      excessSpending: excessSpendingBase,
      fundedSpending: expenses.total,
      withdrawalShortfall: shortfallAfterHecm,
    })
    const requiredShortfall = shortfallAttribution.requiredShortfall + skippedRequiredNominal
    const targetShortfall = shortfallAttribution.targetShortfall + skippedTargetNominal + skippedRequiredNominal
    const idealShortfall = shortfallAttribution.idealShortfall + skippedIdealNominal
    const excessShortfall = shortfallAttribution.excessShortfall + skippedExcessNominal
    years.push({
      year,
      people: peopleStates,
      filingStatus: filingStatusForYear,
      incomes,
      expenses,
      contributions,
      employerMatch,
      rmd: rmdTotal,
      sepp: seppTotal,
      inheritedDistribution: inheritedTotal,
      qcd,
      rothConversion,
      penalties,
      magi: magiHistory.get(year)!,
      medicarePremiums,
      irmaaTier,
      amt: federalDetail.alternativeMinimumTax,
      ltcgZeroHeadroom,
      ssEarningsTestWithheld,
      ssdiPaid,
      tax,
      withdrawals: reportedWithdrawals,
      realizedGains: withdrawalPlan.realizedGains + rebalanceRealizedGains,
      taxableYield: incomes.taxableYield,
      capitalLossUsedAgainstGains: lossNetting.usedAgainstGains,
      capitalLossUsedAgainstOrdinary: lossNetting.usedAgainstOrdinary,
      capitalLossCarryforwardRemaining: lossNetting.remaining,
      surplusInvested: surplus,
      shortfall: shortfallAfterHecm,
      requiredShortfall,
      targetShortfall,
      idealShortfall,
      excessShortfall,
      guardrailAction,
      flexibleGoals: goalOutcomeCounts,
      balances: balanceRecord,
      investableTotal,
      insuranceCashValue: insuranceCashValueTotal,
      ladderValue: ladderValueTotal,
      deathBenefit: deathBenefitPaid,
      hecmDraw,
      hecmLoanBalance: hecmLoanTotal,
      netWorth: investableTotal + propertyTotal - debtTotal + insuranceCashValueTotal + ladderValueTotal - hecmEffectiveDebt,
    })
  }

  const last = years[years.length - 1]
  // Remaining nondeductible IRA basis at the horizon, capped per owner at their
  // ending aggregated-IRA balance (basis can exceed the balance after market
  // losses, but only balance-worth of dollars actually pass to the heir).
  let endingNondeductibleIraBasis = 0
  for (const [ownerId, basis] of iraBasisByOwner) {
    if (basis <= 0) continue
    let ownerIraBalance = 0
    for (const state of balances) {
      if (!isAggregatedIra(state.account)) continue
      if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
      ownerIraBalance += state.balance
    }
    endingNondeductibleIraBasis += Math.min(basis, ownerIraBalance)
  }
  return {
    startYear,
    endYear,
    years,
    depletionYear,
    endingInvestable: last?.investableTotal ?? 0,
    endingNetWorth: last?.netWorth ?? 0,
    endingNondeductibleIraBasis,
    warnings: [...warnings],
  }
}
