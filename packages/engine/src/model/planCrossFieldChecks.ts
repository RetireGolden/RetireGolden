/**
 * Cross-field Plan validation — the checks that only make sense once every
 * field of a Plan has parsed on its own.
 *
 * Moved verbatim out of the single anonymous `superRefine` body that used to
 * sit on `planSchema` in `plan.ts`. Each concern is now a named, individually
 * testable function, and `runPlanCrossFieldChecks` calls them in exactly the
 * order the inline body added issues. The issue `path`, `code`, `message`, and
 * the SEQUENCE they arrive in are contract: the planner UI reads them to place
 * field-level validation chrome, so a reordering here is a behavior change
 * there.
 *
 * @see DOCS/architecture.md (data model)
 * @see DOCS/standards.md (data model and schema changes)
 */

import type { z } from 'zod'
import { addCalendarMonths } from '../actions/civilDate.js'
import { packForYear } from '../params/index.js'
import {
  ownedNonRothIraAnnualFilingSourceKey,
  planOwnedNonRothIraAnnualFilingSourceIdentifierClaims,
} from './retirementActionAnnualTaxFacts.js'
import {
  duplicateAccountIdentityFacts,
  isLogicalBalanceAccount,
  latestNonQlacQualifiedAnnuityStartAge,
  latestQlacAnnuityStartAge,
  retirementActionPlanReservedIdentifiers,
  type Account,
  type AccountType,
  type Person,
  type PlanDocument,
  type RetirementActionIraClassification,
} from './plan.js'

/** Account types the model refuses to leave without an individual owner. */
const individuallyOwnedAccountTypes = new Set(['traditional', 'roth', 'hsa'])

/**
 * The ordinary rate-bracket percentages the parameter pack publishes for a
 * calendar year, ascending, unioned across the filing-status tables.
 *
 * A fill-to-target conversion aims at the top of a bracket the tax engine will
 * actually apply: `strategies/rothConversion.ts#ceilingFor` looks `targetValue`
 * up in this same table and, finding nothing, returns no ceiling — so the
 * strategy converts nothing at all and says nothing about why (#508). The rates
 * are read from the pack rather than written down here because parameters are
 * data, not code (DOCS/standards.md); the reading is registered as
 * `irc-1-j-2-progressive-ordinary-rate-schedule` — "the 10/12/22/24/32/35/37
 * structure is current law indefinitely" (IRC 1(j)(2)(C); Rev. Proc. 2025-32
 * section 4.01, Table 3). Both status tables carry the same ladder, so the
 * union is the published set whichever status the household files under, and a
 * plan whose filing status changes never invalidates a bracket already chosen.
 */
function publishedBracketRatesPct(year: number): number[] {
  const { brackets } = packForYear(year).pack.federalTax
  const rates = new Set<number>()
  for (const table of [brackets.single, brackets.marriedFilingJointly]) {
    for (const bracket of table) rates.add(bracket.ratePct)
  }
  return [...rates].sort((a, b) => a - b)
}

/**
 * How many IRMAA tiers the pack publishes for a calendar year. A fill-to-target
 * tier is 1-based over that table (`ceilingFor` reads `irmaaTiers[tier - 1]`),
 * and the statute's sliding scale has exactly these steps above the standard
 * premium — "35, 50, 65, 80 or 85 percent", registered as
 * `usc-42-1395r-i-irmaa-applicable-percentage` (42 U.S.C. 1395r(i)(3)).
 */
function publishedIrmaaTierCount(year: number): number {
  return packForYear(year).pack.medicare.irmaaTiers.length
}

/**
 * Derived lookups every cross-field check reads, built once per parse.
 *
 * All of it is pure derivation from the document — no issue is added while it
 * is assembled — which is what lets the inline body’s interleaved
 * "build a map, then use it two checks later" order be hoisted here without
 * moving a single issue.
 */
export interface PlanCrossFieldContext {
  /** Every index in `strategies.retirementActions` that carries each action id. */
  readonly actionIndexesById: ReadonlyMap<string, number[]>
  /** Every household person id. */
  readonly personIds: ReadonlySet<string>
  /** Person ids a non-legacy retirement action names. */
  readonly actionReferencedPersonIds: ReadonlySet<string>
  /** Account ids an action, pension election, or annuity purchase names. */
  readonly actionReferencedAccountIds: ReadonlySet<string>
  /** Every index in `household.people` that carries each person id. */
  readonly personIndexesById: ReadonlyMap<string, number[]>
  /** Every index in `accounts` that carries each account id. */
  readonly accountIndexesById: ReadonlyMap<string, number[]>
  /** Last-row account type per id. */
  readonly accountTypeById: ReadonlyMap<string, AccountType>
  /** Last-row account per id. */
  readonly accountById: ReadonlyMap<string, Account>
  /** Last-row person per id. */
  readonly personById: ReadonlyMap<string, Person>
  /** The document’s own "as of" calendar year, or null when unreadable. */
  readonly planAsOfYear: number | null
}

/** Builds the derived lookups the checks below share. */
export function planCrossFieldContext(plan: PlanDocument): PlanCrossFieldContext {
  const actionIndexesById = new Map<string, number[]>()
  plan.strategies.retirementActions.forEach((action, index) => {
    const indexes = actionIndexesById.get(action.actionId)
    if (indexes === undefined) actionIndexesById.set(action.actionId, [index])
    else indexes.push(index)
  })
  const personIds = new Set(plan.household.people.map((p) => p.id))
  const actionReferencedPersonIds = new Set<string>()
  const actionReferencedAccountIds = new Set<string>()
  plan.strategies.retirementActions.forEach((action) => {
    if (
      action.kind === 'legacyAggregateWithdrawal' ||
      action.kind === 'legacyAggregateRothConversion' ||
      action.kind === 'legacyAggregateQcd'
    ) {
      return
    }
    if (action.kind === 'qcd') {
      actionReferencedPersonIds.add(action.donorPersonId)
      actionReferencedAccountIds.add(action.allocation.sourceAccountId)
      return
    }
    actionReferencedPersonIds.add(action.personId)
    action.allocations.forEach((allocation) => {
      actionReferencedAccountIds.add(allocation.sourceAccountId)
    })
    if (action.kind === 'rothConversion') {
      actionReferencedAccountIds.add(action.destinationRothAccountId)
    }
  })
  // Decision-bearing pension/annuity rows and their referenced accounts get
  // the same ambiguity protection as retirement actions. Otherwise a duplicate
  // source id could silently select whether a persisted decision executes,
  // while a duplicate target id could select where its dollars land.
  plan.accounts.forEach((account) => {
    if (account.type === 'pension') {
      if (account.lumpSumOffer !== undefined || account.lumpSumElection !== undefined) {
        actionReferencedAccountIds.add(account.id)
      }
      if (account.lumpSumElection !== undefined) {
        actionReferencedAccountIds.add(account.lumpSumElection.rolloverAccountId)
      }
    }
    if (account.type === 'annuity' && account.purchase !== undefined) {
      actionReferencedAccountIds.add(account.id)
      actionReferencedAccountIds.add(account.purchase.fundingAccountId)
    }
  })
  const personIndexesById = new Map<string, number[]>()
  plan.household.people.forEach((person, index) => {
    const indexes = personIndexesById.get(person.id)
    if (indexes === undefined) personIndexesById.set(person.id, [index])
    else indexes.push(index)
  })
  const accountIndexesById = new Map<string, number[]>()
  plan.accounts.forEach((account, index) => {
    const indexes = accountIndexesById.get(account.id)
    if (indexes === undefined) accountIndexesById.set(account.id, [index])
    else indexes.push(index)
  })
  const accountTypeById = new Map(plan.accounts.map((a) => [a.id, a.type]))
  const accountById = new Map(plan.accounts.map((account) => [account.id, account]))
  const personById = new Map(plan.household.people.map((p) => [p.id, p]))

  /**
   * The document's own "as of" calendar year, or null when the stamp is not a
   * plain ISO date.
   *
   * A projection always starts in the current calendar year (planner-ui
   * `currentStartYear`), and every save re-stamps `updatedAtIso` from the same
   * clock immediately before this parse runs (`checkPlanForSave`), so at the
   * moment a plan is authored or edited this year IS the projection start.
   * Reading the year from the document rather than the wall clock is what
   * keeps `parsePlan` a pure function of its input: a plan that saved cleanly
   * always reopens cleanly (`loadPlan` parses the STORED stamp), so a
   * year-relative refusal below can never lock the household out of the very
   * plan it is telling them to edit.
   */
  const planAsOfYear = ((): number | null => {
    const stamped = /^(\d{4})-/.exec(plan.updatedAtIso)
    return stamped === null ? null : Number(stamped[1])
  })()
  return {
    actionIndexesById,
    personIds,
    actionReferencedPersonIds,
    actionReferencedAccountIds,
    personIndexesById,
    accountIndexesById,
    accountTypeById,
    accountById,
    personById,
    planAsOfYear,
  }
}

/**
 * Refuses two retirement actions that share an `actionId`.
 *
 * @returns whether any duplicate was reported. A duplicate id makes every
 * id-to-action lookup ambiguous, so the reference pass is skipped when it is
 * true rather than reporting a second, derived complaint about each lookup.
 */
export function checkDuplicateRetirementActionIds(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): boolean {
  const { actionIndexesById } = context
  let hasDuplicateActionIds = false
  for (const [actionId, indexes] of actionIndexesById) {
    if (indexes.length < 2) continue
    hasDuplicateActionIds = true
    indexes.forEach((index) => {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', 'retirementActions', index, 'actionId'],
        message: `duplicate retirement action id "${actionId}"`,
      })
    })
  }
  return hasDuplicateActionIds
}

/** Couples the filing status to the household size it requires. */
export function checkFilingStatusPersonCount(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  if (plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length !== 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['household', 'filingStatus'],
      message: 'marriedFilingJointly requires exactly two people',
    })
  }
}

/**
 * Refuses a duplicate person id, but only when a retirement action names it.
 *
 * @returns whether any ambiguous person id was reported.
 */
export function checkAmbiguousActionPersonIds(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): boolean {
  const { personIndexesById, actionReferencedPersonIds } = context
  let hasAmbiguousActionPersonIds = false
  for (const [personId, indexes] of personIndexesById) {
    if (indexes.length < 2 || !actionReferencedPersonIds.has(personId)) continue
    hasAmbiguousActionPersonIds = true
    indexes.forEach((index) => {
      ctx.addIssue({
        code: 'custom',
        path: ['household', 'people', index, 'id'],
        message: `duplicate person id "${personId}"`,
      })
    })
  }
  return hasAmbiguousActionPersonIds
}

/**
 * Refuses a duplicate account id when an action names it, or when the rows
 * sharing it disagree on the facts that drive a forced distribution.
 *
 * @returns whether any ambiguous account id was reported.
 */
export function checkAmbiguousAccountIds(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): boolean {
  const { accountIndexesById, actionReferencedAccountIds } = context
  let hasAmbiguousAccountIds = false
  for (const [accountId, indexes] of accountIndexesById) {
    if (indexes.length < 2) continue
    const duplicateAccounts = indexes.map((index) => plan.accounts[index]!)
    // Only multiple physical BalanceState rows enter the grouped ledger.
    // Non-balance aliases retain their historical last-row publication
    // semantics unless an explicit action references the ambiguous ID.
    const duplicateBalanceAccounts = duplicateAccounts.filter(isLogicalBalanceAccount)
    const isLegacyCashPropertyPair = duplicateAccounts.length === 2 &&
      duplicateAccounts.filter((account) => account.type === 'cash').length === 1 &&
      duplicateAccounts.filter((account) => account.type === 'property').length === 1
    const hasUnsupportedMixedAccountChannel =
      duplicateBalanceAccounts.length > 0 &&
      duplicateBalanceAccounts.length < duplicateAccounts.length &&
      !isLegacyCashPropertyPair
    const firstForcedDistributionFacts = duplicateBalanceAccounts[0] === undefined
      ? null
      : duplicateAccountIdentityFacts(duplicateBalanceAccounts[0])
    const hasConflictingForcedDistributionFacts =
      hasUnsupportedMixedAccountChannel ||
      (duplicateBalanceAccounts.length > 1 && firstForcedDistributionFacts !== null &&
      duplicateBalanceAccounts.slice(1).some((account) => {
        const facts = duplicateAccountIdentityFacts(account)
        return facts.length !== firstForcedDistributionFacts.length ||
          facts.some((fact, factIndex) => fact !== firstForcedDistributionFacts[factIndex])
      }))
    if (
      !actionReferencedAccountIds.has(accountId) &&
      !hasConflictingForcedDistributionFacts
    ) continue
    hasAmbiguousAccountIds = true
    indexes.forEach((index) => {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', index, 'id'],
        message: `duplicate account id "${accountId}"`,
      })
    })
  }
  return hasAmbiguousAccountIds
}

/**
 * Requires one payee/decedent/type inherited-IRA aggregation pool to agree on
 * its death and beneficiary schedule facts.
 */
export function checkInheritedIraAggregationFacts(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  // The projection aggregates inherited IRAs only within one payee,
  // decedent, and IRA-type pool. Every member of such a pool must therefore
  // describe the same schedule-driving death and beneficiary facts; letting
  // array order select one account's facts would price a different RMD when
  // the accounts disagree. Provenance may differ because two custodians can
  // substantiate the same facts independently.
  const inheritedIraFactsByGroup = new Map<string, Map<string, number[]>>()
  plan.accounts.forEach((account, accountIndex) => {
    if (
      (account.type !== 'traditional' && account.type !== 'roth') ||
      account.kind !== 'ira' ||
      account.inherited?.decedentId === undefined
    ) return
    const payeePersonId = account.ownerPersonId ?? plan.household.people[0]?.id ?? null
    const groupKey = JSON.stringify([
      payeePersonId,
      account.inherited.decedentId,
      account.type,
    ])
    const beneficiary = account.inherited.beneficiary
    const factsKey = JSON.stringify({
      ownerDeathYear: account.inherited.ownerDeathYear,
      decedentHadStartedRmds: account.inherited.decedentHadStartedRmds,
      beneficiary: beneficiary === undefined
        ? null
        : { ...beneficiary, provenance: undefined },
    })
    const facts = inheritedIraFactsByGroup.get(groupKey) ?? new Map<string, number[]>()
    facts.set(factsKey, [...(facts.get(factsKey) ?? []), accountIndex])
    inheritedIraFactsByGroup.set(groupKey, facts)
  })
  for (const facts of inheritedIraFactsByGroup.values()) {
    if (facts.size <= 1) continue
    for (const accountIndexes of facts.values()) {
      for (const accountIndex of accountIndexes) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', accountIndex, 'inherited', 'decedentId'],
          message:
            'inherited IRAs in the same payee/decedent/type aggregation pool must carry consistent death and beneficiary schedule facts',
        })
      }
    }
  }
}

/**
 * Binds each annual filing source record to this Plan: its plan id, a uniquely
 * resolvable owner, the exact current owner-wide IRA pool, one record per owner
 * and tax year, and identifiers that neither repeat nor collide with the Plan’s
 * own identity namespace.
 */
export function checkRetirementActionAnnualTaxFacts(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIndexesById } = context
  const annualTaxFacts = plan.retirementActionAnnualTaxFacts
  if (annualTaxFacts !== undefined) {
    const records = annualTaxFacts.ownedNonRothIraAnnualFilingSourceRecords
    const indexesByKey = new Map<string, number[]>()
    const sourceClaimsByIdentifier = new Map<string, Array<{
      path: PropertyKey[]
    }>>()
    records.forEach((record, index) => {
      const key = ownedNonRothIraAnnualFilingSourceKey(record)
      const keyIndexes = indexesByKey.get(key)
      if (keyIndexes === undefined) indexesByKey.set(key, [index])
      else keyIndexes.push(index)

      const root = ['retirementActionAnnualTaxFacts', 'ownedNonRothIraAnnualFilingSourceRecords', index] as const
      planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(record).forEach((claim) => {
        const path = [...root, ...claim.path]
        const matches = sourceClaimsByIdentifier.get(claim.value)
        if (matches === undefined) {
          sourceClaimsByIdentifier.set(claim.value, [{ path }])
        } else matches.push({ path })
      })
      if (record.planId !== plan.id) {
        ctx.addIssue({
          code: 'custom',
          path: [...root, 'planId'],
          message: 'annual filing source record must bind the containing Plan id',
        })
      }
      const ownerIndexes = personIndexesById.get(record.ownerPersonId)
      if (ownerIndexes?.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: [...root, 'ownerPersonId'],
          message: 'annual filing source owner must resolve uniquely in the Plan',
        })
      }
      const expectedPool = plan.accounts
        .filter((account) =>
          account.type === 'traditional' &&
          account.kind === 'ira' &&
          account.inherited === undefined &&
          account.ownerPersonId === record.ownerPersonId)
        .map((account) => account.id)
        .sort()
      const reviewedPool = [...record.reviewedSourceAccountIds].sort()
      if (
        expectedPool.length === 0 ||
        expectedPool.length !== reviewedPool.length ||
        expectedPool.some((accountId, poolIndex) => accountId !== reviewedPool[poolIndex])
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [...root, 'reviewedSourceAccountIds'],
          message: 'annual filing source must review the exact current owner-wide IRA pool',
        })
      }
    })
    for (const indexes of indexesByKey.values()) {
      if (indexes.length < 2) continue
      indexes.forEach((index) => ctx.addIssue({
        code: 'custom',
        path: ['retirementActionAnnualTaxFacts', 'ownedNonRothIraAnnualFilingSourceRecords', index],
        message: 'duplicate annual filing source Plan, owner, and tax year',
      }))
    }
    const reservedIdentifiers = retirementActionPlanReservedIdentifiers(plan)
    for (const [identifier, claims] of sourceClaimsByIdentifier) {
      if (claims.length < 2 && !reservedIdentifiers.has(identifier)) continue
      claims.forEach((claim) => ctx.addIssue({
        code: 'custom',
        path: claim.path,
        message: reservedIdentifiers.has(identifier)
          ? `annual filing source identifier "${identifier}" collides with the Plan identity namespace`
          : `duplicate annual filing source identifier "${identifier}"`,
      }))
    }
  }
}

/**
 * Keeps retirement-action eligibility evidence unambiguous and grounded: unique
 * evidence ids, one classification per source account resolving to an owned
 * non-inherited traditional IRA, one SEP/SIMPLE activity per source and action
 * tax year backed by exactly one SEP or SIMPLE classification, and one
 * deductible IRA contribution per donor and tax year at or after the donor’s
 * age-70½ threshold year.
 */
export function checkRetirementActionEligibilityFacts(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { accountIndexesById, personIndexesById } = context
  const eligibilityFacts = plan.retirementActionEligibilityFacts
  if (eligibilityFacts !== undefined) {
    type EvidenceRecord = {
      evidenceId: string
      path: ['iraClassifications' | 'sepSimpleActivities' | 'deductibleIraContributions', number]
    }
    const evidenceRecords: EvidenceRecord[] = [
      ...eligibilityFacts.iraClassifications.map((record, index) => ({
        evidenceId: record.evidenceId,
        path: ['iraClassifications' as const, index] as EvidenceRecord['path'],
      })),
      ...eligibilityFacts.sepSimpleActivities.map((record, index) => ({
        evidenceId: record.evidenceId,
        path: ['sepSimpleActivities' as const, index] as EvidenceRecord['path'],
      })),
      ...eligibilityFacts.deductibleIraContributions.map((record, index) => ({
        evidenceId: record.evidenceId,
        path: ['deductibleIraContributions' as const, index] as EvidenceRecord['path'],
      })),
    ]
    const evidenceById = new Map<string, EvidenceRecord[]>()
    evidenceRecords.forEach((record) => {
      const matches = evidenceById.get(record.evidenceId)
      if (matches === undefined) evidenceById.set(record.evidenceId, [record])
      else matches.push(record)
    })
    evidenceById.forEach((records, evidenceId) => {
      if (records.length < 2) return
      records.forEach((record) => {
        ctx.addIssue({
          code: 'custom',
          path: ['retirementActionEligibilityFacts', ...record.path, 'evidenceId'],
          message: `duplicate eligibility evidence id "${evidenceId}"`,
        })
      })
    })

    const classificationsBySource = new Map<
      string,
      { record: RetirementActionIraClassification; index: number }[]
    >()
    eligibilityFacts.iraClassifications.forEach((record, index) => {
      const matches = classificationsBySource.get(record.sourceAccountId)
      if (matches === undefined) {
        classificationsBySource.set(record.sourceAccountId, [{ record, index }])
      } else {
        matches.push({ record, index })
      }
    })
    classificationsBySource.forEach((records, sourceAccountId) => {
      if (records.length < 2) return
      records.forEach(({ index }) => {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'iraClassifications',
            index,
            'sourceAccountId',
          ],
          message: `duplicate IRA classification source "${sourceAccountId}"`,
        })
      })
    })
    eligibilityFacts.iraClassifications.forEach((record, index) => {
      const accountIndexes = accountIndexesById.get(record.sourceAccountId)
      const account =
        accountIndexes?.length === 1 ? plan.accounts[accountIndexes[0]!] : undefined
      if (account === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'iraClassifications',
            index,
            'sourceAccountId',
          ],
          message: `IRA classification source "${record.sourceAccountId}" must resolve uniquely`,
        })
      } else if (
        account.type !== 'traditional' ||
        account.kind !== 'ira' ||
        account.ownerPersonId === null ||
        account.inherited !== undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'iraClassifications',
            index,
            'sourceAccountId',
          ],
          message: 'IRA classification requires an owned non-inherited traditional IRA',
        })
      }
    })

    const activitiesBySourceYear = new Map<string, number[]>()
    eligibilityFacts.sepSimpleActivities.forEach((record, index) => {
      const key = JSON.stringify([record.sourceAccountId, record.actionTaxYear])
      const indexes = activitiesBySourceYear.get(key)
      if (indexes === undefined) activitiesBySourceYear.set(key, [index])
      else indexes.push(index)
    })
    activitiesBySourceYear.forEach((indexes) => {
      if (indexes.length < 2) return
      indexes.forEach((index) => {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'sepSimpleActivities',
            index,
            'sourceAccountId',
          ],
          message: 'duplicate SEP/SIMPLE activity source and action tax year',
        })
      })
    })
    eligibilityFacts.sepSimpleActivities.forEach((record, index) => {
      const classifications = classificationsBySource.get(record.sourceAccountId)
      if (
        classifications?.length !== 1 ||
        classifications[0]!.record.subtype === 'traditional'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'sepSimpleActivities',
            index,
            'sourceAccountId',
          ],
          message: 'SEP/SIMPLE activity requires exactly one SEP or SIMPLE classification',
        })
      }
    })

    const contributionsByDonorYear = new Map<string, number[]>()
    eligibilityFacts.deductibleIraContributions.forEach((record, index) => {
      const key = JSON.stringify([record.donorPersonId, record.taxYear])
      const indexes = contributionsByDonorYear.get(key)
      if (indexes === undefined) contributionsByDonorYear.set(key, [index])
      else indexes.push(index)
    })
    contributionsByDonorYear.forEach((indexes) => {
      if (indexes.length < 2) return
      indexes.forEach((index) => {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'deductibleIraContributions',
            index,
            'donorPersonId',
          ],
          message: 'duplicate deductible IRA contribution donor and tax year',
        })
      })
    })
    eligibilityFacts.deductibleIraContributions.forEach((record, index) => {
      const personIndexes = personIndexesById.get(record.donorPersonId)
      const donor =
        personIndexes?.length === 1
          ? plan.household.people[personIndexes[0]!]
          : undefined
      const thresholdDate = donor === undefined ? null : addCalendarMonths(donor.dob, 846)
      if (donor === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'deductibleIraContributions',
            index,
            'donorPersonId',
          ],
          message: `deductible IRA contribution donor "${record.donorPersonId}" must resolve uniquely`,
        })
      } else if (
        thresholdDate === null ||
        record.taxYear < Number(thresholdDate.slice(0, 4))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'retirementActionEligibilityFacts',
            'deductibleIraContributions',
            index,
            'taxYear',
          ],
          message: 'deductible IRA contribution tax year precedes the donor age-70½ threshold year',
        })
      }
    })
  }
}

/**
 * Resolves every retirement-action reference: known person, known and
 * owner-matching source accounts, a Roth conversion destination that is a Roth
 * account, and a linked tax-funding withdrawal that points back at the
 * conversion.
 *
 * Only meaningful once ids are unambiguous, which is why
 * `runPlanCrossFieldChecks` gates it on the three duplicate-id checks above.
 */
export function checkRetirementActionReferences(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIds, accountById, actionIndexesById } = context
  const validateOwnedAccount = (
    actionIndex: number,
    personId: string,
    accountId: string,
    path: (string | number)[],
  ): void => {
    const account = accountById.get(accountId)
    if (account === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', 'retirementActions', actionIndex, ...path],
        message: `unknown account id "${accountId}"`,
      })
    } else if (account.ownerPersonId !== null && account.ownerPersonId !== personId) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', 'retirementActions', actionIndex, ...path],
        message: `account "${accountId}" is owned by a different person`,
      })
    }
  }

  plan.strategies.retirementActions.forEach((action, actionIndex) => {
    if (
      action.kind === 'legacyAggregateWithdrawal' ||
      action.kind === 'legacyAggregateRothConversion' ||
      action.kind === 'legacyAggregateQcd'
    ) {
      return
    }

    const personId =
      action.kind === 'qcd' ? action.donorPersonId : action.personId
    const personPath = action.kind === 'qcd' ? 'donorPersonId' : 'personId'
    if (!personIds.has(personId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', 'retirementActions', actionIndex, personPath],
        message: `unknown person id "${personId}"`,
      })
    }

    if (action.kind === 'qcd') {
      validateOwnedAccount(
        actionIndex,
        action.donorPersonId,
        action.allocation.sourceAccountId,
        ['allocation', 'sourceAccountId'],
      )
      return
    }

    action.allocations.forEach((allocation, allocationIndex) => {
      validateOwnedAccount(
        actionIndex,
        action.personId,
        allocation.sourceAccountId,
        ['allocations', allocationIndex, 'sourceAccountId'],
      )
    })

    if (action.kind !== 'rothConversion') return
    validateOwnedAccount(
      actionIndex,
      action.personId,
      action.destinationRothAccountId,
      ['destinationRothAccountId'],
    )
    const destination = accountById.get(action.destinationRothAccountId)
    if (destination !== undefined && destination.type !== 'roth') {
      ctx.addIssue({
        code: 'custom',
        path: [
          'strategies',
          'retirementActions',
          actionIndex,
          'destinationRothAccountId',
        ],
        message: `conversion destination "${action.destinationRothAccountId}" must be a Roth account`,
      })
    }

    if (action.taxFunding.kind !== 'linkedWithdrawal') return
    const withdrawalActionId = action.taxFunding.withdrawalActionId
    const linkedIndexes = actionIndexesById.get(withdrawalActionId)
    const withdrawal =
      linkedIndexes?.length === 1
        ? plan.strategies.retirementActions[linkedIndexes[0]!]
        : undefined
    if (
      withdrawal === undefined ||
      withdrawal.kind !== 'ordinaryWithdrawal' ||
      withdrawal.personId !== action.personId ||
      withdrawal.year !== action.year ||
      withdrawal.purpose.kind !== 'taxPayment' ||
      withdrawal.purpose.referenceId !== action.actionId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [
          'strategies',
          'retirementActions',
          actionIndex,
          'taxFunding',
          'withdrawalActionId',
        ],
        message:
          'linked withdrawal must resolve to exactly one same-person/year ordinary withdrawal whose taxPayment purpose references this conversion',
      })
    }
  })
}

/**
 * Every account-level cross-field rule: cliff vesting, individual ownership,
 * Form 8606 basis placement, HSA reimburse-later, depreciation recapture,
 * glidepath ordering, annuity purchase funding and the QLAC / non-QLAC
 * qualified start-age bounds, joint-and-survivor payout, the pension lump-sum
 * offer, election and rollover target, HECM residence, and a charity estate
 * destination.
 */
export function checkAccountCrossFieldRules(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIds, accountTypeById, accountById, personById, planAsOfYear } = context
  plan.accounts.forEach((a, i) => {
    if (a.type === 'equityComp' && a.vestingMode === 'cliff' && a.vestDate === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'vestDate'],
        message: 'cliff-vesting equity compensation requires a vest date',
      })
    }
    if (individuallyOwnedAccountTypes.has(a.type) && a.ownerPersonId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'ownerPersonId'],
        message: `${a.type} accounts must have an individual owner`,
      })
    }
    if (a.ownerPersonId !== null && !personIds.has(a.ownerPersonId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'ownerPersonId'],
        message: `unknown person id "${a.ownerPersonId}"`,
      })
    }
    if (a.type === 'traditional' && a.nondeductibleBasis !== undefined) {
      if (a.kind !== 'ira') {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'nondeductibleBasis'],
          message: 'nondeductible (Form 8606) basis applies to traditional IRAs only',
        })
      } else if (a.inherited !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'nondeductibleBasis'],
          message: 'nondeductible basis is not modeled on inherited IRAs (the beneficiary files a separate Form 8606)',
        })
      }
    }
    if (a.type === 'hsa' && a.reimburseLater === true && a.withdrawalTreatment !== 'capByMedicalExpenses') {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'reimburseLater'],
        message: "reimburse-later accumulation requires the 'capByMedicalExpenses' withdrawal treatment",
      })
    }
    if (a.type === 'property' && a.depreciationRecapture !== undefined && a.costBasis === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'depreciationRecapture'],
        message: 'depreciation recapture requires a cost basis',
      })
    }
    if ('allocation' in a && a.allocation?.mode === 'linear' && a.allocation.endYear <= a.allocation.startYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'allocation', 'endYear'],
        message: 'a linear glidepath must end after it starts',
      })
    }
    if (a.type === 'annuity' && a.purchase) {
      const fundingType = accountTypeById.get(a.purchase.fundingAccountId)
      const fundingAccount = accountById.get(a.purchase.fundingAccountId)
      if (a.purchase.fundingAccountId === a.id || fundingType === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'purchase', 'fundingAccountId'],
          message: 'annuity purchase must be funded from another existing account',
        })
      } else if (
        // Same one-line gap the rollover target carried: an inherited account
        // is `type: 'traditional'`, so the bare type test let a beneficiary
        // fund an owned annuity contract out of an inherited IRA. The premium
        // leaves the balance for an `annuity` account that carries no
        // `inherited` marker, so the 10-year clock on those dollars simply
        // disappears from the projection.
        a.purchase.taxQualification === 'qualified' &&
        (fundingAccount === undefined ||
          fundingAccount.type !== 'traditional' ||
          fundingAccount.inherited !== undefined)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'purchase', 'fundingAccountId'],
          message: 'a qualified annuity purchase must be funded from a traditional account you own (inherited IRA dollars stay in the inherited account)',
        })
      } else if (
        a.purchase.taxQualification === 'nonQualified' &&
        fundingType !== 'cash' &&
        fundingType !== 'taxable' &&
        fundingType !== 'equityComp'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'purchase', 'fundingAccountId'],
          message: 'a non-qualified annuity purchase must be funded from cash, taxable, or equity-comp savings',
        })
      }
      if (a.purchase.qlac && a.purchase.taxQualification !== 'qualified') {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'purchase', 'qlac'],
          message: 'a QLAC must be a qualified (traditional-funded) purchase',
        })
      }
      // HOW LATE A QUALIFIED CONTRACT MAY START PAYING. Two bounds, one per
      // shape, and every qualified purchase is under exactly one of them.
      //
      // Not a QLAC: Treas. Reg. 1.401(a)(9)-6(a)(3)(i) requires payments to
      // commence by the owner's required beginning date, and (q)(1)(iii)
      // excuses only a QLAC. A QLAC: that excuse is granted, but (q)(1)(ii)
      // makes the contract's own specified annuity starting date no later
      // than the first day of the month after the owner's 85th birthday, and
      // a contract naming a later date is not a QLAC and so holds no excuse
      // either.
      //
      // Both matter here rather than only in the ledger because the engine
      // has a single mechanism for every one of these contracts: an annuity
      // account holds no balance, so the premium leaves the traditional
      // balance at purchase and never returns to any required-distribution
      // base. That is exactly the treatment 1.401(a)(9)-5(b)(4) reserves for
      // a QLAC, and on anything else it computes the requirement on a base
      // short by the whole premium. Teaching the base to re-include a
      // contract value would need a contract value the Plan does not carry;
      // refusing the shapes costs only contracts the regulation does not
      // permit anyway. A non-qualified purchase is not reached by section
      // 401(a)(9) at all, and an already-owned annuity with no `purchase`
      // moves no premium out of any balance, so neither is tested.
      if (a.purchase.taxQualification === 'qualified') {
        // Same owner resolution the guaranteed-income pass takes: an annuity
        // may be stored with no individual owner, and the projection reads it
        // as the first person's.
        const owner = personById.get(a.ownerPersonId ?? '') ?? plan.household.people[0]
        const birthYear = owner === undefined ? null : Number(owner.dob.slice(0, 4))
        const birthMonth = owner === undefined ? null : Number(owner.dob.slice(5, 7))
        if (
          birthYear !== null &&
          Number.isFinite(birthYear) &&
          birthMonth !== null &&
          Number.isFinite(birthMonth)
        ) {
          const nonQlacLatest = latestNonQlacQualifiedAnnuityStartAge(birthYear, a.purchase.year)
          const qlacLatest = latestQlacAnnuityStartAge(birthMonth)
          // THE MESSAGE NAMES THE OTHER BOX ONLY WHEN THE OTHER BOX WOULD
          // WORK. Each refusal has two possible remedies — move the start age,
          // or change which bound applies by ticking or unticking QLAC — and
          // the second one is a dead end whenever the other bound refuses the
          // same age too. Telling a household to tick QLAC on a start age of
          // 90 sends them to a second refusal, so the message is derived from
          // which of the two shapes this plan could actually store.
          if (a.purchase.qlac === true) {
            if (a.startAge > qlacLatest) {
              ctx.addIssue({
                code: 'custom',
                path: ['accounts', i, 'startAge'],
                message:
                  a.startAge <= nonQlacLatest
                    ? `a QLAC must commence by the first of the month after the owner's 85th birthday: it must start paying by age ${qlacLatest} (lower "Start age", or untick "QLAC (qualified longevity annuity)" — a qualified purchase that is not a QLAC may start as late as age ${nonQlacLatest} here)`
                    : `a QLAC must commence by the first of the month after the owner's 85th birthday: it must start paying by age ${qlacLatest} (lower "Start age"; unticking "QLAC (qualified longevity annuity)" would not help, because a qualified purchase that is not a QLAC must start paying by age ${nonQlacLatest})`,
              })
            }
          } else if (a.startAge > nonQlacLatest) {
            ctx.addIssue({
              code: 'custom',
              path: ['accounts', i, 'startAge'],
              message:
                a.startAge <= qlacLatest
                  ? `a qualified annuity purchase that is not a QLAC cannot defer past the owner's required beginning date: it must start paying by age ${nonQlacLatest} (lower "Start age", or tick "QLAC (qualified longevity annuity)" — a QLAC may start as late as age ${qlacLatest})`
                  : `a qualified annuity purchase that is not a QLAC cannot defer past the owner's required beginning date: it must start paying by age ${nonQlacLatest} (lower "Start age"; ticking "QLAC (qualified longevity annuity)" would not help, because a QLAC must start paying by age ${qlacLatest})`,
            })
          }
        }
      }
    }
    if (a.type === 'annuity' && a.payoutForm?.kind === 'jointSurvivor' && plan.household.people.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'payoutForm'],
        message: 'a joint-and-survivor annuity requires a two-person household',
      })
    }
    if (a.type === 'pension' && a.lumpSumElection) {
      if (!a.lumpSumOffer) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'lumpSumElection'],
          message: 'a lump-sum election requires a lump-sum offer (amount and election year)',
        })
      } else if (planAsOfYear === null) {
        // Fail closed, not open: the staleness rule reads the document's own
        // stamp, and a stamp the rule cannot read would otherwise let any
        // election year through — including the past-year shape this rule
        // exists to refuse. Every save writes the stamp with toISOString, so
        // a well-formed document never lands here; a hand-crafted or damaged
        // one is repaired at load (the migration drops the election), and a
        // re-save restores the stamp.
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'lumpSumElection'],
          message:
            'an elected pension lump sum requires a readable plan timestamp to check its election year (re-save the plan to restore it)',
        })
      } else if (a.lumpSumOffer.electionYear < planAsOfYear) {
        // An election models a rollover the projection still has to perform:
        // in the election year the offer arrives in the receiving account and
        // the pension stops paying. An election year already past has no such
        // year to land in, and the rest of the product already treats it as
        // nothing to model (`decisions/pensionElection.ts` skips it,
        // `insights/detectors/pensionElectionPending.ts` stays quiet,
        // planner-ui's scenario levers refuse to build one). Only the ledger
        // acted on it, and only destructively: it skips the pension for every
        // `year >= electionYear` while crediting the offer in no year at all.
        //
        // Crediting it in the first projection year instead would double-count
        // it. Account balances are what the household holds TODAY (the
        // accounts editor says so: "Balances as of today"), and the engine
        // already reads every other pre-start event that way — an annuity
        // premium and a TIPS-ladder purchase dated before the start are both
        // "assumed already funded" and never replayed. So the honest answer is
        // to refuse the shape and let the household restate the fact.
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'lumpSumOffer', 'electionYear'],
          message:
            'an elected pension lump sum cannot have an election year in the past (if the rollover already happened, clear the election and add its dollars to the receiving account balance)',
        })
      }
      // Owned traditional only. An inherited account is `type: 'traditional'`
      // too, so a bare type test admitted a target the message itself excludes:
      // an inherited IRA may only ever hold the decedent's dollars, and the
      // beneficiary's own pension money has no way into it. The engine would
      // also drop those owned dollars into the bucket that runs the 10-year
      // rule. `inherited` is the same discriminator the SEPP gate, the
      // conversion source rule, and the IRA-classification rule read.
      const rollover = accountById.get(a.lumpSumElection.rolloverAccountId)
      if (
        rollover === undefined ||
        rollover.type !== 'traditional' ||
        rollover.inherited !== undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'lumpSumElection', 'rolloverAccountId'],
          message: 'a pension lump sum must roll over into an existing traditional account you own (not an inherited IRA)',
        })
      }
    }
    if (a.type === 'property' && a.hecm && a.primaryResidence !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'hecm'],
        message: 'a HECM line of credit requires the home to be a primary residence',
      })
    }
    if (a.estateBeneficiary?.destination === 'charity' && a.estateBeneficiary.charityPct === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', i, 'estateBeneficiary', 'charityPct'],
        message: 'a charity destination requires a charity percent',
      })
    }
  })
}

/** Resolves the person a wage or Social Security income names. */
export function checkIncomePersonReferences(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIds } = context
  plan.incomes.forEach((s, i) => {
    if ((s.type === 'wages' || s.type === 'socialSecurity') && !personIds.has(s.personId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['incomes', i, 'personId'],
        message: `unknown person id "${s.personId}"`,
      })
    }
  })
}

/**
 * Resolves each policy subject and beneficiary, and requires the fields the
 * chosen premium and cash-value modes depend on.
 */
export function checkInsuranceCrossFieldRules(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIds } = context
  plan.insurance.forEach((p, i) => {
    const subject = p.kind === 'ltc' ? p.owner : p.insured
    const subjectField = p.kind === 'ltc' ? 'owner' : 'insured'
    if (!personIds.has(subject)) {
      ctx.addIssue({ code: 'custom', path: ['insurance', i, subjectField], message: `unknown person id "${subject}"` })
    }
    if (p.premiumMode === 'untilAge' && p.premiumEndAge === undefined) {
      ctx.addIssue({ code: 'custom', path: ['insurance', i, 'premiumEndAge'], message: "premiumEndAge is required when premiumMode is 'untilAge'" })
    }
    if (p.kind === 'permanentLife') {
      if (p.beneficiary !== 'estate' && !personIds.has(p.beneficiary)) {
        ctx.addIssue({ code: 'custom', path: ['insurance', i, 'beneficiary'], message: `unknown person id "${p.beneficiary}"` })
      }
      if (p.cashValueMode === 'schedule' && (!p.cashValueSchedule || p.cashValueSchedule.length === 0)) {
        ctx.addIssue({ code: 'custom', path: ['insurance', i, 'cashValueSchedule'], message: "cashValueSchedule is required when cashValueMode is 'schedule'" })
      }
    }
  })
}

/** Resolves the person a care episode names. */
export function checkCareEventPersonReferences(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { personIds } = context
  plan.careEvents.forEach((c, i) => {
    if (!personIds.has(c.personId)) {
      ctx.addIssue({ code: 'custom', path: ['careEvents', i, 'personId'], message: `unknown person id "${c.personId}"` })
    }
  })
}

/**
 * Orders each TIPS ladder against its own payout window and purchase year, and
 * restricts the purchase to a taxable-side funding account.
 */
export function checkIncomeFloorLadders(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
  context: PlanCrossFieldContext = planCrossFieldContext(plan),
): void {
  const { accountTypeById } = context
  plan.incomeFloor?.ladders.forEach((ladder, i) => {
    if (ladder.endYear < ladder.startYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['incomeFloor', 'ladders', i, 'endYear'],
        message: 'a ladder must end in or after its first payout year',
      })
    }
    if (ladder.purchase) {
      if (ladder.purchase.year >= ladder.startYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomeFloor', 'ladders', i, 'purchase', 'year'],
          message: 'a ladder must be purchased before its first payout year',
        })
      }
      const fundingType = accountTypeById.get(ladder.purchase.fundingAccountId)
      if (fundingType === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomeFloor', 'ladders', i, 'purchase', 'fundingAccountId'],
          message: 'a ladder purchase must be funded from an existing account',
        })
      } else if (fundingType !== 'cash' && fundingType !== 'taxable' && fundingType !== 'equityComp') {
        // Taxable-side only in v1: the ladder's tax treatment (state-exempt
        // interest, taxed accretion) models TIPS held in a brokerage. TIPS
        // inside an IRA are just traditional dollars — model those as the
        // account's own balance instead.
        ctx.addIssue({
          code: 'custom',
          path: ['incomeFloor', 'ladders', i, 'purchase', 'fundingAccountId'],
          message: 'a TIPS ladder purchase must be funded from cash, taxable, or equity-comp savings',
        })
      }
    }
  })
}

/** Orders a recurring income stream that carries both of its bounds. */
export function checkRecurringIncomeWindows(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  // A recurring stream that ends before it starts pays nothing and says
  // nothing about why, the same defect the ladder refinement above catches
  // (#524; #495 decision D5). Both bounds are optional — an open-ended stream
  // leaves either or both null — so only a stream with both is compared.
  plan.incomes.forEach((income, i) => {
    if (income.type !== 'recurring') return
    if (income.startYear === null || income.endYear === null) return
    if (income.endYear < income.startYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['incomes', i, 'endYear'],
        message: 'a recurring income must end in or after the year it starts',
      })
    }
  })
}

/**
 * Orders the Roth fill-to-target conversion window, and requires a target value
 * the ceiling can actually be derived from for each target kind.
 */
export function checkRothConversionFillToTarget(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  // The Roth fill-to-target window, on the same rule, plus the target value
  // per target kind (#508; #495 decisions D5 and D6). Each of these is a
  // value `strategies/rothConversion.ts#ceilingFor` cannot turn into a
  // ceiling, so the strategy silently converts nothing today.
  const rothConversion = plan.strategies.rothConversion
  if (rothConversion.mode === 'fillToTarget') {
    if (rothConversion.endYear < rothConversion.startYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', 'rothConversion', 'endYear'],
        message: 'a conversion window must end in or after the year it starts',
      })
    }
    // The window's first year is the tax year the target is read against.
    const taxYear = rothConversion.startYear
    const targetValue = rothConversion.targetValue
    const targetPath = ['strategies', 'rothConversion', 'targetValue']
    if (rothConversion.target === 'topOfBracket') {
      // "Fill to the top of this bracket" needs a bracket ABOVE the chosen
      // one to supply the ceiling, so the highest published rate — the
      // open-ended top bracket, with nothing above it — is not a target the
      // ledger can price. `ceilingFor` says the same in its own terms
      // (`strategies/rothConversion.ts`: "unknown rate or open-ended top
      // bracket"). The top rate is read off the pack's own ascending ladder
      // rather than written down, so a pack whose schedule changes moves this
      // rule with it (Nathan, 2026-09-02, on #495 D6).
      //
      // No year is named in the message: beyond the last published pack
      // `packForYear` stands in with the latest one, so calling these "the
      // 2050 rates" would assert a publication that has not happened (review
      // r1-8). The ladder itself is not indexed — only the bounds are — so
      // the set is the same list whichever year stands in.
      const fillable = publishedBracketRatesPct(taxYear).slice(0, -1)
      if (targetValue === null || !fillable.includes(targetValue)) {
        ctx.addIssue({
          code: 'custom',
          path: targetPath,
          message: `a bracket target must be one of the published rates below the top bracket (${fillable.join(', ')})`,
        })
      }
    } else if (rothConversion.target === 'irmaaTier') {
      const tiers = publishedIrmaaTierCount(taxYear)
      if (targetValue === null || !Number.isInteger(targetValue) || targetValue < 1 || targetValue > tiers) {
        ctx.addIssue({
          code: 'custom',
          path: targetPath,
          message: `an IRMAA tier target must be a whole number from 1 to ${tiers}`,
        })
      }
    } else if (rothConversion.target === 'fixedMagi') {
      // A ceiling of 0 is not a small conversion window, it is no window at
      // all: the metric it caps is a floored MAGI, so nothing can ever fit
      // under it and `ceilingFor` refuses it too (Nathan, 2026-09-02, D6).
      if (targetValue === null || targetValue <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: targetPath,
          message: 'a fixed MAGI target must be above 0',
        })
      }
    }
  }
}

/** Keeps the required spending floor under the target lifestyle. */
export function checkRequiredSpendingFloor(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  // The required floor cannot exceed the target lifestyle it sits under.
  if (plan.expenses.requiredAnnual !== undefined && plan.expenses.requiredAnnual > plan.expenses.baseAnnual) {
    ctx.addIssue({
      code: 'custom',
      path: ['expenses', 'requiredAnnual'],
      message: 'required annual spending cannot exceed baseline (target) annual spending',
    })
  }
}

/**
 * Orders each one-time goal’s earliest/latest window around its goal year, and
 * bounds a partial-funding minimum below 100 percent.
 */
export function checkOneTimeGoalWindows(
  plan: PlanDocument,
  ctx: z.RefinementCtx,
): void {
  plan.expenses.oneTimeGoals.forEach((g, i) => {
    if (g.earliestYear !== undefined && g.latestYear !== undefined && g.earliestYear > g.latestYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', i, 'earliestYear'],
        message: 'earliestYear cannot be after latestYear',
      })
    }
    if (g.earliestYear !== undefined && g.earliestYear > g.year) {
      ctx.addIssue({
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', i, 'earliestYear'],
        message: 'earliestYear cannot be after the goal year',
      })
    }
    if (g.latestYear !== undefined && g.latestYear < g.year) {
      ctx.addIssue({
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', i, 'latestYear'],
        message: 'latestYear cannot be before the goal year',
      })
    }
    if (g.allowPartialFunding && g.minFundingPct !== undefined && g.minFundingPct >= 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', i, 'minFundingPct'],
        message: 'partial funding requires a minimum funding percent below 100',
      })
    }
  })
}

/**
 * Runs every cross-field check in the order the inline `superRefine` body ran
 * them, so the issues a Plan produces stay identical in path, message, and
 * sequence.
 *
 * The one piece of control flow the original body carried is preserved here
 * rather than buried inside a check: the reference pass runs only when no
 * duplicate action, person, or account id made a lookup ambiguous.
 */
export function runPlanCrossFieldChecks(plan: PlanDocument, ctx: z.RefinementCtx): void {
  const context = planCrossFieldContext(plan)
  const hasDuplicateActionIds = checkDuplicateRetirementActionIds(plan, ctx, context)
  checkFilingStatusPersonCount(plan, ctx)
  const hasAmbiguousActionPersonIds = checkAmbiguousActionPersonIds(plan, ctx, context)
  const hasAmbiguousAccountIds = checkAmbiguousAccountIds(plan, ctx, context)
  checkInheritedIraAggregationFacts(plan, ctx)
  checkRetirementActionAnnualTaxFacts(plan, ctx, context)
  checkRetirementActionEligibilityFacts(plan, ctx, context)
  if (
    !hasDuplicateActionIds &&
    !hasAmbiguousActionPersonIds &&
    !hasAmbiguousAccountIds
  ) {
    checkRetirementActionReferences(plan, ctx, context)
  }
  checkAccountCrossFieldRules(plan, ctx, context)
  checkIncomePersonReferences(plan, ctx, context)
  checkInsuranceCrossFieldRules(plan, ctx, context)
  checkCareEventPersonReferences(plan, ctx, context)
  checkIncomeFloorLadders(plan, ctx, context)
  checkRecurringIncomeWindows(plan, ctx)
  checkRothConversionFillToTarget(plan, ctx)
  checkRequiredSpendingFloor(plan, ctx)
  checkOneTimeGoalWindows(plan, ctx)
}
