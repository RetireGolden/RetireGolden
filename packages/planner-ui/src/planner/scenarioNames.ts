/**
 * Scenario row names (#480): two rows must never share a label, or their
 * Compare and Remove controls share an accessible name too.
 */

/** "Name", then "Name (2)", "Name (3)"... until the name is free. */
export function uniqueScenarioName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.includes(candidate)) return candidate
  }
}
