/**
 * The one place the planner names its worker entry.
 *
 * The `new Worker(new URL('./planner.worker.ts', import.meta.url), { type:
 * 'module' })` literal has to stay literal — that is what the bundler pattern
 * matches to emit the worker chunk. Every surface spawns through here so the
 * app emits exactly one worker bundle (see ./channels.ts).
 *
 * Where `Worker` does not exist, the runners (../mc/pool.ts,
 * ../optimize/runner.ts, ../optimize/spendingRunner.ts,
 * ../relocation/runner.ts) compute in-process only in a development build
 * (`import.meta.env.DEV`: vitest, the dev server, and the scripts that load the
 * planner through Vite's dev-mode SSR). A production build compiles that path
 * out, so its main bundle does not carry a second copy of every solver the
 * worker already ships; there it lands here, and the throw below reaches the
 * page through runWorkerRequest's error path (./run.ts) as a stated reason
 * rather than a bare "Worker is not defined".
 *
 * The guards read `typeof Worker === 'undefined' && import.meta.env.DEV`, Worker
 * first on purpose: wherever Worker exists the test stops before touching
 * `import.meta.env`, so a bundler that leaves `import.meta.env` undefined never
 * throws there. Under Vite, DEV is the literal `false` in production, so the
 * condition is still statically false and the in-process imports drop out
 * (the build is byte-identical to the DEV-first order).
 */

/** What a production build says when this runtime cannot start the planner worker. */
export const WORKER_UNAVAILABLE_MESSAGE =
  "This browser can't run calculations in the background, which this page needs. " +
  'Open RetireGolden in an up-to-date browser to see this result.'

/**
 * Typed so a page whose failure well says "run it again" (../planner/engineRefusalCopy.ts)
 * can show this reason alone: running again cannot help when there is no Worker.
 */
export class WorkerUnavailableError extends Error {
  constructor() {
    super(WORKER_UNAVAILABLE_MESSAGE)
    this.name = 'WorkerUnavailableError'
  }
}

export function spawnPlannerWorker(): Worker {
  if (typeof Worker === 'undefined') throw new WorkerUnavailableError()
  return new Worker(new URL('./planner.worker.ts', import.meta.url), { type: 'module' })
}
