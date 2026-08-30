/**
 * Shared async-settling helpers for the jsdom tests.
 *
 * All but `sleep` wrap the wait in `act()`, which is the whole reason they
 * exist as a module rather than as a line of code per test file: an unwrapped
 * `await new Promise(setTimeout)` lets React land state updates outside act,
 * which React reports as an un-acted update and which leaves the assertion
 * reading a DOM one render behind. `sleep` is the deliberate exception, for
 * callers already inside their own `act()` scope.
 */
import { act } from 'react'

/**
 * The planner's autosave debounce is 600 ms; this is that plus headroom, so a
 * test that wants the save to have happened can wait one honest interval
 * instead of guessing.
 */
export const AUTOSAVE_SETTLE_MS = 750

/**
 * A bare timer promise, for use *inside* an `act()` scope a caller already
 * opened (the common "click, then wait out the debounce in the same act"
 * shape). Outside one, reach for `advanceBy` instead so the wait is acted.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Hand the scheduler `ms` of real time inside `act()`. */
export function advanceBy(ms: number): Promise<void> {
  return act(async () => {
    await sleep(ms)
  })
}

/** Wait past the autosave debounce, flushing whatever the save queued. */
export function settleAutosave(): Promise<void> {
  return advanceBy(AUTOSAVE_SETTLE_MS)
}

/**
 * Drain `passes` rounds of queued async work. Chains that hop between
 * microtasks and timers — load, miss, build from the registry, write to
 * IndexedDB, adopt, where fake-indexeddb settles on timers — need more than
 * one pass, and each pass has to be its own `act()` so the render it unblocks
 * is flushed before the next one starts.
 */
export async function settle(passes = 4): Promise<void> {
  for (let pass = 0; pass < passes; pass++) {
    await advanceBy(0)
  }
}

export interface WaitForOptions {
  /** What the caller was waiting for, used in the timeout message. */
  readonly what?: string
  /**
   * Poll attempts before giving up. The default is sized to trip inside
   * vitest's 5 s test timeout, so a genuine hang is reported as "timed out
   * waiting for X" rather than as an assertion against an empty DOM.
   *
   * It is deliberately NOT sized to cover a cold `lazy()` route chunk: that
   * graph takes seconds to evaluate the first time anything in a run imports
   * it, which no honest poll budget fits inside a 5 s test. A file that waits
   * on a lazy route makes that chunk warm before the wait instead — either by
   * preloading it in `beforeAll` (./lazyRoutes.ts) or by importing the module
   * statically, as learn.test.tsx does for LearnRoutes; a top-level import is
   * evaluated before the file's tests run, so it settles the same question.
   * Either way, raising this number is the wrong fix for such a timeout: it
   * converts an ordering bug into a slower ordering bug.
   */
  readonly attempts?: number
  /** Real milliseconds handed to the scheduler between attempts. */
  readonly intervalMs?: number
  /**
   * Extra context appended to the timeout message, e.g. the host's text.
   * Omit it and the message carries the document's own text instead, so a
   * raw `waitFor` still reports what the DOM actually held.
   */
  readonly describe?: () => string
}

/** How much rendered text a timeout message carries before it is cut off. */
const TIMEOUT_TEXT_LIMIT = 2000

/**
 * The rendered text a timeout should report when the caller named no
 * `describe`. Truncated because a whole workspace render is thousands of
 * characters of layout chrome, and the first screenful is where the answer
 * is. Guarded for `document` so a helper called from a non-jsdom environment
 * degrades to the bare message rather than throwing over the real failure.
 */
function renderedTextDump(): string {
  if (typeof document === 'undefined') return ''
  const text = document.body?.textContent ?? ''
  return text.length > TIMEOUT_TEXT_LIMIT ? `${text.slice(0, TIMEOUT_TEXT_LIMIT)}… (truncated)` : text
}

/**
 * Poll `predicate` until it holds, giving React a real macrotask inside
 * `act()` between attempts. Prefer this over a fixed sleep: it returns as
 * soon as the condition is observable rather than always paying the worst
 * case, and it fails with a message instead of a bare assertion mismatch.
 *
 * The timeout names what the DOM held at the end. Callers waiting on one host
 * pass `describe` to narrow that to their own subtree; callers polling a
 * predicate of their own get the document dump by default, which is the
 * diagnostic the per-file helpers this replaced used to append by hand.
 */
export async function waitFor(predicate: () => boolean, options: WaitForOptions = {}): Promise<void> {
  const { what = 'expected render', attempts = 200, intervalMs = 10, describe } = options
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (predicate()) return
    await advanceBy(intervalMs)
  }
  if (predicate()) return
  const detail = describe ? describe() : renderedTextDump()
  const context = detail === '' ? '' : `; got: ${detail}`
  throw new Error(`Timed out waiting for ${what}${context}`)
}

/** Poll until `host` renders `text` somewhere inside it. */
export function waitForText(host: HTMLElement, text: string, options: WaitForOptions = {}): Promise<void> {
  return waitFor(() => host.textContent?.includes(text) === true, {
    what: text,
    describe: () => host.textContent ?? '',
    ...options,
  })
}

/** Poll until `host` matches `selector`. */
export function waitForSelector(host: HTMLElement, selector: string, options: WaitForOptions = {}): Promise<void> {
  return waitFor(() => host.querySelector(selector) !== null, {
    what: selector,
    describe: () => host.textContent ?? '',
    ...options,
  })
}
