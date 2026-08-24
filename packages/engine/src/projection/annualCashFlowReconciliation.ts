/**
 * Annual cash-flow reconciliation.
 *
 * Stage 5: the three conservation identities from published lines, plus
 * fail-closed diagnostics for every `YearCashFlowReconciliationReasonCode`.
 * The stage-1–4 scalar→group incomplete-inventory heuristic is retired —
 * a reinvest-only year (empty spendable sources, one `reinvestedYield`
 * transfer) reconciles when the identities close.
 *
 * `finalizeYearCashFlow` is the assemble-time publisher: it applies the
 * zero-line omission rule (owned-IRA RMD zero-net exception), sorts each
 * array lexicographically by id, then runs the checker. Do not probe
 * `incomes.total` or `YearResult.withdrawals.total` 1:1.
 *
 * @see DOCS/features/year-cash-flow.md (Conservation and failure contract)
 */

import { compareCashFlowLineId } from './annualCashFlowIds.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from './moneyTolerance.js'
import type {
  YearCashFlow,
  YearCashFlowCashIdentityTotals,
  YearCashFlowEntityReference,
  YearCashFlowLineId,
  YearCashFlowReconciliation,
  YearCashFlowReconciliationDiagnostic,
  YearCashFlowReconciliationReasonCode,
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTaxCharacter,
  YearCashFlowTransferEndpoint,
  YearCashFlowTransferIdentityTotals,
  YearCashFlowTransferKind,
  YearCashFlowTransferLine,
  YearCashFlowUseIdentityTotals,
  YearCashFlowUseKind,
  YearCashFlowUseLine,
} from './types.js'

export interface MissingRequiredIdentityReport {
  readonly lineIds: readonly YearCashFlowLineId[]
}

export interface ReconcileYearCashFlowInput {
  readonly sourceLines: readonly YearCashFlowSourceLine[]
  readonly useLines: readonly YearCashFlowUseLine[]
  readonly transferLines: readonly YearCashFlowTransferLine[]
  readonly taxCharacterMetadata?: readonly YearCashFlowStandaloneTaxCharacter[]
  /** Strict structural tolerance for line, use, transfer, and lineage checks. */
  readonly tolerancePlanDollars: number
  /**
   * Cash identity tolerance. Capture passes the annual funding solver's
   * inclusive half-cent tolerance; omitted values use that same production
   * default rather than silently restoring the stricter structural threshold.
   */
  readonly cashIdentityTolerancePlanDollars?: number
  /**
   * Nonzero producers assemble omitted rather than synthesizing a grammar
   * identity. Empty `lineIds` is valid when even a partial id is unknown.
   */
  readonly missingRequiredIdentityReports?: readonly MissingRequiredIdentityReport[]
  /**
   * Encoded segments that two distinct Plan producer IDs collide onto.
   * Each becomes a `duplicateLineId` diagnostic naming that segment.
   */
  readonly collidingEncodedProducerSegments?: readonly string[]
}

/** Funded household uses in the cash identity, excluding tax/penalties/contributions/surplus. */
const FUNDED_HOUSEHOLD_USE_KINDS: ReadonlySet<YearCashFlowUseKind> = new Set([
  'requiredLifestyle',
  'targetLifestyle',
  'idealLifestyle',
  'excessLifestyle',
  'oneTimeGoal',
  'debtService',
  'propertyCosts',
  'healthcare',
  'insurancePremium',
  'longTermCare',
])

const TRANSFER_ENDPOINT_KINDS: Readonly<Record<
  YearCashFlowTransferKind,
  { readonly sources: ReadonlySet<string>; readonly destinations: ReadonlySet<string> }
>> = {
  employeeContribution: {
    sources: new Set(['householdCash']),
    destinations: new Set(['account']),
  },
  employerMatch: {
    sources: new Set(['employer']),
    destinations: new Set(['account']),
  },
  annuityPurchase: {
    sources: new Set(['account']),
    destinations: new Set(['annuityContract']),
  },
  tipsLadderPurchase: {
    sources: new Set(['account']),
    destinations: new Set(['tipsLadder']),
  },
  pensionRollover: {
    sources: new Set(['pensionPlan']),
    destinations: new Set(['account']),
  },
  namedRothConversion: {
    sources: new Set(['account']),
    destinations: new Set(['account']),
  },
  aggregateRothConversion: {
    sources: new Set(['account']),
    destinations: new Set(['account']),
  },
  qualifiedCharitableDistribution: {
    sources: new Set(['requiredDistributionPool', 'account']),
    destinations: new Set(['charity']),
  },
  reinvestedYield: {
    sources: new Set(['accountYield']),
    destinations: new Set(['account']),
  },
  surplusInvestment: {
    sources: new Set(['householdCash']),
    destinations: new Set(['account', 'unassignedCash']),
  },
}

type PublishedLine =
  | YearCashFlowSourceLine
  | YearCashFlowUseLine
  | YearCashFlowTransferLine
  | YearCashFlowStandaloneTaxCharacter

function cashIdentity(
  sourceLines: readonly YearCashFlowSourceLine[],
  useLines: readonly YearCashFlowUseLine[],
): YearCashFlowCashIdentityTotals {
  let spendableSourcesPlanDollars = 0
  let portfolioFundingPlanDollars = 0
  let loanProceedsPlanDollars = 0
  for (const line of sourceLines) {
    if (line.role === 'spendableSource') spendableSourcesPlanDollars += line.amountPlanDollars
    else if (line.role === 'portfolioFunding') portfolioFundingPlanDollars += line.amountPlanDollars
    else if (line.role === 'loanProceeds') loanProceedsPlanDollars += line.amountPlanDollars
  }
  let fundedHouseholdUsesPlanDollars = 0
  let settledTaxPlanDollars = 0
  let penaltiesPlanDollars = 0
  let contributionsPlanDollars = 0
  let surplusInvestmentPlanDollars = 0
  for (const line of useLines) {
    if (FUNDED_HOUSEHOLD_USE_KINDS.has(line.kind)) {
      fundedHouseholdUsesPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'settledTax') {
      settledTaxPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'earlyWithdrawalPenalty') {
      penaltiesPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'contribution') {
      contributionsPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'surplusInvestment') {
      surplusInvestmentPlanDollars += line.fundedPlanDollars
    }
  }
  const sourceTotalPlanDollars =
    spendableSourcesPlanDollars + portfolioFundingPlanDollars + loanProceedsPlanDollars
  const destinationTotalPlanDollars =
    fundedHouseholdUsesPlanDollars +
    settledTaxPlanDollars +
    penaltiesPlanDollars +
    contributionsPlanDollars +
    surplusInvestmentPlanDollars
  return {
    spendableSourcesPlanDollars,
    portfolioFundingPlanDollars,
    loanProceedsPlanDollars,
    sourceTotalPlanDollars,
    fundedHouseholdUsesPlanDollars,
    settledTaxPlanDollars,
    penaltiesPlanDollars,
    contributionsPlanDollars,
    surplusInvestmentPlanDollars,
    destinationTotalPlanDollars,
    differencePlanDollars: sourceTotalPlanDollars - destinationTotalPlanDollars,
  }
}

function useIdentity(useLines: readonly YearCashFlowUseLine[]): YearCashFlowUseIdentityTotals {
  let requestedUsesPlanDollars = 0
  let fundedUsesPlanDollars = 0
  let unfundedUsesPlanDollars = 0
  for (const line of useLines) {
    requestedUsesPlanDollars += line.requestedPlanDollars
    fundedUsesPlanDollars += line.fundedPlanDollars
    unfundedUsesPlanDollars += line.unfundedPlanDollars
  }
  const dispositionTotalPlanDollars = fundedUsesPlanDollars + unfundedUsesPlanDollars
  return {
    requestedUsesPlanDollars,
    fundedUsesPlanDollars,
    unfundedUsesPlanDollars,
    dispositionTotalPlanDollars,
    differencePlanDollars: requestedUsesPlanDollars - dispositionTotalPlanDollars,
  }
}

function transferIdentity(transferLines: readonly YearCashFlowTransferLine[]):
  YearCashFlowTransferIdentityTotals {
  let debitsPlanDollars = 0
  let creditsPlanDollars = 0
  for (const line of transferLines) {
    debitsPlanDollars += line.debitPlanDollars
    creditsPlanDollars += line.creditPlanDollars
  }
  return {
    debitsPlanDollars,
    creditsPlanDollars,
    differencePlanDollars: debitsPlanDollars - creditsPlanDollars,
  }
}

function hasEntity(
  identities: readonly YearCashFlowEntityReference[],
  entityKind: YearCashFlowEntityReference['entityKind'],
): boolean {
  return identities.some((identity) => identity.entityKind === entityKind)
}

function endpointKind(endpoint: YearCashFlowTransferEndpoint): string {
  return endpoint.entityKind
}

function isNonFinite(value: number): boolean {
  return !Number.isFinite(value)
}

function characterAmountsInvalid(characters: readonly Readonly<YearCashFlowTaxCharacter>[] | undefined):
  number | undefined {
  if (characters === undefined) return undefined
  for (const character of characters) {
    if (isNonFinite(character.amountPlanDollars)) return character.amountPlanDollars
    if (character.kind !== 'capitalGain' && character.amountPlanDollars < 0) {
      return character.amountPlanDollars
    }
  }
  return undefined
}

function requiredSourceIdentitiesMissing(line: YearCashFlowSourceLine): boolean {
  const ids = line.identities
  switch (line.kind) {
    case 'wages':
    case 'socialSecurity':
      return !hasEntity(ids, 'incomeStream') || !hasEntity(ids, 'person')
    case 'pension':
      return !hasEntity(ids, 'account') || !hasEntity(ids, 'person')
    case 'annuityPayment':
      return (!hasEntity(ids, 'annuityContract') && !hasEntity(ids, 'account')) ||
        !hasEntity(ids, 'person')
    case 'tipsLadderCash':
      return !hasEntity(ids, 'tipsLadder')
    case 'recurringIncome':
    case 'oneTimeIncome':
      return !hasEntity(ids, 'incomeStream')
    case 'taxableAccountYield':
    case 'taxExemptInterest':
      return !hasEntity(ids, 'account')
    case 'propertySaleProceeds':
    case 'legacyPropertySaleDeposit':
    case 'hecmCoordinatedDraw':
    case 'hecmBackstopDraw':
      return !hasEntity(ids, 'propertyAccount')
    case 'requiredMinimumDistribution':
      return !hasEntity(ids, 'requiredDistributionPool') && !hasEntity(ids, 'account')
    case 'seppDistribution':
    case 'inheritedAccountDistribution':
    case 'needBasedPortfolioWithdrawal':
      return !hasEntity(ids, 'account')
    case 'retirementActionWithdrawal':
      return !hasEntity(ids, 'retirementAction') || !hasEntity(ids, 'account')
    case 'lifeInsuranceDeathBenefit':
      return !hasEntity(ids, 'insurancePolicy') || !hasEntity(ids, 'person')
    default:
      return false
  }
}

function requiredUseIdentitiesMissing(line: YearCashFlowUseLine): boolean {
  const isPenalty = line.kind === 'earlyWithdrawalPenalty'
  const hasClass = line.penaltyClass !== undefined
  if (isPenalty !== hasClass) return true
  const ids = line.identities
  switch (line.kind) {
    case 'requiredLifestyle':
    case 'targetLifestyle':
    case 'idealLifestyle':
    case 'excessLifestyle':
    case 'healthcare':
    case 'settledTax':
      return false
    case 'oneTimeGoal':
      return !hasEntity(ids, 'goal')
    case 'debtService':
    case 'contribution':
      return !hasEntity(ids, 'account')
    case 'propertyCosts':
      return !hasEntity(ids, 'propertyAccount')
    case 'insurancePremium':
      return !hasEntity(ids, 'insurancePolicy')
    case 'longTermCare':
      return !hasEntity(ids, 'person')
    case 'earlyWithdrawalPenalty':
      // Household grammar: no source identity, class still required (checked above).
      return false
    case 'surplusInvestment':
      return false
    default:
      return false
  }
}

function requiredTransferIdentitiesMissing(line: YearCashFlowTransferLine): boolean {
  const allowed = TRANSFER_ENDPOINT_KINDS[line.kind]
  if (allowed === undefined) return true
  if (!allowed.sources.has(endpointKind(line.source))) return true
  if (!allowed.destinations.has(endpointKind(line.destination))) return true
  return false
}

function isOwnedIraRmdZeroNetException(
  line: YearCashFlowSourceLine,
  transferLines: readonly YearCashFlowTransferLine[],
): boolean {
  if (line.kind !== 'requiredMinimumDistribution') return false
  if (line.role !== 'portfolioFunding') return false
  if (line.amountPlanDollars !== 0) return false
  if (!hasEntity(line.identities, 'requiredDistributionPool')) return false
  return transferLines.some((transfer) =>
    transfer.lineage?.some((link) =>
      link.relationship === 'divertedBeforeHouseholdCash' && link.lineId === line.id,
    ) === true,
  )
}

function omitZeroSourceLines(
  sourceLines: readonly YearCashFlowSourceLine[],
  transferLines: readonly YearCashFlowTransferLine[],
): YearCashFlowSourceLine[] {
  return sourceLines.filter((line) =>
    line.amountPlanDollars !== 0 || isOwnedIraRmdZeroNetException(line, transferLines),
  )
}

function omitZeroUseLines(useLines: readonly YearCashFlowUseLine[]): YearCashFlowUseLine[] {
  return useLines.filter((line) =>
    line.requestedPlanDollars !== 0 ||
    line.fundedPlanDollars !== 0 ||
    line.unfundedPlanDollars !== 0,
  )
}

function omitZeroTransferLines(
  transferLines: readonly YearCashFlowTransferLine[],
): YearCashFlowTransferLine[] {
  return transferLines.filter((line) =>
    line.debitPlanDollars !== 0 || line.creditPlanDollars !== 0,
  )
}

function omitZeroMetadata(
  metadata: readonly YearCashFlowStandaloneTaxCharacter[],
): YearCashFlowStandaloneTaxCharacter[] {
  return metadata.filter((line) => line.taxCharacter.amountPlanDollars !== 0)
}

function sortByLineId<T extends { readonly id: string }>(lines: readonly T[]): T[] {
  return [...lines].sort((left, right) => compareCashFlowLineId(left.id, right.id))
}

/**
 * Native-precision reconciliation for one assembled year. Empty published
 * arrays yield the 0=0 identities. Physical amounts must be nonnegative;
 * `capitalGain` metadata may be negative and never enters a money total.
 * Cash identity compares with `cashIdentityTolerancePlanDollars`; use,
 * transfer, and lineage checks compare with `tolerancePlanDollars`. Both use
 * `Math.abs(difference) > tolerance` (strict greater than), so the boundary is
 * accepted.
 */
export function reconcileYearCashFlow(input: ReconcileYearCashFlowInput): YearCashFlowReconciliation {
  const sourceLines = input.sourceLines
  const useLines = input.useLines
  const transferLines = input.transferLines
  const taxCharacterMetadata = input.taxCharacterMetadata ?? []
  const { tolerancePlanDollars } = input
  const cashIdentityTolerancePlanDollars =
    input.cashIdentityTolerancePlanDollars ?? ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
  const cash = cashIdentity(sourceLines, useLines)
  const uses = useIdentity(useLines)
  const transfers = transferIdentity(transferLines)

  const reasonCodes: YearCashFlowReconciliationReasonCode[] = []
  const diagnostics: YearCashFlowReconciliationDiagnostic[] = []

  const push = (
    reasonCode: YearCashFlowReconciliationReasonCode,
    diagnostic: Omit<YearCashFlowReconciliationDiagnostic, 'reasonCode'>,
  ): void => {
    if (!reasonCodes.includes(reasonCode)) reasonCodes.push(reasonCode)
    diagnostics.push({ reasonCode, ...diagnostic })
  }

  const publishedById = new Map<YearCashFlowLineId, PublishedLine>()
  const allPublished: PublishedLine[] = [
    ...sourceLines,
    ...useLines,
    ...transferLines,
    ...taxCharacterMetadata,
  ]
  for (const line of allPublished) {
    if (!publishedById.has(line.id)) publishedById.set(line.id, line)
  }

  // 1. invalidAmount
  for (const line of sourceLines) {
    if (isNonFinite(line.amountPlanDollars) || line.amountPlanDollars < 0) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: line.amountPlanDollars })
    }
    const badCharacter = characterAmountsInvalid(line.taxCharacter)
    if (badCharacter !== undefined) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: badCharacter })
    }
  }
  for (const line of useLines) {
    for (const amount of [line.requestedPlanDollars, line.fundedPlanDollars, line.unfundedPlanDollars]) {
      if (isNonFinite(amount) || amount < 0) {
        push('invalidAmount', { lineIds: [line.id], actualPlanDollars: amount })
        break
      }
    }
  }
  for (const line of transferLines) {
    if (isNonFinite(line.debitPlanDollars) || line.debitPlanDollars < 0) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: line.debitPlanDollars })
    } else if (isNonFinite(line.creditPlanDollars) || line.creditPlanDollars < 0) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: line.creditPlanDollars })
    }
    const badCharacter = characterAmountsInvalid(line.taxCharacter)
    if (badCharacter !== undefined) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: badCharacter })
    }
  }
  for (const line of taxCharacterMetadata) {
    const amount = line.taxCharacter.amountPlanDollars
    if (isNonFinite(amount) || (line.taxCharacter.kind !== 'capitalGain' && amount < 0)) {
      push('invalidAmount', { lineIds: [line.id], actualPlanDollars: amount })
    }
  }

  // 2. duplicateLineId
  const idCounts = new Map<YearCashFlowLineId, number>()
  for (const line of allPublished) {
    idCounts.set(line.id, (idCounts.get(line.id) ?? 0) + 1)
  }
  for (const [id, count] of idCounts) {
    if (count > 1) push('duplicateLineId', { lineIds: [id] })
  }
  for (const segment of input.collidingEncodedProducerSegments ?? []) {
    push('duplicateLineId', { lineIds: [segment] })
  }

  // 3. missingRequiredIdentity
  for (const line of sourceLines) {
    if (requiredSourceIdentitiesMissing(line)) {
      push('missingRequiredIdentity', { lineIds: [line.id] })
    }
    if (
      line.role === 'postSolveDeposit' &&
      !Object.prototype.hasOwnProperty.call(line, 'postSolveDestination')
    ) {
      push('missingRequiredIdentity', { lineIds: [line.id] })
    }
  }
  for (const line of useLines) {
    if (requiredUseIdentitiesMissing(line)) {
      push('missingRequiredIdentity', { lineIds: [line.id] })
    }
  }
  for (const line of transferLines) {
    if (requiredTransferIdentitiesMissing(line)) {
      push('missingRequiredIdentity', { lineIds: [line.id] })
    }
  }
  for (const report of input.missingRequiredIdentityReports ?? []) {
    push('missingRequiredIdentity', { lineIds: report.lineIds })
  }

  // 4. unsupportedLedgerTerm — retired as the scalar→group heuristic. A future
  // nonzero property-purchase term would push from assemble; none exists today.

  // 5. invalidLineage
  const lineageTargetAmount = (target: PublishedLine): number | undefined => {
    if ('fundedPlanDollars' in target && 'requestedPlanDollars' in target) {
      return target.fundedPlanDollars
    }
    if ('amountPlanDollars' in target) return target.amountPlanDollars
    if ('debitPlanDollars' in target) return target.debitPlanDollars
    return undefined
  }

  for (const line of transferLines) {
    if (line.lineage === undefined) continue
    for (const link of line.lineage) {
      const target = publishedById.get(link.lineId)
      if (target === undefined) {
        push('invalidLineage', { lineIds: [line.id, link.lineId] })
        continue
      }
      const transferAmount = line.debitPlanDollars
      if (link.relationship === 'sameDollarLaterStage') {
        const targetAmount = lineageTargetAmount(target)
        if (targetAmount === undefined) {
          push('invalidLineage', { lineIds: [line.id, link.lineId] })
          continue
        }
        // Transfer must equal funded exactly, even when the use still has
        // cap-rejected unfunded dollars.
        const difference = transferAmount - targetAmount
        if (Math.abs(difference) > tolerancePlanDollars) {
          push('invalidLineage', {
            lineIds: [line.id, link.lineId],
            expectedPlanDollars: targetAmount,
            actualPlanDollars: transferAmount,
            differencePlanDollars: difference,
          })
        }
      } else if (link.relationship === 'committedCreditBeyondFunding') {
        if (!('unfundedPlanDollars' in target) || !('fundedPlanDollars' in target)) {
          push('invalidLineage', { lineIds: [line.id, link.lineId] })
          continue
        }
        // Residual-attributed unfunded is transfer − funded, not the whole
        // unfunded amount (which also holds statutory-cap rejection).
        const residualAttributed = transferAmount - target.fundedPlanDollars
        if (residualAttributed <= tolerancePlanDollars) {
          push('invalidLineage', {
            lineIds: [line.id, link.lineId],
            expectedPlanDollars: residualAttributed,
            actualPlanDollars: residualAttributed,
            differencePlanDollars: residualAttributed,
          })
        } else if (residualAttributed - target.unfundedPlanDollars > tolerancePlanDollars) {
          push('invalidLineage', {
            lineIds: [line.id, link.lineId],
            expectedPlanDollars: target.unfundedPlanDollars,
            actualPlanDollars: residualAttributed,
            differencePlanDollars: residualAttributed - target.unfundedPlanDollars,
          })
        }
      } else if (link.relationship === 'divertedBeforeHouseholdCash') {
        // Complement pointer: the target must exist (including a zero-net
        // owned-IRA RMD). Amounts are not required to match.
      }
    }
  }
  for (const line of taxCharacterMetadata) {
    if (line.relatedLineId === undefined) continue
    if (!publishedById.has(line.relatedLineId)) {
      push('invalidLineage', { lineIds: [line.id, line.relatedLineId] })
    }
  }

  // 6. cashIdentityMismatch
  if (Math.abs(cash.differencePlanDollars) > cashIdentityTolerancePlanDollars) {
    push('cashIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: cash.destinationTotalPlanDollars,
      actualPlanDollars: cash.sourceTotalPlanDollars,
      differencePlanDollars: cash.differencePlanDollars,
    })
  }

  // 7. useIdentityMismatch — linewise then annual
  for (const line of useLines) {
    const disposition = line.fundedPlanDollars + line.unfundedPlanDollars
    const difference = line.requestedPlanDollars - disposition
    if (Math.abs(difference) > tolerancePlanDollars) {
      push('useIdentityMismatch', {
        lineIds: [line.id],
        expectedPlanDollars: line.requestedPlanDollars,
        actualPlanDollars: disposition,
        differencePlanDollars: difference,
      })
    }
  }
  if (Math.abs(uses.differencePlanDollars) > tolerancePlanDollars) {
    push('useIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: uses.requestedUsesPlanDollars,
      actualPlanDollars: uses.dispositionTotalPlanDollars,
      differencePlanDollars: uses.differencePlanDollars,
    })
  }

  // 8. transferIdentityMismatch — annual then linewise
  if (Math.abs(transfers.differencePlanDollars) > tolerancePlanDollars) {
    push('transferIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: transfers.creditsPlanDollars,
      actualPlanDollars: transfers.debitsPlanDollars,
      differencePlanDollars: transfers.differencePlanDollars,
    })
  }
  for (const line of transferLines) {
    const difference = line.debitPlanDollars - line.creditPlanDollars
    if (Math.abs(difference) > tolerancePlanDollars) {
      push('transferIdentityMismatch', {
        lineIds: [line.id],
        expectedPlanDollars: line.creditPlanDollars,
        actualPlanDollars: line.debitPlanDollars,
        differencePlanDollars: difference,
      })
    }
  }

  return {
    status: reasonCodes.length === 0 ? 'reconciled' : 'notReconciled',
    tolerancePlanDollars,
    cashIdentityTolerancePlanDollars,
    cash,
    uses,
    transfers,
    reasonCodes,
    diagnostics,
  }
}

/**
 * Apply omit-zero (with the owned-IRA RMD zero-net exception), sort each
 * reporting array by UTF-16 code-unit id order, then reconcile. Assemble
 * calls this on every capture-on committed year.
 */
export function finalizeYearCashFlow(input: ReconcileYearCashFlowInput): YearCashFlow {
  const transferLines = sortByLineId(omitZeroTransferLines(input.transferLines))
  const sourceLines = sortByLineId(omitZeroSourceLines(input.sourceLines, transferLines))
  const useLines = sortByLineId(omitZeroUseLines(input.useLines))
  const taxCharacterMetadata = sortByLineId(omitZeroMetadata(input.taxCharacterMetadata ?? []))
  return {
    sourceLines,
    useLines,
    transferLines,
    taxCharacterMetadata,
    reconciliation: reconcileYearCashFlow({
      sourceLines,
      useLines,
      transferLines,
      taxCharacterMetadata,
      tolerancePlanDollars: input.tolerancePlanDollars,
      cashIdentityTolerancePlanDollars: input.cashIdentityTolerancePlanDollars,
      missingRequiredIdentityReports: input.missingRequiredIdentityReports,
      collidingEncodedProducerSegments: input.collidingEncodedProducerSegments,
    }),
  }
}
