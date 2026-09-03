/**
 * Coverage attestations for `rmd/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const rmdAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'rmd/applicableAge.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'Named by treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy; the born-1959 record\'s contraryReading now records what the full IRB text of Announcement 2026-7 shows - it defers final regulations amending 1.401(a)(9)-4, -5, and -6 and never mentions paragraph (b)(2)(v) or the 1959 cohort, so no current guidance addresses the contest; residual: the RBD April-1 arm (this module consumes an asserted RBD-status fact) and the 70\u00bd/July-1949 cohort tiers pending a pre-SECURE historical-edition record' }),
  'rmd/jointLifeTable.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-25', note: null }),
  'rmd/rmd.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'rmd/rmdApplicablePlanForAccount.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-01', note: null }),
  'rmd/rmdShortfallExcise.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
