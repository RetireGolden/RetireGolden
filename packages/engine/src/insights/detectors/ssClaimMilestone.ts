import type { Detector, InsightCard } from '../types.js'
import type { Plan } from '../../model/plan.js'
import type { SocialSecurityStreamActivity } from '../../projection/types.js'
import { claimFactor } from '../../socialSecurity/claimFactor.js'
import { bestMaritalBenefit } from '../../socialSecurity/maritalBenefits.js'
import { effectiveBirthYear, fraForBirthYear } from '../../socialSecurity/nra.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '../../socialSecurity/piaFromEarnings.js'

type SocialSecurityIncome = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
type HouseholdPerson = Plan['household']['people'][number]

/**
 * Own PIA for the winning-anchor comparison — same resolver the sim uses:
 * entered `piaMonthly`, else AIME → bend points from earnings history.
 * Returns null when neither path yields a usable PIA (cannot prove a
 * pre-horizon marital win over own).
 */
function resolveOwnPiaMonthly(
  streamIncome: SocialSecurityIncome,
  claimant: HouseholdPerson,
): number | null {
  if (streamIncome.piaMonthly !== null) return streamIncome.piaMonthly
  if (!streamIncome.earnings || streamIncome.earnings.length === 0) return null
  const y = Number(claimant.dob.slice(0, 4))
  const m = Number(claimant.dob.slice(5, 7))
  const d = Number(claimant.dob.slice(8, 10))
  const projection = resolveEarningsProjection(
    streamIncome.earningsProjection,
    claimant.retirementAge,
  )
  const result = computePiaFromEarnings(
    piaInputFromEarnings(y, m, d, streamIncome.earnings, projection),
  )
  if (isPiaFromEarningsError(result)) return null
  return result.piaMonthly
}

/**
 * True when this stream's configured claim-age year is `year`
 * (`dobYear + claimAge.years` on the annual ledger). Used to treat claimInForce
 * rows zeroed by an auxiliary override as real filing events — distinct from
 * unmodeled zeros that have no filing-age transition.
 */
function isFilingAgeTransition(
  streamIncome: SocialSecurityIncome | undefined,
  year: number,
  dobYear: number,
): boolean {
  return streamIncome !== undefined && year === dobYear + streamIncome.claimAge.years
}

/**
 * True when this person's spousal/survivor gate stream is paying an auxiliary
 * source in `yearStreams`. Required before treating a claimInForce row with
 * zero published amounts as an override-hidden filing — a plain zero-PIA
 * stream publishes the same shape with no auxiliary and must stay unmodeled.
 */
function gateStreamPayingAuxiliary(
  yearStreams: readonly SocialSecurityStreamActivity[],
  personId: string,
): boolean {
  for (const entry of yearStreams) {
    if (entry.personId !== personId || !entry.isSpousalSurvivorGateStream) continue
    if (entry.source !== 'spousal' && entry.source !== 'survivor') continue
    if (entry.annualAmount > 0 || entry.preWithholdingAnnual > 0) return true
  }
  return false
}

/**
 * Annual-ledger payable months in a year at `ageAttained` given `claimAge`
 * (same rule as simulatePlan): claim year truncates to months after the claim
 * month; later years pay all 12.
 */
function payableMonthsAtAge(
  ageAttained: number,
  claimAge: { years: number; months: number },
): number {
  if (ageAttained < claimAge.years) return 0
  if (ageAttained > claimAge.years) return 12
  return Math.max(0, 12 - claimAge.months)
}

/**
 * True when this stream is on a valid SSDI path (disability onset before FRA).
 * SSDI is not a retirement filing; claimInForce rows zeroed by an auxiliary
 * override on an SSDI sibling must not enter the filing-age transition path.
 */
function isSsdiPathStream(
  streamIncome: SocialSecurityIncome | undefined,
  personFraYears: number,
): boolean {
  return (
    streamIncome?.disability?.onsetAge !== undefined &&
    streamIncome.disability.onsetAge < personFraYears
  )
}

function formatAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearLabel = years === 1 ? '1 year' : `${years} years`
  const monthLabel = months === 1 ? '1 month' : `${months} months`
  return `${yearLabel} ${monthLabel}`
}

/**
 * Format a modeled benefit for evidence. Integral amounts stay whole dollars;
 * any non-integral amount keeps exact cents (e.g. $0.60, $1,234.56).
 */
function formatBenefitUsd(amount: number): string {
  const cents = Math.round(amount * 100)
  if (cents % 100 === 0) {
    return `$${(cents / 100).toLocaleString('en-US')}`
  }
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
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
 * Last socialSecurity income for a person — matches sim `ssStreamByPerson`
 * last-wins precedence and the published `isSpousalSurvivorGateStream` marker.
 */
function lastSsIncomeForPerson(plan: Plan, personId: string): SocialSecurityIncome | undefined {
  let last: SocialSecurityIncome | undefined
  for (const candidate of plan.incomes) {
    if (candidate.type === 'socialSecurity' && candidate.personId === personId) {
      last = candidate
    }
  }
  return last
}

/**
 * True when a positive auxiliary row at the horizon start is already-paying
 * pre-horizon (not a new in-horizon entitlement transition).
 *
 * Distinguishes via published start-year rows only: positive aux with the same
 * source at start, no earlier in-horizon zero, and the enabling event already
 * present at start (co-spouse claim-in-force pre-horizon, co-spouse already
 * deceased for household survivor, a deceased former spouse on the claimant's
 * stream for former-spouse survivor, or a living former spouse whose marital
 * benefit already *won* over own benefit pre-horizon — eligibility alone is
 * not enough when the published auxiliary first appears because a different
 * enabler arrives at start). A first-year NEW entitlement — spouse claims or
 * dies in year one, or a living former spouse first reaches eligibility age
 * (62) at start — returns false so the start-year row can still fire.
 */
function auxiliaryAlreadyPayingAtHorizonStart(args: {
  entry: SocialSecurityStreamActivity
  personId: string
  projectedAge: number
  claimAgeYears: number | undefined
  firstProjectionYear: {
    year: number
    people: readonly { personId: string; ageAttained: number; alive: boolean }[]
    socialSecurityStreams?: readonly SocialSecurityStreamActivity[]
  }
  plan: Plan
}): boolean {
  const { entry, personId, projectedAge, claimAgeYears, firstProjectionYear, plan } = args
  // First possible own-claim year is not "already paying" — keep NEW entitlements.
  if (claimAgeYears !== undefined && projectedAge <= claimAgeYears) return false

  const streamIncome = plan.incomes.find(
    (candidate): candidate is SocialSecurityIncome =>
      candidate.type === 'socialSecurity' && candidate.id === entry.streamId,
  )
  const hasDeceasedFormerSpouse =
    streamIncome?.formerSpouses?.some((former) => former.relationship === 'deceased') === true

  const coPerson = plan.household.people.find((candidate) => candidate.id !== personId)
  if (entry.source === 'survivor') {
    if (coPerson === undefined) {
      // Former-spouse survivor (no household co-person): positive past claim age at start.
      return true
    }
    const coState = firstProjectionYear.people.find((row) => row.personId === coPerson.id)
    // Enabling death already present at start (household co-spouse not alive).
    if (coState !== undefined && !coState.alive) return true
    // Survivor from a deceased former spouse on this stream while household
    // co-person is still alive — death is a plan fact, not an in-horizon event.
    return hasDeceasedFormerSpouse
  }

  // Spousal: enabling event = co-spouse already claim-in-force pre-horizon, or a
  // living former spouse whose marital benefit already won pre-horizon.
  if (coPerson === undefined) {
    // Former-spouse spousal (single household): pre-horizon only when a living
    // former spouse was eligible under bestMaritalBenefit *and* that benefit
    // actually displaced the claimant's own benefit before start — the same
    // "larger of own vs marital" rule the sim uses when publishing the
    // auxiliary. Mere eligibility of a low-PIA ex is not already-paying when
    // the published start-year spousal row first appears because a second ex
    // turns 62 at start. Tie to the published start-year row: entry is already
    // source spousal with positive amounts (caller); require a prior-year win
    // that could explain that already-paying source.
    // First eligibility year at start (e.g. ex turns 62 in the start year) is a
    // NEW entitlement, not already-paying — evaluate the year before start.
    const livingFormers =
      streamIncome?.formerSpouses?.filter((former) => former.relationship === 'divorced') ?? []
    if (livingFormers.length === 0) {
      // No living former on the stream: treat positive past claim age as pre-horizon.
      return true
    }
    const claimant = plan.household.people.find((row) => row.id === personId)
    if (claimant === undefined || streamIncome === undefined) return false
    const startYear = firstProjectionYear.year
    const claimantDob = {
      year: Number(claimant.dob.slice(0, 4)),
      month: Number(claimant.dob.slice(5, 7)),
      day: Number(claimant.dob.slice(8, 10)),
    }
    // Year before horizon start: already-enabling pre-horizon, not first eligibility.
    const priorYear = startYear - 1
    const claimantAgePrior = projectedAge - 1
    const maritalCtx = {
      claimantDob,
      claimantClaimAge: streamIncome.claimAge,
      claimantAge: claimantAgePrior,
      year: priorYear,
      claimantIsSingle: true as const,
    }
    const bestPrior = bestMaritalBenefit(livingFormers, maritalCtx)
    if (bestPrior === null) return false
    // Own PIA: same path as simulatePlan (entered amount, else earnings AIME).
    // Without a usable own PIA we cannot prove a prior-year win over own — but
    // an already-eligible living former (bestPrior) with claim age pre-horizon
    // and a positive published aux at start means the enabler predates the
    // horizon. Suppress as already-paying (enabling-event rule); do not treat
    // null/unusable own PIA as a new in-horizon entitlement.
    const ownPiaMonthly = resolveOwnPiaMonthly(streamIncome, claimant)
    if (ownPiaMonthly === null) return true
    // Sim publishes auxiliary only when marital annual > own. Prior-year win
    // means the published start-year spousal source was already the paying
    // benefit, not a new entitlement from a first-time enabler at start.
    const ownMonthly =
      ownPiaMonthly *
      claimFactor(
        claimantDob.year,
        claimantDob.month,
        claimantDob.day,
        streamIncome.claimAge,
      )
    return bestPrior.monthly > ownMonthly
  }
  const coState = firstProjectionYear.people.find(
    (row) => row.personId === coPerson.id && row.alive,
  )
  if (coState === undefined) return true
  const coClaiming = (firstProjectionYear.socialSecurityStreams ?? []).some(
    (row) =>
      row.personId === coPerson.id &&
      row.claimInForce &&
      (row.annualAmount > 0 || row.preWithholdingAnnual > 0),
  )
  if (!coClaiming) return false
  // Prefer the published gate stream (sim last-wins); fall back to last plan income.
  const gateStreamId = (firstProjectionYear.socialSecurityStreams ?? []).find(
    (row) => row.personId === coPerson.id && row.isSpousalSurvivorGateStream,
  )?.streamId
  const coIncome =
    gateStreamId !== undefined
      ? plan.incomes.find(
          (candidate): candidate is SocialSecurityIncome =>
            candidate.type === 'socialSecurity' && candidate.id === gateStreamId,
        )
      : lastSsIncomeForPerson(plan, coPerson.id)
  // Co-spouse claim-in-force at start with age past their claim age = pre-horizon
  // enabling event. If co-spouse is in their first claim year (age == claimAge),
  // the enabling claim occurs in year one — not already-paying.
  if (coIncome !== undefined && coState.ageAttained > coIncome.claimAge.years) {
    return true
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
 * source is no longer `ssdi`. Auxiliary (spousal/survivor) entitlements key on
 * the first year the published auxiliary amount becomes positive within the
 * horizon (a transition) — not the configured own-benefit claim age. An
 * auxiliary already positive at the horizon start with the same source is
 * pre-horizon (already paying), not a new entitlement; a later in-horizon
 * transition (e.g. spouse claims or dies after start) still surfaces.
 */
export const ssClaimMilestone: Detector = {
  id: 'ss-claim-milestone',
  category: 'social-security',
  version: 1,
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
      // Calendar birth year for ageAttained alignment with simulatePlan;
      // FRA uses effectiveBirthYear (Jan-1 rule) exactly as the sim does.
      const birthYear = Number(person.dob.slice(0, 4))
      const birthMonth = Number(person.dob.slice(5, 7))
      const birthDay = Number(person.dob.slice(8, 10))
      const personFraYears = fraForBirthYear(
        effectiveBirthYear(birthYear, birthMonth, birthDay),
      ).years
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
        // Auxiliary sources (spousal/survivor): claimAge is the own-benefit
        // filing age, not when the auxiliary entitlement becomes payable.
        // Key on a transition to positive within the horizon — not claim age.
        // Already-paying pre-horizon: positive at the start year with the same
        // auxiliary source, no earlier in-horizon zero row, and the enabling
        // event already present at start (co-spouse pre-horizon claim-in-force
        // via last-wins gate stream, household co-spouse already deceased, or a
        // deceased former spouse on this stream). First-year NEW entitlements
        // (spouse claims or dies in year one; co-spouse not yet
        // pre-horizon-established) stay out of this set so the search below
        // can still fire at yearsToClaim = 0.
        if (entry.source === 'spousal' || entry.source === 'survivor') {
          if (
            auxiliaryAlreadyPayingAtHorizonStart({
              entry,
              personId: person.id,
              projectedAge: projectedPerson.ageAttained,
              claimAgeYears: streamIncome?.claimAge.years,
              firstProjectionYear,
              plan: ctx.plan,
            })
          ) {
            preHorizonStreamIds.add(entry.streamId)
          }
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
      // streams that model a filing: positive paid or pre-withholding, or a
      // claimInForce row zeroed by auxiliary override whose claim age falls in
      // this year (filing-age transition). Unmodeled zeros (both amounts ≤ 0,
      // no auxiliary override in force, or no filing-age transition) are skipped
      // so later sibling streams still surface. Also skip own-retirement that
      // follows a published SSDI year on the same stream (FRA conversion).
      let firstClaimYear: number | null = null
      let firstClaimStream: SocialSecurityStreamActivity | null = null
      for (const year of projectionYears) {
        const yearStreams = year.socialSecurityStreams ?? []
        const streams = yearStreams.filter(
          (entry: SocialSecurityStreamActivity) => {
            if (
              entry.personId !== person.id ||
              !entry.claimInForce ||
              entry.source === 'ssdi' ||
              (
                entry.source === 'own-retirement' &&
                streamPublishedSsdiThrough(projectionYears, entry.streamId, year.year - 1)
              ) ||
              preHorizonStreamIds.has(entry.streamId)
            ) {
              return false
            }
            // Positive paid or pre-withholding → modeled benefit (incl. withheld).
            if (entry.annualAmount > 0 || entry.preWithholdingAnnual > 0) return true
            // Zeroed-by-override filing: claimInForce stays true while auxiliary
            // override zeroes source/amounts. Require the person's gate stream
            // to be paying an auxiliary source this year — otherwise a plain
            // zero-PIA stream (claimInForce + $0, no aux) matches this shape
            // at its configured filing year and must stay unmodeled (silent).
            // SSDI is not a filing: a valid SSDI sibling (or any stream that
            // published source ssdi) zeroed by auxiliary override must not
            // enter this path even when claimAge.years coincides with the year.
            if (!gateStreamPayingAuxiliary(yearStreams, person.id)) return false
            const streamIncome = ctx.plan.incomes.find(
              (candidate): candidate is SocialSecurityIncome =>
                candidate.type === 'socialSecurity' && candidate.id === entry.streamId,
            )
            if (
              isSsdiPathStream(streamIncome, personFraYears) ||
              streamPublishedSsdiThrough(projectionYears, entry.streamId, year.year)
            ) {
              return false
            }
            return isFilingAgeTransition(streamIncome, year.year, birthYear)
          },
        )
        if (streams.length === 0) continue
        // Same-year preference: positive published payment, then gate stream, then order.
        const preferred =
          streams.find((entry) => entry.annualAmount > 0) ??
          streams.find((entry) => entry.preWithholdingAnnual > 0) ??
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
      const fullyWithheld = paidAmount <= 0 && preWithholding > 0
      const ssdiSuppressed =
        isSsdiPathStream(income, personFraYears) ||
        streamPublishedSsdiThrough(projectionYears, firstClaimStream.streamId, firstClaimYear)
      const zeroedFiling =
        paidAmount <= 0 &&
        preWithholding <= 0 &&
        !ssdiSuppressed &&
        isFilingAgeTransition(income, firstClaimYear, birthYear)
      // Unmodeled zero/zero without a filing-age transition should not reach here.
      if (paidAmount <= 0 && preWithholding <= 0 && !zeroedFiling) continue

      // Benefit evidence stays within the GOVERNANCE two-to-five cap. Fully
      // withheld claims need both the claim-age-sensitive pre-withholding amount
      // and the withheld-to-$0 paid entry — free a slot by omitting age-at-start.
      const benefitEvidence: InsightCard['evidence'] = fullyWithheld
        ? [
            {
              label:
                `${person.name}'s pre-withholding modeled benefit in first claim year ` +
                `(${sourceLabel})`,
              value: formatBenefitUsd(preWithholding),
              year: firstClaimYear,
            },
            {
              label:
                `${person.name}'s paid amount in first claim year ` +
                `(earnings test / SGA withheld to $0; ${sourceLabel})`,
              value: '$0',
              year: firstClaimYear,
            },
          ]
        : paidAmount > 0
          ? [
              {
                label: `${person.name}'s modeled benefit in first claim year (${sourceLabel})`,
                value: formatBenefitUsd(paidAmount),
                year: firstClaimYear,
              },
            ]
          : [
              // Zeroed-by-override filing: amounts cleared; claim facts carry the signal.
              {
                label:
                  `${person.name}'s modeled benefit in first claim year ` +
                  `(claim in force; ${sourceLabel})`,
                value: '$0',
                year: firstClaimYear,
              },
            ]

      const claimAgeLabel = formatAge(claimMonths)
      // Annual ledger ages are whole years; configured months are evidence-only.
      // Use the dual-age rationale when the first payable year is not the claim-age year.
      const agesAlign = ageAtFirstPayableYear === income.claimAge.years
      const rationale = agesAlign
        ? `The model starts ${person.name}'s Social Security at age ${claimAgeLabel} in ${firstClaimYear}. ` +
          'The modeled benefit amount depends on the claim age — confirm it against the Social Security analysis before filing.'
        : `The model uses a configured claim age of ${claimAgeLabel} for ${person.name}, with the first modeled payable year ${firstClaimYear} ` +
          `(attained age ${ageAtFirstPayableYear}). The modeled benefit amount depends on the claim age — confirm it against the Social Security analysis before filing.`

      // Partial-year wording only when the filing actually truncates months in
      // the first payable year (payableMonthsAtAge < 12). Pre-horizon filers
      // receiving all 12 months in an auxiliary first-benefit year must not
      // carry the "partial when claim months > 0" qualifier.
      const firstYearPayableMonths = payableMonthsAtAge(
        ageAtFirstPayableYear,
        income.claimAge,
      )
      const firstClaimYearLabel =
        firstYearPayableMonths < 12
          ? 'Modeled first claim year (claim in force; partial when claim months > 0)'
          : 'Modeled first claim year (claim in force)'

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
          ...(fullyWithheld
            ? []
            : [
                {
                  label: `Age at projection start (${firstProjectionYear.year})`,
                  value: String(projectedPerson.ageAttained),
                  year: firstProjectionYear.year,
                },
              ]),
          {
            label: firstClaimYearLabel,
            value: String(firstClaimYear),
            year: firstClaimYear,
          },
          ...benefitEvidence,
        ],
        plannerRoute: 'social-security-analysis',
        action: { kind: 'advisory' },
      }
      smallestYearsToClaim = yearsToClaim
    }

    return selectedCard
  },
}
