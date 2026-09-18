/** Calculation catalog slice; independent worksheet claims, including disclosed discrepancies. */
import type { CalculationRecord } from '../calculationRegistry.js'

export const optimizerAndComparisonsRecords = {
  'conversion-coordinate-descent-search': {
    title: 'Conversion coordinate descent search',
    purpose: 'Refine an annual conversion schedule through deterministic local search.',
    kind: 'model',
    outputs: [],
    feeds: ['optimizer-recommended-conversion-annual', 'optimizer-schedule-conversion-total'],
    statement: 'decisions/search.ts#refineConversionSchedule deterministically searches annual Roth-conversion dollars by fixed-order coordinate descent, first coarse then fine steps, retaining only hard-constraint-feasible moves whose exact-ledger primary metric improves by more than the minimum, subject to simulation and sweep caps.',
    formula: {
      expression: 'for coarse then fine step, for each year coordinate try amount +/- step; retain a feasible candidate only when score > incumbent + minimumImprovement',
      variables: [
        { symbol: 'schedule', meaning: 'Annual conversion amounts', unit: 'nominal USD', domain: 'nonnegative' },
        { symbol: 'step', meaning: 'Coarse/fine move size', unit: 'USD', domain: 'positive' },
        { symbol: 'score', meaning: 'Objective metric', unit: 'objective dollars', domain: 'finite' },
      ],
      timing: 'deterministic annual-coordinate order under simulation and sweep budgets',
      rounding: 'schedule cents; no statistical tolerance',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/optimizer-and-comparisons/conversion-coordinate-descent-search.md',
    },
    limits: [
      'Local search only; no global-optimum claim. The worksheet score table is injected at the evaluation seam with a four-evaluation budget covering exactly its four entries; any unspecified probe fails closed. This proves search selection only. The returned aggregate schedule still passes downstream legal-owner/action readiness and publication gates, so it feeds rather than publishes optimizer recommendations.',
    ],
    implementedBy: ['packages/engine/src/decisions/search.ts'],
    implementedByFunctions: ['packages/engine/src/decisions/search.ts#refineConversionSchedule'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'cursor' },
  },
  'swr-rule-rate-and-initial-spend': {
    title: 'Swr rule rate and initial spend',
    purpose: 'Set initial spending from three published withdrawal-rate parameterizations.',
    kind: 'model',
    outputs: ['swr-rule-result-initial-rate-pct', 'swr-rule-result-initial-annual-spend'],
    feeds: [
      'swr-rule-result-depletion-year',
      'swr-rule-result-end-year',
      'swr-rule-result-ending-after-tax-estate',
      'swr-rule-result-lifetime-taxes-and-penalties',
    ],
    statement: 'decisions/swrComparator.ts#compareSwrRules assigns Bengen 4.7%, Morningstar 3.9%, or ERN 1.75%+0.5(100/CAPE) and multiplies that percent by starting investable dollars to set constant-real initial annual spending before a same-plan ledger comparison.',
    formula: {
      expression: 'rates = (4.7,3.9,1.75+0.5*(100/CAPE)); initialSpend = startingInvestable * rate/100',
      variables: [
        { symbol: 'CAPE', meaning: 'Cyclically adjusted price/earnings ratio', unit: '1', domain: 'positive' },
        { symbol: 'startingInvestable', meaning: 'Initial investable portfolio', unit: 'today USD', domain: 'nonnegative' },
      ],
      timing: 'initial constant-real annual spending, before ledger comparison',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-rate-and-initial-spend.md',
    },
    limits: [
      'Published rule parameterizations are planning lenses, not household safety guarantees. The worksheet pins rates and initial spending only; depletion, horizon, estate, and taxes come from the downstream ledger and are feeds.',
    ],
    implementedBy: ['packages/engine/src/decisions/swrComparator.ts'],
    implementedByFunctions: ['packages/engine/src/decisions/swrComparator.ts#compareSwrRules'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'codex', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
