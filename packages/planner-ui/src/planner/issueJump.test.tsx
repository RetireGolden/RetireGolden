/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SECTION_ROUTE, firstIssueSection, focusIssueTarget } from './issueJump'

describe('issue jump (#494)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('names the section that owns the first placeable issue and its route', () => {
    expect(firstIssueSection(['schemaVersion: Invalid input', 'strategies.qcdAnnual: Too small: expected number to be >=0'])).toBe('strategy')
    expect(SECTION_ROUTE.strategy).toBe('strategy')
    expect(SECTION_ROUTE['social-security']).toBe('social-security')
    expect(firstIssueSection(['schemaVersion: Invalid input'])).toBeNull()
    expect(SECTION_ROUTE.unknown).toBeNull()
  })

  it('prefers an invalid control on the page, then the owning section list, then any issue list', () => {
    document.body.innerHTML = `
      <input id="bad" aria-invalid="true" />
      <ul class="issue-list" id="plan-issues-strategy" tabindex="-1"></ul>
      <ul class="issue-list" id="plan-issues-household" tabindex="-1"></ul>
      <p class="issue-list">not a plan list</p>`
    const scroll = vi.fn()
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = scroll
    expect(focusIssueTarget(document, 'household')).toBe(true)
    expect(document.activeElement?.id).toBe('bad')
    document.getElementById('bad')!.remove()
    expect(focusIssueTarget(document, 'household')).toBe(true)
    expect(document.activeElement?.id).toBe('plan-issues-household')
    expect(focusIssueTarget(document, 'unknown')).toBe(true)
    expect(document.activeElement?.id).toBe('plan-issues-strategy')
    document.querySelectorAll('ul').forEach((ul) => ul.remove())
    // A stray element with the class but no plan id is never a target.
    expect(focusIssueTarget(document, 'strategy')).toBe(false)
    expect(scroll).toHaveBeenCalled()
  })
})
