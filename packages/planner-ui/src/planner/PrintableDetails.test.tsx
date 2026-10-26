/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PrintableDetails } from './PrintableDetails'

const container = document.createElement('div')
const root = createRoot(container)
afterEach(() => act(() => root.unmount()))

it('prints all disclosure content and restores each original open state', () => {
  act(() => root.render(<>
    <PrintableDetails><summary>Closed on screen</summary><p>Complete limitations</p></PrintableDetails>
    <PrintableDetails open><summary>Open on screen</summary><p>Full explanation</p></PrintableDetails>
  </>))
  const details = [...container.querySelectorAll('details')]
  expect(details.map((d) => d.open)).toEqual([false, true])
  window.dispatchEvent(new Event('beforeprint'))
  window.dispatchEvent(new Event('beforeprint'))
  expect(details.every((d) => d.open)).toBe(true)
  window.dispatchEvent(new Event('afterprint'))
  expect(details.map((d) => d.open)).toEqual([false, true])
})
