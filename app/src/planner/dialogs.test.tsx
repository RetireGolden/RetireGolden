/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useDialogs } from './dialogs'

function Harness() {
  const { confirm, prompt, choice, alert, dialogs } = useDialogs()
  const [result, setResult] = useState('none')
  return (
    <div>
      <button
        data-testid="open-confirm"
        onClick={() =>
          void confirm({ title: 'Delete plan', body: 'Sure?', confirmLabel: 'Delete', danger: true }).then((r) =>
            setResult(`confirm:${r}`),
          )
        }
      >
        open confirm
      </button>
      <button
        data-testid="open-typed"
        onClick={() =>
          void confirm({
            title: 'Clear all data',
            body: 'Everything goes.',
            confirmLabel: 'Erase everything',
            typedConfirmation: 'delete',
          }).then((r) => setResult(`typed:${r}`))
        }
      >
        open typed
      </button>
      <button
        data-testid="open-prompt"
        onClick={() =>
          void prompt({ title: 'Duplicate plan', label: 'Name', defaultValue: 'Copy of X' }).then((r) =>
            setResult(`prompt:${r}`),
          )
        }
      >
        open prompt
      </button>
      <button
        data-testid="open-choice"
        onClick={() =>
          void choice({
            title: 'Open example',
            body: 'Which version?',
            choices: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ],
          }).then((r) => setResult(`choice:${r}`))
        }
      >
        open choice
      </button>
      <button data-testid="open-alert" onClick={() => void alert({ title: 'Note', body: 'FYI' }).then(() => setResult('alert:done'))}>
        open alert
      </button>
      <button
        data-testid="open-concurrent"
        onClick={() => {
          void confirm({ title: 'First dialog', body: 'first' }).then((r) => setResult((prev) => `${prev}|first:${r}`))
          void prompt({ title: 'Second dialog', label: 'x' }).then((r) => setResult((prev) => `${prev}|second:${r}`))
        }}
      >
        open concurrent
      </button>
      <output data-testid="result">{result}</output>
      {dialogs}
    </div>
  )
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render() {
  await act(async () => {
    root.render(<Harness />)
  })
}

async function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  await act(async () => {
    ;(el as HTMLElement).click()
  })
}

async function clickByTestId(id: string) {
  await click(container.querySelector(`[data-testid="${id}"]`))
}

function dialogButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button')).find(
    (b) => b.textContent === label,
  )
}

async function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function pressEscape() {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

function result() {
  return container.querySelector('[data-testid="result"]')?.textContent
}

describe('useDialogs confirm', () => {
  it('resolves true on confirm and returns focus to the opener', async () => {
    await render()
    const opener = container.querySelector<HTMLButtonElement>('[data-testid="open-confirm"]')!
    opener.focus()
    await clickByTestId('open-confirm')
    expect(document.querySelector('.modal-panel')).not.toBeNull()
    await click(dialogButton('Delete'))
    expect(result()).toBe('confirm:true')
    expect(document.querySelector('.modal-panel')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('resolves false on Escape', async () => {
    await render()
    await clickByTestId('open-confirm')
    await pressEscape()
    expect(result()).toBe('confirm:false')
    expect(document.querySelector('.modal-panel')).toBeNull()
  })

  it('resolves false on Cancel', async () => {
    await render()
    await clickByTestId('open-confirm')
    await click(dialogButton('Cancel'))
    expect(result()).toBe('confirm:false')
  })
})

describe('useDialogs typed confirmation', () => {
  it('keeps the confirm button disabled until the word is typed', async () => {
    await render()
    await clickByTestId('open-typed')
    const confirmBtn = dialogButton('Erase everything')!
    expect(confirmBtn.disabled).toBe(true)

    const input = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    await typeInto(input, 'del')
    expect(dialogButton('Erase everything')!.disabled).toBe(true)

    await typeInto(input, 'DELETE')
    expect(dialogButton('Erase everything')!.disabled).toBe(false)

    await click(dialogButton('Erase everything'))
    expect(result()).toBe('typed:true')
  })

  it('cannot be confirmed by pressing Enter in the gate input', async () => {
    await render()
    await clickByTestId('open-typed')
    const input = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    // Still open, still unresolved: the gate input is not a submitting form.
    expect(document.querySelector('.modal-panel')).not.toBeNull()
    expect(result()).toBe('none')
  })
})

describe('useDialogs prompt', () => {
  it('returns the edited value on submit', async () => {
    await render()
    await clickByTestId('open-prompt')
    const input = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    expect(input.value).toBe('Copy of X')
    await typeInto(input, 'Renamed plan')
    await click(dialogButton('OK'))
    expect(result()).toBe('prompt:Renamed plan')
  })

  it('returns null on Escape', async () => {
    await render()
    await clickByTestId('open-prompt')
    await pressEscape()
    expect(result()).toBe('prompt:null')
  })
})

describe('useDialogs choice', () => {
  it('returns the picked value', async () => {
    await render()
    await clickByTestId('open-choice')
    const optionB = Array.from(document.querySelectorAll<HTMLButtonElement>('.dialog-choice')).find((b) =>
      b.textContent?.includes('Option B'),
    )
    await click(optionB)
    expect(result()).toBe('choice:b')
  })

  it('returns null on cancel', async () => {
    await render()
    await clickByTestId('open-choice')
    await click(dialogButton('Cancel'))
    expect(result()).toBe('choice:null')
  })
})

describe('useDialogs re-entrancy', () => {
  it('a dialog requested while another is open resolves to its did-nothing value instead of clobbering it', async () => {
    await render()
    await clickByTestId('open-concurrent')

    // The second (prompt) request resolved immediately to null; the first
    // dialog is still the one on screen and still resolvable.
    expect(result()).toBe('none|second:null')
    expect(document.querySelector('.modal-panel')?.getAttribute('aria-label')).toBe('First dialog')

    await click(dialogButton('OK'))
    expect(result()).toBe('none|second:null|first:true')
    expect(document.querySelector('.modal-panel')).toBeNull()
  })
})

describe('useDialogs alert', () => {
  it('resolves when closed', async () => {
    await render()
    await clickByTestId('open-alert')
    await click(dialogButton('Close'))
    expect(result()).toBe('alert:done')
  })
})
