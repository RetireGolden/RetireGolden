import { describe, expect, it } from 'vitest'

import type { RothConversionRequest } from '../actions/contract.js'
import { rothConversionRequestSchema } from '../actions/contract.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import type { DecisionCandidate } from '../decisions/types.js'
import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { couplePlan, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  chooseAggregateConversionPromotionIntents,
  promoteAggregateConversionSchedule,
  type AggregateConversionPromotionInput,
  type AggregateConversionPromotionYearBalances,
} from './optimizerAggregateConversionPromotion.js'
import { simulatePlan } from './simulate.js'

/**
 * Promoting an aggregate optimizer winner to an executable schedule.
 *
 * The subject is a decision nothing in the tree made before: whose dollars
 * move, out of which account, into which. The claim these cases have to earn is
 * that the decision is the LEDGER'S, not a second one that happens to agree —
 * so the first suite runs the projection and the chooser over the same
 * household and the same year and compares the two answers cent for cent,
 * rather than asserting figures a reader would have to take on trust.
 *
 * THE HOUSEHOLD. `example-couple` is the flagship shipped example and the
 * shape decision 4 turns on: Alex holds an employer 401(k) and the household's
 * only Roth IRA, Sam holds a traditional IRA and no Roth at all, so Sam's share
 * is trimmed and Alex's converts (`planner-ui/src/planner/examples/
 * buildExampleCouple.ts:24-33`, balances 820,000 / 310,000 / 145,000). The
 * fixture below mirrors it rather than importing it, because planner-ui depends
 * on the engine and not the other way round; what it changes is only what would
 * otherwise stop the two paths from being comparable at all — zero returns,
 * zero contributions and zero spending, so the balances the ledger weights
 * owners by in the projection's first year are the Plan's own opening figures
 * and the test can hand the chooser the very snapshot the ledger read.
 */

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

const ALEX = 'p1'
const SAM = 'p2'

function employer401k(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function rothIra(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function designatedRoth(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

/** The example couple's household, stripped to what the split depends on. */
function exampleCoupleHousehold(accounts: Account[]): Plan {
  const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
  plan.id = 'aggregate-conversion-promotion'
  plan.household.people[0]!.name = 'Alex'
  plan.household.people[1]!.name = 'Sam'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = accounts
  return plan
}

const EXAMPLE_COUPLE_ACCOUNTS = (): Account[] => [
  employer401k('alex-401k', 820_000, ALEX),
  traditionalIra('sam-ira', 310_000, SAM),
  rothIra('alex-roth', 145_000, ALEX),
]

/** Opening balances, which for this fixture are also the pre-conversion ones. */
function openingBalances(plan: Plan, year: number): AggregateConversionPromotionYearBalances {
  const balances: Record<string, number> = {}
  for (const account of plan.accounts) {
    if ('balance' in account) balances[account.id] = account.balance
  }
  return { year, balances }
}

function chooseFor(
  plan: Plan,
  amount: number,
  overrides: Partial<AggregateConversionPromotionInput> = {},
) {
  return chooseAggregateConversionPromotionIntents({
    plan: validatePlan(plan),
    winner: {
      source: 'candidate',
      candidateId: 'bracket-22',
      conversions: [{ year: TAX_YEAR, amount }],
    },
    yearBalances: [openingBalances(plan, TAX_YEAR)],
    ...overrides,
  })
}

/**
 * The same call with the Plan handed over unparsed.
 *
 * `validatePlan` would reject the households below before the chooser saw them,
 * which is the point being made about them: the state exists in the TypeScript
 * type and nowhere else.
 */
function chooseUnparsed(plan: Plan, amount: number) {
  return chooseAggregateConversionPromotionIntents({
    plan,
    winner: {
      source: 'candidate',
      candidateId: 'bracket-22',
      conversions: [{ year: TAX_YEAR, amount }],
    },
    yearBalances: [openingBalances(plan, TAX_YEAR)],
  })
}

/** What the ledger did with the same household and the same amount. */
function runLedger(plan: Plan, amount: number): {
  warnings: readonly string[]
  converted: number
  balances: Readonly<Record<string, number>>
} {
  const priced = validatePlan({
    ...plan,
    strategies: {
      ...plan.strategies,
      rothConversion: { mode: 'manual', conversions: [{ year: TAX_YEAR, amount }] },
    },
  })
  const result = simulatePlan(priced, {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: noTax,
  })
  const year = result.years[0]!
  return { warnings: result.warnings, converted: year.rothConversion, balances: year.balances }
}

function chosen(choice: ReturnType<typeof chooseAggregateConversionPromotionIntents>) {
  if (choice.status !== 'chosen') {
    throw new Error(`expected a chosen promotion, got ${JSON.stringify(choice.issues)}`)
  }
  return choice
}

describe('the ledger and the chooser allocate the same year the same way', () => {
  it('trims Sam and names every cent Alex converts, exactly as the projection moves them', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const ledger = runLedger(plan, 100_000)
    const choice = chosen(chooseFor(plan, 100_000))

    // ONE intent, because one of the two owners has nowhere to convert to.
    expect(choice.intents).toHaveLength(1)
    const intent = choice.intents[0]!
    expect(intent.personId).toBe(ALEX)
    expect(intent.destinationRothAccountId).toBe('alex-roth')
    expect(intent.sourceAllocations).toEqual([
      { sourceAccountId: 'alex-401k', requestedAmount: intent.requestedAmount },
    ])

    // The comparison that matters: the ledger's own movement, in cents.
    expect(intent.requestedAmount).toBe(planDollarsToLedgerCents(ledger.converted))
    expect(intent.sourceAllocations[0]!.requestedAmount)
      .toBe(planDollarsToLedgerCents(820_000 - ledger.balances['alex-401k']!))
    expect(intent.requestedAmount)
      .toBe(planDollarsToLedgerCents(ledger.balances['alex-roth']! - 145_000))

    // And the figure itself, so a reader can see what both paths produced:
    // 100,000 split 820,000 : 310,000 gives Alex 72,566.37 and Sam 27,433.63,
    // and Sam's share is dropped rather than reallocated.
    expect(ledger.converted).toBeCloseTo(72_566.37, 10)
    expect(intent.requestedAmount).toBe(7_256_637)
    expect(ledger.balances['sam-ira']).toBe(310_000)
  })

  it('replays the ledger last-row view for duplicate source and destination IDs', () => {
    const supersededSource = traditionalIra('duplicate-source', 300_000, ALEX)
    supersededSource.name = 'Superseded source row'
    const selectedSource = traditionalIra('duplicate-source', 30_000, ALEX)
    selectedSource.name = 'Selected source row'
    const supersededDestination = rothIra('duplicate-roth', 10_000, ALEX)
    supersededDestination.name = 'Superseded destination row'
    const selectedDestination = rothIra('duplicate-roth', 2_000, ALEX)
    selectedDestination.name = 'Selected destination row'
    const plan = exampleCoupleHousehold([
      supersededSource,
      selectedSource,
      supersededDestination,
      selectedDestination,
    ])

    const ledger = runLedger(plan, 50_000)
    const choice = chosen(chooseFor(plan, 50_000))
    expect(ledger.converted).toBe(30_000)
    expect(choice.intents).toEqual([expect.objectContaining({
      personId: ALEX,
      destinationRothAccountId: 'duplicate-roth',
      requestedAmount: 3_000_000,
      sourceAllocations: [{
        sourceAccountId: 'duplicate-source',
        requestedAmount: 3_000_000,
      }],
    })])
    expect(ledger.balances).toMatchObject({
      'duplicate-source': 0,
      'duplicate-roth': 32_000,
    })
  })

  it('reports the trim the ledger warns about, for the same person and the same reason', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const ledger = runLedger(plan, 100_000)
    const choice = chosen(chooseFor(plan, 100_000))

    expect(choice.years).toEqual([{
      year: TAX_YEAR,
      winnerCents: 10_000_000,
      allocatedCents: 7_256_637,
      trims: [{
        ownerPersonId: SAM,
        reason: 'ownerHoldsNoRothAccount',
        slicePlanDollars: 27_433.63,
      }],
      refusal: null,
      intents: choice.intents,
    }])
    expect(ledger.warnings).toContain(
      'Sam has no Roth account, so Sam’s share of the Roth conversion was skipped — ' +
      'a conversion has to land in the same person’s own Roth. ' +
      'Opening a Roth IRA for Sam would let that share convert.',
    )
    // The promoted schedule converts less than the winner asked for, and says
    // so per year. That is the normal case for a two-owner household, not an
    // edge case, and nothing here rescales the remainder onto Alex.
    expect(choice.years[0]!.allocatedCents).toBeLessThan(choice.years[0]!.winnerCents)
  })

  it('splits between two owners exactly as the ledger credits their Roths', () => {
    // Give Sam a Roth and nothing is trimmed: both slices convert, into their
    // own owner's account.
    const plan = exampleCoupleHousehold([
      ...EXAMPLE_COUPLE_ACCOUNTS(),
      rothIra('sam-roth', 0, SAM),
    ])
    const ledger = runLedger(plan, 100_000)
    const choice = chosen(chooseFor(plan, 100_000))

    expect(choice.intents.map((intent) => [
      intent.personId,
      intent.destinationRothAccountId,
      intent.requestedAmount,
    ])).toEqual([
      [ALEX, 'alex-roth', planDollarsToLedgerCents(ledger.balances['alex-roth']! - 145_000)],
      [SAM, 'sam-roth', planDollarsToLedgerCents(ledger.balances['sam-roth']!)],
    ])
    expect(ledger.converted).toBeCloseTo(100_000, 10)
    expect(choice.years[0]!.allocatedCents).toBe(10_000_000)
  })

  it('names each source in Plan order when one owner’s slice spans two accounts', () => {
    // Alex's slice outruns the first account, so it spills into the second --
    // the same walk the ledger takes, and the same two debits.
    const plan = exampleCoupleHousehold([
      employer401k('alex-401k', 20_000, ALEX),
      traditionalIra('sam-ira', 310_000, SAM),
      traditionalIra('alex-ira', 800_000, ALEX),
      rothIra('alex-roth', 145_000, ALEX),
    ])
    const ledger = runLedger(plan, 100_000)
    const choice = chosen(chooseFor(plan, 100_000))

    expect(choice.intents[0]!.sourceAllocations).toEqual([
      { sourceAccountId: 'alex-401k', requestedAmount: 2_000_000 },
      {
        sourceAccountId: 'alex-ira',
        requestedAmount: planDollarsToLedgerCents(800_000 - ledger.balances['alex-ira']!),
      },
    ])
    expect(ledger.balances['alex-401k']).toBe(0)
    expect(choice.intents[0]!.requestedAmount)
      .toBe(planDollarsToLedgerCents(ledger.converted))
  })
})

describe('account order', () => {
  it('mints the same intents when the Plan lists the same accounts in another order', () => {
    // WS4: equivalent plans with different account array order produce the same
    // allocation. Both owners convert here, so the assertion covers the owner
    // slice order, the destination search and the execution slot at once -- the
    // slot is numbered in canonical person order for exactly this reason.
    const accounts = [
      ...EXAMPLE_COUPLE_ACCOUNTS(),
      rothIra('sam-roth', 0, SAM),
    ]
    const asWritten = exampleCoupleHousehold(accounts)
    const reordered = exampleCoupleHousehold([
      accounts[3]!,
      accounts[1]!,
      accounts[2]!,
      accounts[0]!,
    ])

    expect(chosen(chooseFor(reordered, 100_000)).intents)
      .toEqual(chosen(chooseFor(asWritten, 100_000)).intents)
  })
})

describe('the destination vehicle', () => {
  it('trims an owner whose only Roth sits inside an employer plan', () => {
    const plan = exampleCoupleHousehold([
      employer401k('alex-401k', 820_000, ALEX),
      traditionalIra('sam-ira', 310_000, SAM),
      designatedRoth('sam-roth-401k', 5_000, SAM),
      rothIra('alex-roth', 145_000, ALEX),
    ])
    const choice = chosen(chooseFor(plan, 100_000))

    expect(choice.intents).toHaveLength(1)
    expect(choice.years[0]!.trims).toEqual([{
      ownerPersonId: SAM,
      reason: 'ownerHoldsOnlyEmployerDesignatedRoth',
      slicePlanDollars: 27_433.63,
    }])
    // The distinct reason is the point: Sam HAS a Roth, and it still cannot
    // receive this. The remedy the surface offers has to differ.
    expect(choice.years[0]!.trims[0]!.reason).not.toBe('ownerHoldsNoRothAccount')
  })

  it('passes over a designated Roth account for a Roth IRA later in Plan order', () => {
    const plan = exampleCoupleHousehold([
      employer401k('alex-401k', 820_000, ALEX),
      designatedRoth('alex-roth-401k', 5_000, ALEX),
      rothIra('alex-roth-ira', 145_000, ALEX),
    ])
    const choice = chosen(chooseFor(plan, 100_000))

    expect(choice.intents[0]!.destinationRothAccountId).toBe('alex-roth-ira')
  })

  it('refuses a whole household whose every Roth is a designated Roth account', () => {
    const plan = exampleCoupleHousehold([
      employer401k('alex-401k', 820_000, ALEX),
      designatedRoth('alex-roth-401k', 5_000, ALEX),
    ])
    const choice = chooseFor(plan, 100_000)

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['noLawfulConversion'])
    expect(choice.years[0]!.refusal).toBe('householdHoldsOnlyEmployerDesignatedRoth')
  })
})

describe('one owner', () => {
  it('hands a single-owner household the whole amount out of its own account', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'aggregate-conversion-promotion-single'
    plan.accounts = [
      traditionalIra('pat-ira', 500_000, 'p1'),
      rothIra('pat-roth', 0, 'p1'),
    ]
    const ledger = runLedger(plan, 40_000)
    const choice = chosen(chooseFor(plan, 40_000))

    expect(choice.intents).toHaveLength(1)
    expect(choice.intents[0]!.requestedAmount).toBe(4_000_000)
    expect(choice.intents[0]!.executionSequence).toBe(1)
    expect(ledger.converted).toBe(40_000)
  })
})

describe('what it refuses to promote', () => {
  const plan = () => exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())

  it('refuses a solver winner, whose provenance no adapter-minted request can carry', () => {
    const choice = chooseFor(plan(), 100_000, {
      winner: {
        source: 'milp',
        candidateId: null,
        conversions: [{ year: TAX_YEAR, amount: 100_000 }],
      },
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['milpWinnerNotPromotable'])
  })

  it('refuses a candidate winner that arrives without its candidate ID', () => {
    const choice = chooseFor(plan(), 100_000, {
      winner: {
        source: 'candidate',
        candidateId: null,
        conversions: [{ year: TAX_YEAR, amount: 100_000 }],
      },
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['winnerCandidateIdMissing'])
  })

  it('refuses an empty schedule', () => {
    const choice = chooseFor(plan(), 100_000, {
      winner: { source: 'candidate', candidateId: 'bracket-22', conversions: [] },
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['emptyWinnerSchedule'])
  })

  it.each([
    ['a zero amount', [{ year: TAX_YEAR, amount: 0 }]],
    ['a negative amount', [{ year: TAX_YEAR, amount: -1 }]],
    ['a NaN amount', [{ year: TAX_YEAR, amount: Number.NaN }]],
    // Beyond the exact-cent safe-integer range, where the arithmetic layer
    // raises rather than answers. A contract that promises typed issues must
    // not throw one input class and refuse the rest, and `not.toThrow()` below
    // is the half of this row that matters.
    ['an amount past the exact-cent safe range', [
      { year: TAX_YEAR, amount: Number.MAX_SAFE_INTEGER },
    ]],
    ['a sub-cent amount', [{ year: TAX_YEAR, amount: 100.001 }]],
    ['years out of order', [
      { year: TAX_YEAR + 1, amount: 10_000 },
      { year: TAX_YEAR, amount: 10_000 },
    ]],
    ['a repeated year', [
      { year: TAX_YEAR, amount: 10_000 },
      { year: TAX_YEAR, amount: 10_000 },
    ]],
  ])('refuses %s, which could never produce comparable evidence', (_label, conversions) => {
    const household = plan()
    const call = () => chooseFor(household, 100_000, {
      winner: { source: 'candidate', candidateId: 'bracket-22', conversions },
    })

    // Refused, not thrown: the schedule is read before any of it reaches the
    // allocation policy, which raises on a figure it cannot represent.
    expect(call).not.toThrow()
    const choice = call()
    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['invalidWinnerSchedule'])
  })

  it('refuses a scheduled year with no balance snapshot rather than using the Plan’s', () => {
    // The Plan's opening balances are a different fact from the balances the
    // ledger weighted owners by in year five, and silently substituting one for
    // the other is the whole failure this refusal exists to prevent.
    const choice = chooseFor(plan(), 100_000, {
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [
          { year: TAX_YEAR, amount: 100_000 },
          { year: TAX_YEAR + 4, amount: 100_000 },
        ],
      },
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['missingYearBalances'])
  })

  it('refuses two snapshots for one year rather than keeping whichever came last', () => {
    // `new Map(entries)` resolves a repeated key by keeping the last silently.
    // Allocating against whichever balances happened to be written second would
    // produce a schedule nobody could trace back to a projection, so the whole
    // input is refused and the year is named.
    const household = plan()
    const snapshot = openingBalances(household, TAX_YEAR)
    const choice = chooseFor(household, 100_000, {
      yearBalances: [
        snapshot,
        { year: TAX_YEAR, balances: { ...snapshot.balances, 'alex-401k': 1_000 } },
      ],
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues).toEqual([{
      kind: 'duplicateYearBalances',
      field: 'yearBalances.1.year',
      detail: `Year ${TAX_YEAR} carries more than one balance snapshot, and which one the ledger read is unstated.`,
    }])
    // Refused whole: no year was allocated against either snapshot.
    expect(choice.years).toEqual([])
  })

  it('allocates normally when the same snapshots carry one year each', () => {
    // The discriminating half: two entries are fine, two for one year are not.
    const household = plan()
    const choice = chosen(chooseAggregateConversionPromotionIntents({
      plan: validatePlan(household),
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [{ year: TAX_YEAR, amount: 100_000 }],
      },
      yearBalances: [
        openingBalances(household, TAX_YEAR),
        openingBalances(household, TAX_YEAR + 1),
      ],
    }))

    expect(choice.intents).toHaveLength(1)
    expect(choice.intents[0]!.requestedAmount).toBe(7_256_637)
  })

  it('asks a fractional-cent source only for the cents it can fund', () => {
    // A drained source's draw carries the float balance, fraction and all. The
    // executor snapshots that source at the whole cents it can FUND, so a
    // half-up conversion here would mint a request one cent past capacity and
    // the executor would block it whole. The draw floors instead: same
    // semantics at both ends of the promotion.
    const household = plan()
    const alexIra = household.accounts.find((account) => account.id === 'alex-401k')!
    if (!('balance' in alexIra)) throw new Error('expected a balance-bearing account')
    alexIra.balance = 50_000.005
    const choice = chosen(chooseFor(household, 500_000))

    const alexIntent = choice.intents.find((intent) => intent.personId === ALEX)
    if (alexIntent === undefined) throw new Error('expected an intent for Alex')
    const fromAlexIra = alexIntent.sourceAllocations
      .find((allocation) => allocation.sourceAccountId === 'alex-401k')
    // Half-up would have asked for 5_000_001.
    expect(fromAlexIra?.requestedAmount).toBe(5_000_000)
    expect(alexIntent.sourceAllocations
      .reduce((total, allocation) => total + allocation.requestedAmount, 0))
      .toBe(alexIntent.requestedAmount)
  })

  it('refuses a snapshot that omits an account the policy would weight', () => {
    const household = plan()
    const partial = openingBalances(household, TAX_YEAR)
    const balances = { ...partial.balances }
    delete balances['sam-ira']
    const choice = chooseFor(household, 100_000, {
      yearBalances: [{ year: TAX_YEAR, balances }],
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    // The field path is the caller's own array position, because `yearBalances`
    // is an array: a path that reads like an index has to be one.
    expect(choice.issues).toEqual([{
      kind: 'missingAccountBalance',
      field: 'yearBalances.0.balances.sam-ira',
      detail: `Every owned traditional and every Roth account needs a stated nonnegative balance for ${TAX_YEAR}.`,
    }])
  })

  it('refuses a snapshot that omits a designated Roth account it can never convert into', () => {
    // The account is required precisely because nothing can land in it: it is
    // what tells an owner who holds only that kind apart from an owner who
    // holds no Roth at all, and the two hear different sentences.
    const household = exampleCoupleHousehold([
      employer401k('alex-401k', 820_000, ALEX),
      traditionalIra('sam-ira', 310_000, SAM),
      designatedRoth('sam-roth-401k', 5_000, SAM),
      rothIra('alex-roth', 145_000, ALEX),
    ])
    const partial = openingBalances(household, TAX_YEAR)
    const balances = { ...partial.balances }
    delete balances['sam-roth-401k']
    const choice = chooseFor(household, 100_000, {
      yearBalances: [{ year: TAX_YEAR, balances }],
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues[0]!.field).toBe('yearBalances.0.balances.sam-roth-401k')
  })

  it('names the year rather than a position when a whole snapshot is absent', () => {
    // Nothing to index: the entry the caller has to add is the one that is not
    // there.
    const choice = chooseFor(plan(), 100_000, {
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [{ year: TAX_YEAR + 4, amount: 100_000 }],
      },
      yearBalances: [openingBalances(plan(), TAX_YEAR)],
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues).toEqual([{
      kind: 'missingYearBalances',
      field: 'yearBalances',
      detail: `Year ${TAX_YEAR + 4} is promoted with no balance snapshot for the policy to weight its owners by.`,
    }])
  })

  it('says a Plan with nobody in it has no primary person, not a missing balance', () => {
    // The fallback owner for an account the Plan records no individual owner
    // for. Calling that a missing account balance sends a reader after the
    // wrong input entirely.
    const household = plan()
    const choice = chooseAggregateConversionPromotionIntents({
      plan: { ...household, household: { ...household.household, people: [] } },
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [{ year: TAX_YEAR, amount: 100_000 }],
      },
      yearBalances: [openingBalances(household, TAX_YEAR)],
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues).toEqual([{
      kind: 'missingPrimaryPerson',
      field: 'plan.household.people',
      detail: 'A Plan with no person has no owner for an account the Plan records no individual owner for.',
    }])
  })

  it('refuses a household with no Roth account at all', () => {
    const household = exampleCoupleHousehold([
      employer401k('alex-401k', 820_000, ALEX),
      traditionalIra('sam-ira', 310_000, SAM),
    ])
    const choice = chooseFor(household, 100_000)

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['noLawfulConversion'])
    expect(choice.years[0]!.refusal).toBe('householdHoldsNoRothAccount')
  })
})

/**
 * The one place the ledger's attribution and the identity path genuinely
 * disagree: an account the Plan records no individual owner for is the primary
 * person's for the policy's arithmetic, and nobody's for a request.
 *
 * The order of these cases is the point. The schema is the real guarantee and is
 * pinned first; the chooser's refusal is a backstop for a Plan-shaped object
 * that was never parsed, which the TypeScript type permits because
 * `ownerPersonId` is `string | null` and the invariant lives in a `superRefine`.
 * Written the other way round, the suite would read as though a user could put
 * their plan in this state.
 */
/**
 * The other half of the exact-cent boundary: the winner's amount is validated
 * before anything reaches the policy, but the BALANCES are not, and the
 * arithmetic layer raises on a figure it cannot represent. Both routes to that
 * raise are closed here, and it is worth telling them apart because the policy
 * only takes one of them.
 */
describe('balances the exact-cent ledger cannot represent', () => {
  const HUGE = 5e13

  it('refuses the year when one owner’s convertible balances outrun the safe range', () => {
    // Two convertible owners, so the policy takes the exact-cent split rather
    // than its single-owner shortcut and measures each owner's whole weight.
    // Alex's two accounts sum past the safe-integer cent range even though each
    // one of them fits, which is a state no single-balance check would catch.
    const household = exampleCoupleHousehold([
      traditionalIra('alex-ira', HUGE, ALEX),
      traditionalIra('alex-ira-two', HUGE, ALEX),
      traditionalIra('sam-ira', 310_000, SAM),
      rothIra('alex-roth', 0, ALEX),
      rothIra('sam-roth', 0, SAM),
    ])
    const call = () => chooseFor(household, 100_000)

    expect(call).not.toThrow()
    const choice = call()
    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['unrepresentableYearBalances'])
    expect(choice.issues[0]!.field).toBe('yearBalances.0.balances')
  })

  it('refuses the year when a single source outruns it under the one-owner shortcut', () => {
    // One convertible owner, so the policy never measures a weight at all and
    // raises nowhere. The figure this refuses on is read afterwards, when the
    // source's fundable cents cap the draw -- the same class of defect, and the
    // reason the seam is around the year rather than around the policy call.
    const household = exampleCoupleHousehold([
      traditionalIra('alex-ira', HUGE * 2, ALEX),
      rothIra('alex-roth', 0, ALEX),
    ])
    const call = () => chooseFor(household, 100_000)

    expect(call).not.toThrow()
    const choice = call()
    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind)).toEqual(['unrepresentableYearBalances'])
  })

  it('refuses only the year it cannot represent, and names the rest as usual', () => {
    // The seam refuses a year, not the run: a second scheduled year with no
    // snapshot at all still reports its own issue beside this one.
    const household = exampleCoupleHousehold([
      traditionalIra('alex-ira', HUGE * 2, ALEX),
      rothIra('alex-roth', 0, ALEX),
    ])
    const choice = chooseFor(household, 100_000, {
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [
          { year: TAX_YEAR, amount: 100_000 },
          { year: TAX_YEAR + 1, amount: 100_000 },
        ],
      },
    })

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues.map((entry) => entry.kind))
      .toEqual(['unrepresentableYearBalances', 'missingYearBalances'])
  })
})

describe('an account with no recorded owner', () => {
  it('cannot exist in a parsed Plan at all', () => {
    const ownerlessSource = parsePlan(exampleCoupleHousehold([
      { ...traditionalIra('joint-ira', 400_000, ALEX), ownerPersonId: null },
      rothIra('alex-roth', 145_000, ALEX),
    ]))
    const ownerlessDestination = parsePlan(exampleCoupleHousehold([
      traditionalIra('alex-ira', 400_000, ALEX),
      { ...rothIra('joint-roth', 0, ALEX), ownerPersonId: null },
    ]))

    if (ownerlessSource.ok || ownerlessDestination.ok) {
      throw new Error('planSchema is expected to require an individual owner')
    }
    expect(ownerlessSource.issues).toContain(
      'accounts.0.ownerPersonId: traditional accounts must have an individual owner',
    )
    expect(ownerlessDestination.issues).toContain(
      'accounts.1.ownerPersonId: roth accounts must have an individual owner',
    )
  })

  it('is refused by name as a source when an unparsed Plan carries one', () => {
    // The policy attributes this account to the primary person because the
    // ledger does. The allocator answers a null owner with `ambiguousIdentity`,
    // so emitting it would hand back `chosen` intents the adapter is guaranteed
    // to block -- and would launder an arithmetic fallback into a claim of
    // ownership on a request a person would act on.
    const household = exampleCoupleHousehold([
      { ...traditionalIra('joint-ira', 400_000, ALEX), ownerPersonId: null, name: 'Joint IRA' },
      rothIra('alex-roth', 145_000, ALEX),
    ])
    const choice = chooseUnparsed(household, 100_000)

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues).toHaveLength(1)
    expect(choice.issues[0]!.kind).toBe('missingAccountOwner')
    expect(choice.issues[0]!.field).toBe('plan.accounts.0.ownerPersonId')
    expect(choice.issues[0]!.detail).toContain('“Joint IRA” (joint-ira)')
    expect(choice.issues[0]!.detail).toContain('supplies')
  })

  it('is refused by name as a destination when an unparsed Plan carries one', () => {
    const household = exampleCoupleHousehold([
      traditionalIra('alex-ira', 400_000, ALEX),
      { ...rothIra('joint-roth', 0, ALEX), ownerPersonId: null, name: 'Joint Roth' },
    ])
    const choice = chooseUnparsed(household, 100_000)

    if (choice.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(choice.issues).toHaveLength(1)
    expect(choice.issues[0]!.kind).toBe('missingAccountOwner')
    expect(choice.issues[0]!.field).toBe('plan.accounts.1.ownerPersonId')
    expect(choice.issues[0]!.detail).toContain('“Joint Roth” (joint-roth)')
    expect(choice.issues[0]!.detail).toContain('receives')
  })

  it('chooses normally once the same accounts record who owns them', () => {
    // The control: nothing about this household is unusual except the stated
    // ownership, and stating it is the whole remedy.
    const household = exampleCoupleHousehold([
      traditionalIra('alex-ira', 400_000, ALEX),
      rothIra('alex-roth', 0, ALEX),
    ])
    const choice = chosen(chooseFor(household, 100_000))

    expect(choice.intents).toHaveLength(1)
    expect(choice.intents[0]!.personId).toBe(ALEX)
    expect(choice.intents[0]!.sourceAllocations[0]!.sourceAccountId).toBe('alex-ira')
  })
})

describe('provenance', () => {
  it('takes the winner’s own candidate ID, on every source in every year', () => {
    const plan = exampleCoupleHousehold([
      ...EXAMPLE_COUPLE_ACCOUNTS(),
      rothIra('sam-roth', 0, SAM),
    ])
    const choice = chosen(chooseAggregateConversionPromotionIntents({
      plan: validatePlan(plan),
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22-until-2030',
        conversions: [
          { year: TAX_YEAR, amount: 100_000 },
          { year: TAX_YEAR + 1, amount: 50_000 },
        ],
      },
      yearBalances: [
        openingBalances(plan, TAX_YEAR),
        openingBalances(plan, TAX_YEAR + 1),
      ],
    }))

    expect(choice.intents).toHaveLength(4)
    for (const intent of choice.intents) {
      expect(intent.provenance).toEqual({
        source: 'generator',
        sourceId: 'bracket-22-until-2030',
      })
      expect(intent.taxFunding).toEqual({ kind: 'noneExpected' })
      expect(intent.executionDate).toBe(`${intent.year}-12-31`)
    }
    // One slot per converting owner, restarting each year, and never repeated
    // inside one.
    expect(choice.intents.map((intent) => [intent.year, intent.executionSequence]))
      .toEqual([
        [TAX_YEAR, 1], [TAX_YEAR, 2],
        [TAX_YEAR + 1, 1], [TAX_YEAR + 1, 2],
      ])
  })

  it('produces byte-identical intents from identical inputs', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())

    expect(JSON.stringify(chosen(chooseFor(plan, 100_000)).intents))
      .toBe(JSON.stringify(chosen(chooseFor(plan, 100_000)).intents))
  })
})

/**
 * The exploratory candidate the adapter accepts, in the exact shape
 * `simpleRothConversionGenerator` emits (`decisions/generators.ts:97-147`). It
 * is built literally rather than generated, because the generator needs a
 * priced baseline this suite has no use for -- and the adapter rejects anything
 * that is not byte-exact, so a drifting copy fails loudly rather than silently.
 */
function exploratoryBracket22(endYear: number): DecisionCandidate {
  return {
    id: 'bracket-22',
    source: 'heuristic',
    category: 'roth',
    label: 'Fill the 22% bracket',
    explanation: 'Roth conversions each year up to the 22% bracket, evaluated on the exact ledger.',
    planPatch: {
      strategies: {
        rothConversion: {
          mode: 'fillToTarget',
          target: 'topOfBracket',
          targetValue: 22,
          startYear: TAX_YEAR,
          endYear,
        },
      },
    },
    retirementActionReadiness: {
      state: 'exploratoryNonActionable',
      reason: 'This aggregate strategy does not yet identify legal owners, source accounts, and destination accounts.',
    },
  }
}

describe('minting the candidate', () => {
  function promote(plan: Plan, amount: number, candidateId = 'bracket-22') {
    return promoteAggregateConversionSchedule({
      plan: validatePlan(plan),
      winner: {
        source: 'candidate',
        candidateId,
        conversions: [{ year: TAX_YEAR, amount }],
      },
      yearBalances: [openingBalances(plan, TAX_YEAR)],
      exploratoryCandidate: exploratoryBracket22(TAX_YEAR),
    })
  }

  it('mints an identity-complete candidate whose requests carry the winner’s provenance', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const promotion = promote(plan, 100_000)

    if (promotion.status !== 'promoted') {
      throw new Error(`expected a promotion, got ${JSON.stringify(promotion)}`)
    }
    const readiness = promotion.candidate.retirementActionReadiness
    expect(readiness?.state).toBe('identityComplete')
    expect(promotion.candidate.conversions).toBeUndefined()

    const materialized = applyScenarioPatch(validatePlan(plan), promotion.candidate.planPatch!)
    if (!materialized.ok) throw new Error(materialized.issues.join('; '))
    const requests: RothConversionRequest[] = materialized.plan.strategies.retirementActions
      .map((action) => rothConversionRequestSchema.safeParse(action))
      .flatMap((parsed) => parsed.success ? [parsed.data] : [])
    expect(requests).toHaveLength(1)
    expect(requests[0]!.provenance).toEqual({ source: 'generator', sourceId: 'bracket-22' })
    expect(requests[0]!.personId).toBe(ALEX)
    expect(requests[0]!.destinationRothAccountId).toBe('alex-roth')
    expect(requests[0]!.requestedAmount).toBe(7_256_637)
    // The candidate's own readiness names the actions the patch installs.
    expect(readiness?.state === 'identityComplete' ? readiness.actionRequestIds : [])
      .toEqual(requests.map((request) => request.actionId))
    // The aggregate strategy is switched off in the same patch: a promoted
    // schedule converts once, by name.
    expect(materialized.plan.strategies.rothConversion).toEqual({ mode: 'none' })
  })

  it('mints the same candidate ID for the same winner twice', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const first = promote(plan, 100_000)
    const second = promote(plan, 100_000)

    if (first.status !== 'promoted' || second.status !== 'promoted') {
      throw new Error('expected two promotions')
    }
    expect(second.candidate.id).toBe(first.candidate.id)
    expect(second.candidate.id).not.toBe('bracket-22')
  })

  it('refuses to promote against a candidate the veto did not name', () => {
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const promotion = promote(plan, 100_000, 'bracket-24')

    if (promotion.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(promotion.choice.issues.map((entry) => entry.kind))
      .toEqual(['exploratoryCandidateMismatch'])
  })

  it('names the missing candidate ID rather than a mismatch nobody stated', () => {
    // A blank winner ID trivially differs from the exploratory candidate's,
    // and the mismatch wording would send a reader after the wrong defect.
    // The chooser's own refusal is the accurate one, so the mismatch check
    // stands aside for it.
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const promotion = promote(plan, 100_000, '  ')

    if (promotion.status !== 'unallocatable') throw new Error('expected a refusal')
    expect(promotion.choice.issues.map((entry) => entry.kind))
      .toEqual(['winnerCandidateIdMissing'])
  })

  it('reports the adapter’s own block rather than swallowing it', () => {
    // The winner's year falls outside the exploratory candidate's window, so
    // the adapter refuses the schedule it is asked to stand behind.
    const plan = exampleCoupleHousehold(EXAMPLE_COUPLE_ACCOUNTS())
    const promotion = promoteAggregateConversionSchedule({
      plan: validatePlan(plan),
      winner: {
        source: 'candidate',
        candidateId: 'bracket-22',
        conversions: [{ year: TAX_YEAR + 5, amount: 100_000 }],
      },
      yearBalances: [openingBalances(plan, TAX_YEAR + 5)],
      exploratoryCandidate: exploratoryBracket22(TAX_YEAR),
    })

    if (promotion.status !== 'blocked') {
      throw new Error(`expected a block, got ${promotion.status}`)
    }
    expect(promotion.adaptation.issues[0]!.field).toBe('intents.0.year')
    expect(promotion.choice.intents).toHaveLength(1)
  })
})
