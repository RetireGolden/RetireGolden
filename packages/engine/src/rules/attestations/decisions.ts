/**
 * Coverage attestations for `decisions/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const decisionsAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'decisions/annuitization.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/decisionFixtures.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-29', note: 'fixture builder with no non-test importer; the 73 is a comment on a date of birth, not an operative threshold - same footing as testing/planFixtures.ts' }),
  'decisions/evaluateCandidate.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/generators.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'QLAC 85 ceiling registered via treas-reg-1-401-a-9-6-q-1-ii-qlac-commences-by-the-85th-birthday; SS_GRID_CLAIM_AGES now registered under usc-42-402-worker-claim-window-62-to-70; the bracket-target list is a search-space choice, not a rule claim' }),
  'decisions/index.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/insightsAdapter.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/objectives.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'bridge filter consumes rmdStartAgeForBirthYear (cohort defect fixed 2026-08-29); registered via irc-401-a-9-C-v-applicable-age naming bridgeYearFilter' }),
  'decisions/ordinaryWithdrawalCandidateAdapter.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/pensionElection.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-24', note: 'Tax-free direct rollover into traditional IRA; no record' }),
  'decisions/qcdCandidateAdapter.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/retirementActionCandidateSchedule.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/rothConversionCandidateAdapter.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'same-owner destination gate registered under irc-408-d-3-A-i; the dated-intent gate remains unregistered' }),
  'decisions/search.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/spendingSolver.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/spiaQuotes.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/stochastic.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/swrComparator.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/tournament.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'decisions/types.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
