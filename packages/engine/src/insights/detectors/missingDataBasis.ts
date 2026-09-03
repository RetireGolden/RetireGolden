import { formatEvidenceUsd } from '../../internal/evidenceFormat.js'
import type { Detector, InsightCard, InsightEvidence } from '../types.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
} from '../../projection/types.js'
import { taxParameterFilingStatus } from '../../projection/types.js'
import { isAggregatedIra } from '../../strategies/accountEligibility.js'
import { ROTH_QUALIFIED_AGE } from '../../strategies/rothBasis.js'

/**
 * Tax-consequential basis gaps (IRA/Roth/taxable property) vs §121-timing-only
 * property gaps (still surface, honest copy) vs retirement-date / open-ended
 * wage gaps.
 */
type DataGapKind = 'basis' | 'dates' | 'property-timing'

interface DataGap {
  evidence: InsightEvidence
  kind: DataGapKind
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
 * Used only to classify property-gap copy (timing vs tax wording) — never to
 * suppress a gap. The sim multiplies each property by `1 + inflRateAt(year)`
 * once per calendar year from the projection start through the sale year
 * (sale-year growth accrues before the sale is priced). That cumulative product
 * equals `inflFactorFrom(startYear, saleYear + 1)`, which is the published
 * `YearResult.inflationScale` of the year after the sale when that year is in
 * the ledger — use that scale directly when published so a `market.inflationPct`
 * override matches the ledger.
 *
 * Year Y's published inflationScale is the product of rates for start..Y-1
 * only; it never encodes year Y's own rate. When the sale year is the last
 * published year, the sale-year rate is therefore not derivable from published
 * scales. Return null so timing-only copy requires a known sale price — never a
 * guessed rate. Partial fixtures with no usable scales leave growth at 1
 * (opening value).
 */
function projectedSaleYearPropertyValue(
  openingValue: number,
  saleYear: number,
  years: readonly { year: number; inflationScale?: number }[],
): number | null {
  const scaleByYear = new Map<number, number>()
  for (const entry of years) {
    const scale = entry.inflationScale
    if (scale !== undefined && Number.isFinite(scale) && scale > 0) {
      scaleByYear.set(entry.year, scale)
    }
  }
  // Product of rates startYear..saleYear inclusive = inflationScale of saleYear+1.
  const afterSaleScale = scaleByYear.get(saleYear + 1)
  if (afterSaleScale !== undefined) {
    return openingValue * afterSaleScale
  }

  // No next-year scale: sale-year rate is not in any published inflationScale.
  // Fixtures with no usable scales at all → growth factor 1 (no invented path).
  if (scaleByYear.size === 0) {
    return openingValue
  }
  // Some scales published but sale-year rate still unknown — undetermined.
  return null
}

/** Evidence parenthetical: tax-consequential property path. */
const PROPERTY_TAX_PATH_LABEL = 'legacy net-proceeds path'
/**
 * Evidence parenthetical: §121 fully covers zero-basis gain — basis only moves
 * the sale onto the exact path whose proceeds enter cash-flow sizing earlier.
 */
const PROPERTY_TIMING_PATH_LABEL =
  'cash-flow timing path — basis moves sale proceeds into earlier sizing'

/** Card rationale when at least one tax-consequential basis gap is present. */
const TAX_BASIS_RATIONALE =
  'Optional basis fields currently default to assumptions that can change taxes. ' +
  'Entering the real values makes the projection more exact.'
/** Card impact when at least one tax-consequential basis gap is present. */
const TAX_BASIS_IMPACT =
  'The listed defaults may affect withdrawal taxation, Roth access, or property-sale tax.'
/**
 * Card rationale when every basis gap is a §121 fully-excluded property sale
 * retained only for cash-flow timing (no modeled tax change from basis).
 */
const PROPERTY_TIMING_RATIONALE =
  'Optional property basis currently defaults to the legacy sale path. ' +
  'Supplying the basis moves the sale onto the exact path whose proceeds enter ' +
  'cash-flow sizing earlier — a timing effect, not a modeled tax change. ' +
  'Entering the real value makes the projection more exact.'
/** Card impact for §121 timing-only property basis gaps. */
const PROPERTY_TIMING_IMPACT =
  'The listed defaults may change when sale proceeds enter cash-flow sizing, not property-sale tax under the modeled §121 exclusion.'

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
            kind: 'basis',
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (distributions)`,
              value: formatEvidenceUsd(verdict.distributions),
              year: year.year,
            },
          })
        } else if (verdict.conversions >= MIN_VISIBLE_CENT) {
          gaps.push({
            kind: 'basis',
            evidence: {
              label: `${nameList} taxable character from assumed-zero basis (conversions)`,
              value: formatEvidenceUsd(verdict.conversions),
              year: year.year,
            },
          })
        } else if (verdict.annuityPayments >= MIN_VISIBLE_CENT) {
          gaps.push({
            kind: 'basis',
            evidence: {
              label:
                `${nameList} taxable character from assumed-zero basis (IRA-funded annuity payments)`,
              value: formatEvidenceUsd(verdict.annuityPayments),
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
          kind: 'basis',
          evidence: {
            // Plan opening balances, not the trigger year's live figure.
            label: `${nameList} opening balance (assumed zero after-tax basis)`,
            value: formatEvidenceUsd(aggregateBalance),
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
          kind: 'basis',
          evidence: {
            // Verdict is the basis-sensitive spill past known contributions
            // and free conversion cover — not the pool's total withdrawal.
            label:
              `${nameList} owner-pool basis-sensitive spill past known contributions and free conversion cover`,
            value: formatEvidenceUsd(verdict.withdrawal),
            year: year.year,
          },
        })
        const aggregateBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
        gaps.push({
          kind: 'basis',
          evidence: {
            // Plan opening balances, not the trigger year's live figure.
            label: `${nameList} opening balance (assumed contribution basis)`,
            value: formatEvidenceUsd(aggregateBalance),
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
            kind: 'basis',
            evidence: {
              // Verdict is the basis-sensitive spill past known contributions
              // and free conversion cover — not the account's total withdrawal.
              label:
                `${account.name} basis-sensitive spill past known contributions and free conversion cover`,
              value: formatEvidenceUsd(verdict.withdrawal),
              year: year.year,
            },
          })
          gaps.push({
            kind: 'basis',
            evidence: {
              // Engine models employer designated-Roth under IRA ordering
              // (splitRothWithdrawal), not Treas. Reg. §1.402A-1 Q&A-3 pro-rata.
              // Plan opening balance, not the trigger year's live figure.
              label:
                `${account.name} opening balance (modeled as contribution basis under the engine's simplified ordering)`,
              value: formatEvidenceUsd(account.balance),
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
        // Entering a cost basis switches the sim from the legacy tax-free
        // deposit path to the exact propertySaleTax path. Even when tax is
        // identical (e.g. primary residence fully under §121 with no selling
        // costs/recapture), cash timing differs: exact-path net proceeds join
        // `baseCashInflows` before withdrawal sizing, while legacy deposits
        // `expectedNetProceeds ?? salePrice` in the later property-events
        // block. Always surface the gap; classify copy only.
        //
        // Timing-only copy when primary residence + no recapture + no positive
        // selling costs + zero-basis gain (sale price) within the sale-year
        // §121 exclusion — the case retained purely on cash-flow-timing
        // grounds. propertySaleTax treats sellingCostPct 0 and omitted
        // identically (`?? 0`). Unknown sale-year product → tax wording
        // (cannot prove full exclusion). Never suppress.
        const expectedNetProceeds = account.expectedNetProceeds
        const hasExpectedNetProceeds =
          expectedNetProceeds !== null && expectedNetProceeds !== undefined
        const hasPositiveSellingCost =
          account.sellingCostPct !== undefined && account.sellingCostPct > 0
        let propertyGapKind: DataGapKind = 'basis'
        let pathLabel = PROPERTY_TAX_PATH_LABEL
        if (
          account.primaryResidence === true &&
          !hasPositiveSellingCost &&
          account.depreciationRecapture === undefined
        ) {
          // Sale-year filing status governs the §121 bound ($250k single /
          // $500k joint). Survivorship can flip MFJ → single between plan open
          // and the sale; the sim prices propertySaleTax with that year's status.
          const saleYearResult = ctx.projection.result.years.find(
            (y) => y.year === account.plannedSaleYear,
          )
          const filingStatus =
            saleYearResult?.filingStatus !== undefined
              ? taxParameterFilingStatus(saleYearResult.filingStatus)
              : ctx.plan.household.filingStatus
          const exclusionCap =
            ctx.params.federalTax?.section121Exclusion?.[filingStatus] ?? 0
          const salePrice = projectedSaleYearPropertyValue(
            account.value,
            account.plannedSaleYear,
            ctx.projection.result.years,
          )
          // Zero basis, no selling costs, no recapture → gain = salePrice.
          if (salePrice !== null && salePrice <= exclusionCap) {
            propertyGapKind = 'property-timing'
            pathLabel = PROPERTY_TIMING_PATH_LABEL
          }
        }
        if (hasExpectedNetProceeds) {
          gaps.push({
            kind: propertyGapKind,
            evidence: {
              label: `${account.name} expected net proceeds (${pathLabel})`,
              value: formatEvidenceUsd(expectedNetProceeds),
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
              kind: propertyGapKind,
              evidence: {
                label: `${account.name} opening property value (${pathLabel})`,
                value: formatEvidenceUsd(account.value),
                year: ctx.projection.startYear,
              },
            })
          }
        } else {
          // Plan opening value; the sim compounds property to the sale year.
          // Sale-year pre-sale value is zeroed before year-end balances publish,
          // so it is not available without recomputation — label honestly.
          // Pair with the validated planned sale year (the exact fact that put
          // this property in the gap gate) so the card is never a one-row value
          // without the sale trigger that made omitted basis consequential.
          gaps.push({
            kind: propertyGapKind,
            evidence: {
              label: `${account.name} opening property value (${pathLabel})`,
              value: formatEvidenceUsd(account.value),
              year: ctx.projection.startYear,
            },
          })
          gaps.push({
            kind: propertyGapKind,
            evidence: {
              label: `${account.name} planned sale year (${pathLabel})`,
              value: String(account.plannedSaleYear),
              year: account.plannedSaleYear,
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
          kind: 'dates',
          evidence: {
            label: `${person.name} age at projection start (wages assumed to continue for life)`,
            value: String(projectedPerson.ageAttained),
            year: firstProjectionYear.year,
          },
        })
        // The open-ended-wages gap is triggered by continuing positive wage
        // streams, not age alone — cite the summed annual gross of those streams.
        gaps.push({
          kind: 'dates',
          evidence: {
            label: `${person.name} continuing open-ended wages (no retirement age; assumed for life)`,
            value: formatEvidenceUsd(continuingWages),
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

    // Title/rationale name the gap composition so a dates-only card does not
    // claim tax-basis facts are missing (catalog: missing dates/basis).
    // §121 fully-excluded property gaps use timing copy when they are the only
    // basis-like rows; any tax-consequential basis gap keeps tax wording.
    const hasTaxBasis = gaps.some((gap) => gap.kind === 'basis')
    const hasPropertyTiming = gaps.some((gap) => gap.kind === 'property-timing')
    const hasBasis = hasTaxBasis || hasPropertyTiming
    const hasDates = gaps.some((gap) => gap.kind === 'dates')
    let title: string
    let rationale: string
    let impactQualitative: string
    if (hasBasis && hasDates) {
      title = 'Some tax-basis and retirement-date facts use planning defaults'
      if (hasTaxBasis) {
        rationale =
          'Optional basis and retirement-date fields currently default to assumptions that can change taxes. ' +
          'Entering the real values makes the projection more exact.'
        impactQualitative =
          'The listed defaults may affect withdrawal taxation, Roth access, property-sale tax, or projected wages.'
      } else {
        // Property-timing + dates only: do not claim tax change from basis.
        rationale =
          'Optional property basis currently defaults to the legacy sale path (a cash-flow timing effect, not a modeled tax change), ' +
          'and optional retirement-date fields default to assumptions that can change projected wages. ' +
          'Entering the real values makes the projection more exact.'
        impactQualitative =
          'The listed defaults may affect when sale proceeds enter cash-flow sizing, or how long open-ended wages continue.'
      }
    } else if (hasDates) {
      title = 'Some retirement-date facts use planning defaults'
      rationale =
        'Optional retirement-date fields currently default to assumptions that can change projected wages. ' +
        'Entering the real values makes the projection more exact.'
      impactQualitative =
        'The listed defaults may affect how long open-ended wages continue in the projection.'
    } else if (hasTaxBasis) {
      title = 'Some tax-basis facts use planning defaults'
      rationale = TAX_BASIS_RATIONALE
      impactQualitative = TAX_BASIS_IMPACT
    } else {
      // Property-timing only (§121 fully covers zero-basis gain).
      title = 'Some tax-basis facts use planning defaults'
      rationale = PROPERTY_TIMING_RATIONALE
      impactQualitative = PROPERTY_TIMING_IMPACT
    }

    return {
      id: 'missing-data-basis',
      category: 'accounts-contributions',
      title,
      rationale,
      impact: {
        qualitative: impactQualitative,
      },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: evidence as [InsightEvidence, ...InsightEvidence[]],
      action: { kind: 'advisory' },
    }
  },
}
