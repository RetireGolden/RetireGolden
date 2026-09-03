/**
 * Coverage attestations for `internal/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const internalAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'internal/annualPassAttemptDriver.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'internal/counterfactualAnnualLiability.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'internal/evidenceFormat.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-03', note: null }),
  'internal/iraAnnuityContractValue.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'internal/ownedNonRothIraAnnualAttemptSettlement.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'Its one statutory claim - the retired 408(d)(3)(A)(i) same-owner re-check - is enforced upstream in the runtime source series, where the record now pins it; this module itself enforces no rule and so is not named by any record' }),
  'internal/ownedNonRothIraAnnualReplayPublication.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'internal/ownedNonRothIraContiguousReplay.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'internal/ownedNonRothIraReplayIdentity.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'internal/ownedNonRothIraRuntimeSourceSeries.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'QCD and annuity aggregation were already covered; the same-owner conversion credit refusal (irc-408-d-3-A-i), the inherited-source bar (irc-408-d-3-C-i), and RMD-before-conversion phase ordering (treas-reg-1-408A-4-a-6) are now registered and pinned here' }),
  'internal/simulatorAnnualPassStateRegistry.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-03', note: 'the single capture/restore inventory for the mutable simulator state one annual-pass transaction owns, mapped over keyof SimulatorAnnualPassStateBindings so a named field this file does not register is a compile error. It moves the clone and restore helpers that already lived beside the transaction and decides no tax character, distribution schedule or statutory eligibility; what it fixes is a missing exhaustiveness guard across what used to be five hand-maintained parallel lists. Restore still runs in the interface field order the hand-written restore used. No projection number moves' }),
  'internal/simulatorAnnualPassValueBindingKeys.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
