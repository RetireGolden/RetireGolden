/**
 * Bucket reporting lens (spending-paths & SWR-lenses plan, Goal 5): the
 * presets the Results card offers. The lens itself (each year's investable
 * total read as "the next N years of net spending", then the rest) is the
 * engine's `projection/bucketLens.ts#bucketLens`; this module keeps only the
 * labels, and each preset's spans are the engine's `BUCKET_LENS_SPANS`.
 *
 * Buckets are hugely popular and academically shaky: Estrada's bucket studies
 * and Kitces' reviews find no systematic benefit over a total-return portfolio
 * with rebalancing. The lens is a reading of the same numbers, nothing more.
 */

import { BUCKET_LENS_SPANS } from '@retiregolden/engine/projection/bucketLens'

export interface BucketPreset {
  id: keyof typeof BUCKET_LENS_SPANS
  label: string
  /** Year spans of the leading buckets (the engine's); the growth bucket is the remainder. */
  spans: readonly number[]
  bucketLabels: string[]
}

/** The two classic constructions the community actually uses. */
export const BUCKET_PRESETS: readonly BucketPreset[] = [
  {
    id: 'three',
    label: '3 buckets (2 yrs / 8 yrs / growth)',
    spans: BUCKET_LENS_SPANS.three,
    bucketLabels: ['Bucket 1, next 2 years of net spending', 'Bucket 2, years 3–10', 'Bucket 3, growth (the rest)'],
  },
  {
    id: 'two',
    label: '2 buckets (3 yrs / growth)',
    spans: BUCKET_LENS_SPANS.two,
    bucketLabels: ['Bucket 1, next 3 years of net spending', 'Bucket 2, growth (the rest)'],
  },
]
