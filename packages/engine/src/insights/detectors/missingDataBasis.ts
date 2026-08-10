import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type { Account } from '../../model/plan.js'
import type {
  CreditedRothConversionLayer,
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
  QualifiedAnnuityPaymentActivity,
} from '../../projection/types.js'
import { openIraProRataYear } from '../../strategies/iraBasis.js'
import { ROTH_SEASONING_YEARS } from '../../strategies/rothBasis.js'

interface DataGap {
  evidence: InsightEvidence
}

/**
 * Format a decisive dollar amount for evidence. Whole dollars stay rounded;
 * positive sub-dollar amounts (which would otherwise Math.round to $0) keep cents.
 */
function usd(amount: number): string {
  if (amount > 0 && amount < 0.5) {
    return `$${amount.toFixed(2)}`
  }
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
 * Free (tax- and penalty-free) cover from a conversion layer at the withdrawal
 * year, mirroring `splitRothWithdrawal`:
 * - Seasoned: entire remaining principal.
 * - Unseasoned with no taxable principal left: entire remaining principal
 *   (nontaxable conversion basis never recaptures).
 * - Unseasoned with any taxable principal: **zero**. Nontaxable share is not
 *   independently withdrawable — `splitRothWithdrawal` allocates every take
 *   proportionally (`taxableTake = take * taxable/amount`), so any draw from a
 *   mixed/taxable unseasoned layer has recapture exposure and cannot suppress
 *   a missing-basis flag.
 */
function freeConversionCover(
  withdrawalYear: number,
  layer: { year: number; remaining: number; taxableRemaining: number },
): number {
  if (layer.remaining <= 0) return 0
  if (isSeasonedConversion(withdrawalYear, layer.year)) return layer.remaining
  // Unseasoned: free only when the layer is fully nontaxable. Mixed layers
  // contribute no free cover — proportional allocation makes any take taxable.
  if (layer.taxableRemaining > 0) return 0
  return layer.remaining
}

/**
 * First pre-qualified-age (age attained < 60) year where a withdrawal exceeds
 * the free basis known at that point: supplied starting contribution basis +
 * contribution credits accumulated in year order + seasoned conversion
 * principal (any) + unseasoned conversion principal that is fully nontaxable,
 * reduced by earlier covered pre-60 draws. Mixed unseasoned layers never
 * contribute free cover (proportional recapture). Credits cannot retroactively
 * cover an earlier withdrawal.
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
    /**
     * Conversion layers credited this year in ledger commit order (owned pool
     * or employer account). Same-year multi-conversion events stay separate so
     * FIFO free-cover matches `splitRothWithdrawal`.
     */
    creditedConversionLayers?: readonly CreditedRothConversionLayer[]
  } | undefined
}): { year: number; withdrawal: number; knownBasis: number } | null {
  let contributionBasis = options.suppliedStartingBasis
  // Conversion layers, oldest first — same FIFO order as splitRothWithdrawal.
  const conversionLayers: { year: number; remaining: number; taxableRemaining: number }[] = []
  for (const year of options.years) {
    const owner = year.people.find((person) => person.personId === options.ownerPersonId)
    const activity = options.activityForYear(year)
    if (activity === undefined) continue
    contributionBasis += activity.creditedContributions
    // Append each published layer in commit order (not a merged principal/taxable
    // pair — mixed taxable ratios would destroy FIFO free-cover boundaries).
    for (const layer of activity.creditedConversionLayers ?? []) {
      if (layer.principal <= 0) continue
      const taxable = Math.min(
        layer.principal,
        Math.max(0, layer.taxable),
      )
      conversionLayers.push({
        year: layer.year,
        remaining: layer.principal,
        taxableRemaining: taxable,
      })
    }
    if (owner !== undefined && owner.ageAttained < 60 && activity.withdrawals > 0) {
      // Free cover = contributions + seasoned principal + unseasoned fully
      // nontaxable principal. Mixed unseasoned layers add nothing (proportional
      // recapture makes their nontaxable share not independently withdrawable).
      let freeCover = contributionBasis
      for (const layer of conversionLayers) {
        freeCover += freeConversionCover(year.year, layer)
      }
      if (activity.withdrawals > freeCover) {
        return {
          year: year.year,
          withdrawal: activity.withdrawals,
          knownBasis: freeCover,
        }
      }
      // Consume free cover in IRS order: contributions, then conversion layers
      // oldest first (same layer order as splitRothWithdrawal). Only free
      // layers are drawn here — we only reach this branch when free cover
      // already covers the full withdrawal. Within a free layer, any take still
      // allocates proportionally (splitRothWithdrawal: taxableTake = take *
      // taxable/amount) so seasoned residual taxable state stays consistent.
      let remaining = activity.withdrawals
      const fromContributions = Math.min(remaining, contributionBasis)
      contributionBasis -= fromContributions
      remaining -= fromContributions
      for (const layer of conversionLayers) {
        if (remaining <= 0) break
        const free = freeConversionCover(year.year, layer)
        const take = Math.min(remaining, free)
        if (take <= 0) continue
        const taxableTake =
          layer.remaining > 0 ? take * (layer.taxableRemaining / layer.remaining) : 0
        layer.remaining -= take
        layer.taxableRemaining = Math.max(0, layer.taxableRemaining - taxableTake)
        remaining -= take
      }
    }
  }
  return null
}

/**
 * Published owned-traditional-IRA residual pool value for one owner in one
 * projection year, when the ledger published account balances. Prefers
 * pre-growth owned non-Roth IRA balances (post-debit residual, before growth);
 * falls back to year-end `balances`.
 *
 * Form 8606 / `openIraProRataYear` apply the nontaxable fraction to a
 * denominator that still includes the year's distributions and conversions
 * (residual + those debits). Callers that need the pro-rata pool must add
 * published owned-IRA distributions+conversions back — see
 * `form8606OwnedIraPoolDenominator`.
 */
function publishedOwnedTraditionalIraResidual(
  year: {
    ownedNonRothIraBalancesBeforeGrowth?: Readonly<Record<string, number>>
    balances?: Readonly<Record<string, number>>
  } | undefined,
  ownedTraditionalIraIds: readonly string[],
): number | null {
  if (year === undefined || ownedTraditionalIraIds.length === 0) return null
  const preGrowth = year.ownedNonRothIraBalancesBeforeGrowth
  if (preGrowth !== undefined) {
    let total = 0
    let any = false
    for (const id of ownedTraditionalIraIds) {
      const value = preGrowth[id]
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value
        any = true
      }
    }
    if (any) return total
  }
  const yearEnd = year.balances
  if (yearEnd !== undefined) {
    let total = 0
    let any = false
    for (const id of ownedTraditionalIraIds) {
      const value = yearEnd[id]
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value
        any = true
      }
    }
    if (any) return total
  }
  return null
}

/**
 * Year's published owned-IRA distributions + conversions for one owner (Form
 * 8606 aggregate activity). Zero when the row is missing or amounts are absent.
 */
function publishedOwnedIraDistributionsAndConversions(
  year:
    | {
        ownedTraditionalIraAggregateActivity?: readonly OwnedTraditionalIraAggregateActivity[]
      }
    | undefined,
  ownerPersonId: string,
): number {
  if (year === undefined) return 0
  const activity = year.ownedTraditionalIraAggregateActivity?.find(
    (entry) => entry.ownerPersonId === ownerPersonId,
  )
  if (activity === undefined) return 0
  return Math.max(0, activity.distributions) + Math.max(0, activity.conversions)
}

/**
 * Form 8606-style pool denominator for saturation: residual published balances
 * plus the year's owned-IRA distributions and conversions (the pool the
 * pro-rata fraction applies to). Returns null when no residual is published.
 */
function form8606OwnedIraPoolDenominator(
  year:
    | {
        ownedNonRothIraBalancesBeforeGrowth?: Readonly<Record<string, number>>
        balances?: Readonly<Record<string, number>>
        ownedTraditionalIraAggregateActivity?: readonly OwnedTraditionalIraAggregateActivity[]
      }
    | undefined,
  ownedTraditionalIraIds: readonly string[],
  ownerPersonId: string,
): number | null {
  const residual = publishedOwnedTraditionalIraResidual(year, ownedTraditionalIraIds)
  if (residual === null) return null
  return residual + publishedOwnedIraDistributionsAndConversions(year, ownerPersonId)
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
            activityForYear: (year) => {
              const entry = year.employerRothAccountActivity?.find(
                (row: EmployerRothAccountActivity) => row.accountId === account.id,
              )
              if (entry === undefined) return undefined
              return {
                withdrawals: entry.withdrawals,
                creditedContributions: entry.creditedContributions,
                creditedConversionLayers: entry.creditedConversionLayers ?? [],
              }
            },
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
                creditedConversionLayers: entry.creditedConversionLayers ?? [],
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
        // Form 8606 aggregates all owned non-inherited IRAs for the owner. When
        // other accounts already supply enough nondeductible basis that the
        // aggregate nontaxable fraction is 100% (basis ≥ pool value — reachable
        // after losses), extra basis on this missing-basis account cannot change
        // any transaction's tax character. Saturation must be judged against the
        // pool relevant to the transaction year (contributions/growth can enlarge
        // the pool after plan open), not opening balances alone.
        const ownedTraditionalIras = ctx.plan.accounts.filter(
          (candidate): candidate is Extract<Account, { type: 'traditional' }> =>
            candidate.type === 'traditional' &&
            candidate.kind === 'ira' &&
            candidate.inherited === undefined &&
            ownerPersonIdFor(candidate) === ownerPersonId,
        )
        const ownedTraditionalIraIds = ownedTraditionalIras.map((candidate) => candidate.id)
        const openingPoolValue = ownedTraditionalIras.reduce(
          (total, candidate) => total + candidate.balance,
          0,
        )
        const knownAggregateBasis = ownedTraditionalIras.reduce(
          (total, candidate) => total + (candidate.nondeductibleBasis ?? 0),
          0,
        )

        const tx = firstOwnedIraTransactionWhileAlive(ownerPersonId)
        if (tx !== null) {
          const txYearRow = ctx.projection.result.years.find((year) => year.year === tx.year)
          // Pro-rata denominator = residual balances + year's distributions +
          // conversions (ownedNonRothIraBalancesBeforeGrowth is post-debit
          // residual; Form 8606 applies the fraction to the full pre-debit pool).
          const publishedTxPool = form8606OwnedIraPoolDenominator(
            txYearRow,
            ownedTraditionalIraIds,
            ownerPersonId,
          )
          let poolValueForSaturation: number
          if (publishedTxPool !== null) {
            poolValueForSaturation = publishedTxPool
          } else {
            // Pool value for the transaction year is not published. Skip only when
            // saturation holds conservatively: known basis ≥ the largest pool
            // value across transaction years derivable from published year
            // balances or plan opening balances (growth can only enlarge the pool
            // relative to a smaller observed figure, so the max is the hard case).
            const poolCandidates: number[] = [openingPoolValue]
            for (const year of ctx.projection.result.years) {
              const owner = year.people.find((person) => person.personId === ownerPersonId)
              const ownerAlive = owner?.alive === true
              let hasTransaction = false
              if (ownerAlive) {
                const activity = year.ownedTraditionalIraAggregateActivity?.find(
                  (entry: OwnedTraditionalIraAggregateActivity) =>
                    entry.ownerPersonId === ownerPersonId,
                )
                if (
                  activity !== undefined &&
                  (activity.distributions > 0 || activity.conversions > 0)
                ) {
                  hasTransaction = true
                }
              }
              if (!hasTransaction) {
                for (const payment of year.qualifiedAnnuityPayments ?? []) {
                  const row = payment as QualifiedAnnuityPaymentActivity
                  if (row.fundingOwnerPersonId === ownerPersonId && row.payment > 0) {
                    hasTransaction = true
                    break
                  }
                }
              }
              if (!hasTransaction) continue
              const published = form8606OwnedIraPoolDenominator(
                year,
                ownedTraditionalIraIds,
                ownerPersonId,
              )
              if (published !== null) poolCandidates.push(published)
            }
            poolValueForSaturation = Math.max(...poolCandidates)
          }
          const aggregateAlreadyFullyNontaxable =
            openIraProRataYear(knownAggregateBasis, poolValueForSaturation)
              .nontaxableFraction >= 1
          if (aggregateAlreadyFullyNontaxable) continue

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
        if (hasExpectedNetProceeds) {
          gaps.push({
            evidence: {
              label: `${account.name} expected net proceeds (legacy net-proceeds path)`,
              value: usd(expectedNetProceeds),
              year: account.plannedSaleYear,
            },
          })
          // Zero proceeds alone are uninformative when the property still has
          // positive value — cite the property value (labeled as such) too.
          if (expectedNetProceeds === 0 && account.value > 0) {
            gaps.push({
              evidence: {
                label: `${account.name} property value`,
                value: usd(account.value),
                year: account.plannedSaleYear,
              },
            })
          }
        } else {
          gaps.push({
            evidence: {
              label: `${account.name} planned-sale value (legacy net-proceeds path)`,
              value: usd(account.value),
              year: account.plannedSaleYear,
            },
          })
        }
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
