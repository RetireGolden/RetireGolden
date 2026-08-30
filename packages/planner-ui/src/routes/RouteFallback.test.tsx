/** @vitest-environment jsdom */
/**
 * Pins the DOM contract that lazy-route waits depend on.
 *
 * Tests that wait for a lazy chunk by watching the Suspense fallback vanish
 * are only as good as the selector they watch, and a wrong one fails silently
 * — `!container.querySelector(…)` is satisfied on its first poll, so the wait
 * returns immediately and the assertions run against whatever happens to be
 * on screen. `learn.test.tsx` waited on `.route-loading` for exactly that
 * reason: no code in this package has ever rendered that class.
 *
 * So assert the fallback really matches the selector the waits use. If
 * RouteFallback's markup changes, this fails and names the contract, instead
 * of leaving a dead wait behind that still looks like it is guarding.
 */
import { afterEach, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { ROUTE_FALLBACK_SELECTOR } from '../testSupport/lazyRoutes'
import { RouteFallback } from './RouteFallback'

let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

it('renders the loading contract that lazy-route waits watch for', async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<RouteFallback />))

  expect(container.querySelector(ROUTE_FALLBACK_SELECTOR)).not.toBeNull()
})
