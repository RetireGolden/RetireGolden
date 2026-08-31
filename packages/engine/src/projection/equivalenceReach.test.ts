/**
 * `ReachRecorder.post` must wait for the inspector. A same-tick return of
 * null looks like "no hits" and would print REACHED from empty coverage —
 * worse than a TypeError. The discriminating check is that `post` yields a
 * Promise whose fulfillment is the inspector payload, not a sync null.
 */
import { describe, expect, it } from 'vitest'
import { ReachRecorder } from '../../scripts/equivalence/reach.mjs'

describe('ReachRecorder.post waits for the inspector', () => {
  it('returns a Promise that fulfills with the inspector payload', async () => {
    // vitest cwd is packages/engine. Any existing file is enough to construct.
    const recorder = new ReachRecorder([
      { id: 't', label: '(bookkeeping)', file: 'scripts/equivalence/encode.mjs', lines: [1, 1] },
    ])
    try {
      const pending = recorder.post('Runtime.evaluate', { expression: '2 + 2' })
      // The old callback-and-return-value post returned `value` (null or the
      // result object) on the same tick — not a Promise. Dropping the await
      // path fails this assertion.
      expect(pending).toBeInstanceOf(Promise)
      const payload = (await pending) as { result: { value: number } }
      expect(payload.result.value).toBe(4)
    } finally {
      await recorder.close()
    }
  })
})
