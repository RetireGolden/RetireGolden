/** @vitest-environment jsdom */
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePlannerWorksheetNavigation } from './usePlannerWorksheetNavigation'

const anchor = 'state-tax-worksheet-facts'
const destination = `/plan/example/assumptions#${anchor}`

function DelayedWorksheet() {
  const [ready, setReady] = useState(false)
  return ready
    ? <div id={anchor}><h3>State tax worksheet facts</h3><input aria-label="Tax year" /></div>
    : <button onClick={() => setReady(true)}>Finish loading plan</button>
}

function NavigationHarness() {
  usePlannerWorksheetNavigation()
  return <>
    <Link to={destination}>Review worksheet</Link>
    <Link to="/plan/example/assumptions">Assumptions top</Link>
    <Link to="/plan/example/accounts">Accounts</Link>
    <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/plan/example/optimize" element={<h1>Optimize</h1>} />
        <Route path="/plan/example/assumptions" element={<DelayedWorksheet />} />
        <Route path="/plan/example/accounts" element={<h1>Accounts</h1>} />
      </Routes>
    </main>
  </>
}

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.restoreAllMocks()
})

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  await act(async () => root.render(<MemoryRouter initialEntries={['/plan/example/optimize']}><NavigationHarness /></MemoryRouter>))
  cleanups.push(async () => {
    await act(async () => root.unmount())
    host.remove()
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  })
  const click = async (text: string) => {
    const control = [...host.querySelectorAll<HTMLElement>('a,button')].find((element) => element.textContent === text)
    if (!control) throw new Error(`Missing navigation control: ${text}`)
    await act(async () => control.click())
  }
  return { host, scroll, click }
}

describe('planner worksheet SPA navigation', () => {
  it('waits for the destination plan to mount, then scrolls and focuses its worksheet', async () => {
    const { host, scroll, click } = await mount()
    await click('Review worksheet')
    expect(host.textContent).toContain('Finish loading plan')
    expect(scroll).not.toHaveBeenCalled()
    await click('Finish loading plan')
    expect(document.activeElement).toBe(host.querySelector(`#${anchor}`))
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })

  it('handles a same-path hash change and leaves ordinary navigation alone', async () => {
    const { host, scroll, click } = await mount()
    await click('Assumptions top')
    await click('Finish loading plan')
    expect(scroll).not.toHaveBeenCalled()
    await click('Review worksheet')
    expect(document.activeElement).toBe(host.querySelector(`#${anchor}`))
    expect(scroll).toHaveBeenCalledTimes(1)
    await click('Accounts')
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending worksheet request when navigating elsewhere', async () => {
    const { scroll, click } = await mount()
    await click('Review worksheet')
    await click('Accounts')
    await click('Assumptions top')
    await click('Finish loading plan')
    expect(scroll).not.toHaveBeenCalled()
  })
})
