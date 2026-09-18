/**
 * Roth calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const rothRecords = {
  'projection-summary-lifetime-roth-conversions': {
    title: 'Lifetime Roth conversions: sum of annual traditional-to-Roth movement',
    purpose:
      'Total nominal dollars moved traditional-to-Roth across every projection year.',
    kind: 'composition',
    outputs: ['projection-summary-lifetime-roth-conversions'],
    feeds: ['scenario-comparison-cell'],
    statement:
      'lifetimeRothConversions = sum over all projection years of YearResult.rothConversion. Each annual field is dollars moved traditional-to-Roth in that year, so the lifetime figure is the additive identity over all and only the projection rows. Units: nominal dollars. Rounding: none.',
    formula: {
      expression: 'lifetime = sum_y rothConversion_y',
      variables: [
        { symbol: 'rothConversion_y', meaning: 'Nominal dollars converted traditional-to-Roth in year y', unit: 'usd', domain: 'finite' },
        { symbol: 'lifetime', meaning: 'Sum of those annual amounts over the projection', unit: 'usd', domain: 'finite' },
      ],
      timing: 'once per projection, over every published year including zeros',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/roth/projection-summary-lifetime-roth-conversions.md',
    },
    limits: [
      'Zero-conversion years remain in the sum; shortening the horizon to drop a zero year also drops later years',
      'The evidence constructs the three stated YearResult.rothConversion rows rather than running a full simulation',
    ],
    implementedBy: ['packages/engine/src/projection/compare.ts'],
    implementedByFunctions: ['packages/engine/src/projection/compare.ts#summarizeProjection'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
