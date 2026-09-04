/** @vitest-environment jsdom */
/**
 * The help bubble never opens under the sticky KPI bar (#469): when the room
 * above the trigger is taken by the bar, the bubble flips below the trigger.
 * jsdom has no layout, so geometry is stubbed per element.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { HelpTip } from './fields'

const rects: Record<string, Partial<DOMRect>> = {}
const original = Element.prototype.getBoundingClientRect

describe('HelpTip clamp', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const key = this.classList.contains('kpi-bar')
        ? 'bar'
        : this.tagName === 'BUTTON'
          ? 'button'
          : this.classList.contains('help-tip-bubble')
            ? 'bubble'
            : 'other'
      const r = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...rects[key] }
      return { ...r, toJSON: () => r }
    }
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    Element.prototype.getBoundingClientRect = original
  })

  // The bar is a sibling of the workspace outlet, as in PlanWorkspace.
  const mount = async (withBar: boolean) => {
    await act(async () => {
      root.render(
        <div className="plan">
          {withBar ? <div className="kpi-bar" /> : null}
          <div className="workspace">
            <HelpTip text="What this means" />
          </div>
        </div>,
      )
    })
  }
  const open = async () => {
    const button = container.querySelector('button')!
    await act(async () => {
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    return container.querySelector<HTMLElement>('.help-tip-bubble')!
  }

  it('opens above the trigger when there is room', async () => {
    Object.assign(rects, { bar: { bottom: 0 }, button: { top: 100, bottom: 124, left: 300, width: 24 }, bubble: { width: 200, height: 60 } })
    await mount(false)
    const bubble = await open()
    // above = 100 - 60 - 8 = 32, which clears the 8px margin.
    expect(bubble.style.top).toBe('32px')
  })

  it('flips below the trigger when the workspace KPI bar covers the room above', async () => {
    Object.assign(rects, { bar: { bottom: 120 }, button: { top: 100, bottom: 124, left: 300, width: 24 }, bubble: { width: 200, height: 60 } })
    await mount(true)
    const bubble = await open()
    // above = 32 is under the bar's bottom edge (120 + 8), so the bubble goes below: 124 + 8.
    expect(bubble.style.top).toBe('132px')
  })
})
