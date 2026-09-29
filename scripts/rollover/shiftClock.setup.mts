/**
 * The rollover run's clock (decision D-2027-ROLLOVER, 2026-09-28).
 *
 * The weekly rollover CI job (.github/workflows/rollover.yml) runs the engine,
 * planner-ui and app suites as they would run on the next 1 January and on
 * the two New Year's Eve instants that straddle it, so what changes at the
 * turn of the year is seen two months ahead, every year. Each package's
 * vitest config adds this file to its setup files only when one of these is
 * set, so an ordinary run is untouched:
 *
 * - `RG_ROLLOVER_CLOCK`: an ISO instant. Every `new Date()`, `Date()` and
 *   `Date.now()` then reads the real time plus a fixed offset, so the
 *   calendar is that instant's while time still moves (timers, debounces and
 *   timeouts behave as usual). A test that installs its own fake clock
 *   (`vi.useFakeTimers` + `vi.setSystemTime`) still pins its own instant: the
 *   fake clock replaces this `Date` while installed and restores it after.
 * - `RG_ROLLOVER_TZ`: an IANA zone, applied at runtime (`process.env.TZ`),
 *   which Node honours on every platform; a zone set before Node starts is
 *   ignored on Windows.
 *
 * The shifted `Date` is a `Proxy` over the real one (review L6, 2026-09-29):
 * a subclass cannot be called without `new`, and `Date()` called as a
 * function, which returns the current time as a string, then threw.
 */

/**
 * `RealDate` with its "now" moved by `offsetMs`: constructing with no
 * arguments, calling as a function and `now()` read the shifted time; every
 * other construction, `parse`, `UTC`, the prototype and `instanceof` are the
 * real `Date`'s. Exported for its test (`packages/engine/src/testing/rolloverClock.test.ts`).
 */
export function shiftedDate(RealDate: DateConstructor, offsetMs: number): DateConstructor {
  const now = (): number => RealDate.now() + offsetMs
  return new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [now()] : args, newTarget) as object
    },
    apply(target) {
      // `Date(...)` ignores its arguments and returns the current time as a string.
      return new target(now()).toString()
    },
    get(target, property, receiver) {
      if (property === 'now') return now
      return Reflect.get(target, property, receiver) as unknown
    },
  })
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

if (env['RG_ROLLOVER_TZ']) env['TZ'] = env['RG_ROLLOVER_TZ']

const target = env['RG_ROLLOVER_CLOCK']
if (target) {
  const holder = globalThis as unknown as { __rgRolloverRealDate?: DateConstructor; Date: DateConstructor }
  const RealDate = (holder.__rgRolloverRealDate ??= holder.Date)
  const targetMs = RealDate.parse(target)
  if (!Number.isFinite(targetMs)) throw new Error(`RG_ROLLOVER_CLOCK is not an instant: ${target}`)
  holder.Date = shiftedDate(RealDate, targetMs - RealDate.now())
}
