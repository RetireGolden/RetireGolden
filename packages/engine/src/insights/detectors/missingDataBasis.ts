import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
} from '../../projection/types.js'

interface DataGap {
  evidence: InsightEvidence
}

/**
 * Format a decisive dollar amount for evidence. Integral amounts stay whole
 * dollars; any non-integral amount keeps exact cents (e.g. $0.60, not $1).
 */
function usd(amount: number): string {
  const cents = Math.round(amount * 100)
  if (cents % 100 === 0) {
    return `$${(cents / 100).toLocaleString('en-US')}`
  }
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Surfaces optional tax facts for which the engine must use a legacy default.
 *
 * Roth / employer-Roth / traditional-IRA basis gaps read the ledger's published
 * assumed-basis consequential verdict — they never re-derive Form 8606 pro-rata
 * or splitRothWithdrawal free-cover arithmetic. Property and wage gaps stay on
 * plan inputs.
 *
 * Traditional §408(d)(2) aggregate figures are emitted once per owner (listing
 * every owned IRA that omitted nondeductibleBasis), not under each account name
 * — the aggregate can include contracts funded by a different IRA. Owned Roth
 * IRA gaps mirror that: the published verdict is per-owner pool, so missing-
 * basis Roth IRAs are aggregated once per owner.
 */
export const missingDataBasis: Detector = {
  id: 'missing-data-basis',
  category: 'accounts-contributions',
  version: 1,
  screen(ctx): InsightCard | null {
    const gaps: DataGap[] = []
    const firstProjectionYear = ctx.projection.result.years[0]
    const lastProjectionYear = ctx.projection.result.years.at(-1)?.year
    const primaryPersonId = ctx.plan.household.people[0]?.id
    const ownerPersonIdFor = (account: { ownerPersonId: string | null }): string | undefined =>
      account.ownerPersonId ?? primaryPersonId

    // Traditional Form 8606 gaps: one emission per owner for the owned-IRA
    // aggregate, naming every missing-basis account that participates.
    const traditionalMissingByOwner = new Map<
      string,
      { name: string; balance: number }[]
    >()
    for (const account of ctx.plan.accounts) {
      if (
        account.type !== 'traditional' ||
        account.kind !== 'ira' ||
        account.inherited !== undefined ||
        account.nondeductibleBasis !== undefined
      ) {
        continue
      }
      const ownerPersonId = ownerPersonIdFor(account)
      if (ownerPersonId === undefined) continue
      const list = traditionalMissingByOwner.get(ownerPersonId) ?? []
      list.push({ name: account.name, balance: account.balance })
      traditionalMissingByOwner.set(ownerPersonId, list)
    }
    for (const [ownerPersonId, accounts] of traditionalMissingByOwner) {
      for (const year of ctx.projection.result.years) {
        const activity = year.ownedTraditionalIraAggregateActivity?.find(
          (entry: OwnedTraditionalIraAggregateActivity) =>
            entry.ownerPersonId === ownerPersonId,
        )
        const verdict = activity?.assumedBasisConsequential
        if (verdict === undefined) continue

        const nameList = accounts.map((a) => a.name).join(', ')
        // Cite the binding channel's taxable ordinary-income character under
        // assumed-zero basis — not the year's full distribution gross (a
        // QCD-plus-conversion year cites the conversion). Figures are the
        // owner's §408(d)(2) owned-IRA aggregate, not a single account's gross.
        if (verdict.distributions > 0) {
          gaps.push({
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (distributions)`,
              value: usd(verdict.distributions),
              year: year.year,
            },
          })
        } else if (verdict.conversions > 0) {
          gaps.push({
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (conversions)`,
              value: usd(verdict.conversions),
              year: year.year,
            },
          })
        } else if (verdict.annuityPayments > 0) {
          gaps.push({
            evidence: {
              label:
                `${nameList} taxable character from assumed-zero basis (IRA-funded annuity payments)`,
              value: usd(verdict.annuityPayments),
              year: year.year,
            },
          })
        } else {
          // Verdict present but all channels zero — still nothing to cite.
          break
        }
        const aggregateBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
        gaps.push({
          evidence: {
            // Plan opening balances, not the trigger year's live figure.
            label: `${nameList} opening balance (assumed zero after-tax basis)`,
            value: usd(aggregateBalance),
            year: ctx.projection.startYear,
          },
        })
        break
      }
    }

    // Owned Roth IRA gaps: one emission per owner for the published pool
    // verdict, naming every missing-basis Roth IRA that participates.
    const rothIraMissingByOwner = new Map<
      string,
      { name: string; balance: number }[]
    >()
    for (const account of ctx.plan.accounts) {
      if (
        account.type !== 'roth' ||
        account.kind !== 'ira' ||
        account.inherited !== undefined ||
        account.contributionBasis !== undefined
      ) {
        continue
      }
      const ownerPersonId = ownerPersonIdFor(account)
      if (ownerPersonId === undefined) continue
      const owner = firstProjectionYear?.people.find(
        (person) => person.personId === ownerPersonId,
      )
      if (owner === undefined || owner.ageAttained >= 60) continue
      const list = rothIraMissingByOwner.get(ownerPersonId) ?? []
      list.push({ name: account.name, balance: account.balance })
      rothIraMissingByOwner.set(ownerPersonId, list)
    }
    for (const [ownerPersonId, accounts] of rothIraMissingByOwner) {
      for (const year of ctx.projection.result.years) {
        const entry = year.ownedRothIraPoolActivity?.find(
          (row: OwnedRothIraPoolActivity) => row.ownerPersonId === ownerPersonId,
        )
        const verdict = entry?.assumedBasisConsequential
        if (verdict === undefined || verdict.withdrawal <= 0) continue
        const nameList = accounts.map((a) => a.name).join(', ')
        gaps.push({
          evidence: {
            // Verdict is the basis-sensitive spill past known contributions
            // and free conversion cover — not the pool's total withdrawal.
            label:
              `${nameList} owner-pool basis-sensitive spill past known contributions and free conversion cover`,
            value: usd(verdict.withdrawal),
            year: year.year,
          },
        })
        const aggregateBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
        gaps.push({
          evidence: {
            // Plan opening balances, not the trigger year's live figure.
            label: `${nameList} opening balance (assumed contribution basis)`,
            value: usd(aggregateBalance),
            year: ctx.projection.startYear,
          },
        })
        break
      }
    }

    for (const account of ctx.plan.accounts) {
      const ownerPersonId = ownerPersonIdFor(account)
      const owner = firstProjectionYear?.people.find((person) => person.personId === ownerPersonId)

      if (
        account.type === 'roth' &&
        account.kind === 'employer' &&
        account.inherited === undefined &&
        account.contributionBasis === undefined &&
        owner !== undefined &&
        owner.ageAttained < 60
      ) {
        for (const year of ctx.projection.result.years) {
          const entry = year.employerRothAccountActivity?.find(
            (row: EmployerRothAccountActivity) => row.accountId === account.id,
          )
          const verdict = entry?.assumedBasisConsequential
          if (verdict === undefined || verdict.withdrawal <= 0) continue
          gaps.push({
            evidence: {
              // Verdict is the basis-sensitive spill past known contributions
              // and free conversion cover — not the account's total withdrawal.
              label:
                `${account.name} basis-sensitive spill past known contributions and free conversion cover`,
              value: usd(verdict.withdrawal),
              year: year.year,
            },
          })
          gaps.push({
            evidence: {
              // Engine models employer designated-Roth under IRA ordering
              // (splitRothWithdrawal), not Treas. Reg. §1.402A-1 Q&A-3 pro-rata.
              // Plan opening balance, not the trigger year's live figure.
              label:
                `${account.name} opening balance (modeled as contribution basis under the engine's simplified ordering)`,
              value: usd(account.balance),
              year: ctx.projection.startYear,
            },
          })
          break
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
          // positive value — cite the opening property value (same label/year
          // stamp as the omitted-proceeds branch; sale-year compounded value
          // is not published).
          if (expectedNetProceeds === 0 && account.value > 0) {
            gaps.push({
              evidence: {
                label: `${account.name} opening property value (legacy net-proceeds path)`,
                value: usd(account.value),
                year: ctx.projection.startYear,
              },
            })
          }
        } else {
          // Plan opening value; the sim compounds property to the sale year.
          // Sale-year pre-sale value is zeroed before year-end balances publish,
          // so it is not available without recomputation — label honestly.
          gaps.push({
            evidence: {
              label: `${account.name} opening property value (legacy net-proceeds path)`,
              value: usd(account.value),
              year: ctx.projection.startYear,
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
