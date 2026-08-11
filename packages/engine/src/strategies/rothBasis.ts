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

/**
 * Principal that would cover a draw with zero tax and zero penalty if
 * contribution basis were not present, scanned as a FIFO prefix of conversion
 * layers (oldest first, matching §408A(d)(4)(B)(ii)(I) / splitRothWithdrawal).
 *
 * Accumulate seasoned layers and wholly nontaxable unseasoned layers; stop at
 * the first layer that would cost tax or penalty (unseasoned taxable). Deeper
 * free layers behind that barrier are not free cover — reaching them requires
 * tapping the blocking layer. Observed from the pool's live bucket balances —
 * never a re-run of withdrawal economics.
 */
export function freeRothCoverCapacity(
  state: RothBasisState,
  year: number,
  age: number,
): number {
  const qualified = age >= ROTH_QUALIFIED_AGE
  let free = 0
  for (const layer of state.conversionLayers) {
    if (qualified || year - layer.year >= ROTH_SEASONING_YEARS) {
      free += layer.amount
    } else if (layer.taxableAmount <= 0) {
      free += layer.amount
    } else {
      // Unseasoned taxable principal — FIFO stops here.
      break
    }
  }
  return free
}

/**
 * Apply a FIFO principal debt against conversion layers (oldest first),
 * prorating each layer's taxable share with the residual balance. Used to
 * reconstruct the assumed-zero counterfactual's layer state after prior seed
 * re-homing consumed free cover, unseasoned taxable principal, and free layers
 * behind a taxable blocker — dollars the live residual still shows.
 */
export function applyConversionPrincipalDebt(
  layers: readonly RothConversionLayer[],
  debt: number,
): RothConversionLayer[] {
  let remaining = Math.max(0, debt)
  if (remaining <= 0) {
    return layers.map((layer) => ({ ...layer }))
  }
  const out: RothConversionLayer[] = []
  for (const layer of layers) {
    if (remaining <= 0) {
      out.push({ ...layer })
      continue
    }
    const take = Math.min(remaining, layer.amount)
    remaining -= take
    const left = layer.amount - take
    if (left > 0) {
      const taxableLeft =
        layer.amount > 0 ? layer.taxableAmount * (left / layer.amount) : 0
      out.push({ year: layer.year, amount: left, taxableAmount: taxableLeft })
    }
  }
  return out
}

/**
 * How much of an assumed-seed dollar amount would land on taxable/penalized
 * remainders if those dollars walked conversion layers FIFO (mirroring
 * `splitRothWithdrawal` per-layer consumption).
 *
 * Callers that track multi-draw counterfactual debt should materialize the
 * counterfactual layer state first (`applyConversionPrincipalDebt` on pre-draw
 * layers), apply any shared live conversion take against that CF state, then
 * pass the resulting residual here with `priorConversionExtraConsumed` left at
 * 0 — applying prior debt to post-draw residual can erase the current draw's
 * real CF difference. The optional prior-debt argument remains for unit tests
 * that walk a single residual snapshot.
 *
 * Free layers (seasoned, wholly nontaxable unseasoned, or age-qualified) absorb
 * without consequence. Unseasoned taxable takes are consequential only for the
 * taxable share — matching `splitRothWithdrawal`'s pro-rata recapture
 * `take * (taxableAmount / amount)` on residual layer balances after partial
 * consumption. The walk continues past a partial taxable blocker so free
 * layers behind it still absorb residual seed.
 * Residual past every conversion layer is earnings and is consequential.
 *
 * `unseasonedTaxableSpill` / `earningsSpill` break `consequentialSpill` into the
 * two characters so callers can mirror `splitRothWithdrawal` on live vs
 * counterfactual sides and compare apples-to-apples (conversion→earnings is
 * CF-extra ordinary income even when both report the same total spill).
 *
 * `conversionPrincipalConsumed` is how much of this seed landed on conversion
 * principal (not earnings) — the debt to accumulate for later draws.
 */
export function assumedSeedConsequentialSpill(
  state: RothBasisState,
  assumedSeedAmount: number,
  year: number,
  age: number,
  priorConversionExtraConsumed = 0,
): {
  consequentialSpill: number
  conversionPrincipalConsumed: number
  unseasonedTaxableSpill: number
  earningsSpill: number
} {
  let remaining = Math.max(0, assumedSeedAmount)
  if (remaining <= 0) {
    return {
      consequentialSpill: 0,
      conversionPrincipalConsumed: 0,
      unseasonedTaxableSpill: 0,
      earningsSpill: 0,
    }
  }
  const qualified = age >= ROTH_QUALIFIED_AGE
  const layers = applyConversionPrincipalDebt(
    state.conversionLayers,
    priorConversionExtraConsumed,
  )
  let unseasonedTaxableSpill = 0
  let conversionPrincipalConsumed = 0
  for (const layer of layers) {
    if (remaining <= 0) break
    const isFree =
      qualified ||
      year - layer.year >= ROTH_SEASONING_YEARS ||
      layer.taxableAmount <= 0
    if (isFree) {
      const absorb = Math.min(remaining, layer.amount)
      remaining -= absorb
      conversionPrincipalConsumed += absorb
    } else {
      const take = Math.min(remaining, layer.amount)
      // Mirror splitRothWithdrawal: only the taxable share of an unseasoned
      // mixed layer is consequential (nondeductible basis recaptures nothing).
      const taxableTake =
        layer.amount > 0 ? take * (layer.taxableAmount / layer.amount) : 0
      unseasonedTaxableSpill += taxableTake
      remaining -= take
      conversionPrincipalConsumed += take
    }
  }
  // Past conversion principal → earnings (taxable + penalty pre-qualified age).
  const earningsSpill = remaining
  return {
    consequentialSpill: unseasonedTaxableSpill + earningsSpill,
    conversionPrincipalConsumed,
    unseasonedTaxableSpill,
    earningsSpill,
  }
}
