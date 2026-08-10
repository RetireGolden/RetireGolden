import type { Detector, InsightCard } from '../types.js'
import type { Plan } from '../../model/plan.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths } from '../../socialSecurity/nra.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '../../socialSecurity/piaFromEarnings.js'
import { maritalBenefitFor } from '../../socialSecurity/maritalBenefits.js'

type SocialSecurityIncome = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>

function formatAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return `${years} years ${months} months`
}

function resolvedOwnPia(income: SocialSecurityIncome, person: Plan['household']['people'][number]): number | null {
  if (income.piaMonthly !== null) return income.piaMonthly
  if (income.earnings === null || income.earnings.length === 0) return null

  const [birthYear, birthMonth, birthDay] = person.dob.split('-').map(Number)
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(birthDay)) return null

  const projection = resolveEarningsProjection(income.earningsProjection, person.retirementAge)
  const result = computePiaFromEarnings(
    piaInputFromEarnings(birthYear, birthMonth, birthDay, income.earnings, projection),
  )
  return isPiaFromEarningsError(result) ? null : result.piaMonthly
}

/** Own-record PIA is absent, zero, or resolves to zero through the simulator's earnings path. */
function streamResolvesNoOwnBenefit(
  income: SocialSecurityIncome,
  person: Plan['household']['people'][number],
): boolean {
  return (resolvedOwnPia(income, person) ?? 0) <= 0
}

/** Another SS stream with modeled own benefit — claim age on a zero-PIA stream can still time spousal/auxiliary benefits. */
function simulatedSsStreamByPerson(
  plan: Plan,
): Map<string, { income: SocialSecurityIncome; pia: number }> {
  const streams = new Map<string, { income: SocialSecurityIncome; pia: number }>()
  for (const income of plan.incomes) {
    if (income.type !== 'socialSecurity') continue
    const person = plan.household.people.find((candidate) => candidate.id === income.personId)
    if (person === undefined) continue
    const pia = resolvedOwnPia(income, person)
    if (pia === null) continue
    streams.set(income.personId, { income, pia })
  }
  return streams
}

function planHasAnotherSsBenefitAnchor(
  plan: Plan,
  claimantPersonId: string,
  claimantBenefitStartYear: number,
  lastProjectionYear: number | undefined,
  projectionYears: readonly { year: number; people: { personId: string; alive: boolean }[] }[],
): boolean {
  if (plan.household.people.length !== 2 || lastProjectionYear === undefined) return false
  const streams = simulatedSsStreamByPerson(plan)
  if (!streams.has(claimantPersonId)) return false
  const anchorPerson = plan.household.people.find((person) => person.id !== claimantPersonId)
  if (anchorPerson === undefined) return false
  const anchorStream = streams.get(anchorPerson.id)
  if (anchorStream === undefined || anchorStream.pia <= 0) return false

  const anchorDobYear = Number(anchorPerson.dob.slice(0, 4))
  if (!Number.isInteger(anchorDobYear)) return false
  const anchorBenefitStartYear = anchorDobYear + anchorStream.income.claimAge.years
  const firstSharedPayableYear = Math.max(claimantBenefitStartYear, anchorBenefitStartYear)
  if (firstSharedPayableYear > lastProjectionYear) return false

  return projectionYears.some((year) => {
    if (year.year < firstSharedPayableYear) return false
    const claimant = year.people.find((candidate) => candidate.personId === claimantPersonId)
    const anchor = year.people.find((candidate) => candidate.personId === anchorPerson.id)
    if (claimant?.alive !== true || anchor === undefined) return false

    // The spousal pass needs both people alive. The survivor pass instead
    // needs the spouse dead, a positive resolved PIA, and a stream that has
    // reached its claim age, all of which the checks above mirror.
    return true
  })
}

/** A positive former-spouse PIA can make an otherwise zero-own-PIA claim decision meaningful. */
function hasFormerSpouseBenefitAnchor(
  plan: Plan,
  income: SocialSecurityIncome,
  person: Plan['household']['people'][number],
  claimantBenefitStartYear: number,
  projectionYears: readonly { year: number; people: { personId: string; ageAttained: number; alive: boolean }[] }[],
): boolean {
  const [birthYear, birthMonth, birthDay] = person.dob.split('-').map(Number)
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(birthDay)) return false

  // The annual ledger first pays in claimantBenefitStartYear. A former-spouse
  // record must pass the engine's marital-benefit gate in that same year, not
  // merely become eligible somewhere later in the projection horizon.
  return projectionYears.some((year) => {
    if (year.year !== claimantBenefitStartYear) return false
    const projectedPerson = year.people.find((candidate) => candidate.personId === person.id)
    if (projectedPerson === undefined || !projectedPerson.alive) return false

    return income.formerSpouses?.some((formerSpouse) =>
      formerSpouse.piaMonthly > 0 && maritalBenefitFor(formerSpouse, {
        claimantDob: { year: birthYear, month: birthMonth, day: birthDay },
        claimantClaimAge: income.claimAge,
        claimantAge: projectedPerson.ageAttained,
        year: year.year,
        claimantIsSingle: plan.household.people.length === 1,
      }) !== null,
    ) ?? false
  })
}

/** Highlights Social Security claim decisions occurring in the next two model years. */
export const ssClaimMilestone: Detector = {
  id: 'ss-claim-milestone',
  category: 'social-security',
  version: 1,
  screen(ctx): InsightCard | null {
    const firstProjectionYear = ctx.projection.result.years[0]
    if (firstProjectionYear === undefined || firstProjectionYear.year !== ctx.projection.startYear) return null
    const lastProjectionYear = ctx.projection.result.years.at(-1)?.year

    let selectedCard: InsightCard | null = null
    let smallestYearsToClaim = Infinity
    for (const income of ctx.plan.incomes) {
      if (income.type !== 'socialSecurity') continue
      const person = ctx.plan.household.people.find((candidate) => candidate.id === income.personId)
      if (person === undefined) continue
      const projectedPerson = firstProjectionYear.people.find(
        (candidate) => candidate.personId === person.id && candidate.alive,
      )
      const [birthYear, birthMonth, birthDay] = person.dob.split('-').map(Number)
      if (
        projectedPerson === undefined ||
        !Number.isInteger(birthYear) ||
        !Number.isInteger(birthMonth) ||
        !Number.isInteger(birthDay)
      ) {
        continue
      }

      const claimMonths = income.claimAge.years * 12 + income.claimAge.months
      const benefitStartYear = birthYear + income.claimAge.years
      if (
        streamResolvesNoOwnBenefit(income, person) &&
        !hasFormerSpouseBenefitAnchor(
          ctx.plan,
          income,
          person,
          benefitStartYear,
          ctx.projection.result.years,
        ) &&
        !planHasAnotherSsBenefitAnchor(
          ctx.plan,
          person.id,
          benefitStartYear,
          lastProjectionYear,
          ctx.projection.result.years,
        )
      ) continue

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
