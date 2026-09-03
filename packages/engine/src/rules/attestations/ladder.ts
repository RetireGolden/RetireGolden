/**
 * Coverage attestations for `ladder/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const ladderAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'ladder/bridge.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'The bridge sizes spending from age 62 to the claim age; the 62-70 worker window is registered under usc-42-402-worker-claim-window-62-to-70 at the claim factor, and this file calls that factor rather than enforcing the window itself' }),
  'ladder/fedInvest.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'ladder/fundedRatio.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'ladder/ladderMath.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-27', note: 'TIPS OID/deflation and §171 premium absence registered (treas-reg-1-1275-7-f-1-deflation-adjustment-income, treas-reg-1-1275-7-f-2-deflation-basis-decrease-not-modeled, treas-reg-1-1275-7-f-3-tips-acquisition-premium, irc-171-tips-bond-premium-amortization); statutory 0.125% min coupon and par-yield pricing conventions remain' }),
})
