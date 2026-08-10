import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type { Account } from '../../model/plan.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
  QualifiedAnnuityPaymentActivity,
} from '../../projection/types.js'
import { ROTH_SEASONING_YEARS } from '../../strategies/rothBasis.js'

interface DataGap {
  evidence: InsightEvidence
}

function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}

/**
 * Conversion principal is seasoned (tax- and penalty-free before earnings) once
 * `withdrawalYear - conversionYear >= ROTH_SEASONING_YEARS`, matching
 * `splitRothWithdrawal` (`year - layer.year < ROTH_SEASONING_YEARS` is unseasoned).
 */
function isSeasonedConversion(withdrawalYear: number, conversionYear: number): boolean {
  return withdrawalYear - conversionYear >= ROTH_SEASONING_YEARS
}

/**
 * First pre-qualified-age (age attained < 60) year where a withdrawal exceeds
 * the free basis known at that point: supplied starting contribution basis +
 * contribution credits accumulated in year order + seasoned conversion
 * principal (published conversion credits whose 5-tax-year clock has elapsed),
 * reduced by earlier covered pre-60 draws. Credits cannot retroactively cover
 * an earlier withdrawal.
 */
function firstInsufficientPreQualifiedYear(options: {
  years: readonly {
    year: number
    people: readonly { personId: string; ageAttained: number }[]
    ownedRothIraPoolActivity?: readonly OwnedRothIraPoolActivity[]
    employerRothAccountActivity?: readonly EmployerRothAccountActivity[]
  }[]
  ownerPersonId: string
  suppliedStartingBasis: number
  activityForYear: (year: {
    year: number
    people: readonly { personId: string; ageAttained: number }[]
    ownedRothIraPoolActivity?: readonly OwnedRothIraPoolActivity[]
    employerRothAccountActivity?: readonly EmployerRothAccountActivity[]
  }) => {
    withdrawals: number
    creditedContributions: number
    /** Conversion principal credited this year (owned Roth IRA pool only). */
    creditedConversionPrincipal?: number
    /** Calendar year that starts the conversion's 5-year seasoning clock. */
    conversionYear?: number | null
  } | undefined
}): { year: number; withdrawal: number; knownBasis: number } | null {
  let contributionBasis = options.suppliedStartingBasis
  // Conversion layers, oldest first — same FIFO order as splitRothWithdrawal.
  const conversionLayers: { year: number; remaining: number }[] = []
  for (const year of options.years) {
    const owner = year.people.find((person) => person.personId === options.ownerPersonId)
    const activity = options.activityForYear(year)
    if (activity === undefined) continue
    contributionBasis += activity.creditedContributions
    const conversionPrincipal = activity.creditedConversionPrincipal ?? 0
    if (conversionPrincipal > 0) {
      const conversionYear = activity.conversionYear ?? year.year
      conversionLayers.push({ year: conversionYear, remaining: conversionPrincipal })
    }
    if (owner !== undefined && owner.ageAttained < 60 && activity.withdrawals > 0) {
      // Free cover = contribution basis + seasoned conversion principal only
      // (mirrors tax- and penalty-free layers before earnings / unseasoned taps).
      let freeCover = contributionBasis
      for (const layer of conversionLayers) {
        if (isSeasonedConversion(year.year, layer.year)) freeCover += layer.remaining
      }
      if (activity.withdrawals > freeCover) {
        return {
          year: year.year,
          withdrawal: activity.withdrawals,
          knownBasis: freeCover,
        }
      }
      // Consume free cover in IRS order: contributions, then seasoned conversions
      // oldest first (splitRothWithdrawal does not skip unseasoned, but those are
      // not free cover for this walk — we only reach here when free cover suffices).
      let remaining = activity.withdrawals
      const fromContributions = Math.min(remaining, contributionBasis)
      contributionBasis -= fromContributions
      remaining -= fromContributions
      for (const layer of conversionLayers) {
        if (remaining <= 0) break
        if (!isSeasonedConversion(year.year, layer.year)) continue
        const take = Math.min(remaining, layer.remaining)
        layer.remaining -= take
        remaining -= take
      }
    }
  }
  return null
}

/** Surfaces optional tax facts for which the engine must use a legacy default. */
export const missingDataBasis: Detector = {
  id: 'missing-data-basis',
  category: 'accounts-contributions',
  version: 2,
  screen(ctx): InsightCard | null {
    const gaps: DataGap[] = []
    const firstProjectionYear = ctx.projection.result.years[0]
    const lastProjectionYear = ctx.projection.result.years.at(-1)?.year
    const primaryPersonId = ctx.plan.household.people[0]?.id
    const ownerPersonIdFor = (account: { ownerPersonId: string | null }): string | undefined =>
      account.ownerPersonId ?? primaryPersonId

    const ownedRothIraAccounts = ctx.plan.accounts.filter(
      (account): account is Extract<Account, { type: 'roth' }> =>
        account.type === 'roth' && account.kind === 'ira' && account.inherited === undefined,
    )

    const suppliedOwnedRothIraBasis = (ownerPersonId: string): number =>
      ownedRothIraAccounts.reduce(
        (total, account) => ownerPersonIdFor(account) === ownerPersonId
          ? total + (account.contributionBasis ?? 0)
          : total,
        0,
      )

    /**
     * First projection year with a qualifying owned-IRA distribution, conversion,
     * or IRA-funded annuity payment. Distributions and conversions require the
     * owner alive that year; qualified annuity payments are inspected regardless
     * of the funding owner's alive flag (joint/survivor contracts can keep paying
     * while Form 8606 character still attributes to the funding owner's aggregate).
     * Evidence cites that year's amount (not a horizon sum) so the decisive year is stamped.
     */
    const firstOwnedIraTransactionWhileAlive = (ownerPersonId: string): {
      distributions: number
      conversions: number
      annuityPayments: number
      year: number
    } | null => {
      for (const year of ctx.projection.result.years) {
        const owner = year.people.find((person) => person.personId === ownerPersonId)
        const ownerAlive = owner?.alive === true
        let distributions = 0
        let conversions = 0
        let annuityPayments = 0
        if (ownerAlive) {
          const activity = year.ownedTraditionalIraAggregateActivity?.find(
            (entry: OwnedTraditionalIraAggregateActivity) => entry.ownerPersonId === ownerPersonId,
          )
          if (activity !== undefined) {
            distributions = activity.distributions
            conversions = activity.conversions
          }
        }
        // Post-death payments on a funded contract still land on the funding
        // owner's Form 8606 pool — match the sim's published attribution.
        for (const payment of year.qualifiedAnnuityPayments ?? []) {
          const row = payment as QualifiedAnnuityPaymentActivity
          if (row.fundingOwnerPersonId === ownerPersonId && row.payment > 0) {
            annuityPayments += row.payment
          }
        }
        if (distributions > 0 || conversions > 0 || annuityPayments > 0) {
          return { distributions, conversions, annuityPayments, year: year.year }
        }
      }
      return null
    }

    for (const account of ctx.plan.accounts) {
      const ownerPersonId = ownerPersonIdFor(account)
      const owner = firstProjectionYear?.people.find((person) => person.personId === ownerPersonId)

      if (
        account.type === 'roth' &&
        account.inherited === undefined &&
        account.contributionBasis === undefined &&
        owner !== undefined &&
        owner.ageAttained < 60 &&
        ownerPersonId !== undefined
      ) {
        if (account.kind === 'employer') {
          const decisive = firstInsufficientPreQualifiedYear({
            years: ctx.projection.result.years,
            ownerPersonId,
            suppliedStartingBasis: account.contributionBasis ?? 0,
            activityForYear: (year) =>
              year.employerRothAccountActivity?.find(
                (entry: EmployerRothAccountActivity) => entry.accountId === account.id,
              ),
          })
          if (decisive !== null) {
            gaps.push({
              evidence: {
                label: `${account.name} pre-qualified-age withdrawals`,
                value: usd(decisive.withdrawal),
                year: decisive.year,
              },
            })
            gaps.push({
              evidence: {
                label: `${account.name} known contribution basis`,
                value: usd(decisive.knownBasis),
                year: decisive.year,
              },
            })
          }
        } else if (account.kind === 'ira') {
          const decisive = firstInsufficientPreQualifiedYear({
            years: ctx.projection.result.years,
            ownerPersonId,
            suppliedStartingBasis: suppliedOwnedRothIraBasis(ownerPersonId),
            activityForYear: (year) => {
              const entry = year.ownedRothIraPoolActivity?.find(
                (row: OwnedRothIraPoolActivity) => row.ownerPersonId === ownerPersonId,
              )
              if (entry === undefined) return undefined
              return {
                withdrawals: entry.withdrawals,
                creditedContributions: entry.creditedContributions,
                creditedConversionPrincipal: entry.creditedConversionPrincipal ?? 0,
                conversionYear: entry.conversionYear ?? year.year,
              }
            },
          })
          if (decisive !== null) {
            gaps.push({
              evidence: {
                label: `${account.name} owner-pool pre-qualified-age withdrawals`,
                value: usd(decisive.withdrawal),
                year: decisive.year,
              },
            })
            gaps.push({
              evidence: {
                label: `${account.name} known contribution basis`,
                value: usd(decisive.knownBasis),
                year: decisive.year,
              },
            })
          }
        }
      }

      if (
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        account.inherited === undefined &&
        account.nondeductibleBasis === undefined &&
        ownerPersonId !== undefined
      ) {
        const tx = firstOwnedIraTransactionWhileAlive(ownerPersonId)
        if (tx !== null) {
          if (tx.distributions > 0) {
            gaps.push({
              evidence: {
                label: `${account.name} owned-IRA distributions (projection)`,
                value: usd(tx.distributions),
                year: tx.year,
              },
            })
          } else if (tx.conversions > 0) {
            gaps.push({
              evidence: {
                label: `${account.name} owned-IRA conversions (projection)`,
                value: usd(tx.conversions),
                year: tx.year,
              },
            })
          } else if (tx.annuityPayments > 0) {
            gaps.push({
              evidence: {
                label: `${account.name} IRA-funded annuity payments (projection)`,
                value: usd(tx.annuityPayments),
                year: tx.year,
              },
            })
          }
          gaps.push({
            evidence: {
              label: `${account.name} balance (assumed zero after-tax basis)`,
              value: usd(account.balance),
            },
          })
        }
      }

      if (
        account.type === 'property' &&
        account.value > 0 &&
        account.costBasis === undefined &&
        typeof account.plannedSaleYear === 'number' &&
        account.plannedSaleYear >= ctx.projection.startYear &&
        lastProjectionYear !== undefined &&
        account.plannedSaleYear <= lastProjectionYear
      ) {
        const expectedNetProceeds = account.expectedNetProceeds
        const hasExpectedNetProceeds = expectedNetProceeds !== null && expectedNetProceeds !== undefined
        gaps.push({
          evidence: {
            label: hasExpectedNetProceeds
              ? `${account.name} expected net proceeds (legacy net-proceeds path)`
              : `${account.name} planned-sale value (legacy net-proceeds path)`,
            value: usd(expectedNetProceeds ?? account.value),
            year: account.plannedSaleYear,
          },
        })
      }
    }

    if (firstProjectionYear !== undefined) {
      for (const person of ctx.plan.household.people) {
        if (person.retirementAge !== null) continue
        const hasOpenEndedWages = ctx.plan.incomes.some(
          (income) =>
            income.type === 'wages' &&
            income.personId === person.id &&
            income.endAge === null &&
            income.annualGross > 0,
        )
        const projectedPerson = firstProjectionYear.people.find((candidate) => candidate.personId === person.id)
        if (
          !hasOpenEndedWages ||
          projectedPerson === undefined ||
          !projectedPerson.alive
        ) continue

        gaps.push({
          evidence: {
            label: `${person.name} age at projection start (wages assumed to continue for life)`,
            value: String(projectedPerson.ageAttained),
            year: firstProjectionYear.year,
          },
        })
      }
    }

    if (gaps.length === 0) return null

    const evidence = gaps.slice(0, 5).map((gap) => ({ ...gap.evidence }))
    if (gaps.length > 5) {
      const last = evidence[4]!
      last.value = `${last.value} (+${gaps.length - 5} more)`
    }
    return {
      id: 'missing-data-basis',
      category: 'accounts-contributions',
      title: 'Some tax-basis facts use planning defaults',
      rationale:
        'Optional basis and retirement-date fields currently default to assumptions that can change taxes. ' +
        'Entering the real values makes the projection more exact.',
      impact: {
        qualitative: 'The listed defaults may affect withdrawal taxation, Roth access, property-sale tax, or projected wages.',
      },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: evidence as [InsightEvidence, ...InsightEvidence[]],
      action: { kind: 'advisory' },
    }
  },
}
