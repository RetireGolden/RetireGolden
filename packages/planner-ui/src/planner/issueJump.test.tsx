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

  it('never settles for another invalid control when the first issue names a path (r3-1)', () => {
    // The first engine issue is on Household; the page in front is Accounts,
    // where a balance is invalid too. The chip promises the first thing to
    // fix, so this must fail and let the caller navigate.
    document.body.innerHTML = `<input id="other" aria-invalid="true" data-path="accounts.0.balance" />`
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = vi.fn()
    expect(focusIssueTarget(document, 'household', 'household.people.0.longevity.planningAge')).toBe(false)
    expect(document.activeElement?.id).not.toBe('other')
    // A transient range flag on the field being typed in is the same story.
    document.body.innerHTML = `
      <input id="typing" aria-invalid="true" />
      <ul class="issue-list" id="plan-issues-household" tabindex="-1"></ul>`
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) el.scrollIntoView = vi.fn()
    expect(focusIssueTarget(document, 'household', 'household.people.0.longevity.planningAge')).toBe(true)
    expect(document.activeElement?.id).toBe('plan-issues-household')
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

  it('sends a capital-loss carryforward issue to Strategy, where its field is, and lands on that field (#553)', () => {
    const issues = ['household.capitalLossCarryforward: Too small: expected number to be >=0']
    expect(firstIssue(issues)).toEqual({ section: 'strategy', path: 'household.capitalLossCarryforward' })
    expect(routeForIssues(issues)).toBe('strategy')
    // On Strategy the control wired to the path is the target, not the list.
    document.body.innerHTML = `
      <ul class="issue-list" id="plan-issues-strategy" tabindex="-1"></ul>
      <input id="carry" aria-invalid="true" data-path="household.capitalLossCarryforward" />
    `
    expect(focusIssueTarget(document, 'strategy', 'household.capitalLossCarryforward')).toBe(true)
    expect(document.activeElement?.id).toBe('carry')
    // On Household there is no such field and no Strategy list: nothing to land on, so the caller navigates.
    document.body.innerHTML = `<ul class="issue-list" id="plan-issues-household" tabindex="-1"></ul>`
    expect(focusIssueTarget(document, 'strategy', 'household.capitalLossCarryforward')).toBe(false)
  })

  it('opens the disclosures a target is hidden behind, so the jump never reports success on a field nobody can see (r1-1)', () => {
    // The Social Security card keeps SSDI (and the AIME explainer) behind a
    // closed <details>. Focus does nothing to a control inside one, so without
    // this the chip would return true and the caller would skip the fallback,
    // leaving the person on a card with the flagged field still collapsed.
    document.body.innerHTML = `
      <ul class="issue-list" id="plan-issues-social-security" tabindex="-1"></ul>
      <details id="outer">
        <summary>Disability (SSDI)</summary>
        <details id="inner">
          <summary>More</summary>
          <input id="onset" aria-invalid="true" data-path="incomes.2.disability.onsetAge" />
        </details>
      </details>
    `
    const outer = document.getElementById('outer') as HTMLDetailsElement
    const inner = document.getElementById('inner') as HTMLDetailsElement
    expect(outer.open, 'closed to begin with, as the card renders it').toBe(false)
    expect(inner.open).toBe(false)
    expect(focusIssueTarget(document, 'social-security', 'incomes.2.disability.onsetAge')).toBe(true)
    // Every disclosure on the way to the control, not only the nearest one.
    expect(outer.open).toBe(true)
    expect(inner.open).toBe(true)
    expect(document.activeElement?.id).toBe('onset')
  })

  it('leaves a target that is not behind a disclosure alone, and never opens an unrelated one', () => {
    document.body.innerHTML = `
      <details id="elsewhere"><summary>Other</summary><input id="other" /></details>
      <input id="carry" aria-invalid="true" data-path="household.capitalLossCarryforward" />
    `
    expect(focusIssueTarget(document, 'strategy', 'household.capitalLossCarryforward')).toBe(true)
    expect(document.activeElement?.id).toBe('carry')
    expect((document.getElementById('elsewhere') as HTMLDetailsElement).open).toBe(false)
  })
})
