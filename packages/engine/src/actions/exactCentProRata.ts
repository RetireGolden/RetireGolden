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

/**
 * Rounds one exact nonnegative rational quantity of minor units to a whole
 * minor unit, with an exact half rounding up.
 *
 * This is the degenerate pro rata — `exactCentProRataNearestHalfUp` taking the
 * whole of its ratio — and it exists because the two callers mean different
 * things. A pro rata asks what share of someone else's amount a weight earns.
 * This asks what a quantity that is already an amount in its own right is worth
 * once the currency's minor unit is imposed on it, which is the question a
 * modeled annual tax liability carrying a fractional cent has to answer before
 * anything can be allocated against it. Naming the two separately keeps a
 * reader from having to decide which of `1n` and the denominator is the weight.
 *
 * Callers own domain validation: the numerator must be nonnegative and the
 * denominator positive, both in exact minor units.
 */
export function exactCentNearestHalfUp(
  numeratorMinorUnits: bigint,
  denominatorMinorUnits: bigint,
): bigint {
  return exactCentProRataNearestHalfUp(numeratorMinorUnits, 1n, denominatorMinorUnits)
}

/**
 * Splits one exact-cent amount across weighted parts so the parts sum to the
 * whole exactly.
 *
 * Each part starts at its own nearest-half-up pro-rata share, which is the
 * figure `exactCentProRataNearestHalfUp` gives for that weight alone. Rounding
 * every part independently does not generally sum to the total, so the residual
 * is settled by largest remainder: the part whose exact share had the largest
 * fractional cent is the one that gains a cent, and the part whose share had
 * the smallest is the one that gives one back. Ties resolve by position, so the
 * result depends only on the caller's ordering and never on floating point.
 *
 * Callers own domain validation: the amount and every weight must be
 * nonnegative exact minor units. A zero total weight allocates nothing.
 */
export function exactCentLargestRemainderSlices(
  amountMinorUnits: bigint,
  weightMinorUnits: readonly bigint[],
): bigint[] {
  const totalWeight = weightMinorUnits.reduce((sum, weight) => sum + weight, 0n)
  if (totalWeight <= 0n || amountMinorUnits <= 0n) {
    return weightMinorUnits.map(() => 0n)
  }
  const slices = weightMinorUnits.map((weight) =>
    exactCentProRataNearestHalfUp(amountMinorUnits, weight, totalWeight))
  const remainders = weightMinorUnits.map((weight) =>
    (amountMinorUnits * weight) % totalWeight)
  // Descending exact remainder, then ascending position.
  const ranking = weightMinorUnits.map((_, index) => index).sort((left, right) =>
    remainders[left] === remainders[right]
      ? left - right
      : (remainders[left]! > remainders[right]! ? -1 : 1))
  // Nearest-half-up rounds a part up exactly when its remainder is at least
  // half the denominator, so the rounded-up parts are precisely the front of
  // this ranking. `roundedUp` is therefore the boundary between the parts that
  // already hold an extra cent and the parts that do not, which is where the
  // residual has to be settled: a surplus is taken back from the last parts
  // that were rounded up, a shortfall is handed to the first parts that were
  // not. Any other choice would break the largest-remainder ordering.
  const roundedUp = remainders.filter((remainder) => remainder * 2n >= totalWeight).length
  let drift = slices.reduce((sum, slice) => sum + slice, 0n) - amountMinorUnits
  for (let position = roundedUp - 1; position >= 0 && drift > 0n; position -= 1) {
    const index = ranking[position]!
    slices[index] = slices[index]! - 1n
    drift -= 1n
  }
  for (let position = roundedUp; position < ranking.length && drift < 0n; position += 1) {
    const index = ranking[position]!
    slices[index] = slices[index]! + 1n
    drift += 1n
  }
  return slices
}
