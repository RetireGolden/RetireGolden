import { splitIraDistribution, type IraProRataYear } from '../../strategies/iraBasis.js'

/** A candidate owns its basis clone. Annual accepted ratios do not authorize
 * recovering more than the remaining owner basis across source accounts. */
export function characterizeStateConversionCandidate(
  draws: readonly {accountId:string;ownerPersonId:string;amount:number;aggregatedIra:boolean}[],
  openingBasis: ReadonlyMap<string, IraProRataYear>,
  taxableFraction: (ownerPersonId:string) => number,
) {
  const pools = new Map([...openingBasis].map(([owner, value]) => [owner, {
    ...value, nontaxableFraction: 1 - taxableFraction(owner),
  }]))
  const taxable = new Map<string, number>()
  const grossAmounts = new Map<string, number>()
  for (const draw of draws) {
    const basis = draw.aggregatedIra ? pools.get(draw.ownerPersonId) : undefined
    const split = basis === undefined ? undefined : splitIraDistribution(basis, draw.amount)
    if (split !== undefined) pools.set(draw.ownerPersonId, split.next)
    grossAmounts.set(draw.accountId, (grossAmounts.get(draw.accountId) ?? 0) + draw.amount)
    taxable.set(draw.accountId, (taxable.get(draw.accountId) ?? 0) + (split?.taxable ?? draw.amount))
  }
  return {taxable,grossAmounts,taxableTotal:[...taxable.values()].reduce((sum,value)=>sum+value,0)}
}
