import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

interface DecimalParts {
  coefficient: bigint
  decimalPlaces: number
  exponent: number
}

function decimalParts(value: number): DecimalParts {
  const spelling = String(value)
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(spelling)
  if (match === null) {
    throw new RangeError('Plan dollar balance must have a nonnegative finite decimal spelling')
  }
  const fraction = match[2] ?? ''
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    decimalPlaces: fraction.length,
    exponent: Number(match[3] ?? 0),
  }
}

function planDollarsToRoundedCentsBigInt(dollars: number): bigint {
  if (!Number.isFinite(dollars) || dollars < 0 || Object.is(dollars, -0)) {
    throw new RangeError('Plan dollar balance must be finite, nonnegative, and not negative zero')
  }

  const { coefficient, decimalPlaces, exponent } = decimalParts(dollars)
  const centScale = exponent + 2 - decimalPlaces
  if (centScale >= 0) {
    return coefficient * 10n ** BigInt(centScale)
  }

  const divisor = 10n ** BigInt(-centScale)
  const quotient = coefficient / divisor
  const remainder = coefficient % divisor
  return quotient + (remainder * 2n >= divisor ? 1n : 0n)
}

/**
 * Adapts a Plan's floating-point dollar balance to the exact-cent action ledger.
 *
 * The finite JavaScript number's decimal spelling is authoritative. Conversion
 * uses nonnegative nearest-cent, half-up rounding with integer arithmetic.
 */
export function planDollarsToLedgerCents(dollars: number): UsdCents {
  const cents = planDollarsToRoundedCentsBigInt(dollars)
  if (cents > MAX_SAFE_CENTS) {
    throw new RangeError('Plan dollar balance exceeds the exact-cent safe-integer range')
  }
  return asUsdCents(Number(cents))
}

/**
 * Converts validated ledger cents back to Plan dollars without silently
 * crossing a binary-number precision boundary.
 */
export function ledgerCentsToPlanDollars(cents: UsdCents): number {
  const validatedCents = usdCentsSchema.parse(cents)
  const dollars = validatedCents / 100
  if (planDollarsToLedgerCents(dollars) !== validatedCents) {
    throw new RangeError('Ledger cents cannot be represented exactly by a Plan dollar number')
  }
  return dollars
}

/**
 * Converts an aggregate exact-cent total to Plan dollars without requiring the
 * aggregate to fit the individual-ledger safe-integer brand.
 */
export function ledgerCentTotalToPlanDollars(cents: bigint): number {
  if (cents < 0n) {
    throw new RangeError('Aggregate ledger cents must be nonnegative')
  }
  const dollars = Number(cents) / 100
  if (
    !Number.isFinite(dollars) ||
    planDollarsToRoundedCentsBigInt(dollars) !== cents
  ) {
    throw new RangeError('Aggregate ledger cents cannot be represented exactly by a Plan dollar number')
  }
  return dollars
}
