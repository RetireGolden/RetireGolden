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
  'rmd/applicableAge.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'Law-derived 70\u00bd/July-1949 and age-72 cohort limbs plus IRA RBD-year derivation are registered at treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72 (enforcing applicableAgeAttainYears and deriveRbdComparison). Born-1959 contest, including deriveRbdComparison\'s conditional comparison/refusal, is now registered at treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959 (adding deriveRbdComparison only; applicableAgeAttainYears sibling listings on treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72, irc-401-a-9-C-v-applicable-age, and treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy unchanged). SECURE 2.0 73/75 tiers on irc-401-a-9-C-v-applicable-age; QCD month-end 70\u00bd on irc-408-d-8-B-ii-age-70-half. Residual: year-granular death-vs-RBD still consumes an asserted RBD-status fact when death falls in the RBD calendar year and does not observe an exact death date inside that year' }),
  'rmd/jointLifeTable.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-25', note: null }),
  'rmd/rmd.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'rmd/rmdApplicablePlanForAccount.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-01', note: null }),
  'rmd/rmdShortfallExcise.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
