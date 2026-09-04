/**
 * Shared scaffolding for the `simulate.*Delegation.test.ts` seam guards.
 *
 * **The policy these specs enforce.** A byte-equivalent projection cannot
 * distinguish delegation from an orphaned helper sitting beside a re-inlined
 * caller: the differential oracle in `scripts/equivalence.mjs` compares the
 * engine against itself and passes either way, and so does a caller that
 * rebuilds a helper's payload field for field. Each seam guard therefore mocks
 * one extracted helper, runs the REAL implementation first so the natural
 * result is on record, and then returns deliberately different references and
 * scalars. The published year has to consume those injected values, which
 * proves both that the call happens and that the caller-side wiring is real.
 * The load-bearing assertion is `toBe` (identity), never `toEqual`.
 *
 * **What is shared and what cannot be.** Vitest hoists every `vi.mock` call
 * above the file's imports and needs the module specifier resolvable at that
 * point, so the specifier stays a literal in each spec. A `vi.hoisted`
 * variable does work as the argument (verified against Vitest 4.1), but the
 * literal has to be written in the spec anyway because it resolves relative to
 * the spec file, so nothing is gained by moving it. A statically imported
 * helper is NOT callable inside `vi.hoisted` (temporal dead zone), which is
 * why the recorder below is built through an `await vi.hoisted(async () =>
 * (await import(...)).createSeamRecorder())`. The mock factory itself runs
 * lazily and can close over that recorder normally.
 *
 * The shape a migrated spec keeps:
 *
 * ```ts
 * const seam = await vi.hoisted(async () =>
 *   (
 *     await import('./simulate.seamGuard.test-support.js')
 *   ).createSeamRecorder<AnnualThingInput, AnnualThingResult>(),
 * )
 *
 * vi.mock('./internal/annualThing.js', async (importOriginal) =>
 *   seam.through(
 *     await importOriginal<typeof import('./internal/annualThing.js')>(),
 *     'annualThing',
 *     (natural, { ordinal }) => ({ ...natural, total: 2_001 + ordinal }),
 *   ),
 * )
 * ```
 *
 * One literal specifier, one call into this module, and the sentinels stay in
 * the spec where a reader can see what makes them distinguishable.
 *
 * **Scope.** `through` wraps a single-argument exported function, which is the
 * shape every extracted annual phase has. A seam that takes more arguments, or
 * that needs a `vi.fn` wrapper around a function the result carries, keeps its
 * hand-written factory; there is no benefit in bending this helper around
 * those.
 *
 * Excluded from `dist` by `tsconfig.build.json`'s `*.test-support.ts` rule, so
 * the `vitest` import below never reaches a consumer.
 */
import { expect } from 'vitest'

/** Context handed to an injector for one pass through the seam. */
export interface SeamInjection<TInput> {
  /** The argument the caller handed the helper, by reference. */
  readonly input: TInput
  /** 0-based order of this call within the recorder, for per-year sentinels. */
  readonly ordinal: number
}

/** One recorded pass through a delegation seam. */
export interface SeamCall<TInput, TResult, TCaptured = undefined> {
  /** 0-based order of this call within the recorder. */
  readonly ordinal: number
  /** The argument the caller handed the helper, by reference. */
  readonly input: TInput
  /** What the real helper produced for that argument. */
  readonly natural: TResult
  /** What the seam returned to the caller instead. */
  readonly injected: TResult
  /**
   * Whatever `options.capture` snapshotted, taken BEFORE the real helper ran.
   * `undefined` when no capture was supplied. This exists for the inputs that
   * are live mutable collections, where reading them after the projection has
   * moved on would report the wrong thing.
   */
  readonly captured: TCaptured
}

/** Builds the value the seam returns in place of the helper's own result. */
export type SeamInjector<TInput, TResult> = (
  natural: TResult,
  injection: SeamInjection<TInput>,
) => TResult

export interface SeamThroughOptions<TInput, TCaptured> {
  /** Snapshot of live input state, taken before the real helper runs. */
  readonly capture?: (input: TInput) => TCaptured
}

export interface SeamRecorder<TInput, TResult, TCaptured = undefined> {
  /** Every pass through the seam, in call order. */
  readonly calls: readonly SeamCall<TInput, TResult, TCaptured>[]
  /** Drop the recorded calls, for a `beforeEach` or a second projection run. */
  reset(): void
  /**
   * The mock factory body: returns the original module namespace with
   * `exportName` replaced by a wrapper that runs the real implementation,
   * records the pass, and returns the injected result.
   */
  through<TModule extends object>(
    original: TModule,
    exportName: keyof TModule & string,
    inject: SeamInjector<TInput, TResult>,
    options?: SeamThroughOptions<TInput, TCaptured>,
  ): TModule
}

export function createSeamRecorder<
  TInput,
  TResult,
  TCaptured = undefined,
>(): SeamRecorder<TInput, TResult, TCaptured> {
  const calls: SeamCall<TInput, TResult, TCaptured>[] = []

  return {
    calls,
    reset() {
      calls.length = 0
    },
    through<TModule extends object>(
      original: TModule,
      exportName: keyof TModule & string,
      inject: SeamInjector<TInput, TResult>,
      options: SeamThroughOptions<TInput, TCaptured> = {},
    ): TModule {
      const real = (original as Record<string, unknown>)[exportName]
      if (typeof real !== 'function') {
        throw new Error(
          `seam guard: '${exportName}' is not an exported function of the mocked module`,
        )
      }
      const call = real as (input: TInput) => TResult
      const wrapped = (input: TInput): TResult => {
        const ordinal = calls.length
        const captured = options.capture?.(input) as TCaptured
        const natural = call(input)
        const injected = inject(natural, { input, ordinal })
        calls.push({ ordinal, input, natural, injected, captured })
        return injected
      }
      return { ...original, [exportName]: wrapped } as TModule
    },
  }
}

/**
 * Assert the projection entered the seam exactly `times`, and hand back the
 * recorded calls so the caller indexes a plain array rather than a `readonly`
 * one full of `!`.
 */
export function expectSeamRan<TInput, TResult, TCaptured>(
  recorder: SeamRecorder<TInput, TResult, TCaptured>,
  times: number,
): readonly SeamCall<TInput, TResult, TCaptured>[] {
  expect(recorder.calls.length, 'passes through the delegation seam').toBe(times)
  return recorder.calls
}

/**
 * Assert the seam ran at all. A guard whose seam never fires proves nothing,
 * and an empty `for` loop over the calls would pass silently.
 */
export function expectSeamRanAtLeastOnce<TInput, TResult, TCaptured>(
  recorder: SeamRecorder<TInput, TResult, TCaptured>,
): readonly SeamCall<TInput, TResult, TCaptured>[] {
  expect(
    recorder.calls.length,
    'passes through the delegation seam',
  ).toBeGreaterThan(0)
  return recorder.calls
}

/**
 * The load-bearing check: the published value IS the object the seam injected,
 * not a field-for-field rebuild of it. `toEqual` here would pass against a
 * caller that reassembled the payload itself, which is exactly the failure
 * these guards exist to catch.
 */
export function expectPublishedFromSeam<TValue>(
  published: unknown,
  injected: TValue,
  what: string,
): void {
  expect(published, `${what} must be the seam's own object, not a rebuild`).toBe(
    injected,
  )
}

/**
 * Assert every pass injected a distinct object, so a caller that computed the
 * first year and cached it cannot pass a multi-year fixture.
 */
export function expectDistinctInjections<TInput, TResult, TCaptured>(
  recorder: SeamRecorder<TInput, TResult, TCaptured>,
): void {
  expect(
    new Set(recorder.calls.map((call) => call.injected)).size,
    'each pass must inject a distinguishable result',
  ).toBe(recorder.calls.length)
}
