/**
 * Purpose-built corpus members for the five `simulate.ts` annual phases being
 * extracted in the "simulate batch" slice:
 *
 *   A  annual rebalance to target (start-of-year trade)
 *   B  pension lump-sum rollover
 *   C  HECM line open
 *   D  income pass 1 — wages
 *   E  property events + growth
 *
 * The 29 curated example plans exercise A, D and E's growth leg incidentally,
 * but NONE of them carries a HECM line or a pension lump-sum election — grepped,
 * not assumed — so without this tier the differential check would pass on two of
 * the five blocks by never running them. Each member names the branch or hazard
 * it exists to reach in `covers`, and
 * `scripts/equivalence/specs/simulate-batch.json` is the line-range spec that
 * turns those claims into measured hit counts (`equivalence.mjs reach`).
 *
 * Everything here is built from `@retiregolden/engine/testing/planFixtures`, so
 * this tier has no dependency outside the engine package. Plans are
 * deliberately small and slow-moving: a corpus member's job is to REACH a
 * branch, and a smaller plan makes a moved leaf easier to read.
 */
const START_YEAR = 2026

/**
 * `@retiregolden/engine/testing/planFixtures` is imported DYNAMICALLY, and that
 * is load-bearing rather than stylistic: the alias only resolves once
 * `configureEngineTree` has registered the resolve hook, and a static import
 * here would be resolved while this module itself is being linked — before the
 * CLI has parsed `--engine-src`.
 * @type {{ singlePersonPlan: Function, couplePlan: Function } | null}
 */
let fixtures = null
const singlePersonPlan = (...args) => fixtures.singlePersonPlan(...args)
const couplePlan = (...args) => fixtures.couplePlan(...args)
const socialSecurityIncome = (...args) => fixtures.socialSecurityIncome(...args)

/** @returns {object} a taxable account literal */
function taxable(id, balance, costBasis, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type: 'taxable',
    balance,
    costBasis,
    annualContribution: 0,
    ...extra,
  }
}

function qualified(type, id, balance, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type,
    balance,
    annualContribution: 0,
    ...(type === 'traditional' || type === 'roth' ? { kind: 'ira' } : {}),
    ...extra,
  }
}

function property(id, value, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type: 'property',
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    ...extra,
  }
}

function pension(id, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type: 'pension',
    startAge: 65,
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 0,
    ...extra,
  }
}

function wages(id, personId, annualGross, extra = {}) {
  return { type: 'wages', id, personId, annualGross, endAge: null, realGrowthPct: 0, ...extra }
}

/** 50/50 US stocks / bonds, rebalanced annually — drifts, so turnover is real. */
const STATIC_5050 = {
  mode: 'static',
  rebalancing: 'annual',
  weights: { usStocks: 50, intlStocks: 0, bonds: 50, cash: 0 },
}
const STATIC_5050_NONE = { ...STATIC_5050, rebalancing: 'none' }
const LINEAR_GLIDE = {
  mode: 'linear',
  rebalancing: 'annual',
  from: { usStocks: 80, intlStocks: 0, bonds: 20, cash: 0 },
  to: { usStocks: 30, intlStocks: 0, bonds: 70, cash: 0 },
  startYear: START_YEAR,
  endYear: START_YEAR + 20,
}

/**
 * A long-horizon single-person shell. `singlePersonPlan` defaults to a
 * planning age of 60 against a 1966 dob, which would end the projection in the
 * start year; every member here needs a horizon long enough for a start-of-year
 * or end-of-year phase to run more than once.
 */
function shell(planningAge = 90, opts = {}) {
  const plan = singlePersonPlan({ planningAge, ...opts })
  plan.household.state = opts.state ?? 'KY'
  return plan
}

function member(id, covers, plan, options = {}) {
  return { id: `blocks:${id}`, covers, plan, options: { startYear: START_YEAR, ...options }, tax: { kind: 'production' } }
}

// ---------------------------------------------------------------------------
// A — annual rebalance to target
// ---------------------------------------------------------------------------

function blockA() {
  const out = []

  {
    // Two allocated taxable accounts with DISTINCT ids: two sale rows, two
    // ledger lines, and a `realizedGains` fold with more than one term.
    const plan = shell()
    plan.accounts = [
      taxable('tax-a', 200_000, 100_000, { allocation: { ...STATIC_5050 } }),
      taxable('tax-b', 200_000, 100_000, { allocation: { ...STATIC_5050 } }),
    ]
    out.push(member('a1-twoTaxableDistinctIds', 'A: two taxable sale rows, ledger line order, realizedGains fold', plan))
  }

  {
    // The same two accounts sharing ONE id. `parsePlan` allows it (a duplicate
    // id is rejected only when a retirement action references it), and
    // `allocationTrack` is keyed by id, so the first row's retarget is visible
    // to the second — the intra-loop shared-state hazard, in output.
    const plan = shell()
    plan.accounts = [
      taxable('dup', 200_000, 100_000, { allocation: { ...STATIC_5050 } }),
      { ...taxable('dup', 200_000, 100_000, { allocation: { ...STATIC_5050 } }), name: 'dup-second' },
    ]
    out.push(member('a2-duplicateAccountIds', 'A: duplicate account ids share one allocation track (visibility rule)', plan))
  }

  {
    // Traditional + Roth + HSA allocated and rebalancing annually: the
    // retarget-only arm. Nothing is realized, so `realizedGains` stays 0 and
    // ONLY the end balances move — the arm no existing test covers.
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'trad-alloc', 300_000, { allocation: { ...STATIC_5050 } }),
      qualified('roth', 'roth-alloc', 150_000, { allocation: { ...STATIC_5050 } }),
      qualified('hsa', 'hsa-alloc', 80_000, { allocation: { ...STATIC_5050 } }),
    ]
    out.push(member('a3-nonTaxableRetarget', 'A: traditional/roth/hsa retarget with no realized gain', plan))
  }

  {
    // `rebalancing: 'none'` — the opt-out `continue`, plus one unallocated
    // account so the "no track" `continue` runs too.
    const plan = shell()
    plan.accounts = [
      taxable('tax-none', 250_000, 120_000, { allocation: { ...STATIC_5050_NONE } }),
      taxable('tax-plain', 100_000, 60_000),
    ]
    out.push(member('a4-optOutAndUntracked', "A: rebalancing 'none' and no-track continues", plan))
  }

  {
    // A linear glidepath: `targetWeightsAt` in its interpolating mode, so the
    // target moves every year rather than staying put after year two.
    const plan = shell()
    plan.accounts = [
      taxable('tax-glide', 800_000, 400_000, { allocation: { ...LINEAR_GLIDE } }),
      qualified('traditional', 'trad-glide', 900_000, { allocation: { ...LINEAR_GLIDE } }),
    ]
    out.push(member('a5-linearGlidepath', 'A: linear glidepath target moves every year', plan))
  }

  {
    // An allocated taxable account with a ZERO balance: turnover can be
    // positive while `state.balance > 0` is false, so the sale arm is skipped
    // and only the retarget runs.
    const plan = shell()
    plan.accounts = [
      taxable('tax-empty', 0, 0, { allocation: { ...STATIC_5050 } }),
      taxable('tax-funded', 100_000, 50_000, { allocation: { ...STATIC_5050 } }),
    ]
    out.push(member('a6-zeroBalanceAllocated', 'A: zero-balance allocated taxable skips the sale, still retargets', plan))
  }

  return out
}

// ---------------------------------------------------------------------------
// B — pension lump-sum rollover
// ---------------------------------------------------------------------------

function blockB() {
  const out = []

  {
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'ira-dest', 100_000),
      pension('pen-1', {
        lumpSumOffer: { amount: 250_000, electionYear: START_YEAR + 2 },
        lumpSumElection: { rolloverAccountId: 'ira-dest' },
      }),
    ]
    out.push(member('b1-electionIntoIra', 'B: election into an owned traditional IRA (occurrence + aggregated-IRA application)', plan))
  }

  {
    // TWO pensions electing into ONE destination in the SAME year: the
    // read-modify-write of `target.balance` inside the loop, where the second
    // application's "before" is the first's "after".
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'shared-dest', 123_456.789),
      pension('pen-x', {
        lumpSumOffer: { amount: 10_000.1, electionYear: START_YEAR + 1 },
        lumpSumElection: { rolloverAccountId: 'shared-dest' },
      }),
      pension('pen-y', {
        lumpSumOffer: { amount: 7_777.77, electionYear: START_YEAR + 1 },
        lumpSumElection: { rolloverAccountId: 'shared-dest' },
      }),
    ]
    out.push(member('b2-twoElectionsOneDestination', 'B: two same-year elections into one destination (shared running balance)', plan))
  }

  {
    // An owned EMPLOYER traditional plan: `type === 'traditional'` is true so
    // the occurrence is emitted, but `isAggregatedIra` is false so NO
    // application follows. The two gates are not one gate.
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'plan-401k', 200_000, { kind: 'employer', employerPlanType: '401k' }),
      pension('pen-emp', {
        lumpSumOffer: { amount: 90_000, electionYear: START_YEAR + 3 },
        lumpSumElection: { rolloverAccountId: 'plan-401k' },
      }),
    ]
    out.push(member('b3-electionIntoEmployerPlan', 'B: employer-plan destination emits an occurrence but no application', plan))
  }

  {
    // A ZERO offer: the credit still runs, `recordPensionRollover` is still
    // CALLED and then dropped by the sink's `skipNonPositive`, and no
    // occurrence is emitted.
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'ira-zero', 50_000),
      pension('pen-zero', {
        lumpSumOffer: { amount: 0, electionYear: START_YEAR + 1 },
        lumpSumElection: { rolloverAccountId: 'ira-zero' },
      }),
    ]
    out.push(member('b4-zeroAmountElection', 'B: zero-amount election — recorder called, ledger row dropped, no occurrence', plan))
  }

  {
    // An offer ON RECORD but NOT elected: the selection `continue`, and the
    // pension keeps paying its annuity.
    const plan = shell()
    plan.accounts = [
      qualified('traditional', 'ira-unelected', 50_000),
      pension('pen-offer-only', { lumpSumOffer: { amount: 120_000, electionYear: START_YEAR + 1 } }),
    ]
    out.push(member('b5-offerNotElected', 'B: offer on record without an election never credits', plan))
  }

  return out
}

// ---------------------------------------------------------------------------
// C — HECM line open
// ---------------------------------------------------------------------------

/** A HECM block with a quoted principal-limit factor. */
function hecm(extra = {}) {
  return { openYear: START_YEAR, growthRatePct: 7.5, drawPolicy: 'lastResort', ...extra }
}

function blockC() {
  const out = []

  {
    const plan = shell()
    plan.accounts = [
      property('home-1', 500_000, {
        primaryResidence: true,
        hecm: hecm({ principalLimitPct: 40, upfrontCostPct: 2 }),
      }),
      qualified('traditional', 'ira-c1', 200_000),
    ]
    out.push(member('c1-quotedPlfOpensAtStart', 'C: quoted principalLimitPct, openYear === startYear, financed upfront cost', plan))
  }

  {
    // `openYear` BEFORE the projection: `Math.max(openYear, startYear)` clamps
    // the open into the first projected year at today's value.
    const plan = shell()
    plan.accounts = [
      property('home-2', 400_000, {
        primaryResidence: true,
        // `upfrontCostPct` OMITTED, so the `?? 0` fallback at the loan-balance
        // line is exercised rather than assumed. Measured: every other HECM
        // member states it explicitly, and without this one that operand is a
        // cold region.
        hecm: hecm({ openYear: START_YEAR - 4, principalLimitPct: 35 }),
      }),
      qualified('traditional', 'ira-c2', 150_000),
    ]
    out.push(member('c2-openYearBeforeStart', 'C: openYear before startYear clamps in; upfrontCostPct omitted', plan))
  }

  {
    // A FUTURE open: the line opens mid-horizon, against a value that has
    // already grown, and the `year !== Math.max(...)` continue runs in every
    // other year.
    const plan = shell()
    plan.assumptions.inflationPct = 3
    plan.accounts = [
      property('home-3', 450_000, {
        primaryResidence: true,
        hecm: hecm({ openYear: START_YEAR + 6, principalLimitPct: 45, upfrontCostPct: 3 }),
      }),
      qualified('traditional', 'ira-c3', 200_000),
    ]
    out.push(member('c3-futureOpenAgainstGrownValue', 'C: future openYear opens against the grown property value', plan))
  }

  {
    // `principalLimitPct` OMITTED: the pack's published PLF approximation,
    // interpolated by the youngest borrower's age. No fixture in the repo
    // reaches this arm.
    const plan = shell()
    plan.accounts = [
      property('home-4', 600_000, {
        primaryResidence: true,
        hecm: hecm({ upfrontCostPct: 2.5 }),
      }),
      qualified('traditional', 'ira-c4', 250_000),
    ]
    out.push(member('c4-plfTableFallback', 'C: principalLimitPct omitted — the pack PLF-by-age fallback', plan))
  }

  {
    // The youngest borrower is UNDER 62 in the open year: the warning arm, and
    // the only member that reaches it. `warnings` is a Set spread into output,
    // so its insertion position is observable.
    const plan = shell(90, { dob: '1970-01-01' })
    plan.accounts = [
      property('home-5', 350_000, {
        primaryResidence: true,
        hecm: hecm({ principalLimitPct: 30, upfrontCostPct: 1 }),
      }),
      qualified('traditional', 'ira-c5', 120_000),
    ]
    out.push(member('c5-underAge62Warning', 'C: under-62 borrower at open adds the age warning', plan))
  }

  {
    // THREE lines open simultaneously. The downstream `hecmLoanTotal` /
    // `hecmEffectiveDebt` folds are zero-based, so with two lines a permutation
    // is exactly equal in IEEE-754; three terms are the minimum that can
    // separate one insertion order from another.
    const plan = shell()
    plan.accounts = [
      property('home-a', 300_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 41.7, upfrontCostPct: 2.3 }) }),
      property('home-b', 410_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 38.9, upfrontCostPct: 1.7 }) }),
      property('home-c', 527_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 44.3, upfrontCostPct: 3.1 }) }),
      qualified('traditional', 'ira-c6', 300_000),
    ]
    out.push(member('c6-threeConcurrentLines', 'C: three concurrently open lines — the minimum for a fold-order difference', plan))
  }

  {
    // A zero-valued property carrying a HECM: the `value <= 0` continue, so no
    // line ever opens.
    const plan = shell()
    plan.accounts = [
      property('home-zero', 0, { primaryResidence: true, hecm: hecm({ principalLimitPct: 40 }) }),
      qualified('traditional', 'ira-c7', 100_000),
    ]
    out.push(member('c7-zeroValueNeverOpens', 'C: zero property value never opens a line', plan))
  }

  {
    // Two property accounts sharing ONE id, BOTH carrying a HECM. The first
    // opens the line; the second is turned away by the phase's own
    // already-open guard, which no other member reaches. `propertyValues` is
    // last-write-wins by id, so the line opens against the SECOND account's
    // value — a quirk the extraction must preserve, not repair.
    const plan = shell()
    plan.accounts = [
      property('twin', 320_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 42, upfrontCostPct: 2 }) }),
      {
        ...property('twin', 275_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 33, upfrontCostPct: 4 }) }),
        name: 'twin-second',
      },
      qualified('traditional', 'ira-c8', 180_000),
    ]
    out.push(member('c8-duplicateIdsSecondSkipped', 'C: duplicate property ids — the second is skipped by the already-open guard', plan))
  }

  return out
}

// ---------------------------------------------------------------------------
// D — income pass 1: wages
// ---------------------------------------------------------------------------

function blockD() {
  const out = []

  {
    // TWO wage streams for ONE person in the same year, ON TOP OF a taxable
    // account with a positive interest yield. Nothing in the engine test tree
    // pairs those: the yield makes `ordinaryIncome` non-zero when the wages
    // fold runs (so `B + a + b` can differ from `B + (a + b)`), and the two
    // streams make the per-person read-modify-write and the fold ORDER live.
    const plan = shell(90, { retirementAge: 70 })
    plan.assumptions.inflationPct = 2.5
    plan.accounts = [taxable('tax-yield', 500_000, 250_000, { interestYieldPct: 3.5, dividendYieldPct: 1.25 })]
    plan.incomes = [
      wages('wage-1', 'p1', 120_000.37, { realGrowthPct: 1.5 }),
      // A NON-wages stream between the two wage rows: without it the phase's
      // own `stream.type !== 'wages'` skip is a cold region, because no other
      // member gives `plan.incomes` anything but wages.
      socialSecurityIncome('ss-p1', 2_400, 67),
      wages('wage-2', 'p1', 45_678.91, { realGrowthPct: 0 }),
    ]
    out.push(member('d1-twoStreamsOnePersonWithYieldBase', 'D: two same-year wage rows over a non-zero ordinaryIncome base', plan))
  }

  {
    // A couple: two people, each with wages, one stopping at an explicit
    // `endAge` and one at `retirementAge`. Both stop rules, and a
    // `wagesByPerson` map with two entries.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90, p1RetirementAge: 66, p2RetirementAge: null })
    plan.assumptions.inflationPct = 2
    plan.accounts = [taxable('tax-d2', 300_000, 200_000, { interestYieldPct: 2 })]
    plan.incomes = [
      wages('wage-p1', 'p1', 100_000),
      wages('wage-p2', 'p2', 80_000, { endAge: 63 }),
    ]
    out.push(member('d2-coupleBothStopRules', 'D: endAge and retirementAge stop rules, two wagesByPerson entries', plan))
  }

  {
    // A ZERO-gross stream beside a paying one: the sink's `amount <= 0` drop is
    // exercised rather than assumed, and a row that moves no money still
    // occupies its position in the fold.
    const plan = shell(90, { retirementAge: 68 })
    plan.accounts = [taxable('tax-d3', 200_000, 150_000, { interestYieldPct: 1.5 })]
    plan.incomes = [wages('wage-zero', 'p1', 0), wages('wage-paying', 'p1', 60_000)]
    out.push(member('d3-zeroGrossStream', 'D: zero-gross wage row is still a row; the ledger drop is the sink', plan))
  }

  {
    // A stream with NO stop at all (endAge null AND retirementAge null): wages
    // pay for the whole horizon, and a person who dies mid-horizon exercises
    // the `!s.alive` continue on the survivor's run.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 70, p1RetirementAge: null, p2RetirementAge: null })
    plan.assumptions.inflationPct = 2
    plan.accounts = [taxable('tax-d4', 250_000, 200_000, { interestYieldPct: 2 })]
    plan.incomes = [wages('wage-forever', 'p1', 40_000, { realGrowthPct: 0.75 }), wages('wage-dies', 'p2', 55_000)]
    out.push(member('d4-noStopAgeAndDeath', 'D: null stop age never stops; a dead earner is skipped', plan))
  }

  return out
}

// ---------------------------------------------------------------------------
// E — property events + growth
// ---------------------------------------------------------------------------

function blockE() {
  const out = []

  {
    // A legacy tax-free sale (no costBasis) of a home carrying an OPEN HECM
    // line: the non-recourse payoff clamp, the line delete, the deposit, and
    // the `legacyPropertySaleDeposits` ledger row.
    const plan = shell()
    plan.assumptions.inflationPct = 2.5
    plan.accounts = [
      property('home-sale', 480_000, {
        primaryResidence: true,
        plannedSaleYear: START_YEAR + 5,
        expectedNetProceeds: 455_000,
        hecm: hecm({ principalLimitPct: 40, upfrontCostPct: 2 }),
      }),
      qualified('traditional', 'ira-e1', 300_000),
      taxable('tax-e1', 100_000, 80_000),
    ]
    out.push(member('e1-legacySaleRepaysHecm', 'E: legacy sale repays a non-recourse line, closes it, deposits the rest', plan))
  }

  {
    // Growth only: no sale year at all, so the block runs every year with the
    // sale gate false, and the property value compounds at general inflation.
    const plan = shell()
    plan.assumptions.inflationPct = 3.25
    plan.accounts = [
      property('home-grow', 375_000, { primaryResidence: true }),
      // A legacy sale on a property carrying NO HECM line, so the payoff
      // ternary's `: 0` arm runs. Every other selling member here has a line
      // open on the id it sells, which left that arm cold.
      property('lot-nohecm', 90_000, { plannedSaleYear: START_YEAR + 3, expectedNetProceeds: 88_500 }),
      qualified('traditional', 'ira-e2', 200_000),
    ]
    out.push(member('e2-growthAndUnencumberedSale', 'E: growth at general inflation, plus a legacy sale with no HECM line', plan))
  }

  {
    // An EXACT-BASIS sale (costBasis set): `fixedAssetDispositions` already
    // priced and deposited it earlier in the year, so this block's legacy arm
    // must do nothing but zero the value.
    const plan = shell()
    plan.assumptions.inflationPct = 2
    plan.accounts = [
      property('home-basis', 600_000, {
        primaryResidence: true,
        plannedSaleYear: START_YEAR + 4,
        expectedNetProceeds: null,
        costBasis: 250_000,
        sellingCostPct: 6,
      }),
      qualified('traditional', 'ira-e3', 250_000),
      taxable('tax-e3', 120_000, 90_000),
    ]
    out.push(member('e3-exactBasisSaleSkipsLegacyArm', 'E: costBasis sale skips the legacy deposit and only zeroes the value', plan))
  }

  {
    // A CAPACITY-CLAMPED draw, several growth years after open. `principalLimit`
    // is never published, so it is observable ONLY when a draw is limited by
    // `principalLimit - loanBalance`: spending exceeds the portfolio, the
    // lastResort policy draws, and the line runs out.
    const plan = shell()
    plan.assumptions.inflationPct = 2
    plan.expenses.baseAnnual = 90_000
    plan.accounts = [
      property('home-draw', 300_000, {
        primaryResidence: true,
        hecm: hecm({ principalLimitPct: 20, upfrontCostPct: 1, growthRatePct: 4 }),
      }),
      qualified('traditional', 'ira-e4', 150_000),
      taxable('tax-e4', 60_000, 40_000),
    ]
    out.push(member('e4-capacityClampedDraw', 'E: line exhaustion makes principalLimit observable at all', plan))
  }

  {
    // Two property accounts sharing ONE id. `propertyValues` is keyed by id, so
    // the second row compounds the first row's already-grown value, and a HECM
    // line on that id compounds once per row.
    const plan = shell()
    plan.assumptions.inflationPct = 4
    plan.accounts = [
      property('home-dup', 250_000, { primaryResidence: true, hecm: hecm({ principalLimitPct: 35, upfrontCostPct: 2, growthRatePct: 6 }) }),
      // `expectedNetProceeds` NULL, so the sale falls back to the property's
      // own modelled value — the `?? value` arm, cold without this.
      { ...property('home-dup', 250_000, { plannedSaleYear: START_YEAR + 3 }), name: 'home-dup-second' },
      qualified('traditional', 'ira-e5', 200_000),
    ]
    out.push(member('e5-duplicatePropertyIds', 'E: duplicate property ids compound and clamp against a running shared value', plan))
  }

  return out
}

/** @returns {Promise<object[]>} every member in this tier, in a stable order. */
export async function blockMembers() {
  fixtures = await import('@retiregolden/engine/testing/planFixtures')
  return [...blockA(), ...blockB(), ...blockC(), ...blockD(), ...blockE()]
}
