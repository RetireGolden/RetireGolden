/**
 * Normalized candidate generators (ledger-native decision engine, Phase 2).
 *
 * Every recommendation source is a `CandidateGenerator`: pure, bounded, and
 * fast — no simulate() calls, just concrete plan patches or conversion
 * schedules. Generation never decides whether something is recommended; the
 * exact-ledger evaluation does.
 */

import type { Account, AllocationWeights, IncomeStream, Plan, TipsLadder } from '../model/plan.js'
import { packForYear, rmdStartAgeForBirthYear, LATEST_PACK_YEAR, EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { BRIDGE_FUNDING_MIN_FRACTION, sizeBridge } from '../ladder/bridge.js'
import type { OptimizedSchedule } from '../strategies/optimizer.js'
import { QLAC_DEFERRED_PAYOUT_RATE, spiaPayoutRate } from './spiaQuotes.js'
import type { CandidateGenerator, DecisionCandidate, DecisionContext } from './types.js'

function fillToTargetPatch(
  target: 'topOfBracket' | 'irmaaTier' | 'acaCliff',
  targetValue: number | null,
  startYear: number,
  endYear: number,
): Record<string, unknown> {
  return {
    strategies: {
      rothConversion: { mode: 'fillToTarget', target, targetValue, startYear, endYear },
    },
  }
}

/**
 * Income-boundary years where the cheap-conversion regime typically ends: each
 * person's Social-Security claim year and RMD start year. A whole-horizon
 * bracket fill keeps converting past these boundaries even when the marginal
 * dollars stop being cheap; windowed fills stop at the boundary instead —
 * the classic "convert during the bridge, then stop" shape a sequential
 * withdrawal order makes optimal. Bounded and generation-pure (no simulate).
 */
function conversionWindowBoundaries(ctx: DecisionContext, startYear: number, endYear: number): { year: number; suffix: string }[] {
  const plan = ctx.plan
  const boundaries = new Map<number, string>()
  // Liquid-reserve depletion: the first baseline year where spending taps the
  // traditional balance. Up to then, spending rides on cash/taxable and every
  // converted dollar starts at the bottom of the brackets; afterwards the
  // spending withdrawals fill the cheap bands themselves (sequential order), so
  // the classic optimal shape is "convert hard while reserves last, then stop."
  // Reads the already-computed baseline result — no new simulation.
  const firstTraditionalDrawYear = ctx.baselineResult.years.find(
    (year) => year.withdrawals.traditional - year.rmd - year.inheritedDistribution > 1,
  )?.year
  if (firstTraditionalDrawYear !== undefined && firstTraditionalDrawYear > startYear && firstTraditionalDrawYear <= endYear) {
    boundaries.set(firstTraditionalDrawYear, `while cash and taxable cover spending (through ${firstTraditionalDrawYear - 1})`)
  }
  for (const income of plan.incomes) {
    if (income.type !== 'socialSecurity') continue
    const person = plan.household.people.find((p) => p.id === income.personId)
    if (!person) continue
    const claimYear = dobYear(person.dob) + income.claimAge.years
    if (claimYear > startYear && claimYear <= endYear && !boundaries.has(claimYear)) {
      boundaries.set(claimYear, `until Social Security starts (${claimYear})`)
    }
  }
  const hasTraditional = plan.accounts.some((a) => a.type === 'traditional' && !a.inherited)
  if (hasTraditional) {
    for (const person of plan.household.people) {
      const birthYear = dobYear(person.dob)
      const rmdYear = birthYear + rmdStartAgeForBirthYear(birthYear)
      if (rmdYear > startYear && rmdYear <= endYear && !boundaries.has(rmdYear)) {
        boundaries.set(rmdYear, `until RMDs begin (${rmdYear})`)
      }
    }
  }
  return [...boundaries.entries()]
    .sort(([a], [b]) => a - b)
    // Hard bound on the candidate fan-out. A married couple legitimately has 5
    // distinct boundaries (reserve depletion + 2 SS claims + 2 RMD starts);
    // truncating below that silently drops the latest — typically the younger
    // spouse's RMD wall, exactly the window shape these candidates exist for.
    .slice(0, 5)
    .map(([year, suffix]) => ({ year, suffix }))
}

/**
 * The simple fill-to-target Roth strategies of the bounded tournament: bracket
 * fills, the ACA cliff cap, and the first IRMAA tier cap over the whole
 * horizon, plus *windowed* bracket fills that stop at income boundaries (SS
 * claim / RMD start) — under a sequential withdrawal order, spending draws fill
 * the cheap brackets themselves once cash/taxable deplete or income starts, so
 * "fill high early, then stop" beats any whole-horizon fill on bridge-shaped
 * plans. Generated unconditionally — a plan with no convertible traditional
 * simply executes $0 and evaluates neutral.
 */
export const simpleRothConversionGenerator: CandidateGenerator = {
  id: 'roth-fill-to-target',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const { startYear, endYear } = ctx.baselineResult
    const make = (
      id: string,
      label: string,
      target: 'topOfBracket' | 'irmaaTier' | 'acaCliff',
      targetValue: number | null,
      category: DecisionCandidate['category'],
      window?: { year: number; suffix: string },
    ): DecisionCandidate => ({
      id,
      source: 'heuristic',
      category,
      label,
      // Windowed candidates are always bracket fills, so the phrase comes
      // straight from targetValue — no scraping the human label back apart.
      explanation: window
        ? `Roth conversions up to the ${targetValue}% bracket in each year before ${window.year}, evaluated on the exact ledger.`
        : `Roth conversions each year up to ${label.toLowerCase().replace(/^fill |^convert up to /, '')}, evaluated on the exact ledger.`,
      planPatch: fillToTargetPatch(target, targetValue, startYear, window ? window.year - 1 : endYear),
    })
    const candidates = [
      make('bracket-10', 'Fill the 10% bracket', 'topOfBracket', 10, 'roth'),
      make('bracket-12', 'Fill the 12% bracket', 'topOfBracket', 12, 'roth'),
      make('bracket-22', 'Fill the 22% bracket', 'topOfBracket', 22, 'roth'),
      make('bracket-24', 'Fill the 24% bracket', 'topOfBracket', 24, 'roth'),
      make('aca-cliff-cap', 'Convert up to the ACA cliff', 'acaCliff', null, 'tax-cliff'),
      make('irmaa-tier-1-cap', 'Convert up to the first IRMAA tier', 'irmaaTier', 1, 'tax-cliff'),
    ]
    for (const window of conversionWindowBoundaries(ctx, startYear, endYear)) {
      for (const bracket of [12, 22, 24]) {
        candidates.push(
          make(
            `bracket-${bracket}-until-${window.year}`,
            `Fill the ${bracket}% bracket ${window.suffix}`,
            'topOfBracket',
            bracket,
            'roth',
            window,
          ),
        )
      }
    }
    return candidates
  },
}

/** The do-nothing alternative, only meaningful when the plan currently converts. */
export const noConversionGenerator: CandidateGenerator = {
  id: 'roth-no-conversion',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    if (ctx.plan.strategies.rothConversion.mode === 'none') return []
    return [
      {
        id: 'no-conversion',
        source: 'heuristic',
        category: 'roth',
        label: 'No Roth conversions',
        explanation: 'Runs the plan with no Roth conversions, in case the current schedule costs more than it saves.',
        planPatch: { strategies: { rothConversion: { mode: 'none' } } },
      },
    ]
  },
}

/** Withdrawal-order alternatives to whatever the plan currently uses. */
export const withdrawalOrderGenerator: CandidateGenerator = {
  id: 'withdrawal-order',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const current = ctx.plan.strategies.withdrawalOrder
    const alternatives: Array<{ id: string; label: string; strategy: Plan['strategies']['withdrawalOrder'] }> = [
      { id: 'withdrawal-sequential', label: 'Sequential withdrawal order', strategy: { mode: 'sequential' } },
      { id: 'withdrawal-proportional', label: 'Proportional withdrawal order', strategy: { mode: 'proportional' } },
      { id: 'withdrawal-bracket-12', label: 'Bracket-targeted withdrawals (12%)', strategy: { mode: 'bracketTargeted', bracketPct: 12 } },
      { id: 'withdrawal-bracket-22', label: 'Bracket-targeted withdrawals (22%)', strategy: { mode: 'bracketTargeted', bracketPct: 22 } },
    ]
    return alternatives
      .filter(({ strategy }) => {
        if (strategy.mode !== current.mode) return true
        return strategy.mode === 'bracketTargeted' && current.mode === 'bracketTargeted'
          ? strategy.bracketPct !== current.bracketPct
          : false
      })
      .map(({ id, label, strategy }) => ({
        id,
        source: 'heuristic',
        category: 'withdrawal',
        label,
        explanation: `Funds spending with a ${label.toLowerCase()} instead of the current strategy.`,
        planPatch: { strategies: { withdrawalOrder: strategy } },
      }))
  },
}

export interface ProbabilityBandSpendingGuardrailOptions {
  /** Floor as a percent of target annual spending when the plan has no floor yet. */
  requiredFloorPct?: number
  /** Lower Monte Carlo success band the candidate is meant to defend. */
  lowerSuccessPct?: number
  /** Upper Monte Carlo success band where raises/upside become available. */
  upperSuccessPct?: number
}

/**
 * Probability-band safe-spend guardrail candidates. Generation is deliberately
 * pure: the candidate carries the success band as metadata and a concrete
 * ledger-native guardrail patch; exact/stochastic surfaces can then evaluate it
 * through the shared decision and Monte Carlo runners without private models.
 */
export function probabilityBandSpendingGuardrailGenerator(
  options: ProbabilityBandSpendingGuardrailOptions = {},
): CandidateGenerator {
  const requiredFloorPct = options.requiredFloorPct ?? 80
  const lowerSuccessPct = options.lowerSuccessPct ?? 70
  const upperSuccessPct = options.upperSuccessPct ?? 95
  return {
    id: 'probability-band-spending-guardrails',
    generate(ctx: DecisionContext): DecisionCandidate[] {
      // Skip plans that already run any guardrail policy (withdrawal-rate or
      // risk-based) — the candidate would just re-add what is already there.
      const mode = ctx.plan.expenses.spendingPolicy?.mode
      if (mode !== undefined && mode !== 'fixedTarget') return []
      const baseAnnual = ctx.plan.expenses.baseAnnual
      if (baseAnnual <= 0) return []
      const requiredAnnual = Math.min(
        ctx.plan.expenses.requiredAnnual ?? Math.round(baseAnnual * requiredFloorPct / 100),
        baseAnnual,
      )
      return [
        {
          id: `safe-spend-band-${lowerSuccessPct}-${upperSuccessPct}`,
          source: 'heuristic',
          category: 'spending',
          label: `Safe-spend guardrails (${lowerSuccessPct}-${upperSuccessPct}% band)`,
          explanation:
            'Adds a required spending floor and ledger-native withdrawal-rate guardrails as the modelable candidate for probability-band safe-spend comparisons.',
          planPatch: {
            expenses: {
              requiredAnnual,
              spendingPolicy: {
                mode: 'withdrawalRateGuardrails',
                upperGuardrailPct: 120,
                lowerGuardrailPct: 80,
                adjustmentPct: 10,
                allowRaisesAboveTarget: true,
              },
            },
          },
          metadata: {
            decisionRule: 'probabilityBandSafeSpend',
            lowerSuccessPct,
            upperSuccessPct,
            requiredFloorPct,
          },
        },
      ]
    },
  }
}

const SS_CLAIM_AGES: Array<{ years: number; months: number; suffix: string }> = [
  { years: 62, months: 0, suffix: 'at 62' },
  { years: 67, months: 0, suffix: 'at 67 (FRA)' },
  { years: 70, months: 0, suffix: 'at 70' },
]

const SS_GRID_CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70] as const

function dobYear(dob: string): number {
  return Number(dob.slice(0, 4))
}

function gridClaimAgesForPerson(person: Plan['household']['people'][number], startYear: number): number[] {
  const currentAge = startYear - dobYear(person.dob)
  const ages = SS_GRID_CLAIM_AGES.filter((age) => age >= currentAge)
  return ages.length > 0 ? [...ages] : [70]
}

/**
 * Bounded Social Security claim-age candidates: for up to two SS streams, the
 * three canonical claim ages (62 / FRA / 70) that differ from the current
 * claim. Each candidate replaces the whole incomes array (scenario patches
 * replace arrays wholesale, keeping the patch order-safe).
 */
export const socialSecurityClaimGenerator: CandidateGenerator = {
  id: 'social-security-claim',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = []
    const ssStreams = ctx.plan.incomes.filter(
      (income): income is Extract<IncomeStream, { type: 'socialSecurity' }> => income.type === 'socialSecurity',
    )
    for (const stream of ssStreams.slice(0, 2)) {
      const person = ctx.plan.household.people.find((p) => p.id === stream.personId)
      const personLabel = person?.name ?? 'household member'
      for (const claim of SS_CLAIM_AGES) {
        if (stream.claimAge.years === claim.years && stream.claimAge.months === claim.months) continue
        const incomes = ctx.plan.incomes.map((income) =>
          income === stream ? { ...stream, claimAge: { years: claim.years, months: claim.months } } : income,
        )
        candidates.push({
          id: `ss-claim-${stream.id}-${claim.years}-${claim.months}`,
          source: 'heuristic',
          category: 'social-security',
          label: `${personLabel} claims Social Security ${claim.suffix}`,
          explanation: `Moves ${personLabel}'s claim from ${stream.claimAge.years}y${stream.claimAge.months}m to ${claim.years}y${claim.months}m and reprices the whole plan on the exact ledger.`,
          planPatch: { incomes },
        })
      }
    }
    return candidates
  },
}

/** Static-allocation account with a balance, the only shape location swaps act on. */
type LocatableAccount = Extract<Account, { type: 'taxable' | 'traditional' | 'roth' }> & {
  allocation: { mode: 'static'; rebalancing: 'annual' | 'none'; weights: AllocationWeights }
}

function largestStaticAllocated(plan: Plan, type: LocatableAccount['type']): LocatableAccount | undefined {
  const eligible = plan.accounts.filter(
    (a): a is LocatableAccount => a.type === type && a.allocation?.mode === 'static' && a.balance > 0,
  )
  return eligible.sort((a, b) => b.balance - a.balance)[0]
}

/**
 * Asset-location candidates (asset-allocation-and-return-model-v2, step 5).
 *
 * Proposes swapping *where* classes are held while leaving the household's
 * total dollars in each class unchanged: bonds move toward traditional
 * (sheltering their ordinary-income yield and slowing the RMD/heir-taxed
 * balance), US stocks move toward taxable (qualified dividends + basis
 * machinery) or Roth (sheltering the highest expected growth). Swaps pair the
 * largest eligible static-allocation accounts and are expressed as plan
 * patches over the accounts array; the exact ledger prices every candidate —
 * generation never decides. Bounded: at most 3 candidates.
 */
export const assetLocationGenerator: CandidateGenerator = {
  id: 'asset-location',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const plan = ctx.plan
    const taxable = largestStaticAllocated(plan, 'taxable')
    const traditional = largestStaticAllocated(plan, 'traditional')
    const roth = largestStaticAllocated(plan, 'roth')

    const candidates: DecisionCandidate[] = []
    const patchWith = (replacements: Map<string, Account>): Record<string, unknown> => ({
      accounts: plan.accounts.map((a) => replacements.get(a.id) ?? a),
    })
    const shifted = (weights: AllocationWeights, from: keyof AllocationWeights, to: keyof AllocationWeights, pct: number): AllocationWeights => {
      // Clamp to the schema's 0–100 bounds; move exactly what the source can
      // give so the pair of shifts stays sum-preserving under float rounding.
      const moved = Math.min(pct, weights[from])
      return { ...weights, [from]: weights[from] - moved, [to]: Math.min(100, weights[to] + moved) }
    }
    /** Swap `dollars` of `sellClass` in a for `sellClass` exposure in b (b gives up buyClass). */
    const swap = (
      id: string,
      label: string,
      explanation: string,
      a: LocatableAccount,
      b: LocatableAccount,
      aGivesUp: keyof AllocationWeights,
      bGivesUp: keyof AllocationWeights,
      dollars: number,
    ): DecisionCandidate => {
      const aPct = (dollars / a.balance) * 100
      const bPct = (dollars / b.balance) * 100
      const replacements = new Map<string, Account>([
        [a.id, { ...a, allocation: { ...a.allocation, weights: shifted(a.allocation.weights, aGivesUp, bGivesUp, aPct) } }],
        [b.id, { ...b, allocation: { ...b.allocation, weights: shifted(b.allocation.weights, bGivesUp, aGivesUp, bPct) } }],
      ])
      return {
        id,
        source: 'heuristic',
        category: 'asset-location',
        label,
        explanation,
        planPatch: patchWith(replacements),
        metadata: { swappedDollars: Math.round(dollars) },
      }
    }

    // Bonds → traditional, stocks → taxable: swap the taxable account's bond
    // dollars for the traditional account's US-stock dollars (full and half).
    if (taxable && traditional) {
      const dollars = Math.min(
        (taxable.allocation.weights.bonds / 100) * taxable.balance,
        (traditional.allocation.weights.usStocks / 100) * traditional.balance,
      )
      if (dollars > 1000) {
        const explanation =
          'Holds the same household mix, but moves bond exposure into the traditional account (sheltering its ordinary-income yield) and US stocks into taxable (qualified dividends, basis step-up at death). Priced on the exact ledger.'
        candidates.push(
          swap('asset-location-bonds-to-traditional', 'Hold bonds in traditional, stocks in taxable', explanation, taxable, traditional, 'bonds', 'usStocks', dollars),
          swap('asset-location-bonds-to-traditional-half', 'Shift half the taxable bonds into traditional', explanation, taxable, traditional, 'bonds', 'usStocks', dollars / 2),
        )
      }
    }

    // Bonds → traditional, stocks → Roth: both tax-advantaged (no taxable
    // trade), concentrating the highest expected growth where it is never
    // taxed again.
    if (roth && traditional) {
      const dollars = Math.min(
        (roth.allocation.weights.bonds / 100) * roth.balance,
        (traditional.allocation.weights.usStocks / 100) * traditional.balance,
      )
      if (dollars > 1000) {
        candidates.push(
          swap(
            'asset-location-stocks-to-roth',
            'Hold stocks in Roth, bonds in traditional',
            'Holds the same household mix, but concentrates US stocks in the Roth (tax-free growth for you or heirs) and bonds in the traditional account. Priced on the exact ledger.',
            roth,
            traditional,
            'bonds',
            'usStocks',
            dollars,
          ),
        )
      }
    }

    return candidates
  },
}

/**
 * Full Social Security claiming grid for the optimizer page: every whole-year
 * claim combination from 62-70 (respecting current age) for up to two claiming
 * streams. When a stream's current claim age is a whole year within range, that
 * combination reproduces the current plan; a current claim age with months, below
 * 62, above 70, or already past is not emitted here. Bounded: 9 single-person
 * candidates or 81 couple candidates.
 */
export const socialSecurityClaimGridGenerator: CandidateGenerator = {
  id: 'social-security-claim-grid',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const entries = ctx.plan.incomes
      .filter((income): income is Extract<IncomeStream, { type: 'socialSecurity' }> => income.type === 'socialSecurity')
      // Match the planner's claiming-person logic: a default record carries
      // piaMonthly 0 (not null), which resolves to no benefit, so treat only a
      // positive entered PIA or an earnings history as a real claiming stream.
      // Otherwise a zero-PIA spouse inflates the grid with duplicate finalists.
      .filter((income) => (income.piaMonthly !== null && income.piaMonthly > 0) || (income.earnings?.length ?? 0) > 0)
      .slice(0, 2)
      .map((stream) => ({ stream, person: ctx.plan.household.people.find((p) => p.id === stream.personId) }))
      .filter(
        (entry): entry is { stream: Extract<IncomeStream, { type: 'socialSecurity' }>; person: Plan['household']['people'][number] } =>
          entry.person !== undefined,
      )

    if (entries.length === 0) return []

    const combos: Record<string, number>[] = [{}]
    for (const { person } of entries) {
      const ages = gridClaimAgesForPerson(person, ctx.simulateOptions.startYear)
      const next: Record<string, number>[] = []
      for (const partial of combos) {
        for (const age of ages) next.push({ ...partial, [person.id]: age })
      }
      combos.length = 0
      combos.push(...next)
    }

    return combos.map((claimByPersonId) => {
      const incomes = ctx.plan.incomes.map((income) =>
        income.type === 'socialSecurity' && claimByPersonId[income.personId] !== undefined
          ? { ...income, claimAge: { years: claimByPersonId[income.personId]!, months: 0 } }
          : income,
      )
      const label = entries.map(({ person }) => `${person.name} ${claimByPersonId[person.id]}`).join(' / ')
      const id = `ss-claim-grid-${entries.map(({ person }) => `${person.id}-${claimByPersonId[person.id]}`).join('-')}`
      return {
        id,
        source: 'scenario-sweep',
        category: 'social-security',
        label: `Social Security claim ages: ${label}`,
        explanation: 'Runs this whole-year Social Security claim-age combination through the shared exact-ledger decision engine.',
        planPatch: { incomes },
        metadata: {
          decisionRule: 'socialSecurityClaimGrid',
          claimByPersonId,
        },
      }
    })
  },
}

/**
 * Wrap MILP optimizer output (raw and post-processed schedules) as candidates.
 * The solver is one candidate generator among several — never the authority.
 */
export function milpScheduleGenerator(schedules: {
  raw?: OptimizedSchedule | null
  cleanedConversions?: Array<{ year: number; amount: number }> | null
}): CandidateGenerator {
  return {
    id: 'milp-schedules',
    generate(): DecisionCandidate[] {
      const candidates: DecisionCandidate[] = []
      if (schedules.raw && schedules.raw.conversions.length > 0) {
        candidates.push({
          id: 'milp-raw',
          source: 'milp',
          category: 'roth',
          label: 'Optimizer schedule (raw)',
          explanation: 'The raw MILP conversion schedule, priced on the exact ledger.',
          conversions: schedules.raw.conversions,
        })
      }
      if (schedules.cleanedConversions && schedules.cleanedConversions.length > 0) {
        candidates.push({
          id: 'milp-cleaned',
          source: 'milp',
          category: 'roth',
          label: 'Optimizer schedule (exact-ledger cleaned)',
          explanation: 'The post-processed MILP schedule the exact ledger can execute in full.',
          conversions: schedules.cleanedConversions,
        })
      }
      return candidates
    },
  }
}

/** Ending balance of an account, 0 for the types that don't carry one. */
function accountBalance(account: Account): number {
  return 'balance' in account ? account.balance : 0
}

/**
 * Annuity purchase candidates (guaranteed-income-and-estate-depth, step 6;
 * ladders added by annuity-pension-and-home-equity, step 1): no purchase /
 * cover-the-floor SPIA / a laddered version of the same SPIA (three dated
 * tranches, so rising age-payout rates and shorter rate lock-in are priced) /
 * QLAC at the cap. Each is a concrete, bounded plan patch that adds (or
 * removes) annuity purchases; the exact ledger prices the liquidity ↓ /
 * durability ↑ / estate Δ tradeoff — generation never decides. Bounded: at
 * most four candidates. Payout rates come from the sourced default table in
 * ./spiaQuotes (user-entered purchases carry their own quotes).
 */
export const annuityPurchaseGenerator: CandidateGenerator = {
  id: 'annuity-purchase',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const plan = ctx.plan
    const startYear = ctx.simulateOptions.startYear
    const primary = plan.household.people[0]
    if (!primary) return []
    const currentAge = startYear - dobYear(primary.dob)
    const candidates: DecisionCandidate[] = []

    // No-purchase alternative, only meaningful when the plan already buys one.
    if (plan.accounts.some((a) => a.type === 'annuity' && a.purchase)) {
      candidates.push({
        id: 'annuity-none',
        source: 'heuristic',
        category: 'guaranteed-income',
        label: 'No annuity purchase',
        explanation:
          'Runs the plan with the annuity purchase removed, so the liquidity and estate cost of buying guaranteed income is priced on the exact ledger.',
        planPatch: { accounts: plan.accounts.filter((a) => !(a.type === 'annuity' && a.purchase)) },
      })
    }

    // Cover-the-floor SPIA: an immediate non-qualified annuity funded from the
    // largest liquid account, premium bounded at a quarter of that balance.
    const liquid = plan.accounts
      .filter((a) => a.type === 'cash' || a.type === 'taxable')
      .sort((a, b) => accountBalance(b) - accountBalance(a))[0]
    if (liquid && accountBalance(liquid) > 25_000) {
      const startAge = Math.min(95, Math.max(currentAge, 65))
      const premium = Math.min(accountBalance(liquid) * 0.25, 250_000)
      const monthly = (premium * spiaPayoutRate(startAge)) / 12
      const annuity: Account = {
        // Namespaced by year + funding account so the synthetic candidate account
        // cannot collide with (and silently overwrite) a real user account id.
        id: `annuity-spia-candidate-${startYear}-${liquid.id}`,
        type: 'annuity',
        name: 'SPIA (candidate)',
        ownerPersonId: primary.id,
        annualReturnPct: null,
        startAge,
        monthlyAmount: monthly,
        colaPct: 0,
        taxablePct: 100,
        purchase: { year: startYear, premium, fundingAccountId: liquid.id, taxQualification: 'nonQualified' },
      }
      candidates.push({
        id: 'annuity-spia',
        source: 'heuristic',
        category: 'guaranteed-income',
        label: 'Cover-the-floor SPIA purchase',
        explanation: `Trades $${Math.round(premium).toLocaleString()} of liquid savings for an immediate life annuity (~$${Math.round(monthly).toLocaleString()}/mo), taxed by exclusion ratio and priced on the exact ledger.`,
        planPatch: { accounts: [...plan.accounts, annuity] },
        metadata: { premium: Math.round(premium), monthly: Math.round(monthly) },
      })

      // Laddered alternative: the same premium in three dated tranches (now,
      // +3y, +6y). Later tranches buy at older-age (higher) payout rates and
      // keep the deferred dollars invested meanwhile; the exact ledger prices
      // whether that beats the single purchase.
      const trancheYears = [0, 3, 6]
      const tranchePremium = premium / trancheYears.length
      const ladderAccounts: Account[] = trancheYears.map((offset) => {
        const trancheStartAge = Math.min(95, startAge + offset)
        return {
          id: `annuity-spia-ladder-candidate-${startYear + offset}-${liquid.id}`,
          type: 'annuity',
          name: `SPIA ladder tranche ${startYear + offset} (candidate)`,
          ownerPersonId: primary.id,
          annualReturnPct: null,
          startAge: trancheStartAge,
          monthlyAmount: (tranchePremium * spiaPayoutRate(trancheStartAge)) / 12,
          colaPct: 0,
          taxablePct: 100,
          purchase: {
            year: startYear + offset,
            premium: tranchePremium,
            fundingAccountId: liquid.id,
            taxQualification: 'nonQualified',
          },
        }
      })
      candidates.push({
        id: 'annuity-spia-ladder',
        source: 'heuristic',
        category: 'guaranteed-income',
        label: 'SPIA laddered over three purchases',
        explanation: `Splits the same $${Math.round(premium).toLocaleString()} into three SPIA purchases (now, +3y, +6y) at each age's payout rate, keeping deferred dollars invested meanwhile; priced on the exact ledger.`,
        planPatch: { accounts: [...plan.accounts, ...ladderAccounts] },
        metadata: { premium: Math.round(premium), tranches: trancheYears.length },
      })
    }

    // QLAC at the cap: a deferred qualified annuity funded from the largest
    // owner-controlled traditional account, premium held to the statutory cap.
    const traditional = plan.accounts
      .filter((a): a is Extract<Account, { type: 'traditional' }> => a.type === 'traditional' && !a.inherited)
      .sort((a, b) => b.balance - a.balance)[0]
    if (traditional && traditional.balance > 50_000 && currentAge < 83) {
      // Match the projection's statutory-limit indexing: for a start year past the
      // latest pack the QLAC cap is inflation-projected, so an un-indexed cap would
      // systematically under-shoot "at the cap" (and mis-price the candidate).
      const { pack: qlacPack, isStandIn } = packForYear(startYear)
      const inflation = plan.assumptions.inflationPct / 100
      const capGrowth = isStandIn && startYear > LATEST_PACK_YEAR ? Math.pow(1 + inflation, startYear - qlacPack.year) : 1
      const cap = qlacPack.annuities.qlacPremiumCap * capGrowth
      const premium = Math.min(cap, traditional.balance * 0.25)
      const startAge = Math.min(85, Math.max(currentAge + 1, 80))
      // A QLAC bought years before it starts pays a much higher deferred rate.
      const monthly = (premium * QLAC_DEFERRED_PAYOUT_RATE) / 12
      const annuity: Account = {
        // Namespaced by year + funding account so the synthetic candidate account
        // cannot collide with (and silently overwrite) a real user account id.
        id: `annuity-qlac-candidate-${startYear}-${traditional.id}`,
        type: 'annuity',
        name: 'QLAC (candidate)',
        ownerPersonId: traditional.ownerPersonId ?? primary.id,
        annualReturnPct: null,
        startAge,
        monthlyAmount: monthly,
        colaPct: 0,
        taxablePct: 100,
        purchase: { year: startYear, premium, fundingAccountId: traditional.id, taxQualification: 'qualified', qlac: true },
      }
      candidates.push({
        id: 'annuity-qlac',
        source: 'heuristic',
        category: 'guaranteed-income',
        label: 'QLAC purchase at the cap',
        explanation: `Moves $${Math.round(premium).toLocaleString()} of traditional savings into a deferred longevity annuity starting at ${startAge} (fully taxable payouts, premium out of the RMD base), priced on the exact ledger.`,
        planPatch: { accounts: [...plan.accounts, annuity] },
        metadata: { premium: Math.round(premium), monthly: Math.round(monthly), startAge },
      })
    }

    return candidates
  },
}

/**
 * Social Security bridge / TIPS-ladder candidates
 * (social-security-bridge-and-tips-ladder, step 3): fund the gap years between
 * retirement and each claimant's chosen claim age with a TIPS bridge ladder
 * paying the forgone age-62 benefit, purchased from the largest liquid
 * account; plus the remove-the-ladders alternative when the plan already has
 * some. Bounded (≤ one bridge per person + one removal); the exact ledger
 * prices the liquidity ↓ / durability ↑ tradeoff — generation never decides.
 */
export const bridgeLadderGenerator: CandidateGenerator = {
  id: 'bridge-ladder',
  generate(ctx: DecisionContext): DecisionCandidate[] {
    const plan = ctx.plan
    const startYear = ctx.simulateOptions.startYear
    const candidates: DecisionCandidate[] = []

    if ((plan.incomeFloor?.ladders.length ?? 0) > 0) {
      candidates.push({
        id: 'income-floor-none',
        source: 'heuristic',
        category: 'guaranteed-income',
        label: 'No TIPS ladders',
        explanation:
          'Runs the plan with every TIPS ladder removed, so the cost of the guaranteed floor is priced on the exact ledger.',
        planPatch: { incomeFloor: { ladders: [] } },
      })
    }

    const liquid = plan.accounts
      .filter((a) => a.type === 'cash' || a.type === 'taxable')
      .sort((a, b) => accountBalance(b) - accountBalance(a))[0]
    if (!liquid) return candidates

    const newLadders: TipsLadder[] = []
    let totalCost = 0
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity' || stream.piaMonthly === null || stream.piaMonthly <= 0) continue
      const person = plan.household.people.find((p) => p.id === stream.personId)
      if (!person) continue
      const dobYearNum = dobYear(person.dob)
      const dobMonth = Number(person.dob.slice(5, 7))
      const dobDay = Number(person.dob.slice(8, 10))
      const retirementYear = person.retirementAge !== null ? dobYearNum + person.retirementAge : startYear
      const sized = sizeBridge({
        piaMonthly: stream.piaMonthly,
        dob: { year: dobYearNum, month: dobMonth, day: dobDay },
        claimAge: stream.claimAge,
        currentYear: startYear,
        retirementYear,
        curve: EMBEDDED_REAL_YIELD_CURVE,
      })
      if (!sized) continue
      // Skip when a plan ladder already covers the whole window (a ladder
      // ending even one year short leaves a real unfunded gap year).
      const covered = plan.incomeFloor?.ladders.some(
        (l) => l.startYear <= sized.startYear && l.endYear >= sized.endYear,
      )
      if (covered) continue
      totalCost += sized.ladderCost
      newLadders.push({
        // Namespaced by person so the synthetic candidate id cannot collide
        // with a real ladder id.
        id: `bridge-candidate-${startYear}-${stream.personId}`,
        name: `SS bridge (${person.name})`,
        purpose: 'bridge',
        startYear: sized.startYear,
        endYear: sized.endYear,
        annualRealAmount: sized.annualRealAmount,
        purchase: { year: startYear, fundingAccountId: liquid.id },
      })
    }
    // Same affordability gate as the ss-bridge-gap detector, so both surfaces
    // agree on whether a bridge is fundable.
    if (newLadders.length === 0 || accountBalance(liquid) < totalCost * BRIDGE_FUNDING_MIN_FRACTION) return candidates

    candidates.push({
      id: 'bridge-ladder',
      source: 'heuristic',
      category: 'guaranteed-income',
      label: 'TIPS bridge ladder covering the Social Security gap years',
      explanation: `Buys ~$${Math.round(totalCost).toLocaleString()} of TIPS maturing across the years before the chosen claim age, paying the forgone age-62 benefit so delaying Social Security never cuts lifestyle; priced on the exact ledger.`,
      planPatch: { incomeFloor: { ladders: [...(plan.incomeFloor?.ladders ?? []), ...newLadders] } },
      metadata: { totalCost: Math.round(totalCost), ladders: newLadders.length },
    })
    return candidates
  },
}

/** Wrap a modelable Insights detector action as a decision candidate generator. */
export function insightActionGenerator(args: {
  id: string
  category: DecisionCandidate['category']
  label: string
  explanation: string
  planPatch: Record<string, unknown>
}): CandidateGenerator {
  return {
    id: `insight-${args.id}`,
    generate(): DecisionCandidate[] {
      return [
        {
          id: args.id,
          source: 'detector',
          category: args.category,
          label: args.label,
          explanation: args.explanation,
          planPatch: args.planPatch,
        },
      ]
    },
  }
}
