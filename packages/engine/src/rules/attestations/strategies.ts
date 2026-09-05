/**
 * Coverage attestations for `strategies/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const strategiesAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'strategies/accountEligibility.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-25', note: 'SECURE 2020 gate portion of S2 treat-as-own election timing not registered to this file' }),
  'strategies/inheritedIra.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'strategies/iraBasis.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'strategies/optimizer.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-04', note: 'Ordinary-bracket PWL registered (irc-1-j-2-progressive-ordinary-rate-schedule); §86 in-solve linearization registered as approximated (irc-86-a-optimizer-taxable-social-security-linearization); senior-deduction phase-out slope registered (irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out) with its omitted cap still outside that record; flat 15% LTCG is registered on projection/optimizePlan.ts (irc-1-h-optimizer-flat-fifteen-percent-preferential-rate). Residual (non-exhaustive): IRMAA binaries, ACA MAGI cap, RMD floors, and other unlisted linearizations/constraints (e.g. state-bracket PWL) remain unregistered here' }),
  'strategies/rothBasis.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'strategies/rothConversion.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-24', note: 'Bracket/IRMAA/ACA FPL/senior-deduction sizing via computeFederalTax; no record names this file' }),
  'strategies/sepp.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
