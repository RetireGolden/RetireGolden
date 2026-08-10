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

      // Earliest claim-in-force year among this person's non-SSDI streams.
      let firstClaimYear: number | null = null
      let firstClaimStream: SocialSecurityStreamActivity | null = null
      for (const year of ctx.projection.result.years) {
        const streams = (year.socialSecurityStreams ?? []).filter(
          (entry: SocialSecurityStreamActivity) =>
            entry.personId === person.id &&
            entry.claimInForce &&
            entry.source !== 'ssdi',
        )
        if (streams.length === 0) continue
        // Prefer the gate stream when several become in force the same year;
        // otherwise first published stream for that person.
        const preferred =
          streams.find((entry) => entry.isSpousalSurvivorGateStream) ?? streams[0]!
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

      // Pre-horizon claims are not imminent: if the first published in-force row
      // is the start year and the person is already older than the stream's claim
      // age, the filing decision happened before the horizon — skip.
      if (
        firstClaimYear === ctx.projection.startYear &&
        projectedPerson.ageAttained > income.claimAge.years
      ) {
        continue
      }

      const claimMonths = income.claimAge.years * 12 + income.claimAge.months

      if (yearsToClaim >= smallestYearsToClaim) continue

      const paidAmount = firstClaimStream.annualAmount
      const preWithholding = firstClaimStream.preWithholdingAnnual
      // Claim-in-force with nothing modeled pre-withholding is unmodeled activity
      // (not a withholding story) — skip per the unmodeled-stream rule.
      if (paidAmount <= 0 && preWithholding <= 0) continue
      const paidEvidence = paidAmount > 0
        ? {
            label: `${person.name}'s modeled benefit in first claim year`,
            value: `$${Math.round(paidAmount).toLocaleString()}`,
            year: firstClaimYear,
          }
        : {
            // Only label earnings-test / SGA withholding when a positive
            // pre-withholding benefit was actually reduced to $0.
            label: `${person.name}'s modeled benefit in first claim year (earnings test / SGA withheld to $0)`,
            value: '$0',
            year: firstClaimYear,
          }

      selectedCard = {
        id: 'ss-claim-milestone',
        category: 'social-security',
        title: `${person.name}'s Social Security claim is imminent`,
        rationale:
          `The model starts ${person.name}'s Social Security at age ${formatAge(claimMonths)} in ${firstClaimYear}. ` +
          'Confirm the claim age against the Social Security analysis before filing, since filing locks in permanent reductions or credits.',
        impact: {
          qualitative: 'Claiming age permanently affects the benefit calculation.',
        },
        exact: false,
        confidence: 'high',
        severity: yearsToClaim <= 1 ? 'attention' : 'info',
        evidence: [
          { label: `${person.name}'s modeled claim age`, value: formatAge(claimMonths) },
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
