/**
 * State QCD conformity bridge and CA/NJ HSA nonconformity adjustments.
 *
 * QCD policy always comes from the configured state pack. Unknown policy never
 * becomes a silent numeric zero presented as exact. NJ reconstructs GIT
 * Worksheet C; Arkansas applies an adopted annual per-owner cap across events.
 *
 * CA Schedule CA adds contributions/earnings and subtracts the federally
 * included nonqualified HSA distribution (line 8f). NJ taxes contributions that
 * escaped NJ income plus interest/dividends/realized lot gains; cash withdrawal
 * is not a second gross-income event (nj-hsa-supplement design assumption).
 */

import {
  emptyLeafAdjustment,
  isKnownMoney,
  legacyHsaToAccountFacts,
  mergeLeafAdjustments,
  type KnownMoney,
  type StateDirectQcdPolicy,
  type StateHsaAccountYearFacts,
  type StateHsaYearFacts,
  type StateLeafAdjustment,
  type StateNjIraOwnerPoolFacts,
  type StateQcdEventFacts,
  type StateQcdYearFacts,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

function incomplete(code: string, ruleId: string, message: string, missingFacts: string[]): StateLeafAdjustment {
  return {
    taxableIncomeDelta: 0,
    taxCredit: 0,
    warnings: [{ code, ruleId, message, missingFacts }],
  }
}

function requireKnown(
  fact: KnownMoney | undefined,
  missing: string,
): { ok: true; amount: number } | { ok: false; warning: StateTaxExactnessWarning } {
  if (!isKnownMoney(fact)) {
    return {
      ok: false,
      warning: {
        code: 'state-hsa-money-unknown',
        ruleId: 'state-hsa-known-money',
        message: `Exact HSA adjustment unavailable: ${missing} is unknown (not known zero).`,
        missingFacts: [missing],
      },
    }
  }
  return { ok: true, amount: Math.max(0, fact.amount) }
}

/** Resolve pack policy; never trust caller-supplied policy on facts. */
export function resolveDirectQcdPolicy(packPolicy: StateDirectQcdPolicy | undefined): StateDirectQcdPolicy {
  return packPolicy ?? { kind: 'unknown' }
}

/**
 * Reconstruct NJ Worksheet C taxable ratio / liquidation recovery for an owner
 * pool. Returns incomplete on unknown basis or inconsistent nonnegative pools.
 */
export function newJerseyWorksheetCTaxableAmount(args: {
  pool: StateNjIraOwnerPoolFacts
  /** Gross distributions (including QCD) that share this pool's ratio. */
  correspondingGrossDistributions: number
}): StateLeafAdjustment & { stateTaxableIraAmount?: number; basisRecovered?: number } {
  const { pool } = args
  if (pool.annualInputsComplete === false) return incomplete('nj-ira-annual-inputs-incomplete', 'state-direct-qcd-conformity', 'New Jersey annual IRA pool does not reconcile with actual annual distributions.', ['allAnnualDistributions', 'annualInputsComplete'])
  const dec31 = pool.december31IraValue
  const allDist = pool.allAnnualDistributions
  const exempt = Math.max(0, pool.exemptObligationIncome ?? 0)

  if (!Number.isFinite(dec31) || !Number.isFinite(allDist) || dec31 < 0 || allDist < 0) {
    return incomplete(
      'nj-qcd-pool-invalid',
      'state-direct-qcd-conformity',
      'New Jersey IRA Worksheet C pool rejected: December 31 value and annual distributions must be finite and nonnegative.',
      ['december31IraValue', 'allAnnualDistributions'],
    )
  }

  if (!isKnownMoney(pool.unrecoveredNjTaxedContributions)) {
    return incomplete(
      'nj-qcd-basis-unknown',
      'state-direct-qcd-conformity',
      'New Jersey QCD/IRA taxable component incomplete: unrecovered NJ contribution basis is unknown; no fabricated addition.',
      ['unrecoveredNjTaxedContributions', 'njIraBasisPool'],
    )
  }

  const unrecovered = Math.max(0, pool.unrecoveredNjTaxedContributions.amount)
  const totalValue = dec31 + allDist
  if (totalValue < 0 || unrecovered > totalValue + 1e-9) {
    return incomplete(
      'nj-qcd-pool-inconsistent',
      'state-direct-qcd-conformity',
      'New Jersey IRA Worksheet C pool rejected: unrecovered basis exceeds total value or totals are inconsistent.',
      ['unrecoveredNjTaxedContributions', 'december31IraValue', 'allAnnualDistributions'],
    )
  }

  const corresponding = Math.max(0, args.correspondingGrossDistributions)
  if (corresponding > allDist + 1e-9) {
    return incomplete(
      'nj-qcd-pool-inconsistent',
      'state-direct-qcd-conformity',
      'New Jersey IRA Worksheet C pool rejected: corresponding distributions exceed the annual distribution total.',
      ['allAnnualDistributions', 'correspondingGrossDistributions'],
    )
  }

  if (pool.fullLiquidation && dec31 !== 0) return incomplete('nj-ira-liquidation-inconsistent', 'state-direct-qcd-conformity', 'A fully liquidated IRA owner pool cannot retain a December 31 value.', ['december31IraValue', 'fullLiquidation'])
  if (pool.fullLiquidation) {
    // Full liquidation recovers remaining NJ basis against the corresponding
    // gross; taxable = max(0, corresponding − unrecovered) after exempt-obligation.
    const allocation = allDist === 0 ? 0 : corresponding / allDist
    const basisRecovered = Math.min(unrecovered, allDist) * allocation
    const taxable = Math.max(0, corresponding - basisRecovered - exempt * allocation)
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [], stateTaxableIraAmount: taxable, basisRecovered }
  }

  if (totalValue === 0) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [], stateTaxableIraAmount: 0, basisRecovered: 0 }
  }

  // taxableRatio = (totalValue − unrecovered NJ-taxed contributions) / totalValue
  // after removing exempt-obligation income from the earnings side when present.
  const taxablePool = Math.max(0, totalValue - unrecovered - exempt)
  const taxableRatio = taxablePool / totalValue
  const stateTaxableIraAmount = corresponding * taxableRatio
  // Exempt-obligation earnings are exempt income, not previously taxed contributions.
  const basisRecovered = corresponding * unrecovered / totalValue
  return {
    taxableIncomeDelta: 0,
    taxCredit: 0,
    warnings: [],
    stateTaxableIraAmount,
    basisRecovered: Math.max(0, basisRecovered),
  }
}

function qcdEventAdjustment(args: {
  event: StateQcdEventFacts
  policy: StateDirectQcdPolicy
  ownerCapRemaining: number
  njPool?: StateNjIraOwnerPoolFacts
}): { adjustment: StateLeafAdjustment; ownerCapConsumed: number } {
  const { event, policy } = args

  if (event.splitInterest) {
    return {
      adjustment: incomplete(
        'state-qcd-split-interest-refused',
        'state-direct-qcd-conformity',
        'Split-interest QCD remains a typed refusal; state policy is not applied.',
        ['supportedDirectQcdTransactionType'],
      ),
      ownerCapConsumed: 0,
    }
  }

  if (!event.directTransfer || event.directCharityTransfer <= 0) {
    return {
      adjustment: incomplete(
        'state-qcd-direct-transfer-required',
        'state-direct-qcd-conformity',
        'State QCD adjustment requires a direct charity transfer; unsupported transaction kinds do not inherit direct-QCD policy.',
        ['directTransfer'],
      ),
      ownerCapConsumed: 0,
    }
  }

  if (policy.kind === 'unknown') {
    return {
      adjustment: incomplete(
        'state-qcd-policy-unknown',
        'state-direct-qcd-conformity',
        'Exact state QCD result unavailable: direct-QCD conformity policy is unknown; federal exclusion is not silently carried as an exact state answer.',
        ['stateDirectQcdPolicy'],
      ),
      ownerCapConsumed: 0,
    }
  }

  if (event.residency === 'fullYearNonresident') {
    return { adjustment: emptyLeafAdjustment(), ownerCapConsumed: 0 }
  }

  if (event.residency === 'unknown' || event.residency === 'partYear') {
    return {
      adjustment: incomplete(
        'state-qcd-residency-incomplete',
        'state-direct-qcd-conformity',
        'State QCD allocation incomplete without full residency/date facts.',
        ['residency', 'transferDate'],
      ),
      ownerCapConsumed: 0,
    }
  }

  if (policy.kind === 'conforms') {
    if (policy.charitableCreditAdjustment === 'coveredCreditAddback' && event.kansasCoveredCharitableCreditClaimed === undefined) {
      return { adjustment: incomplete('ks-qcd-charitable-credit-unknown', 'ks-qcd-charitable-credit-adjustment', 'Kansas QCD treatment is incomplete until covered charitable-credit use is known.', ['kansasCoveredCharitableCreditClaimed']), ownerCapConsumed: 0 }
    }
    if (policy.charitableCreditAdjustment === 'coveredCreditAddback' && event.kansasCoveredCharitableCreditClaimed) {
      return { adjustment: { taxableIncomeDelta: Math.max(0, event.federalExcludedAmount), taxCredit: 0, warnings: [] }, ownerCapConsumed: 0 }
    }
    return { adjustment: emptyLeafAdjustment(), ownerCapConsumed: Math.max(0, event.federalExcludedAmount) }
  }

  if (policy.kind === 'conformsWithAdoptedCap') {
    const otherwiseTaxable = Math.max(0, event.otherwiseTaxableAmount ?? event.federalExcludedAmount)
    const federalExcluded = Math.max(0, event.federalExcludedAmount)
    const eligible = Math.min(otherwiseTaxable, federalExcluded)
    const remaining = Math.max(0, args.ownerCapRemaining)
    const stateExcluded = Math.min(eligible, remaining)
    const addition = Math.max(0, federalExcluded - stateExcluded)
    return {
      adjustment: { taxableIncomeDelta: addition, taxCredit: 0, warnings: [] },
      ownerCapConsumed: stateExcluded,
    }
  }

  // noGeneralFederalExclusion (NJ): Worksheet C reconstruction.
  if (!args.njPool) {
    return {
      adjustment: incomplete(
        'nj-qcd-basis-unknown',
        'state-direct-qcd-conformity',
        'New Jersey QCD/IRA taxable component incomplete: annual Worksheet C owner pool is missing.',
        ['njIraOwnerPool', 'unrecoveredNjTaxedContributions'],
      ),
      ownerCapConsumed: 0,
    }
  }

  const corresponding = Math.max(0, event.directCharityTransfer)
  const worksheet = newJerseyWorksheetCTaxableAmount({
    pool: args.njPool,
    correspondingGrossDistributions: corresponding,
  })
  if (worksheet.warnings.length > 0 || worksheet.stateTaxableIraAmount === undefined) {
    return { adjustment: { taxableIncomeDelta: 0, taxCredit: 0, warnings: worksheet.warnings }, ownerCapConsumed: 0 }
  }

  // delta = state taxable corresponding amount − federal included corresponding amount
  const federalIncluded = Math.max(0, event.federalTaxableAmount)
  const delta = worksheet.stateTaxableIraAmount - federalIncluded
  return {
    adjustment: { taxableIncomeDelta: delta, taxCredit: 0, warnings: [] },
    ownerCapConsumed: 0,
  }
}

/**
 * Apply pack-authoritative QCD policy across an annual event collection.
 * Arkansas adopted caps aggregate per owner; two owners are independent.
 */
export function stateDirectQcdCollectionAdjustment(args: {
  events: readonly StateQcdEventFacts[]
  packPolicy: StateDirectQcdPolicy | undefined
  njPools?: readonly StateNjIraOwnerPoolFacts[]
}): StateLeafAdjustment {
  const policy = resolveDirectQcdPolicy(args.packPolicy)
  if (args.events.length === 0) return emptyLeafAdjustment()

  // Worksheet C is an annual owner calculation. In a full liquidation the
  // unrecovered basis is consumed once across all QCD events, never once per
  // event. Allocate the owner-year taxable component in direct-transfer order.
  if (policy.kind === 'noGeneralFederalExclusion') {
    const parts: StateLeafAdjustment[] = []
    const byOwner = new Map<string, StateQcdEventFacts[]>()
    for (const event of args.events) {
      const rows = byOwner.get(event.ownerPersonId) ?? []
      rows.push(event)
      byOwner.set(event.ownerPersonId, rows)
    }
    const pools = new Map((args.njPools ?? []).map((pool) => [pool.ownerPersonId, pool]))
    for (const [owner, events] of byOwner) {
      const pool = pools.get(owner)
      if (!pool) {
        parts.push(incomplete('nj-qcd-basis-unknown', 'state-direct-qcd-conformity', 'New Jersey QCD/IRA taxable component incomplete: annual Worksheet C owner pool is missing.', ['njIraOwnerPool', 'unrecoveredNjTaxedContributions']))
        continue
      }
      const eligible = events.filter((event) => event.directTransfer && event.directCharityTransfer > 0 && !event.splitInterest && event.residency === 'fullYearResident')
      for (const event of events) {
        if (event.splitInterest) parts.push(incomplete('state-qcd-split-interest-refused', 'state-direct-qcd-conformity', 'Split-interest QCD remains a typed refusal; state policy is not applied.', ['supportedDirectQcdTransactionType']))
        else if (!event.directTransfer || event.directCharityTransfer <= 0) parts.push(incomplete('state-qcd-direct-transfer-required', 'state-direct-qcd-conformity', 'State QCD adjustment requires a direct charity transfer.', ['directTransfer']))
        else if (event.residency === 'unknown' || event.residency === 'partYear') parts.push(incomplete('state-qcd-residency-incomplete', 'state-direct-qcd-conformity', 'State QCD allocation incomplete without full residency/date facts.', ['residency', 'transferDate']))
      }
      const totalCorresponding = eligible.reduce((sum, event) => sum + Math.max(0, event.directCharityTransfer), 0)
      const worksheet = newJerseyWorksheetCTaxableAmount({ pool, correspondingGrossDistributions: totalCorresponding })
      if (worksheet.warnings.length > 0 || worksheet.stateTaxableIraAmount === undefined || totalCorresponding === 0) {
        if (worksheet.warnings.length > 0) parts.push(worksheet)
        continue
      }
      let allocatedTaxable = 0
      eligible.forEach((event, index) => {
        const share = index + 1 === eligible.length
          ? worksheet.stateTaxableIraAmount! - allocatedTaxable
          : worksheet.stateTaxableIraAmount! * Math.max(0, event.directCharityTransfer) / totalCorresponding
        allocatedTaxable += share
        parts.push({ taxableIncomeDelta: share - Math.max(0, event.federalTaxableAmount), taxCredit: 0, warnings: [] })
      })
    }
    return mergeLeafAdjustments(parts)
  }

  const poolsByOwner = new Map((args.njPools ?? []).map((p) => [p.ownerPersonId, p]))
  const remainingByOwner = new Map<string, number>()
  const parts: StateLeafAdjustment[] = []

  for (const event of args.events) {
    const prior = Math.max(0, event.priorAnnualQcdAmountUsed ?? 0)
    if (!remainingByOwner.has(event.ownerPersonId)) {
      const cap = policy.kind === 'conformsWithAdoptedCap' ? policy.annualCap : Number.POSITIVE_INFINITY
      remainingByOwner.set(event.ownerPersonId, Math.max(0, cap - prior))
    }
    const remaining = remainingByOwner.get(event.ownerPersonId) ?? 0
    const { adjustment, ownerCapConsumed } = qcdEventAdjustment({
      event,
      policy,
      ownerCapRemaining: remaining,
      njPool: poolsByOwner.get(event.ownerPersonId),
    })
    parts.push(adjustment)
    remainingByOwner.set(event.ownerPersonId, Math.max(0, remaining - ownerCapConsumed))
  }

  return mergeLeafAdjustments(parts)
}

/** Legacy single-row QCD entry point; pack policy overwrites any caller policy. */
export function stateDirectQcdAdjustment(
  facts: StateQcdYearFacts,
  packPolicy?: StateDirectQcdPolicy,
): StateLeafAdjustment {
  const policy = resolveDirectQcdPolicy(packPolicy)
  const event: StateQcdEventFacts = {
    eventId: 'legacy-qcd',
    accountId: 'legacy-account',
    ownerPersonId: facts.ownerPersonId,
    grossIraDistribution: facts.grossIraDistribution,
    directCharityTransfer: facts.directCharityTransfer,
    federalExcludedAmount: facts.federalExcludedAmount,
    federalTaxableAmount: facts.federalTaxableAmount,
    federalBasisAllocated: facts.federalBasisAllocated,
    residency: facts.residency,
    splitInterest: facts.splitInterest,
    priorAnnualQcdAmountUsed: facts.priorAnnualQcdAmountUsed,
    directTransfer: facts.directCharityTransfer > 0,
  }

  let njPools: StateNjIraOwnerPoolFacts[] | undefined
  if (policy.kind === 'noGeneralFederalExclusion') {
    if (
      facts.december31IraValue !== undefined &&
      facts.allAnnualDistributions !== undefined &&
      (facts.stateBasisFactsKnown || facts.unrecoveredNjTaxedContributions !== undefined)
    ) {
      njPools = [
        {
          ownerPersonId: facts.ownerPersonId,
          december31IraValue: facts.december31IraValue,
          allAnnualDistributions: facts.allAnnualDistributions,
          unrecoveredNjTaxedContributions: facts.stateBasisFactsKnown
            ? { known: true, amount: facts.unrecoveredNjTaxedContributions ?? facts.stateBasisRecovery }
            : { known: false },
          fullLiquidation: facts.fullLiquidation ?? false,
        },
      ]
    } else if (facts.stateBasisFactsKnown) {
      // Characterized worksheet recovery already computed (acceptance bridge):
      // NJ taxable component = federalExcluded − recovery; delta vs federal taxable.
      const njTaxable = Math.max(0, facts.federalExcludedAmount - facts.stateBasisRecovery)
      const delta = njTaxable - Math.max(0, facts.federalTaxableAmount)
      if (facts.splitInterest) {
        return incomplete(
          'state-qcd-split-interest-refused',
          'state-direct-qcd-conformity',
          'Split-interest QCD remains a typed refusal; state policy is not applied.',
          ['supportedDirectQcdTransactionType'],
        )
      }
      if (facts.residency === 'fullYearNonresident') return emptyLeafAdjustment()
      if (facts.residency === 'unknown' || facts.residency === 'partYear') {
        return incomplete(
          'state-qcd-residency-incomplete',
          'state-direct-qcd-conformity',
          'State QCD allocation incomplete without full residency/date facts.',
          ['residency', 'transferDate'],
        )
      }
      return { taxableIncomeDelta: delta, taxCredit: 0, warnings: [] }
    }
  }

  return stateDirectQcdCollectionAdjustment({ events: [event], packPolicy: policy, njPools })
}

/** California HSA Schedule CA additions and line 8f nonqualified subtraction. */
export function californiaHsaAccountAdjustment(facts: StateHsaAccountYearFacts): StateLeafAdjustment {
  const warnings: StateTaxExactnessWarning[] = []
  if (facts.annualActivityComplete !== true) {
    return incomplete('ca-hsa-annual-activity-incomplete', 'ca-hsa-nonconformity', 'California HSA result is incomplete until annual contribution, gain, and distribution activity is explicitly complete.', ['annualActivityComplete'])
  }
  const fields: Array<[KnownMoney, string]> = [
    [facts.federalHsaDeduction, 'federalHsaDeduction'],
    [facts.employerContributionExcludedFederally, 'employerContributionExcludedFederally'],
    [facts.interest, 'interest'],
    [facts.dividends, 'dividends'],
    [facts.nonqualifiedDistributionFederalAmount, 'nonqualifiedDistributionFederalAmount'],
  ]
  let contributionAddback = 0
  let earnings = 0
  let nonqualifiedFederal = 0
  for (const [money, name] of fields) {
    const resolved = requireKnown(money, name)
    if (!resolved.ok) {
      warnings.push(resolved.warning)
      continue
    }
    if (name === 'federalHsaDeduction' || name === 'employerContributionExcludedFederally') {
      contributionAddback += resolved.amount
    } else if (name === 'nonqualifiedDistributionFederalAmount') {
      nonqualifiedFederal = resolved.amount
    } else if (name !== 'unrealizedAppreciation') {
      earnings += resolved.amount
    }
  }
  const caLots = facts.californiaAssetDispositions
  let realizedGain = 0
  if (caLots !== undefined) {
    for (const lot of caLots) {
      if (!Number.isFinite(lot.proceeds) || !Number.isFinite(lot.californiaLotBasis) || lot.proceeds < 0 || lot.californiaLotBasis < 0) {
        warnings.push({ code: 'ca-hsa-lot-invalid', ruleId: 'ca-hsa-nonconformity', message: 'California HSA disposition requires finite nonnegative proceeds and California basis.', missingFacts: ['californiaAssetDispositions'] })
      } else realizedGain += Math.max(0, lot.proceeds - lot.californiaLotBasis)
    }
  } else {
    const gain = requireKnown(facts.realizedGains, 'realizedGains')
    if (!gain.ok) warnings.push(gain.warning)
    else realizedGain = gain.amount
  }
  earnings += realizedGain
  // Unrealized appreciation is tracked only; not current CA income.
  void facts.unrealizedAppreciation
  // Qualified cash withdrawal is federally excluded and is not a CA subtraction
  // from income. Opening basis is ledger state for the integrator; it must not
  // net against contribution/earnings additions or invent negative income.
  void facts.qualifiedCashWithdrawals
  void facts.stateBasisBeforeYear

  if (warnings.length > 0) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings }
  }

  // Schedule CA: add contributions/earnings; subtract federally included
  // nonqualified HSA distribution already in the ordinary-income starting point
  // (line 8f). No Archer-MSA 12.5% penalty path for ordinary HSA withdrawals.
  const delta = contributionAddback + earnings - nonqualifiedFederal
  return { taxableIncomeDelta: delta, taxCredit: 0, warnings: [] }
}

/** @deprecated Prefer californiaHsaAccountAdjustment with KnownMoney rows. */
export function californiaHsaAdjustment(facts: StateHsaYearFacts): StateLeafAdjustment {
  return californiaHsaAccountAdjustment(legacyHsaToAccountFacts(facts))
}

/**
 * New Jersey HSA category treatment under Summer 2010 Tax News + closed GIT
 * categories. Does not invent distribution inclusions from federal Form 1099-SA.
 */
export function newJerseyHsaAccountAdjustment(facts: StateHsaAccountYearFacts): StateLeafAdjustment {
  const warnings: StateTaxExactnessWarning[] = []
  let delta = 0

  const employer = requireKnown(facts.employerContributionExcludedFederally, 'employerContributionExcludedFederally')
  const alreadyInWages = requireKnown(
    facts.employerContributionAlreadyInStateWages,
    'employerContributionAlreadyInStateWages',
  )
  if (!employer.ok) warnings.push(employer.warning)
  if (!alreadyInWages.ok) warnings.push(alreadyInWages.warning)
  if (employer.ok && alreadyInWages.ok) {
    delta += Math.max(0, employer.amount - alreadyInWages.amount)
  }

  // Direct employee contribution: NJ GIT has no IRC 223 deduction. When the
  // engine starts from NJ categories (not federal AGI reduced by the deduction),
  // do not add the federal deduction amount again.
  void facts.federalHsaDeduction

  for (const [money, name] of [
    [facts.interest, 'interest'],
    [facts.dividends, 'dividends'],
  ] as const) {
    const resolved = requireKnown(money, name)
    if (!resolved.ok) warnings.push(resolved.warning)
    else delta += resolved.amount
  }
  void facts.unrealizedAppreciation

  if (facts.njAssetDispositions !== undefined && facts.realizedGains.known) {
    warnings.push({ code: 'nj-hsa-gain-representation-ambiguous', ruleId: 'nj-hsa-nonconformity', message: 'New Jersey HSA uses either aggregate realized gains or state-basis lots, not both.', missingFacts: ['realizedGains', 'njAssetDispositions'] })
  } else if (facts.njAssetDispositions !== undefined) {
    for (const lot of facts.njAssetDispositions) {
      if (!Number.isFinite(lot.proceeds) || !Number.isFinite(lot.njLotBasis) || lot.proceeds < 0 || lot.njLotBasis < 0) {
        warnings.push({
          code: 'nj-hsa-lot-invalid',
          ruleId: 'nj-hsa-nonconformity',
          message: 'New Jersey HSA asset disposition rejected: proceeds and lot basis must be finite and nonnegative.',
          missingFacts: ['njAssetDispositions'],
        })
        continue
      }
      delta += Math.max(0, lot.proceeds - lot.njLotBasis)
    }
  } else {
    const gains = requireKnown(facts.realizedGains, 'realizedGains')
    if (!gains.ok) warnings.push(gains.warning)
    else delta += gains.amount
  }

  // Federally included nonqualified cash distribution is NOT copied into NJ
  // income. Classification unknown ⇒ incomplete only when a federally included
  // amount exists and no category/lot facts explain the income event.
  const nq = facts.nonqualifiedDistributionFederalAmount
  if (isKnownMoney(nq) && nq.amount > 0) {
    const hasLots = (facts.njAssetDispositions?.length ?? 0) > 0
    if (!hasLots) {
      warnings.push({
        code: 'nj-hsa-distribution-category-unknown',
        ruleId: 'nj-hsa-nonconformity',
        message:
          'New Jersey HSA nonqualified distribution exactness incomplete without NJ category/lot facts; federal inclusion is not copied as NJ cash-distribution income.',
        missingFacts: ['njAssetDispositions', 'interest', 'dividends', 'realizedGains'],
      })
    }
  } else if (nq !== undefined && !nq.known) {
    warnings.push({
      code: 'nj-hsa-distribution-category-unknown',
      ruleId: 'nj-hsa-nonconformity',
      message:
        'New Jersey HSA distribution exactness incomplete: federally included distribution amount is unknown.',
      missingFacts: ['nonqualifiedDistributionFederalAmount'],
    })
  }

  // Qualified cash withdrawal is movement of already-tracked cash; no second
  // inclusion and no basis subtraction from an amount absent from NJ income.
  void facts.qualifiedCashWithdrawals
  void facts.stateBasisBeforeYear

  if (facts.annualActivityComplete !== true) {
    warnings.push({ code: 'nj-hsa-annual-activity-incomplete', ruleId: 'nj-hsa-nonconformity', message: 'New Jersey HSA result is incomplete until annual activity is explicitly complete.', missingFacts: ['annualActivityComplete'] })
  }
  if (warnings.length > 0) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings }
  }
  return { taxableIncomeDelta: delta, taxCredit: 0, warnings: [] }
}

/** @deprecated Prefer newJerseyHsaAccountAdjustment with KnownMoney rows. */
export function newJerseyHsaAdjustment(facts: StateHsaYearFacts): StateLeafAdjustment {
  return newJerseyHsaAccountAdjustment(legacyHsaToAccountFacts(facts))
}

export function californiaHsaCollectionAdjustment(
  rows: readonly StateHsaAccountYearFacts[] | undefined,
): StateLeafAdjustment {
  if (rows === undefined) return incomplete('ca-hsa-activity-unavailable', 'ca-hsa-nonconformity', 'California HSA activity is unavailable; explicit empty annual activity is required for an exact result.', ['hsaAccounts'])
  if (rows.length === 0) return emptyLeafAdjustment()
  return mergeLeafAdjustments(rows.map(californiaHsaAccountAdjustment))
}

export function newJerseyHsaCollectionAdjustment(
  rows: readonly StateHsaAccountYearFacts[] | undefined,
): StateLeafAdjustment {
  if (rows === undefined) return incomplete('nj-hsa-activity-unavailable', 'nj-hsa-nonconformity', 'New Jersey HSA activity is unavailable; explicit empty annual activity is required for an exact result.', ['hsaAccounts'])
  if (rows.length === 0) return emptyLeafAdjustment()
  return mergeLeafAdjustments(rows.map(newJerseyHsaAccountAdjustment))
}
