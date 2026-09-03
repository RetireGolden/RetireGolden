import type { SimulatorAnnualPassValueBinding } from '../annualPassTransaction.js'

/**
 * The read/write adapters for one record of money-bearing phase scalars.
 *
 * A grouped annual phase used to receive its scalars as plain numbers on a
 * mutable ledger object and the caller copied each one back by hand after the
 * call. That copy-out was invisible to the compiler: adding an eleventh scalar
 * and forgetting its line silently discarded the phase's mutation. Binding the
 * scalars instead means the phase writes straight through to the simulator's
 * own local, so there is no copy-out step left to forget.
 */
export type PhaseLedgerScalarBindings<S> = {
  readonly [K in keyof S]-?: SimulatorAnnualPassValueBinding<S[K]>
}

/**
 * Read every bound scalar into a plain record, once, at the top of a phase.
 *
 * Driven by the binding record's own keys rather than a second hand-written
 * list, so the opening snapshot cannot fall behind the interface.
 */
export function readPhaseLedgerScalars<S extends object>(
  bindings: PhaseLedgerScalarBindings<S>,
): S {
  const values = {} as S
  for (const key of Object.keys(bindings) as (keyof S)[]) {
    values[key] = bindings[key].read()
  }
  return values
}

/**
 * Write a complete record of closing values back through their bindings.
 *
 * `values` is typed as the whole scalar record, so a phase that grows a scalar
 * and forgets it here is a compile error (`Property 'x' is missing`) rather
 * than a silently dropped mutation.
 */
export function writePhaseLedgerScalars<S extends object>(
  bindings: PhaseLedgerScalarBindings<S>,
  values: S,
): void {
  for (const key of Object.keys(bindings) as (keyof S)[]) {
    bindings[key].write(values[key])
  }
}
