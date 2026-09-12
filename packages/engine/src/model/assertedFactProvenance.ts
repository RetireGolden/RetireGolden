/**
 * Shared asserted-fact provenance used by additive audit-phase Plan fields.
 * Matches the existing inherited-beneficiary provenance shape: nonblank source
 * plus a real civil as-of date. Absence of a whole facts block means unknown;
 * a present block with explicit null/empty members means verified none.
 */
import { z } from 'zod'
import { parseCivilIsoDate } from '../actions/civilDate.js'

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

export const assertedFactProvenanceSchema = z.object({
  source: z.string().refine((value) => value.trim().length > 0, {
    message: 'provenance.source must be non-blank after trimming; provide the asserting source',
  }),
  asOf: z
    .string()
    .regex(isoDateRe, 'provenance.asOf must be an ISO date (YYYY-MM-DD)')
    .refine(
      (value) => parseCivilIsoDate(value) !== null,
      'provenance.asOf must be a real calendar date (YYYY-MM-DD)',
    ),
})
export type AssertedFactProvenance = z.infer<typeof assertedFactProvenanceSchema>
