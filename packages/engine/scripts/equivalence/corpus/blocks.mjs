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
 *   L  annual Social Security pass
 *   M  exact-cent annual ordinary-withdrawal boundary
 *   N  annual coordinated HECM eligibility + accepted-draw allocation
 *   O  annual inherited-IRA required distributions
 *   P  annual income setup (distributed yield followed by wages)
 *   R  remaining annual expense boundaries: debt/LTC, healthcare and guardrails
 *   S  shared: whole-corpus holes found by measurement (see `blockS`)
 *   T  aggregate Roth-conversion planning
 *   U  annual contributions and employer match
 *   V  annual purchased-annuity funding
 *   W  annual voluntary-withdrawal apply-flow boundary
 *   X  annual owner-RMD planning and deferral lifecycle
 *   Y  legacy aggregate QCD owner-character plan
 *   Z  annual pension and annuity income
 *   AB retirement-action settlement publication
 *   AE annual funding withdrawal effects
 *   AF annual funding candidate evaluation
 *
 * A, B, C and E are the earlier "simulate batch" extraction. Block D's phase
 * was extracted concurrently and independently on main as
 * `projection/internal/wageIncomeStreams.ts`; D's members stay because the
 * wages phase still runs in every capture. F through I are the later
 * `simulate-small-annual-boundaries` extraction and are measured by its own
 * reach spec. In `simulate-expense-sepp-boundaries.json`, block J's expense
 * members measure entries A through D and block K's SEPP members measure entry
 * E; the entry letters identify extracted boundaries, not corpus block names.
 * Blocks J through O, plus P, R, T, U, V, W, X, Y, Z, AB, AE and AF, each have a
 * phase-specific reach spec beside the earlier batch instruments.
 *
 * The 29 curated example plans exercise A, D and E's growth leg incidentally,
 * but NONE of them carries a HECM line or a pension lump-sum election — grepped,
 * not assumed — so without this tier the differential check would pass on two
 * of the original five A-through-E blocks by never running them. Each member
 * names the branch or hazard it exists to reach in `covers`, and
 * `scripts/equivalence/specs/simulate-batch.json`,
 * `scripts/equivalence/specs/simulate-small-annual-boundaries.json`,
 * `scripts/equivalence/specs/simulate-expense-sepp-boundaries.json`,
 * `scripts/equivalence/specs/simulate-social-security-boundary.json`,
 * `scripts/equivalence/specs/simulate-ordinary-withdrawal-boundary.json`,
 * `scripts/equivalence/specs/simulate-hecm-coordinated-boundary.json`,
 * `scripts/equivalence/specs/simulate-income-setup-boundary.json`,
 * `scripts/equivalence/specs/simulate-roth-conversion-boundary.json`,
 * `scripts/equivalence/specs/simulate-contributions-boundary.json`,
 * `scripts/equivalence/specs/simulate-annuity-purchase-funding-boundary.json`,
 * `scripts/equivalence/specs/simulate-remaining-expense-boundaries.json`,
 * `scripts/equivalence/specs/simulate-apply-flows-boundary.json`,
 * `scripts/equivalence/specs/simulate-owner-rmd.json`,
 * `scripts/equivalence/specs/simulate-qcd-owner-character-boundary.json`,
 * `scripts/equivalence/specs/simulate-inherited-ira-boundary.json`,
 * `scripts/equivalence/specs/simulate-pension-annuity-income-boundary.json`,
 * `scripts/equivalence/specs/simulate-retirement-action-settlement-publication-boundary.json`,
 * `scripts/equivalence/specs/simulate-year-result-assembly-boundary.json`,
 * `scripts/equivalence/specs/simulate-funding-fixed-point-boundary.json`,
 * `scripts/equivalence/specs/simulate-funding-withdrawal-effects-boundary.json`,
 * and `scripts/equivalence/specs/simulate-funding-candidate-evaluation-boundary.json`
 * are the
 * line-range specs that turn those claims into measured hit counts
 * (`equivalence.mjs reach`).
 * The YearResult assembly and funding-fixed-point boundaries have no dedicated
 * corpus blocks: their specs measure the existing full corpus and use `AC`,
 * `AD`, and `AF` only as reach-entry namespaces. Block AE pins the otherwise-cold
 * multi-account Roth-pool accumulation in the withdrawal-effects coordinator.
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
const setAcaYearContract = (...args) => fixtures.setAcaYearContract(...args)

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

function inheritedBeneficiary(overrides = {}) {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1965,
    soleBeneficiary: true,
    election: 'none',
    ownerBirthYear: 1940,
    provenance: { source: 'equivalence corpus', asOf: '2026-08-31' },
    ...overrides,
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

function ltc(id, owner, extra = {}) {
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
    ...extra,
  }
}

function monthly(amount, activeMonths = 12) {
  return Array.from({ length: 12 }, (_, month) =>
    month < activeMonths ? amount : 0)
}

function acaContract(plan, {
  year = START_YEAR,
  enrollment = 1_000,
  benchmark = enrollment,
  activeMonths = 12,
  coveredPersonIds = plan.household.people.map((person) => person.id),
  taxExemptInterest = { state: 'notApplicable', amount: null },
  foreignExclusionAddback = { state: 'notApplicable', amount: null },
  assertions = {},
} = {}) {
  if (plan.household.people.length > 2) {
    throw new Error('acaContract fixture supports at most a primary and spouse')
  }
  return {
    year,
    fplRegion: 'contiguous',
    taxFamilyMembers: plan.household.people.map((person, index) => ({
      personId: person.id,
      relationship: index === 0 ? 'primary' : 'spouse',
      requiredToFile: 'required',
      magi: 0,
    })),
    coveredMembers: coveredPersonIds.map((personId) => ({
      personId,
      enrollmentPremiumByMonth: monthly(enrollment, activeMonths),
      slcspBenchmarkPremiumByMonth: monthly(benchmark, activeMonths),
    })),
    taxExemptInterest,
    foreignExclusionAddback,
    assertions: {
      coverageEligibility: 'supported',
      form8814: 'notApplicable',
      specialAllocation: 'notApplicable',
      marriedFilingSeparatelyException: 'notApplicable',
      selfEmployedHealthInsuranceDeduction: 'notApplicable',
      otherMaterialFacts: 'none',
      ...assertions,
    },
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

function qualifiedAnnuity(
  id,
  fundingAccountId,
  premium,
  year,
  ownerPersonId = 'p1',
  ownerBirthYear = 1953,
) {
  return {
    type: 'annuity',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    startAge: year - ownerBirthYear,
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year,
      premium,
      fundingAccountId,
      taxQualification: 'qualified',
    },
  }
}

function purchasedAnnuity(id, fundingAccountId, premium, extra = {}) {
  const { purchase: purchaseOverride = {}, ...accountOverride } = extra
  return {
    type: 'annuity',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 56,
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    ...accountOverride,
    purchase: {
      year: START_YEAR,
      premium,
      fundingAccountId,
      taxQualification: 'nonQualified',
      ...purchaseOverride,
    },
  }
}

function wages(id, personId, annualGross, extra = {}) {
  return { type: 'wages', id, personId, annualGross, endAge: null, realGrowthPct: 0, ...extra }
}

function ordinaryWithdrawal(id, sequence, allocations, extra = {}) {
  const requestedAmount = allocations.reduce(
    (total, allocation) => total + allocation.requestedAmount,
    0,
  )
  return {
    actionId: id,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: START_YEAR,
    executionSequence: sequence,
    requestedAmount,
    allocations: allocations.map((allocation, index) => ({
      allocationId: `${id}-allocation-${index + 1}`,
      sourceAccountId: allocation.sourceAccountId,
      requestedAmount: allocation.requestedAmount,
    })),
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
    ...extra,
  }
}

function preStartNamedQcd(sourceAccountId, year, amount = 6_000) {
  const requestedAmount = Math.round(amount * 100)
  return {
    actionId: `qcd-pre-start-${year}`,
    kind: 'qcd',
    year,
    executionDate: `${year}-08-01`,
    executionSequence: 1,
    requestedAmount,
    provenance: { source: 'manual' },
    donorPersonId: 'p1',
    allocation: {
      allocationId: `qcd-pre-start-${year}-allocation`,
      sourceAccountId,
      requestedAmount,
    },
    charity: {
      designationId: `qcd-pre-start-${year}-charity`,
      name: 'Eligible public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function socialSecurity(id, personId, piaMonthly, claimYears, extra = {}) {
  return {
    type: 'socialSecurity',
    id,
    personId,
    piaMonthly,
    earnings: null,
    claimAge: { years: claimYears, months: 0 },
    ...extra,
  }
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
    // Duplicate ids are valid when no retirement action references them and
    // their forced-distribution facts agree. The grouped ledger aggregates the
    // two physical balances into one SEPP capacity while preserving each row's
    // own return. The shared amortization cache is seeded once from that logical
    // opening and reused while the high-return physical member changes its
    // later-year share; regrouping, recomputing, or collapsing the physical
    // rows therefore changes complete output.
    const firstDuplicate = qualified('traditional', 'sepp-shared-cache', 750_000, {
      sepp: { startAge: 56, method: 'amortization' },
    })
    const secondDuplicate = {
      ...qualified('traditional', 'sepp-shared-cache', 0.004, {
        annualReturnPct: 999,
        sepp: { startAge: 56, method: 'amortization' },
      }),
      name: 'sepp-shared-cache-subcent',
    }
    const sameForcedDistributionFacts =
      firstDuplicate.type === secondDuplicate.type &&
      firstDuplicate.kind === secondDuplicate.kind &&
      firstDuplicate.ownerPersonId === secondDuplicate.ownerPersonId &&
      JSON.stringify(firstDuplicate.inherited ?? null) ===
        JSON.stringify(secondDuplicate.inherited ?? null) &&
      JSON.stringify(firstDuplicate.sepp ?? null) ===
        JSON.stringify(secondDuplicate.sepp ?? null)
    if (!sameForcedDistributionFacts) {
      throw new Error('K4 duplicate rows must retain identical forced-distribution facts')
    }
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.accounts = [
      cash('sepp-subcent-cash', 1_000_000),
      firstDuplicate,
      secondDuplicate,
    ]
    // Keep the cash-flow capture channel nonempty while every SEPP occurrence
    // remains suppressed by the exact-cent gate.
    plan.incomes = [wages('sepp-subcent-observable-wages', 'p1', 1_234.5)]
    out.push(
      member(
        'k4-subCentDuplicateAmortCacheOrder',
        'K: compatible duplicate rows share aggregate SEPP capacity and one first-year amortization cache while retaining positional growth',
        plan,
        { horizonEndYear: START_YEAR + 2 },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// L — annual Social Security pass
// ---------------------------------------------------------------------------

function blockL() {
  const out = []

  {
    // Three payable streams for one person make the left-to-right benefit and
    // publication folds observable. The two $0.50 PIAs are individually below
    // the ULP after the huge stream but cross it when pre-summed. All three
    // claim midyear; a fixed COLA and a later haircut exercise both annual
    // scalars. The unresolved fourth stream must still publish an empty row.
    const plan = singlePersonPlan({ dob: '1964-06-15', planningAge: 75 })
    plan.assumptions.ssCola = { mode: 'fixed', annualPct: 0.125 }
    plan.assumptions.ssHaircut = { fromYear: START_YEAR + 1, cutPct: 17.5 }
    plan.accounts = [cash('ss-own-cash', 200_000_000_000_000_000)]
    plan.incomes = [
      {
        type: 'recurring',
        id: 'ss-own-non-ss-skip',
        label: 'non-SS loop sentinel',
        annualAmount: 1,
        startYear: START_YEAR,
        endYear: START_YEAR + 2,
        inflationAdjusted: false,
        taxTreatment: 'none',
      },
      socialSecurity('ss-own-z-huge', 'p1', 10_000_000_000_000_000, 62, {
        claimAge: { years: 62, months: 6 },
      }),
      socialSecurity('ss-own-duplicate-small', 'p1', 0.5, 62, {
        claimAge: { years: 62, months: 6 },
      }),
      socialSecurity('ss-own-duplicate-small', 'p1', 0.5, 62, {
        claimAge: { years: 62, months: 6 },
      }),
      socialSecurity('ss-own-unresolved', 'p1', null, 62, {
        claimAge: { years: 62, months: 6 },
      }),
    ]
    out.push(
      member(
        'l1-ownOrderedFpPublication',
        'L: ordered same-person own benefits and duplicate-ID stream publication, midyear claim, fixed COLA, haircut transition, unresolved empty row',
        plan,
        { horizonEndYear: START_YEAR + 2 },
      ),
    )
  }

  {
    // Both 70-year-olds claim at the age-70 ceiling. The low earner keeps their own
    // delayed benefit plus only the room remaining under the high worker's
    // family maximum. Stream order is deliberately high then low, not person
    // order; matching-inflation COLA changes the second year's exact fold.
    const plan = couplePlan({
      p1Dob: '1956-06-15',
      p2Dob: '1956-06-15',
      p1PlanningAge: 85,
      p2PlanningAge: 85,
    })
    plan.assumptions.inflationPct = 3.125
    plan.assumptions.ssCola = { mode: 'matchInflation', annualPct: 9.99 }
    plan.accounts = [cash('ss-spousal-cash', 5_000_000)]
    plan.incomes = [
      socialSecurity('ss-spousal-z-high', 'p2', 1_000, 70, {
        claimAge: { years: 70, months: 0 },
      }),
      socialSecurity('ss-spousal-a-low', 'p1', 100, 70, {
        claimAge: { years: 70, months: 0 },
      }),
    ]
    out.push(
      member(
        'l2-currentSpouseFamilyMaximum',
        'L: current-spouse age-70 top-up, worker family-maximum cap, high/low stream order and match-inflation COLA',
        plan,
        { horizonEndYear: START_YEAR + 1 },
      ),
    )
  }

  {
    // p2 is already deceased in the first projected year, but their stream is
    // still computed as the survivor anchor and published not-payable. p1's
    // survivor step-up is fully withheld while working, then the accumulated
    // whole months are credited at FRA when wages stop.
    const plan = couplePlan({
      p1Dob: '1964-06-15',
      p2Dob: '1959-06-15',
      p1PlanningAge: 90,
      p2PlanningAge: 65,
      p1RetirementAge: 67,
    })
    plan.accounts = [cash('ss-survivor-cash', 5_000_000)]
    plan.incomes = [
      wages('ss-survivor-wages', 'p1', 200_000),
      socialSecurity('ss-survivor-sibling-own', 'p1', 0, 62),
      socialSecurity('ss-survivor-a-own', 'p1', 1_000, 62),
      socialSecurity('ss-survivor-z-deceased', 'p2', 3_000, 62),
    ]
    out.push(
      member(
        'l3-survivorWithholdingAndCredit',
        'L: deceased computation anchor, early survivor step-up, sibling publication zeroing, living/dead publication, full earnings withholding and FRA month credit',
        plan,
        { startYear: START_YEAR - 1, horizonEndYear: START_YEAR + 5 },
      ),
    )
  }

  {
    // The resolved own stream is successively beaten by an unresolved-PIA
    // divorced-spousal stream and then an unresolved-PIA former-spouse survivor
    // stream. The final low former-spouse candidate does not beat the survivor;
    // an ineligible short-marriage row yields no best benefit at all. This also
    // exercises sibling publication zeroing and both marital source tags.
    const plan = singlePersonPlan({ dob: '1964-07-01', planningAge: 85 })
    plan.accounts = [cash('ss-former-cash', 2_000_000)]
    plan.incomes = [
      socialSecurity('ss-former-own', 'p1', 800, 62, {
        claimAge: { years: 62, months: 6 },
      }),
      socialSecurity('ss-former-divorced', 'p1', null, 62, {
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{
          id: 'ss-ex-divorced',
          relationship: 'divorced',
          dob: '1958-01-01',
          piaMonthly: 3_000,
          marriageYears: 15,
          remarriedAtAge: null,
        }],
      }),
      socialSecurity('ss-former-survivor', 'p1', null, 62, {
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{
          id: 'ss-ex-deceased',
          relationship: 'deceased',
          dob: '1958-01-01',
          piaMonthly: 4_000,
          marriageYears: 15,
          remarriedAtAge: 61,
          deceasedClaimAge: { years: 62, months: 0 },
        }],
      }),
      socialSecurity('ss-former-lower-candidate', 'p1', null, 62, {
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{
          id: 'ss-ex-lower',
          relationship: 'divorced',
          dob: '1958-01-01',
          piaMonthly: 500,
          marriageYears: 12,
          remarriedAtAge: null,
        }],
      }),
      socialSecurity('ss-former-ineligible', 'p1', null, 62, {
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{
          id: 'ss-ex-short-marriage',
          relationship: 'divorced',
          dob: '1958-01-01',
          piaMonthly: 9_000,
          marriageYears: 5,
          remarriedAtAge: null,
        }],
      }),
      socialSecurity('ss-former-future-claim', 'p1', null, 70, {
        formerSpouses: [{
          id: 'ss-ex-future-claim',
          relationship: 'divorced',
          dob: '1958-01-01',
          piaMonthly: 9_000,
          marriageYears: 15,
          remarriedAtAge: null,
        }],
      }),
    ]
    out.push(
      member(
        'l4-formerSpouseReplacementMenu',
        'L: sequential divorced/survivor replacements through unresolved streams, future/lower/no-best candidates and sibling publication zeroing',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // Both people are pre-onset in 2024 and enter SSDI in 2025. p1's wages
    // exceed SGA and suspend only that benefit; p2 remains payable. At FRA the
    // same full-PIA dollars convert to own-retirement and the SGA gate stands
    // down, then remain payable in the first post-FRA year.
    const plan = couplePlan({
      p1Dob: '1960-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
      p1RetirementAge: 67,
      p2RetirementAge: null,
    })
    plan.accounts = [cash('ss-ssdi-cash', 2_000_000)]
    plan.incomes = [
      wages('ss-ssdi-wages', 'p1', 60_000),
      socialSecurity('ss-ssdi-z-suspended', 'p1', 2_000, 67, {
        disability: { onsetAge: 65 },
      }),
      socialSecurity('ss-ssdi-a-paid', 'p2', 1_500, 67, {
        disability: { onsetAge: 65 },
      }),
    ]
    out.push(
      member(
        'l5-ssdiOnsetSgaAndFraConversion',
        'L: SSDI pre-onset, paid and SGA-suspended workers, FRA source conversion, first post-FRA year and no retirement earnings test',
        plan,
        { startYear: START_YEAR - 2, horizonEndYear: START_YEAR + 2 },
      ),
    )
  }

  {
    // A month-six age-62 claim is fully withheld for several pre-FRA years;
    // only payable months can be credited in the first year. Wages continue
    // through the FRA calendar year so the distinct $1-for-$3 threshold arm
    // executes, then stop in the first post-FRA year.
    const plan = singlePersonPlan({
      dob: '1964-06-15',
      planningAge: 80,
      retirementAge: 68,
    })
    plan.accounts = [cash('ss-earnings-cash', 2_000_000)]
    plan.incomes = [
      wages('ss-earnings-wages', 'p1', 200_000),
      socialSecurity('ss-earnings-claim', 'p1', 3_000, 62, {
        claimAge: { years: 62, months: 6 },
      }),
    ]
    out.push(
      member(
        'l6-earningsTestFraLifecycle',
        'L: partial first claim year, below-FRA and FRA-year earnings tests, payable-month credit cap, credited claim factor and post-FRA stand-down',
        plan,
        { horizonEndYear: START_YEAR + 6 },
      ),
    )
  }

  {
    // The high earner's SSDI gate is valid but still pre-onset, so their
    // resolved stream supplies the current-spouse comparison PIA without an
    // actual-monthly cache entry. That makes the worker-benefit fallback
    // observable. Two resolved low-earner streams make replacement zero the
    // non-gate sibling while publishing the spousal amount on the last stream.
    const plan = couplePlan({
      p1Dob: '1964-06-15',
      p2Dob: '1964-06-15',
      p1PlanningAge: 85,
      p2PlanningAge: 85,
    })
    plan.accounts = [cash('ss-spousal-fallback-cash', 2_000_000)]
    plan.incomes = [
      socialSecurity('ss-spousal-fallback-sibling', 'p1', 0, 62, {
        disability: { onsetAge: 65 },
      }),
      socialSecurity('ss-spousal-fallback-worker', 'p2', 1_000, 62, {
        disability: { onsetAge: 65 },
      }),
      socialSecurity('ss-spousal-fallback-gate', 'p1', 100, 62, {
        disability: { onsetAge: 65 },
      }),
    ]
    out.push(
      member(
        'l7-currentSpouseWorkerFallback',
        'L: current-spouse worker actual-monthly fallback from a pre-onset SSDI gate and resolved sibling publication zeroing',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // With no resolved own PIA, the former-spouse candidate starts from zero.
    // Wages then fully withhold it, and the missing resolved gate makes the
    // earnings-credit approximation use its explicit 12-month fallback.
    const plan = singlePersonPlan({
      dob: '1964-06-15',
      planningAge: 85,
      retirementAge: 67,
    })
    plan.accounts = [cash('ss-former-only-cash', 2_000_000)]
    plan.incomes = [
      wages('ss-former-only-wages', 'p1', 200_000),
      socialSecurity('ss-former-only-benefit', 'p1', null, 62, {
        formerSpouses: [{
          id: 'ss-former-only-ex',
          relationship: 'divorced',
          dob: '1958-01-01',
          piaMonthly: 3_000,
          marriageYears: 15,
          remarriedAtAge: null,
        }],
      }),
    ]
    out.push(
      member(
        'l8-formerOnlyMissingOwnGate',
        'L: former-spouse benefit without a resolved own gate, zero baseline, full withholding and 12-month earnings-credit fallback',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // The survivor is pre-onset on a valid SSDI stream, so it supplies a gate
    // without own dollars. The first year is pre-claim and the next is payable:
    // together they exercise both the survivor payable-month rejection and the
    // missing-own baseline before the deceased worker's benefit replaces it.
    const plan = couplePlan({
      p1Dob: '1964-06-15',
      p2Dob: '1959-06-15',
      p1PlanningAge: 85,
      p2PlanningAge: 65,
    })
    plan.accounts = [cash('ss-survivor-gate-cash', 2_000_000)]
    plan.incomes = [
      socialSecurity('ss-survivor-gate', 'p1', 500, 62, {
        disability: { onsetAge: 65 },
      }),
      socialSecurity('ss-survivor-gate-deceased', 'p2', 3_000, 62),
    ]
    out.push(
      member(
        'l9-survivorPreOnsetGate',
        'L: deceased survivor anchor with a pre-onset SSDI gate, pre-claim rejection and missing-own replacement baseline',
        plan,
        { startYear: START_YEAR - 1, horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// M — exact-cent annual ordinary-withdrawal boundary
// ---------------------------------------------------------------------------

function blockM() {
  const out = []

  {
    // Four ordered actions span every supported non-retirement source class,
    // and the second taxable action observes the first sale's exact closing
    // basis. The source ids are deliberately out of Plan order so immutable
    // opening-snapshot sorting, every nonzero annual total, and every final
    // write kind are observable together.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      taxable('m1-taxable', 10, 4, { annualReturnPct: 0 }),
      cash('m1-cash', 10, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      equityComp('m1-equity', 10, 4, { annualReturnPct: 0 }),
    ]
    plan.expenses.baseAnnual = 7.77
    plan.expenses.oneTimeGoals = [{
      id: 'm1-follow-on-liquidation',
      label: 'force remaining basis into the following-year ledger',
      year: START_YEAR + 1,
      amount: 30,
      classification: 'required',
    }]
    plan.strategies.retirementActions = [
      ordinaryWithdrawal('m1-cash-action', 1, [
        { sourceAccountId: 'm1-cash', requestedAmount: 111 },
      ]),
      ordinaryWithdrawal('m1-equity-action', 2, [
        { sourceAccountId: 'm1-equity', requestedAmount: 222 },
      ], { executionDate: `${START_YEAR}-06-15` }),
      ordinaryWithdrawal('m1-taxable-first', 3, [
        { sourceAccountId: 'm1-taxable', requestedAmount: 333 },
      ]),
      ordinaryWithdrawal('m1-taxable-second', 4, [
        { sourceAccountId: 'm1-taxable', requestedAmount: 111 },
      ]),
    ]
    out.push(
      member(
        'm1-orderedMixedSourceActions',
        'M: ordered multi-account cash, equity-compensation and sequential taxable actions; every total and final write channel is nonzero',
        plan,
        { horizonEndYear: START_YEAR + 1 },
      ),
    )
  }

  {
    // Each source is individually representable by the exact-cent ledger, but
    // their annual sum is not losslessly representable as one Plan number. The
    // first execution therefore reaches the aggregate boundary failure, after
    // which both facts are removed and the independent retry fails closed.
    const firstDollars = 90_071_992_547_409.9
    const secondDollars = 90_071_992_547_409.89
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('m2-aggregate-a', firstDollars, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      cash('m2-aggregate-b', secondDollars, { annualReturnPct: 0, ownerPersonId: 'p1' }),
    ]
    plan.strategies.retirementActions = [
      ordinaryWithdrawal('m2-aggregate-a-full', 1, [
        {
          sourceAccountId: 'm2-aggregate-a',
          requestedAmount: 9_007_199_254_740_990,
        },
      ]),
      ordinaryWithdrawal('m2-aggregate-b-full', 2, [
        {
          sourceAccountId: 'm2-aggregate-b',
          requestedAmount: 9_007_199_254_740_989,
        },
      ]),
    ]
    plan.incomes = [wages('m2-observable-wages', 'p1', 1.23)]
    out.push(
      member(
        'm2-aggregatePlanBoundaryRetry',
        'M: individually representable exact-cent cash actions whose annual aggregate cannot cross the Plan-number boundary and is retried without both sources',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // The opening balance itself is ledger-representable. Subtracting three
    // cents produces exact closing cents whose Plan-number spelling rounds back
    // to a different cent, so the first execution is discarded and retried
    // without that balance fact.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('m3-closing-balance', 90_071_992_547_409.9, {
        annualReturnPct: 0,
        ownerPersonId: 'p1',
      }),
    ]
    plan.strategies.retirementActions = [
      ordinaryWithdrawal('m3-three-cent-close', 1, [
        { sourceAccountId: 'm3-closing-balance', requestedAmount: 3 },
      ]),
    ]
    plan.incomes = [wages('m3-observable-wages', 'p1', 2.34)]
    out.push(
      member(
        'm3-unrepresentableClosingBalanceRetry',
        'M: representable opening cash balance whose three-cent debit creates an unrepresentable closing Plan balance and forces a fact-removal retry',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // m4-basis-omitted cannot enter the opening taxable snapshot at all. The
    // other taxable account can enter, but a three-cent sale recovers a large
    // exact basis amount and leaves 9,004,497,094,964,568 cents, which a Plan
    // number spells one cent higher. Its first attempt therefore reaches the
    // closing-basis retry while the valid cash action proves unrelated movement
    // survives both kinds of missing basis evidence. A fourth ordinary action
    // has an out-of-range opening balance, and a migrated aggregate request
    // reaches the execution-set branch that carries no person-alive evidence.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      taxable('m4-basis-omitted', 100, 90_071_992_547_410, { annualReturnPct: 0 }),
      taxable('m4-basis-closing', 100, 90_071_992_547_409.9, { annualReturnPct: 0 }),
      cash('m4-independent-cash', 10, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      cash('m4-opening-balance-omitted', 90_071_992_547_410, {
        annualReturnPct: 0,
        ownerPersonId: 'p1',
      }),
    ]
    plan.expenses.baseAnnual = 1
    plan.strategies.retirementActions = [
      ordinaryWithdrawal('m4-cash-survives', 1, [
        { sourceAccountId: 'm4-independent-cash', requestedAmount: 100 },
      ]),
      ordinaryWithdrawal('m4-missing-opening-basis', 2, [
        { sourceAccountId: 'm4-basis-omitted', requestedAmount: 3 },
      ]),
      ordinaryWithdrawal('m4-unrepresentable-closing-basis', 3, [
        { sourceAccountId: 'm4-basis-closing', requestedAmount: 3 },
      ]),
      ordinaryWithdrawal('m4-missing-opening-balance', 4, [
        { sourceAccountId: 'm4-opening-balance-omitted', requestedAmount: 100 },
      ]),
      {
        actionId: 'm4-legacy-aggregate',
        kind: 'legacyAggregateWithdrawal',
        year: START_YEAR,
        requestedAmount: 100,
        legacyCategory: 'cash',
        provenance: { source: 'migration' },
      },
    ]
    out.push(
      member(
        'm4-missingAndUnrepresentableBasisEvidence',
        'M: invalid opening balance/basis omission plus unrepresentable exact closing basis retry, while an independent cash action still commits and a legacy aggregate carries no person evidence',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// N — annual coordinated-HECM eligibility + accepted-draw allocation
// ---------------------------------------------------------------------------

function blockN() {
  const out = []

  {
    // The two cent-scale lines precede a much larger line on purpose:
    // ((0.01 + 0.01) + 1e14) !== ((1e14 + 0.01) + 0.01) in binary64. The
    // first HECM-bearing duplicate owns the shared line's coordinated policy;
    // its later last-resort alias must neither remove capacity nor receive a
    // second allocation. An earlier alias without HECM metadata deliberately
    // does not claim authority. Normal spending fills both small lines, then
    // takes a partial allocation from the large line, making source order and
    // the accepted scalar observable without exhausting total capacity. A
    // second loss year has no spending, so the same eligible ids reach
    // allocation's accepted-zero half-cent tolerance break.
    const plan = shell(63)
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.oneTimeGoals = [{
      id: 'n1-loss-year-spending',
      label: 'n1-loss-year-spending',
      year: START_YEAR + 1,
      amount: 70_000,
      classification: 'required',
    }]
    const tiny = property('n1-small-a', 0.2, {
      primaryResidence: true,
      hecm: hecm({
        principalLimitPct: 5,
        upfrontCostPct: 0,
        growthRatePct: 0,
        drawPolicy: 'coordinated',
      }),
    })
    plan.accounts = [
      taxable('n1-brokerage', 1_000_000, 1_000_000),
      { ...tiny, name: 'n1-small-a-earlier-no-hecm', hecm: undefined },
      tiny,
      {
        ...tiny,
        name: 'n1-small-a-later-last-resort',
        hecm: { ...tiny.hecm, drawPolicy: 'lastResort' },
      },
      property('n1-small-b', 0.2, {
        primaryResidence: true,
        hecm: hecm({
          principalLimitPct: 5,
          upfrontCostPct: 0,
          growthRatePct: 0,
          drawPolicy: 'coordinated',
        }),
      }),
      property('n1-large', 2_000_000_000_000_000, {
        primaryResidence: true,
        hecm: hecm({
          principalLimitPct: 5,
          upfrontCostPct: 0,
          growthRatePct: 0,
          drawPolicy: 'coordinated',
        }),
      }),
    ]
    out.push(
      member(
        'n1-duplicateDistinctOrderedPartial',
        'N: divergent-policy duplicate plus distinct coordinated lines, cancellation-sensitive source-order capacity fold, two full cent allocations, one partial allocation, then an accepted-zero tolerance break',
        plan,
        {
          horizonEndYear: START_YEAR + 2,
          market: { returnShockPct: [-10, -10, 0] },
        },
      ),
    )
  }

  {
    // ACA makes the outer coordinated-draw fixed point probe the same line
    // repeatedly before one scalar is accepted. Counterfactual mode also
    // re-enters the annual pass. The line must remain untouched through every
    // discarded probe and each discarded transaction, then commit once.
    const plan = singlePersonPlan({
      dob: '1963-01-01',
      planningAge: 63,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [{
      type: 'recurring',
      id: 'n2-pension',
      label: 'n2-pension',
      annualAmount: 30_000,
      startYear: START_YEAR,
      endYear: START_YEAR,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    }]
    plan.accounts = [
      taxable('n2-brokerage', 400_000, 400_000),
      property('n2-home', 600_000, {
        primaryResidence: true,
        hecm: hecm({
          principalLimitPct: 40,
          upfrontCostPct: 0,
          growthRatePct: 0,
          drawPolicy: 'coordinated',
        }),
      }),
    ]
    setAcaYearContract(plan, { year: START_YEAR })
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    out.push(
      member(
        'n2-acaProbeRollbackReentry',
        'N: ACA multi-probe accepts one coordinated scalar; counterfactual rollback and re-entry leave one committed allocation',
        plan,
        {
          startYear: START_YEAR - 1,
          horizonEndYear: START_YEAR,
          market: { returnShockPct: [-10, 0] },
        },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// P — annual income setup: distributed yield followed by wages
// ---------------------------------------------------------------------------

function blockP() {
  const out = []

  {
    // Every yield publication channel is nonzero across two rows, with only
    // the second reinvested. Three same-person wage rows then fold onto that
    // live ordinary-income base. The small middle operand and non-round growth
    // rates keep reassociation and phase-order defects visible after year one.
    const plan = shell(90, { retirementAge: 75 })
    plan.assumptions.inflationPct = 2.125
    plan.accounts = [
      taxable('p1-paid-yield', 123_456.78, 70_000, {
        annualReturnPct: 0,
        interestYieldPct: 2.25,
        dividendYieldPct: 3.75,
        qualifiedRatio: 1 / 3,
        taxExemptInterestYieldPct: 0.125,
        reinvestDividends: false,
      }),
      taxable('p1-reinvested-yield', 234_567.89, 120_000, {
        annualReturnPct: 0,
        interestYieldPct: 0.625,
        dividendYieldPct: 1.375,
        qualifiedRatio: 0.875,
        taxExemptInterestYieldPct: 0.25,
        reinvestDividends: true,
      }),
      cash('p1-none-row', 10_000),
    ]
    plan.incomes = [
      wages('p1-wage-large', 'p1', 120_000.37, { realGrowthPct: 1.375 }),
      socialSecurityIncome('p1-nonwage-skip', 0, 70),
      wages('p1-wage-small', 'p1', 0.000_000_03, { realGrowthPct: 0.125 }),
      wages('p1-wage-tail', 'p1', 45_678.91, { realGrowthPct: 0.625 }),
    ]
    out.push(
      member(
        'p1-yieldThenHostileWageFold',
        'P: every yield channel, paid and reinvested rows, an explicit none row, then three ordered same-person wages over the live ordinary-income base',
        plan,
        { horizonEndYear: START_YEAR + 4 },
      ),
    )
  }

  {
    // Duplicate taxable ids make the income-setup map contract observable:
    // both positional rows contribute to income, the id keeps its first map
    // position, and the second row replaces its growth/reinvestment value.
    // Wages arrive p2, p1, p2 so the per-person map's insertion and update
    // behavior feeds a live p2 Social Security earnings test.
    const plan = couplePlan({
      p1PlanningAge: 90,
      p2PlanningAge: 90,
      p1RetirementAge: null,
      p2RetirementAge: null,
    })
    plan.assumptions.inflationPct = 1.75
    plan.accounts = [
      taxable('p2-duplicate-yield', 100_000, 40_000, {
        annualReturnPct: 5,
        interestYieldPct: 1,
        dividendYieldPct: 2,
        qualifiedRatio: 0.25,
        taxExemptInterestYieldPct: 0.5,
        reinvestDividends: false,
      }),
      {
        ...taxable('p2-duplicate-yield', 250_000, 150_000, {
          annualReturnPct: 5,
          interestYieldPct: 3,
          dividendYieldPct: 4,
          qualifiedRatio: 0.75,
          taxExemptInterestYieldPct: 1.5,
          reinvestDividends: true,
        }),
        name: 'p2-duplicate-yield-second',
      },
      cash('p2-none-row', 250_000),
    ]
    plan.incomes = [
      wages('p2-wage-first', 'p2', 30_000.13, { endAge: 70 }),
      wages('p2-wage-p1', 'p1', 10_000.07, { endAge: 70 }),
      wages('p2-wage-second', 'p2', 25_000.11, { endAge: 70 }),
      socialSecurityIncome('p2-earnings-test', 2_500, 62, 'p2'),
    ]
    out.push(
      member(
        'p2-duplicateYieldAndPersonOrder',
        'P: duplicate taxable-id last-write economics with positional income folds, plus p2/p1/p2 wage-map insertion and update order consumed by Social Security',
        plan,
        { horizonEndYear: START_YEAR + 5 },
      ),
    )
  }

  {
    // The two person lookups intentionally disagree when an otherwise valid
    // plan repeats a person id: `personById` is LAST-wins, while the annual
    // `stateOf` lookup is FIRST-wins. In 2026 the first row is age 65 and the
    // last row's retirement age is 60, so the wage is stopped. Replacing the
    // state lookup with LAST-wins observes age 50 instead and pays the wage.
    // This deliberately relies on the legacy validation rule: duplicate
    // person ids are rejected only when a retirement action references the
    // id. A wage stream is not such an action, and this member declares no
    // retirement action, so parsePlan admits the shape and the simulator's
    // existing FIRST/LAST split stays measurable rather than only unit-tested.
    const plan = couplePlan({
      p1Dob: '1961-01-01',
      p2Dob: '1976-01-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
      p1RetirementAge: 70,
      p2RetirementAge: 60,
    })
    plan.household.people[1] = {
      ...plan.household.people[1],
      id: 'p1',
      name: 'Duplicate p1, last map entry',
    }
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [cash('p3-duplicate-person-cash', 100_000)]
    plan.incomes = [wages('p3-first-state-last-person', 'p1', 40_000)]
    out.push(
      member(
        'p3-duplicatePersonLookupAsymmetry',
        'P: duplicate person id preserves LAST-wins retirement-age lookup and FIRST-wins annual state lookup',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// X — owner RMD planning + first-year deferral lifecycle
// ---------------------------------------------------------------------------

function blockX() {
  const out = []

  {
    // Two owned IRAs share one election. The two SET operations must remain in
    // account order and cumulative; the next year consumes the resulting
    // April-1 amount before calculating and paying the separate December-31
    // requirement, then DELETEs the cross-year state. Nonmatching account
    // shapes ahead of the IRAs make the deferred-capacity filters observable.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 76 })
    plan.accounts = [
      qualified('roth', 'roth-f1', 50_000),
      qualified('traditional', 'employer-f1', 80_000, { kind: 'employer', employerPlanType: '401k' }),
      qualified('traditional', 'ira-f1-a', 265_000),
      qualified('traditional', 'ira-f1-b', 132_500),
    ]
    out.push(member(
      'x1-twoIraDeferralLifecycle',
      'X: ordered cumulative first-year SETs; next-year April-1 consumption, DELETE, and separate current RMD',
      plan,
      {
        horizonEndYear: 2027,
        rmdFirstYearDeferrals: [{
          distributionCalendarYear: 2026,
          applicablePlan: { kind: 'ownedTraditionalIras', payeePersonId: 'p1' },
        }],
      },
    ))
  }

  {
    // The annuity purchase happens before owner-RMD planning and leaves the
    // first IRA with only 8,000 against a much larger prior-year requirement.
    // The sibling IRA must sweep the exact remainder; simply dropping the
    // per-account obligation or the aggregation pass moves public output.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 74 })
    plan.accounts = [
      qualified('traditional', 'ira-f2-short', 500_000),
      qualified('traditional', 'ira-f2-sweep', 120_000),
      qualifiedAnnuity('annuity-f2', 'ira-f2-short', 492_000, 2026),
    ]
    out.push(member(
      'x2-ownedIraAggregationSweep',
      'X: depleted IRA leaves an owner-aggregate shortfall swept from a sibling IRA',
      plan,
      { horizonEndYear: 2026 },
    ))
  }

  {
    // 403(b)s aggregate with one another, while a 401(k) remains its own
    // applicable plan. Each depleted source has a distinct residual capacity,
    // so swapping the grouping or obligation arithmetic changes both the
    // distribution and the §4974 downstream result.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 74 })
    plan.accounts = [
      qualified('traditional', '403b-f3-short', 200_000, { kind: 'employer', employerPlanType: '403b' }),
      qualified('traditional', '403b-f3-sweep', 90_000, { kind: 'employer', employerPlanType: '403b' }),
      qualified('traditional', '401k-f3', 100_000, { kind: 'employer', employerPlanType: '401k' }),
      qualifiedAnnuity('annuity-f3-403b', '403b-f3-short', 198_000, 2026),
      qualifiedAnnuity('annuity-f3-401k', '401k-f3', 99_000, 2026),
    ]
    out.push(member(
      'x3-403bAggregationAnd401kIsolation',
      'X: depleted 403(b) sweeps from another 403(b); depleted 401(k) stays isolated',
      plan,
      { horizonEndYear: 2026 },
    ))
  }

  {
    // The spouse is more than ten years younger and the sole beneficiary, so
    // the helper must pass live spouse ages into the joint-life calculation.
    // The post-death year keeps projecting, making the dead-owner skip and the
    // disappearance of the spouse input visible in the same small member.
    const plan = couplePlan({
      p1Dob: '1953-06-15',
      p2Dob: '1975-03-20',
      p1PlanningAge: 76,
      p2PlanningAge: 60,
      p1RetirementAge: null,
      p2RetirementAge: null,
    })
    plan.accounts = [
      qualified('traditional', 'ira-f4-owner', 400_000, { spouseSoleBeneficiary: true }),
      qualified('traditional', 'ira-f4-spouse', 75_000, { ownerPersonId: 'p2' }),
    ]
    out.push(member(
      'x4-jointLifeAndDeadOwner',
      'X: living sole-beneficiary spouse selects joint life; later dead owner is skipped',
      plan,
      { horizonEndYear: 2028, deathAgeByPersonId: { p2: 52 } },
    ))
  }

  {
    // No sibling IRA has capacity to cure this annuity-created shortfall. The
    // helper must preserve the residual in iraRmdUnsatisfiedByOwner for the
    // downstream conversion/QCD gates as well as publishing the obligation.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 74 })
    plan.accounts = [
      qualified('traditional', 'ira-f5-exhausted', 500_000),
      qualifiedAnnuity('annuity-f5', 'ira-f5-exhausted', 499_000, 2026),
    ]
    out.push(member(
      'x5-ownedIraResidualShortfall',
      'X: exhausted owner IRA leaves an aggregable remainder for downstream unsatisfied-RMD gates',
      plan,
      { horizonEndYear: 2026 },
    ))
  }

  {
    // Compatible physical rows sharing an ID must arrive at this seam as one
    // logical 318,000 opening account. The Uniform Lifetime divisor at 73 is
    // 26.5, so this member discriminates one 12,000 calculation and debit from
    // positional 10,000 + 2,000 calculations while keeping aggregate output
    // equal to the independently derived requirement.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 74 })
    plan.accounts = [
      qualified('traditional', 'duplicate-rmd-x6', 265_000),
      qualified('traditional', 'duplicate-rmd-x6', 53_000),
      cash('cash-x6', 0),
    ]
    out.push(member(
      'x6-groupedDuplicateLogicalRmd',
      'X: 265k + 53k physical members form one 318k logical opening and one 12k owner RMD',
      plan,
      { horizonEndYear: 2026 },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// Q — legacy aggregate scalar-QCD gift plan
// ---------------------------------------------------------------------------

function blockQ() {
  const out = []

  {
    // The owned-IRA requirement is exactly $10,000. The first half of the
    // scalar is routed out of that already-committed requirement and the next
    // $10,000 must become a separately journalled beyond-RMD debit.
    const plan = singlePersonPlan({ dob: '1953-06-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('q1-cash', 0),
      qualified('traditional', 'q1-ira', 265_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 20_000
    out.push(member(
      'q1-routedThenBeyondRmd',
      'Q: sorted routed-RMD attribution followed by a live beyond-RMD debit, runtime occurrence/application, owner gross and exact caller mutation',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // p2's proportional routed share exceeds one donor limit. The stranded
    // share is offered to p1 in sorted-owner order; the remaining household
    // ask then walks the deliberately p2-first live account order, skips p2's
    // exhausted capacity, and debits p1's IRA beyond its requirement.
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1953-01-01',
      p1PlanningAge: 95,
      p2PlanningAge: 95,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('q2-cash', 0),
      qualified('traditional', 'q2-p2-ira', 7_950_000, {
        ownerPersonId: 'p2',
        annualReturnPct: 0,
      }),
      qualified('traditional', 'q2-p1-ira', 2_650_000, {
        ownerPersonId: 'p1',
        annualReturnPct: 0,
      }),
    ]
    plan.strategies.qcdAnnual = 222_000
    out.push(member(
      'q2-donorCapReallocation',
      'Q: two indexed donor limits, proportional cap, sorted reallocation, exhausted-capacity skip and beyond-RMD source allocation',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Only the January-June age-70 owner is eligible. The dead spouse's IRA
    // and the non-IRA row are ignored. The first eligible IRA has no whole
    // ledger cent and is skipped, the second drains its exact $1.23, and the
    // third drains its fractional balance to the floored $3.45.
    const plan = couplePlan({
      p1Dob: '1956-06-15',
      p2Dob: '1956-01-15',
      p1PlanningAge: 95,
      p2PlanningAge: 95,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('q3-non-ira', 100, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      qualified('traditional', 'q3-dead-owner-ira', 100, {
        ownerPersonId: 'p2',
        annualReturnPct: 0,
      }),
      qualified('traditional', 'q3-sub-cent-ira', 0.009, {
        ownerPersonId: 'p1',
        annualReturnPct: 0,
      }),
      qualified('traditional', 'q3-whole-cent-ira', 1.23, {
        ownerPersonId: 'p1',
        annualReturnPct: 0,
      }),
      qualified('traditional', 'q3-fractional-ira', 3.456, {
        ownerPersonId: 'p1',
        annualReturnPct: 0,
      }),
    ]
    plan.strategies.qcdAnnual = 10
    out.push(member(
      'q3-deadAndFractionalSources',
      'Q: annual 70.5 proxy, dead-owner and non-IRA filters, sub-cent suppression, full-drain cent flooring and residual source order',
      plan,
      {
        horizonEndYear: START_YEAR,
        deathAgeByPersonId: { p2: 69 },
      },
    ))
  }

  {
    // The donor is 69 in 2026, then crosses the annual January-June proxy at
    // age 70 in 2027. A nonzero inflation factor makes the second invocation's
    // request distinct and catches stale helper results across annual re-entry.
    const plan = singlePersonPlan({ dob: '1957-01-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.inflationPct = 10
    plan.accounts = [
      cash('q4-cash', 0),
      qualified('traditional', 'q4-ira', 10_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 1_000
    out.push(member(
      'q4-crossingYearFreshness',
      'Q: no-donor empty result followed by an inflated next-year gift, proving annual age-state and result freshness across re-entry',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // A named request is authoritative in the current year. The helper must
    // take its early empty arm even though the scalar, donor and IRA would all
    // otherwise qualify, leaving only the exact named execution to move money.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('q5-cash', 0),
      qualified('traditional', 'q5-ira', 265_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 50_000
    plan.strategies.retirementActions = [preStartNamedQcd('q5-ira', START_YEAR)]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        sourceAccountId: 'q5-ira',
        subtype: 'traditional',
        evidenceId: 'q5-traditional-classification',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }
    out.push(member(
      'q5-currentNamedSuppression',
      'Q: current-year named QCD authority suppresses the otherwise-qualified scalar planner before any scalar allocation or caller debit',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Compatible physical rows share one logical source. A June-born owner is
    // admitted by the annual age-70 proxy, and the $1,100 gift crosses the
    // first row's $1,000 capacity while producing one aggregate debit identity.
    const plan = singlePersonPlan({ dob: '1956-06-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('q6-cash', 0),
      qualified('traditional', 'q6-shared-ira', 1_000, {
        annualReturnPct: 0,
      }),
      qualified('traditional', 'q6-shared-ira', 200, {
        annualReturnPct: 0,
      }),
    ]
    plan.strategies.qcdAnnual = 1_100
    out.push(member(
      'q6-groupedJuneCrossingCapacity',
      'Q: June-born age-70 donor debits one grouped logical IRA across the first physical row capacity with one occurrence and application',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// T — aggregate Roth-conversion planning
// ---------------------------------------------------------------------------

function blockT() {
  const out = []

  {
    // p2 enters the deferred-RMD Map first, while p1's one-dollar tail forces
    // p1's reserve to span accounts in reverse Plan order. Distinct opening
    // balances on duplicate Roth ids make the policy snapshot's last-write
    // semantics visible, while the first duplicate remains p1's destination.
    // A zero IRA forces the reservation scan's nonpositive-amount continue
    // before p1's large source.
    // Both owners convert, so owner slice order and every identity-bearing
    // cash-flow row are observable in all four modes.
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1953-02-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('t1-cash', 100_000),
      qualified('traditional', 't1-p2-source', 300_000, {
        ownerPersonId: 'p2', annualReturnPct: 0,
      }),
      qualified('traditional', 't1-p1-source', 500_000, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
      qualified('roth', 't1-p1-roth-duplicate', 10, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
      qualified('roth', 't1-p1-roth-duplicate', 20, {
        ownerPersonId: 'p1', annualReturnPct: 0,
        name: 't1-p1-roth-duplicate-last-row',
      }),
      qualified('roth', 't1-p2-roth', 30, {
        ownerPersonId: 'p2', annualReturnPct: 0,
      }),
      qualified('traditional', 't1-p1-zero', 0, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
      qualified('traditional', 't1-p1-tail', 1, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 100_000 }],
    }
    out.push(
      member(
        't1-ownerReverseReserveDuplicateSnapshot',
        'T: deferred-RMD Map owner order, reverse Plan-order multi-account reservation, duplicate Roth-id last-write snapshot, two-owner allocation and ordered identities',
        plan,
        {
          horizonEndYear: START_YEAR,
          rmdFirstYearDeferrals: [
            {
              distributionCalendarYear: START_YEAR,
              applicablePlan: {
                kind: 'ownedTraditionalIras', payeePersonId: 'p2',
              },
            },
            {
              distributionCalendarYear: START_YEAR,
              applicablePlan: {
                kind: 'ownedTraditionalIras', payeePersonId: 'p1',
              },
            },
          ],
        },
      ),
    )
  }

  {
    // The deferred reserve subtraction and restoration move the source one
    // binary64 leaf before the hundred-dollar conversion. Replacing the replay
    // with assignment to the opening balance, regrouping it, or omitting it is
    // therefore visible in the final IRA balance and tax-input hashes.
    const opening = 371_153_914_996_534.69
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 80 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('t2-cash', 100_000),
      qualified('traditional', 't2-fp-source', opening, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
      qualified('roth', 't2-roth', 0, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 100 }],
    }
    out.push(
      member(
        't2-reservationBinary64RoundTrip',
        'T: deferred-RMD reserve subtraction/addition changes a binary64 leaf before conversion and counterfactual re-entry',
        plan,
        {
          horizonEndYear: START_YEAR,
          rmdFirstYearDeferrals: [{
            distributionCalendarYear: START_YEAR,
            applicablePlan: {
              kind: 'ownedTraditionalIras', payeePersonId: 'p1',
            },
          }],
        },
      ),
    )
  }

  {
    // A positive request with no Roth account takes the helper's household
    // refusal arm. The one-dollar expense keeps every opened capture channel
    // nonempty without supplying a destination.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 70 })
    plan.accounts = [
      cash('t3-cash', 100_000),
      qualified('traditional', 't3-source', 50_000, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
    ]
    plan.expenses.baseAnnual = 1
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 10_000 }],
    }
    out.push(
      member(
        't3-noRothRefusal',
        'T: positive aggregate conversion refuses without any household Roth while other annual output keeps all capture channels live',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // The household has a lawful Roth IRA, so allocation does not refuse, but
    // its only traditional balance is a still-locked employer plan. The shared
    // allocator returns an allocated result with zero slices and zero draws,
    // exercising a materially different no-conversion result from T3.
    const plan = singlePersonPlan({
      dob: '1970-01-01', planningAge: 70, retirementAge: null,
    })
    plan.accounts = [
      cash('t4-cash', 100_000),
      qualified('traditional', 't4-locked-employer', 50_000, {
        ownerPersonId: 'p1', kind: 'employer', annualReturnPct: 0,
      }),
      qualified('roth', 't4-roth', 0, {
        ownerPersonId: 'p1', annualReturnPct: 0,
      }),
    ]
    plan.expenses.baseAnnual = 1
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 10_000 }],
    }
    out.push(
      member(
        't4-zeroConvertibleAllocation',
        'T: Roth destination present but no year-convertible source, yielding allocated zero slices and draws rather than refusal',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// R — remaining annual expense boundaries
// ---------------------------------------------------------------------------

function blockR() {
  const out = []

  {
    // Both debt rows share the public id and therefore begin from the map's
    // last-row balance. The first row's amortization must be visible to the
    // second row before its scheduled payoff. LTC repeats the same hazard with
    // duplicate policy ids across two simultaneous episodes and later years.
    const plan = singlePersonPlan({ dob: '1966-03-15', planningAge: 70 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('r1-cash', 500_000, { annualReturnPct: 0 }),
      debt('r1-duplicate-debt', 9_999, {
        interestPct: 10,
        monthlyPayment: 50,
      }),
      { ...debt('r1-duplicate-debt', 1_000, {
        payoffYear: START_YEAR,
        monthlyPayment: 0,
      }), name: 'r1-duplicate-debt-second' },
      debt('r1-self-terminating', 100, {
        interestPct: 1,
        monthlyPayment: 1_000,
      }),
    ]
    plan.insurance = [
      ltc('r1-duplicate-policy', 'p1', {
        benefitMonthly: 500,
        benefitPeriodYears: 1,
        eliminationPeriodDays: 0,
      }),
      ltc('r1-duplicate-policy', 'p1', {
        benefitMonthly: 500,
        benefitPeriodYears: 1,
        eliminationPeriodDays: 0,
      }),
      ltc('r1-elimination-and-rider', 'p1', {
        benefitMonthly: 1_000,
        benefitPeriodYears: 'lifetime',
        eliminationPeriodDays: 365,
        inflationRiderPct: 10,
      }),
    ]
    plan.careEvents = [
      { id: 'r1-care-a', personId: 'p1', startAge: 60, durationYears: 3, annualCost: 8_000 },
      { id: 'r1-care-b', personId: 'p1', startAge: 60, durationYears: 2, annualCost: 4_000 },
    ]
    out.push(member(
      'r1-positionalDebtAndLtcShadows',
      'R: duplicate debt-id read-after-write and payoff, capped terminal payment, duplicate LTC policy years, elimination, finite/lifetime periods, rider, ordered person reporting and multi-year carry',
      plan,
      { horizonEndYear: START_YEAR + 2 },
    ))
  }

  {
    // p1 turns 65 in July: six Marketplace months and six Medicare months. p2
    // remains under 65. Direct premiums and Medicare extras both contribute,
    // while a historical lookback selects an IRMAA tier and next threshold.
    const plan = couplePlan({
      p1Dob: '1961-07-15',
      p2Dob: '1962-03-15',
      p1PlanningAge: 70,
      p2PlanningAge: 70,
    })
    plan.accounts = [cash('r2-cash', 1_000_000, { annualReturnPct: 0 })]
    plan.assumptions.historicalAnnualMagiByYear = { '2024': 250_000 }
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 321.125,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 87.0625,
    }
    out.push(member(
      'r2-partialMedicareAndDirectMarketplace',
      'R: alive pre-65 and age-65 monthly splits, direct Marketplace premium fold, historical IRMAA lookback, Medicare/extras proration and next-tier publication',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // The sole contract is structurally valid but deliberately non-actionable.
    // A July Medicare transition makes post-June premiums overlap; zero SLCSP,
    // unknown addbacks, adaptive spending and unsupported assertions pin the
    // exact support-code order while preserving the contract arrays by identity.
    const plan = singlePersonPlan({
      dob: '1961-07-15',
      planningAge: 67,
      retirementAge: 65,
    })
    plan.accounts = [cash('r3-cash', 1_000_000, { annualReturnPct: 0 })]
    plan.expenses.spendingPolicy = {
      mode: 'withdrawalRateGuardrails',
      upperGuardrailPct: 110,
      lowerGuardrailPct: 90,
      adjustmentPct: 10,
    }
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
      acaYears: [acaContract(plan, {
        enrollment: 1_000,
        benchmark: 0,
        activeMonths: 12,
        taxExemptInterest: { state: 'unknown', amount: null },
        foreignExclusionAddback: { state: 'unknown', amount: null },
        assertions: {
          coverageEligibility: 'unsupported',
          form8814: 'unsupported',
          specialAllocation: 'unsupported',
          marriedFilingSeparatelyException: 'unsupported',
          selfEmployedHealthInsuranceDeduction: 'unsupported',
          otherMaterialFacts: 'unsupported',
        },
      })],
    }
    out.push(member(
      'r3-soleAcaContractSupportOrdering',
      'R: sole ACA contract monthly identity, Medicare overlap, missing SLCSP, unknown tax facts, adaptive-policy and assertion support-code order',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Duplicate current-year contracts are accepted individually. The helper
    // must take each month's maximum aggregate instead of summing or choosing a
    // whole-contract winner; their unequal alternating premiums discriminate it.
    const plan = singlePersonPlan({ dob: '1980-03-15', planningAge: 60 })
    plan.accounts = [cash('r4-cash', 1_000_000, { annualReturnPct: 0 })]
    const high = acaContract(plan, { enrollment: 900, benchmark: 800 })
    const alternating = acaContract(plan, { enrollment: 700, benchmark: 600 })
    high.coveredMembers[0].enrollmentPremiumByMonth =
      Array.from({ length: 12 }, (_, month) => month % 2 === 0 ? 900 : 100)
    alternating.coveredMembers[0].enrollmentPremiumByMonth =
      Array.from({ length: 12 }, (_, month) => month % 2 === 0 ? 200 : 700)
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 999,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
      acaYears: [high, alternating],
    }
    out.push(member(
      'r4-duplicateAcaMonthlyMax',
      'R: duplicate ACA contract per-month maximum fold, no accidental sum, duplicate-year support and gross-premium fixed-point input',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // With credit modeling enabled and no current-year contract, the helper
    // falls back to the legacy monthly premium arrays and fails closed with a
    // missing-contract code rather than erasing known spending.
    const plan = singlePersonPlan({ dob: '1980-03-15', planningAge: 60 })
    plan.accounts = [cash('r5-cash', 1_000_000, { annualReturnPct: 0 })]
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 432.125,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }
    out.push(member(
      'r5-missingAcaContractFallback',
      'R: legacy ACA monthly fallback arrays, gross enrollment premium, active gate and missing-year-contract support',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // A rapidly growing portfolio crosses the withdrawal-rate lower guardrail
    // after anchoring year one. Ideal, excess, and an early flexible goal compete
    // for the raise budget. Duplicate ids keep the start-portfolio fold positional.
    const plan = singlePersonPlan({ dob: '1976-03-15', planningAge: 60 })
    plan.accounts = [
      taxable('r6-duplicate', 100_000, 50_000, { annualReturnPct: 100 }),
      { ...taxable('r6-duplicate', 50_000, 25_000, { annualReturnPct: 100 }), name: 'r6-second' },
      taxable('r6-stable', 100_000, 50_000, { annualReturnPct: 0 }),
    ]
    plan.expenses.baseAnnual = 10_000
    plan.expenses.requiredAnnual = 1_000
    plan.expenses.idealAnnual = 5_000
    plan.expenses.excessAnnual = 3_000
    plan.expenses.oneTimeGoals = [{
      id: 'r6-flexible-goal',
      label: 'flexible',
      year: START_YEAR + 2,
      earliestYear: START_YEAR + 1,
      amount: 2_000,
      classification: 'target',
      flexibility: 'movable',
    }]
    plan.expenses.spendingPolicy = {
      mode: 'withdrawalRateGuardrails',
      upperGuardrailPct: 105,
      lowerGuardrailPct: 80,
      adjustmentPct: 100,
      allowRaisesAboveTarget: true,
    }
    out.push(member(
      'r6-withdrawalRateRaiseAndGoalBudget',
      'R: positional start-portfolio fold, persistent withdrawal-rate anchor, raise action, ideal/excess/early-goal cap and pull-forward funding',
      plan,
      { horizonEndYear: START_YEAR + 2 },
    ))
  }

  {
    // Solved risk thresholds make the otherwise inert risk mode observable.
    // Year one anchors the real portfolio; growth then crosses the upper balance
    // threshold and spends into the same ordered lifestyle layers.
    const plan = singlePersonPlan({ dob: '1976-03-15', planningAge: 60 })
    plan.accounts = [taxable('r7-risk', 100_000, 50_000, { annualReturnPct: 100 })]
    plan.expenses.baseAnnual = 5_000
    plan.expenses.requiredAnnual = 1_000
    plan.expenses.idealAnnual = 2_000
    plan.expenses.excessAnnual = 1_000
    plan.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      lowerBalanceThresholdPct: 90,
      upperBalanceThresholdPct: 101,
      adjustmentPct: 25,
      allowRaisesAboveTarget: true,
    }
    out.push(member(
      'r7-riskBalanceAnchorAndRaise',
      'R: real-balance anchor initialization/carry, solved risk threshold raise and ordered upside funding',
      plan,
      { horizonEndYear: START_YEAR + 2 },
    ))
  }

  {
    // Duplicate unreferenced person ids survive Plan parsing. The original
    // Marketplace publication evaluates each positional person-state row, but
    // the legacy birth-month lookup is last-wins by public id. Both p1 rows turn
    // 65 this year and therefore use the duplicate's July birth month, yielding
    // two positional six-month rows. A position-keyed birth month would drift to
    // January/July rows with zero/six Marketplace months.
    const plan = singlePersonPlan({ dob: '1961-01-15', planningAge: 70 })
    plan.household.people.push({
      ...plan.household.people[0],
      dob: '1961-07-15',
    })
    plan.accounts = [cash('r8-cash', 1_000_000, { annualReturnPct: 0 })]
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 654.125,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }
    out.push(member(
      'r8-duplicatePersonMarketplacePublication',
      'R: accepted duplicate person ids retain positional Marketplace rows while both rows preserve last-wins July birth-month lookup',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // One hostile but parse-valid ACA contract reaches every independent
    // fail-closed identity/evidence branch. The external covered row comes
    // first so the missing-person arm cannot be hidden by short circuiting on
    // the later Medicare-overlap row.
    const plan = singlePersonPlan({ dob: '1961-07-15', planningAge: 67 })
    plan.exampleSourceId = 'r9-hostile-aca-evidence'
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Omitted spouse',
      dob: '1980-01-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 67, source: 'manual' },
    })
    plan.accounts = [taxable('r9-taxable', 100_000, 100_000, {
      annualReturnPct: 0,
      taxExemptInterestYieldPct: 1,
    })]
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 99,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
      acaYears: [{
        ...acaContract(plan, {
          enrollment: 100,
          benchmark: 100,
          taxExemptInterest: { state: 'unknown', amount: null },
          foreignExclusionAddback: { state: 'unknown', amount: null },
        }),
        taxFamilyMembers: [
          {
            personId: 'external-primary',
            relationship: 'primary',
            requiredToFile: 'unknown',
            magi: 0,
          },
          {
            personId: 'p1',
            relationship: 'dependent',
            requiredToFile: 'unknown',
            magi: 0,
          },
        ],
        coveredMembers: [
          {
            personId: 'external-primary',
            enrollmentPremiumByMonth: monthly(0),
            slcspBenchmarkPremiumByMonth: monthly(50),
          },
          {
            personId: 'p1',
            enrollmentPremiumByMonth: monthly(100),
            slcspBenchmarkPremiumByMonth: monthly(0),
          },
        ],
      }],
    }
    out.push(member(
      'r9-hostileAcaIdentityAndEvidence',
      'R: example-contract member validation, tax-family shape, missing/dead resolution, dependent filing/model overlap, attested tax-exempt interest and both missing/benchmark-only premium evidence',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // The spouse died before the projection starts. The survivor remains on
    // Medicare with an ACA contract in the second QSS/SSA-44 year, which also
    // uses the latest parameter pack as a future-year stand-in.
    const plan = couplePlan({
      p1Dob: '1958-01-15',
      p2Dob: '1960-01-15',
      p1PlanningAge: 72,
      p2PlanningAge: 65,
    })
    plan.household.hasQualifyingDependent = true
    plan.accounts = [cash('r10-cash', 1_000_000, { annualReturnPct: 0 })]
    plan.assumptions.historicalAnnualMagiByYear = {
      '2024': 1_000,
      '2025': 300_000,
    }
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 100,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
      ssa44: { survivorYears: true, retirementYears: false },
      acaYears: [acaContract(plan, {
        year: START_YEAR + 1,
        enrollment: 100,
        benchmark: 100,
        coveredPersonIds: ['p1'],
      })],
    }
    plan.expenses.healthcare.acaYears[0].taxFamilyMembers = [
      {
        personId: 'p1',
        relationship: 'primary',
        requiredToFile: 'required',
        magi: 0,
      },
      {
        personId: 'qualifying-dependent',
        relationship: 'dependent',
        requiredToFile: 'notRequired',
        magi: 0,
      },
    ]
    out.push(member(
      'r10-ssa44QssAndStandIn',
      'R: SSA-44 alternate lookback selection, QSS-to-single IRMAA mapping and future-pack stand-in ACA support',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // Example contracts use the residence-specific FPL region. Two annual
    // contracts around an Alaska-to-Hawaii move reach both non-contiguous
    // branches while keeping the premium oracle exact.
    const plan = singlePersonPlan({ dob: '1980-01-15', planningAge: 60 })
    plan.exampleSourceId = 'r11-noncontiguous-regions'
    plan.household.state = 'AK'
    plan.household.stateMoves = [{
      fromYear: START_YEAR + 1,
      fromMonth: 1,
      state: 'HI',
    }]
    plan.accounts = [cash('r11-cash', 1_000_000, { annualReturnPct: 0 })]
    const alaska = acaContract(plan, { year: START_YEAR, enrollment: 100 })
    alaska.fplRegion = 'alaska'
    const hawaii = acaContract(plan, {
      year: START_YEAR + 1,
      enrollment: 100,
    })
    hawaii.fplRegion = 'hawaii'
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 100,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
      acaYears: [alaska, hawaii],
    }
    out.push(member(
      'r11-exampleContractAlaskaHawaii',
      'R: example-contract Alaska and Hawaii FPL-region selection across a state move with exact monthly-premium evidence',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  return out
}


// ---------------------------------------------------------------------------
// V — annual purchased-annuity funding
// ---------------------------------------------------------------------------

function blockV() {
  const out = []

  {
    // The three full taxable sales make purchase-order gain folding
    // cancellation-sensitive: ((0 + 1e13) - 1e13) + 0.01 is exactly 0.01,
    // while a right-associated pre-sum is 0.009765625. Each contract and source has a
    // distinct id so only arithmetic order, not lookup aliasing, can move it.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      taxable('v1-source-gain', 10_000_000_000_000, 0, { annualReturnPct: 0 }),
      taxable('v1-source-loss', 10_000_000_000_000, 20_000_000_000_000, { annualReturnPct: 0 }),
      taxable('v1-source-cent', 0.01, 0, { annualReturnPct: 0 }),
      purchasedAnnuity('v1-annuity-gain', 'v1-source-gain', 10_000_000_000_000),
      purchasedAnnuity('v1-annuity-loss', 'v1-source-loss', 10_000_000_000_000),
      purchasedAnnuity('v1-annuity-cent', 'v1-source-cent', 0.01),
    ]
    out.push(member(
      'v1-cancellationSensitiveTaxableFold',
      'V: three ordered full taxable sales preserve left-associated realized-gain folding across gain, loss, and one-cent residue',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Both purchases share one taxable position, and the second must observe
    // the first debit and basis sale. The equity source pins the original
    // basis-ratio association at fractional values. A cash
    // source shorter than its quoted premium begins paying immediately, so the
    // funded amount — not the quote — becomes observable investment in contract.
    // The future purchase is a none row in 2026 and a funded row in 2027: the
    // first cash-funded contract exhausts the source, then its 2026 payment is
    // deposited back into cash before the future contract purchases. Block V4
    // separately pins a zero-funded purchase.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      taxable('v2-shared-source', 100, 40, { annualReturnPct: 0 }),
      equityComp('v2-equity-source', 0.2, 0.1, { annualReturnPct: 0 }),
      cash('v2-cash-source', 17, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      purchasedAnnuity('v2-shared-first', 'v2-shared-source', 25),
      purchasedAnnuity('v2-shared-second', 'v2-shared-source', 25),
      purchasedAnnuity('v2-equity-annuity', 'v2-equity-source', 0.1),
      purchasedAnnuity('v2-partial-annuity', 'v2-cash-source', 100, {
        monthlyAmount: 10 / 12,
      }),
      {
        type: 'annuity',
        id: 'v2-existing-annuity',
        name: 'v2-existing-annuity',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 56,
        monthlyAmount: 0,
        colaPct: 0,
        taxablePct: 100,
      },
      purchasedAnnuity('v2-future-annuity', 'v2-cash-source', 1, {
        startAge: 57,
        purchase: { year: START_YEAR + 1 },
      }),
    ]
    out.push(member(
      'v2-sharedShadowBasisAndInvestment',
      'V: ordered shared-source shadow debits/basis, fractional equity association, partial funded investment carry, no-purchase and wrong-year rows',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // The first QLAC proves the cap changes funding, while the second emits a
    // cap warning and then a funding shortfall. All three contracts use
    // qualified sources, so three runtime debits must precede three contract
    // credits; ownerless account fallback resolves each to primary.
    const plan = singlePersonPlan({ dob: '1970-12-15', planningAge: 90 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      qualified('traditional', 'v3-qlac-cap-source', 250_000, { annualReturnPct: 0 }),
      qualified('traditional', 'v3-qlac-shortfall-source', 150_000, { annualReturnPct: 0 }),
      qualified('traditional', 'v3-qualified-source', 100, { annualReturnPct: 0 }),
      purchasedAnnuity('v3-qlac-cap', 'v3-qlac-cap-source', 300_000, {
        ownerPersonId: null,
        startAge: 85,
        purchase: { taxQualification: 'qualified', qlac: true },
      }),
      purchasedAnnuity('v3-qlac-shortfall', 'v3-qlac-shortfall-source', 300_000, {
        ownerPersonId: null,
        startAge: 85,
        purchase: { taxQualification: 'qualified', qlac: true },
      }),
      purchasedAnnuity('v3-qualified', 'v3-qualified-source', 13, {
        ownerPersonId: null,
        startAge: 60,
        purchase: { taxQualification: 'qualified' },
      }),
    ]
    out.push(member(
      'v3-qlacCapShortfallAndQualifiedRuntime',
      'V: qualified owner fallback, effective QLAC cap and cap-before-shortfall warnings, three ordered runtime debits followed by three contract credits',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Positive but unvested equity is deliberately unspendable. The purchase
    // remains a real row with a zero gain, unchanged basis write and a shortfall warning,
    // but emits no optimizer debit and carries no investment into its payout.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      equityComp('v4-unvested-source', 80, 20, {
        annualReturnPct: 0,
        vestingMode: 'cliff',
        vestDate: `${START_YEAR + 1}-01-01`,
      }),
      purchasedAnnuity('v4-unfunded-annuity', 'v4-unvested-source', 32, {
        monthlyAmount: 10 / 12,
      }),
    ]
    out.push(member(
      'v4-unvestedZeroFunding',
      'V: unvested positive equity source produces a zero-funded purchase, zero gain/basis write, shortfall warning, null debit, and zero investment carry',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// W — annual voluntary-withdrawal apply-flow boundary
// ---------------------------------------------------------------------------

function blockW() {
  const out = []

  {
    // The funding need exhausts every positive balance class in category
    // order. This makes taxable-sale and equity-basis writes observable beside
    // ordinary subtraction rows, emits traditional occurrences for both the
    // inherited and owned IRA, and emits an owned-IRA application for only the
    // latter. The zero cash row keeps a Plan-level zero draw in the corpus; the
    // focused helper test pins the no-operation continue directly.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('w1-zero-cash', 0, { annualReturnPct: 0 }),
      cash('w1-cash', 10, { annualReturnPct: 0 }),
      taxable('w1-taxable', 10, 4, { annualReturnPct: 0 }),
      equityComp('w1-equity', 10, 4, { annualReturnPct: 0 }),
      qualified('traditional', 'w1-inherited', 10, {
        annualReturnPct: 0,
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
        },
      }),
      qualified('traditional', 'w1-owned', 10, { annualReturnPct: 0 }),
      qualified('roth', 'w1-roth', 10, { annualReturnPct: 0 }),
      qualified('hsa', 'w1-hsa', 10, { annualReturnPct: 0 }),
    ]
    plan.expenses.baseAnnual = 100
    out.push(
      member(
        'w1-allApplyFlowShapes',
        'W: zero and positive withdrawal rows across cash, taxable, equity compensation, inherited/owned traditional, Roth and HSA; basis writes plus runtime occurrence/application split',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // Compatible duplicate physical rows form one logical inherited IRA. Both
    // carry the same post-election S2 facts, so inherited voluntary evidence is
    // suppressed while the grouped balance remains one ID-keyed apply target.
    const plan = singlePersonPlan({ dob: '1970-06-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    const postFlip = qualified('traditional', 'w2-duplicate', 100, {
          annualReturnPct: 0,
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
              treatAsOwnElectionYear: START_YEAR,
              ownerYearOfDeathRmdSatisfied: true,
              provenance: {
                source: 'equivalence corpus',
                asOf: '2026-08-31',
              },
            },
          },
        })
    plan.accounts = [
      { ...postFlip, balance: 10, name: 'w2-duplicate-post-flip-first' },
      { ...postFlip, name: 'w2-duplicate-post-flip-selected' },
    ]
    plan.expenses.baseAnnual = 4
    out.push(
      member(
        'w2-groupedPostFlipEvidence',
        'W: compatible duplicate inherited rows suppress post-election spouse treat-as-own voluntary evidence and commit one grouped logical balance application',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // A partial equity-compensation sale leaves a fractional basis residue in
    // year one; the following-year goal then realizes the remainder. Keeping
    // the deliberately awkward binary fractions makes the original
    // `basis - taken * basisRatio` association observable in the dump.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      equityComp(
        'w3-equity-fp',
        172.80726018133362,
        169.69896122121477,
        { annualReturnPct: 0 },
      ),
    ]
    plan.expenses.baseAnnual = 0
    plan.expenses.oneTimeGoals = [
      {
        id: 'w3-partial-sale-one',
        label: 'create fractional equity basis residue',
        year: START_YEAR,
        amount: 104.49241361525306,
        classification: 'required',
      },
      {
        id: 'w3-partial-sale-two',
        label: 'observe the fractional residue next year',
        year: START_YEAR + 1,
        amount: 40.4551714204251,
        classification: 'required',
      },
    ]
    out.push(
      member(
        'w3-equityBasisAssociation',
        'W: partial equity-compensation sale followed by liquidation preserves the exact basis-minus-taken-times-ratio association',
        plan,
        { horizonEndYear: START_YEAR + 1 },
      ),
    )
  }

  {
    // The empty inherited row is still evidence-bearing but has no voluntary
    // amount, so it reaches the explicit zero fallback. The Roth row carries
    // the funding need and forces the other side of the qualified-account
    // evidence type test without relying on a traditional short circuit.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 75 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      qualified('traditional', 'w4-empty-inherited', 0, {
        annualReturnPct: 0,
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
        },
      }),
      qualified('roth', 'w4-roth', 1, {
        annualReturnPct: 0,
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'none',
            beneficiaryBirthYear: 1970,
            soleBeneficiary: true,
            provenance: {
              source: 'equivalence corpus',
              asOf: '2026-08-31',
            },
          },
        },
      }),
    ]
    plan.expenses.baseAnnual = 0.5
    out.push(
      member(
        'w4-rothAndMissingInheritedAmount',
        'W: Roth voluntary evidence plus a zero-balance inherited IRA proves the qualified-type branch and explicit zero fallback',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// O — annual inherited-IRA required distributions
// ---------------------------------------------------------------------------

function blockO() {
  const out = []

  {
    // The two shared-decedent traditional IRAs aggregate into one §4974 plan
    // in Plan order. The legacy employer and Roth EDB make all three character
    // and identity paths observable under repeated multi-year mode entry.
    const plan = singlePersonPlan({ dob: '1965-03-15', planningAge: 80, retirementAge: 65 })
    plan.assumptions.defaultReturnPct = 0
    const sharedFacts = {
      decedentId: 'o1-shared-decedent',
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: inheritedBeneficiary(),
    }
    plan.accounts = [
      cash('o1-cash', 2_000_000),
      qualified('traditional', 'o1-owned-sentinel', 10_000.125),
      qualified('traditional', 'o1-legacy-employer', 120_000.125, {
        kind: 'employer',
        inherited: { ownerDeathYear: 2019, decedentHadStartedRmds: true },
      }),
      qualified('traditional', 'o1-shared-z', 300_000.0625, { inherited: sharedFacts }),
      qualified('traditional', 'o1-ungrouped-ira', 80_000.03125, {
        inherited: {
          ownerDeathYear: 2022,
          decedentHadStartedRmds: true,
          beneficiary: inheritedBeneficiary(),
        },
      }),
      qualified('roth', 'o1-roth-edb', 90_000.03125, {
        inherited: {
          decedentId: 'o1-roth-decedent',
          ownerDeathYear: 2022,
          decedentHadStartedRmds: false,
          beneficiary: inheritedBeneficiary({
            edbCategory: 'disabled',
            roth5YearStartYear: 2010,
          }),
        },
      }),
      qualified('traditional', 'o1-shared-a', 200_000.015625, { inherited: sharedFacts }),
    ]
    out.push(member(
      'o1-legacyClassifiedRothAggregationReentry',
      'O: ordered legacy employer, classified shared-decedent IRA aggregation, Roth-forced character, and repeated all-mode multi-year re-entry',
      plan,
      { horizonEndYear: START_YEAR + 2 },
    ))
  }

  {
    // Both S2 accounts remain beneficiary accounts in the death year. Their
    // different election years distinguish the death-year S2 identity override,
    // synthetic S0 schedule, following-year ownership flip, and later zero rows.
    const plan = singlePersonPlan({ dob: '1965-03-15', planningAge: 80 })
    plan.assumptions.defaultReturnPct = 0
    const spouseFacts = (electionYear, decedentId) => ({
      decedentId,
      ownerDeathYear: START_YEAR,
      decedentHadStartedRmds: true,
      beneficiary: inheritedBeneficiary({
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
        treatAsOwnElectionYear: electionYear,
        ownerYearOfDeathRmdSatisfied: false,
      }),
    })
    plan.accounts = [
      cash('o2-cash', 2_000_000),
      qualified('traditional', 'o2-s2-later', 400_000.125, {
        inherited: spouseFacts(START_YEAR + 1, 'o2-later-decedent'),
      }),
      qualified('traditional', 'o2-s2-same-year', 500_000.0625, {
        inherited: spouseFacts(START_YEAR, 'o2-same-year-decedent'),
      }),
    ]
    out.push(member(
      'o2-spouseYodPrePostElection',
      'O: S2 death-year identity override, synthetic pre-election schedule, following-year treat-as-own effect, and later post-election zero rows',
      plan,
      { horizonEndYear: START_YEAR + 2 },
    ))
  }

  {
    // p1 survives the deadline. Three individually unmovable Roth residues share
    // a decedent identity and aggregate above one cent; a traditional sibling
    // makes the final sweep visible. p2 dies first, forcing X2 evidence.
    const plan = couplePlan({
      p1Dob: '1970-03-15',
      p2Dob: '1965-07-20',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
    })
    plan.assumptions.defaultReturnPct = 0
    const rothDust = {
      decedentId: 'o3-roth-dust-decedent',
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: inheritedBeneficiary({ beneficiaryBirthYear: 1970, roth5YearStartYear: 2010 }),
    }
    plan.accounts = [
      cash('o3-cash', 2_000_000),
      qualified('roth', 'o3-roth-dust-z', 0.004, { inherited: rothDust }),
      qualified('traditional', 'o3-visible-final', 1_000.125, {
        inherited: {
          decedentId: 'o3-visible-decedent',
          ownerDeathYear: 2022,
          decedentHadStartedRmds: false,
          beneficiary: inheritedBeneficiary({ beneficiaryBirthYear: 1970 }),
        },
      }),
      qualified('traditional', 'o3-dead-beneficiary', 75_000.03125, {
        ownerPersonId: 'p2',
        inherited: {
          ownerDeathYear: 2019,
          decedentHadStartedRmds: true,
        },
      }),
      qualified('traditional', 'o3-dead-classified', 55_000.015625, {
        ownerPersonId: 'p2',
        inherited: {
          decedentId: 'o3-dead-classified-decedent',
          ownerDeathYear: 2022,
          decedentHadStartedRmds: true,
          beneficiary: inheritedBeneficiary({ beneficiaryBirthYear: 1965 }),
        },
      }),
      qualified('roth', 'o3-roth-dust-m', 0.004, { inherited: rothDust }),
      qualified('roth', 'o3-roth-dust-a', 0.004, { inherited: rothDust }),
    ]
    out.push(member(
      'o3-finalSweepSubCentAggregationAndDeath',
      'O: visible final sweep, three zero-cent Roth residues aggregated above a cent as a §4974 applicable-plan shortfall, Roth/ordinary character, and dead-beneficiary successor evidence',
      plan,
      { horizonEndYear: START_YEAR + 6, deathAgeByPersonId: { p2: 62 } },
    ))
  }

  {
    // A single inherited Roth residue is independently calibrated so a proof
    // cannot hide a per-plan zero-movement discharge inside a multi-row case.
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 80 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('o6-cash', 2_000_000),
      qualified('roth', 'o6-lone-roth-dust', 0.004, {
        inherited: {
          decedentId: 'o6-lone-roth-decedent',
          ownerDeathYear: 2022,
          decedentHadStartedRmds: false,
          beneficiary: inheritedBeneficiary({
            beneficiaryBirthYear: 1970,
            roth5YearStartYear: 2010,
          }),
        },
      }),
    ]
    out.push(member(
      'o6-singleRothSubCentShortfall',
      'O: one zero-cent inherited Roth final-sweep residue remains a .004 applicable-plan shortfall with a .001 section 4974 excise',
      plan,
      { horizonEndYear: START_YEAR + 6 },
    ))
  }

  {
    // Two compatible physical rows share one logical inherited IRA. The
    // selected facts are identical, first-ID order is stable, and the grouped
    // ledger must produce one requirement, one runtime occurrence, and one
    // applicable-plan obligation while committing the debit pro rata.
    const plan = singlePersonPlan({ dob: '1965-03-15', planningAge: 80 })
    plan.assumptions.defaultReturnPct = 0
    const duplicateFacts = {
      decedentId: 'o4-shared-decedent',
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: inheritedBeneficiary(),
    }
    plan.accounts = [
      cash('o4-cash', 2_000_000),
      qualified('traditional', 'o4-duplicate', 265_000, {
        inherited: duplicateFacts,
      }),
      qualified('traditional', 'o4-duplicate', 53_000, {
        inherited: duplicateFacts,
      }),
    ]
    plan.incomes = [wages('o4-duplicate-order-wages', 'p1', 123.45)]
    out.push(member(
      'o4-compatibleGroupedDuplicateId',
      'O: compatible duplicate physical rows aggregate to one logical inherited distribution and applicable-plan obligation',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // The death and same-year S2 election predate this projection. A second
    // classified account reaches the last transition-relief year, distinguishing
    // the notice-waived annual requirement from the S2 rollback limitation.
    const plan = singlePersonPlan({ dob: '1965-03-15', planningAge: 80 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('o5-cash', 2_000_000),
      qualified('traditional', 'o5-pre-horizon-s2', 250_000.125, {
        inherited: {
          decedentId: 'o5-decedent',
          ownerDeathYear: START_YEAR - 4,
          decedentHadStartedRmds: true,
          beneficiary: inheritedBeneficiary({
            edbCategory: 'surviving-spouse',
            election: 'treat-as-own',
            spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: START_YEAR - 4,
            ownerYearOfDeathRmdSatisfied: false,
          }),
        },
      }),
      qualified('traditional', 'o5-transition-relief', 175_000.0625, {
        inherited: {
          decedentId: 'o5-relief-decedent',
          ownerDeathYear: START_YEAR - 5,
          decedentHadStartedRmds: true,
          beneficiary: inheritedBeneficiary(),
        },
      }),
    ]
    out.push(member(
      'o5-preHorizonS2RollbackReentry',
      'O: first-year pre-horizon YOD limitation on an already-effective S2 account under repeated optimizer/counterfactual re-entry',
      plan,
      { startYear: START_YEAR - 2, horizonEndYear: START_YEAR },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// S — shared blind spots, owned by no single block
// ---------------------------------------------------------------------------

/**
 * Members that exist because the CORPUS was measured blind, not because one of
 * the original five A-through-E phases needs them. The corpus is the durable
 * half of this tool, and
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
// ---------------------------------------------------------------------------
// U — annual contributions and employer match
// ---------------------------------------------------------------------------

function annualSchedule(annualAmount, extra = {}) {
  return [{
    annualAmount,
    fromAge: null,
    toAge: null,
    escalationPct: 0,
    ...extra,
  }]
}

function blockU() {
  const out = []

  {
    // p1 is inside the age-60 super-catch-up window and above the prior-year
    // FICA threshold. Current compensation is below the full request, so only
    // 5,500 of catch-up can redirect to Roth; a generous match then consumes
    // the last 5,500 of compensation-bound 415(c) room. p2 independently
    // reaches the ordinary age-50 catch-up arm.
    const plan = couplePlan({
      p1Dob: '1966-01-01',
      p2Dob: '1971-01-01',
      p1PlanningAge: 70,
      p2PlanningAge: 70,
    })
    plan.accounts = [
      cash('u1-cash', 500_000, { annualReturnPct: 0 }),
      qualified('roth', 'u1-p1-roth-feature', 0, {
        kind: 'employer',
        annualReturnPct: 0,
        annualContribution: 2_750,
        employerMatch: { matchPct: 200, capPctOfPay: 100 },
      }),
      qualified('traditional', 'u1-p1-traditional', 0, {
        kind: 'employer',
        annualReturnPct: 0,
        annualContribution: 40_000,
        priorCalendarYearFicaWages: 200_000,
        employerMatch: { matchPct: 200, capPctOfPay: 100 },
      }),
      qualified('traditional', 'u1-p2-traditional', 0, {
        kind: 'employer',
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        annualContribution: 40_000,
        priorCalendarYearFicaWages: 0,
        employerMatch: { matchPct: 100, capPctOfPay: 1 },
      }),
    ]
    plan.incomes = [
      wages('u1-p1-wages', 'p1', 30_000),
      wages('u1-p2-wages', 'p2', 100_000),
    ]
    out.push(
      member(
        'u1-employerCatchupsCompensationAndMatch',
        'U: age-60 Roth catch-up redirection, age-50 ordinary catch-up, compensation cap, owner warning, ordered employer match and the 415(c) pay prong',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // Scheduled non-employer deposits bypass the legacy own-wage gate and make
    // the joint-return compensation pool observable. The aged p1 traditional
    // and Roth rows share one owner ceiling in row order; p2 then receives only
    // the compensation left by p1. The aged traditional credit also publishes
    // the section-219/QCD offset carried into the later annual pass.
    const plan = couplePlan({
      p1Dob: '1955-01-01',
      p2Dob: '1966-01-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
    })
    plan.accounts = [
      cash('u2-cash', 100_000, { annualReturnPct: 0 }),
      qualified('traditional', 'u2-p1-traditional-ira', 100, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(4_000),
        nondeductibleBasis: 10,
      }),
      qualified('roth', 'u2-p1-roth-ira', 100, {
        annualReturnPct: 0,
        contributionBasis: 0,
        contributionSchedule: annualSchedule(5_000),
      }),
      qualified('traditional', 'u2-p2-traditional-ira', 100, {
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(4_000),
      }),
      qualified('roth', 'u2-p2-roth-zero-credit', 100, {
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        contributionBasis: 0,
        contributionSchedule: annualSchedule(100),
      }),
    ]
    plan.incomes = [wages('u2-p2-wages', 'p2', 10_000)]
    out.push(
      member(
        'u2-jointIraOwnerAndCompensationCoordination',
        'U: ordered traditional/Roth IRA owner ceiling, joint spousal-compensation pool, zero/partial credits, warnings, aged-IRA runtime application and section-219 QCD offset',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // In 2026 both living spouses receive half of the indexed family base plus
    // a whole non-indexed catch-up. p2 dies after that year; in 2027 p1 keeps
    // family coverage but no longer divides it, while the catch-up stays flat
    // under a deliberately large projected limit-growth factor.
    const plan = couplePlan({
      p1Dob: '1971-01-01',
      p2Dob: '1971-01-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
    })
    plan.assumptions.inflationPct = 10
    plan.accounts = [
      cash('u3-cash', 100_000, { annualReturnPct: 0 }),
      qualified('hsa', 'u3-p1-hsa', 100, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(20_000),
      }),
      qualified('hsa', 'u3-p2-hsa', 100, {
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(20_000),
      }),
    ]
    out.push(
      member(
        'u3-hsaFamilySplitCatchupAndSurvivor',
        'U: living-spouse family-limit split, whole per-spouse HSA catch-up, 2027 indexed base with flat catch-up, dead-owner skip and survivor whole-family limit',
        plan,
        {
          horizonEndYear: START_YEAR + 1,
          deathAgeByPersonId: { p2: 55 },
        },
      ),
    )
  }

  {
    // Contributions are planned once, before the annual-pass settlement and
    // counterfactual attempts. Required spending consumes cash, the contributed
    // traditional IRA, and then part of the same-year Roth deposit. The Roth
    // basis delta must survive annual-pass re-entry without being dropped or
    // doubled, while the nondeductible IRA forces the Form 8606 settlement path.
    const plan = singlePersonPlan({
      dob: '1976-01-01',
      planningAge: 65,
      retirementAge: null,
    })
    plan.accounts = [
      cash('u4-cash', 2_000, { annualReturnPct: 0, ownerPersonId: 'p1' }),
      qualified('traditional', 'u4-traditional-ira', 100, {
        annualReturnPct: 0,
        nondeductibleBasis: 10,
        contributionSchedule: annualSchedule(100),
      }),
      qualified('roth', 'u4-roth-ira', 0, {
        annualReturnPct: 0,
        contributionBasis: 0,
        contributionSchedule: annualSchedule(500),
      }),
    ]
    plan.incomes = [wages('u4-wages', 'p1', 600)]
    plan.expenses.baseAnnual = 2_600
    out.push(
      member(
        'u4-rothBasisMutationAcrossAnnualPassReentry',
        'U: same-year Roth contribution-basis consumption after cash and traditional draws, owned-IRA settlement attempts, runtime/application publication and counterfactual annual-pass re-entry',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  {
    // Accepted duplicate account ids retain two distinct scheduled requests and
    // positional cost-basis writes while published balances expose the logical
    // aggregate of every compatible physical row. Separate large and tiny rows
    // make left-associated totals observable; the distinct 50-dollar row
    // defeats a whole-plan-only repair that loses row association.
    const plan = singlePersonPlan({ dob: '1980-01-01', planningAge: 60 })
    plan.accounts = [
      cash('u5-funding-cash', 20_000_000_001_000, {
        annualReturnPct: 0,
        ownerPersonId: 'p1',
      }),
      taxable('u5-fp-large', 10, 4, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(10_000_000_000_000),
      }),
      taxable('u5-fp-small-a', 10, 4, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(0.011),
      }),
      taxable('u5-fp-small-b', 10, 4, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(0.011),
      }),
      taxable('u5-duplicate', 10, 4, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(100),
      }),
      taxable('u5-distinct', 30, 6, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(50),
      }),
      taxable('u5-duplicate', 20, 8, {
        annualReturnPct: 0,
        contributionSchedule: annualSchedule(200),
      }),
    ]
    out.push(
      member(
        'u5-positionalDuplicateIdsAndExactFolds',
        'U: positional duplicate ids with distinct 100/200 requests, a distinct third row, exact row/basis association, cancellation-sensitive folds and duplicate cash-flow identities',
        plan,
        { horizonEndYear: START_YEAR },
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// S — shared blind spots, owned by no single block
// ---------------------------------------------------------------------------

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

function blockY() {
  const out = []

  {
    // Compatible physical rows share one logical IRA id. The grouped opening
    // balance is $318,000, producing a $12,000 RMD; the $5,000 gift leaves the
    // Form 8606 numerator and denominator before the residual distribution.
    const plan = singlePersonPlan({ dob: '1953-06-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('y1-cash', 0),
      qualified('traditional', 'y1-shared-ira', 265_000, {
        annualReturnPct: 0,
        nondeductibleBasis: 53_000,
      }),
      qualified('traditional', 'y1-shared-ira', 53_000, {
        annualReturnPct: 0,
        nondeductibleBasis: 0,
      }),
    ]
    plan.strategies.qcdAnnual = 5_000
    out.push(member(
      'y1-groupedGiftFirstPositiveBasis',
      'Y: compatible duplicate IRA rows enter QCD character as one grouped owner balance and basis denominator',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // The first compatible physical row contributes $6,000 before a $50,000
    // gift. That current-year deductible IRA contribution must already appear
    // in qcdSection219ByDonor at the character seam, while the helper still
    // receives one logical $106,000 balance for the duplicated id.
    const plan = singlePersonPlan({
      dob: '1955-01-01', planningAge: 95, retirementAge: null,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.incomes = [wages('y2-earned-income', 'p1', 10_000)]
    plan.accounts = [
      cash('y2-cash', 10_000),
      qualified('traditional', 'y2-shared-ira', 60_000, {
        annualReturnPct: 0,
        annualContribution: 6_000,
        nondeductibleBasis: 36_000,
      }),
      qualified('traditional', 'y2-shared-ira', 40_000, {
        annualReturnPct: 0,
        nondeductibleBasis: 24_000,
      }),
    ]
    plan.strategies.qcdAnnual = 50_000
    out.push(member(
      'y2-groupedContributionSection219',
      'Y: grouped compatible IRA contribution is visible to the same-year section 219 QCD offset and beyond-RMD character',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Account order gives the whole gift to p2. p1 has no gift but has basis,
    // so rows remain [p2, p1], not lexical order, and p1 adds a basis-only row.
    const plan = couplePlan({
      p1Dob: '1955-01-01',
      p2Dob: '1955-01-01',
      p1PlanningAge: 95,
      p2PlanningAge: 95,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('y3-cash', 0),
      qualified('traditional', 'y3-p2-ira', 100_000, {
        ownerPersonId: 'p2', annualReturnPct: 0,
      }),
      qualified('traditional', 'y3-p1-basis-ira', 100_000, {
        ownerPersonId: 'p1', annualReturnPct: 0, nondeductibleBasis: 25_000,
      }),
    ]
    plan.strategies.qcdAnnual = 10_000
    out.push(member(
      'y3-ownerInsertionBeforeBasisOnly',
      'Y: QCD owner insertion order precedes a lexical-earlier basis-only owner and gift-zero row',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // Two years force the exact-cent consumed-offset state to survive annual
    // retry/re-entry: year one consumes $6,000; year two excludes only $2,500.
    const plan = singlePersonPlan({ dob: '1953-03-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.inflationPct = ((6_500 / 6_000) - 1) * 100
    plan.accounts = [
      cash('y4-cash', 0),
      qualified('traditional', 'y4-ira', 265_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 6_000
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [],
      sepSimpleActivities: [],
      deductibleIraContributions: [2024, 2025].map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: 500_000,
        evidenceId: `y4-section-219-${taxYear}`,
        provenance: { source: 'manual', sourceId: `y4-ledger-${taxYear}` },
      })),
    }
    out.push(member(
      'y4-section219Carryforward',
      'Y: two-year section 219 consumed-cent carryforward and annual-pass re-entry',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // A declared pre-projection QCD makes prior reductions unprovable. The gift
    // moves but the current exclusion fails closed and publishes ordinary RMD.
    const plan = singlePersonPlan({ dob: '1953-03-15', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('y5-cash', 0),
      qualified('traditional', 'y5-ira', 265_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 6_500
    plan.strategies.retirementActions = [preStartNamedQcd('y5-ira', 2025)]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        sourceAccountId: 'y5-ira',
        subtype: 'traditional',
        evidenceId: 'y5-traditional-classification',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [{
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: 300_000,
        evidenceId: 'y5-section-219-2025',
        provenance: { source: 'manual', sourceId: 'y5-ledger-2025' },
      }],
    }
    out.push(member(
      'y5-unprovableOffsetFailsClosed',
      'Y: pre-start QCD makes prior section 219 reductions unprovable and forces ordinary character',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 95 })
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('y6-cash', 0),
      qualified('traditional', 'y6-ira', 500_000, { annualReturnPct: 0 }),
    ]
    plan.strategies.qcdAnnual = 200_000
    out.push(member(
      'y6-upstreamAnnualCap',
      'Y: indexed per-donor QCD cap reaches from-RMD and beyond-RMD character',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// Z — annual pension and annuity income
// ---------------------------------------------------------------------------

function blockZ() {
  const out = []

  {
    // The payment start age is already reached, but the purchase is still a
    // year away. This distinguishes the purchase-date guard from the earlier
    // start-calendar guard; both must remain separate none paths.
    const plan = singlePersonPlan({
      dob: `${START_YEAR - 56}-01-01`,
      planningAge: 75,
    })
    plan.accounts = [
      cash('z1-cash', 100),
      purchasedAnnuity('z1-future-purchase', 'z1-cash', 50, {
        startAge: 56,
        monthlyAmount: 10,
        purchase: { year: START_YEAR + 1 },
      }),
    ]
    out.push(member(
      'z1-startedBeforeFuturePurchase',
      'Z: attained payment start still waits for a future purchase date',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  {
    // Pat is alive in 2026 and dead in 2027. Both the public pension and the
    // already-owned joint annuity then select Robin as the survivor recipient;
    // the annuity's reduced payment remains 25% taxable.
    const plan = couplePlan({
      p1PlanningAge: 60,
      p2PlanningAge: 90,
      p1RetirementAge: null,
      p2RetirementAge: null,
    })
    plan.accounts = [
      pension('z2-public-pension', {
        startAge: 60,
        monthlyAmount: 1_000,
        survivorPct: 50,
        source: 'public',
      }),
      {
        type: 'annuity',
        id: 'z2-joint-annuity',
        name: 'z2-joint-annuity',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 1_000,
        colaPct: 0,
        taxablePct: 25,
        payoutForm: { kind: 'jointSurvivor', survivorPct: 50 },
      },
      cash('z2-cash', 0),
    ]
    out.push(member(
      'z2-publicPensionAndJointSurvivors',
      'Z: living then survivor public-pension and joint-annuity payments preserve recipient and taxable folds',
      plan,
      { horizonEndYear: START_YEAR + 1 },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// AB — retirement-action settlement publication
// ---------------------------------------------------------------------------

function blockAB() {
  const out = []

  {
    // The linked pair forces a real counterfactual baseline and a settled
    // candidate liability through the annual-pass attempt driver. The named
    // conversion also reaches the Roth executor/publication source while an
    // unrelated ordinary action keeps that source independently nonempty.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    plan.id = 'ab1-linked-settlement-publication'
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('ab1-cash', 1_000_000, { ownerPersonId: 'p1', annualReturnPct: 0 }),
      qualified('traditional', 'ab1-ira', 400_000, {
        annualReturnPct: 0,
        nondeductibleBasis: 20_000,
      }),
      qualified('roth', 'ab1-roth', 0, { annualReturnPct: 0 }),
    ]
    plan.expenses.baseAnnual = 0
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        evidenceId: 'ab1-ira-classification',
        provenance: { source: 'manual' },
        sourceAccountId: 'ab1-ira',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }
    plan.strategies.retirementActions = [
      ordinaryWithdrawal('ab1-linked-withdrawal', 1, [{
        sourceAccountId: 'ab1-cash',
        requestedAmount: 8_000_00,
      }], {
        executionDate: `${START_YEAR}-06-14`,
        purpose: { kind: 'taxPayment', referenceId: 'ab1-conversion' },
      }),
      {
        actionId: 'ab1-conversion',
        kind: 'rothConversion',
        personId: 'p1',
        year: START_YEAR,
        executionDate: `${START_YEAR}-06-15`,
        executionSequence: 2,
        requestedAmount: 40_000_00,
        allocations: [{
          allocationId: 'ab1-conversion-allocation',
          sourceAccountId: 'ab1-ira',
          requestedAmount: 40_000_00,
        }],
        destinationRothAccountId: 'ab1-roth',
        taxFunding: {
          kind: 'linkedWithdrawal',
          withdrawalActionId: 'ab1-linked-withdrawal',
        },
        provenance: { source: 'manual' },
      },
      ordinaryWithdrawal('ab1-unrelated-withdrawal', 9, [{
        sourceAccountId: 'ab1-cash',
        requestedAmount: 1_000_00,
      }], { executionDate: `${START_YEAR}-03-01` }),
    ]
    out.push(member(
      'ab1-linkedSettlementPublication',
      'AB: ordinary and named-Roth executor sources plus linked-group baseline/candidate liability identity and zero-movement evidence',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  {
    // A current-year named QCD reaches the evaluated prerequisite source and
    // the committed executor-source precedence arm at publication time.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 95 })
    plan.id = 'ab2-named-qcd-publication'
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      cash('ab2-cash', 0),
      qualified('traditional', 'ab2-ira', 265_000, { annualReturnPct: 0 }),
    ]
    plan.expenses.baseAnnual = 0
    plan.strategies.retirementActions = [
      preStartNamedQcd('ab2-ira', START_YEAR),
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        sourceAccountId: 'ab2-ira',
        subtype: 'traditional',
        evidenceId: 'ab2-traditional-classification',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      // A 1953-01-01 donor reaches age 70 1/2 on 2023-07-01. Eligibility
      // requires one donor-specific fact for every threshold-through-action
      // tax year; explicit zero rows establish known absence rather than an
      // omitted/unknown contribution history.
      deductibleIraContributions: [2023, 2024, 2025, 2026].map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: 0,
        evidenceId: `ab2-contribution-${taxYear}`,
        provenance: { source: 'manual', sourceId: `ab2-ledger-${taxYear}` },
      })),
    }
    out.push(member(
      'ab2-namedQcdSettlementPublication',
      'AB: evaluated named-QCD prerequisites and committed executor source join into canonical annual publication',
      plan,
      { horizonEndYear: START_YEAR },
    ))
  }

  return out
}

// ---------------------------------------------------------------------------
// AE — annual funding withdrawal effects
// ---------------------------------------------------------------------------

function blockAE() {
  const plan = shell(60, { dob: '1976-01-01' })
  plan.id = 'ae1-multi-account-roth-pool'
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.incomes = []
  plan.accounts = [
    qualified('roth', 'ae1-roth-first', 50_000, {
      annualReturnPct: 0,
      contributionBasis: 50_000,
    }),
    qualified('roth', 'ae1-roth-second', 50_000, {
      annualReturnPct: 0,
      contributionBasis: 50_000,
    }),
  ]
  plan.expenses.baseAnnual = 80_000
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  return [member(
    'ae1-multiAccountRothPool',
    'AE: one need-based draw spans two owned Roth accounts and increments one owner-wide pool',
    plan,
    { horizonEndYear: START_YEAR },
  )]
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
    ...blockL(),
    ...blockM(),
    ...blockN(),
    ...blockO(),
    ...blockP(),
    ...blockQ(),
    ...blockR(),
    ...blockS(),
    ...blockT(),
    ...blockU(),
    ...blockV(),
    ...blockW(),
    ...blockX(),
    ...blockY(),
    ...blockZ(),
    ...blockAB(),
    ...blockAE(),
  ]
}
