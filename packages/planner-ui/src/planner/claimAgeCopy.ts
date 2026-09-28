/**
 * Shared words for the claim-age searches' refusals: the Social Security
 * page's sweep and benefits-only ranking, and the Optimize page's claim-age
 * co-optimization name a claim already made the same way.
 */
import type { AlreadyClaimed, ClaimAgeValue } from '@retiregolden/engine/socialSecurity/openClaims'

/** A claim age as the page prints it: "67", or "67y 6m" with months. */
export function fmtClaimAge(c: ClaimAgeValue): string {
  return c.months > 0 ? `${c.years}y ${c.months}m` : `${c.years}`
}

/** "Alex claimed at 67 in 2020 and Sam at 67 in 2022": the claims a search holds fixed. */
export function alreadyClaimedText(claims: readonly AlreadyClaimed[], personName: (id: string) => string): string {
  const parts = claims.map((c, i) => `${personName(c.personId)}${i === 0 ? ' claimed' : ''} at ${fmtClaimAge(c.claimAge)} in ${c.claimYear}`)
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Why a claim already made cannot be re-made at another age, and what the plan does not model. */
export const ALREADY_CLAIMED_LIMITS =
  'A claim cannot be made again at another age, and this plan does not model withdrawing an application (possible within 12 months of the first month of entitlement, repaying every benefit) or suspending benefits from full retirement age.'
