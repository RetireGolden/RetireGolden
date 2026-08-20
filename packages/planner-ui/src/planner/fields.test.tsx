/** @vitest-environment jsdom */

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { DateField, MoneyField } from './fields'

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

  it('opens a zero field empty and selected so typing replaces instead of appending', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(0)
      return <MoneyField label="Wages" value={value} onCommit={(v) => setValue(v ?? 0)} />
    }
    const container = await render(<Harness />)
    const input = container.querySelector('input')!
    expect(input.value).toBe('0')

    await act(async () => {
      input.focus()
      input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    })
    expect(input.value).toBe('')

    await change(input, '450')
    expect(input.value).toBe('450')
  })

  it('treats Chromium insertReplacementText as a replace, not 450 → 450450', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(450)
      return <MoneyField label="Wages" value={value} onCommit={(v) => setValue(v ?? 0)} />
    }
    const container = await render(<Harness />)
    const input = container.querySelector('input')!

    await act(async () => {
      input.focus()
      input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    })

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, '450450')
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: '450' }),
      )
    })
    expect(input.value).toBe('450')
  })

  it('keeps unaffected digits when insertReplacementText is only a selected span', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(12_500)
      return <MoneyField label="Wages" value={value} onCommit={(v) => setValue(v ?? 0)} />
    }
    const container = await render(<Harness />)
    const input = container.querySelector('input')!

    await act(async () => {
      input.focus()
      input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    })

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, '13,000')
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: '30' }),
      )
    })
    expect(input.value).toBe('13,000')
  })
})

describe('DateField', () => {
  it('caps an overflowed year segment at 4 digits', async () => {
    function Harness() {
      const [value, setValue] = useState('1970-01-01')
      return <DateField label="Your date of birth" value={value} onCommit={setValue} />
    }
    const container = await render(<Harness />)
    const input = container.querySelector('input')!
    expect(input.max).toBe('9999-12-31')
    expect(input.min).toBe('1900-01-01')

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
        .call(input, '121983-04-12')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(input.value).toBe('1983-04-12')
  })
})
