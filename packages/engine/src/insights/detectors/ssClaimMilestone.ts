import type { Detector, InsightCard } from '../types.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths } from '../../socialSecurity/nra.js'

function formatAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return `${years} years ${months} months`
}

/** Highlights Social Security claim decisions occurring in the next two model years. */
export const ssClaimMilestone: Detector = {
  id: 'ss-claim-milestone',
  category: 'social-security',
  version: 1,
  screen(ctx): InsightCard | null {
    const firstProjectionYear = ctx.projection.result.years[0]
    if (firstProjectionYear === undefined || firstProjectionYear.year !== ctx.projection.startYear) return null

    let selectedCard: InsightCard | null = null
    let smallestYearsToClaim = Infinity
    for (const person of ctx.plan.household.people) {
      const projectedPerson = firstProjectionYear.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      const income = ctx.plan.incomes.find(
        (candidate) => candidate.type === 'socialSecurity' && candidate.personId === person.id,
      )
      const [birthYear, birthMonth, birthDay] = person.dob.split('-').map(Number)
      if (
        projectedPerson === undefined ||
        income === undefined ||
        income.type !== 'socialSecurity' ||
        !Number.isInteger(birthYear) ||
        !Number.isInteger(birthMonth) ||
        !Number.isInteger(birthDay)
      ) {
        continue
      }

      if (income.piaMonthly === null && (income.earnings === null || income.earnings.length === 0)) continue

      const claimMonths = income.claimAge.years * 12 + income.claimAge.months
      const benefitStartYear = birthYear + income.claimAge.years
      const yearsToClaim = benefitStartYear - ctx.projection.startYear
      if (yearsToClaim < 0 || yearsToClaim > 2) continue

      const benefitStartProjectionYear = ctx.projection.result.years.find(
        (year) => year.year === benefitStartYear,
      )
      const benefitStartPerson = benefitStartProjectionYear?.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      if (benefitStartPerson === undefined) continue

      const fra = fraForBirthYear(effectiveBirthYear(birthYear, birthMonth, birthDay))
      if (income.disability?.onsetAge !== undefined && income.disability.onsetAge < fra.years) continue

      if (yearsToClaim >= smallestYearsToClaim) continue

      // The annual ledger ages people by calendar year (ageAttained = year -
      // dobYear) and first pays in the year ageAttained equals claimAge.years
      // (partial when claim months > 0) — mirror that, not calendar-month math.
      selectedCard = {
        id: 'ss-claim-milestone',
        category: 'social-security',
        title: `${person.name}'s Social Security claim is imminent`,
        rationale:
          `The model starts ${person.name}'s Social Security at age ${formatAge(claimMonths)} in ${benefitStartYear}. ` +
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
          { label: 'Modeled first benefit year (partial when claim months > 0)', value: String(benefitStartYear), year: benefitStartYear },
          { label: 'Full retirement age', value: formatAge(fraTotalMonths(fra)) },
        ],
        plannerRoute: 'social-security-analysis',
        action: { kind: 'advisory' },
      }
      smallestYearsToClaim = yearsToClaim
    }

    return selectedCard
  },
}
