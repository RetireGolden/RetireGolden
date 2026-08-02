/** @vitest-environment jsdom */

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { MoneyField } from './fields'

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  host?.remove()
  root = null
  host = null
})

async function render(content: ReactNode) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root!.render(content))
  return host
}

async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      .call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('MoneyField', () => {
  it('keeps whole-dollar formatting as the default', async () => {
    const container = await render(
      <MoneyField label="Default money" value={0.07} onCommit={() => undefined} />,
    )
    expect(container.querySelector('input')!.value).toBe('0')
  })

  it('displays and round-trips opt-in exact cents', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(0.07)
      return (
        <MoneyField
          label="Exact money"
          value={value}
          fractionDigits={2}
          onCommit={setValue}
        />
      )
    }
    const container = await render(<Harness />)
    const input = container.querySelector('input')!
    expect(input.value).toBe('0.07')
    expect(container.querySelector('.input-affix span')!.textContent).toBe('$')

    await change(input, '0.08')
    expect(input.value).toBe('0.08')
  })
})
