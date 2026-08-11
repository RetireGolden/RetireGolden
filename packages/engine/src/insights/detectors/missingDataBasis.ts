import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
} from '../../projection/types.js'
import { taxParameterFilingStatus } from '../../projection/types.js'
import { isAggregatedIra } from '../../strategies/accountEligibility.js'
import { ROTH_QUALIFIED_AGE } from '../../strategies/rothBasis.js'

interface DataGap {
  evidence: InsightEvidence
}

/**
 * Half a cent in plan dollars. `usd` rounds with `Math.round(amount * 100)`, so
 * amounts in (0, 0.005) render as `$0` and must not fire a consequential gap —
 * same sub-cent residue floor used elsewhere in the engine (e.g. flexibleGoals).
 */
const MIN_VISIBLE_CENT = 0.005

/**
 * Sale-year property value mirroring simulatePlan's property growth path.
 *
 * The sim multiplies each property by `1 + inflRateAt(year)` once per calendar
 * year from the projection start through the sale year (sale-year growth
 * accrues before the sale is priced). That cumulative product equals
 * `inflFactorFrom(startYear, saleYear + 1)`, which is the published
 * `YearResult.inflationScale` of the year after the sale when that year is in
 * the ledger. Rates are recovered from consecutive published scales so a
 * `market.inflationPct` override matches the ledger — never re-derived from
 * `plan.assumptions.inflationPct` alone.
 *
 * When the sale year is the last published year (no next-year scale), year
 * rates for start..sale-1 come from scale ratios; the sale-year rate holds the
 * last observed yoy rate (same hold-last behavior as a finite market series).
 * Partial fixtures without usable scales leave growth at 1 (no invented path).
 */
function projectedSaleYearPropertyValue(
  openingValue: number,
  startYear: number,
  saleYear: number,
  years: readonly { year: number; inflationScale?: number }[],
): number {
  const scaleByYear = new Map<number, number>()
  for (const entry of years) {
    const scale = entry.inflationScale
    if (scale !== undefined && Number.isFinite(scale) && scale > 0) {
      scaleByYear.set(entry.year, scale)
    }
  }
  // Prefer next-year scale: product of rates startYear..saleYear inclusive.
  const afterSaleScale = scaleByYear.get(saleYear + 1)
  if (afterSaleScale !== undefined) {
    return openingValue * afterSaleScale
  }

  // Reconstruct from consecutive published scales through the sale year.
  let price = openingValue
  let prevScale = scaleByYear.get(startYear)
  if (prevScale === undefined) {
    // No published path — do not invent growth from plan assumptions.
    return openingValue
  }
  let lastRate = 0
  let sawRate = false
  for (let year = startYear; year < saleYear; year += 1) {
    const nextScale = scaleByYear.get(year + 1)
    if (nextScale === undefined) {
      // Incomplete path mid-horizon — stop at last known compound.
      return price
    }
    lastRate = nextScale / prevScale - 1
    sawRate = true
    price *= 1 + lastRate
    prevScale = nextScale
  }
  // Sale year is last published year: apply hold-last rate when any yoy was
  // observed; when the only published scale is the start year (scale 1) there
  // is no growth signal for the sale year either.
  if (sawRate) price *= 1 + lastRate
  return price
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
    //
    // Seed path that actually CONSUMES `nondeductibleBasis` into
    // `iraBasisByOwner` is the static Form 8606 opener in simulate.ts
    // (`isAggregatedIra` only — plain owned traditional IRAs; inherited and
    // treat-as-own accounts are skipped). Contiguous replay mirrors that seed:
    // `pools(plan)` without a tax year admits only `isAggregatedIra`, so a
    // treat-as-own account's entered basis never enters the opening numerator.
    // Per-year aggregation (`isAggregatedIraThisYear`) does put post-election
    // treat-as-own balances in the denominator / verdict set, but entering
    // basis on those accounts still cannot affect the projection until the
    // seed sites also consume them — suppress the card for that membership
    // until seeding covers treat-as-own (do not request inert data).
    const traditionalMissingByOwner = new Map<
      string,
      {
        name: string
        balance: number
      }[]
    >()
    for (const account of ctx.plan.accounts) {
      // Mirror simulate.ts iraBasisByOwner seed: static isAggregatedIra only.
      if (!isAggregatedIra(account) || account.nondeductibleBasis !== undefined) {
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
        if (verdict.distributions >= MIN_VISIBLE_CENT) {
          gaps.push({
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (distributions)`,
              value: usd(verdict.distributions),
              year: year.year,
            },
          })
        } else if (verdict.conversions >= MIN_VISIBLE_CENT) {
          gaps.push({
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (conversions)`,
              value: usd(verdict.conversions),
              year: year.year,
            },
          })
        } else if (verdict.annuityPayments >= MIN_VISIBLE_CENT) {
          gaps.push({
            evidence: {
              label:
                `${nameList} taxable character from assumed-zero basis (IRA-funded annuity payments)`,
              value: usd(verdict.annuityPayments),
              year: year.year,
            },
          })
        } else {
          // Verdict present but all channels below a visible cent — skip this year
          // and keep scanning; a later year may publish a material amount.
          continue
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
      if (owner === undefined || owner.ageAttained >= ROTH_QUALIFIED_AGE) continue
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
        // Sub-cent spill rounds to $0 evidence — require a visible cent.
        if (verdict === undefined || verdict.withdrawal < MIN_VISIBLE_CENT) continue
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
        owner.ageAttained < ROTH_QUALIFIED_AGE
      ) {
        for (const year of ctx.projection.result.years) {
          const entry = year.employerRothAccountActivity?.find(
            (row: EmployerRothAccountActivity) => row.accountId === account.id,
          )
          const verdict = entry?.assumedBasisConsequential
          // Sub-cent spill rounds to $0 evidence — require a visible cent.
          if (verdict === undefined || verdict.withdrawal < MIN_VISIBLE_CENT) continue
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
        // Primary residence + no recapture/selling-cost fields + no legacy
        // expectedNetProceeds: tax only changes from a supplied basis when the
        // zero-basis gain can exceed the §121 exclusion (propertySaleTax:
        // ordinary = min(gain, recapture), capital = gain − ordinary − exclusion).
        // Conservative suppress: only when even zero basis yields fully-excluded
        // gain. Max gain bound = sale-year value (zero basis, no selling costs).
        // Sale price compounds opening value once per year from start through
        // the sale year (sim multiplies infl before pricing the sale).
        const expectedNetProceeds = account.expectedNetProceeds
        const hasExpectedNetProceeds =
          expectedNetProceeds !== null && expectedNetProceeds !== undefined
        if (
          account.primaryResidence === true &&
          !hasExpectedNetProceeds &&
          account.sellingCostPct === undefined &&
          account.depreciationRecapture === undefined
        ) {
          // Sale-year filing status governs the §121 bound ($250k single /
          // $500k joint). Survivorship can flip MFJ → single (or QSS→joint
          // tables via taxParameterFilingStatus) between plan open and the
          // sale; the sim prices propertySaleTax with that year's status.
          const saleYearResult = ctx.projection.result.years.find(
            (y) => y.year === account.plannedSaleYear,
          )
          const filingStatus =
            saleYearResult?.filingStatus !== undefined
              ? taxParameterFilingStatus(saleYearResult.filingStatus)
              : ctx.plan.household.filingStatus
          const exclusionCap =
            ctx.params.federalTax.section121Exclusion[filingStatus] ?? 0
          // Sale price compounds opening value once per calendar year from
          // start through the sale year (sim multiplies inflRateAt(year)
          // before pricing the sale). That product is the projection's
          // published inflation path — not plan.assumptions.inflationPct —
          // so market.inflationPct overrides match the ledger. Cumulative
          // growth through end of year Y equals YearResult.inflationScale of
          // Y+1 (inflFactorFrom(start, Y+1)); reconstruct from published
          // scales when the post-sale year is absent.
          const salePrice = projectedSaleYearPropertyValue(
            account.value,
            ctx.projection.startYear,
            account.plannedSaleYear,
            ctx.projection.result.years,
          )
          // Zero basis, no selling costs, no recapture → gain = salePrice.
          if (salePrice <= exclusionCap) {
            continue
          }
        }
        if (hasExpectedNetProceeds) {
          gaps.push({
            evidence: {
              label: `${account.name} expected net proceeds (legacy net-proceeds path)`,
              value: usd(expectedNetProceeds),
              year: account.plannedSaleYear,
            },
          })
          // Standalone property gap always pairs proceeds with opening value when
          // value is positive — zero proceeds alone are uninformative, and a
          // positive proceeds-only row lacks the basis-gap context (same
          // label/year stamp as the omitted-proceeds branch; sale-year
          // compounded value is not published).
          if (account.value > 0) {
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
        const openEndedWageStreams = ctx.plan.incomes.filter(
          (income): income is Extract<typeof income, { type: 'wages' }> =>
            income.type === 'wages' &&
            income.personId === person.id &&
            income.endAge === null &&
            income.annualGross > 0,
        )
        const continuingWages = openEndedWageStreams.reduce(
          (sum, income) => sum + income.annualGross,
          0,
        )
        const projectedPerson = firstProjectionYear.people.find((candidate) => candidate.personId === person.id)
        if (
          openEndedWageStreams.length === 0 ||
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
        // The open-ended-wages gap is triggered by continuing positive wage
        // streams, not age alone — cite the summed annual gross of those streams.
        gaps.push({
          evidence: {
            label: `${person.name} continuing open-ended wages (no retirement age; assumed for life)`,
            value: usd(continuingWages),
            year: firstProjectionYear.year,
          },
        })
      }
    }

    if (gaps.length === 0) return null

    const evidence = gaps.slice(0, 5).map((gap) => ({ ...gap.evidence }))
    // Cap at five evidence rows. Overflow stays out of `value` (values must
    // remain exact triggering figures); surface the count on the last label.
    if (gaps.length > 5) {
      const last = evidence[4]!
      const overflow = gaps.length - 5
      last.label = `${last.label}...(${overflow} more not shown)`
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
