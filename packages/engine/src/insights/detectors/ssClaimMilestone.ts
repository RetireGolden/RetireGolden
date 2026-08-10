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

      const claimMonths = income.claimAge.years * 12 + income.claimAge.months
      const yearsToClaim = claimMonths / 12 - projectedPerson.ageAttained
      if (yearsToClaim < 0 || yearsToClaim > 2) continue

      const fra = fraForBirthYear(effectiveBirthYear(birthYear, birthMonth, birthDay))
      if (income.disability?.onsetAge !== undefined && income.disability.onsetAge < fra.years) continue

      const benefitStartYear = birthYear + Math.floor((birthMonth - 1 + claimMonths) / 12)
      return {
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
          { label: 'Modeled claim year', value: String(benefitStartYear), year: benefitStartYear },
          { label: 'Full retirement age', value: formatAge(fraTotalMonths(fra)) },
        ],
        plannerRoute: 'social-security-analysis',
        action: { kind: 'advisory' },
      }
    }

    return null
  },
}
