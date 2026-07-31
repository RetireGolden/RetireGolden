export interface AggregateBasisSaleInput {
  openingFairMarketValue: number
  openingCostBasis: number
  saleProceeds: number
}

export interface AggregateBasisSaleResult extends AggregateBasisSaleInput {
  recoveredCostBasis: number
  realizedCapitalGainOrLoss: number
  remainingFairMarketValue: number
  remainingCostBasis: number
}

function nonnegativeFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite nonnegative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function normalized(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

/**
 * Planning-dollar aggregate-basis sale math for legacy simulation paths.
 * This deliberately does not round to cents and is not the action executor's
 * exact-minor-unit classifier.
 */
export function aggregateBasisSale(
  input: Readonly<AggregateBasisSaleInput>,
): Readonly<AggregateBasisSaleResult> {
  const openingFairMarketValue = nonnegativeFinite(
    input.openingFairMarketValue,
    'Opening fair market value',
  )
  const openingCostBasis = nonnegativeFinite(
    input.openingCostBasis,
    'Opening cost basis',
  )
  const saleProceeds = nonnegativeFinite(input.saleProceeds, 'Sale proceeds')
  if (saleProceeds > openingFairMarketValue) {
    throw new RangeError('Sale proceeds cannot exceed opening fair market value')
  }

  if (saleProceeds === 0 || openingFairMarketValue === 0) {
    return Object.freeze({
      openingFairMarketValue,
      openingCostBasis,
      saleProceeds,
      recoveredCostBasis: 0,
      realizedCapitalGainOrLoss: 0,
      remainingFairMarketValue: openingFairMarketValue,
      remainingCostBasis: openingCostBasis,
    })
  }

  if (saleProceeds === openingFairMarketValue) {
    return Object.freeze({
      openingFairMarketValue,
      openingCostBasis,
      saleProceeds,
      recoveredCostBasis: openingCostBasis,
      realizedCapitalGainOrLoss: normalized(
        saleProceeds - openingCostBasis,
      ),
      remainingFairMarketValue: 0,
      remainingCostBasis: 0,
    })
  }

  const soldFraction = saleProceeds / openingFairMarketValue
  const recoveredCostBasis = normalized(openingCostBasis * soldFraction)
  return Object.freeze({
    openingFairMarketValue,
    openingCostBasis,
    saleProceeds,
    recoveredCostBasis,
    realizedCapitalGainOrLoss: normalized(
      saleProceeds - recoveredCostBasis,
    ),
    remainingFairMarketValue: normalized(
      openingFairMarketValue - saleProceeds,
    ),
    remainingCostBasis: normalized(openingCostBasis - recoveredCostBasis),
  })
}
