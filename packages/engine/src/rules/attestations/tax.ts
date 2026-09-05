/**
 * Coverage attestations for `tax/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const taxAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'tax/aca.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'tax/aggregateBasisSale.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'tax/annualCharitableDeductionParameters.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: null }),
  'tax/federalTax.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-26', note: 'implements §86 SS inclusion, NIIT, AMT screen, senior-deduction phase-out, LTCG stacking with records naming it, but §170(b)(1)(I)(i)-(vi) category waterfall is applied only in the ledger file its record names' }),
  'tax/medicare.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-27', note: 'Part B/IRMAA premium path and Part B late-enrollment absence registered (usc-42-1395r-*, cfr-20-418-1205-1230-*); post-pack premiumScale (healthcare-inflation stand-in) remains' }),
  'tax/ordinaryFederalFilingDeadline.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-04', note: null }),
  'tax/propertySale.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'Section 121/1250 records name this file; the universal loss floor is registered as the approximated irc-165-c-personal-use-sale-loss-nondeductible - exact for personal-use property, overstating tax where an investment-property loss would deduct' }),
  'tax/stateTax.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
