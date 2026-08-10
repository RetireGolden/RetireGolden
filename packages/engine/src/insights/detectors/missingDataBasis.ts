import type { Detector, InsightCard, InsightEvidence } from '../types.js'

interface DataGap {
  evidence: InsightEvidence
}

function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}

/** Surfaces optional tax facts for which the engine must use a legacy default. */
export const missingDataBasis: Detector = {
  id: 'missing-data-basis',
  category: 'accounts-contributions',
  version: 1,
  screen(ctx): InsightCard | null {
    const gaps: DataGap[] = []

    for (const account of ctx.plan.accounts) {
      if (
        account.type === 'roth' &&
        account.inherited === undefined &&
        account.balance > 0 &&
        account.contributionBasis === undefined
      ) {
        gaps.push({
          evidence: {
            label: `${account.name} balance (assumed seasoned contribution basis)`,
            value: usd(account.balance),
          },
        })
      }
      if (
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        account.inherited === undefined &&
        account.balance > 0 &&
        account.nondeductibleBasis === undefined
      ) {
        gaps.push({
          evidence: {
            label: `${account.name} balance (assumed zero after-tax basis)`,
            value: usd(account.balance),
          },
        })
      }
      if (
        account.type === 'property' &&
        account.costBasis === undefined &&
        typeof account.plannedSaleYear === 'number'
      ) {
        gaps.push({
          evidence: {
            label: `${account.name} planned-sale value (legacy net-proceeds path)`,
            value: usd(account.value),
            year: account.plannedSaleYear,
          },
        })
      }
    }

    const firstProjectionYear = ctx.projection.result.years[0]
    if (firstProjectionYear !== undefined) {
      for (const person of ctx.plan.household.people) {
        if (person.retirementAge !== null) continue
        const wageIncome = ctx.plan.incomes.find(
          (income) => income.type === 'wages' && income.personId === person.id && income.endAge === null,
        )
        const projectedPerson = firstProjectionYear.people.find((candidate) => candidate.personId === person.id)
        if (wageIncome === undefined || projectedPerson === undefined) continue

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
