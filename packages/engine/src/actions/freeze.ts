/**
 * Recursively freezes a value and everything reachable from it, then returns
 * the same reference.
 *
 * Two properties matter to the action modules that publish frozen results, and
 * both are why this is one shared function rather than a copy per module:
 *
 * - **Cycle-safe.** Traversal is guarded by a `visited` set, so a graph that
 *   reaches itself terminates instead of overflowing the stack.
 * - **No already-frozen short circuit.** `Object.isFrozen(parent)` says nothing
 *   about the parent's children: freezing a parent whose children are still
 *   mutable is exactly the state a short-circuiting walk leaves behind, and
 *   skipping such a parent leaves unfrozen children reachable through a frozen
 *   root. Descending regardless is what makes "frozen" mean deeply frozen.
 *
 * `Object.values` is the traversal step, matching the JSON-shaped trees these
 * modules publish: own enumerable string-keyed properties, array elements
 * included. Non-objects are returned untouched.
 */
export function deepFreeze<T>(value: T, visited: WeakSet<object> = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === 'object' && !visited.has(value)) {
    visited.add(value)
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child, visited)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}
