/**
 * Package-wide vitest setup, wired through `test.setupFiles` in
 * `vite.config.ts`. It runs before every test file, node and jsdom alike.
 *
 * React's `act()` only drains its work queue when the environment declares
 * itself an act environment. Seven jsdom test files used to declare it with
 * their own copy of this one statement; every other jsdom file in the package
 * called `act()` without it, so React printed "The current testing
 * environment is not configured to support act(...)" and then did NOT flush
 * the updates the call had asked it to flush — the tests were polling for
 * renders that only landed when the scheduler got around to them.
 *
 * Declaring it once, for the whole package, is the point of this file.
 * Node-environment tests never load React, so the flag is inert there.
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
