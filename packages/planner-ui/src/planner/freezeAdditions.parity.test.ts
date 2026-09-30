/**
 * B2-P1 parity for the five UI figures the output census froze as pending on
 * 2026-09-30: each now comes from the engine, and on the example library each
 * is the page's retired arithmetic (kept here, nowhere else) bit for bit, so
 * no printed figure changes.
 *
 * - Household map "As entered": model/enteredBalanceSheet.ts#enteredBalanceSheet
 *   against the retired sumEnteredTotals over the graph's nodes, for the
 *   household, for each person's focus and with each group hidden.
 * - Monte Carlo: MonteCarloSummary.medianFirstDepletionYear and
 *   .lastingPathCount against the Why panel's retired walk and subtraction,
 *   and downsideRisk.failingPathCount against the depletion chart label's
 *   retired sum of the year counts.
 * - Social Security bridge: ladder/bridge.ts#bridgeLaddersTotalCost against
 *   the bridge panel's retired reduce, over the bridges the panel offers.
 * - Downloadable report: projection/candidateTrailingEstate.ts against the
 *   retired lossReasonForCandidate, every candidate row's sentence.
 */
import { describe, expect, it } from 'vitest'

import { bridgeLaddersTotalCost, sizeBridge, type BridgeSizing } from '@retiregolden/engine/ladder/bridge'
import { aggregateMonteCarlo, runMonteCarloPaths, type MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { createMarketModel } from '@retiregolden/engine/montecarlo/marketModels'
import { DEFAULT_MONTE_CARLO_SEED } from '@retiregolden/engine/montecarlo/rng'
import { EMBEDDED_REAL_YIELD_CURVE } from '@retiregolden/engine/params'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { ExactLedgerTournamentSummary, ExactLedgerValidation } from '@retiregolden/engine/projection/optimizePlan'
import { buildHouseholdGraph, enteredTotalsOfNodes, type HouseholdNode } from '../householdMap/householdGraph'
import type { MapColumnId } from '../householdMap/layout'
import { buildMapViewModel } from '../householdMap/mapViewModel'
import { runOptimizeRequest } from '../optimize/runOptimize'
import { reportEvidenceFromOptimizeResult } from '../report/reportHtml'
import { appExamplePlans } from '../testSupport/appExamples'
import { acaVetoYears, formatYearList } from './acaVetoCopy'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { fmtMoney, fmtMoneyCompact } from './format'
import { buildModel } from './marketModelPicker'
import { retirementActionReadinessVetoExplanation } from './retirementActionReadinessVetoCopy'
import { claimingPeople, dobParts } from './ssAnalysis'
import { taxCalculatorFor } from './useProjection'
import { HEADLINE_MC_MODEL } from './useMcSuccessRate'

/** householdGraph.ts#sumEnteredTotals as it was until the freeze additions moved into the engine. */
function retiredEnteredTotals(nodes: readonly Pick<HouseholdNode, 'kind' | 'amount' | 'amountKind'>[]) {
  const totals = { investable: 0, property: 0, assets: 0, liabilities: 0, netWorth: 0 }
  for (const n of nodes) {
    if (n.amount === null) continue
    if (n.kind === 'account' && n.amountKind === 'balance') totals.investable += n.amount
    else if (n.kind === 'property' && n.amountKind === 'value') totals.property += n.amount
    else if (n.kind === 'debt' && n.amountKind === 'owed') totals.liabilities += n.amount
  }
  totals.assets = totals.investable + totals.property
  totals.netWorth = totals.assets - totals.liabilities
  return totals
}

function expectSameSheet(engine: Record<string, number>, retired: Record<string, number>, where: string): void {
  for (const key of ['investable', 'property', 'assets', 'liabilities', 'netWorth']) {
    expect(Object.is(engine[key], retired[key]), `${where} ${key}: ${engine[key]} vs ${retired[key]}`).toBe(true)
  }
}

/** explainPanels.tsx#WhySuccessPanel's median walk as it was until the freeze additions. */
function retiredMedianDepletion(summary: MonteCarloSummary): number | null {
  const failing = summary.downsideRisk.failingPathCount
  const depletions = summary.depletionYearCounts
  if (failing === 0) return null
  let seen = 0
  for (const row of depletions) {
    seen += row.count
    if (seen >= failing / 2) return row.year
  }
  return depletions[depletions.length - 1]?.year ?? null
}

/** The bridges SsAnalysisPage.tsx#BridgePanel lists: one per delaying claimant whose window no plan ladder covers. */
function offeredBridges(plan: Plan): BridgeSizing[] {
  const startYear = EXAMPLE_FIXED_YEAR
  const out: BridgeSizing[] = []
  for (const { person, stream, pia } of claimingPeople(plan, startYear)) {
    const { y, m, d } = dobParts(person)
    const bridge = sizeBridge({
      piaMonthly: pia,
      dob: { year: y, month: m, day: d },
      claimAge: stream.claimAge,
      currentYear: startYear,
      retirementYear: person.retirementAge !== null ? y + person.retirementAge : startYear,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    if (!bridge) continue
    if (plan.incomeFloor?.ladders.some((l) => l.startYear <= bridge.startYear && l.endYear >= bridge.endYear)) continue
    out.push(bridge)
  }
  return out
}

/** reportHtml.ts#lossReasonForCandidate as it was until the freeze additions moved its gap into the engine. */
function retiredLossReason(
  tournament: ExactLedgerTournamentSummary,
  validation: ExactLedgerValidation | null,
  candidate: ExactLedgerTournamentSummary['candidates'][number],
): string {
  if (tournament.winnerCandidateId === candidate.id) return 'Selected winner on the full year-by-year projection.'
  const readinessVeto = tournament.retirementActionReadinessVeto
  if (
    readinessVeto?.vetoedCandidateId === candidate.id ||
    (readinessVeto?.vetoedWinnerSource === 'milp' && candidate.id === 'milp-cleaned-schedule')
  ) {
    return retirementActionReadinessVetoExplanation(readinessVeto, tournament.retirementActionPromotion)
  }
  if (candidate.afterTaxEstateDelta <= 1) return 'Did not improve after-tax estate over the current plan.'
  if (tournament.acaActionabilityVeto?.vetoedCandidateIds.includes(candidate.id)) {
    const years = acaVetoYears(tournament.acaActionabilityVeto)
    return (
      `Not presented as actionable: the projection's ACA evidence for ${formatYearList(years)} could not be ` +
      `priced, so this estate delta omits the ACA effect in ${years.length === 1 ? 'that year' : 'those years'}.`
    )
  }
  const benchmark = validation?.afterTaxEstateDelta ?? Math.max(0, ...tournament.candidates.map((row) => row.afterTaxEstateDelta))
  if (benchmark > candidate.afterTaxEstateDelta) {
    return readinessVeto
      ? `Trailed the calculated winner by ${fmtMoney(benchmark - candidate.afterTaxEstateDelta)}; that winner was withheld pending account allocation.`
      : `Trailed the selected recommendation by ${fmtMoney(benchmark - candidate.afterTaxEstateDelta)}.`
  }
  if (readinessVeto) {
    return 'Not selected under the active objective and guardrails; the calculated winner was withheld pending account allocation.'
  }
  if (tournament.winnerSource === 'incumbent') return 'The current conversion strategy remained the top-ranked result found.'
  if (tournament.winnerSource === 'none') return 'No candidate cleared the recommendation threshold.'
  return 'Not selected under the active objective and guardrails.'
}

const GROUPS: readonly MapColumnId[] = ['income', 'accounts', 'propertyDebt', 'protection']

describe('the census freeze additions on the example library (B2-P1)', () => {
  it('household map: the entered totals are the retired node sums, for the household, each person and each hidden group', () => {
    let views = 0
    for (const { id, plan } of appExamplePlans()) {
      const graph = buildHouseholdGraph(plan)
      expectSameSheet({ ...graph.totals }, retiredEnteredTotals(graph.nodes), `${id} household`)
      const scopes = [
        ...plan.household.people.map((person) => ({ name: person.name, options: { focusPersonId: person.id } })),
        ...GROUPS.map((hidden) => ({ name: `without ${hidden}`, options: { visibleColumns: GROUPS.filter((g) => g !== hidden) } })),
      ]
      for (const scope of scopes) {
        const vm = buildMapViewModel(graph, scope.options)
        const shown = graph.nodes.filter((node) => vm.nodes.some((v) => v.id === node.id))
        const retired = retiredEnteredTotals(shown)
        const sheet = vm.scope === 'household' ? graph.totals : enteredTotalsOfNodes(graph, new Set(shown.map((node) => node.id)))
        expectSameSheet({ ...sheet }, retired, `${id} ${scope.name}`)
        expect(vm.totals, `${id} ${scope.name} text`).toEqual({
          assetsText: fmtMoney(retired.assets),
          liabilitiesText: fmtMoney(retired.liabilities),
          netWorthText: fmtMoney(retired.netWorth),
        })
        views += 1
      }
    }
    expect(views).toBeGreaterThan(appExamplePlans().length * GROUPS.length)
  })

  it('Monte Carlo: the median first-depletion year and the lasting and depleted counts are the retired page arithmetic', () => {
    let failingExamples = 0
    for (const { id, plan } of appExamplePlans()) {
      const summary = aggregateMonteCarlo(
        runMonteCarloPaths(plan, {
          startYear: EXAMPLE_FIXED_YEAR,
          taxCalculator: taxCalculatorFor(plan),
          model: createMarketModel(
            buildModel(HEADLINE_MC_MODEL.kind, plan.assumptions.inflationPct, HEADLINE_MC_MODEL.returnVolPct, HEADLINE_MC_MODEL.equityWeightPct, plan),
          ),
          seed: DEFAULT_MONTE_CARLO_SEED,
          pathCount: 100,
        }),
      )
      const failing = summary.downsideRisk.failingPathCount
      expect(summary.medianFirstDepletionYear, `${id} median`).toBe(retiredMedianDepletion(summary))
      expect(summary.lastingPathCount, `${id} lasting`).toBe(summary.pathCount - failing)
      expect(failing, `${id} depleted`).toBe(summary.depletionYearCounts.reduce((a, r) => a + r.count, 0))
      if (failing > 0) failingExamples += 1
    }
    // Some examples run out on some paths and some never do, so both branches are read.
    expect(failingExamples).toBeGreaterThan(0)
    expect(failingExamples).toBeLessThan(appExamplePlans().length)
  }, 600_000)

  it('Social Security bridge: the add-ladders total is the retired reduce, and prints the same', () => {
    let offered = 0
    let pairs = 0
    for (const { id, plan } of appExamplePlans()) {
      const bridges = offeredBridges(plan)
      const retired = bridges.reduce((sum, bridge) => sum + bridge.ladderCost, 0)
      const total = bridgeLaddersTotalCost(bridges)
      expect(Object.is(total, retired), `${id}: ${total} vs ${retired}`).toBe(true)
      expect(fmtMoneyCompact(total), id).toBe(fmtMoneyCompact(retired))
      if (bridges.length > 0) offered += 1
      if (bridges.length > 1) pairs += 1
    }
    expect(offered).toBeGreaterThan(0)
    expect(pairs).toBeGreaterThan(0)
  })

  it('downloadable report: every candidate row reads the sentence and the gap the retired function printed', async () => {
    let trailing = 0
    for (const { id, plan } of appExamplePlans()) {
      const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR })
      const tournament = result.tournament
      const validation = tournament.winnerValidation ?? tournament.retirementActionReadinessVeto?.vetoedValidation ?? null
      const evidence = reportEvidenceFromOptimizeResult(result, plan.household.people)
      tournament.candidates.forEach((candidate, index) => {
        const row = evidence.candidates[index]!
        expect(row.candidateId, id).toBe(candidate.id)
        expect(row.lossReason, `${id} ${candidate.id}`).toBe(retiredLossReason(tournament, validation, candidate))
        if (row.lossReason.startsWith('Trailed')) trailing += 1
      })
    }
    expect(trailing).toBeGreaterThan(0)
  }, 1_800_000)
})
