import { expect } from 'vitest'

export function expectMoney(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

export function expectPercent(actual: number, expected: number, tolerance = 0.0001): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}
