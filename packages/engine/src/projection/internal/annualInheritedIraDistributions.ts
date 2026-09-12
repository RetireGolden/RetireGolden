import { parseCivilIsoDate } from '../../actions/civilDate.js'
import type { RmdShortfallReliefElection } from '../../rmd/rmdShortfallExcise.js'
import { coordinateInheritedDeadlineAnnualRuntime } from '../../actions/beneficiaryTraditionalIraAnnualRuntimeCoordinator.js'
/**
 * Plan one year's inherited-account required distributions without mutating
 * simulator state. Classification remains simulation-scoped; this boundary
 * consumes that cache, derives the year's evidence and §4974 obligations, and
 * returns ordered balance writes for the caller to journal and apply.
 */
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import {
  rmdApplicablePlanKey,
  rmdShortfallObligationId,
  type RmdApplicablePlan,
} from '../../rmd/rmdShortfallExcise.js'
import { rmdApplicablePlanForAccount } from '../../rmd/rmdApplicablePlanForAccount.js'
import {
  inheritedForcedAmount,
  inheritedFiveYearFacts,
  inheritedRequirementForYear,
  type InheritedIraRefusalCode,
  type InheritedRegimeClassification,
  type InheritedRegimeResult,
} from '../../strategies/inheritedIra.js'
import { isTreatAsOwnEffective } from '../../strategies/accountEligibility.js'
import { planDollarsMoveNoLedgerCent } from '../../actions/index.js'
import type { InheritedAccountYearEvidence } from '../types.js'

export interface AnnualInheritedIraClassCacheEntry {
  readonly accountId: string
  readonly accountType: 'traditional' | 'roth'
  readonly ownerPersonId: string
  readonly path: 'legacy' | 'classified'
  readonly refusalReason?: string
  /** The discriminated cause for `refusalReason`; the two travel together. */
  readonly refusalCode?: InheritedIraRefusalCode
  /** Primary classifier result (regime or refusal). */
  readonly primary: InheritedRegimeResult
  /** Synthetic S0 for the S2 pre-election window; primary otherwise. */
  readonly schedule?: InheritedRegimeClassification
  readonly isS2: boolean
  readonly treatAsOwnElectionYear?: number
  readonly preHorizonYearOfDeathRmdUnresolved?: boolean
}

export interface AnnualInheritedIraBalanceState {
  readonly account: Readonly<Account>
  readonly balance: number
}

export interface AnnualInheritedIraDistributionOperation {
  readonly balanceIndex: number
  readonly accountId: string
  readonly ownerPersonId: string | null
  readonly sourceBalanceBefore: number
  readonly sourceBalanceAfter: number
  readonly executed: number
}

export interface AnnualInheritedIraRow {
  readonly balanceIndex: number
  readonly accountId: string
  readonly distribution: AnnualInheritedIraDistributionOperation | null
  /**
   * The caller freezes this helper snapshot. Later voluntary amounts are
   * published by replacing the evidence row, never by mutating this object.
   */
  readonly evidence: InheritedAccountYearEvidence
}

/**
 * A pure inherited-Roth characterization observed while planning a required
 * distribution.  The caller commits its matching pool only after the balance
 * debit has passed validation.  This keeps fixed-point/counterfactual work
 * from consuming the live beneficiary/decedent pool.
 */
export interface AnnualInheritedIraRothTaxCharacterOperation {
  readonly accountId: string
  readonly beneficiaryPersonId: string
  readonly decedentId: string | null
  readonly distributionAmount: number
  readonly ordinaryIncome: number
  readonly status: 'characterized' | 'incomplete'
  readonly reason?: string
}

type RmdShortfallObligation = Readonly<{
  obligationId: string
  distributionCalendarYear: number
  taxYear: number
  taxImposedOn: string
  applicablePlan: RmdApplicablePlan
  requirementKind:
    | 'inheritedAnnualLifeExpectancy'
    | 'inheritedYearOfDeath'
    | 'inheritedFinalSweep'
    | 'inheritedPostDeadlineRemainingBenefit'
    | 'inheritedLegacy'
    | 'mixedInheritedRequirements'
  requiredAmount: number
  distributedByDeadline: number
}>

/** Completed legal-year observation, not authorization to replay historical cash. */
export interface CompletedInheritedDeadlineObservation {
  readonly taxYear: number
  readonly openingBenefit: number | 'unknown'
  readonly distributedByDeadline: number | 'unknown'
  readonly legalDistributionDeadline: string
  readonly observedAsOfDate: string
  readonly provenance: { readonly source: string; readonly asOf: string }
  readonly relief?: RmdShortfallReliefElection
}

export interface AnnualInheritedIraDistributionsInput {
  readonly year: number
  readonly completedDeadlineObservations?: ReadonlyMap<string, CompletedInheritedDeadlineObservation>
  readonly startYear: number
  readonly pack: ParameterPack
  readonly primaryPersonId: string
  /** One aggregate live row per compatible logical account ID, in first-ID order. */
  readonly balances: readonly AnnualInheritedIraBalanceState[]
  /** Aggregate prior-Dec-31 balance by logical account ID. */
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly classCache: ReadonlyMap<string, AnnualInheritedIraClassCacheEntry>
  readonly beneficiaryState: (personId: string) => Readonly<{
    alive: boolean
    ageAttained: number
  }>
  /** Annual opening gate may establish owner treatment from observed facts. */
  readonly isTreatAsOwnEffectiveForYear?: (
    account: Readonly<Extract<Account, { type: 'traditional' | 'roth' }>>,
  ) => boolean
  /**
   * Characterizes an inherited-Roth draw against a snapshot of its shared
   * beneficiary/decedent pool.  It must not mutate that pool.
   */
  readonly characterizeInheritedRothDistribution?: (input: Readonly<{
    accountId: string
    beneficiaryPersonId: string
    decedentId: string | null
    distributionCalendarYear: number
    distributionAmount: number
  }>) => Readonly<{
    ordinaryIncome: number
    status: 'characterized' | 'incomplete'
    reason?: string
  }>
}

export interface AnnualInheritedIraDistributionsResult {
  readonly totals: Readonly<{
    inherited: number
    ordinaryIncome: number
    rothForced: number
  }>
  readonly rows: readonly AnnualInheritedIraRow[]
  readonly rothTaxCharacterOperations:
    readonly AnnualInheritedIraRothTaxCharacterOperation[]
  /**
   * The numeric ordinary-income total may include a conservative full-draw
   * estimate when a Roth pool is uncharacterized.  Consumers must carry this
   * status rather than presenting that estimate as an established tax result.
   */
  readonly rothTaxCharacterStatus: 'complete' | 'incomplete'
  readonly rmdShortfallObligations: readonly RmdShortfallObligation[]
  readonly deadlineObservationIssues: readonly { accountId: string; reason: string }[]
  readonly completedDeadlineAssessments: readonly Extract<ReturnType<typeof coordinateInheritedDeadlineAnnualRuntime>, { status: 'coordinated' }>[]
}

export function annualInheritedIraDistributions(
  input: AnnualInheritedIraDistributionsInput,
): AnnualInheritedIraDistributionsResult {
  const deadlineObservationIssues: { accountId: string; reason: string }[] = []
  const completedDeadlineAssessments: Extract<ReturnType<typeof coordinateInheritedDeadlineAnnualRuntime>, { status: 'coordinated' }>[] = []
  const completedDeadlineAccountIds = new Set<string>()
  const logicalIds = new Set<string>()
  for (const state of input.balances) {
    if (logicalIds.has(state.account.id)) {
      throw new Error(
        `annual inherited-IRA input repeated logical account id "${state.account.id}"`,
      )
    }
    logicalIds.add(state.account.id)
    if (!Number.isFinite(state.balance) || state.balance < 0) {
      throw new Error(
        `annual inherited-IRA balance for account id "${state.account.id}" must be finite and nonnegative`,
      )
    }
    const opening = input.startOfYearBalance.get(state.account.id)
    if (opening !== undefined && (!Number.isFinite(opening) || opening < 0)) {
      throw new Error(
        `annual inherited-IRA opening balance for account id "${state.account.id}" must be finite and nonnegative`,
      )
    }
  }

  let inherited = 0
  let ordinaryIncome = 0
  let rothForced = 0
  let rothTaxCharacterStatus: 'complete' | 'incomplete' = 'complete'
  const rows: AnnualInheritedIraRow[] = []
  const rothTaxCharacterOperations: AnnualInheritedIraRothTaxCharacterOperation[] = []

  const addRow = (
    balanceIndex: number,
    state: Readonly<AnnualInheritedIraBalanceState>,
    evidence: InheritedAccountYearEvidence,
    executed: number,
  ): void => {
    let distribution: AnnualInheritedIraDistributionOperation | null = null
    if (executed > 0) {
      const sourceBalanceAfter = state.balance - executed
      distribution = {
        balanceIndex,
        accountId: state.account.id,
        ownerPersonId: state.account.ownerPersonId,
        sourceBalanceBefore: state.balance,
        sourceBalanceAfter,
        executed,
      }
      if (state.account.type === 'roth') {
        rothForced += executed
        const beneficiaryPersonId = state.account.ownerPersonId ?? input.primaryPersonId
        const characterized = input.characterizeInheritedRothDistribution?.({
          accountId: state.account.id,
          beneficiaryPersonId,
          decedentId: state.account.inherited?.decedentId ?? null,
          distributionCalendarYear: input.year,
          distributionAmount: executed,
        })
        if (characterized !== undefined) {
          if (!Number.isFinite(characterized.ordinaryIncome) || characterized.ordinaryIncome < 0) {
            throw new Error(
              `inherited-Roth tax character for account id "${state.account.id}" must return finite nonnegative ordinary income`,
            )
          }
          ordinaryIncome += characterized.ordinaryIncome
          if (characterized.status === 'incomplete') {
            rothTaxCharacterStatus = 'incomplete'
          }
          rothTaxCharacterOperations.push({
            accountId: state.account.id,
            beneficiaryPersonId,
            decedentId: state.account.inherited?.decedentId ?? null,
            distributionAmount: executed,
            ordinaryIncome: characterized.ordinaryIncome,
            status: characterized.status,
            ...(characterized.reason === undefined ? {} : { reason: characterized.reason }),
          })
        }
      } else ordinaryIncome += executed
      inherited += executed
    }
    rows.push({
      balanceIndex,
      accountId: state.account.id,
      distribution,
      evidence,
    })
  }

  for (const [balanceIndex, state] of input.balances.entries()) {
    if (
      state.account.type !== 'traditional' &&
      state.account.type !== 'roth'
    ) continue
    if (state.account.inherited === undefined) continue
    const cache = input.classCache.get(state.account.id)
    if (cache === undefined) continue
    const beneficiaryPersonId =
      state.account.ownerPersonId ?? input.primaryPersonId
    const beneficiaryState = input.beneficiaryState(beneficiaryPersonId)

    if (!beneficiaryState.alive) {
      const primaryClass =
        cache.primary.kind === 'regime' ? cache.primary : undefined
      const successorRefusalReason =
        state.account.inherited.ownerDeathYear < 2020
          ? `${cache.primary.kind === 'refusal' ? cache.primary.reason : 'pre-SECURE inherited regime'}; the modeled beneficiary has died and successor schedules for this pre-SECURE legacy path are out of scope`
          : 'beneficiary death starts the successor 10-year clock (IRC §401(a)(9)(H)(iii); Treas. Reg. §1.401(a)(9)-5(e)(3); matrix X2); successor schedules are out of scope'
      addRow(balanceIndex, state, {
        accountId: state.account.id,
        ownerPersonId: cache.ownerPersonId,
        regime: primaryClass?.regime ?? (cache.primary.kind === 'refusal' ? cache.primary.refusal : 'needs-review'),
        matrixRow: primaryClass?.row ?? (cache.primary.kind === 'refusal' ? cache.primary.row : 'X2'),
        ...(primaryClass !== undefined
          ? { classification: primaryClass.classification }
          : {}),
        refusalReason: successorRefusalReason,
        refusalCode: 'successor-clock-out-of-scope',
        requirementKind: 'none',
        requiredAmount: 0,
        executedRequiredAmount: 0,
        voluntaryAmount: 0,
        disclosures: ['successor-clock-out-of-scope'],
        citations: primaryClass?.citations ??
          (cache.primary.kind === 'refusal'
            ? cache.primary.citations
            : [
                'IRC §401(a)(9)(H)(iii)',
                'Treas. Reg. §1.401(a)(9)-5(e)(3)',
              ]),
      }, 0)
      continue
    }

    if (
      input.isTreatAsOwnEffectiveForYear?.(state.account) ??
      isTreatAsOwnEffective(state.account, input.year)
    ) {
      // A death-year election becomes effective the following year, so its
      // unsatisfied year-of-death RMD stays on the schedule path below.
      const primaryClass =
        cache.primary.kind === 'regime' ? cache.primary : undefined
      const preHorizonLimitation =
        input.year === input.startYear &&
          cache.preHorizonYearOfDeathRmdUnresolved === true
          ? 'pre-horizon-year-of-death-rmd-unresolved' as const
          : undefined
      addRow(balanceIndex, state, {
        accountId: state.account.id,
        ownerPersonId: cache.ownerPersonId,
        regime: 'spouse-treat-as-own-transition',
        matrixRow: 'S2',
        ...(primaryClass !== undefined
          ? { classification: primaryClass.classification }
          : {}),
        requirementKind: 'none',
        requiredAmount: 0,
        executedRequiredAmount: 0,
        voluntaryAmount: 0,
        ...(preHorizonLimitation !== undefined
          ? { limitation: preHorizonLimitation }
          : {}),
        disclosures: primaryClass?.disclosures ?? [],
        citations: primaryClass?.citations ??
          (cache.primary.kind === 'refusal' ? cache.primary.citations : []),
      }, 0)
      continue
    }

    const completed = input.completedDeadlineObservations?.get(state.account.id)
    if (completed !== undefined) {
      completedDeadlineAccountIds.add(state.account.id)
      const deadline = `${input.year}-12-31`
      const valid = completed.taxYear === input.year && completed.legalDistributionDeadline === deadline &&
        parseCivilIsoDate(completed.observedAsOfDate) !== null && completed.observedAsOfDate >= deadline &&
        parseCivilIsoDate(completed.provenance.asOf) !== null && completed.provenance.asOf >= completed.observedAsOfDate &&
        completed.provenance.source.trim().length > 0
      const facts = inheritedFiveYearFacts(state.account.inherited)
      const applicablePlan = rmdApplicablePlanForAccount(state.account, input.primaryPersonId)
      const coordinated = valid && facts !== undefined
        ? coordinateInheritedDeadlineAnnualRuntime({ facts, taxYear: input.year,
            openingBenefit: completed.openingBenefit, distributedByDeadline: completed.distributedByDeadline,
            obligationId: rmdShortfallObligationId(applicablePlan, input.year), applicablePlan, relief: completed.relief })
        : { status: 'refusal' as const, reason: 'completedDeadlineObservationIncomplete' }
      if (coordinated.status === 'coordinated') completedDeadlineAssessments.push(coordinated)
      else deadlineObservationIssues.push({ accountId: state.account.id, reason: coordinated.reason })
      addRow(balanceIndex, state, {
        accountId: state.account.id, ownerPersonId: cache.ownerPersonId,
        regime: 'non-designated-five-year', matrixRow: 'X3',
        requirementKind: 'none', requiredAmount: coordinated.status === 'coordinated' ? coordinated.requiredAmount : 0,
        executedRequiredAmount: 0, voluntaryAmount: 0,
        ...(coordinated.status === 'coordinated' ? {} : { limitation: coordinated.reason }),
        disclosures: ['completed-deadline-observation-no-cash-replay'],
        citations: ['26 CFR 54.4974-1(e)', 'IRC 4974(a), (e)'],
      }, 0)
      continue
    }

    if (cache.primary.kind === 'refusal' && cache.primary.row === 'X3') {
      addRow(balanceIndex, state, {
        accountId: state.account.id, ownerPersonId: cache.ownerPersonId,
        regime: cache.primary.refusal, matrixRow: 'X3', requirementKind: 'none',
        requiredAmount: 0, executedRequiredAmount: 0, voluntaryAmount: 0,
        refusalReason: cache.primary.reason,
        ...(cache.refusalCode === undefined ? {} : { refusalCode: cache.refusalCode }),
        limitation: 'non-designated-schedule-not-established', disclosures: [], citations: cache.primary.citations,
      }, 0)
      continue
    }

    const priorYearEndBalance =
      input.startOfYearBalance.get(state.account.id) ?? 0
    let take: number
    let requirementKind: InheritedAccountYearEvidence['requirementKind']
    let requiredAmount: number
    let divisor: number | undefined
    let divisorArm: string | undefined
    let noticeWaived: boolean | undefined
    let limitation: string | undefined
    let regime: string
    let matrixRow: string
    let classification: 'settled' | 'unsettled' | undefined
    let disclosures: string[]
    let citations: string[]
    let finalDeadlineYear: number | undefined
    const refusalReason = cache.refusalReason
    const refusalCode = cache.refusalCode

    if (cache.path === 'legacy' || cache.schedule === undefined) {
      take = inheritedForcedAmount({
        pack: input.pack,
        year: input.year,
        ownerDeathYear: state.account.inherited.ownerDeathYear,
        decedentHadStartedRmds:
          state.account.inherited.decedentHadStartedRmds,
        balance: state.balance,
        startBalance: priorYearEndBalance,
        beneficiaryAge: beneficiaryState.ageAttained,
      })
      requiredAmount = take
      requirementKind = 'legacy'
      if (cache.primary.kind === 'refusal') {
        regime = cache.primary.refusal
        matrixRow = cache.primary.row
        citations = cache.primary.citations
        disclosures = []
      } else {
        regime = 'needs-review'
        matrixRow = 'X5'
        citations = cache.primary.citations
        disclosures = []
      }
    } else {
      const scheduleClass = cache.schedule
      const inheritedForReq =
        cache.isS2 && state.account.inherited.beneficiary
          ? {
              ...state.account.inherited,
              beneficiary: {
                ...state.account.inherited.beneficiary,
                election: 'none' as const,
              },
            }
          : state.account.inherited
      const req = inheritedRequirementForYear({
        pack: input.pack,
        classification: scheduleClass,
        inherited: inheritedForReq,
        year: input.year,
        priorYearEndBalance,
      })
      requirementKind = req.kind
      requiredAmount = req.requiredAmount
      divisor = req.divisor
      divisorArm = req.divisorArm
      noticeWaived = req.noticeWaived
      limitation = req.limitation
      if (req.kind === 'final-sweep') {
        take = req.noticeWaived === true ? 0 : state.balance
      } else if (req.kind === 'none' || req.noticeWaived === true) {
        take = 0
      } else {
        take = Math.min(req.requiredAmount, state.balance)
      }
      regime = scheduleClass.regime
      matrixRow = scheduleClass.row
      classification = scheduleClass.classification
      disclosures = [...scheduleClass.disclosures]
      citations = [...req.citations]
      finalDeadlineYear = scheduleClass.finalDeadlineYear
    }

    if (
      input.year === input.startYear &&
      cache.preHorizonYearOfDeathRmdUnresolved === true
    ) {
      limitation = 'pre-horizon-year-of-death-rmd-unresolved'
    }

    const executed =
      take > 0 && !planDollarsMoveNoLedgerCent(take) ? take : 0
    addRow(balanceIndex, state, {
      accountId: state.account.id,
      ownerPersonId: cache.ownerPersonId,
      regime,
      matrixRow,
      ...(classification !== undefined ? { classification } : {}),
      ...(refusalReason !== undefined ? { refusalReason } : {}),
      ...(refusalCode !== undefined ? { refusalCode } : {}),
      requirementKind,
      requiredAmount,
      executedRequiredAmount: executed,
      voluntaryAmount: 0,
      ...(divisor !== undefined ? { divisor } : {}),
      ...(divisorArm !== undefined ? { divisorArm } : {}),
      ...(noticeWaived !== undefined ? { noticeWaived } : {}),
      ...(limitation !== undefined ? { limitation } : {}),
      ...(finalDeadlineYear !== undefined ? { finalDeadlineYear } : {}),
      disclosures,
      citations,
    }, executed)
  }

  const requiredByApplicablePlan = new Map<string, number>()
  const distributedByApplicablePlan = new Map<string, number>()
  const requirementKindsByApplicablePlan = new Map<
    string,
    Set<RmdShortfallObligation['requirementKind']>
  >()
  const applicablePlanByKey = new Map<string, RmdApplicablePlan>()
  const deadlineObligations: RmdShortfallObligation[] = completedDeadlineAssessments.map((row) => row.obligation)
  for (const { evidence, balanceIndex } of rows) {
    if (completedDeadlineAccountIds.has(evidence.accountId)) continue
    if (evidence.requiredAmount <= 0 || evidence.noticeWaived === true) continue
    const account = input.balances[balanceIndex]?.account
    if (
      account === undefined ||
      (account.type !== 'traditional' && account.type !== 'roth') ||
      account.inherited === undefined
    ) continue
    const applicablePlan = rmdApplicablePlanForAccount(
      account,
      input.primaryPersonId,
    )
    if (evidence.regime === 'non-designated-five-year') {
      const facts = inheritedFiveYearFacts(account.inherited)
      if (facts !== undefined) {
        const coordinated = coordinateInheritedDeadlineAnnualRuntime({
          facts, taxYear: input.year,
          openingBenefit: input.startOfYearBalance.get(account.id) ?? input.balances[balanceIndex]!.balance,
          distributedByDeadline: evidence.executedRequiredAmount,
          obligationId: rmdShortfallObligationId(applicablePlan, input.year), applicablePlan,
        })
        if (coordinated.status === 'coordinated') deadlineObligations.push(coordinated.obligation)
        else {
          deadlineObservationIssues.push({ accountId: account.id, reason: coordinated.reason })
        }
      } else deadlineObservationIssues.push({ accountId: account.id, reason: 'fiveYearFactsMissing' })
      continue
    }
    const applicablePlanKey = rmdApplicablePlanKey(applicablePlan)
    applicablePlanByKey.set(applicablePlanKey, applicablePlan)
    requiredByApplicablePlan.set(
      applicablePlanKey,
      (requiredByApplicablePlan.get(applicablePlanKey) ?? 0) +
        evidence.requiredAmount,
    )
    distributedByApplicablePlan.set(
      applicablePlanKey,
      (distributedByApplicablePlan.get(applicablePlanKey) ?? 0) +
        evidence.executedRequiredAmount,
    )
    const requirementKind = evidence.requirementKind === 'annual-rmd'
      ? 'inheritedAnnualLifeExpectancy' as const
      : evidence.requirementKind === 'year-of-death-rmd'
        ? 'inheritedYearOfDeath' as const
        : evidence.requirementKind === 'final-sweep'
          ? 'inheritedFinalSweep' as const
          : 'inheritedLegacy' as const
    const kinds = requirementKindsByApplicablePlan.get(applicablePlanKey) ??
      new Set<RmdShortfallObligation['requirementKind']>()
    kinds.add(requirementKind)
    requirementKindsByApplicablePlan.set(applicablePlanKey, kinds)
  }

  const rmdShortfallObligations: RmdShortfallObligation[] = [...deadlineObligations]
  for (const [applicablePlanKey, requiredAmount] of requiredByApplicablePlan) {
    const applicablePlan = applicablePlanByKey.get(applicablePlanKey)!
    const requirementKinds =
      requirementKindsByApplicablePlan.get(applicablePlanKey)!
    const actuallyDistributed =
      distributedByApplicablePlan.get(applicablePlanKey) ?? 0
    rmdShortfallObligations.push({
      obligationId: rmdShortfallObligationId(applicablePlan, input.year),
      distributionCalendarYear: input.year,
      taxYear: input.year,
      taxImposedOn: `${input.year}-12-31`,
      applicablePlan,
      requirementKind: requirementKinds.size === 1
        ? [...requirementKinds][0]!
        : 'mixedInheritedRequirements',
      requiredAmount,
      distributedByDeadline: actuallyDistributed,
    })
  }

  return {
    totals: { inherited, ordinaryIncome, rothForced },
    rows,
    rothTaxCharacterOperations,
    rothTaxCharacterStatus,
    rmdShortfallObligations,
    deadlineObservationIssues,
    completedDeadlineAssessments,
  }
}
