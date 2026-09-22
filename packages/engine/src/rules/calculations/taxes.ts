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
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'cursor' },
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
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'cursor' },
  },
  'projection-summary-estate-heir-tax': {
    title: 'Projection summary estate heir tax',
    purpose: 'Total the per-account heir income tax already resolved in the estate breakdown.',
    kind: 'composition',
    outputs: ['estate-heir-income-tax'],
    feeds: ['projection-summary-ending-after-tax-estate'],
    statement: 'projection/compare.ts#summarizeProjection publishes ending estate heir tax as the sum of every EstateAccountBreakdown.heirTax amount after each account\'s destination, charity carve-out, taxable pre-tax base and heir rate have been applied, in nominal horizon dollars with no stated rounding.',
    formula: {
      expression: 'endingEstateHeirTax = sum over accounts a of estateBreakdown[a].heirTax',
      variables: [
        { symbol: 'estateBreakdown[a].heirTax', meaning: 'Per-account resolved heir income tax', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'projection horizon, once per estate breakdown row',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/projection-summary-estate-heir-tax.md',
    },
    limits: [
      'It sums the already resolved per-account tax rather than recomputing taxable bases or taxing gross balances a second time, and it must not subtract the charity amount again from the resolved total. Disclosed discrepancy: on the worksheet\'s own account inputs the engine publishes 56,320.00 where the worksheet expects 61,600.00, because the engine multiplies the taxable pre-tax base by one minus the charity fraction before applying the heir rate (240,000 x 0.9 x 0.22 = 47,520.00) while the worksheet\'s traditional row states 52,800.00 (240,000 x 0.22), taxing the whole base and carving charity out of the balance only. The evidence keeps the worksheet\'s expectation and fails.',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: ['packages/engine/src/projection/compare.ts#summarizeProjection'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'projection-summary-lifetime-taxes-and-penalties': {
    title: 'Projection summary lifetime taxes and penalties',
    purpose: 'Sum annual tax and annual penalties over the whole projection.',
    kind: 'composition',
    outputs: ['projection-summary-lifetime-taxes-and-penalties'],
    feeds: ['swr-rule-result-lifetime-taxes-and-penalties', 'scenario-comparison-cell'],
    statement: 'projection/compare.ts#summarizeProjection sums nominal YearResult.tax + YearResult.penalties across every projection year to publish lifetime taxes and penalties, with no stated rounding.',
    formula: {
      expression: 'L = sum over years y of (tax_y + penalties_y)',
      variables: [
        { symbol: 'tax_y', meaning: 'Year y published tax', unit: 'nominal USD', domain: 'nonnegative' },
        { symbol: 'penalties_y', meaning: 'Year y published penalties, separate from tax', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'every projection year',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/projection-summary-lifetime-taxes-and-penalties.md',
    },
    limits: [
      'Penalties are a separate ledger field from tax, so summing taxes only, or adding penalties in the final year alone, understates the published figure. The valid domain is a finite projection-year sequence with finite annual dollar fields.',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: ['packages/engine/src/projection/compare.ts#summarizeProjection'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'relocation-lifetime-state-local-tax': {
    title: 'Relocation lifetime state local tax',
    purpose: 'Total one candidate row\'s recorded annual state and local income tax.',
    kind: 'composition',
    outputs: ['relocation-lifetime-state-local-tax'],
    feeds: ['insight-state-relocation-lifetime-state-tax-savings', 'scenario-comparison-cell'],
    statement: 'projection/relocation.ts#compareRelocationCandidates sums a row\'s recorded nominal per-year state-plus-local income-tax lines over the complete projection to publish that candidate\'s lifetime state and local tax, with no stated rounding.',
    formula: {
      expression: 'lifetimeStateLocalTax = sum over years y of stateTaxByYear[y].tax',
      variables: [
        { symbol: 'stateTaxByYear[y].tax', meaning: 'Recorded state plus local income tax for year y', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'every recorded projection year of the row',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/relocation-lifetime-state-local-tax.md',
    },
    limits: [
      'Scope is income tax only: federal tax, property tax, sales tax and cost of living are outside this quantity, the annual lines are nominal and are never discounted, and dropping the split or baseline year understates the total. The worksheet\'s per-year lines are supplied by a deterministic state-tax calculator injected at the createStateTaxCalculator seam, so the recording, the row assembly and the sum are the real code path while the state packs themselves are not exercised here.',
    ],
    implementedBy: ['packages/engine/src/projection/relocation.ts'],
    implementedByFunctions: ['packages/engine/src/projection/relocation.ts#compareRelocationCandidates'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'relocation-state-tax-driver-savings': {
    title: 'Relocation state tax driver savings',
    purpose: 'Attribute lifetime state-tax savings to one neutralized state feature at a time.',
    kind: 'composition',
    outputs: ['relocation-state-tax-driver-savings'],
    feeds: [],
    statement: 'projection/relocation.ts#computeDrivers publishes each destination-state driver saving in nominal lifetime dollars as the sum of state-plus-local tax with that one feature neutralized minus the sum actually modeled, with public-pension savings fixed at zero when the state uses one shared retirement rule.',
    formula: {
      expression: 'savings_d = sum over years y of (tax_neutralized(d, y) - tax_actual(y))',
      variables: [
        { symbol: 'tax_neutralized(d, y)', meaning: 'Year y tax re-priced with feature d neutralized', unit: 'nominal USD', domain: 'nonnegative' },
        { symbol: 'tax_actual(y)', meaning: 'Year y tax the ledger actually charged', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'every recorded tax year, one feature at a time',
      rounding: 'none stated; capital-gains savings may be negative',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/relocation-state-tax-driver-savings.md',
    },
    limits: [
      'Changing one feature at a time makes this an attribution, not an additive decomposition: the four savings are not guaranteed to sum to total tax, and capital-gains savings are explicitly allowed to be negative. Reversing the counterfactual subtraction flips every sign. No result is claimed for unmodeled or flat-override rows, whose drivers are null. The pin is a non-exported helper, so the evidence asserts it through the exported compareRelocationCandidates, with the worksheet\'s actual and neutralized year tables supplied by a calculator injected at the createStateTaxCalculator seam; any probe outside those tables fails closed.',
    ],
    implementedBy: ['packages/engine/src/projection/relocation.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/relocation.ts#computeDrivers',
      'packages/engine/src/projection/relocation.ts#compareRelocationCandidates',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'scenario-lifetime-tax-and-penalties': {
    title: 'Scenario lifetime tax and penalties',
    purpose: 'Total each scenario side\'s annual tax and annual penalties as two separate channels.',
    kind: 'composition',
    outputs: ['scenario-lifetime-tax', 'scenario-lifetime-penalties'],
    feeds: ['scenario-comparison-cell'],
    statement: 'scenarios/comparison.ts#compareScenarioPlans separately sums nominal annual YearResult.tax and YearResult.penalties for each scenario side, then places each baseline/proposal total in its comparison cell without mixing the two channels.',
    formula: {
      expression: 'lifetimeTax_s = sum over years y of tax_{s,y}; lifetimePenalties_s = sum over years y of penalties_{s,y}',
      variables: [
        { symbol: 'tax_{s,y}', meaning: 'Side s, year y published tax', unit: 'nominal USD', domain: 'nonnegative' },
        { symbol: 'penalties_{s,y}', meaning: 'Side s, year y published penalties', unit: 'nominal USD', domain: 'nonnegative' },
      ],
      timing: 'every projection year of each side',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/scenario-lifetime-tax-and-penalties.md',
    },
    limits: [
      'Penalties are excluded from tax by the result-type contract, so folding them into the tax channel changes both totals, and the delta belongs to the separate comparison-cell identity rather than to these side totals. The worksheet\'s annual tax and penalty rows for both sides are supplied as ProjectionResult literals at the simulate seam; the aggregation and the comparison assembly are the real functions.',
    ],
    implementedBy: ['packages/engine/src/scenarios/comparison.ts'],
    implementedByFunctions: ['packages/engine/src/scenarios/comparison.ts#compareScenarioPlans'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
