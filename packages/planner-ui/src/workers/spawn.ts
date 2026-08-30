/**
 * The one place the planner names its worker entry.
 *
 * The `new Worker(new URL('./planner.worker.ts', import.meta.url), { type:
 * 'module' })` literal has to stay literal — that is what the bundler pattern
 * matches to emit the worker chunk. Every surface spawns through here so the
 * app emits exactly one worker bundle (see ./channels.ts).
 */

export function spawnPlannerWorker(): Worker {
  return new Worker(new URL('./planner.worker.ts', import.meta.url), { type: 'module' })
}
