/** Calculation catalog slice; independent worksheet claims, including disclosed discrepancies. */
import type { CalculationRecord } from '../calculationRegistry.js'

export const taxesRecords = {
  'capital-loss-carryforward-netting': {
    title: 'Capital-loss carryforward netting',
    purpose: 'Spend a capital-loss pool against current gains first, then report the annual ordinary-offset slice on the capital-gain line.',
    kind: 'composition',
    outputs: [
      'tax-loss-carryforward-remaining-annual',
      'tax-loss-carryforward-used-against-gains-annual',
      'tax-loss-carryforward-used-against-ordinary-annual',
    ],
    feeds: ['tax-total-annual', 'display-loss-carryforward-used-annual', 'display-tax-free-gains-room-annual'],
    statement:
      'tax/federalTax.ts#applyCapitalLossCarryforward applies an annual capital-loss pool first against current gains, then reports up to the annual ordinary-offset limit as a negative capital-gain-line amount without changing ordinary income, and carries the unused pool forward. The offset is not capped by ordinary income. Units: nominal USD. Rounding: none.',
    formula: {
      expression:
        'usedAgainstGains = min(C, max(G, 0)); availableLoss = C - usedAgainstGains + max(-G, 0); usedAgainstOrdinary = min(availableLoss, L); netCapitalGain = max(G, 0) - usedAgainstGains - usedAgainstOrdinary; remaining = availableLoss - usedAgainstOrdinary',
      variables: [
        { symbol: 'C', meaning: 'Opening carryforward pool', unit: 'usd', domain: 'nonnegative after the max(0, .) floor' },
        { symbol: 'G', meaning: 'Signed current capital result; a loss is negative', unit: 'usd', domain: 'any finite number' },
        { symbol: 'L', meaning: 'Annual ordinary-offset limit, year2026.federalTax.capitalLossOrdinaryOffsetLimit', unit: 'usd/year', domain: 'nonnegative after the max(0, .) floor' },
      ],
      timing: 'one tax year; the projection threads the depleting pool year to year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/capital-loss-carryforward-netting.md',
    },
    limits: [
      'Ordinary income is never reduced directly: the deductible loss rides the capital-gain line, so subtracting the offset from ordinary income instead publishes a different AGI cascade',
      'One pool, no short-term / long-term split, and the section 1212 preservation of a deduction wasted in a year with no taxable income to absorb it is not modeled; both are stated planning simplifications on the function',
    ],
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: ['packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
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
  'federal-amt-screen': {
    title: 'Federal AMT screen',
    purpose: 'Price the planning-grade alternative minimum tax as tentative minimum tax less regular tax, floored at zero.',
    kind: 'composition',
    outputs: ['tax-amt-annual'],
    feeds: ['tax-total-annual'],
    statement:
      'tax/federalTax.ts#amtExemptionAmount, #amtOrdinaryRateTax, #tentativeMinimumTax and #computeFederalTax compute the 2026 single-filer AMT screen as tentative minimum tax on AMTI after its phased exemption, with preferential-rate awareness, less regular tax but not below zero. With no preferential income the tentative tax is 26% through the 28%-rate threshold and 28% above it. Units: nominal USD. Rounding: none stated.',
    formula: {
      expression:
        "E' = max(0, E - q x max(0, A - P)); X = max(0, A - E'); TMT = 0.26 x min(X, T28) + 0.28 x max(0, X - T28); AMT = max(0, TMT - regularTax)",
      variables: [
        { symbol: 'A', meaning: 'Alternative minimum taxable income (taxable income plus modeled add-backs)', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'E', meaning: 'AMT exemption for the filing status, from the tax parameters', unit: 'usd/year', domain: 'positive' },
        { symbol: 'P', meaning: 'Exemption phase-out start, from the tax parameters', unit: 'usd/year', domain: 'positive' },
        { symbol: 'q', meaning: 'Exemption phase-out rate, from the tax parameters', unit: 'fraction', domain: '0 <= q <= 1' },
        { symbol: 'T28', meaning: '28%-rate threshold on taxable excess, from the tax parameters', unit: 'usd/year', domain: 'positive' },
        { symbol: 'regularTax', meaning: 'Ordinary bracket tax plus stacked preferential tax', unit: 'usd/year', domain: 'nonnegative' },
      ],
      timing: 'one tax year',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/federal-amt-screen.md',
    },
    limits: [
      'A planning screen, not a full Form 6251 claim: modeled add-backs are the section 63(c) standard deduction or itemized SALT plus the section 151 senior deduction, and the rest of the Form 6251 adjustments are out of scope',
      "The pinned rate and exemption helpers are not exported, so the evidence asserts them through computeFederalTax. The worksheet's AMTI of 200,000 and regular tax of 20,000 are not themselves calculator inputs: the test reaches them from real inputs (130,275 of ordinary income, which after the 16,100 standard deduction leaves 114,175 of taxable income and exactly 20,000 of bracket tax, plus 69,725 of advanced amtPreferenceItems, which with the 16,100 standard-deduction add-back makes AMTI 200,000). Any other construction of the same two figures is a different set of inputs.",
    ],
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#amtExemptionAmount',
      'packages/engine/src/tax/federalTax.ts#amtOrdinaryRateTax',
      'packages/engine/src/tax/federalTax.ts#tentativeMinimumTax',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'federal-ltcg-stacking': {
    title: 'Federal long-term capital gain stacking',
    purpose: 'Tax preferential income in the taxable-income interval immediately above ordinary taxable income.',
    kind: 'formula',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement:
      'tax/federalTax.ts#capitalGainsTaxStacked and #computeFederalTax tax 2026 single-filer annual long-term capital gains and qualified dividends by stacking preferential income above ordinary taxable income across the 0%, 15% and 20% thresholds. Each rate applies to the intersection of the preferential interval with its rate band, so the ordinary base is never taxed again. Units: nominal USD. Rounding: none stated.',
    formula: {
      expression:
        'from = ordinaryTaxable; to = from + preferential; at15 = max(0, min(to, t20) - max(from, t15)); at20 = max(0, to - max(from, t20)); tax = 0.15 x at15 + 0.20 x at20',
      variables: [
        { symbol: 'ordinaryTaxable', meaning: 'Taxable income other than preferential income', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'preferential', meaning: 'Long-term gains plus qualified dividends inside taxable income', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 't15', meaning: 'year2026.capitalGains.rate15StartsAbove for the filing status', unit: 'usd/year', domain: 'positive' },
        { symbol: 't20', meaning: 'year2026.capitalGains.rate20StartsAbove for the filing status', unit: 'usd/year', domain: 'positive and above t15' },
      ],
      timing: 'one tax year',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/federal-ltcg-stacking.md',
    },
    limits: [
      'No direct census family: the stacked preferential tax is a component of the published annual tax, not a separately published figure',
      "The helper is not exported; the evidence asserts the published capitalGainsTax of computeFederalTax, reaching the worksheet's 45,000 of ordinary taxable income and 10,000 of preferential income from real income inputs net of the 2026 single standard deduction",
    ],
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#capitalGainsTaxStacked',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'federal-ordinary-bracket-tax': {
    title: 'Federal ordinary bracket tax',
    purpose: 'Apply each marginal rate to the part of ordinary taxable income that falls in its bracket.',
    kind: 'formula',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement:
      'tax/federalTax.ts#bracketTax and #computeFederalTax compute 2026 federal ordinary income tax by applying each single-filer marginal rate to the part of annual ordinary taxable income in that bracket, partitioning taxable income into nonoverlapping layers rather than applying the top marginal rate to every dollar. No rounding is stated. Units: nominal USD.',
    formula: {
      expression: 'tax = sum over brackets i of r_i x max(0, min(T, L_(i+1)) - L_i)',
      variables: [
        { symbol: 'T', meaning: 'Ordinary taxable income', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'L_i', meaning: 'Lower bound of bracket i, from year2026.federalTax.brackets', unit: 'usd/year', domain: 'nondecreasing, first bound 0' },
        { symbol: 'r_i', meaning: 'Marginal rate of bracket i', unit: 'fraction', domain: '0 < r_i < 1' },
      ],
      timing: 'one tax year',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/federal-ordinary-bracket-tax.md',
    },
    limits: [
      'No direct census family: the ordinary bracket tax is a component of the published annual tax, not a separately published figure',
      "bracketTax is not exported; the evidence asserts the published ordinaryTax of computeFederalTax, reaching the worksheet's 60,000 of ordinary taxable income from an ordinary income of 60,000 plus the 2026 single standard deduction",
    ],
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#bracketTax',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'federal-standard-deduction-age-65': {
    title: 'Federal standard deduction with the age-65 addition',
    purpose: 'Compose the basic standard deduction with the per-person age-65 addition.',
    kind: 'composition',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement:
      'params/index.ts#standardDeduction and #age65StandardDeductionAddition, consumed by tax/federalTax.ts#computeFederalTax, compute the 2026 single-filer standard deduction as the basic annual deduction plus the per-person age-65 addition times the number of qualifying people. This is distinct from the separate OBBBA senior deduction, which rides on top of whichever deduction base wins. Units: nominal USD. Rounding: none; the published parameter values and the head count are integers.',
    formula: {
      expression: 'deduction = D + n x A',
      variables: [
        { symbol: 'D', meaning: 'Basic standard deduction, year2026.federalTax.standardDeduction for the filing status', unit: 'usd/year', domain: 'positive' },
        { symbol: 'A', meaning: 'Per-person age-65 addition, year2026.federalTax.age65Addition for the filing status', unit: 'usd/person/year', domain: 'positive' },
        { symbol: 'n', meaning: 'Living household members aged 65 or older', unit: 'people', domain: 'integer >= 0' },
      ],
      timing: 'one tax year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/federal-standard-deduction-age-65.md',
    },
    limits: [
      'No direct census family: the deduction is a component of the published annual tax, not a separately published figure',
      "The OBBBA senior deduction is a separate allowance added to the elected base, so computeFederalTax's published `deduction` equals this composition only where the senior deduction is zero. The evidence asserts standardDeduction directly and then reads the composed figure back out of computeFederalTax at a MAGI past the senior-deduction phase-out, where the published seniorDeduction is 0.",
    ],
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#standardDeduction',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'federal-taxable-social-security-tiers': {
    title: 'Federal taxable Social Security tiers',
    purpose: 'Tier the taxable share of Social Security benefits off provisional income.',
    kind: 'formula',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement:
      'tax/federalTax.ts#taxableSocialSecurity computes annual taxable Social Security from provisional income (AGI excluding Social Security, plus tax-exempt interest, plus the foreign-exclusion addback, plus half of gross benefits) using the 2026 tax parameters’ statutorily unindexed single-filer 50% and 85% tier thresholds. Units: nominal USD. Rounding: none stated.',
    formula: {
      expression:
        'P = agiExcludingSs + max(0, taxExemptInterest) + max(0, foreignAddback) + 0.5 x B; taxable = 0 when P <= a; min(0.5B, 0.5(P - a)) when a < P <= b; min(0.85B, 0.85(P - b) + min(0.5B, 0.5(b - a))) when P > b',
      variables: [
        { symbol: 'B', meaning: 'Gross Social Security benefits', unit: 'usd/year', domain: 'positive; a nonpositive benefit returns 0' },
        { symbol: 'P', meaning: 'Provisional income', unit: 'usd/year', domain: 'any finite number' },
        { symbol: 'a', meaning: 'year2026.ssBenefitTaxation.tier50Start for the filing status', unit: 'usd/year', domain: 'positive' },
        { symbol: 'b', meaning: 'year2026.ssBenefitTaxation.tier85Start for the filing status', unit: 'usd/year', domain: 'positive and above a' },
      ],
      timing: 'one tax year',
      rounding: 'none stated',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/federal-taxable-social-security-tiers.md',
    },
    limits: [
      'No direct census family: the taxable share is an input to the published annual tax and to AGI, not a separately published figure',
      'The tier thresholds are unindexed by design, so more of a benefit becomes taxable as a nominal plan runs on; the record claims the tiering, not the threshold policy',
    ],
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: ['packages/engine/src/tax/federalTax.ts#taxableSocialSecurity'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'parameter-provenance-catalog': {
    title: 'Parameter provenance catalog',
    purpose: 'Preserve the ordered source catalog that accompanies parameter assumptions.',
    kind: 'data',
    outputs: [],
    feeds: ['tax-total-annual'],
    statement: 'params/provenance.ts#PARAMETER_PROVENANCE is a human-maintained ordered catalog of 19 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.',
    formula: null,
    justification: {
      kind: 'dataset',
      source: {
        citation: 'RetireGolden parameter provenance catalog; DOCS/calculations/taxes/parameter-provenance-catalog.md, extracted 2026-09-14 and revised 2026-09-27 (one ACA entry per coverage year; the Social Security tax rate, credit and CPI-U sources)',
        url: 'https://github.com/RetireGolden/RetireGolden/blob/main/packages/engine/src/params/provenance.ts',
        asOf: '2026-09-27',
        retrievedOn: '2026-09-17',
        rights: 'Project-owned catalog under AGPL-3.0; factual links and figures attributed to per-entry publishers. Linked reuse terms not audited.',
      },
      transformation: 'Human summarization of linked authorities; digest is SHA-256 of the worksheet\'s ordered 19-ID array encoded as compact UTF-8 JSON. Extraction date is not a shared authority retrieval date.',
      digest: 'sha256:4d55f6856d61b9ebb99fe037dfaec4d7dda79fb171aabe4c8194176eda7e2526',
    },
    limits: [
      'No direct census family: actions/annualQcdTaxCharacterPostPass.ts reads the rmd-qcd entry as source provenance for QCD tax-character evidence feeding annual tax. This is a metadata dependency, not a numerical tax formula. The worksheet checks ordered IDs, count and uniqueness, not correctness or freshness of the summaries. Per-entry authorities need independent verification on refresh.',
    ],
    implementedBy: ['packages/engine/src/params/provenance.ts'],
    implementedByFunctions: ['packages/engine/src/params/provenance.ts#PARAMETER_PROVENANCE'],
    verifiedOn: '2026-09-27',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
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
      'It sums the already resolved per-account tax rather than recomputing taxable bases or taxing gross balances a second time, and it must not subtract the charity amount again from the resolved total. The charity fraction reduces the taxable pre-tax base before the heir rate applies (240,000 x 0.9 x 0.22 = 47,520.00 on the worksheet\'s traditional row), and only a charity destination carries a nonzero fraction. The first derivation taxed the whole base (52,800.00) and was re-derived on that rule; the evidence pins both cases, 56,320.00 with the 10% charity bequest and 61,600.00 with no charity destination, and is green.',
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
      'Scope is income tax only: federal tax, property tax, sales tax and cost of living are outside this quantity, the annual lines are nominal and are never discounted, and dropping the split or baseline year understates the total. The worksheet\'s per-year lines are supplied by a deterministic state-tax calculator injected at the createStateTaxCalculator seam, so the recording, the row assembly and the sum are the real code path while the per-state tax data itself is not exercised here. The published total is the driver sum over every recorded line, and the per-year series is that recording restricted to the run horizon; the two agree when every recorded line lies inside the horizon, which the test’s scenario satisfies and which no known code path violates.',
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
      'Changing one feature at a time makes this an attribution, not an additive decomposition: the four savings are not guaranteed to sum to total tax, and capital-gains savings are explicitly allowed to be negative. Reversing the counterfactual subtraction flips every sign. No result is claimed for unmodeled or flat-override rows, whose drivers are null. The pin is a non-exported function, so the evidence asserts it through the exported compareRelocationCandidates, with the worksheet\'s actual and neutralized year tables supplied by a calculator injected at the createStateTaxCalculator seam; any probe outside those tables is refused rather than guessed.',
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
  'tax-realized-gains-annual': {
    title: 'Annual realized gains, signed and composed',
    purpose: 'The year\'s net realized capital result across its three signed sources.',
    kind: 'composition',
    outputs: ['tax-realized-gains-annual'],
    feeds: ['tax-total-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.realizedGains, assembled by projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly, is the signed sum, in stated order, of gain embedded in taxable withdrawals, gain from rebalancing sales, and gain from named retirement-action executions. Each component is signed, so a loss from one source offsets gains from the others rather than being floored separately. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'realizedGains = withdrawal + rebalance + retirementAction',
      variables: [
        { symbol: 'withdrawal', meaning: 'Gain embedded in taxable-account withdrawals', unit: 'usd', domain: 'signed' },
        { symbol: 'rebalance', meaning: 'Gain realized by rebalancing sales', unit: 'usd', domain: 'signed' },
        { symbol: 'retirementAction', meaning: 'Gain or loss from named retirement-action executions', unit: 'usd', domain: 'signed' },
      ],
      timing: 'once per projection year, at year-result assembly',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/tax-realized-gains-annual.md',
    },
    limits: [
      'Asserted at the exported assembly boundary with the worksheet\'s three signed components verbatim and every other assembly channel at zero, so nothing unstated can reach the published field. Plan assumptions beyond the worksheet\'s inputs: an empty balance-sheet snapshot and a zero ladder value, neither of which this field reads',
      'The record covers the composition boundary only; each component\'s own arithmetic is evidenced by the withdrawal, rebalancing and retirement-action records',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.realizedGains',
      'packages/engine/src/projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'tax-total-annual': {
    title: 'Annual composed tax',
    purpose: 'What the year\'s published tax figure is composed of, and what it excludes.',
    kind: 'composition',
    outputs: ['tax-total-annual'],
    feeds: ['portfolio-need-annual', 'surplus-invested-annual', 'display-tax-plus-penalties-annual', 'display-total-spending-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.tax is the amount produced by the composed calculator built by tax/federalTax.ts#combineTaxCalculators: the federal total of regular income tax plus AMT plus NIIT, plus the state calculator amount, plus any further composed calculator amounts. Penalties are excluded from it, from AGI and from MAGI. Units: nominal USD per year. Rounding: none; the composition is an ordered fold.',
    formula: {
      expression: 'tax = federalTotal + stateAmount + sum of further calculator amounts',
      variables: [
        { symbol: 'federalTotal', meaning: 'Regular income tax + AMT + NIIT', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'stateAmount', meaning: 'State calculator amount', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'penalties', meaning: 'Early-withdrawal and IRC 4974 amounts', unit: 'usd/year', domain: 'never a member of tax' },
      ],
      timing: 'once per accepted tax evaluation in the projection year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/tax-total-annual.md',
    },
    limits: [
      'The worksheet treats the federal and state amounts as outputs independently evidenced by their own worksheets and checks only the annual composition boundary, so the test composes two calculators that report the worksheet\'s stated 12,000 federal total and 3,000 state amount and asserts the composed 15,000 through both compute and computeResult. Those two calculators are test doubles standing in for the evidenced federal and state records; this record makes no claim about federal or state tax arithmetic',
      'The 500 of penalties is asserted as excluded by composing the same calculators and showing the amount is unchanged: penalties never enter the calculator chain at all',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.tax',
      'packages/engine/src/tax/federalTax.ts#combineTaxCalculators',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'cash-flow-tax-character-amount': {
    title: 'Cash-flow tax-character amount',
    purpose: 'Why a tax annotation on a cash line never becomes a second cash source or use.',
    kind: 'composition',
    outputs: ['cash-flow-tax-character-amount'],
    feeds: ['tax-total-annual'],
    statement:
      'projection/internal/types/cashFlow.ts#YearCashFlowTaxCharacter.amountPlanDollars, whether attached to a source line, a transfer line or standalone metadata, is a nominal tax-only annotation that is excluded from every cash conservation identity and from every transfer debit and credit total. A capitalGain annotation may be negative for a realized loss; other character kinds are nonnegative. Units: nominal Plan USD. Rounding: none.',
    formula: {
      expression: 'sourceTotal counts physical amounts only; attached taxCharacter contributes 0 to every money total',
      variables: [
        { symbol: 'amountPlanDollars', meaning: 'Characterized amount on the annotation', unit: 'usd', domain: 'signed for capitalGain' },
        { symbol: 'physical amount', meaning: 'The line the annotation is attached to', unit: 'usd', domain: 'nonnegative' },
      ],
      timing: 'once per captured projection year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/cash-flow-tax-character-amount.md',
    },
    limits: [
      'Asserted at the production reconciler with the worksheet\'s 100,000 physical taxable-account withdrawal carrying a 30,000 capital-gain character and 20,000 of other physical sources, so the published cash source total stays 120,000. Plan assumptions beyond the worksheet\'s inputs: the account identity the line ids carry, and a matching set of funded uses so the year\'s cash identity still balances',
      'The worksheet\'s third wrong reading is asserted as a rule rather than a number: the same reconciliation is run with a negative capital-gain character to show a realized loss is accepted and still contributes nothing to the cash totals',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/cashFlow.ts',
      'packages/engine/src/projection/annualCashFlowReconciliation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/cashFlow.ts#YearCashFlowTaxCharacter.amountPlanDollars',
      'packages/engine/src/projection/annualCashFlowReconciliation.ts#reconcileYearCashFlow',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'tax-penalties-annual': {
    title: 'Annual penalties: early withdrawal plus the IRC 4974 excise',
    purpose: 'The two penalty channels a year composes, and why neither is part of tax.',
    kind: 'composition',
    outputs: ['tax-penalties-annual'],
    feeds: ['portfolio-need-annual', 'display-total-spending-annual', 'display-tax-plus-penalties-annual', 'scenario-lifetime-penalties'],
    statement:
      'projection/internal/types/result.ts#YearResult.penalties is composed by projection/internal/annualFundingCandidateEvaluation.ts#annualFundingCandidateEvaluation as projection/internal/annualFundingWithdrawalEffects.ts#annualFundingWithdrawalEffects reporting penaltyExcludingRmdShortfallExcise plus the IRC 4974 excise from rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise. The early-withdrawal rate is 10 percent on pre-age-59-and-a-half taxable traditional withdrawals, inherited distributions are never subject to it, and the excise prices max(0, required - distributed by deadline) at the stated rate, whose post-SECURE-2 default is 25 percent. Penalties stay outside tax, AGI and MAGI. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'penalties = penaltyExcludingRmdShortfallExcise + rmdShortfallExciseTax; early = 0.10 x penalizable traditional; excise = rate x max(0, required - distributed)',
      variables: [
        { symbol: 'penalizable traditional', meaning: 'Taxable pre-59.5 traditional withdrawal', unit: 'usd', domain: 'nonnegative; 0 for inherited accounts' },
        { symbol: 'required', meaning: 'Required minimum for the obligation', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'distributed', meaning: 'Distributed by the statutory deadline', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'rate', meaning: 'IRC 4974 rate', unit: '1', domain: '0.25 default from 2023' },
      ],
      timing: 'once per accepted funding evaluation in the projection year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/tax-penalties-annual.md',
    },
    limits: [
      'Asserted twice. At the two component producers: annualFundingWithdrawalEffects reports 2,000 of penaltyExcludingRmdShortfallExcise on the worksheet\'s 20,000 pre-59.5 taxable traditional withdrawal, and computeRmdShortfallExcise prices the worksheet\'s 12,000 required against 4,000 distributed as an 8,000 shortfall and a 2,000 excise at the default 25-percent rate with no relief elected. And as the published penalties of a real simulatePlan 2026 row that carries both channels at once: a 50-year-old whose only portfolio is a traditional IRA and whose 16,000 of required lifestyle plus the 2,000 excise drive a need-based withdrawal of exactly 20,000 under a zero-rate test calculator, alongside an inherited Roth account whose completed five-year deadline observation (opening benefit 12,000, 4,000 distributed by the 2026 deadline) prices the excise without replaying any cash',
      'Plan assumptions beyond the worksheet\'s inputs for that ledger year: filing single in KY at a zero state rate with a zero-rate test tax calculator, so tax is 0 and the whole need is spending plus penalties; the test asserts the 10-percent rate relation W = S + excise + 0.10 W closes at exactly 20,000',
      'The worksheet\'s fourth wrong reading is asserted as a rule: the same withdrawal-effects call on an inherited traditional account reports a zero penalty',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts',
      'packages/engine/src/projection/internal/annualFundingWithdrawalEffects.ts',
      'packages/engine/src/rmd/rmdShortfallExcise.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.penalties',
      'packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts#annualFundingCandidateEvaluation',
      'packages/engine/src/projection/internal/annualFundingWithdrawalEffects.ts#annualFundingWithdrawalEffects',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'display-tax-plus-penalties-annual': {
    title: 'Tax plus penalties for the year',
    purpose: 'The single Tax figure the year-by-year table, the spending chart and the report print.',
    kind: 'composition',
    outputs: ['display-tax-plus-penalties-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#taxAndPenalties publishes YearResult.tax + YearResult.penalties for the year, in that order: the settled federal (regular, AMT and NIIT), state and any composed tax, plus the early-withdrawal penalty and the IRC 4974 excise. AMT is already inside tax. Units: nominal USD of the year. Rounding: none; the pages format to whole dollars.',
    formula: {
      expression: 'taxAndPenalties = tax + penalties',
      variables: [
        { symbol: 'tax', meaning: 'Settled tax of the year (YearResult.tax)', unit: 'usd per year', domain: 'finite' },
        { symbol: 'penalties', meaning: 'Early-withdrawal penalty plus IRC 4974 excise (YearResult.penalties)', unit: 'usd per year', domain: 'nonnegative' },
      ],
      timing: 'annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/display-tax-plus-penalties-annual.md',
    },
    limits: [
      'None beyond those of tax and penalties, which their own records carry; the sum is written in the order the pages used, so the displayed figure did not change when it moved into the engine',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#taxAndPenalties',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.tax',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.penalties',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'display-loss-carryforward-used-annual': {
    title: 'Capital-loss carryforward used in the year',
    purpose: 'How much of the capital-loss carryforward the year used, as the ledger download reports it.',
    kind: 'composition',
    outputs: ['display-loss-carryforward-used-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#capitalLossCarryforwardUsed publishes capitalLossUsedAgainstGains + capitalLossUsedAgainstOrdinary for the year, both from one call of tax/federalTax.ts#applyCapitalLossCarryforward in the ledger (IRC 1211(b), 1212(b)). Units: nominal USD. Rounding: none; the ledger download rounds to whole dollars.',
    formula: {
      expression: 'used = usedAgainstGains + usedAgainstOrdinary; usedAgainstGains = min(P, G+); usedAgainstOrdinary = min(P - usedAgainstGains + G-, L)',
      variables: [
        { symbol: 'P', meaning: 'Opening carryforward pool', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'G+ / G-', meaning: 'The year\'s own realized gain / loss', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'L', meaning: 'Annual loss offset limit', unit: 'usd', domain: '3,000' },
      ],
      timing: 'annual',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/display-loss-carryforward-used-annual.md',
    },
    limits: [
      'When the year also realizes a net loss of its own, the figure exceeds the fall in the carried balance by that loss, which joined the pool before the $3,000 offset',
      'The single-pool, $3,000-for-every-filing-status and 1212(b)(2) limits of the carryforward itself are carried by the carryforward records',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#capitalLossCarryforwardUsed',
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
  'display-tax-free-gains-room-annual': {
    title: 'Tax-free gains room: extra long-term gain at no extra federal tax',
    purpose: 'How much more long-term gain the year could realize without raising the year\'s federal income tax.',
    kind: 'model',
    outputs: ['display-tax-free-gains-room-annual'],
    feeds: [

    ],
    statement: 'projection/yearFigures.ts#taxFreeGainsRoom publishes the largest extra long-term capital gain whose realization, netted through the capital-loss carryforward by applyCapitalLossCarryforward and priced by computeFederalTax on the year\'s published advisory input, does not raise the year\'s federal income tax (regular tax, AMT and NIIT). The opening pool is rebuilt from the published netting. The search doubles an upper bound from $1 until tax rises by more than $0.000001, then bisects to a $0.01 bracket and returns its lower end. Null when the row carries no advisory federal tax input. premiumTaxCreditYear marks the years with a modeled ACA premium credit, which the room does not price. Units: nominal USD of additional gain. Rounding: the bisection\'s lower end.',
    formula: {
      expression: 'R = max{ g >= 0 : F(h) <= F(0) for every h in [0, g] }; F(g) = computeFederalTax({ ...I, capitalGains: N(g), realizedCapitalGainsBeforeCarryforward: G + g }).totalTax; N(g) = applyCapitalLossCarryforward(P, I.ordinaryIncome, G + g, L).netCapitalGain; P = remaining + usedAgainstOrdinary + usedAgainstGains - max(0, -G)',
      variables: [
        { symbol: 'I', meaning: 'The year\'s advisory federal tax input (YearResult.advisoryFederalTax.input)', unit: 'tax input', domain: 'published by every ledger row' },
        { symbol: 'G', meaning: 'The year\'s signed realized gain before netting', unit: 'usd', domain: 'finite' },
        { symbol: 'P', meaning: 'Opening carryforward pool, rebuilt from the published netting', unit: 'usd', domain: 'nonnegative up to binary rounding' },
        { symbol: 'L', meaning: 'The year\'s capital loss offset limit', unit: 'usd', domain: '3,000' },
        { symbol: 'R', meaning: 'Published room', unit: 'usd of extra long-term gain', domain: 'in [R - 0.01, R + 1e-6/m], m the marginal rate just past R' },
      ],
      timing: 'annual, on top of everything the year already realized',
      rounding: 'bisection to $0.01 with a $0.000001 tax tolerance; the lower end is published',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/taxes/display-tax-free-gains-room-annual.md',
    },
    limits: [
      'Federal income tax only. State income tax on the gain is not included, nor a smaller ACA premium tax credit (the ledger books it as a higher net premium; if the credit was paid in advance, the part lost is paid back as federal tax at filing; the years with a modeled credit are marked), nor a Medicare premium surcharge two years later',
      'This year only: gains the carryforward absorbs reduce what carries into later years',
      'Everything else in the year is held fixed (withdrawals, the funding solve, state tax); the recomputation starts from the advisory input, whose federal tax can differ from the settled tax of the funding solve',
      'Exact when federal tax does not fall as a gain is added, which holds for every input except an itemized charitable deduction bound by a percentage-of-AGI ceiling; there the search returns a gain at which tax has not risen, not necessarily the first point at which it would',
      'The engine\'s carryforward limits apply: a single pool with no short- and long-term split, the $3,000 limit for every filing status, and no 1212(b)(2) preservation of a deduction unused in a zero-income year',
      'The opening pool is rebuilt from the published netting; exact in real arithmetic, within a few units in the last binary place otherwise',
      'Owner decision R2 (2026-09-25): before this record the page showed the 0% band room plus the remaining carryforward. That overstated the room at no tax whenever the gain would make Social Security taxable, use up the $3,000 loss deduction, shrink the senior deduction, or reach the net investment income tax threshold (the last two are not indexed while the 0% band is). year-result-ltcg-zero-headroom stays published as the 0% band room',
    ],
    implementedBy: [
      'packages/engine/src/projection/yearFigures.ts',
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/projection/internal/types/result.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/yearFigures.ts#taxFreeGainsRoom',
      'packages/engine/src/projection/yearFigures.ts#premiumTaxCreditYear',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.advisoryFederalTax',
    ],
    verifiedOn: '2026-09-26',
    provenance: { derivedBy: 'claude', implementedBy: 'claude-subagent', reviewedBy: 'unreviewed' },
  },
} satisfies Record<string, CalculationRecord>
