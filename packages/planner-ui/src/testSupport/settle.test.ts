/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from './settle.js'

/**
 * The timeout message is the only diagnostic a polling failure leaves behind.
 * Before these helpers were shared, each test file hand-appended the container
 * text to its own wait; a shared `waitFor` that dropped it would have made
 * every raw call site fail with a bare "timed out" and no DOM, which is the
 * regression this pins.
 */
describe('waitFor timeout diagnostics', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reports the rendered text when the caller named no describe', async () => {
    document.body.innerHTML = '<main>Loading your plan</main>'
    await expect(waitFor(() => false, { what: 'the workspace', attempts: 1, intervalMs: 0 }))
      .rejects.toThrow('Timed out waiting for the workspace; got: Loading your plan')
  })

  it('prefers the caller\'s describe over the document dump', async () => {
    document.body.innerHTML = '<main>Loading your plan</main>'
    await expect(
      waitFor(() => false, { what: 'the caption', attempts: 1, intervalMs: 0, describe: () => 'just this host' }),
    ).rejects.toThrow('Timed out waiting for the caption; got: just this host')
  })

  it('truncates a long render rather than printing the whole document', async () => {
    document.body.innerHTML = `<main>${'x'.repeat(5000)}</main>`
    await expect(waitFor(() => false, { what: 'the row', attempts: 1, intervalMs: 0 }))
      .rejects.toThrow(/… \(truncated\)$/u)
  })

  it('omits the context entirely when nothing is rendered', async () => {
    await expect(waitFor(() => false, { what: 'the row', attempts: 1, intervalMs: 0 }))
      .rejects.toThrow(/^Timed out waiting for the row$/u)
  })
})
