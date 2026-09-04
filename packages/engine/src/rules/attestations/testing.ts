/**
 * Coverage attestations for `testing/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const testingAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'testing/decisionFixtures.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-04', note: 'fixture builder with no non-test importer; the 73 is a comment on a date of birth, not an operative threshold - same footing as testing/planFixtures.ts; moved here from decisions/ in 0.3.0 so the directory matches the packaging, and published on testing/decisionFixtures for consumers writing decision-engine tests' }),
  'testing/flatTax.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-30', note: 'flat-rate test double injected only by test suites - the sole non-test importers are the deprecated projection/flatTax shim that republishes it on the published subpath and the pack-smoke script that verifies that subpath - so no RetireGolden code path injects it outside tests and the IRC 86 85 percent inclusion it applies never reaches a user-facing number; it is published, at testing/flatTax and through the deprecated projection/flatTax subpath, so an external consumer can call it directly; kept partial rather than rule-free so the claim stays visible if the file ever gains a production consumer' }),
  'testing/money.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'testing/planFixtures.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
