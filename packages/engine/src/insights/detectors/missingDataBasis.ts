import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type { Account } from '../../model/plan.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
  QualifiedAnnuityPaymentActivity,
} from '../../projection/types.js'

interface DataGap {
  evidence: InsightEvidence
}

function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}

/**
 * First pre-qualified-age (age attained < 60) year where a withdrawal exceeds
 * the basis known at that point: supplied starting basis + credits accumulated
 * in year order through that year, reduced by earlier covered pre-60 draws.
 * Credits cannot retroactively cover an earlier withdrawal.
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
  }) => { withdrawals: number; creditedContributions: number } | undefined
}): { year: number; withdrawal: number; knownBasis: number } | null {
  let knownBasis = options.suppliedStartingBasis
  for (const year of options.years) {
    const owner = year.people.find((person) => person.personId === options.ownerPersonId)
    const activity = options.activityForYear(year)
    if (activity === undefined) continue
    knownBasis += activity.creditedContributions
    if (owner !== undefined && owner.ageAttained < 60 && activity.withdrawals > 0) {
      if (activity.withdrawals > knownBasis) {
        return {
          year: year.year,
          withdrawal: activity.withdrawals,
          knownBasis,
        }
      }
      knownBasis = Math.max(0, knownBasis - activity.withdrawals)
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
     * or IRA-funded annuity payment while the owner is alive. Evidence cites that
     * year's amount (not a horizon sum) so the decisive year is stamped.
     */
    const firstOwnedIraTransactionWhileAlive = (ownerPersonId: string): {
      distributions: number
      conversions: number
      annuityPayments: number
      year: number
    } | null => {
      for (const year of ctx.projection.result.years) {
        const owner = year.people.find((person) => person.personId === ownerPersonId)
        if (owner?.alive !== true) continue
        let distributions = 0
        let conversions = 0
        let annuityPayments = 0
        const activity = year.ownedTraditionalIraAggregateActivity?.find(
          (entry: OwnedTraditionalIraAggregateActivity) => entry.ownerPersonId === ownerPersonId,
        )
        if (activity !== undefined) {
          distributions = activity.distributions
          conversions = activity.conversions
        }
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
        account.balance > 0 &&
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
            activityForYear: (year) =>
              year.ownedRothIraPoolActivity?.find(
                (entry: OwnedRothIraPoolActivity) => entry.ownerPersonId === ownerPersonId,
              ),
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
        account.balance > 0 &&
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
