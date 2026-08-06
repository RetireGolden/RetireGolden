import { describe, expect, it } from 'vitest'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { runExactLedgerTournament } from '@retiregolden/engine/projection/optimizePlan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'

import {
  OWL_PARITY_FIXTURES,
  buildOwlParityManifest,
  evaluateOwlParityGate,
  owlCaseFiles,
  priceOwlScheduleOnRetireGoldenLedger,
  retireGoldenParityBenchmarkConversions,
  stableOwlParityManifestJson,
  type OwlRunnerSummary,
} from './owlParity'

function skippedOwlSummary(): OwlRunnerSummary {
  return {
    status: 'skipped',
    reason: 'test skip',
    owl: {
      repository: 'https://github.com/mdlacasse/Owl',
      pinnedCommit: null,
      verifiedPinnedCommit: false,
      invocation: 'none',
    },
    artifacts: OWL_PARITY_FIXTURES.map((fixture) => ({
      fixtureId: fixture.id,
      status: 'skipped',
      conversions: [],
      withdrawals: [],
      selfReportedEndingWealth: null,
      selfReportedLifetimeTax: null,
      warnings: ['Owl unavailable in test.'],
    })),
  }
}

describe('Owl parity oracle harness', () => {
  it('prices a readiness-vetoed calculated schedule without republishing it as actionable', () => {
    const calculated = [{ year: 2026, amount: 25_000 }]
    const tournament = {
      winnerConversions: [],
      retirementActionReadinessVeto: { vetoedConversions: calculated },
    }

    expect(retireGoldenParityBenchmarkConversions(tournament as never)).toEqual(calculated)
    expect(tournament.winnerConversions).toEqual([])
  })

  it('still reads the vetoed schedule on every fixture, because none records an IRA classification', () => {
    // WHY THIS EXISTS. The optimizer now promotes a vetoed aggregate winner
    // into identity-bearing conversion requests and publishes THAT when it
    // earns a recommendation, which lifts the veto and would silently switch
    // what `retireGoldenParityBenchmarkConversions` benchmarks -- from the
    // calculated aggregate schedule to the promoted one. The two are different
    // schedules whenever promotion reprices, so a silent switch would move the
    // parity baseline for a reason that has nothing to do with Owl.
    //
    // It does not switch here, and this is the measurement rather than the
    // argument. The named-conversion executor requires the Plan to have
    // classified its source IRA; the aggregate ledger requires nothing of the
    // sort. No parity fixture records that evidence, so every promotion is
    // priced and then declined by the ledger -- `notComparable` -- the veto
    // stands, and the benchmark keeps reading exactly what it read before.
    //
    // A fixture that later gains classification evidence will fail here rather
    // than move the baseline quietly, and re-baselining is then a deliberate
    // act with a stated reason.
    for (const fixture of OWL_PARITY_FIXTURES) {
      const plan = fixture.plan
      const options = {
        startYear: 2026,
        taxCalculator: combineTaxCalculators(
          createFederalTaxCalculator(),
          createStateTaxCalculator({
            overridePct: plan.assumptions.stateEffectiveTaxPct,
            localPct: plan.assumptions.localIncomeTaxPct,
          }),
        ),
      }
      const tournament = runExactLedgerTournament(
        plan,
        simulatePlan(plan, options),
        null,
        options,
      )

      expect(plan.retirementActionEligibilityFacts?.iraClassifications ?? []).toEqual([])
      expect(tournament.retirementActionPromotion?.outcome).toBe('notComparable')
      expect(tournament.retirementActionReadinessVeto).not.toBeNull()
      expect(retireGoldenParityBenchmarkConversions(tournament))
        .toEqual(tournament.retirementActionReadinessVeto?.vetoedConversions)
      expect(tournament.winnerConversions).not.toEqual(
        tournament.retirementActionReadinessVeto?.vetoedConversions,
      )
    }
  })

  it('converts every fixture plan to a deterministic Owl TOML case', () => {
    const files = owlCaseFiles()

    expect(files.map((file) => file.fixtureId)).toEqual(OWL_PARITY_FIXTURES.map((fixture) => fixture.id))
    expect(files[0]!.toml).toEqual(owlCaseFiles()[0]!.toml)
    for (const file of files) {
      expect(file.toml).toContain('[basic_info]')
      expect(file.toml).toContain('[savings_assets]')
      expect(file.toml).toContain('[solver_options]')
      expect(file.toml).toContain('units = "1"')
      expect(file.toml).toContain('gap = 0.0001')
      expect(file.toml).not.toContain('undefined')
    }
    expect(files[0]!.toml).toContain('tax_deferred_savings_balances = [1180]')
  })

  it('generates Owl TOML for the requested start year', () => {
    const toml = owlCaseFiles(undefined, { startYear: 2027 })[0]!.toml

    expect(toml).toContain('start_date = "2027-01-01"')
    expect(toml).toContain('startRothConversions = 2027')
  })

  it('prices an Owl conversion schedule on the RetireGolden exact ledger', () => {
    const fixture = OWL_PARITY_FIXTURES[0]!
    const priced = priceOwlScheduleOnRetireGoldenLedger(fixture.plan, [
      { year: 2026, amount: 25_000 },
      { year: 2027, amount: 25_000 },
    ])

    expect(priced.summary.endingAfterTaxEstate).toBeGreaterThan(0)
    expect(priced.validation?.requestedConversionTotal).toBe(50_000)
    expect(priced.validation?.executedConversionTotal).toBeGreaterThan(0)
  })

  it(
    'emits stable skipped manifests when Owl is unavailable',
    async () => {
      const summary = skippedOwlSummary()
      const a = await buildOwlParityManifest({ owlRunner: summary })
      const b = await buildOwlParityManifest({ owlRunner: summary })

      expect(a.gate.status).toBe('skipped')
      expect(stableOwlParityManifestJson(a)).toEqual(stableOwlParityManifestJson(b))
    },
    // Two full RetireGolden optimizer passes over all six fixtures with the
    // production search budget + convergence loop — well over the default 5s.
    180_000,
  )

  it('fails the gate when RetireGolden trails Owl beyond tolerance', () => {
    const gate = evaluateOwlParityGate(
      [
        {
          id: 'fixture',
          name: 'Fixture',
          tags: [],
          mappingNotes: [],
          owlCaseFile: 'fixture.toml',
          retireGolden: {
            endingAfterTaxEstate: 100_000,
            lifetimeTaxesAndPenalties: 10_000,
            conversions: [],
            recommendationState: 'neutral',
            warnings: [],
          },
          owl: {
            status: 'solved',
            selfReportedEndingWealth: 110_000,
            selfReportedLifetimeTax: 9_000,
            conversions: [],
            withdrawals: [],
            warnings: [],
            error: null,
          },
          owlOnRetireGoldenLedger: {
            endingAfterTaxEstate: 110_000,
            lifetimeTaxesAndPenalties: 9_000,
            recommendationState: 'beneficial',
            warnings: [],
          },
          comparison: {
            status: 'compared',
            estateDeltaDollars: -10_000,
            lifetimeTaxDeltaDollars: 1_000,
            toleranceDollars: 1_000,
            pass: false,
          },
        },
      ],
      false,
    )

    expect(gate.status).toBe('failed')
    expect(gate.failingFixtureIds).toEqual(['fixture'])
  })
})
