import { describe, expect, it } from 'vitest'

import { applyScenarioPatch } from '../scenarios/scenarios.js'
import type { Account, Plan } from '../model/plan.js'
import { cashAccount, couplePlan, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import {
  optimizePlan,
  runExactLedgerTournament,
  type ExactLedgerTournament,
} from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

/**
 * What the tournament publishes now that a vetoed aggregate winner is promoted.
 *
 * THE BEHAVIOUR UNDER TEST, in one sentence: a winner whose conversions name
 * nobody is no longer the end of the road — it is allocated to the owners,
 * sources and destinations its own ledger used, priced on its own exact-ledger
 * run, and published as the recommendation when it earns one.
 *
 * THE ONE QUESTION A SURFACE ASKS is `retirementActionReadinessVeto`: null
 * exactly when a schedule was published, non-null exactly when the aggregate
 * winner stayed exploratory. Every case below asserts that pairing alongside
 * the verdict, because a verdict that disagreed with it would be a
 * recommendation nobody could act on or a silence nobody could explain.
 *
 * THE FIXTURES ARE FLAT — zero returns, zero inflation, zero spending, a
 * zero-rate calculator — so the only thing separating the two projections is
 * what promotion itself introduces.
 */

const START_YEAR = 2026
const ALEX = 'p1'
const SAM = 'p2'
const opts = { startYear: START_YEAR, taxCalculator: createFlatTaxCalculator(0) }

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
 * `planSchema` refuses one on an employer account, which is the fact the
 * employer-source fixture turns on.
 */
function iraClassification(sourceAccountId: string) {
  return {
    evidenceId: `${sourceAccountId}-classification`,
    provenance: { source: 'manual' as const },
    sourceAccountId,
    subtype: 'traditional' as const,
  }
}

/** Alex holds the household's only Roth IRA; Sam holds a traditional IRA and no Roth. */
function couple(alexSource: Account, classifiedSources: string[], planningAge = 72): Plan {
  const plan = couplePlan({ p1PlanningAge: planningAge, p2PlanningAge: planningAge })
  plan.id = 'optimizer-veto-lift-couple'
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
    iraClassifications: classifiedSources.map(iraClassification),
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return validatePlan(plan)
}

function solo(): Plan {
  const plan = singlePersonPlan({ planningAge: 70 })
  plan.id = 'optimizer-veto-lift-solo'
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
  return validatePlan(plan)
}

function tournamentFor(plan: Plan): ExactLedgerTournament {
  return runExactLedgerTournament(plan, simulatePlan(plan, opts), null, opts)
}

/**
 * The pairing every case asserts: a published schedule and a lifted veto are
 * the same event, and so are a withheld one and a standing veto.
 */
function assertPublicationPairing(tournament: ExactLedgerTournament): void {
  const promotion = tournament.retirementActionPromotion
  if (promotion === null) return
  const publishes = promotion.outcome === 'equivalent' || promotion.outcome === 'repriced'
  expect(tournament.retirementActionReadinessVeto === null).toBe(publishes)
  if (publishes) {
    expect(tournament.winnerSource).toBe('candidate')
    expect(tournament.winnerValidation?.recommendationState).toBe('beneficial')
  } else {
    expect(tournament.winnerSource === 'incumbent' || tournament.winnerSource === 'none')
      .toBe(true)
  }
}

/**
 * A solver schedule the tournament will treat as its incumbent, priced at a
 * stated after-tax estate delta.
 *
 * Built from a real `optimizePlan` run and then stated explicitly, because the
 * two cases below turn on where the solver's price sits RELATIVE to the
 * promoted candidate's — which is a question about the tournament's
 * arbitration, not about what this particular LP happens to solve to. The
 * eligibility fields are the ones `calculatedPostProcessedSchedule` reads: a
 * stabilized schedule above the minimum whose aggregate validation is
 * `identityIncomplete`, which is the only shape an aggregate solver schedule
 * can have now that the recommendation is withheld from it.
 */
function solverSchedulePricedAt(
  postProcessed: NonNullable<Awaited<ReturnType<typeof optimizePlan>>['postProcessed']>,
  afterTaxEstateDelta: number,
) {
  return {
    ...postProcessed,
    stabilized: true,
    minimumRequestedConversionDollars: 0,
    cleanedValidation: {
      ...postProcessed.cleanedValidation,
      recommendationState: 'identityIncomplete' as const,
      afterTaxEstateDelta,
    },
  }
}

describe('equivalent: the promoted candidate is the recommendation', () => {
  it('publishes the identity-complete schedule the aggregate winner allocated to', () => {
    // A short horizon, so the promoted requests' exact cents and the aggregate
    // ledger's Plan dollars have not had time to part company.
    const plan = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 62)
    const tournament = tournamentFor(plan)
    assertPublicationPairing(tournament)
    const promotion = tournament.retirementActionPromotion
    if (promotion?.outcome !== 'equivalent') {
      throw new Error(`expected an equivalent promotion, got ${promotion?.outcome}`)
    }

    // Published, and published as the promoted candidate rather than as the
    // aggregate winner it came from.
    expect(tournament.retirementActionReadinessVeto).toBeNull()
    expect(tournament.winnerCandidateId).toBe(promotion.candidateId)
    expect(tournament.winnerConversions.length).toBeGreaterThan(0)

    // The equality evidence is what makes `equivalent` a claim rather than a
    // label: every evaluated account, every year, equal to the cent.
    expect(promotion.evidence.equality).toBe('exactMinorUnitByRequiredKey')
    expect(promotion.evidence.quantization).toBe('nearestCentHalfUp')

    // The recommendation is executable: the patch installs exactly the requests
    // the promotion names, and the plan it produces parses.
    expect(promotion.actionRequestIds.length).toBeGreaterThan(0)
    const applied = applyScenarioPatch(plan, promotion.planPatch)
    if (!applied.ok) throw new Error(applied.issues.join('; '))
    expect(applied.plan.strategies.retirementActions.map((action) => action.actionId))
      .toEqual([...promotion.actionRequestIds])

    // Sam holds no Roth IRA, so Sam's share is trimmed -- by the ledger's own
    // policy, charged once against the amount that policy was asked for. That
    // is why naming the owners changed nothing and the evidence exists at all.
    const firstYear = promotion.years[0]!
    expect(firstYear.trims.map((trim) => [trim.ownerPersonId, trim.reason]))
      .toEqual([[SAM, 'ownerHoldsNoRothAccount']])
    expect(firstYear.allocatedCents).toBeLessThan(firstYear.askedCents)
  })

  it('is unmoved by the order the plan happens to list its accounts in', () => {
    const inPlanOrder = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 62)
    const permuted = validatePlan({
      ...inPlanOrder,
      // Same household, same balances, accounts written down back to front.
      accounts: [...inPlanOrder.accounts].reverse(),
    })

    const first = tournamentFor(inPlanOrder)
    const second = tournamentFor(permuted)
    const promotion = first.retirementActionPromotion
    const permutedPromotion = second.retirementActionPromotion
    if (promotion?.outcome !== 'equivalent' || permutedPromotion?.outcome !== 'equivalent') {
      throw new Error('expected both orders to promote equivalently')
    }

    // Plan order decides the owner slices, the destination search and the order
    // sources are drawn from, so a promotion that read it into the ANSWER would
    // mint different requests here. The action IDs are derived from the requests
    // themselves, so equal IDs is the strong form of the claim.
    expect(permutedPromotion.actionRequestIds).toEqual(promotion.actionRequestIds)
    expect(permutedPromotion.candidateId).toBe(promotion.candidateId)
    expect(second.winnerConversions).toEqual(first.winnerConversions)
    expect(permutedPromotion.years).toEqual(promotion.years)
  })
})

describe('repriced: published on its own pricing, the aggregate beside it', () => {
  it('publishes the promoted candidate and keeps the aggregate schedule as diagnostic', () => {
    // The same household over a longer horizon. The aggregate ledger drains in
    // Plan dollars while the promoted request moves exact cents, so a sub-cent
    // residue accumulates until the equality core's nearest-cent quantization
    // stops absorbing it. The projections then genuinely differ -- which is a
    // repricing, not a failure to run.
    const plan = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 72)
    const tournament = tournamentFor(plan)
    assertPublicationPairing(tournament)
    const promotion = tournament.retirementActionPromotion
    if (promotion?.outcome !== 'repriced') {
      throw new Error(`expected a repriced promotion, got ${promotion?.outcome}`)
    }

    expect(tournament.retirementActionReadinessVeto).toBeNull()
    expect(tournament.winnerCandidateId).toBe(promotion.candidateId)

    // THE PRICE IS THE PROMOTED CANDIDATE'S OWN, not the aggregate winner's.
    // The published validation is the one the allocated projection produced,
    // and the aggregate schedule rides along as exploratory diagnostic only.
    expect(tournament.winnerValidation?.recommendationState).toBe('beneficial')
    expect(promotion.aggregateConversions.length).toBeGreaterThan(0)
    expect(tournament.winnerConversions).not.toEqual(promotion.aggregateConversions)

    const applied = applyScenarioPatch(plan, promotion.planPatch)
    if (!applied.ok) throw new Error(applied.issues.join('; '))
    expect(applied.plan.strategies.retirementActions.map((action) => action.actionId))
      .toEqual([...promotion.actionRequestIds])
  })

  it('withholds a repricing that does not clear what it would displace', async () => {
    const plan = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 72)
    const baseline = simulatePlan(plan, opts)
    const published = runExactLedgerTournament(plan, baseline, null, opts)
    const allocatedDelta = published.winnerValidation!.afterTaxEstateDelta

    // A solver schedule priced at exactly what the promoted candidate delivers.
    // The AGGREGATE winner clears it -- which is why the candidate arm is
    // reached at all -- and the promoted candidate, repriced by the residue,
    // does not. Nothing is published, and it is the promotion that says why.
    const solved = await optimizePlan(plan, opts)
    if (solved.postProcessed === null) throw new Error('fixture drift: no solver schedule')
    const tournament = runExactLedgerTournament(
      plan,
      baseline,
      solverSchedulePricedAt(solved.postProcessed, allocatedDelta),
      opts,
      { switchMarginDollars: 0 },
    )
    assertPublicationPairing(tournament)
    const promotion = tournament.retirementActionPromotion
    if (promotion?.outcome !== 'repricedNotRecommended') {
      throw new Error(`expected a withheld repricing, got ${promotion?.outcome}`)
    }

    expect(tournament.retirementActionReadinessVeto).not.toBeNull()
    expect(promotion.allocatedRecommendationState).toBe('beneficial')
    // Beneficial and still not published: a promoted schedule is published
    // because IT wins, never because the aggregate schedule it came from did.
    expect(promotion.years.length).toBeGreaterThan(0)
  })
})

describe('notComparable: the boundary is presented, not a broken recommendation', () => {
  it('withholds when the source is an employer plan the named executor refuses', () => {
    // The shipped example couple's own shape. The aggregate ledger converts
    // employer traditional balances -- `isConvertibleToRoth` admits them, under
    // the still-`approximated` record
    // `irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability`
    // -- and the named executor refuses one, because the Plan records no
    // plan-availability evidence for it and the schema will not even accept an
    // IRA classification on such an account.
    const plan = couple(employer401k('alex-401k', 820_000, ALEX), ['sam-ira'])
    const tournament = tournamentFor(plan)
    assertPublicationPairing(tournament)
    const promotion = tournament.retirementActionPromotion
    if (promotion?.outcome !== 'notComparable') {
      throw new Error(`expected an incomparable promotion, got ${promotion?.outcome}`)
    }

    // NOTHING EXECUTABLE IS PUBLISHED. The aggregate winner stays exploratory
    // and keeps its exact metrics; the veto is what says so.
    expect(tournament.retirementActionReadinessVeto).not.toBeNull()
    expect(tournament.retirementActionReadinessVeto?.vetoedConversions.length)
      .toBeGreaterThan(0)

    // And the boundary is named rather than left as a bare silence: the
    // promotion was minted and priced, and the ledger declined to execute it.
    expect(promotion.reason).toBe('allocatedRankingNotComparable')
    expect(promotion.allocatedRecommendationState).toBe('diagnostic')
    expect(promotion.diagnostics.join(' ')).toContain('conversion-plan-availability-unknown')
  })

  it('is what a plan with no IRA classification evidence gets, unchanged', () => {
    // The named executor needs the Plan to have classified the source IRA; the
    // aggregate ledger needs nothing of the sort. So a plan that has never
    // recorded that evidence keeps exactly the behaviour it had before the lift
    // -- withheld winner, exact metrics retained -- and the promotion says
    // which side declined.
    const classified = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 62)
    const unclassified = validatePlan({
      ...classified,
      retirementActionEligibilityFacts: {
        iraClassifications: [],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      },
    })
    const tournament = tournamentFor(unclassified)
    assertPublicationPairing(tournament)

    expect(tournament.retirementActionPromotion?.outcome).toBe('notComparable')
    expect(tournament.retirementActionReadinessVeto?.reason).toBe('identityIncomplete')
    expect(tournament.winnerSource).toBe('none')
    // The very same household, once the evidence exists, is published -- so the
    // withholding is about the evidence and nothing else.
    expect(tournamentFor(classified).retirementActionReadinessVeto).toBeNull()
  })
})

describe('notPromoted: a solver winner stays exploratory, by a recorded boundary', () => {
  it('records the chooser’s own refusal rather than an unexamined branch', async () => {
    const plan = couple(traditionalIra('alex-ira', 820_000, ALEX), ['alex-ira', 'sam-ira'], 72)
    const baseline = simulatePlan(plan, opts)
    const solved = await optimizePlan(plan, opts)
    if (solved.postProcessed === null) throw new Error('fixture drift: no solver schedule')

    // A switch margin no candidate can clear, so the solver's own schedule is
    // the winner and the veto names `milp`.
    const tournament = runExactLedgerTournament(
      plan,
      baseline,
      solverSchedulePricedAt(
        solved.postProcessed,
        solved.postProcessed.cleanedValidation.afterTaxEstateDelta,
      ),
      opts,
      { switchMarginDollars: Number.MAX_SAFE_INTEGER },
    )
    assertPublicationPairing(tournament)
    const promotion = tournament.retirementActionPromotion
    if (promotion?.outcome !== 'notPromoted') {
      throw new Error(`expected no promotion, got ${promotion?.outcome}`)
    }

    expect(tournament.retirementActionReadinessVeto?.vetoedWinnerSource).toBe('milp')
    // The comparator's optimizer arm wants provenance whose source ID is the
    // allocated candidate's own ID, which the adapter derives from the very
    // requests that would have to carry it. No assignment satisfies it, so the
    // refusal is typed and recorded rather than attempted.
    expect(promotion.issues.map((issue) => issue.kind)).toEqual(['milpWinnerNotPromotable'])
  })
})

describe('a plan the optimizer finds nothing to convert for is untouched', () => {
  it('records no promotion at all, because no winner was vetoed', () => {
    const plan = solo()
    const nothingToConvert = validatePlan({
      ...plan,
      // No traditional balance, so no candidate has a positive schedule and
      // `readinessVetoFor` never fires. The promotion loop must not run, and
      // must not appear on the result as though it had.
      accounts: plan.accounts.filter((account) => account.type !== 'traditional'),
      retirementActionEligibilityFacts: {
        iraClassifications: [],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      },
    })
    const tournament = tournamentFor(nothingToConvert)

    expect(tournament.retirementActionReadinessVeto).toBeNull()
    expect(tournament.retirementActionPromotion).toBeNull()
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerConversions).toEqual([])
  })
})

