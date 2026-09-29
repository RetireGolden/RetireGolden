/**
 * Shared words for the claim-age searches' refusals: the Social Security
 * page's sweep and benefits-only ranking, and the Optimize page's claim-age
 * co-optimization name a claim already made the same way.
 */
import type { AlreadyClaimed, ClaimAgeValue } from '@retiregolden/engine/socialSecurity/openClaims'
import { claimAgeUnpricedCreditReason, type AcaContractRemovals, type UnpricedCreditYear } from './acaVetoCopy'

/** A claim age as the page prints it: "67", or "67y 6m" with months. */
export function fmtClaimAge(c: ClaimAgeValue): string {
  return c.months > 0 ? `${c.years}y ${c.months}m` : `${c.years}`
}

/** A claim already made as the sentences need it: who, at what age, in what year. */
export type HeldClaim = Pick<AlreadyClaimed, 'personId' | 'claimAge' | 'claimYear'>

/** "Alex claimed at 67 in 2020 and Sam at 67 in 2022": the claims a search holds fixed. */
export function alreadyClaimedText(claims: readonly HeldClaim[], personName: (id: string) => string): string {
  const parts = claims.map((c, i) => `${personName(c.personId)}${i === 0 ? ' claimed' : ''} at ${fmtClaimAge(c.claimAge)} in ${c.claimYear}`)
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * What the Optimize page's claim-age co-optimization did, as its card and the
 * downloadable report both need it (the engine's ClaimAgeCoOptimization
 * outcome facts).
 */
export interface ClaimAgeSearchFacts {
  readonly outcome: 'searched' | 'already-claimed' | 'aca-unpriced' | 'no-age-left' | 'no-claims'
  readonly unpricedAca: readonly UnpricedCreditYear[]
  readonly alreadyClaimed: readonly HeldClaim[]
}

/**
 * The sentence for a claim-age co-optimization that priced no candidate, the
 * same on the Optimize card and in the downloadable report: an unpriced
 * premium credit (each year with its reason), every claim already made, or no
 * claim age left to try. Null when the search ran ('searched') or there was
 * no stream ('no-claims'). With the plan's removal record, an unpriced year
 * whose contract an edit removed names that edit.
 */
export function claimAgeSearchRefusal(
  search: ClaimAgeSearchFacts,
  personName: (id: string) => string,
  startYear: number,
  removals?: AcaContractRemovals,
): string | null {
  switch (search.outcome) {
    case 'aca-unpriced':
      return `Social Security claim age not searched. ${claimAgeUnpricedCreditReason(search.unpricedAca, removals)} The recommendation keeps your current claim ages.`
    case 'already-claimed':
      return `Social Security claim age not searched: ${alreadyClaimedText(search.alreadyClaimed, personName)}, before the plan starts in ${startYear}, so there is no claim age left to move. ${ALREADY_CLAIMED_LIMITS}`
    case 'no-age-left':
      return (
        'Social Security claim age not searched: none of the ages it tries (62, full retirement age and 70) is both ' +
        `different from your current claim and still ahead in ${startYear}, so there is no claim age left to try. ` +
        'The recommendation keeps your current claim ages.' +
        (search.alreadyClaimed.length > 0 ? ` ${claimAgeHeldText(search.alreadyClaimed, personName)}` : '')
      )
    default:
      return null
  }
}

/** "Pat claimed at 62 in 2025, before the plan starts, so that claim was held as it is.": a search that held a claim made. */
export function claimAgeHeldText(claims: readonly HeldClaim[], personName: (id: string) => string): string {
  return `${alreadyClaimedText(claims, personName)}, before the plan starts, so ${claims.length === 1 ? 'that claim was held as it is' : 'those claims were held as they are'}.`
}

/** Why a claim already made cannot be re-made at another age, and what the plan does not model. */
export const ALREADY_CLAIMED_LIMITS =
  'A claim cannot be made again at another age, and this plan does not model withdrawing an application (possible within 12 months of the first month of entitlement, repaying every benefit) or suspending benefits from full retirement age.'
