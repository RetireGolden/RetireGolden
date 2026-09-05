/**
 * Coverage attestations for `insights/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const insightsAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'insights/detectors/acaThresholdProximity.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/annuitizationHeadroom.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/assetLocation.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/hecmBufferCandidate.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'The age-62 gate is registered under usc-12-1715z-20-b-hecm-minimum-age-62 - the registry\'s first Title 12 record, admitted on the same enforcement test as its Title 42 and POMS records' }),
  'insights/detectors/incomeFloorFunded.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/irmaaTierEdge.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/lawPackDrift.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/missingDataBasis.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'The detector consumes the shared ROTH_QUALIFIED_AGE constant to scope its suggestion; the qualified-distribution rule itself is registered and enforced at the Roth basis records, which do not name this consumer' }),
  'insights/detectors/pensionElectionPending.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/qcdEfficiency.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/rothBridgeHeadroom.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'the hardcoded 73 the prior note flagged is fixed (2026-08-29): the detector consumes rmdStartAgeForBirthYear and is registered via irc-401-a-9-C-v-applicable-age' }),
  'insights/detectors/spendingGuardrails.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/spendingHeadroom.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/ssBridgeGap.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/ssClaimMilestone.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'former-spouse eligibility delegates to registered bestMaritalBenefit; claim-factor, payable-month, and family-max are delegated. Current-spouse prior-year reconstruction re-derives statutory half-PIA (0.5 * PIA * spousalBenefitFactor) without a record pin. Pre-horizon own/former amount reconstruction plus enabling-event and missing-PIA fallback remain insight timing conventions' }),
  'insights/detectors/stalePlanData.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/stateRelocation.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/detectors/widowsPenalty.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/parsePlanUpdatedAtIso.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/registry.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/runInsights.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'insights/types.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
