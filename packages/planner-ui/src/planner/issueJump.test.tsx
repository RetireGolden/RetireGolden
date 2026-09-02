/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SECTION_ROUTE,
  UNPLACEABLE_FALLBACK_SECTION,
  firstIssue,
  firstIssueSection,
  focusIssueTarget,
  retryFocus,
  routeForIssues,
  workspaceRoot,
} from './issueJump'

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

  it('lands on the control wired to the first issue’s own path before any other invalid control (r2-3)', () => {
    document.body.innerHTML = `
      <input id="other" aria-invalid="true" data-path="accounts.0.balance" />
      <input id="mine" aria-invalid="true" data-path="household.people.0.longevity.planningAge" />`
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = vi.fn()
    expect(firstIssue(['household.people.0.longevity.planningAge: Too small: expected number to be >=60'])).toEqual({
      section: 'household',
      path: 'household.people.0.longevity.planningAge',
    })
    expect(focusIssueTarget(document, 'household', 'household.people.0.longevity.planningAge')).toBe(true)
    expect(document.activeElement?.id).toBe('mine')
    // Without a path it is the first invalid control in tree order, as before.
    expect(focusIssueTarget(document, 'household')).toBe(true)
    expect(document.activeElement?.id).toBe('other')
  })

  it('searches the plan outlet, never host chrome that happens to be invalid (r2-3)', () => {
    document.body.innerHTML = `
      <input id="host" aria-invalid="true" />
      <div class="planner-shell"><div id="plan-content" tabindex="-1">
        <ul class="issue-list" id="plan-issues-strategy" tabindex="-1"></ul>
      </div></div>`
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = vi.fn()
    expect(workspaceRoot()).toBe(document.getElementById('plan-content'))
    expect(focusIssueTarget(workspaceRoot(), 'strategy')).toBe(true)
    expect(document.activeElement?.id).toBe('plan-issues-strategy')
    document.getElementById('plan-content')!.remove()
    expect(workspaceRoot()).toBe(document.querySelector('.planner-shell'))
    document.querySelector('.planner-shell')!.remove()
    expect(workspaceRoot()).toBe(document)
  })

  it('a retry stops as soon as the person has moved on, and can be cancelled (r2-1)', () => {
    const frames: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    try {
      document.body.innerHTML = `<div id="plan-content"></div>`
      let stale = false
      const cancel = retryFocus(() => document.getElementById('plan-content')!, 'household', null, () => stale)
      // Nothing to land on yet: it keeps asking for frames.
      frames.shift()!()
      expect(frames).toHaveLength(1)
      // The person navigated or focused a control of their own: the next frame does nothing more.
      stale = true
      document.getElementById('plan-content')!.innerHTML = `<input id="bad" aria-invalid="true" />`
      document.getElementById('bad')!.scrollIntoView = vi.fn()
      frames.shift()!()
      expect(frames).toHaveLength(0)
      expect(document.activeElement?.id).not.toBe('bad')
      // And an explicit cancel drops a pending frame.
      stale = false
      const cancel2 = retryFocus(() => document.body, 'household', null, () => false)
      cancel2()
      expect(cancelAnimationFrame).toHaveBeenCalled()
      cancel()
    } finally {
      vi.unstubAllGlobals()
    }
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
