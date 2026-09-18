/**
 * Medicare-and-ACA calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const medicareAndAcaRecords = {
  'scenario-irmaa-surcharge-tier-years': {
    title: 'Scenario comparison: years in an IRMAA surcharge tier',
    purpose:
      'How many projection years sit strictly above IRMAA tier 0, compared proposal-minus-baseline.',
    kind: 'composition',
    outputs: ['scenario-irmaa-surcharge-tier-years'],
    feeds: ['scenario-comparison-cell'],
    statement:
      'For each side, surchargeTierYears = count of projection years whose published irmaaTier is strictly greater than 0 (tier 0 is the standard premium; tiers 1–5 are surcharge tiers). The comparison is the integer triple (baseline count, proposal count, proposal − baseline). Units: year counts. Rounding: none — exact integers.',
    formula: {
      expression: 'count = sum_y 1[irmaaTier_y > 0]; delta = count_proposal − count_baseline',
      variables: [
        { symbol: 'irmaaTier_y', meaning: 'Published IRMAA tier classification for year y', unit: 'tier', domain: 'integer 0..5' },
        { symbol: 'count', meaning: 'Number of surcharge-tier years on one side', unit: 'years', domain: 'integer >= 0' },
      ],
      timing: 'one count per side over that side\'s projection years',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/medicare-and-aca/scenario-irmaa-surcharge-tier-years.md',
    },
    limits: [
      'Medicare premium dollars and the maximum tier are different outputs; this record counts years only',
      'The evidence constructs the stated irmaaTier rows rather than running two full simulations',
    ],
    implementedBy: ['packages/engine/src/scenarios/comparison.ts'],
    implementedByFunctions: ['packages/engine/src/scenarios/comparison.ts#compareScenarioPlans'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'unreviewed' },
  },
} satisfies Record<string, CalculationRecord>
