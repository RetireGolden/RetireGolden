/**
 * Allocates exact minor units by a nonnegative rational ratio and rounds the
 * single result to nearest minor unit, with an exact half rounding up.
 *
 * Callers own domain validation. In particular, the denominator must be
 * positive and all three inputs must be nonnegative integer minor units.
 * Keeping the complete product in bigint avoids binary floating-point and
 * unsafe-number intermediates.
 */
export function exactCentProRataNearestHalfUp(
  amountMinorUnits: bigint,
  ratioNumeratorMinorUnits: bigint,
  ratioDenominatorMinorUnits: bigint,
): bigint {
  const numerator = amountMinorUnits * ratioNumeratorMinorUnits
  const quotient = numerator / ratioDenominatorMinorUnits
  const remainder = numerator % ratioDenominatorMinorUnits
  return quotient +
    (remainder * 2n >= ratioDenominatorMinorUnits ? 1n : 0n)
}
