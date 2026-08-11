import type { Detector, InsightCard } from '../types.js'
import type { Plan } from '../../model/plan.js'
import type { SocialSecurityStreamActivity } from '../../projection/types.js'
import { fraForBirthYear } from '../../socialSecurity/nra.js'

type SocialSecurityIncome = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>

function formatAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearLabel = years === 1 ? '1 year' : `${years} years`
  const monthLabel = months === 1 ? '1 month' : `${months} months`
  return `${yearLabel} ${monthLabel}`
}

/**
 * Format a modeled benefit for evidence. Whole dollars stay rounded; positive
 * sub-dollar amounts keep cents so a $0.40 benefit is not shown as $0.
 */
function formatBenefitUsd(amount: number): string {
  if (amount > 0 && amount < 0.5) {
    return `$${amount.toFixed(2)}`
  }
  return `$${Math.round(amount).toLocaleString()}`
}

function formatSource(source: SocialSecurityStreamActivity['source']): string {
  switch (source) {
    case 'own-retirement':
      return 'own retirement'
    case 'ssdi':
      return 'SSDI'
    case 'spousal':
      return 'spousal'
    case 'survivor':
      return 'survivor'
    case 'none':
      return 'none'
  }
}

/**
 * True when this stream published `source: 'ssdi'` in any projection year at or
 * before `throughYear`. Used so automatic SSDI→retirement conversion at FRA
 * (same dollars, `source: 'own-retirement'`) is not treated as a filing decision.
 */
function streamPublishedSsdiThrough(
  years: readonly { year: number; socialSecurityStreams?: readonly SocialSecurityStreamActivity[] }[],
  streamId: string,
  throughYear: number,
): boolean {
  for (const year of years) {
    if (year.year > throughYear) continue
    for (const entry of year.socialSecurityStreams ?? []) {
      if (entry.streamId === streamId && entry.source === 'ssdi') return true
    }
  }
  return false
}

/**
 * Highlights Social Security claim decisions occurring in the next two model years.
 *
 * Reads the ledger's published per-stream SS activity (`socialSecurityStreams`)
 * — claim-in-force, benefit source, and paid amounts — and never re-derives
 * PIA, spousal/survivor anchors, or SSDI path selection from plan inputs.
 *
 * Keys on the first year a non-SSDI stream is claim-in-force (the filing
 * decision), not the first positive paid amount, so earnings-test withholding
 * to $0 does not hide or delay a real claim. Automatic FRA conversion of SSDI
 * to own-retirement (no application) is excluded even when the published
 * source is no longer `ssdi`.
 */
export const ssClaimMilestone: Detector = {
  id: 'ss-claim-milestone',
  category: 'social-security',
  version: 2,
  screen(ctx): InsightCard | null {
    const firstProjectionYear = ctx.projection.result.years[0]
    if (firstProjectionYear === undefined || firstProjectionYear.year !== ctx.projection.startYear) return null
    let selectedCard: InsightCard | null = null
    let smallestYearsToClaim = Infinity
    const projectionYears = ctx.projection.result.years

    for (const person of ctx.plan.household.people) {
      const projectedPerson = firstProjectionYear.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      if (projectedPerson === undefined) continue

      // Streams already claim-in-force at the horizon start are pre-horizon
      // filings — skip those streams, not the person, so a sibling stream that
      // claims later still surfaces. Include paying SSDI-at-start rows and
      // post-FRA converted own-retirement on a disability path: a later source
      // transition (e.g. SSDI→survivor) is not a new filing decision, and FRA
      // conversion requires no application.
      // A zero-benefit stream (both published amounts $0) is not "already
      // claimed" — keep it out of pre-horizon so a later auxiliary claim on the
      // same stream can still fire (zero-PIA retirement / SSDI auxiliary path).
      const birthYear = Number(person.dob.slice(0, 4))
      const personFraYears = fraForBirthYear(birthYear).years
      const preHorizonStreamIds = new Set<string>()
      for (const entry of firstProjectionYear.socialSecurityStreams ?? []) {
        if (entry.personId !== person.id || !entry.claimInForce) continue
        const hasPositivePublishedAmount =
          entry.annualAmount > 0 || entry.preWithholdingAnnual > 0
        // Already-claimed only when a positive amount is published (or was paid
        // pre-withholding). Zero-PIA retirement streams stay eligible for a
        // later auxiliary claim on the same stream id.
        if (!hasPositivePublishedAmount) continue
        if (entry.source === 'ssdi') {
          preHorizonStreamIds.add(entry.streamId)
          continue
        }
        const streamIncome = ctx.plan.incomes.find(
          (candidate): candidate is SocialSecurityIncome =>
            candidate.type === 'socialSecurity' && candidate.id === entry.streamId,
        )
        // Disability path already past onset with own-retirement published at
        // horizon start = automatic FRA conversion already in force (not a filing).
        // Gate on onsetAge < FRA — the same validity check simulate uses. When
        // disability.onsetAge >= FRA, simulate treats SSDI metadata as invalid
        // and falls through to normal retirement (never publishes `ssdi`); do
        // not suppress those streams as a non-filing conversion.
        if (
          entry.source === 'own-retirement' &&
          streamIncome?.disability?.onsetAge !== undefined &&
          streamIncome.disability.onsetAge < personFraYears &&
          projectedPerson.ageAttained > streamIncome.disability.onsetAge
        ) {
          preHorizonStreamIds.add(entry.streamId)
          continue
        }
        if (
          streamIncome !== undefined &&
          projectedPerson.ageAttained > streamIncome.claimAge.years
        ) {
          preHorizonStreamIds.add(entry.streamId)
        }
      }

      // Earliest claim-in-force year among this person's non-SSDI, non-pre-horizon
      // streams that actually model a benefit (positive paid or pre-withholding).
      // An empty claim-in-force row (both amounts zero) is unmodeled — skip that
      // stream and keep searching later years / sibling streams rather than
      // stopping the person on the unmodeled row. Also skip own-retirement that
      // follows a published SSDI year on the same stream (FRA conversion).
      let firstClaimYear: number | null = null
      let firstClaimStream: SocialSecurityStreamActivity | null = null
      for (const year of projectionYears) {
        const streams = (year.socialSecurityStreams ?? []).filter(
          (entry: SocialSecurityStreamActivity) =>
            entry.personId === person.id &&
            entry.claimInForce &&
            entry.source !== 'ssdi' &&
            !(
              entry.source === 'own-retirement' &&
              streamPublishedSsdiThrough(projectionYears, entry.streamId, year.year - 1)
            ) &&
            !preHorizonStreamIds.has(entry.streamId) &&
            // Unmodeled: claim-in-force with nothing published pre- or post-withholding.
            (entry.annualAmount > 0 || entry.preWithholdingAnnual > 0),
        )
        if (streams.length === 0) continue
        // Same-year preference: positive published payment, then gate stream, then order.
        const preferred =
          streams.find((entry) => entry.annualAmount > 0) ??
          streams.find((entry) => entry.isSpousalSurvivorGateStream) ??
          streams[0]!
        firstClaimYear = year.year
        firstClaimStream = preferred
        break
      }
      if (firstClaimYear === null || firstClaimStream === null) continue

      const yearsToClaim = firstClaimYear - ctx.projection.startYear
      if (yearsToClaim < 0 || yearsToClaim > 2) continue

      const benefitStartProjectionYear = ctx.projection.result.years.find(
        (year) => year.year === firstClaimYear,
      )
      const benefitStartPerson = benefitStartProjectionYear?.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      if (benefitStartPerson === undefined) continue

      const income = ctx.plan.incomes.find(
        (entry): entry is SocialSecurityIncome =>
          entry.type === 'socialSecurity' && entry.id === firstClaimStream!.streamId,
      )
      if (income === undefined) continue

      const claimMonths = income.claimAge.years * 12 + income.claimAge.months
      // Annual-ledger attained age in the first payable year (year − birth year),
      // matching simulatePlan's ageAttained. Auxiliary benefits (spousal/survivor)
      // often first pay later than the configured filing age — report both ages
      // so claim-age evidence is not read as the age in the payable year.
      const ageAtFirstPayableYear = firstClaimYear - birthYear

      if (yearsToClaim >= smallestYearsToClaim) continue

      const paidAmount = firstClaimStream.annualAmount
      const preWithholding = firstClaimStream.preWithholdingAnnual
      const sourceLabel = formatSource(firstClaimStream.source)
      // Fold benefit source into the paid-amount label so evidence stays within
      // the GOVERNANCE two-to-five cap (was six separate entries).
      const paidEvidence = paidAmount > 0
        ? {
            label: `${person.name}'s modeled benefit in first claim year (${sourceLabel})`,
            value: formatBenefitUsd(paidAmount),
            year: firstClaimYear,
          }
        : {
            // Only label earnings-test / SGA withholding when a positive
            // pre-withholding benefit was actually reduced to $0.
            // (Unmodeled zero/zero rows are filtered out of the search above.)
            label:
              `${person.name}'s modeled benefit in first claim year ` +
              `(earnings test / SGA withheld to $0; ${sourceLabel})`,
            value: '$0',
            year: firstClaimYear,
          }

      // Defense in depth: search filter already requires a positive amount.
      if (paidAmount <= 0 && preWithholding <= 0) continue

      const claimAgeLabel = formatAge(claimMonths)
      // Annual ledger ages are whole years; configured months are evidence-only.
      // Use the dual-age rationale when the first payable year is not the claim-age year.
      const agesAlign = ageAtFirstPayableYear === income.claimAge.years
      const rationale = agesAlign
        ? `The model starts ${person.name}'s Social Security at age ${claimAgeLabel} in ${firstClaimYear}. ` +
          'The modeled benefit amount depends on the claim age — confirm it against the Social Security analysis before filing.'
        : `The model uses a configured claim age of ${claimAgeLabel} for ${person.name}, with the first modeled payable year ${firstClaimYear} ` +
          `(attained age ${ageAtFirstPayableYear}). The modeled benefit amount depends on the claim age — confirm it against the Social Security analysis before filing.`

      selectedCard = {
        id: 'ss-claim-milestone',
        category: 'social-security',
        title: `${person.name}'s Social Security claim is imminent`,
        rationale,
        impact: {
          qualitative: 'The modeled benefit amount depends on the claim age — review it in the Social Security analysis before filing.',
        },
        exact: false,
        confidence: 'high',
        severity: yearsToClaim <= 1 ? 'attention' : 'info',
        evidence: [
          { label: `${person.name}'s modeled claim age (configured filing age)`, value: claimAgeLabel },
          {
            label: `${person.name}'s attained age in first payable year`,
            value: String(ageAtFirstPayableYear),
            year: firstClaimYear,
          },
          { label: `Age at projection start (${firstProjectionYear.year})`, value: String(projectedPerson.ageAttained), year: firstProjectionYear.year },
          { label: 'Modeled first claim year (claim in force; partial when claim months > 0)', value: String(firstClaimYear), year: firstClaimYear },
          paidEvidence,
        ],
        plannerRoute: 'social-security-analysis',
        action: { kind: 'advisory' },
      }
      smallestYearsToClaim = yearsToClaim
    }

    return selectedCard
  },
}
