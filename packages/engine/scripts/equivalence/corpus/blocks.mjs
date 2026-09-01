/**
 * Purpose-built corpus members for the annual `simulate.ts` phases this corpus
 * was built around, plus the blind spots that belong to the corpus itself
 * rather than to any one phase:
 *
 *   A  annual rebalance to target (start-of-year trade)
 *   B  pension lump-sum rollover
 *   C  HECM line open
 *   D  income pass 1 — wages
 *   E  property events + growth
 *   F  distributed taxable yield
 *   G  TIPS-ladder purchase funding
 *   H  permanent-life transitions + annual snapshot
 *   I  per-entity published facts
 *   J  annual expense boundaries
 *   K  annual SEPP distributions
 *   S  shared: whole-corpus holes found by measurement (see `blockS`)
 *
 * A, B, C and E are the earlier "simulate batch" extraction. Block D's phase
 * was extracted concurrently and independently on main as
 * `projection/internal/wageIncomeStreams.ts`; D's members stay because the
 * wages phase still runs in every capture. F through I are the later
 * `simulate-small-annual-boundaries` extraction and are measured by its own
 * reach spec. In `simulate-expense-sepp-boundaries.json`, block J's expense
 * members measure entries A through D and block K's SEPP members measure entry
 * E; the entry letters identify extracted boundaries, not corpus block names.
 *
 * The 29 curated example plans exercise A, D and E's growth leg incidentally,
 * but NONE of them carries a HECM line or a pension lump-sum election — grepped,
 * not assumed — so without this tier the differential check would pass on two of
 * the five blocks by never running them. Each member names the branch or hazard
 * it exists to reach in `covers`, and
 * `scripts/equivalence/specs/simulate-batch.json` and
 * `scripts/equivalence/specs/simulate-small-annual-boundaries.json` and
 * `scripts/equivalence/specs/simulate-expense-sepp-boundaries.json` are the
 * line-range specs that turn those claims into measured hit counts
 * (`equivalence.mjs reach`).
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

function cash(id, balance, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    type: 'cash',
    balance,
    annualContribution: 0,
    ...extra,
  }
}

function equityComp(id, balance, costBasis, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type: 'equityComp',
    balance,
    costBasis,
    annualContribution: 0,
    vestingMode: 'final',
    vestDate: null,
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

function debt(id, balance, extra = {}) {
  return {
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    type: 'debt',
    balance,
    interestPct: 0,
    monthlyPayment: 0,
    ...extra,
  }
}

function permanentLife(id, insured, extra = {}) {
  return {
    kind: 'permanentLife',
    id,
    name: id,
    insured,
    beneficiary: 'estate',
    annualPremium: 0,
    premiumMode: 'paidUp',
    deathBenefit: 0,
    cashValue: 0,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 0,
    ...extra,
  }
}

function ltc(id, owner) {
  return {
    kind: 'ltc',
    id,
    name: id,
    owner,
    annualPremium: 0,
    premiumMode: 'paidUp',
    benefitMonthly: 0,
    benefitPeriodYears: 'lifetime',
    eliminationPeriodDays: 0,
  }
}

function ladder(id, annualRealAmount, purchase, extra = {}) {
  return {
    id,
    name: id,
    purpose: 'floor',
    startYear: START_YEAR + 2,
    endYear: START_YEAR + 4,
    annualRealAmount,
    ...(purchase === null ? {} : { purchase }),
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
    // the second row compounds the first row's already-grown property value.
    // Only the first row declares a HECM; that opens one id-keyed line state,
    // so this member is not evidence for duplicate-row HECM accrual semantics.
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

// ---------------------------------------------------------------------------
// F — distributed taxable yield
// ---------------------------------------------------------------------------

function blockF() {
  const plan = shell(90)
  plan.accounts = [
    // Explicit taxable interest + dividends, paid to cash rather than
    // reinvested. The qualified-ratio clamp and every taxable-income fold are
    // live on this row.
    taxable('yield-explicit', 123_456.78, 70_000, {
      interestYieldPct: 2.25,
      dividendYieldPct: 3.75,
      qualifiedRatio: 0.4,
      reinvestDividends: false,
    }),
    // No account-level yield fields: derive them from the asset-class blend.
    taxable('yield-blended', 234_567.89, 120_000, {
      allocation: { ...STATIC_5050_NONE },
      reinvestDividends: true,
    }),
    // Muni sleeve: exempt yield only, with explicit zero taxable fields so the
    // allocation/default path cannot price the same dollars a second time.
    taxable('yield-exempt', 98_765.43, 80_000, {
      interestYieldPct: 0,
      dividendYieldPct: 0,
      taxExemptInterestYieldPct: 4.125,
      reinvestDividends: true,
    }),
    // Both skip gates: a zero start balance despite a stated yield, then a
    // positive taxable balance whose total distributed yield is zero.
    taxable('yield-zero-balance', 0, 0, { interestYieldPct: 5 }),
    taxable('yield-zero-rate', 50_000, 40_000, {
      interestYieldPct: 0,
      dividendYieldPct: 0,
      taxExemptInterestYieldPct: 0,
    }),
    cash('yield-nontaxable-skip', 10_000),
  ]
  return [
    member(
      'f1-distributedYieldArms',
      'F: explicit/blended/exempt taxable yields, reinvest and cash-pay rows, plus type/balance/rate skips',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ),
  ]
}

// ---------------------------------------------------------------------------
// G — TIPS-ladder purchase funding
// ---------------------------------------------------------------------------

function blockG() {
  const out = []

  {
    const plan = shell(90)
    plan.accounts = [
      cash('tips-cash', 1_000_000),
      cash('tips-cash-zero', 0),
      taxable('tips-taxable', 1_500, 500),
      equityComp('tips-equity', 80_000, 20_000),
      equityComp('tips-equity-cliff', 40_000, 10_000, {
        vestingMode: 'cliff',
        vestDate: `${START_YEAR + 2}-01-01`,
      }),
    ]
    plan.incomeFloor = {
      ladders: [
        // Already owned: a live ladder state with no purchase exercises the
        // purchase-absent skip on every simulated year.
        ladder('tips-owned', 5_000, null),
        // Full fill from cash/book value.
        ladder('tips-cash-full', 10_000, { year: START_YEAR, fundingAccountId: 'tips-cash' }),
        // Positive quote with no spendable dollars: zero scale and no debit.
        ladder('tips-cash-zero', 10_000, { year: START_YEAR, fundingAccountId: 'tips-cash-zero' }),
        // Deliberately larger than the brokerage balance: partial fill, scale
        // warning, and pro-rata taxable basis sale.
        ladder('tips-taxable-partial', 100_000, { year: START_YEAR, fundingAccountId: 'tips-taxable' }),
        // Full equity-comp sale with its distinct basis-ratio arithmetic.
        ladder('tips-equity-full', 8_000, { year: START_YEAR, fundingAccountId: 'tips-equity' }),
        // Positive unvested equity-comp balance is not spendable in the
        // purchase year: zero fill without pretending its book value is cash.
        ladder('tips-equity-unvested', 8_000, { year: START_YEAR, fundingAccountId: 'tips-equity-cliff' }),
      ],
    }
    out.push(
      member(
        'g1-cashTaxableEquityFunding',
        'G: no-purchase skip; full/zero cash; partial taxable; full/unvested equity-comp funding',
        plan,
        { horizonEndYear: START_YEAR + 1 },
      ),
    )
  }

  {
    const plan = shell(90)
    plan.accounts = [taxable('tips-shared', 25_000, 10_000)]
    plan.incomeFloor = {
      ladders: [
        ladder('tips-shared-first', 7_500, { year: START_YEAR, fundingAccountId: 'tips-shared' }),
        ladder('tips-shared-second', 7_500, { year: START_YEAR, fundingAccountId: 'tips-shared' }),
      ],
    }
    out.push(
      member(
        'g2-sharedFundingAccount',
        'G: two same-year ladders consume one taxable account in ladder order; the second observes the first sale',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// H — permanent-life transitions + annual snapshot
// ---------------------------------------------------------------------------

function blockH() {
  const plan = couplePlan({
    p1PlanningAge: 60,
    p2PlanningAge: 90,
  })
  plan.assumptions.inflationPct = 0
  plan.accounts = [
    cash('snapshot-dup', 11_111.11),
    taxable('snapshot-taxable', 22_222.22, 12_345.67),
    qualified('traditional', 'snapshot-ira', 33_333.33),
    // Same id as the cash row. `Object.fromEntries` must publish the later
    // property value while investable/property totals still count both rows.
    property('snapshot-dup', 44_444.44),
    property('__proto__', 55_555.55),
    property('hecm-fast', 500_000, {
      primaryResidence: true,
      hecm: hecm({ principalLimitPct: 50, upfrontCostPct: 10, growthRatePct: 15 }),
    }),
    property('hecm-small-a', 310_000, {
      primaryResidence: true,
      hecm: hecm({ principalLimitPct: 37.3, upfrontCostPct: 1.7, growthRatePct: 6.1 }),
    }),
    property('hecm-small-b', 470_000, {
      primaryResidence: true,
      hecm: hecm({ principalLimitPct: 42.1, upfrontCostPct: 2.3, growthRatePct: 7.2 }),
    }),
    debt('snapshot-debt', 66_666.66),
  ]
  plan.insurance = [
    // p2 remains alive: flat-rate compounding and schedule interpolation both
    // run throughout the bounded horizon.
    permanentLife('life-flat', 'p2', {
      cashValue: 12_345.67,
      cashValueGrowthPct: 4.25,
    }),
    // Duplicate policy id: the second row must read the first row's shadow
    // write, not the entry map's last-write opening value.
    permanentLife('life-flat', 'p2', {
      cashValue: 98_765.43,
      cashValueGrowthPct: 1.5,
    }),
    permanentLife('life-flat-default', 'p2', {
      cashValue: 321.09,
      cashValueGrowthPct: undefined,
    }),
    permanentLife('life-schedule', 'p2', {
      cashValue: 9_000,
      cashValueMode: 'schedule',
      cashValueGrowthPct: undefined,
      cashValueSchedule: [
        { age: 65, value: 8_000 },
        { age: 70, value: 28_000 },
      ],
    }),
    // p1's planning age equals their 2026 attained age. One row settles a
    // positive max(face, cash), one settles zero (the no-ledger arm); both are
    // then observed post-death in later years and remain zero.
    permanentLife('life-settle-positive', 'p1', {
      deathBenefit: 50_000,
      cashValue: 75_000,
    }),
    permanentLife('life-settle-zero', 'p1'),
    // Non-permanent policy exercises the helper's kind filter.
    ltc('life-kind-skip', 'p2'),
  ]
  return [
    member(
      'h1-insuranceAndSnapshot',
      'H: permanent-life flat/schedule/positive+zero settlement/post-death transitions; snapshot balances/property/debt/3 HECMs/insurance, duplicate and __proto__ ids, non-recourse clamp',
      plan,
      { horizonEndYear: START_YEAR + 20 },
    ),
  ]
}

// ---------------------------------------------------------------------------
// I — per-entity published facts
// ---------------------------------------------------------------------------

function blockI() {
  const out = []

  {
    // Pre-60 draws with omitted contribution basis make both owner-pool and
    // employer-account assumed-basis maps consequential. IDs/account order are
    // intentionally reverse-lexical so the helper's output sort is observable.
    const plan = couplePlan({
      p1Dob: '1971-01-01',
      p2Dob: '1972-01-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    })
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [
      qualified('roth', 'z-owned-roth', 20_000, { ownerPersonId: 'p2' }),
      qualified('roth', 'a-owned-roth', 20_000, { ownerPersonId: 'p1' }),
      qualified('roth', 'z-employer-roth', 20_000, { ownerPersonId: 'p2', kind: 'employer' }),
      qualified('roth', 'a-employer-roth', 20_000, { ownerPersonId: 'p1', kind: 'employer' }),
      cash('entity-cash-empty', 0),
    ]
    out.push(
      member(
        'i1-rothEntityOwnersAndFilters',
        'I: positive owned/employer Roth verdict filters, two owners, reverse account order, employer owner lookup',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // Both owners are RMD age. Omitted Form 8606 basis makes their independent
    // distribution channels consequential and gives the publication helper
    // multiple owner rows to filter, sort, and map.
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1950-01-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    })
    plan.accounts = [
      qualified('traditional', 'z-traditional', 265_000, { ownerPersonId: 'p2' }),
      qualified('traditional', 'a-traditional', 265_000, { ownerPersonId: 'p1' }),
    ]
    out.push(
      member(
        'i2-traditionalEntityOwnersAndFilters',
        'I: two positive Form 8606 assumed-basis owner channels, filtered/sorted/mapped independently',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // A young owner has no RMD/distribution channel. A manual conversion from
    // an owned IRA with omitted basis makes the conversion operand the first
    // true arm of the publication filter.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
    plan.accounts = [
      qualified('traditional', 'entity-conversion-trad', 200_000),
      qualified('roth', 'entity-conversion-roth', 10_000, { contributionBasis: 10_000 }),
      cash('entity-conversion-cash', 100_000),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 20_000 }],
    }
    out.push(
      member(
        'i3-form8606ConversionOnly',
        'I: Form 8606 filter reaches conversions > 0 with distributions equal to zero',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // The contract is bought from an owned IRA in year one and begins paying
    // in year two. At age 61 there is no RMD and no conversion, so a settled
    // qualified-contract payment is the only possible Form 8606 channel.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
    plan.accounts = [
      qualified('traditional', 'entity-annuity-trad', 100_000),
      {
        type: 'annuity',
        id: 'entity-annuity',
        name: 'entity-annuity',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        startAge: 61,
        monthlyAmount: 1_000,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: START_YEAR,
          premium: 50_000,
          fundingAccountId: 'entity-annuity-trad',
          taxQualification: 'qualified',
        },
      },
      cash('entity-annuity-cash', 100_000),
    ]
    out.push(
      member(
        'i4-form8606AnnuityOnly',
        'I: qualified annuity payment with no distribution/conversion; settlement currently leaves assumed annuity channel silent',
        plan,
        { horizonEndYear: START_YEAR + 1 },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// J — annual expense boundaries
// ---------------------------------------------------------------------------

function blockJ() {
  const out = []

  {
    // Duplicate phase ages deliberately rely on stable sort: the later age-60
    // row wins after the earlier one, despite a future phase appearing first
    // in plan order. The bounded deaths then expose couple, survivor and
    // nobody-alive scaling without changing the persisted longevity inputs.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.assumptions.inflationPct = 2.375
    plan.accounts = [cash('expense-lifestyle-cash', 2_000_000)]
    plan.expenses.baseAnnual = 54_321.09
    plan.expenses.requiredAnnual = 32_109.87
    plan.expenses.idealAnnual = 4_321.09
    plan.expenses.excessAnnual = 321.09
    plan.expenses.survivorSpendingPct = 63.25
    plan.expenses.phases = [
      { fromAge: 65, multiplier: 0.8125 },
      { fromAge: 60, multiplier: 1.375 },
      { fromAge: 60, multiplier: 1.0625 },
    ]
    out.push(
      member(
        'j1-fixedLifestylePhasesAndDeaths',
        'J: fixed lifestyle optional layers, stable unsorted/duplicate phases, inflation, couple/survivor/no-survivor gates',
        plan,
        { horizonEndYear: START_YEAR + 8, deathAgeByPersonId: { p1: 66, p2: 67 } },
      ),
    )
  }

  {
    // ABW folds these deliberately nonuniform balances in account order and
    // recomputes against a shrinking explicit planning-age horizon each year.
    // The legacy lifestyle stack is nonzero so an extraction that accidentally
    // adds rather than replaces it is visible in the complete dump.
    const plan = shell(72)
    plan.accounts = [
      taxable('abw-z-taxable', 10_000_000_000_000_000, 7_000_000_000_000_000),
      cash('abw-a-cash', 1),
      qualified('traditional', 'abw-m-traditional', 1),
    ]
    plan.expenses.baseAnnual = 98_765.43
    plan.expenses.requiredAnnual = 45_678.9
    plan.expenses.idealAnnual = 5_432.1
    plan.expenses.excessAnnual = 543.21
    plan.expenses.phases = [{ fromAge: 60, multiplier: 1.75 }]
    plan.expenses.spendingPolicy = {
      mode: 'abw',
      abw: {
        returnSource: 'fixed',
        fixedRealReturnPct: 4.125,
        horizon: 'planningAge',
        tiltPct: -1.375,
      },
    }
    out.push(
      member(
        'j2-abwOrderedPortfolioAndHorizon',
        'J: ABW ordered nonzero portfolio fold, explicit real return/tilt/planning-age horizon, fixed-stack replacement and all-dead zero gate',
        plan,
        { horizonEndYear: START_YEAR + 4, deathAgeByPersonId: { p1: 63 } },
      ),
    )
  }

  {
    // Policy order is intentionally not id order. Permanent-life premiums key
    // off insured; LTC premiums key off owner. p1 dies first, while p2 remains
    // alive long enough for an until-age row to charge and then stop.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.accounts = [cash('expense-premium-cash', 20_000_000_000_000_000)]
    plan.insurance = [
      permanentLife('premium-z-lifetime', 'p2', {
        annualPremium: 10_000_000_000_000_000,
        premiumMode: 'lifetime',
      }),
      ltc('premium-owner-lifetime', 'p1'),
      permanentLife('premium-paid-up', 'p1', {
        annualPremium: 777_777.77,
        premiumMode: 'paidUp',
      }),
      permanentLife('premium-a-until-age', 'p2', {
        annualPremium: 1,
        premiumMode: 'untilAge',
        premiumEndAge: 62,
      }),
    ]
    plan.insurance[1].annualPremium = 1
    plan.insurance[1].premiumMode = 'lifetime'
    out.push(
      member(
        'j3-premiumModesSubjectsAndOrder',
        'J: ordered lifetime/paid-up/until-age premiums, LTC owner vs life insured, subject death and stop-age gates',
        plan,
        { horizonEndYear: START_YEAR + 3, deathAgeByPersonId: { p1: 60, p2: 62 } },
      ),
    )
  }

  {
    // Two rows share `property-dup`; the helper row fold must retain plan order
    // rather than collapsing by id. The large-first-plus-three-small amounts
    // make that order observable in the aggregate even though cash-flow lines
    // are sorted downstream. Sale boundaries, omitted cost fields, inflation,
    // survivor and all-dead years are all live.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.assumptions.inflationPct = 7.125
    plan.accounts = [
      property('property-z-open', 500_000, {
        propertyTaxAnnual: 10_000_000_000_000_000,
      }),
      property('property-dup', 300_000, {
        insuranceAnnual: 1,
        plannedSaleYear: START_YEAR + 2,
      }),
      {
        ...property('property-dup', 200_000, {
          propertyTaxAnnual: 1,
        }),
        name: 'property-dup-second',
      },
      property('property-a-sells-next', 125_000, {
        propertyTaxAnnual: 0.5,
        insuranceAnnual: 0.5,
        plannedSaleYear: START_YEAR + 1,
      }),
      property('property-already-sold', 75_000, {
        propertyTaxAnnual: 999_999,
        insuranceAnnual: 999_999,
        plannedSaleYear: START_YEAR,
      }),
      cash('expense-property-cash', 20_000_000_000_000_000),
    ]
    out.push(
      member(
        'j4-propertyCostsSalesDuplicatesAndDeaths',
        'J: ordered inflated property tax/insurance rows, sale-year skips, omitted-zero operands, duplicate ids, survivor and all-dead gates',
        plan,
        { horizonEndYear: START_YEAR + 2, deathAgeByPersonId: { p1: 60, p2: 61 } },
      ),
    )
  }

  {
    // One year makes every monetary YearExpenses channel positive. Gross care
    // and the LTC benefit are intentionally almost equal, so the net-care and
    // total folds preserve their cancellation-sensitive subtraction order.
    const plan = shell(90)
    plan.assumptions.inflationPct = 1.875
    plan.accounts = [
      cash('expense-summary-cash', 5_000_000_000),
      debt('expense-summary-debt', 25_000.125, {
        interestPct: 1.75,
        monthlyPayment: 123.45625,
      }),
      property('expense-summary-property', 350_000, {
        propertyTaxAnnual: 4_321.0625,
        insuranceAnnual: 987.03125,
      }),
    ]
    plan.expenses.baseAnnual = 54_321.125
    plan.expenses.requiredAnnual = 21_234.0625
    plan.expenses.idealAnnual = 4_321.03125
    plan.expenses.excessAnnual = 432.0078125
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 123.45625
    plan.expenses.oneTimeGoals = [
      { id: 'summary-goal-required', label: 'required', year: START_YEAR, amount: 2_000.125, classification: 'required' },
      { id: 'summary-goal-target', label: 'target', year: START_YEAR, amount: 1_000.0625, classification: 'target' },
      { id: 'summary-goal-ideal', label: 'ideal', year: START_YEAR, amount: 500.03125, classification: 'ideal' },
      { id: 'summary-goal-excess', label: 'excess', year: START_YEAR, amount: 250.015625, classification: 'excess' },
    ]
    plan.insurance = [
      ltc('summary-ltc', 'p1'),
      permanentLife('summary-life', 'p1', {
        annualPremium: 321.015625,
        premiumMode: 'lifetime',
      }),
    ]
    plan.insurance[0].annualPremium = 654.03125
    plan.insurance[0].premiumMode = 'lifetime'
    plan.insurance[0].benefitMonthly = 83_333_333.33416666
    plan.careEvents = [
      {
        id: 'summary-care',
        personId: 'p1',
        startAge: 60,
        durationYears: 1,
        annualCost: 1_000_000_000.03,
      },
    ]
    out.push(
      member(
        'j5-allExpenseSummaryChannels',
        'J: every monetary expense summary channel nonzero, all four goal/lifestyle layers, cancellation-sensitive net LTC fold',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// K — annual SEPP distributions
// ---------------------------------------------------------------------------

function blockK() {
  const out = []

  {
    // Two basis-bearing owned IRAs distribute in reverse lexical account order;
    // their applications feed the deferred Form 8606 settlement. A third
    // amortization election is initially inactive, then enters the series in a
    // later year and retains its first-year amount in the cache thereafter.
    const plan = singlePersonPlan({
      dob: '1970-03-15',
      planningAge: 75,
      retirementAge: 65,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('sepp-basis-cash', 1_000_000),
      qualified('traditional', 'sepp-z-rmd', 1_000_000_000.125, {
        annualReturnPct: 0,
        nondeductibleBasis: 100_000_000.03125,
        sepp: { startAge: 56, method: 'rmd' },
      }),
      qualified('traditional', 'sepp-a-amort', 500_000.0625, {
        annualReturnPct: 5,
        nondeductibleBasis: 50_000.015625,
        sepp: { startAge: 56, method: 'amortization' },
      }),
      qualified('traditional', 'sepp-m-late-entry', 250_000.03125, {
        annualReturnPct: 3,
        sepp: { startAge: 58, method: 'amortization' },
      }),
    ]
    out.push(
      member(
        'k1-basisOrderedReentryAndAmortCache',
        'K: ordered multiple owned-IRA SEPP rows, pro-rata basis applications, inactive-to-active re-entry and fixed amortization cache',
        plan,
        { horizonEndYear: START_YEAR + 4 },
      ),
    )
  }

  {
    // p1 works through attained age 57 and first separates at 58; p2 has no
    // modeled separation. The rows expose inactive, refused, accepted and
    // IRA-during-employment arms without changing household facts mid-run.
    const plan = couplePlan({
      p1Dob: '1970-03-15',
      p2Dob: '1970-07-20',
      p1PlanningAge: 75,
      p2PlanningAge: 75,
      p1RetirementAge: 57.5,
      p2RetirementAge: null,
    })
    plan.accounts = [
      cash('sepp-employer-cash', 1_000_000),
      qualified('traditional', 'sepp-z-employer-too-early', 300_000, {
        ownerPersonId: 'p1',
        kind: 'employer',
        sepp: { startAge: 57, method: 'rmd' },
      }),
      qualified('traditional', 'sepp-a-employer-separated', 400_000, {
        ownerPersonId: 'p1',
        kind: 'employer',
        sepp: { startAge: 58, method: 'rmd' },
      }),
      qualified('traditional', 'sepp-m-employer-no-separation', 500_000, {
        ownerPersonId: 'p2',
        kind: 'employer',
        sepp: { startAge: 56, method: 'rmd' },
      }),
      qualified('traditional', 'sepp-b-ira-while-employed', 600_000, {
        ownerPersonId: 'p2',
        kind: 'ira',
        sepp: { startAge: 56, method: 'rmd' },
      }),
    ]
    plan.incomes = [wages('sepp-employer-wages', 'p1', 123_456.78)]
    out.push(
      member(
        'k2-employerSeparationBoundaries',
        'K: employer SEPP inactive/refused/accepted after fractional-age separation, missing separation, and IRA while employed',
        plan,
        { horizonEndYear: START_YEAR + 2 },
      ),
    )
  }

  {
    // The surviving spouse remains on the inherited path through 2027. The
    // explicit 2028 S2 election changes the exact same account into an owned
    // IRA, at which point its already-age-active SEPP may first distribute.
    const plan = singlePersonPlan({ dob: '1970-06-15', planningAge: 80 })
    plan.accounts = [
      cash('sepp-s2-cash', 1_000_000),
      qualified('traditional', 'sepp-s2-inherited', 500_000.125, {
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'surviving-spouse',
            beneficiaryBirthYear: 1970,
            soleBeneficiary: true,
            ownerBirthYear: 1945,
            election: 'treat-as-own',
            spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: START_YEAR + 2,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'equivalence corpus', asOf: '2026-08-31' },
          },
        },
        sepp: { startAge: 56, method: 'rmd' },
      }),
    ]
    out.push(
      member(
        'k3-spouseTreatAsOwnPrePostElection',
        'K: inherited S2 account blocks SEPP before the treat-as-own year and distributes after the identity flip',
        plan,
        { horizonEndYear: START_YEAR + 3 },
      ),
    )
  }

  {
    // Duplicate ids are valid when no retirement action references them. The
    // opening-balance map takes the later sub-cent row, so the earlier large
    // row seeds a sub-cent amortization amount into the shared id cache. The
    // later row then grows 999% annually: by year three, recomputing from its
    // current opening balance would produce a ledger-visible payment, while
    // the correctly reused first-year cache remains sub-cent. Reversing row
    // order or dropping the cache therefore changes complete output.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.accounts = [
      cash('sepp-subcent-cash', 1_000_000),
      qualified('traditional', 'sepp-shared-cache', 750_000, {
        sepp: { startAge: 56, method: 'amortization' },
      }),
      {
        ...qualified('traditional', 'sepp-shared-cache', 0.004, {
          annualReturnPct: 999,
          sepp: { startAge: 56, method: 'amortization' },
        }),
        name: 'sepp-shared-cache-subcent',
      },
    ]
    // Keep the cash-flow capture channel nonempty while every SEPP occurrence
    // remains suppressed by the exact-cent gate.
    plan.incomes = [wages('sepp-subcent-observable-wages', 'p1', 1_234.5)]
    out.push(
      member(
        'k4-subCentDuplicateAmortCacheOrder',
        'K: sub-cent first-year cache remains suppressed after duplicate-id opening balance grows past a recomputed ledger cent; order/cache alias is observable',
        plan,
        { horizonEndYear: START_YEAR + 2 },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// S — shared blind spots, owned by no single block
// ---------------------------------------------------------------------------

/**
 * Members that exist because the CORPUS was measured blind, not because one of
 * the five phases needs them. The corpus is the durable half of this tool, and
 * a hole in it produces a meaningless IDENTICAL for as long as it stays open.
 *
 * MEASURED, which is why this section exists at all: every other member here
 * ends its horizon at the household's own planning age, so no member simulates
 * a year after the last death. `origin/main` changed exactly that gate while
 * this work was in flight (PR #381, "Stop paying one-time income after the last
 * household death"), and the whole 57-member corpus produced the SAME dump
 * sha256 on both sides of it — ed0fb0bb…1382ae before and after — on a change
 * that moves $250,000 on a discriminating plan.
 */
function blockS() {
  const out = []

  {
    // `deathAgeByPersonId` kills the only person at 65 (2031) while
    // `horizonEndYear` keeps simulating to 2040, so nine post-death years are
    // actually projected. Both arms of the survivorship gate are live: the
    // recurring stream spans the death, one lump lands before it and one after.
    const plan = shell()
    plan.assumptions.inflationPct = 2
    plan.accounts = [
      taxable('tax-s1', 200_000, 120_000, { interestYieldPct: 2 }),
      qualified('traditional', 'ira-s1', 300_000),
    ]
    plan.incomes = [
      {
        type: 'recurring',
        id: 'rent-s1',
        label: 'rent',
        annualAmount: 24_000,
        startYear: START_YEAR,
        endYear: START_YEAR + 14,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
      // `inflationAdjusted` became REQUIRED on a one-time stream in plan schema
      // v5 (origin/main, "Give one-time income the inflation election recurring
      // income always had"), so these two carry it explicitly or the corpus no
      // longer validates. Both take `false`, which is what migratePlanV4ToV5
      // writes onto every stored plan and the only value that leaves these two
      // members paying the amounts they were authored to pay: the $250,000
      // measurement quoted above is about `lump-dead` landing whole.
      { type: 'oneTime', id: 'lump-alive', label: 'lump while alive', year: START_YEAR + 3, amount: 40_000, inflationAdjusted: false, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'lump-dead', label: 'lump after death', year: START_YEAR + 8, amount: 250_000, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    out.push(
      member(
        's1-postDeathIncomeGate',
        'S: nine simulated years after the last household death — the anyAlive gate on both income arms',
        plan,
        { horizonEndYear: START_YEAR + 14, deathAgeByPersonId: { p1: 65 } },
      ),
    )
  }

  return out
}

/** @returns {Promise<object[]>} every member in this tier, in a stable order. */
export async function blockMembers() {
  fixtures = await import('@retiregolden/engine/testing/planFixtures')
  return [
    ...blockA(),
    ...blockB(),
    ...blockC(),
    ...blockD(),
    ...blockE(),
    ...blockF(),
    ...blockG(),
    ...blockH(),
    ...blockI(),
    ...blockJ(),
    ...blockK(),
    ...blockS(),
  ]
}
