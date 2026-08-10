import type { Detector, InsightCard } from '../types.js'
import type { Plan } from '../../model/plan.js'
import type { SocialSecurityStreamActivity } from '../../projection/types.js'

type SocialSecurityIncome = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>

function formatAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return `${years} years ${months} months`
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
 * Highlights Social Security claim decisions occurring in the next two model years.
 *
 * Reads the ledger's published per-stream SS activity (`socialSecurityStreams`)
 * — claim-in-force, benefit source, and paid amounts — and never re-derives
 * PIA, spousal/survivor anchors, or SSDI path selection from plan inputs.
 *
 * Keys on the first year a non-SSDI stream is claim-in-force (the filing
 * decision), not the first positive paid amount, so earnings-test withholding
 * to $0 does not hide or delay a real claim.
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

    for (const person of ctx.plan.household.people) {
      const projectedPerson = firstProjectionYear.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      if (projectedPerson === undefined) continue

      // Streams already claim-in-force at the horizon start are pre-horizon
      // filings — skip those streams, not the person, so a sibling stream that
      // claims later still surfaces. Include SSDI-at-start rows: a later source
      // transition (e.g. SSDI→survivor) is not a new filing decision.
      const preHorizonStreamIds = new Set<string>()
      for (const entry of firstProjectionYear.socialSecurityStreams ?? []) {
        if (entry.personId !== person.id || !entry.claimInForce) continue
        // SSDI (or any in-force source) at horizon start is already claimed;
        // claim-age may still point at a future FRA switch and must not exclude it.
        if (entry.source === 'ssdi') {
          preHorizonStreamIds.add(entry.streamId)
          continue
        }
        const streamIncome = ctx.plan.incomes.find(
          (candidate): candidate is SocialSecurityIncome =>
            candidate.type === 'socialSecurity' && candidate.id === entry.streamId,
        )
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
      // stopping the person on the unmodeled row.
      let firstClaimYear: number | null = null
      let firstClaimStream: SocialSecurityStreamActivity | null = null
      for (const year of ctx.projection.result.years) {
        const streams = (year.socialSecurityStreams ?? []).filter(
          (entry: SocialSecurityStreamActivity) =>
            entry.personId === person.id &&
            entry.claimInForce &&
            entry.source !== 'ssdi' &&
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
      const birthYear = Number(person.dob.slice(0, 4))
      const ageAtFirstPayableYear = firstClaimYear - birthYear

      if (yearsToClaim >= smallestYearsToClaim) continue

      const paidAmount = firstClaimStream.annualAmount
      const preWithholding = firstClaimStream.preWithholdingAnnual
      const paidEvidence = paidAmount > 0
        ? {
            label: `${person.name}'s modeled benefit in first claim year`,
            value: `$${Math.round(paidAmount).toLocaleString()}`,
            year: firstClaimYear,
          }
        : {
            // Only label earnings-test / SGA withholding when a positive
            // pre-withholding benefit was actually reduced to $0.
            // (Unmodeled zero/zero rows are filtered out of the search above.)
            label: `${person.name}'s modeled benefit in first claim year (earnings test / SGA withheld to $0)`,
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
          'Confirm the claim age against the Social Security analysis before filing, since filing locks in permanent reductions or credits.'
        : `The model uses a configured claim age of ${claimAgeLabel} for ${person.name}, with the first modeled payable year ${firstClaimYear} ` +
          `(attained age ${ageAtFirstPayableYear}). Confirm the claim age against the Social Security analysis before filing, since filing locks in permanent reductions or credits.`

      selectedCard = {
        id: 'ss-claim-milestone',
        category: 'social-security',
        title: `${person.name}'s Social Security claim is imminent`,
        rationale,
        impact: {
          qualitative: 'Claiming age permanently affects the benefit calculation.',
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
          {
            label: 'Benefit source',
            value: formatSource(firstClaimStream.source),
            year: firstClaimYear,
          },
        ],
        plannerRoute: 'social-security-analysis',
        action: { kind: 'advisory' },
      }
      smallestYearsToClaim = yearsToClaim
    }

    return selectedCard
  },
}
