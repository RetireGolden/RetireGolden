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
    const firstProjectionYear = ctx.projection.result.years[0]
    const lastProjectionYear = ctx.projection.result.years.at(-1)?.year
    // YearWithdrawals exposes only aggregate Roth withdrawals: simulate includes
    // inheritedRothForced and employer-Roth withdrawals in it without publishing
    // either component separately. Employer Roth stays in its own basis pool, so
    // an owned Roth IRA can be attributed only when it is the sole Roth source.
    const hasInheritedRothAccount = ctx.plan.accounts.some(
      (account) => account.type === 'roth' && account.inherited !== undefined,
    )
    const hasEmployerRothAccount = ctx.plan.accounts.some(
      (account) => account.type === 'roth' && account.kind === 'employer',
    )
    const ownedRothOwnerIds = new Set(
      ctx.plan.accounts
        .filter((account) => account.type === 'roth' && account.inherited === undefined)
        .map((account) => account.ownerPersonId)
        .filter((ownerPersonId): ownerPersonId is string => ownerPersonId !== null),
    )
    const hasUnownedRothAccount = ctx.plan.accounts.some(
      (account) => account.type === 'roth' && account.inherited === undefined && account.ownerPersonId === null,
    )
    const traditionalOwnerIds = new Set(
      ctx.plan.accounts
        .filter((account) =>
          account.type === 'traditional' &&
          account.kind === 'ira' &&
          account.inherited === undefined,
        )
        .map((account) => account.ownerPersonId)
        .filter((ownerPersonId): ownerPersonId is string => ownerPersonId !== null),
    )
    const hasUnownedTraditionalAccount = ctx.plan.accounts.some(
      (account) =>
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        account.inherited === undefined &&
        account.ownerPersonId === null,
    )
    const hasInheritedTraditionalAccount = ctx.plan.accounts.some(
      (account) => account.type === 'traditional' && account.inherited !== undefined,
    )
    const hasEmployerTraditionalAccount = ctx.plan.accounts.some(
      (account) => account.type === 'traditional' && account.kind === 'employer',
    )

    const underQualifiedAgeRothOwnerIdsInYear = (year: {
      people: { personId: string; ageAttained: number }[]
      withdrawals?: { roth?: number }
    }): Set<string> => {
      const ids = new Set<string>()
      // The aggregate cannot identify an owned under-age withdrawal when an
      // inherited or employer Roth accounts may have supplied it; silence per
      // GOVERNANCE because their separate pools do not establish IRA basis use.
      if (hasInheritedRothAccount || hasEmployerRothAccount) return ids
      if ((year.withdrawals?.roth ?? 0) <= 0) return ids
      for (const account of ctx.plan.accounts) {
        if (account.type !== 'roth' || account.inherited !== undefined || account.balance <= 0) continue
        const ownerPersonId = account.ownerPersonId
        if (ownerPersonId === null) continue
        const owner = year.people.find((person) => person.personId === ownerPersonId)
        if (owner !== undefined && owner.ageAttained < 60) ids.add(ownerPersonId)
      }
      return ids
    }

    // Household Roth withdrawals are aggregate — skip basis gaps when multiple under-60 Roth
    // owners coexist in a withdrawal year (withdrawal source is ambiguous; silence per GOVERNANCE).
    const ambiguousUnderAgeRothWithdrawals = ctx.projection.result.years.some(
      (year) => underQualifiedAgeRothOwnerIdsInYear(year).size >= 2,
    )

    const hasPreQualifiedRothWithdrawal = (ownerPersonId: string | null): boolean => {
      if (ambiguousUnderAgeRothWithdrawals) return false
      if (
        ownerPersonId === null ||
        hasUnownedRothAccount ||
        ownedRothOwnerIds.size !== 1 ||
        !ownedRothOwnerIds.has(ownerPersonId)
      ) return false
      return ctx.projection.result.years.some((year) => {
        const underAgeOwners = underQualifiedAgeRothOwnerIdsInYear(year)
        return underAgeOwners.size === 1 && underAgeOwners.has(ownerPersonId ?? '')
      })
    }

    const hasTraditionalTransactionWhileOwnerAlive = (ownerPersonId: string | null): boolean => {
      if (
        ownerPersonId === null ||
        hasUnownedTraditionalAccount ||
        traditionalOwnerIds.size !== 1 ||
        !traditionalOwnerIds.has(ownerPersonId)
      ) return false

      return ctx.projection.result.years.some((year) => {
        const owner = year.people.find((person) => person.personId === ownerPersonId)
        if (owner?.alive !== true) return false

        // Traditional withdrawals are aggregate and can include inherited IRAs
        // or employer plans, neither of which carries Form 8606 basis. The
        // conversion path excludes inherited accounts, but the engine also
        // permits employer traditional plans as conversion sources, so that
        // signal is unambiguous only without an employer traditional account.
        const ownedIraWithdrawal =
          (year.withdrawals?.traditional ?? 0) > 0 &&
          !hasInheritedTraditionalAccount &&
          !hasEmployerTraditionalAccount
        const ownedIraConversion =
          (year.rothConversion ?? 0) > 0 && !hasEmployerTraditionalAccount
        return ownedIraWithdrawal || ownedIraConversion
      })
    }

    for (const account of ctx.plan.accounts) {
      const owner = firstProjectionYear?.people.find((person) => person.personId === account.ownerPersonId)
      if (
        account.type === 'roth' &&
        account.inherited === undefined &&
        account.balance > 0 &&
        account.contributionBasis === undefined &&
        owner !== undefined &&
        owner.ageAttained < 60 &&
        hasPreQualifiedRothWithdrawal(account.ownerPersonId)
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
        account.nondeductibleBasis === undefined &&
        // Traditional withdrawals are aggregate. Attribute a gap only when this
        // owner is the household's sole traditional-account owner; otherwise the
        // distributed or converted source is ambiguous.
        hasTraditionalTransactionWhileOwnerAlive(account.ownerPersonId)
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
