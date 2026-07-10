import { describe, expect, it } from 'vitest'

import {
  OWL_PARITY_FIXTURES,
  buildOwlParityManifest,
  evaluateOwlParityGate,
  owlCaseFiles,
  priceOwlScheduleOnRetireGoldenLedger,
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
