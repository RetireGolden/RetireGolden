/**
 * Coverage attestations for `schema/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const schemaAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'schema/generate.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'schema/index.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'schema/current.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-01', note: 'package entry point' }),
  'schema/plan.v1.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'generated file' }),
  'schema/plan.v2.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'generated file' }),
  'schema/plan.v3.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'generated file' }),
  'schema/plan.v4.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'generated file' }),
  'schema/plan.v5.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-31', note: 'generated file' }),
  'schema/planSchemaMeta.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
