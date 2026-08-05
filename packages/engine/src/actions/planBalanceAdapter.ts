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
 * Adapts a Plan balance to the whole cents that balance can actually fund.
 *
 * The difference from `planDollarsToLedgerCents` is the rounding direction, and
 * it matters exactly where a snapshot is used as a spending capacity rather
 * than as a measurement. Half-up rounding can report up to half a cent more
 * than the account holds, and an executor that sizes a movement against that
 * figure will authorise a cent the balance cannot cover; the ledger then either
 * overdraws or has to break the exact before/amount/after chain to avoid it.
 * Truncating cannot: the result is always at or below the live figure, so a
 * movement sized against it is always fundable.
 *
 * The residue this leaves is a fraction of a cent that the exact-cent ledger
 * has no way to express, and it stays in the account rather than being
 * distributed or silently dropped. A drained source therefore closes at that
 * residue rather than at a hard zero.
 */
export function planDollarsToFlooredLedgerCents(dollars: number): UsdCents {
  const rounded = planDollarsToRoundedCentsBigInt(dollars)
  // `planDollarsToRoundedCentsBigInt` rounds half-up over the exact decimal
  // spelling, so it overshoots by exactly one cent whenever the truncated
  // value differs, and never by more.
  const cents = Number(rounded) / 100 > dollars ? rounded - 1n : rounded
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

/**
 * Converts a signed aggregate exact-cent total to Plan dollars without
 * allowing a precision-changing round trip or JavaScript negative zero.
 */
export function signedLedgerCentTotalToPlanDollars(cents: bigint): number {
  if (cents === 0n) return 0
  const absoluteDollars = ledgerCentTotalToPlanDollars(
    cents < 0n ? -cents : cents,
  )
  return cents < 0n ? -absoluteDollars : absoluteDollars
}
