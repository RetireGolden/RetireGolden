/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SECTION_ROUTE, UNPLACEABLE_FALLBACK_SECTION, firstIssueSection, focusIssueTarget, routeForIssues } from './issueJump'

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
    // With nothing placeable, any plan list will do: they all show those issues.
    expect(focusIssueTarget(document, 'unknown')).toBe(true)
    expect(document.activeElement?.id).toBe('plan-issues-strategy')
    document.querySelectorAll('ul').forEach((ul) => ul.remove())
    // A stray element with the class but no plan id is never a target.
    expect(focusIssueTarget(document, 'strategy')).toBe(false)
    expect(scroll).toHaveBeenCalled()
  })

  it('never settles for another section’s list, so the caller navigates instead (r1-10)', () => {
    document.body.innerHTML = `<ul class="issue-list" id="plan-issues-strategy" tabindex="-1"></ul>`
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = vi.fn()
    // The household issue is not on this page: reporting failure is what makes
    // the chip navigate rather than focus the Strategy list sitting here.
    expect(focusIssueTarget(document, 'household')).toBe(false)
    expect(document.activeElement?.id).not.toBe('plan-issues-strategy')
  })

  it('sends an unplaceable-only plan to an entry page rather than nowhere (r1-4)', () => {
    const unplaceable = ['schemaVersion: Invalid input']
    expect(firstIssueSection(unplaceable)).toBeNull()
    // On Results or Scenarios there is no list and no section to name; the chip
    // still has somewhere to go, and every section list shows these issues.
    expect(routeForIssues(unplaceable)).toBe('household')
    expect(SECTION_ROUTE[UNPLACEABLE_FALLBACK_SECTION]).toBe('household')
    // A placeable issue still routes to its own section, and nothing routes nowhere.
    expect(routeForIssues(['incomes.0.claimAge.years: Too small: expected number to be >=62'])).toBe('social-security')
    expect(routeForIssues([])).toBeNull()
  })
})
