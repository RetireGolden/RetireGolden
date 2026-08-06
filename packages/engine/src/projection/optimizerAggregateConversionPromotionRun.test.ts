import { describe, expect, it } from 'vitest'

import { createDecisionContext, evaluateCandidate } from '../decisions/evaluateCandidate.js'
import { simpleRothConversionGenerator } from '../decisions/generators.js'
import type { DecisionCandidate, DecisionContext } from '../decisions/types.js'
import type { Account, Plan } from '../model/plan.js'
import { cashAccount, couplePlan, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { allowLegacyAggregateDecisionCalculation } from './internal/legacyAggregateDecisionCalculation.js'
import { evaluateExactLedgerSchedule, type RetirementActionReadinessVeto } from './optimizePlan.js'
import { runAggregateConversionPromotion } from './optimizerAggregateConversionPromotionRun.js'
import { compareOptimizerExactLedgerResults } from './optimizerExactLedgerComparison.js'

/**
 * What happens when the aggregate winner is actually promoted and priced.
 *
 * The plan document asserted that an identity-complete form of an aggregate
 * schedule cannot in general be a faithful re-expression of it, and named a
 * two-owner household with a trimmed owner as the case that proves it. This
 * suite is where that stops being an assertion: every case below runs the real
 * ledger on both sides — a genuine aggregate projection for the winner, a
 * genuine exact-ledger evaluation for the promoted candidate — and records what
 * `compareOptimizerExactLedgerResults`, the equality core, said about the pair.
 *
 * WHAT IT MEASURED, against that prediction: the two-owner household IS a
 * faithful re-expression, once the amount promoted is the one the ledger's
 * policy was asked for rather than the one it executed. The trimmed owner was
 * never the obstacle — re-trimming was, and no longer happens. What does
 * diverge is sub-cent residue over a long schedule, which the last case below
 * measures.
 *
 * WHAT THE SUITE IS MOST CAREFUL ABOUT is the difference between "these two
 * priced differently" and "no comparison could be made". Both would arrive as a
 * bare `null` from either comparator, and only the first is a repricing; a
 * candidate whose requests never executed, or a projection the core cannot
 * read, has to be reported as itself. Two cases below exist for that alone.
 *
 * Nothing here publishes a recommendation. The veto and the optimizer throw are
 * untouched by this slice, and no optimizer entry point calls the runner.
 *
 * THE FIXTURES ARE DELIBERATELY FLAT. Zero returns, zero inflation, zero
 * spending and a zero-rate tax calculator, so that the only differences between
 * the two projections are the ones promotion itself introduces: where in the
 * year the conversion runs, whether it moves Plan dollars or exact cents, and
 * whether an owner's share had anywhere to go.
 */

const START_YEAR = 2026
const noTax = createFlatTaxCalculator(0)
const ALEX = 'p1'
const SAM = 'p2'

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

/**
 * The classification the named-conversion executor requires of an IRA source.
 *
 * An employer traditional account cannot carry one — `planSchema` refuses an
 * IRA classification whose account is not an owned non-inherited traditional
 * IRA — which is the fact the employer-source case below turns on.
 */
function iraClassification(sourceAccountId: string) {
  return {
    evidenceId: `${sourceAccountId}-classification`,
    provenance: { source: 'manual' as const },
    sourceAccountId,
    subtype: 'traditional' as const,
  }
}

function contextFor(plan: Plan): DecisionContext {
  return createDecisionContext(validatePlan(plan), {
    startYear: START_YEAR,
    taxCalculator: noTax,
  })
}

/**
 * A real vetoed aggregate winner, built the way the tournament builds one.
 *
 * The conversions are read off the aggregate projection's executed
 * `rothConversion` and rounded to cents, exactly as `buildRichCandidates` does,
 * and the validation is the public exact-ledger one. Nothing here is
 * hand-written: the point of the suite is that both sides came from the ledger.
 */
function vetoedWinner(ctx: DecisionContext, candidateId: string): {
  exploratoryCandidate: DecisionCandidate
  veto: RetirementActionReadinessVeto
} {
  const exploratoryCandidate = simpleRothConversionGenerator.generate(ctx)
    .find((candidate) => candidate.id === candidateId)
  if (exploratoryCandidate === undefined) {
    throw new Error(`fixture drift: no generator candidate ${candidateId}`)
  }
  const aggregate = evaluateCandidate(
    ctx,
    exploratoryCandidate,
    allowLegacyAggregateDecisionCalculation({}),
  )
  const vetoedConversions = aggregate.candidateResult.years
    .filter((year) => year.rothConversion > 1)
    .map((year) => ({ year: year.year, amount: Math.round(year.rothConversion * 100) / 100 }))
  if (vetoedConversions.length === 0) {
    throw new Error(`fixture drift: ${candidateId} converted nothing`)
  }
  return {
    exploratoryCandidate,
    veto: {
      reason: 'identityIncomplete',
      vetoedWinnerSource: 'candidate',
      vetoedCandidateId: exploratoryCandidate.id,
      vetoedCandidateLabel: exploratoryCandidate.label,
      vetoedConversions,
      vetoedValidation: evaluateExactLedgerSchedule(
        ctx.plan,
        vetoedConversions,
        ctx.baselineResult,
        aggregate.candidateResult,
      ),
      vetoedResult: aggregate.candidateResult,
    },
  }
}

function runFor(plan: Plan, candidateId: string) {
  const ctx = contextFor(plan)
  const { exploratoryCandidate, veto } = vetoedWinner(ctx, candidateId)
  return {
    veto,
    run: runAggregateConversionPromotion({
      context: ctx,
      readinessVeto: veto,
      exploratoryCandidate,
    }),
  }
}

/** Alex holds the household's only Roth IRA; Sam holds a traditional IRA and no Roth. */
function twoOwnerHousehold(alexSource: Account): Plan {
  const plan = couplePlan({ p1PlanningAge: 72, p2PlanningAge: 72 })
  plan.id = 'aggregate-conversion-promotion-run'
  plan.household.people[0]!.name = 'Alex'
  plan.household.people[1]!.name = 'Sam'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = [
    { ...cashAccount('household-cash', 50_000), ownerPersonId: ALEX },
    alexSource,
    traditionalIra('sam-ira', 310_000, SAM),
    rothIra('alex-roth', 145_000, ALEX),
  ]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [
      ...(alexSource.type === 'traditional' && alexSource.kind === 'ira'
        ? [iraClassification(alexSource.id)]
        : []),
      iraClassification('sam-ira'),
    ],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return plan
}

/** One person, one traditional IRA, one Roth IRA: nothing to split and nobody to trim. */
function singleOwnerHousehold(): Plan {
  const plan = singlePersonPlan({ planningAge: 70 })
  plan.id = 'aggregate-conversion-promotion-run-solo'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = [
    { ...cashAccount('cash', 50_000), ownerPersonId: ALEX },
    traditionalIra('trad', 500_000, ALEX),
    rothIra('roth', 0, ALEX),
  ]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [iraClassification('trad')],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return plan
}

describe('a two-owner household promotes to the ledger’s own allocation', () => {
  it('promotes the winner, executes cleanly, and is proved equivalent', () => {
    const { veto, run } = runFor(twoOwnerHousehold(traditionalIra('alex-ira', 820_000, ALEX)), 'bracket-10')
    if (run.status !== 'equivalent') {
      throw new Error(`expected an equivalent promotion, got ${run.status}`)
    }

    // The promotion itself succeeded: identity-complete requests that the exact
    // ledger executed as written.
    expect(run.allocatedEvaluation.recommendationState).toBe('beneficial')
    expect(run.allocatedEvaluation.diagnostics).toEqual([])
    expect(run.candidate.retirementActionReadiness?.state).toBe('identityComplete')

    // Sam has no Roth IRA, so Sam's share is trimmed and the household converts
    // strictly less than the amount the policy was asked for. That trim is the
    // LEDGER'S trim, charged once against the pre-trim figure -- which is why
    // naming the owners changed nothing and the equality core proves it.
    const firstYear = run.choice.years[0]!
    expect(firstYear.trims).toEqual([{
      ownerPersonId: SAM,
      reason: 'ownerHoldsNoRothAccount',
      slicePlanDollars: 15_637.17,
    }])
    expect(firstYear.allocatedCents).toBeLessThan(firstYear.winnerCents)
    expect(veto.vetoedConversions[0]!.amount).toBe(41_362.83)
    expect(run.exactLedgerComparison.equality).toBe('exactMinorUnitByRequiredKey')
  })

  it('promotes the pre-trim household amount, so the ledger’s own allocation round-trips', () => {
    const { veto, run } = runFor(twoOwnerHousehold(traditionalIra('alex-ira', 820_000, ALEX)), 'bracket-10')
    if (run.status !== 'equivalent') {
      throw new Error(`expected an equivalent promotion, got ${run.status}`)
    }

    // THE DEFECT THIS PINS THE FIX FOR. `vetoedConversions` is derived from
    // EXECUTED conversions (`buildRichCandidates` reads
    // `YearResult.rothConversion`), so for a household with a trimmed owner the
    // winner's figure is already post-trim -- 41,362.83 is Alex's share alone;
    // Sam converted nothing. Handing THAT back to the policy as a household
    // amount would slice it 820,000 : 310,000 a second time and trim Sam's
    // phantom share again, and the promoted schedule would convert about 73% of
    // what the ledger moved.
    //
    // So the runner promotes the pre-trim figure the ledger published instead,
    // and the round trip closes: the policy allocates the same amount to the
    // same owner out of the same account, and what lands is the very figure the
    // ledger executed.
    const firstYear = run.choice.years[0]!
    const desired = veto.vetoedResult.years[0]!.aggregateRothConversionAllocationDesired
    expect(firstYear.winnerCents).toBe(Math.round(desired! * 100))
    expect(firstYear.allocatedCents).toBe(4_136_283)
    expect(veto.vetoedConversions[0]!.amount).toBe(41_362.83)
    // Sam is still trimmed -- that is the identity rule, not a defect -- and the
    // trim is charged once, against the amount the policy was actually asked
    // for. 310,000 : 1,130,000 of the pre-trim figure, to the cent.
    expect(firstYear.trims).toHaveLength(1)
    expect(firstYear.trims[0]!.ownerPersonId).toBe(SAM)
    expect(firstYear.winnerCents - firstYear.allocatedCents)
      .toBe(Math.round(firstYear.trims[0]!.slicePlanDollars * 100))
    expect(veto.vetoedResult.years[0]!.balances['sam-ira']).toBe(310_000)
  })

  it('is NOT called repriced when the source is an employer plan and nothing executed', () => {
    // The shipped example couple's own shape: Alex's convertible balance is a
    // 401(k). The aggregate ledger converts employer traditional balances --
    // `isConvertibleToRoth` admits them, under the still-`approximated`
    // record `irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-
    // distributability` -- but the named executor refuses one, because the
    // Plan schema records no plan-availability evidence for it and will not
    // even accept an IRA classification on such an account.
    //
    // So promotion mints the requests and the ledger declines to execute them.
    // That is why the veto lift cannot reach the flagship example: not the
    // trim, which promotes faithfully, but the source class.
    //
    // AND IT IS NOT A REPRICING. The two projections do differ -- one converted
    // and one did not -- so a verdict read off a bare null would have called
    // this "repriced" and described a failure to run as a difference in price.
    // The ranking state is a precondition, checked before any equivalence
    // question is asked, and the answer names what actually happened.
    const { run } = runFor(twoOwnerHousehold(employer401k('alex-401k', 820_000, ALEX)), 'bracket-10')
    if (run.status !== 'notComparable') {
      throw new Error(`expected an incomparable promotion, got ${run.status}`)
    }

    expect(run.reason).toBe('allocatedRankingNotComparable')
    expect(run.allocatedEvaluation.recommendationState).toBe('diagnostic')
    expect(run.allocatedEvaluation.diagnostics.join(' '))
      .toContain('conversion-plan-availability-unknown')
    // The promotion itself is still here to inspect: it was minted and priced,
    // and only the claim about the pair is withheld.
    expect(run.candidate.retirementActionReadiness?.state).toBe('identityComplete')
    expect(run.choice.years).not.toHaveLength(0)
  })
})

describe('the equality contract', () => {
  it('a single-owner household whose paths coincide is proved equivalent', () => {
    // THE ANSWER TO "DOES A COINCIDING HOUSEHOLD EXIST?": yes. One owner, one
    // convertible IRA, one Roth IRA, nothing trimmed. The comparator's whole
    // mandatory key set agrees to the cent -- every evaluated account in every
    // year, tax, penalties, investable total, net worth, and the three ending
    // totals -- so naming the owner, the source and the destination changed
    // nothing the ledger does.
    //
    // This is the only state in which an aggregate optimizer result may ever be
    // called implementation-ready, and it is reachable.
    const { veto, run } = runFor(singleOwnerHousehold(), 'bracket-24')
    if (run.status !== 'equivalent') {
      throw new Error(`expected an equivalent promotion, got ${run.status}`)
    }

    // The verdict is the equality core's, and it is what `equivalent` carries.
    expect(run.exactLedgerComparison).toMatchObject({
      currencyMinorUnit: 0.01,
      quantization: 'nearestCentHalfUp',
      equality: 'exactMinorUnitByRequiredKey',
    })
    expect(run.exactLedgerComparison.evaluatedAccountIds)
      .toEqual(['cash', 'roth', 'trad'])

    // The richer binding evidence rides along, because its own preconditions
    // held too: the requests are identity-complete, carry the winner's
    // provenance, and executed for the cents they asked for.
    expect(run.binding).not.toBeNull()
    expect(run.binding?.winnerSource).toBe('candidate')
    expect(run.binding?.winnerCandidateId).toBe('bracket-24')
    expect(run.binding?.winnerConversions).toEqual(veto.vetoedConversions)
    expect(run.binding?.allocatedCandidateId).toBe(run.candidate.id)
    expect(run.binding?.allocatedActionIds.length)
      .toBe(veto.vetoedConversions.length)
    // Nothing was trimmed: one owner, one destination, so nobody's share had
    // nowhere to go. What the promoted schedule converts each year is what the
    // ledger converted that year, to the cent -- including the final year, in
    // which the source ran out and both sides moved the same short amount.
    // (`allocatedCents === winnerCents` would be the wrong pin: the household
    // was asked for the full bracket fill in that year and the balance could
    // not fund it, on both sides.)
    expect(run.choice.years.every((year) => year.trims.length === 0)).toBe(true)
    const executedCentsByYear = new Map(veto.vetoedResult.years
      .filter((year) => year.rothConversion > 1)
      .map((year) => [year.year, Math.round(year.rothConversion * 100)]))
    expect(run.choice.years.map((year) => [year.year, year.allocatedCents]))
      .toEqual([...executedCentsByYear])
    expect(run.choice.years.some((year) => year.allocatedCents < year.winnerCents))
      .toBe(true)
  })

  it('names the key that diverges when the same household converts for longer', () => {
    // The same single-owner household, promoted from a candidate that converts
    // in eleven years instead of three. It is still identity-complete, still
    // beneficial, still untrimmed -- and still not equivalent, because the
    // aggregate ledger drains in Plan dollars while the promoted request moves
    // exact cents. The winner's amount is the executed float rounded to cents
    // (`roundDollars`), so each year leaves a sub-cent residue in the source;
    // the residues accumulate, and once their sum passes half a cent the
    // comparator's nearest-cent quantization stops absorbing them.
    //
    // The keys that diverge are the per-account balance keys, by exactly one
    // cent, from the year the accumulated residue crosses that boundary.
    const { veto, run } = runFor(singleOwnerHousehold(), 'bracket-10')
    if (run.status !== 'repriced') {
      throw new Error(`expected a repriced promotion, got ${run.status}`)
    }
    expect(run.allocatedEvaluation.recommendationState).toBe('beneficial')
    expect(run.choice.years.every((year) => year.trims.length === 0)).toBe(true)

    const cents = (amount: number): number => Math.round(amount * 100)
    const divergences = veto.vetoedResult.years.flatMap((aggregateYear) => {
      const allocatedYear = run.allocatedEvaluation.candidateResult.years
        .find((entry) => entry.year === aggregateYear.year)
      if (allocatedYear === undefined) return []
      return Object.keys(aggregateYear.balances)
        .filter((accountId) =>
          cents(aggregateYear.balances[accountId]!) !==
          cents(allocatedYear.balances[accountId]!))
        .map((accountId) => ({
          year: aggregateYear.year,
          accountId,
          differenceCents:
            cents(aggregateYear.balances[accountId]!) -
            cents(allocatedYear.balances[accountId]!),
        }))
    })

    expect(divergences.length).toBeGreaterThan(0)
    // Only the two accounts the conversion touches, and only ever by dust: a
    // handful of cents against a schedule converting tens of thousands a year.
    expect([...new Set(divergences.map((entry) => entry.accountId))].sort())
      .toEqual(['roth', 'trad'])
    for (const entry of divergences) {
      expect(Math.abs(entry.differenceCents)).toBeGreaterThanOrEqual(1)
      expect(Math.abs(entry.differenceCents)).toBeLessThanOrEqual(10)
    }
    // Equal and opposite in every year that diverges: the residue sits on one
    // side of a movement that did happen, rather than money appearing anywhere.
    // Summed rather than paired off, so the assertion does not depend on which
    // order `Object.keys` handed the two accounts back in.
    for (const year of new Set(divergences.map((entry) => entry.year))) {
      const inYear = divergences.filter((entry) => entry.year === year)
      expect(inYear).toHaveLength(2)
      expect(inYear.reduce((total, entry) => total + entry.differenceCents, 0)).toBe(0)
    }
    // Every mandatory key that is not a balance still agrees, which is what
    // makes the diagnosis specific rather than "the projections differ".
    for (const aggregateYear of veto.vetoedResult.years) {
      const allocatedYear = run.allocatedEvaluation.candidateResult.years
        .find((entry) => entry.year === aggregateYear.year)!
      for (const key of ['tax', 'penalties', 'investableTotal', 'netWorth'] as const) {
        expect(cents(allocatedYear[key])).toBe(cents(aggregateYear[key]))
      }
    }
  })
})

describe('what it will not call a repricing', () => {
  it('names a projection outside the equality core’s domain instead of pricing it', () => {
    // The equality core answers `null` to two different questions -- "they
    // differ" and "this pair was never in my structural domain" -- so the
    // runner asks each projection whether it is in the domain by running the
    // core over it against itself, where inequality is impossible.
    //
    // Here the aggregate projection is put out of the domain in the smallest
    // way there is: one year stops publishing a balance for one account. The
    // household is the coinciding one, so without the probe the very same
    // corruption would have turned a proved `equivalent` into a reported
    // `repriced` -- a claim about arithmetic manufactured out of a missing key.
    const ctx = contextFor(singleOwnerHousehold())
    const { exploratoryCandidate, veto } = vetoedWinner(ctx, 'bracket-24')
    const corruptedYears = veto.vetoedResult.years.map((year, index) => {
      if (index !== 1) return year
      const balances = { ...year.balances }
      delete balances['cash']
      return { ...year, balances }
    })
    const corrupted: RetirementActionReadinessVeto = {
      ...veto,
      vetoedResult: { ...veto.vetoedResult, years: corruptedYears },
    }
    const run = runAggregateConversionPromotion({
      context: ctx,
      exploratoryCandidate,
      readinessVeto: corrupted,
    })
    if (run.status !== 'notComparable') {
      throw new Error(`expected an incomparable promotion, got ${run.status}`)
    }

    expect(run.reason).toBe('aggregateProjectionNotComparable')
    // The candidate itself is fine -- it is the aggregate side that is
    // unreadable -- and that is exactly the distinction being drawn.
    expect(run.allocatedEvaluation.recommendationState).toBe('beneficial')
    // And the naive read this replaces: the cross-comparison really is null
    // here, so a verdict taken straight off it would have said "repriced".
    expect(compareOptimizerExactLedgerResults(
      corrupted.vetoedResult,
      run.allocatedEvaluation.candidateResult,
      ctx.plan,
    )).toBeNull()
    // Uncorrupted, the same pair is equivalent, so nothing but the missing key
    // is responsible for the answer.
    expect(runFor(singleOwnerHousehold(), 'bracket-24').run.status).toBe('equivalent')
  })
})

describe('what the runner refuses', () => {
  it('refuses a solver winner with the chooser’s own typed issue', () => {
    const ctx = contextFor(singleOwnerHousehold())
    const { exploratoryCandidate, veto } = vetoedWinner(ctx, 'bracket-24')
    const run = runAggregateConversionPromotion({
      context: ctx,
      exploratoryCandidate,
      readinessVeto: {
        ...veto,
        vetoedWinnerSource: 'milp',
        vetoedCandidateId: null,
        vetoedCandidateLabel: null,
      },
    })
    if (run.status !== 'notPromoted') {
      throw new Error(`expected no promotion, got ${run.status}`)
    }

    if (run.promotion.status !== 'unallocatable') {
      throw new Error(`expected an unallocatable promotion, got ${run.promotion.status}`)
    }
    expect(run.promotion.choice.issues.map((entry) => entry.kind))
      .toEqual(['milpWinnerNotPromotable'])
  })

  it('refuses a scheduled year the vetoed projection published no snapshot for', () => {
    const ctx = contextFor(singleOwnerHousehold())
    const { exploratoryCandidate, veto } = vetoedWinner(ctx, 'bracket-24')
    const strippedYears = veto.vetoedResult.years.map((year) => {
      const stripped = { ...year }
      delete stripped.aggregateRothConversionAllocationBalances
      return stripped
    })
    const run = runAggregateConversionPromotion({
      context: ctx,
      exploratoryCandidate,
      readinessVeto: {
        ...veto,
        vetoedResult: { ...veto.vetoedResult, years: strippedYears },
      },
    })
    if (run.status !== 'notPromoted') {
      throw new Error(`expected no promotion, got ${run.status}`)
    }

    // Fail closed: with no published weights there is no allocation to make,
    // and the Plan's opening balances are not a substitute for them.
    if (run.promotion.status !== 'unallocatable') {
      throw new Error(`expected an unallocatable promotion, got ${run.promotion.status}`)
    }
    expect([...new Set(run.promotion.choice.issues.map((entry) => entry.kind))])
      .toEqual(['missingYearBalances'])
  })
})
