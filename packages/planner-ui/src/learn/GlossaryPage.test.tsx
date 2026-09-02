/** @vitest-environment jsdom */
/**
 * Glossary filter (#487): typing narrows the definition list live, the count
 * announces it, and an empty match offers a way back.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { GLOSSARY_TERMS } from './glossary'
import { GlossaryPage } from './GlossaryPage'

describe('GlossaryPage filter', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/learn/glossary']}>
          <GlossaryPage />
        </MemoryRouter>,
      )
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('starts with every term, a labelled filter, and a count', () => {
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(GLOSSARY_TERMS.length)
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Filter terms')
    expect(container.querySelector('[role="status"]')?.textContent).toBe(`${GLOSSARY_TERMS.length} terms`)
  })

  const shownIds = () => [...container.querySelectorAll('.learn-glossary-item')].map((el) => el.id)

  it('matches an expansion, case-insensitively, and reports the count', async () => {
    // "affordable care act" appears only as the ACA expansion, and only in that case.
    await type('affordable care act')
    expect(shownIds()).toEqual(['aca'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe(`1 of ${GLOSSARY_TERMS.length} terms match`)
    // Anchors survive filtering so deep links still land.
    expect(document.getElementById('aca')).not.toBeNull()
  })

  it('matches a term in lower case and a definition-only phrase', async () => {
    await type('irmaa')
    expect(shownIds()).toContain('irmaa')
    await type('nursing home')
    // "nursing home" is in the LTC definition only, not its term or expansion.
    expect(shownIds()).toContain('ltc')
    expect(shownIds()).not.toContain('aca')
  })

  it('announces a query that matches everything as a match, not as the unfiltered list', async () => {
    const all = GLOSSARY_TERMS.length
    // Every term, expansion, or definition contains the letter a.
    await type('a')
    expect(shownIds()).toHaveLength(all)
    expect(container.querySelector('[role="status"]')?.textContent).toBe(`All ${all} terms match`)
  })

  it('shows an empty state with a clear action when nothing matches', async () => {
    await type('zzzz-no-such-term')
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(0)
    const empty = container.querySelector('.empty-state')!
    expect(empty.textContent).toContain('No terms match “zzzz-no-such-term”')
    const clear = [...empty.querySelectorAll('button')].find((b) => b.textContent === 'Clear filter')!
    await act(async () => clear.click())
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(GLOSSARY_TERMS.length)
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(input.value).toBe('')
    // The Clear button unmounts; focus lands back on the filter.
    expect(document.activeElement).toBe(input)
  })
})
