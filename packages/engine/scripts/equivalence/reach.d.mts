/**
 * Declarations for the reach recorder, so the inspector-wait test can import
 * it under strict TypeScript without pulling `scripts/` into the compiled
 * package surface.
 */

export interface SpecEntry {
  id: string
  label: string
  file: string
  lines: [number, number]
}

export declare class ReachRecorder {
  constructor(spec: readonly SpecEntry[])
  enable(): Promise<void>
  arm(): Promise<void>
  post(method: string, params?: object): Promise<unknown>
  take(label: string): Promise<void>
  close(): Promise<void>
  report(): object
}
