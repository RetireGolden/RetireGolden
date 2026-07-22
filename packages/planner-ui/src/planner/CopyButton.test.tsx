/** @vitest-environment jsdom */
/**
 * The shared copy button's contract: it copies, it flashes, and — the part that
 * matters — when the clipboard is unavailable it hands the text over anyway
 * instead of dropping it on the floor. Both callers (the assumptions card and
 * the results toolbar's "Copy plan for your AI") export content the user has no
 * other way to retrieve.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CopyButton } from './CopyButton'

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(node)
  })
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const button = (el: HTMLElement) => el.querySelector('button')!
const fallback = (el: HTMLElement) => el.querySelector('textarea')

describe('CopyButton', () => {
  it('writes the text to the clipboard and confirms', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const el = render(<CopyButton label="Copy" copiedLabel="Copied ✓" text={() => 'the payload'} />)

    await act(async () => button(el).click())

    expect(writeText).toHaveBeenCalledWith('the payload')
    expect(button(el).textContent).toBe('Copied ✓')
    expect(fallback(el)).toBeNull()
  })

  it('falls back to selectable text when there is no Clipboard API', async () => {
    // Insecure context / unsupported browser: navigator.clipboard is undefined.
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const el = render(<CopyButton label="Copy" copiedLabel="Copied ✓" text={() => 'the payload'} />)

    await act(async () => button(el).click())

    expect(button(el).textContent).toBe('Clipboard unavailable — copy manually')
    const area = fallback(el)!
    expect(area).not.toBeNull()
    expect(area.value).toBe('the payload')
    expect(area.readOnly).toBe(true)
  })

  it('falls back the same way when writeText rejects (permission denied)', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const el = render(<CopyButton label="Copy" copiedLabel="Copied ✓" text={() => 'the payload'} />)

    await act(async () => button(el).click())

    expect(fallback(el)!.value).toBe('the payload')
  })

  it('keeps the fallback on screen instead of timing out like the copied flash', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const el = render(<CopyButton label="Copy" copiedLabel="Copied ✓" text={() => 'the payload'} />)

    await act(async () => button(el).click())
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    // The success flash resets after 2.5s; the fallback must not, or the only
    // copy of the text disappears while the user is reaching for Ctrl-C.
    expect(fallback(el)!.value).toBe('the payload')
  })

  it('labels the fallback field for screen readers', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const el = render(
      <CopyButton label="Copy" copiedLabel="Copied ✓" fallbackLabel="Your plan, as JSON" text={() => 'x'} />,
    )

    await act(async () => button(el).click())

    expect(fallback(el)!.getAttribute('aria-label')).toBe('Your plan, as JSON')
  })
})
