/** Calculation catalog slice; independent worksheet claims, including disclosed discrepancies. */
import type { CalculationRecord } from '../calculationRegistry.js'

export const taxesRecords = {
  'conversion-tax-funding-gcd-reduction': {
    title: 'Conversion tax funding gcd reduction',
    purpose: 'Represent exact rational tax-funding cents in canonical lowest terms.',
    kind: 'formula',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement: 'actions/conversionTaxFundingEvidence.ts#reducedConversionTaxFundingExactCentAmount reduces a nonnegative exact rational cent amount N/D by gcd(N,D) to a unique lowest-terms numerator and denominator, returning null for a negative numerator, nonpositive denominator, or reduced fields outside the safe-integer domain.',
    formula: {
      expression: 'g=gcd(N,D); reduced=(N/g,D/g)',
      variables: [
        { symbol: 'N', meaning: 'Exact amount numerator', unit: 'cent-numerator', domain: 'integer >= 0' },
        { symbol: 'D', meaning: 'Exact amount denominator', unit: '1', domain: 'integer > 0' },
      ],
      timing: 'one exact liability evidence amount',
      rounding: 'none; canonical integer ratio',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/conversion-tax-funding-gcd-reduction.md',
    },
    limits: [
      'No direct census family: internal/counterfactualAnnualLiability.ts consumes the reducer when converting an annual liability into exact-cent evidence. tax-total-annual is the nearest liability family; the reduced pair is not a published tax. Invalid domain or unsafe reduced fields return null.',
    ],
    implementedBy: ['packages/engine/src/actions/conversionTaxFundingEvidence.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/conversionTaxFundingEvidence.ts#reducedConversionTaxFundingExactCentAmount',
    ],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'unreviewed' },
  },
  'parameter-provenance-catalog': {
    title: 'Parameter provenance catalog',
    purpose: 'Preserve the ordered source catalog that accompanies parameter assumptions.',
    kind: 'data',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement: 'params/provenance.ts#PARAMETER_PROVENANCE is a human-maintained ordered catalog of 15 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.',
    formula: null,
    justification: {
      kind: 'dataset',
      source: {
        citation: 'RetireGolden parameter provenance catalog; DOCS/calculations/taxes/parameter-provenance-catalog.md, extracted 2026-09-14',
        url: 'https://github.com/RetireGolden/RetireGolden/blob/33e7d546/packages/engine/src/params/provenance.ts',
        asOf: '2026-09-14',
        retrievedOn: '2026-09-17',
        rights: 'Project-owned catalog under AGPL-3.0; factual links and figures attributed to per-entry publishers. Linked reuse terms not audited.',
      },
      transformation: 'Human summarization of linked authorities; digest is SHA-256 of the worksheet\'s ordered 15-ID array encoded as compact UTF-8 JSON. Extraction date is not a shared authority retrieval date.',
      digest: 'sha256:725dc0b045b4379f8c51408ea0fcb484ad69d689979f3f1a1db5b66b68d163cb',
    },
    limits: [
      'No direct census family: actions/annualQcdTaxCharacterPostPass.ts reads the rmd-qcd entry as source provenance for QCD tax-character evidence feeding annual tax. This is a metadata dependency, not a numerical tax formula. The worksheet checks ordered IDs, count and uniqueness, not correctness or freshness of the summaries. Per-entry authorities need independent verification on refresh.',
    ],
    implementedBy: ['packages/engine/src/params/provenance.ts'],
    implementedByFunctions: ['packages/engine/src/params/provenance.ts#PARAMETER_PROVENANCE'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'unreviewed' },
  },
} satisfies Record<string, CalculationRecord>
