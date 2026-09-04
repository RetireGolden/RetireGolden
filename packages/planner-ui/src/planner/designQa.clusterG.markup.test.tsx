/** @vitest-environment jsdom */
/**
 * Design-QA markup pins, cluster G (#465): a `wide` select carries the
 * two-column field class the stylesheet spans, and a plain one does not.
 * The CSS half is in designQa.clusterG.test.ts.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { SelectField } from './fields'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function mount(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(node))
  return container
}

const options = [
  { value: 'fixed', label: 'Fixed (happens in its year)' },
  { value: 'skippable', label: 'Skippable (drop if unaffordable)' },
] as const

describe('SelectField wide (#465)', () => {
  it('spans two columns only when asked', () => {
    const el = mount(
      <div className="form-grid">
        <SelectField label="Flexibility" wide value="fixed" options={options} onCommit={() => undefined} />
        <SelectField label="Layer" value="fixed" options={options} onCommit={() => undefined} />
      </div>,
    )
    const fields = Array.from(el.querySelectorAll('.field'))
    expect(fields).toHaveLength(2)
    expect(fields[0]!.classList.contains('field--wide')).toBe(true)
    expect(fields[1]!.classList.contains('field--wide')).toBe(false)
    // The select itself is unchanged: same element, same title carrying the full label.
    const wideSelect = fields[0]!.querySelector('select')!
    expect(wideSelect.title).toBe('Fixed (happens in its year)')
  })
})
