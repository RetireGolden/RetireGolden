/**
 * Tolerance assertions for money and percentages. Deliberately framework-free
 * (a thrown Error fails a test in any runner), so `@retiregolden/engine/testing/*`
 * carries no runtime dependency on vitest for consumers.
 */

function expectWithin(kind: string, actual: number, expected: number, tolerance: number): void {
  const delta = Math.abs(actual - expected)
  if (Number.isNaN(delta) || delta > tolerance) {
    throw new Error(`expected ${kind} ${actual} to be within ${tolerance} of ${expected} (off by ${delta})`)
  }
}

export function expectMoney(actual: number, expected: number, tolerance = 0.01): void {
  expectWithin('money', actual, expected, tolerance)
}

export function expectPercent(actual: number, expected: number, tolerance = 0.0001): void {
  expectWithin('percent', actual, expected, tolerance)
}
