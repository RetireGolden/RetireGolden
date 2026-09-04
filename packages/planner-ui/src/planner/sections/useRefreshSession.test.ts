/** @vitest-environment jsdom */
/**
 * The refresh concurrency session, driven directly — no broker CSV, no file
 * read, no IndexedDB, no DOM beyond the probe React needs to run a hook.
 *
 * `UpdateBalancesPanel.test.tsx` pins the same invariants end to end, which is
 * what proves the panel is wired to them; these specs pin them where they are
 * DECIDED. That matters because the panel can only reach a guard through a
 * staged race (a hand-resolved `file.text()`, a durable write suspended
 * mid-apply), so some combinations — a token that outlives BOTH a plan swap and
 * a protection cycle, the write slot being shared across apply and restore — are
 * far cheaper to state here than to stage there.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useRefreshSession, type RefreshSession } from './useRefreshSession'

interface Props {
  planId: string
  protectionPending: boolean
}

/** What one render of the hook reported to its caller during render. */
interface RenderFlags {
  planChanged: boolean
  protectionWentUnknown: boolean
}

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

interface Harness {
  /** The session the most recent render returned. */
  readonly session: RefreshSession
  /** Re-render the probe with new props, inside `act`. */
  render: (props: Props) => void
  /**
   * The render-phase flags from every render since the last call, then clears
   * them. A render-phase state adjustment makes React re-run the component, so
   * a single `render(...)` can log more than one entry — which is exactly the
   * shape these specs assert against (the flag fires, then settles false).
   */
  drainFlags: () => RenderFlags[]
}

function mount(initial: Props): Harness {
  let latest: RefreshSession | null = null
  const flags: RenderFlags[] = []
  function Probe({ planId, protectionPending }: Props) {
    const session = useRefreshSession(planId, protectionPending)
    latest = session
    flags.push({ planChanged: session.planChanged, protectionWentUnknown: session.protectionWentUnknown })
    return null
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const render = (props: Props) => {
    act(() => {
      root!.render(createElement(Probe, props))
    })
  }
  render(initial)
  return {
    get session() {
      if (latest === null) throw new Error('the probe never rendered')
      return latest
    },
    render,
    drainFlags: () => flags.splice(0, flags.length),
  }
}

describe('useRefreshSession', () => {
  it('carries the plan a read belongs to on its token', () => {
    // The async work needs the plan it started under — for the mappings load, the
    // snapshot store, the mutator guard — and reading it off the token is what
    // keeps that value and the identity check from ever disagreeing.
    const h = mount({ planId: 'p1', protectionPending: false })
    expect(h.session.beginRead().planId).toBe('p1')
  })

  it('makes a newer read supersede an older outstanding one', () => {
    // Two files chosen back-to-back share a plan identity and a protection state,
    // so only the per-read epoch can make the OLDER read lose.
    const h = mount({ planId: 'p1', protectionPending: false })
    const first = h.session.beginRead()
    const second = h.session.beginRead()

    expect(h.session.isCurrent(first)).toBe(false)
    expect(h.session.isCurrent(second)).toBe(true)
  })

  it('leaves an outstanding read current across a plain re-render', () => {
    // The epochs are bumped from handlers only. A ref mutation does not roll back
    // when React discards a concurrent render, so a render-phase bump could
    // invalidate a legitimate read belonging to the still-visible plan.
    const h = mount({ planId: 'p1', protectionPending: false })
    const token = h.session.beginRead()

    h.render({ planId: 'p1', protectionPending: false })
    h.render({ planId: 'p1', protectionPending: false })

    expect(h.session.isCurrent(token)).toBe(true)
  })

  it('discards every kind of work started under a plan the panel has left', () => {
    // Cloned plans share account ids, so a read, apply or restore that began under
    // the old plan would look entirely plausible landing on the new one.
    const h = mount({ planId: 'p1', protectionPending: false })
    const read = h.session.beginRead()
    const applyToken = h.session.beginApply()!
    h.session.endWrite()
    const restoreToken = h.session.beginRestore()!
    h.session.endWrite()

    h.render({ planId: 'p2', protectionPending: false })

    expect(h.session.isCurrent(read)).toBe(false)
    expect(h.session.isCurrent(applyToken)).toBe(false)
    expect(h.session.isCurrent(restoreToken)).toBe(false)
    // Not stuck: work started under the new plan is current.
    expect(h.session.isCurrent(h.session.beginRead())).toBe(true)
  })

  it('raises planChanged on the render where the identity changes, and not after', () => {
    const h = mount({ planId: 'p1', protectionPending: false })
    expect(h.drainFlags().some((flag) => flag.planChanged)).toBe(false)

    h.render({ planId: 'p2', protectionPending: false })
    const swap = h.drainFlags()
    expect(swap.some((flag) => flag.planChanged)).toBe(true)
    // …and it has settled by the time the render commits, so the caller's
    // render-phase reset runs exactly once.
    expect(swap[swap.length - 1]!.planChanged).toBe(false)

    h.render({ planId: 'p2', protectionPending: false })
    expect(h.drainFlags().some((flag) => flag.planChanged)).toBe(false)
  })

  it('raises protectionWentUnknown on the false→true edge only', () => {
    // true→false is the host finishing its load; it re-enables an already-empty
    // panel and must not tear anything down.
    const h = mount({ planId: 'p1', protectionPending: false })
    h.drainFlags()

    h.render({ planId: 'p1', protectionPending: true })
    const entering = h.drainFlags()
    expect(entering.some((flag) => flag.protectionWentUnknown)).toBe(true)
    expect(entering[entering.length - 1]!.protectionWentUnknown).toBe(false)

    h.render({ planId: 'p1', protectionPending: false })
    expect(h.drainFlags().some((flag) => flag.protectionWentUnknown)).toBe(false)
  })

  it('discards work that spanned a whole protection-unknown cycle', () => {
    // The reason the guard is a GENERATION and not the current value: work slow
    // enough to span false→true→false finds only the final false, and a
    // "is protection unknown right now?" check would wave it through.
    const h = mount({ planId: 'p1', protectionPending: false })
    const read = h.session.beginRead()
    const restoreToken = h.session.beginRestore()!
    h.session.endWrite()

    h.render({ planId: 'p1', protectionPending: true })
    h.render({ planId: 'p1', protectionPending: false })

    expect(h.session.isCurrent(read)).toBe(false)
    expect(h.session.isCurrent(restoreToken)).toBe(false)
    expect(h.session.isCurrent(h.session.beginRead())).toBe(true)
  })

  it('invalidates a suspended apply, but not a read or a restore', () => {
    // `invalidate` is "what the preview promises has changed" — Cancel, a
    // re-target, a release. An apply must write exactly what the preview showed.
    // A read IS the newer selection, and a restore reverts a stored snapshot
    // rather than the preview, so neither depends on it.
    const h = mount({ planId: 'p1', protectionPending: false })
    const read = h.session.beginRead()
    const applyToken = h.session.beginApply()!
    h.session.endWrite()
    const restoreToken = h.session.beginRestore()!
    h.session.endWrite()

    h.session.invalidate()

    expect(h.session.isCurrent(applyToken)).toBe(false)
    expect(h.session.isCurrent(read)).toBe(true)
    expect(h.session.isCurrent(restoreToken)).toBe(true)
  })

  it('invalidates a suspended apply when a new read starts', () => {
    // A programmatic file selection can arrive while a durable apply is suspended,
    // even though the visible chooser has been replaced by its preview.
    const h = mount({ planId: 'p1', protectionPending: false })
    const applyToken = h.session.beginApply()!
    h.session.endWrite()

    h.session.beginRead()

    expect(h.session.isCurrent(applyToken)).toBe(false)
  })

  it('lets one durable write run at a time, across apply and restore alike', () => {
    // Apply and restore each persist an undo record before they mutate, and both
    // refuse to start while EITHER is in flight — one slot, not one per operation,
    // or two clicks capture the same before-state.
    const h = mount({ planId: 'p1', protectionPending: false })

    expect(h.session.beginApply()).not.toBeNull()
    expect(h.session.beginApply()).toBeNull()
    expect(h.session.beginRestore()).toBeNull()

    h.session.endWrite()
    expect(h.session.beginRestore()).not.toBeNull()
    expect(h.session.beginApply()).toBeNull()

    h.session.endWrite()
    expect(h.session.beginApply()).not.toBeNull()
  })

  it('does not let the write slot block a file read', () => {
    // Reads take no slot: choosing a new file while an apply is suspended is the
    // supported way to abandon it, so it must not be refused.
    const h = mount({ planId: 'p1', protectionPending: false })
    h.session.beginApply()

    const read = h.session.beginRead()

    expect(h.session.isCurrent(read)).toBe(true)
  })
})
