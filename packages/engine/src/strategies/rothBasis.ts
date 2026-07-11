/**
 * Roth ordering + 5-year rules (roadmap V8, §4 tax depth).
 *
 * A Roth distribution comes out in a fixed IRS order, and each layer is taxed
 * differently before the account is "qualified" (owner 59½+ and the account 5+
 * years old):
 *   1. Contributions  — always tax- AND penalty-free, at any age.
 *   2. Conversions    — oldest first; already taxed at conversion, so never
 *                       income-taxed again, BUT a 10% recapture penalty applies
 *                       to any layer tapped within 5 years while under 59½.
 *   3. Earnings       — last out; before 59½ they are ordinary income PLUS the
 *                       10% penalty (a non-qualified distribution).
 *
 * The engine approximates the 59½ boundary as "age 60 attained," matching the
 * traditional early-withdrawal penalty elsewhere in the simulation, and folds
 * the account's own 5-year clock into that age proxy (an existing Roth is
 * almost always open >5 years by 59½). Conversions performed during the
 * projection each carry their own explicit 5-year clock, which is the case that
 * actually matters for the early-retirement "conversion ladder."
 */

/** The engine's 59½ proxy: no early-withdrawal penalty once age 60 is attained. */
export const ROTH_QUALIFIED_AGE = 60
/** A conversion is "seasoned" (no recapture penalty) once this many years pass. */
export const ROTH_SEASONING_YEARS = 5

export interface RothConversionLayer {
  /** Calendar year the conversion occurred (starts its 5-year clock). */
  year: number
  /** Remaining un-withdrawn converted principal in this layer (nominal $). */
  amount: number
  /**
   * Portion of `amount` that was included in income at conversion. The 10%
   * recapture penalty on an unseasoned tap applies only to this taxable share —
   * nondeductible IRA basis rolled in was never taxed, so it recaptures nothing
   * (IRS Pub 590-B). The full `amount` still returns tax-free before earnings.
   * Absent (or equal to `amount`) for a fully-taxable conversion.
   */
  taxableAmount: number
}

export interface RothBasisState {
  /** Direct-contribution basis remaining (nominal $); withdrawn first, always free. */
  contributionBasis: number
  /** Conversion principal layers, oldest first; penalized if tapped <5y while pre-59½. */
  conversionLayers: RothConversionLayer[]
}

export interface RothWithdrawalSplit {
  contributions: number
  conversions: number
  earnings: number
  /** 10% early-withdrawal penalty on unseasoned conversions + pre-59½ earnings. */
  penalty: number
  /** Earnings portion taxed as ordinary income (pre-59½ non-qualified distribution). */
  taxableOrdinary: number
  /** Basis state after the withdrawal; the caller commits this only for the final plan. */
  next: RothBasisState
}

/** An empty (fresh) basis state, e.g. for a brand-new Roth account. */
export function emptyRothBasis(contributionBasis = 0): RothBasisState {
  return { contributionBasis, conversionLayers: [] }
}

/**
 * Split a Roth withdrawal into contribution / conversion / earnings buckets and
 * the early-distribution tax + penalty it incurs. Pure: returns the post-
 * withdrawal `next` state rather than mutating, so callers can probe a candidate
 * withdrawal during the tax fixed-point and only commit once it converges.
 *
 * `amount` is assumed ≤ the account balance (the caller drains against available
 * balance), so the remainder after contributions and conversions is earnings.
 */
export function splitRothWithdrawal(
  state: RothBasisState,
  amount: number,
  year: number,
  age: number,
): RothWithdrawalSplit {
  const qualified = age >= ROTH_QUALIFIED_AGE
  let remaining = Math.max(0, amount)

  // 1) Contributions — always tax- and penalty-free.
  const contributions = Math.min(remaining, state.contributionBasis)
  remaining -= contributions
  const contributionBasis = state.contributionBasis - contributions

  // 2) Conversions, oldest first. Tax-free (already taxed at conversion); a 10%
  //    penalty applies to a layer tapped within 5 years while under 59½.
  let conversions = 0
  let penalty = 0
  const conversionLayers: RothConversionLayer[] = []
  for (const layer of state.conversionLayers) {
    if (remaining <= 0) {
      conversionLayers.push(layer)
      continue
    }
    const take = Math.min(remaining, layer.amount)
    conversions += take
    remaining -= take
    // The recapture penalty applies only to the taxable share of the principal
    // tapped; nondeductible basis that was converted recaptures nothing.
    const taxableTake = layer.amount > 0 ? take * (layer.taxableAmount / layer.amount) : 0
    if (year - layer.year < ROTH_SEASONING_YEARS && !qualified) penalty += taxableTake * 0.1
    const left = layer.amount - take
    if (left > 0) conversionLayers.push({ year: layer.year, amount: left, taxableAmount: layer.taxableAmount - taxableTake })
  }

  // 3) Earnings — last out. Non-qualified (pre-59½) earnings are ordinary income
  //    plus the 10% penalty; qualified earnings are tax- and penalty-free.
  const earnings = remaining
  let taxableOrdinary = 0
  if (earnings > 0 && !qualified) {
    taxableOrdinary = earnings
    penalty += earnings * 0.1
  }

  return {
    contributions,
    conversions,
    earnings,
    penalty,
    taxableOrdinary,
    next: { contributionBasis, conversionLayers },
  }
}
