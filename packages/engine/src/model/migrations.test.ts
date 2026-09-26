import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from './plan.js'
import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  applyScenarioPatchDocument,
  createScenarioPatch,
  revertScenarioPatch,
  scenarioPlanSnapshotHash,
} from '../scenarios/patch.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { parseScenarioPatch } from '../scenarios/contract.js'
import {
  migratePlanToCurrent,
  migratePlanV1ToV2,
  migratePlanV2ToV3,
  migratePlanV3ToV4,
  migratePlanV4ToV5,
  type MigrationStep,
} from './migrations.js'

const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
let counter = 0
const testIds = () => `mig-${++counter}`

describe('migratePlanToCurrent', () => {
  it('passes a current-version plan straight through', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toEqual(plan)
      // A document that needed nothing reports nothing, so a host has a plain
      // "was anything changed" test and never a notice over an untouched plan.
      expect(result.repairs).toEqual([])
    }
  })

  it('normalizes existing joint retirement and HSA accounts to the primary person', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const primaryId = plan.household.people[0]!.id
    plan.accounts = [
      { type: 'traditional', id: 'trad', name: '401(k)', ownerPersonId: null, annualReturnPct: null, kind: 'employer', balance: 1, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: null, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: null, annualReturnPct: null, balance: 1, annualContribution: 0 },
      { type: 'taxable', id: 'tax', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    ]

    const result = migratePlanToCurrent(JSON.parse(JSON.stringify(plan)))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.accounts.slice(0, 3).map((a) => a.ownerPersonId)).toEqual([primaryId, primaryId, primaryId])
      expect(result.plan.accounts[3]!.ownerPersonId).toBeNull()
      // One record per back-filled account, in stored order; the taxable account
      // keeps its null owner and so contributes nothing.
      expect(result.repairs).toEqual([
        { kind: 'accountOwnerBackFilled', accountId: 'trad', accountName: '401(k)', ownerPersonId: primaryId },
        { kind: 'accountOwnerBackFilled', accountId: 'roth', accountName: 'Roth IRA', ownerPersonId: primaryId },
        { kind: 'accountOwnerBackFilled', accountId: 'hsa', accountName: 'HSA', ownerPersonId: primaryId },
      ])
    }
  })

  // Shapes a stored document can hold that current validation refuses. Each was
  // saveable under the old rules, so each must come back through the door rather
  // than dying at `invalid_after_migration` — `PlanContext` surfaces only a bare
  // reason code, so a refusal here is a household locked out of the very plan the
  // new message tells them to edit.
  describe('load-time repair of shapes current validation refuses', () => {
    function storedPension(
      offer: { amount: number; electionYear: number } | undefined,
      rolloverAccountId: string | undefined,
      storedAtVersion?: number,
    ): Record<string, unknown> {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 100_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: primaryId, annualReturnPct: null, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
          lumpSumOffer: offer, lumpSumElection: rolloverAccountId === undefined ? undefined : { rolloverAccountId } },
      ]
      const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
      if (storedAtVersion !== undefined) raw['schemaVersion'] = storedAtVersion
      return raw
    }

    it('carries a legacy stale election back as an undecided offer, not a refusal', () => {
      // Stamped 2026 (fixedNow), elected for 2025: saveable before this rule
      // existed, and refused by `parsePlan` now.
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2025 }, 'ira'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      expect(pension.type).toBe('pension')
      if (pension.type !== 'pension') return
      // The election goes; the offer stays, so the decision record survives and
      // the household can re-elect it against a year that has not passed.
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2025 })
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedElectionYearPassed',
          accountId: 'pen',
          accountName: 'Pension',
          electionYear: 2025,
        },
      ])
    })

    it('repairs a legacy stale election stored at an older schema version too', () => {
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2025 }, 'ira', 3))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(result.repairs.map((r) => r.kind)).toEqual(['lumpSumElectionDroppedElectionYearPassed'])
    })

    it('sheds an election whose rollover target id is duplicated, instead of locking out', () => {
      // parsePlan refuses a duplicated account id once a rollover election
      // references it, so a repair that preserved the election would trade one
      // lockout for another. A duplicated id is not a uniquely resolving owned
      // account, and the repair treats it exactly like a missing one.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'ira')
      const accounts = raw['accounts'] as Record<string, unknown>[]
      const owned = accounts.find((a) => a['id'] === 'ira')!
      accounts.push({ ...owned, name: 'Duplicate IRA' })
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      // A duplicated id is neither inherited nor resolvable, so it reports as
      // unavailable and carries the name of the first record holding that id.
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedTargetUnavailable',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'ira',
          targetAccountName: 'IRA',
        },
      ])
    })

    it('reports a rollover target that is not in the plan at all as unavailable', () => {
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'gone')
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedTargetUnavailable',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'gone',
          // Nothing to name, and the record says so rather than inventing one.
          targetAccountName: null,
        },
      ])
    })

    it('sheds the election when the stored stamp is unreadable, instead of refusing the load', () => {
      // The staleness rule fails closed at parse when the stamp is not ISO, so
      // a stored document with a damaged or hand-crafted stamp must lose the
      // election here or it could not load at all. Re-saving restores the
      // stamp, and the offer survives for re-electing.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'ira')
      raw['updatedAtIso'] = 'not-a-timestamp'
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      expect(result.repairs).toEqual([
        { kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen', accountName: 'Pension' },
      ])
    })

    it('reports the unreadable stamp, not the target, when both would refuse the election', () => {
      // A re-save is what makes the election year judgeable again, so the fault
      // that has to be fixed first is the one reported.
      const raw = storedPension({ amount: 400_000, electionYear: 2030 }, 'inh')
      raw['updatedAtIso'] = 'not-a-timestamp'
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs.map((r) => r.kind)).toEqual(['lumpSumElectionDroppedUnreadableSaveDate'])
    })

    it('carries a legacy inherited-IRA rollover target back the same way', () => {
      // A future election year, so only the target is at fault.
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2030 }, 'inh'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toBeUndefined()
      expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2030 })
      expect(result.repairs).toEqual([
        {
          kind: 'lumpSumElectionDroppedInheritedTarget',
          accountId: 'pen',
          accountName: 'Pension',
          targetAccountId: 'inh',
          targetAccountName: 'Inherited',
        },
      ])
    })

    it('leaves a valid election untouched', () => {
      const result = migratePlanToCurrent(storedPension({ amount: 400_000, electionYear: 2030 }, 'ira'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const pension = result.plan.accounts.find((a) => a.id === 'pen')!
      if (pension.type !== 'pension') throw new Error('expected the pension back')
      expect(pension.lumpSumElection).toEqual({ rolloverAccountId: 'ira' })
      expect(result.repairs).toEqual([])
    })

    function storedAnnuity(fundingAccountId: string, ownedTraditional: boolean): Record<string, unknown> {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        ...(ownedTraditional
          ? [{ type: 'traditional' as const, id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira' as const, balance: 400_000, annualContribution: 0 }]
          : []),
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: primaryId, annualReturnPct: null, startAge: 70, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: { year: 2030, premium: 100_000, fundingAccountId, taxQualification: 'qualified' } },
      ] as never
      return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    }

    it('retargets a legacy inherited-funded qualified annuity to an owned traditional account', () => {
      // This purchase already MOVED money in every stored projection, so dropping
      // it would hand the household a contract nobody paid for. The premium keeps
      // its year, size, and pre-tax character; only the bucket it leaves changes.
      const result = migratePlanToCurrent(storedAnnuity('inh', true))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase?.fundingAccountId).toBe('ira')
      expect(annuity.purchase?.premium).toBe(100_000)
      expect(annuity.monthlyAmount).toBe(1_000)
      // This repair never shows up in the projection's shape, only in which
      // balance the premium leaves, so the record carries both account names.
      expect(result.repairs).toEqual([
        {
          kind: 'annuityPremiumRetargeted',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
          toAccountId: 'ira',
          toAccountName: 'IRA',
        },
      ])
    })

    it('stands down a legacy inherited-funded annuity when no owned traditional account exists', () => {
      // No source could have paid the premium, so the contract does not pay
      // either. Standing it down is the only repair that is not richer than the
      // stored facts support.
      const result = migratePlanToCurrent(storedAnnuity('inh', false))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase).toBeUndefined()
      expect(annuity.monthlyAmount).toBe(0)
      expect(result.repairs).toEqual([
        {
          kind: 'annuityPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
        },
      ])
    })

    /**
     * A stored qualified purchase that defers past the owner's required
     * beginning date. `startAge` is well past anything the owner may defer to,
     * and `qlac` is absent, which is the shape parse now refuses.
     */
    function storedDeferredAnnuity(
      overrides: {
        fundingAccountId?: string
        ownedTraditional?: boolean
        qlac?: boolean
        startAge?: number
        dob?: string
        purchaseYear?: number
      } = {},
    ): Record<string, unknown> {
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.household.people[0]!.dob = overrides.dob ?? '1950-01-01'
      plan.accounts = [
        ...(overrides.ownedTraditional === false
          ? []
          : [{ type: 'traditional' as const, id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira' as const, balance: 400_000, annualContribution: 0 }]),
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'annuity', id: 'ann', name: 'Longevity annuity', ownerPersonId: primaryId, annualReturnPct: null, startAge: overrides.startAge ?? 85, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: {
            year: overrides.purchaseYear ?? 2026,
            premium: 100_000,
            fundingAccountId: overrides.fundingAccountId ?? 'ira',
            taxQualification: 'qualified',
            ...(overrides.qlac === true ? { qlac: true } : {}),
          } },
      ] as never
      return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    }

    it('stands down a stored qualified purchase that defers past the required beginning date', () => {
      // Only a QLAC may commence after the required beginning date, and this
      // purchase is not one. The two alternatives are both richer than the
      // stored facts support: marking it a QLAC confers the exclusion the
      // household never chose, and advancing the start age pays a monthly
      // amount quoted for a deferred start across years nobody bought. Standing
      // the purchase down leaves the premium in the IRA and the contract silent,
      // which is the strictly poorer direction, and the account stays in the
      // plan so the household can re-author it either way.
      const result = migratePlanToCurrent(storedDeferredAnnuity())
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase).toBeUndefined()
      expect(annuity.monthlyAmount).toBe(0)
      // The start age survives the repair: it is the fact the household has to
      // change, so erasing it would hide what the message is telling them.
      expect(annuity.startAge).toBe(85)
      expect(result.repairs).toEqual([
        {
          kind: 'deferredAnnuityPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'Longevity annuity',
          startAge: 85,
          latestPermittedStartAge: 76,
          // What a QLAC would have allowed. Carried so the repair notice can
          // tell whether re-authoring the contract with the box ticked is a
          // remedy or a second refusal; here 85 is exactly reachable, so it is
          // a remedy and the notice offers it.
          latestPermittedStartAgeIfToggled: 85,
        },
      ])
    })

    it('carries the other shape’s ceiling so the notice can tell if it would help', () => {
      // A start age of 90 fails the required-beginning-date bound AND the QLAC
      // bound, so "buy it as a QLAC" is not a remedy at all. The repair says so
      // by carrying both numbers rather than leaving the copy to assume the
      // QLAC box is always the generous one.
      const result = migratePlanToCurrent(storedDeferredAnnuity({ startAge: 90 }))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual([
        {
          kind: 'deferredAnnuityPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'Longevity annuity',
          startAge: 90,
          latestPermittedStartAge: 76,
          latestPermittedStartAgeIfToggled: 85,
        },
      ])
    })

    it('stands down a deferred purchase that is also funded from an inherited account', () => {
      // Tested because the two annuity repairs are exclusive and their order
      // decides whether the document opens at all. Retargeting the premium
      // first would leave the start age refused and the plan would die at the
      // parse — the one outcome this seam exists to prevent — so the deferral
      // is tested first and the stand-down cures the funding fault with it.
      const result = migratePlanToCurrent(storedDeferredAnnuity({ fundingAccountId: 'inh' }))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs.map((r) => r.kind)).toEqual(['deferredAnnuityPurchaseStoodDown'])
    })

    it('leaves a stored QLAC with the same deferred start untouched', () => {
      const result = migratePlanToCurrent(storedDeferredAnnuity({ qlac: true }))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase?.premium).toBe(100_000)
      expect(annuity.monthlyAmount).toBe(1_000)
      expect(result.repairs).toEqual([])
    })

    it('stands down a stored QLAC that commences after the owner’s 85th birthday', () => {
      // Treas. Reg. 1.401(a)(9)-6(q)(1)(ii): a contract naming a later starting
      // date is not a QLAC, so it holds neither (q)(1)(iii)'s excuse from the
      // required beginning date nor 1.401(a)(9)-5(b)(4)'s exclusion from the
      // required-distribution base — and the engine's one mechanism would hand
      // it both. The alternatives are the mirror of the ones next door and are
      // refused for the same reason: unticking the box lifts the premium cap the
      // household's own election put the contract under and lands it on a lower
      // ceiling still, and advancing the start age pays a monthly amount quoted
      // for a deferral nobody would have priced this way.
      const result = migratePlanToCurrent(storedDeferredAnnuity({ qlac: true, startAge: 90 }))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase).toBeUndefined()
      expect(annuity.monthlyAmount).toBe(0)
      expect(annuity.startAge).toBe(90)
      expect(result.repairs).toEqual([
        {
          kind: 'qlacPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'Longevity annuity',
          startAge: 90,
          latestPermittedStartAge: 85,
          // This owner bought at 76, so dropping the QLAC election would land
          // the contract on a ceiling of 76 — lower still, and not a remedy.
          latestPermittedStartAgeIfToggled: 76,
        },
      ])
    })

    it('reports the higher ordinary ceiling for a household that annuitized late', () => {
      // The required-beginning-date bound is the later of the applicable RMD age
      // plus one and the owner's age in the purchase year, so an owner buying at
      // 90 may hold a contract starting at 90 without the QLAC election. Here it
      // is the BOX that refused them, and the repair carries the number that
      // says so rather than leaving the notice to assume otherwise.
      const result = migratePlanToCurrent(
        storedDeferredAnnuity({ qlac: true, startAge: 90, dob: '1936-01-01' }),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual([
        {
          kind: 'qlacPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'Longevity annuity',
          startAge: 90,
          latestPermittedStartAge: 85,
          latestPermittedStartAgeIfToggled: 90,
        },
      ])
    })

    /**
     * The two limits this repair straddles, and why only one of them is capped.
     *
     * `latestPermittedStartAge` is regulatory: it says what section 401(a)(9)
     * lets this contract do, and it is what decides whether the stand-down fires
     * at all. `latestPermittedStartAgeIfToggled` is the basis of a SUGGESTION —
     * "you could re-author it the other way" — so it has to name a start age the
     * plan can actually store, which is a narrower question. The
     * required-beginning-date ceiling is the later of the applicable RMD age
     * plus one and the owner's age in the purchase year, so for a late
     * annuitizer it runs past `ANNUITY_MAX_START_AGE` and the two part company.
     */
    it('never suggests a start age past what the plan can store', () => {
      // Born 1930, buying in 2026 at 96: the ordinary ceiling computes to 96,
      // one past the schema's maximum. The QLAC at 90 is stood down, and the
      // notice must offer 95 rather than a 96 the editor would refuse.
      const result = migratePlanToCurrent(
        storedDeferredAnnuity({ qlac: true, startAge: 90, dob: '1930-01-01' }),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.repairs).toEqual([
        {
          kind: 'qlacPurchaseStoodDown',
          accountId: 'ann',
          accountName: 'Longevity annuity',
          startAge: 90,
          latestPermittedStartAge: 85,
          latestPermittedStartAgeIfToggled: 95,
        },
      ])
      // And the repaired document opens, which is the point of the seam.
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase).toBeUndefined()
    })

    it('refuses a start age past the schema maximum rather than gutting the purchase', () => {
      // The trigger is NOT capped, and this is the document that shows why. A
      // start age of 96 against a regulatory ceiling of 98 (born 1930, buying in
      // 2028 at 98) is a lawful contract that this program declines to project —
      // a range limit, not a tax fault. Capping the trigger would fire the
      // stand-down on it and destroy a purchase for a reason that has nothing to
      // do with section 401(a)(9).
      //
      // And it would not buy the parse either: the stand-down keeps `startAge`
      // by design, so the document still fails the schema's own maximum. The
      // refusal below names the field that is out of range, which is strictly
      // more use to the household than the same refusal with their purchase
      // silently removed.
      const result = migratePlanToCurrent(
        storedDeferredAnnuity({ startAge: 96, dob: '1930-01-01', purchaseYear: 2028 }),
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect((result.issues ?? []).join('; ')).toContain('startAge')
      expect((result.issues ?? []).join('; ')).toContain('95')
    })

    it('refuses a QLAC past the schema maximum for the same reason', () => {
      // The repair DOES fire here (97 is past the QLAC ceiling of 85), and the
      // document is still refused, because standing the purchase down never
      // moves the start age. Pinned so nobody reads the fired repair as evidence
      // that the load seam can rescue an out-of-range start age.
      const result = migratePlanToCurrent(
        storedDeferredAnnuity({ qlac: true, startAge: 97, dob: '1930-01-01', purchaseYear: 2028 }),
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect((result.issues ?? []).join('; ')).toContain('95')
    })

    it('keeps the extra year a December-born owner’s deadline actually gives them', () => {
      // The deadline is the first day of the month next following the 85th
      // anniversary, which for a December birthday is January 1 of the next
      // calendar year — exactly where the projection commences a start age of
      // 86. Standing that contract down would take a year of payments the
      // household lawfully holds, which the load seam has no warrant to do.
      const kept = migratePlanToCurrent(storedDeferredAnnuity({ qlac: true, startAge: 86, dob: '1950-12-01' }))
      expect(kept.ok).toBe(true)
      if (!kept.ok) return
      expect(kept.repairs).toEqual([])
      // One day earlier in the calendar and the deadline falls a year sooner.
      const stoodDown = migratePlanToCurrent(storedDeferredAnnuity({ qlac: true, startAge: 86, dob: '1950-11-30' }))
      expect(stoodDown.ok).toBe(true)
      if (!stoodDown.ok) return
      expect(stoodDown.repairs.map((r) => r.kind)).toEqual(['qlacPurchaseStoodDown'])
    })

    it('leaves an owned-traditional-funded qualified annuity untouched', () => {
      const result = migratePlanToCurrent(storedAnnuity('ira', true))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const annuity = result.plan.accounts.find((a) => a.id === 'ann')!
      if (annuity.type !== 'annuity') throw new Error('expected the annuity back')
      expect(annuity.purchase?.fundingAccountId).toBe('ira')
      expect(result.repairs).toEqual([])
    })

    it('reports every repaired account in stored order, and reports it the same way twice', () => {
      // One document, three different repairs. The list a host renders must be
      // a function of the document alone: same input, same records, same order.
      const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
      const primaryId = plan.household.people[0]!.id
      plan.accounts = [
        { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
        { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: primaryId, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
          inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
        { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: null, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
        { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: primaryId, annualReturnPct: null, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
          lumpSumOffer: { amount: 400_000, electionYear: 2025 }, lumpSumElection: { rolloverAccountId: 'ira' } },
        { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: primaryId, annualReturnPct: null, startAge: 70, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: { year: 2030, premium: 100_000, fundingAccountId: 'inh', taxQualification: 'qualified' } },
      ] as never
      const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>

      const expected = [
        { kind: 'accountOwnerBackFilled', accountId: 'roth', accountName: 'Roth IRA', ownerPersonId: primaryId },
        { kind: 'lumpSumElectionDroppedElectionYearPassed', accountId: 'pen', accountName: 'Pension', electionYear: 2025 },
        {
          kind: 'annuityPremiumRetargeted',
          accountId: 'ann',
          accountName: 'SPIA',
          fromAccountId: 'inh',
          fromAccountName: 'Inherited',
          toAccountId: 'ira',
          toAccountName: 'IRA',
        },
      ]
      const first = migratePlanToCurrent(JSON.parse(JSON.stringify(raw)))
      const second = migratePlanToCurrent(JSON.parse(JSON.stringify(raw)))
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      if (!first.ok || !second.ok) return
      expect(first.repairs).toEqual(expected)
      expect(second.repairs).toEqual(first.repairs)
    })
  })

  it('rejects non-objects and bad versions', () => {
    expect(migratePlanToCurrent(null)).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent([])).toEqual({ ok: false, reason: 'not_object' })
    expect(migratePlanToCurrent({})).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 0 })).toEqual({ ok: false, reason: 'bad_version' })
    expect(migratePlanToCurrent({ schemaVersion: 1.5 })).toEqual({ ok: false, reason: 'bad_version' })
  })

  it('refuses plans from a newer app build', () => {
    const result = migratePlanToCurrent({ schemaVersion: 99 })
    expect(result).toEqual({ ok: false, reason: 'newer_than_app' })
  })

  it('fails when a migration step is missing', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = { ...JSON.parse(JSON.stringify(plan)), schemaVersion: 1 }
    // Pretend current is 2 with an empty registry.
    const result = migratePlanToCurrent(old, {}, 2)
    expect(result).toEqual({ ok: false, reason: 'missing_step' })
  })

  it('applies registered steps in order and re-validates', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const old = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    // Simulate a v0 plan whose name lived under a different key.
    delete old['name']
    old['title'] = 'Renamed plan'
    old['schemaVersion'] = 1

    // Hypothetical transitions prove every registered step runs in order and
    // final output is re-validated against the actual current Plan schema.
    const step1to2: MigrationStep = (raw) => {
      const { title, ...rest } = raw
      return { ...rest, name: title }
    }
    const step2to3: MigrationStep = (raw) => ({
      ...raw,
      name: `${String(raw['name'])} plan`,
    })
    const step3to4: MigrationStep = (raw) => raw
    const step4to5: MigrationStep = (raw) => raw
    const result = migratePlanToCurrent(
      old,
      { 1: step1to2, 2: step2to3, 3: step3to4, 4: step4to5 },
      5,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.name).toBe('Renamed plan plan')
  })

  it('reports validation issues for corrupt current-version data', () => {
    const result = migratePlanToCurrent({ schemaVersion: 4, id: '', name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_after_migration')
      expect(result.issues).toBeDefined()
    }
  })
})

describe('load-time repair: rows stored under one id where the projection keeps one value per id (D-CASH-PROPERTY-ALIAS)', () => {
  /**
   * A plan with no growth, no inflation, no spending and no income, so a
   * projection year publishes exactly the entered amounts. The rows are the
   * ones each test sets.
   */
  function quietPlan(accounts: Plan['accounts'], insurance: Plan['insurance'] = []): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.incomes = []
    plan.accounts = accounts
    plan.insurance = insurance
    return plan
  }
  const owner = (): string => createEmptyPlan({ newId: testIds, now: fixedNow }).household.people[0]!.id
  const home = (id = 'home', value = 300_000, name = 'Home'): Plan['accounts'][number] =>
    ({ type: 'property', id, name, ownerPersonId: null, annualReturnPct: 0, value, plannedSaleYear: null, expectedNetProceeds: null })
  const checking = (id = 'home', balance = 10_000): Plan['accounts'][number] =>
    ({ type: 'cash', id, name: 'Checking', ownerPersonId: null, annualReturnPct: 0, balance, annualContribution: 0 })
  const mortgage = (id = 'home', balance = 100_000): Plan['accounts'][number] =>
    ({ type: 'debt', id, name: 'Mortgage', ownerPersonId: null, annualReturnPct: 0, balance, interestPct: 0, monthlyPayment: 0 })
  const lifePolicy = (id: string, insured: string, cashValue = 50_000, name = 'Whole life'): Plan['insurance'][number] => ({
    kind: 'permanentLife', id, name, insured, beneficiary: 'estate', annualPremium: 0, premiumMode: 'paidUp',
    deathBenefit: 0, cashValue, cashValueMode: 'flatRate', cashValueGrowthPct: 0,
  })
  const ltcPolicy = (id: string, holder: string): Plan['insurance'][number] => ({
    kind: 'ltc', id, name: 'Care policy', owner: holder, annualPremium: 0, premiumMode: 'paidUp',
    benefitMonthly: 0, benefitPeriodYears: 3, eliminationPeriodDays: 90,
  })
  const stored = (plan: Plan): Record<string, unknown> => JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
  function load(plan: Plan): Extract<ReturnType<typeof migratePlanToCurrent>, { ok: true }> {
    const result = migratePlanToCurrent(stored(plan))
    if (!result.ok) throw new Error(`load failed: ${result.reason} ${(result.issues ?? []).join('; ')}`)
    return result
  }
  function firstYear(plan: Plan) {
    return simulatePlan(plan, { startYear: 2026, horizonEndYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
  }

  describe('a cash account and a property', () => {
    /**
     * The pair plans accepted until the plan checks began refusing it: a
     * 300,000 home and 10,000 of cash, both under `home`. The property is
     * stored first: in that order a TIPS ladder funded from `home` resolved to
     * the cash account under the old checks, which read the last row.
     */
    const aliasPlan = (): Plan => quietPlan([home(), checking()])

    it('gives the property its own id on load, keeps the cash id, and reports the repair', () => {
      const result = load(aliasPlan())
      expect(result.plan.accounts.map((account) => [account.type, account.id])).toEqual([
        ['property', 'home-property'],
        ['cash', 'home'],
      ])
      const [property, cash] = result.plan.accounts
      expect(property!.type === 'property' ? property!.value : null).toBe(300_000)
      expect(cash!.type === 'cash' ? cash!.balance : null).toBe(10_000)
      expect(result.repairs).toEqual([
        {
          kind: 'sharedIdSeparated',
          accountId: 'home',
          accountName: 'Home',
          newAccountId: 'home-property',
          renamedType: 'property',
          keptName: 'Checking',
          keptType: 'cash',
        },
      ])
    })

    it('publishes the cash balance and the property value separately once repaired', () => {
      const result = load(aliasPlan())
      const projection = firstYear(result.plan)
      const year = projection.years[0]!
      // Before the repair the one `home` entry was the property's 300,000 and
      // the cash category reported it; now each is its own entry.
      expect(year.balances['home']).toBe(10_000)
      expect(year.balances['home-property']).toBe(300_000)
      expect(year.investableTotal).toBe(10_000)
      expect(summarizeProjection(result.plan, projection).endingByCategory.cash).toBe(10_000)
    })

    it('leaves a reference to the shared id on the cash account, the only account it could name', () => {
      const plan = aliasPlan()
      plan.incomeFloor = {
        ladders: [{
          id: 'ladder',
          name: 'Bridge ladder',
          purpose: 'bridge',
          startYear: 2028,
          endYear: 2029,
          annualRealAmount: 1_000,
          purchase: { year: 2027, fundingAccountId: 'home' },
        }],
      }
      const result = load(plan)
      expect(result.plan.incomeFloor?.ladders[0]!.purchase?.fundingAccountId).toBe('home')
      expect(result.plan.accounts.find((account) => account.id === 'home')!.type).toBe('cash')
    })

    it('picks a new id that appears nowhere in the stored document', () => {
      const plan = aliasPlan()
      plan.expenses.oneTimeGoals = [{ id: 'home-property', label: 'Roof', year: 2030, amount: 1_000 }]
      const result = load(plan)
      expect(result.repairs.map((repair) => repair.kind === 'sharedIdSeparated' && repair.newAccountId))
        .toEqual(['home-property-2'])
      expect(result.plan.accounts.map((account) => account.id)).toEqual(['home-property-2', 'home'])
    })

    it('carries the rename into stored scenarios, so a scenario over the accounts still applies', () => {
      const plan = aliasPlan()
      const storedAccounts = stored(plan)['accounts'] as Record<string, unknown>[]
      const editedAccounts = storedAccounts.map((row) => (row['type'] === 'property' ? { ...row, value: 350_000 } : row))
      plan.scenarios = [
        {
          id: 's-canonical',
          name: 'Home at 350,000',
          patch: {
            kind: 'retiregolden.scenario-patch',
            version: 1,
            base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
            title: 'Home at 350,000',
            rationale: null,
            createdAtIso: '2026-06-11T00:00:00.000Z',
            actor: { kind: 'user' },
            operations: [{ op: 'set', path: '/accounts', before: { present: true, value: storedAccounts }, value: editedAccounts }],
          },
        },
        { id: 's-legacy', name: 'Legacy edit', patch: { accounts: editedAccounts } },
      ]
      const result = load(plan)

      const legacy = result.plan.scenarios[1]!.patch as { accounts: { type: string; id: string }[] }
      expect(legacy.accounts.map((row) => [row.type, row.id])).toEqual([['property', 'home-property'], ['cash', 'home']])

      const parsed = parseScenarioPatch(result.plan.scenarios[0]!.patch)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      const applied = applyScenarioPatchDocument(result.plan, parsed.patch)
      expect(applied.ok, applied.ok ? '' : applied.issues.join('; ')).toBe(true)
      if (!applied.ok) return
      const property = applied.plan.accounts.find((account) => account.id === 'home-property')
      const cash = applied.plan.accounts.find((account) => account.id === 'home')
      expect(property?.type === 'property' ? property.value : null).toBe(350_000)
      expect(cash?.type === 'cash' ? cash.balance : null).toBe(10_000)
    })

    it('repairs a pair that only a stored scenario carries, so the scenario still applies', () => {
      // The plan itself holds cash `home` and a property `house`; a legacy
      // scenario's accounts list adds a second property under `home`. Loading
      // repairs nothing in the plan, and the scenario's own list is repaired.
      const plan = quietPlan([checking(), home('house', 250_000, 'House')])
      const cabin = JSON.parse(JSON.stringify(home('home', 120_000, 'Cabin'))) as Record<string, unknown>
      const scenarioAccounts = [...(stored(plan)['accounts'] as Record<string, unknown>[]), cabin]
      const canonicalBefore = stored(plan)['accounts'] as Record<string, unknown>[]
      plan.scenarios = [
        { id: 's-legacy', name: 'Buy a cabin', patch: { accounts: scenarioAccounts } },
        {
          id: 's-canonical',
          name: 'Buy a cabin',
          patch: {
            kind: 'retiregolden.scenario-patch',
            version: 1,
            base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
            title: 'Buy a cabin',
            rationale: null,
            createdAtIso: '2026-06-11T00:00:00.000Z',
            actor: { kind: 'user' },
            operations: [{ op: 'set', path: '/accounts', before: { present: true, value: canonicalBefore }, value: scenarioAccounts }],
          },
        },
      ]
      const result = load(plan)
      expect(result.repairs).toEqual([])
      expect(result.plan.accounts.map((account) => account.id)).toEqual(['home', 'house'])

      const legacy = applyScenarioPatch(result.plan, result.plan.scenarios[0]!.patch)
      expect(legacy.ok, legacy.ok ? '' : legacy.issues.join('; ')).toBe(true)
      if (!legacy.ok) return
      expect(legacy.plan.accounts.map((account) => [account.type, account.id])).toEqual([['cash', 'home'], ['property', 'house'], ['property', 'home-property']])

      const parsed = parseScenarioPatch(result.plan.scenarios[1]!.patch)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      const applied = applyScenarioPatchDocument(result.plan, parsed.patch)
      expect(applied.ok, applied.ok ? '' : applied.issues.join('; ')).toBe(true)
      if (!applied.ok) return
      expect(applied.plan.accounts.map((account) => [account.type, account.id]))
        .toEqual([['cash', 'home'], ['property', 'house'], ['property', 'home-property']])
    })

    it("gives a scenario's copy of the renamed property the plan's new id where the scenario drops the cash account", () => {
      // The scenario's list no longer collides on its own terms, so only the
      // plan's rename can tell it that its `home` property is the plan's.
      const plan = aliasPlan()
      const storedAccounts = stored(plan)['accounts'] as Record<string, unknown>[]
      const homeOnly = storedAccounts.filter((row) => row['type'] === 'property')
      plan.scenarios = [
        { id: 's-legacy', name: 'Close the checking account', patch: { accounts: homeOnly } },
        {
          id: 's-canonical',
          name: 'Close the checking account',
          patch: {
            kind: 'retiregolden.scenario-patch',
            version: 1,
            base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
            title: 'Close the checking account',
            rationale: null,
            createdAtIso: '2026-06-11T00:00:00.000Z',
            actor: { kind: 'user' },
            operations: [{ op: 'set', path: '/accounts', before: { present: true, value: storedAccounts }, value: homeOnly }],
          },
        },
      ]
      const result = load(plan)
      expect(result.plan.accounts.map((account) => [account.type, account.id])).toEqual([['property', 'home-property'], ['cash', 'home']])

      const legacy = applyScenarioPatch(result.plan, result.plan.scenarios[0]!.patch)
      expect(legacy.ok, legacy.ok ? '' : legacy.issues.join('; ')).toBe(true)
      if (!legacy.ok) return
      expect(legacy.plan.accounts.map((account) => [account.type, account.id])).toEqual([['property', 'home-property']])

      const parsed = parseScenarioPatch(result.plan.scenarios[1]!.patch)
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      const applied = applyScenarioPatchDocument(result.plan, parsed.patch)
      expect(applied.ok, applied.ok ? '' : applied.issues.join('; ')).toBe(true)
      if (!applied.ok) return
      expect(applied.plan.accounts.map((account) => [account.type, account.id])).toEqual([['property', 'home-property']])
    })

    it("names a scenario's own collision past the new id its copy of the plan's property took", () => {
      // The scenario keeps both of the plan's rows and adds a cabin, also
      // under `home`. Its copy of the plan's property takes `home-property`
      // as the plan's did, so the cabin takes the next name.
      const plan = aliasPlan()
      const cabin = JSON.parse(JSON.stringify(home('home', 120_000, 'Cabin'))) as Record<string, unknown>
      plan.scenarios = [{
        id: 's-legacy',
        name: 'Buy a cabin',
        patch: { accounts: [...(stored(plan)['accounts'] as Record<string, unknown>[]), cabin] },
      }]
      const result = load(plan)
      const legacy = applyScenarioPatch(result.plan, result.plan.scenarios[0]!.patch)
      expect(legacy.ok, legacy.ok ? '' : legacy.issues.join('; ')).toBe(true)
      if (!legacy.ok) return
      expect(legacy.plan.accounts.map((account) => [account.name, account.id]))
        .toEqual([['Home', 'home-property'], ['Checking', 'home'], ['Cabin', 'home-property-2']])
    })
  })

  describe("two properties under one id, in a scenario that does not keep the plan's order", () => {
    /** Home keeps `x` on load and Cabin becomes `x-property`. */
    const twoHomesPlan = (): Plan => quietPlan([home('x', 300_000, 'Home'), home('x', 120_000, 'Cabin')])

    /** A legacy and a canonical scenario that each set the accounts to the given list, loaded, then applied. */
    function applyBoth(accounts: (storedAccounts: Record<string, unknown>[]) => Record<string, unknown>[]): string[][][] {
      const plan = twoHomesPlan()
      const storedAccounts = stored(plan)['accounts'] as Record<string, unknown>[]
      const value = accounts(storedAccounts)
      plan.scenarios = [
        { id: 's-legacy', name: 'Scenario', patch: { accounts: value } },
        {
          id: 's-canonical',
          name: 'Scenario',
          patch: {
            kind: 'retiregolden.scenario-patch',
            version: 1,
            base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
            title: 'Scenario',
            rationale: null,
            createdAtIso: '2026-06-11T00:00:00.000Z',
            actor: { kind: 'user' },
            operations: [{ op: 'set', path: '/accounts', before: { present: true, value: storedAccounts }, value }],
          },
        },
      ]
      const result = load(plan)
      expect(result.plan.accounts.map((account) => [account.name, account.id])).toEqual([['Home', 'x'], ['Cabin', 'x-property']])
      const legacy = applyScenarioPatch(result.plan, result.plan.scenarios[0]!.patch)
      if (!legacy.ok) throw new Error(legacy.issues.join('; '))
      const parsed = parseScenarioPatch(result.plan.scenarios[1]!.patch)
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      const canonical = applyScenarioPatchDocument(result.plan, parsed.patch)
      if (!canonical.ok) throw new Error(canonical.issues.join('; '))
      return [legacy.plan, canonical.plan].map((applied) => applied.accounts.map((account) => [account.name, account.id]))
    }

    it('keeps each property under the id the plan gave it when the scenario lists Cabin first', () => {
      const [legacy, canonical] = applyBoth((storedAccounts) => [storedAccounts[1]!, storedAccounts[0]!])
      expect(legacy).toEqual([['Cabin', 'x-property'], ['Home', 'x']])
      expect(canonical).toEqual([['Cabin', 'x-property'], ['Home', 'x']])
    })

    it('keeps Cabin under its new id when the scenario drops Home', () => {
      const [legacy, canonical] = applyBoth((storedAccounts) => [storedAccounts[1]!])
      expect(legacy).toEqual([['Cabin', 'x-property']])
      expect(canonical).toEqual([['Cabin', 'x-property']])
    })

    it("keeps Cabin under its new id when the scenario drops Home and changes Cabin's value", () => {
      // Cabin's copy no longer equals the plan's row, so its name and type
      // identify it; it must not take the id Home kept.
      const [legacy, canonical] = applyBoth((storedAccounts) => [{ ...storedAccounts[1]!, value: 150_000 }])
      expect(legacy).toEqual([['Cabin', 'x-property']])
      expect(canonical).toEqual([['Cabin', 'x-property']])
    })
  })

  it('renames the later of a property and a debt, and publishes both values', () => {
    const result = load(quietPlan([home(), mortgage()]))
    expect(result.plan.accounts.map((account) => [account.type, account.id])).toEqual([['property', 'home'], ['debt', 'home-debt']])
    expect(result.repairs).toEqual([{
      kind: 'sharedIdSeparated', accountId: 'home', accountName: 'Mortgage', newAccountId: 'home-debt',
      renamedType: 'debt', keptName: 'Home', keptType: 'property',
    }])
    const year = firstYear(result.plan).years[0]!
    // Before, the one `home` entry held the debt's 100,000 in place of the home.
    expect(year.balances['home']).toBe(300_000)
    expect(year.balances['home-debt']).toBe(100_000)
  })

  it('renames the second of two properties, so both count in net worth', () => {
    const result = load(quietPlan([home('home', 300_000, 'Home'), home('home', 200_000, 'Cabin')]))
    expect(result.plan.accounts.map((account) => account.id)).toEqual(['home', 'home-property'])
    expect(result.repairs.map((repair) => repair.kind === 'sharedIdSeparated' && [repair.accountName, repair.keptName]))
      .toEqual([['Cabin', 'Home']])
    const projection = firstYear(result.plan)
    const year = projection.years[0]!
    expect(year.balances['home']).toBe(300_000)
    expect(year.balances['home-property']).toBe(200_000)
    // Before, the property map kept one 'home' value, and net worth held 200,000 of the 500,000.
    expect(year.netWorth).toBe(500_000)
  })

  it('renames a permanent-life policy that shares an account id, so the cash balance is published', () => {
    const plan = quietPlan([checking('savings')])
    plan.insurance = [lifePolicy('savings', plan.household.people[0]!.id)]
    const result = load(plan)
    expect(result.plan.insurance.map((policy) => policy.id)).toEqual(['savings-policy'])
    expect(result.plan.accounts.map((account) => account.id)).toEqual(['savings'])
    expect(result.repairs).toEqual([{
      kind: 'sharedIdSeparated', accountId: 'savings', accountName: 'Whole life', newAccountId: 'savings-policy',
      renamedType: 'permanentLife', keptName: 'Checking', keptType: 'cash',
    }])
    const year = firstYear(result.plan).years[0]!
    // Before, `savings` published the policy's 50,000 cash value in place of the 10,000 of cash.
    expect(year.balances['savings']).toBe(10_000)
    expect(year.balances['savings-policy']).toBe(50_000)
    expect(year.investableTotal).toBe(10_000)
  })

  it('renames the second of two policies under one id, so both cash values count', () => {
    const plan = quietPlan([])
    const insured = plan.household.people[0]!.id
    plan.insurance = [lifePolicy('life', insured, 50_000, 'First policy'), lifePolicy('life', insured, 20_000, 'Second policy')]
    const result = load(plan)
    expect(result.plan.insurance.map((policy) => policy.id)).toEqual(['life', 'life-policy'])
    const year = firstYear(result.plan).years[0]!
    expect(year.balances['life']).toBe(50_000)
    expect(year.balances['life-policy']).toBe(20_000)
    // Before, the cash-value map held one 'life' entry, and net worth 20,000 of the 70,000.
    expect(year.netWorth).toBe(70_000)
  })

  it('leaves an LTC and a permanent-life policy under one id alone, since they keep no shared value', () => {
    const plan = quietPlan([])
    const person = plan.household.people[0]!.id
    plan.insurance = [ltcPolicy('cover', person), lifePolicy('cover', person)]
    const result = load(plan)
    expect(result.repairs).toEqual([])
    expect(result.plan.insurance.map((policy) => [policy.kind, policy.id])).toEqual([['ltc', 'cover'], ['permanentLife', 'cover']])
  })

  it('renames the second of two LTC policies under one id, so each keeps its own benefit period', () => {
    // Each policy pays up to 60,000 a year for 1 year, against 120,000 a year
    // of care. Under one id the two shared one count of benefit years, so in
    // the first year the second policy read the first one's year as its own
    // and paid nothing: 60,000 of benefit instead of 120,000.
    const plan = quietPlan([checking('cash', 500_000)])
    const person = plan.household.people[0]!.id
    plan.household.people[0]!.longevity = { planningAge: 90, source: 'manual' }
    const firstLtc = { ...ltcPolicy('cover', person), benefitMonthly: 5_000, benefitPeriodYears: 1, eliminationPeriodDays: 0, name: 'First care policy' }
    const secondLtc = { ...firstLtc, name: 'Second care policy' }
    plan.insurance = [firstLtc, secondLtc] as Plan['insurance']
    const startAge = 2026 - Number(plan.household.people[0]!.dob.slice(0, 4))
    plan.careEvents = [{ id: 'care', personId: person, startAge, durationYears: 2, annualCost: 120_000 }]
    const result = load(plan)
    expect(result.plan.insurance.map((policy) => policy.id)).toEqual(['cover', 'cover-policy'])
    expect(result.repairs).toEqual([{
      kind: 'sharedIdSeparated', accountId: 'cover', accountName: 'Second care policy', newAccountId: 'cover-policy',
      renamedType: 'ltc', keptName: 'First care policy', keptType: 'ltc',
    }])
    const options = { startYear: 2026, horizonEndYear: 2027, taxCalculator: createFlatTaxCalculator(0) }
    // The stored plan, projected as it was: one shared count of years used.
    expect(simulatePlan(plan, options).years.map((year) => year.expenses.ltcBenefit)).toEqual([60_000, 0])
    // Repaired, each policy pays its own year.
    expect(simulatePlan(result.plan, options).years.map((year) => year.expenses.ltcBenefit)).toEqual([120_000, 0])
  })

  it('carries a policy rename into a scenario that sets the insurance list', () => {
    const plan = quietPlan([checking('savings')])
    plan.insurance = [lifePolicy('savings', plan.household.people[0]!.id)]
    const storedInsurance = stored(plan)['insurance'] as Record<string, unknown>[]
    plan.scenarios = [{
      id: 's-insurance',
      name: 'Bigger policy',
      patch: {
        kind: 'retiregolden.scenario-patch',
        version: 1,
        base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
        title: 'Bigger policy',
        rationale: null,
        createdAtIso: '2026-06-11T00:00:00.000Z',
        actor: { kind: 'user' },
        operations: [{
          op: 'set',
          path: '/insurance',
          before: { present: true, value: storedInsurance },
          value: storedInsurance.map((row) => ({ ...row, cashValue: 80_000 })),
        }],
      },
    }]
    const result = load(plan)
    const parsed = parseScenarioPatch(result.plan.scenarios[0]!.patch)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const applied = applyScenarioPatchDocument(result.plan, parsed.patch)
    expect(applied.ok, applied.ok ? '' : applied.issues.join('; ')).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.insurance.map((policy) => [policy.id, policy.kind === 'permanentLife' ? policy.cashValue : null]))
      .toEqual([['savings-policy', 80_000]])
  })

  it("says a scenario introduced the shared id it adds when applying it is refused", () => {
    // The scenario adds a cash account under the id of the plan's own policy
    // without setting the insurance list, which loading leaves as stored.
    const plan = quietPlan([checking('savings')])
    plan.insurance = [lifePolicy('cover', plan.household.people[0]!.id)]
    const cover = JSON.parse(JSON.stringify(checking('cover', 5_000))) as Record<string, unknown>
    const storedAccounts = stored(plan)['accounts'] as Record<string, unknown>[]
    plan.scenarios = [
      { id: 's-legacy', name: 'Open another account', patch: { accounts: [...storedAccounts, cover] } },
      {
        id: 's-canonical',
        name: 'Open another account',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: { planId: plan.id, planSchemaVersion: plan.schemaVersion, snapshotHash: 'fnv1a64:0000000000000000' },
          title: 'Open another account',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'user' },
          operations: [{ op: 'set', path: '/accounts', before: { present: true, value: storedAccounts }, value: [...storedAccounts, cover] }],
        },
      },
    ]
    const result = load(plan)
    expect(result.repairs).toEqual([])
    const refusal = [
      'insurance.0.id: insurance policy id "cover" is also an account id; give the policy its own id (this scenario introduces the shared id)',
    ]
    const legacy = applyScenarioPatch(result.plan, result.plan.scenarios[0]!.patch)
    expect(legacy.ok).toBe(false)
    if (!legacy.ok) expect(legacy.issues).toEqual(refusal)
    const parsed = parseScenarioPatch(result.plan.scenarios[1]!.patch)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const applied = applyScenarioPatchDocument(result.plan, parsed.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) expect(applied.issues).toEqual(refusal)
  })

  it('leaves a collision-free plan byte-identical, including a pension and a property that share an id', () => {
    // A pension publishes no value under its id, so it may share one.
    const plan = quietPlan([
      home('pension-home'),
      {
        type: 'pension', id: 'pension-home', name: 'Pension', ownerPersonId: owner(), annualReturnPct: null,
        startAge: 65, monthlyAmount: 1_000, colaPct: 0, survivorPct: 0,
      },
      checking('cash'),
      mortgage('mortgage'),
    ])
    plan.accounts[1] = { ...plan.accounts[1]!, ownerPersonId: plan.household.people[0]!.id } as Plan['accounts'][number]
    plan.insurance = [lifePolicy('life', plan.household.people[0]!.id)]
    const raw = stored(plan)
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.repairs).toEqual([])
    expect(result.plan).toEqual(plan)
  })
})

describe('v1 -> v2 retirement-action migration', () => {
  function rawV1Plan(): Record<string, unknown> {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    return { ...JSON.parse(JSON.stringify(plan)), schemaVersion: 1 } as Record<string, unknown>
  }

  const legacyWithdrawal = {
    kind: 'legacyAggregateWithdrawal',
    year: 2030,
    requestedAmount: 50_000,
    legacyCategory: 'traditional',
    provenance: { source: 'migration', sourceId: 'withdrawalOrder' },
  } as const
  const legacyConversion = {
    kind: 'legacyAggregateRothConversion',
    year: 2031,
    requestedAmount: 25_000,
    provenance: { source: 'migration', sourceId: 'rothConversion' },
  } as const
  const legacyQcd = {
    kind: 'legacyAggregateQcd',
    year: 2032,
    requestedAmount: 10_000,
    legacyField: 'qcdAnnual',
    provenance: { source: 'migration', sourceId: 'qcdAnnual' },
  } as const

  function withActions(
    raw: Record<string, unknown>,
    retirementActions: readonly unknown[],
  ): Record<string, unknown> {
    const strategies = raw['strategies'] as Record<string, unknown>
    return { ...raw, strategies: { ...strategies, retirementActions } }
  }

  function migratedActions(raw: Record<string, unknown>): Array<Record<string, unknown>> {
    const migrated = migratePlanV1ToV2(raw)
    const strategies = migrated['strategies'] as Record<string, unknown>
    return strategies['retirementActions'] as Array<Record<string, unknown>>
  }

  it('adds an empty action schedule without changing legacy scalar strategies', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    strategies['withdrawalOrder'] = { mode: 'bracketTargeted', bracketPct: 24 }
    strategies['rothConversion'] = {
      mode: 'manual',
      conversions: [{ year: 2030, amount: 12_345.67 }],
    }
    strategies['qcdAnnual'] = 4_321.09
    const scalarSnapshot = JSON.parse(JSON.stringify(strategies)) as Record<string, unknown>

    const result = migratePlanToCurrent(raw)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(5)
      expect(result.plan.strategies.retirementActions).toEqual([])
      expect(result.plan.strategies.withdrawalOrder).toEqual(scalarSnapshot['withdrawalOrder'])
      expect(result.plan.strategies.rothConversion).toEqual(scalarSnapshot['rothConversion'])
      expect(result.plan.strategies.qcdAnnual).toBe(scalarSnapshot['qcdAnnual'])
    }
  })

  it('rebinds canonical scenario patches to the migrated current plan snapshot', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'scenario-1',
        name: 'Higher inflation',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Higher inflation',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'user' },
          operations: [
            {
              op: 'set',
              path: '/assumptions/inflationPct',
              before: { present: true, value: 2.5 },
              value: 3,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base).toEqual({
      planId: migrated.plan.id,
      planSchemaVersion: 5,
      snapshotHash: scenarioPlanSnapshotHash(migrated.plan),
    })

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.assumptions.inflationPct).toBe(3)
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) expect(reverted.plan.assumptions.inflationPct).toBe(2.5)
  })

  it('migrates legacy IDs inside canonical action-array operations', () => {
    const raw = withActions(rawV1Plan(), [legacyWithdrawal])
    raw['scenarios'] = [
      {
        id: 'scenario-actions',
        name: 'Add legacy QCD',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Add legacy QCD',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [legacyWithdrawal] },
              value: [legacyWithdrawal, legacyQcd],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    expect(operation?.before.present).toBe(true)
    if (operation?.before.present !== true || operation.op !== 'set') return
    const beforeActions = operation.before.value as Array<Record<string, unknown>>
    const valueActions = operation.value as Array<Record<string, unknown>>
    expect(beforeActions[0]?.['actionId']).toBe(
      migrated.plan.strategies.retirementActions[0]?.actionId,
    )
    expect(valueActions.map((action) => action['actionId'])).toEqual([
      beforeActions[0]?.['actionId'],
      expect.stringMatching(/^legacy-qcd-2032-/),
    ])

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.strategies.retirementActions).toHaveLength(2)
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) {
      expect(reverted.plan.strategies.retirementActions).toEqual(
        migrated.plan.strategies.retirementActions,
      )
    }
  })

  it('keeps retained legacy IDs stable across scenario collision states', () => {
    const standalone = migratedActions(
      withActions(rawV1Plan(), [legacyWithdrawal]),
    )
    const generatedSeed = standalone[0]?.['actionId'] as string
    const collidingSuppliedAction = {
      ...legacyConversion,
      actionId: generatedSeed,
    }
    const raw = withActions(rawV1Plan(), [
      legacyWithdrawal,
      collidingSuppliedAction,
    ])
    raw['scenarios'] = [
      {
        id: 'scenario-remove-collision',
        name: 'Remove colliding action',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Remove colliding action',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: {
                present: true,
                value: [legacyWithdrawal, collidingSuppliedAction],
              },
              value: [legacyWithdrawal],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const retainedActionId =
      migrated.plan.strategies.retirementActions[0]?.actionId
    expect(retainedActionId).toBe(`${generatedSeed}-2`)
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set') return
    const valueActions = operation.value as Array<Record<string, unknown>>
    expect(valueActions[0]?.['actionId']).toBe(retainedActionId)
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toBe(
        retainedActionId,
      )
    }
  })

  it('strips unknown legacy metadata consistently inside canonical scenario arrays', () => {
    const baseAction = {
      ...legacyQcd,
      thirdPartyMetadata: 'base-only',
      provenance: {
        ...legacyQcd.provenance,
        importNote: 'base-only',
      },
    }
    const scenarioAction = {
      ...legacyQcd,
      thirdPartyMetadata: 'scenario-only',
      provenance: {
        ...legacyQcd.provenance,
        importNote: 'scenario-only',
      },
    }
    const raw = withActions(rawV1Plan(), [baseAction])
    raw['scenarios'] = [
      {
        id: 'scenario-strip-action-metadata',
        name: 'Strip action metadata',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Strip action metadata',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [baseAction] },
              value: [scenarioAction],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set' || operation.before.present !== true) return
    const beforeAction = (
      operation.before.value as Array<Record<string, unknown>>
    )[0]!
    const valueAction = (operation.value as Array<Record<string, unknown>>)[0]!
    for (const action of [beforeAction, valueAction]) {
      expect(action).not.toHaveProperty('thirdPartyMetadata')
      expect(action['provenance']).not.toHaveProperty('importNote')
    }
    expect(valueAction['actionId']).toBe(beforeAction['actionId'])
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
  })

  it('normalizes an absent direct action-schedule precondition to the v2 default', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    raw['scenarios'] = [
      {
        id: 'scenario-add-actions',
        name: 'Introduce action schedule',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Introduce action schedule',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: false },
              value: [legacyQcd],
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.operations[0]?.before).toEqual({
      present: true,
      value: [],
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('normalizes removal of the action schedule to the v2 empty default', () => {
    const raw = withActions(rawV1Plan(), [legacyQcd])
    raw['scenarios'] = [
      {
        id: 'scenario-remove-actions',
        name: 'Remove action schedule',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Remove action schedule',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'remove',
              path: '/strategies/retirementActions',
              before: { present: true, value: [legacyQcd] },
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.operations[0]).toMatchObject({
      op: 'set',
      path: '/strategies/retirementActions',
      value: [],
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.strategies.retirementActions).toEqual([])
    const reverted = revertScenarioPatch(applied.plan, parsedPatch.patch)
    expect(reverted.ok).toBe(true)
    if (reverted.ok) {
      expect(reverted.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('adds the empty schedule inside whole-strategies scenario operations', () => {
    const raw = rawV1Plan()
    const strategies = raw['strategies'] as Record<string, unknown>
    delete strategies['retirementActions']
    const beforeStrategies = JSON.parse(JSON.stringify(strategies)) as Record<
      string,
      unknown
    >
    const valueStrategies = {
      ...beforeStrategies,
      qcdAnnual: 2_500,
    }
    raw['scenarios'] = [
      {
        id: 'scenario-strategies',
        name: 'Change strategies',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Change strategies',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies',
              before: { present: true, value: beforeStrategies },
              value: valueStrategies,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    expect(operation?.before.present).toBe(true)
    if (operation?.before.present !== true || operation.op !== 'set') return
    expect(operation.before.value).toMatchObject({ retirementActions: [] })
    expect(operation.value).toMatchObject({ retirementActions: [] })

    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.strategies.qcdAnnual).toBe(2_500)
  })

  it('carries a nonempty base schedule through whole-strategies operations', () => {
    const raw = withActions(rawV1Plan(), [legacyQcd])
    const strategies = raw['strategies'] as Record<string, unknown>
    const beforeStrategies = JSON.parse(JSON.stringify(strategies)) as Record<
      string,
      unknown
    >
    delete beforeStrategies['retirementActions']
    const valueStrategies = {
      ...beforeStrategies,
      qcdAnnual: 2_500,
    }
    raw['scenarios'] = [
      {
        id: 'scenario-strategies-with-actions',
        name: 'Change strategies and retain actions',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Change strategies and retain actions',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies',
              before: { present: true, value: beforeStrategies },
              value: valueStrategies,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const retainedActionId =
      migrated.plan.strategies.retirementActions[0]?.actionId
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    const operation = parsedPatch.patch.operations[0]
    if (operation?.op !== 'set' || operation.before.present !== true) return
    for (const value of [operation.before.value, operation.value]) {
      const operationStrategies = value as Record<string, unknown>
      const operationActions = operationStrategies[
        'retirementActions'
      ] as Array<Record<string, unknown>>
      expect(operationActions[0]?.['actionId']).toBe(retainedActionId)
    }
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toBe(
        retainedActionId,
      )
    }
  })

  it('migrates ID-less actions inside loose legacy scenario patches', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'legacy-scenario-actions',
        name: 'Legacy action patch',
        patch: {
          strategies: {
            retirementActions: [legacyQcd],
          },
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const applied = applyScenarioPatch(
      migrated.plan,
      migrated.plan.scenarios[0]!.patch,
    )
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.strategies.retirementActions[0]?.actionId).toMatch(
        /^legacy-qcd-2032-/,
      )
    }
  })

  it('preserves a canonical scenario that targets a different plan ID', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'foreign-scenario',
        name: 'Foreign scenario',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: 'another-plan',
            planSchemaVersion: 1,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Foreign scenario',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/assumptions/inflationPct',
              before: { present: true, value: 2.5 },
              value: 3,
            },
          ],
        },
      },
    ]

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base.planId).toBe('another-plan')
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) {
      expect(applied.conflicts.some((conflict) => conflict.kind === 'plan-id')).toBe(
        true,
      )
    }
  })

  it('preserves a canonical scenario that targets a different schema version', () => {
    const raw = rawV1Plan()
    raw['scenarios'] = [
      {
        id: 'foreign-version-scenario',
        name: 'Foreign schema scenario',
        patch: {
          kind: 'retiregolden.scenario-patch',
          version: 1,
          base: {
            planId: raw['id'],
            planSchemaVersion: 99,
            snapshotHash: 'fnv1a64:0000000000000000',
          },
          title: 'Foreign schema scenario',
          rationale: null,
          createdAtIso: '2026-06-11T00:00:00.000Z',
          actor: { kind: 'legacy' },
          operations: [
            {
              op: 'set',
              path: '/strategies/retirementActions',
              before: { present: true, value: [] },
              value: [legacyQcd],
            },
          ],
        },
      },
    ]
    const patchSnapshot = JSON.parse(
      JSON.stringify(
        (raw['scenarios'] as Array<Record<string, unknown>>)[0]?.['patch'],
      ),
    )

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.plan.scenarios[0]!.patch).toEqual(patchSnapshot)
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base.planSchemaVersion).toBe(99)
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(false)
    if (!applied.ok) {
      expect(
        applied.conflicts.some(
          (conflict) => conflict.kind === 'plan-schema-version',
        ),
      ).toBe(true)
    }
  })

  it('assigns stable IDs to only genuinely ID-less typed legacy records', () => {
    const raw = withActions(rawV1Plan(), [
      legacyWithdrawal,
      { ...legacyConversion, actionId: 'preserved-byte-for-byte' },
      legacyQcd,
    ])
    const first = migratedActions(raw)
    const second = migratedActions(raw)

    expect(first).toEqual(second)
    expect(first[0]?.['actionId']).toMatch(/^legacy-withdrawal-2030-/)
    expect(first[1]?.['actionId']).toBe('preserved-byte-for-byte')
    expect(first[2]?.['actionId']).toMatch(/^legacy-qcd-2032-/)
    expect(new Set(first.map((action) => action['actionId'])).size).toBe(3)

    const forbiddenInventedFields = [
      'personId',
      'donorPersonId',
      'allocations',
      'allocation',
      'destinationRothAccountId',
      'executionDate',
      'executionSequence',
      'purpose',
      'charity',
      'taxFunding',
    ]
    for (const action of first) {
      for (const field of forbiddenInventedFields) {
        expect(action).not.toHaveProperty(field)
      }
    }

    const fullyMigrated = migratePlanToCurrent(raw)
    expect(fullyMigrated.ok).toBe(true)
  })

  it('is independent of action input ordering', () => {
    const forward = migratedActions(
      withActions(rawV1Plan(), [legacyWithdrawal, legacyConversion, legacyQcd]),
    )
    const reverse = migratedActions(
      withActions(rawV1Plan(), [legacyQcd, legacyConversion, legacyWithdrawal]),
    )
    const idByKind = (actions: Array<Record<string, unknown>>) =>
      Object.fromEntries(actions.map((action) => [action['kind'], action['actionId']]))

    expect(idByKind(reverse)).toEqual(idByKind(forward))
  })

  it('reserves supplied IDs and suffixes a generated collision deterministically', () => {
    const seed = migratedActions(withActions(rawV1Plan(), [legacyWithdrawal]))[0]?.[
      'actionId'
    ] as string
    const actions = migratedActions(
      withActions(rawV1Plan(), [
        { ...legacyConversion, actionId: seed },
        legacyWithdrawal,
      ]),
    )

    expect(actions[0]?.['actionId']).toBe(seed)
    expect(actions[1]?.['actionId']).toBe(`${seed}-2`)
  })

  it('is copy-on-change and idempotent once all legacy records have IDs', () => {
    const raw = withActions(rawV1Plan(), [
      { ...legacyWithdrawal, actionId: 'legacy-withdrawal-fixed' },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)

    const missing = withActions(rawV1Plan(), [legacyWithdrawal])
    const normalized = migratePlanV1ToV2(missing)
    expect(normalized).not.toBe(missing)
    expect(migratePlanV1ToV2(normalized)).toBe(normalized)
  })

  it.each([
    ['blank', ''],
    ['blank whitespace', '  '],
    ['null', null],
  ])('never replaces a supplied %s action ID; final parsing rejects it', (_label, actionId) => {
    const raw = withActions(rawV1Plan(), [{ ...legacyQcd, actionId }])
    expect(migratedActions(raw)[0]?.['actionId']).toBe(actionId)
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_after_migration')
  })

  it('does not normalize unknown/current records that omit an action ID', () => {
    const raw = withActions(rawV1Plan(), [
      {
        kind: 'ordinaryWithdrawal',
        personId: 'missing',
        year: 2030,
        requestedAmount: 100,
      },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)
  })

  it('strips unknown persisted legacy fields while assigning a missing ID', () => {
    const raw = withActions(rawV1Plan(), [
      {
        ...legacyQcd,
        thirdPartyMetadata: 'ignored',
        provenance: {
          ...legacyQcd.provenance,
          importNote: 'ignored',
        },
      },
    ])
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const action = result.plan.strategies.retirementActions[0] as unknown as Record<
      string,
      unknown
    >
    expect(action['actionId']).toMatch(/^legacy-qcd-2032-/)
    expect(action).not.toHaveProperty('thirdPartyMetadata')
    expect(action['provenance']).not.toHaveProperty('importNote')
  })

  it('does not normalize a malformed legacy-looking record', () => {
    const raw = withActions(rawV1Plan(), [
      {
        kind: 'legacyAggregateQcd',
        year: 2030,
        requestedAmount: 100,
        legacyField: 'not-qcdAnnual',
        provenance: { source: 'migration' },
      },
    ])
    expect(migratePlanV1ToV2(raw)).toBe(raw)
  })
})

describe('v2 -> v3 retirement-action eligibility facts migration', () => {
  function rawV2Plan(): Record<string, unknown> {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    return {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 2,
    } as Record<string, unknown>
  }

  it('is pure and does not invent eligibility evidence', () => {
    const raw = rawV2Plan()
    const migrated = migratePlanV2ToV3(raw)
    expect(migrated).toBe(raw)
    expect(migrated).not.toHaveProperty('retirementActionEligibilityFacts')

    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(5)
      expect(result.plan).not.toHaveProperty('retirementActionEligibilityFacts')
    }
  })

  it.each([1, 2])(
    'discards a root eligibility-facts field smuggled into schema v%s',
    (schemaVersion) => {
      const raw = {
        ...rawV2Plan(),
        schemaVersion,
        retirementActionEligibilityFacts: {
          iraClassifications: [
            {
              evidenceId: 'untrusted',
              provenance: { source: 'manual' },
              sourceAccountId: 'invented',
              subtype: 'traditional',
            },
          ],
          sepSimpleActivities: [],
          deductibleIraContributions: [],
        },
      }
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.plan.schemaVersion).toBe(5)
        expect(result.plan).not.toHaveProperty(
          'retirementActionEligibilityFacts',
        )
      }
    },
  )

  it('rebinds a canonical v2 scenario to the migrated current snapshot', () => {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    const edited = structuredClone(current)
    edited.assumptions.inflationPct = 3
    const created = createScenarioPatch(current, edited, {
      title: 'Higher inflation',
      createdAtIso: '2026-06-11T00:00:00.000Z',
      actor: { kind: 'user' },
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const raw = {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 2,
      scenarios: [
        {
          id: 'scenario-v2',
          name: 'Higher inflation',
          patch: {
            ...created.patch,
            base: {
              ...created.patch.base,
              planSchemaVersion: 2,
            },
          },
        },
      ],
    }

    const migrated = migratePlanToCurrent(raw)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const parsedPatch = parseScenarioPatch(migrated.plan.scenarios[0]!.patch)
    expect(parsedPatch.ok).toBe(true)
    if (!parsedPatch.ok) return
    expect(parsedPatch.patch.base).toEqual({
      planId: migrated.plan.id,
      planSchemaVersion: 5,
      snapshotHash: scenarioPlanSnapshotHash(migrated.plan),
    })
    const applied = applyScenarioPatchDocument(migrated.plan, parsedPatch.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.assumptions.inflationPct).toBe(3)
  })
})

describe('v3 -> v4 retirement-action annual tax facts migration', () => {
  function rawV3Plan(): Record<string, unknown> {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    return {
      ...JSON.parse(JSON.stringify(current)),
      schemaVersion: 3,
    } as Record<string, unknown>
  }

  it('is pure and does not invent authoritative annual tax facts', () => {
    const raw = rawV3Plan()
    const migrated = migratePlanV3ToV4(raw)
    expect(migrated).toBe(raw)
    expect(migrated).not.toHaveProperty('retirementActionAnnualTaxFacts')

    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(5)
      expect(result.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    }
  })

  it.each([1, 2, 3])(
    'discards annual tax facts smuggled into schema v%s',
    (schemaVersion) => {
      const raw = {
        ...rawV3Plan(),
        schemaVersion,
        retirementActionAnnualTaxFacts: {
          ownedNonRothIraAnnualFilingSourceRecords: [{
            predicate: 'completePlanOwnedNonRothIraAnnualFilingSourceRecord',
            planId: 'invented-plan',
            ownerPersonId: 'invented-owner',
            taxYear: 2025,
          }],
        },
      }
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.plan.schemaVersion).toBe(5)
        expect(result.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
      }
    },
  )
})

describe('v4 -> v5 one-time income inflation election', () => {
  /** A v4 document: one-time income streams carry no `inflationAdjusted`. */
  function rawV4Plan(): Record<string, unknown> {
    const current = createEmptyPlan({ newId: testIds, now: fixedNow })
    const raw = JSON.parse(JSON.stringify(current)) as Record<string, unknown>
    raw['schemaVersion'] = 4
    raw['incomes'] = [
      { type: 'wages', id: 'w1', personId: current.household.people[0]!.id, annualGross: 90_000, endAge: null, realGrowthPct: 0 },
      { type: 'recurring', id: 'r1', label: 'Rental', annualAmount: 24_000, startYear: null, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'o1', label: 'Inheritance', year: 2040, amount: 100_000, taxTreatment: 'none' },
    ]
    return raw
  }

  const oneTimeOf = (incomes: readonly unknown[]): Record<string, unknown> =>
    incomes.find((i) => (i as Record<string, unknown>)['type'] === 'oneTime') as Record<string, unknown>

  it('writes false onto a stored one-time stream and leaves the other kinds alone', () => {
    const raw = rawV4Plan()
    const before = JSON.parse(JSON.stringify(raw['incomes'])) as unknown[]
    const migrated = migratePlanV4ToV5(raw)
    const incomes = migrated['incomes'] as Record<string, unknown>[]
    // FALSE, not true. This is the whole decision: it is the only value that
    // reprojects a stored plan to the numbers its owner last saw, because
    // before v5 a one-time amount was never inflated.
    expect(oneTimeOf(incomes)['inflationAdjusted']).toBe(false)
    // Nothing else moved, including the recurring stream's own election.
    expect(incomes[0]).toEqual(before[0])
    expect(incomes[1]).toEqual(before[1])
    expect(raw['incomes']).toEqual(before) // pure: the input document is untouched
  })

  it('is a no-op on a document with nothing to migrate', () => {
    const raw = rawV4Plan()
    raw['incomes'] = [(raw['incomes'] as unknown[])[0]]
    expect(migratePlanV4ToV5(raw)).toBe(raw) // identity, not a fresh equal object
  })

  it('does not overwrite an election that is already present', () => {
    const raw = rawV4Plan()
    oneTimeOf(raw['incomes'] as unknown[])['inflationAdjusted'] = true
    expect(migratePlanV4ToV5(raw)).toBe(raw)
  })

  it('lands a v4 document on version 5 and parses', () => {
    const result = migratePlanToCurrent(rawV4Plan())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.schemaVersion).toBe(5)
    const stream = result.plan.incomes.find((i) => i.type === 'oneTime')!
    expect(stream.type === 'oneTime' && stream.inflationAdjusted).toBe(false)
  })

  // The migration's PURPOSE, asserted against the PROJECTION rather than the
  // document: a migrated plan must still project what it projected at v4. The
  // authored default is checked in the same test from the same plan, so this
  // cannot pass by the election being ignored altogether.
  it('preserves a migrated plan’s projected one-time income, and inflates an authored one', () => {
    const raw = rawV4Plan()
    ;(raw['assumptions'] as Record<string, unknown>)['inflationPct'] = 3
    const result = migratePlanToCurrent(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const project = (plan: Plan): number => {
      const run = simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
      const year = run.years.find((y) => y.year === 2040)
      if (year === undefined) throw new Error('the projection published no year 2040')
      return year.incomes.oneTime
    }

    // Migrated: taken as entered, exactly as v4 projected it.
    expect(project(result.plan)).toBe(100_000)

    // The same plan carrying the election an AUTHOR would get instead: 14 years
    // of 3% inflation, so strictly more, at the plan's own factor.
    const authored: Plan = {
      ...result.plan,
      incomes: result.plan.incomes.map((i) => (i.type === 'oneTime' ? { ...i, inflationAdjusted: true } : i)),
    }
    expect(project(authored)).toBeCloseTo(100_000 * Math.pow(1.03, 2040 - 2026), 6)
    expect(project(authored)).toBeGreaterThan(project(result.plan))
  })

  describe('stored scenarios', () => {
    const envelope = (operations: unknown[]): Record<string, unknown> => ({
      kind: 'retiregolden.scenario-patch',
      version: 1,
      base: { planId: 'plan-1', planSchemaVersion: 4, snapshotHash: 'fnv1a64:0000000000000000' },
      title: 'Income edit',
      rationale: null,
      createdAtIso: '2026-07-23T00:00:00.000Z',
      actor: { kind: 'user' },
      operations,
    })
    const v4OneTime = () => ({ type: 'oneTime', id: 'o1', label: 'Inheritance', year: 2040, amount: 100_000, taxTreatment: 'none' })
    const withScenario = (patch: unknown): Record<string, unknown> => ({
      ...rawV4Plan(),
      scenarios: [{ id: 's1', name: 'Scenario', patch }],
    })
    const patchOf = (migrated: Record<string, unknown>): Record<string, unknown> =>
      (migrated['scenarios'] as Record<string, unknown>[])[0]!['patch'] as Record<string, unknown>
    const operationOf = (migrated: Record<string, unknown>): Record<string, unknown> =>
      (patchOf(migrated)['operations'] as Record<string, unknown>[])[0]!

    it('migrates a whole-array operation on both the value and the before legs', () => {
      const raw = withScenario(
        envelope([
          {
            op: 'set',
            path: '/incomes',
            before: { present: true, value: [v4OneTime()] },
            value: [v4OneTime(), v4OneTime()],
          },
        ]),
      )
      const operation = operationOf(migratePlanV4ToV5(raw))
      for (const stream of operation['value'] as Record<string, unknown>[]) {
        expect(stream['inflationAdjusted']).toBe(false)
      }
      // `before` matters as much as `value`: it is what conflict detection
      // compares against the live plan, so a scenario whose before-image stayed
      // at v4 would read as conflicted the moment anyone opened it.
      const before = operation['before'] as Record<string, unknown>
      for (const stream of before['value'] as Record<string, unknown>[]) {
        expect(stream['inflationAdjusted']).toBe(false)
      }
    })

    it('migrates a single-index operation', () => {
      const raw = withScenario(
        envelope([{ op: 'set', path: '/incomes/2', before: { present: false }, value: v4OneTime() }]),
      )
      expect((operationOf(migratePlanV4ToV5(raw))['value'] as Record<string, unknown>)['inflationAdjusted']).toBe(false)
    })

    it('leaves a leaf pointer and a prefix-sharing root alone', () => {
      // `/incomes/2/amount` addresses a number, not a stream; `/incomeFloor`
      // merely shares its first eight characters with `/incomes`.
      const raw = withScenario(
        envelope([
          { op: 'set', path: '/incomeFloor', before: { present: false }, value: { ladders: [] } },
          { op: 'set', path: '/incomes/2/amount', before: { present: true, value: 100_000 }, value: 125_000 },
        ]),
      )
      // The plan's OWN one-time stream still migrates, so the document changes;
      // what must not change is the scenario, asserted by identity.
      const migrated = migratePlanV4ToV5(raw)
      expect(migrated['scenarios']).toBe(raw['scenarios'])
    })

    it('migrates a legacy loose deep-override patch', () => {
      const raw = withScenario({ incomes: [v4OneTime()] })
      const incomes = patchOf(migratePlanV4ToV5(raw))['incomes'] as Record<string, unknown>[]
      expect(incomes[0]!['inflationAdjusted']).toBe(false)
    })

    it('carries a migrated scenario through to an applied plan', () => {
      const raw = {
        ...rawV4Plan(),
        scenarios: [{ id: 's1', name: 'Scenario', patch: { incomes: [v4OneTime()] } }],
      }
      const result = migratePlanToCurrent(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const applied = applyScenarioPatch(result.plan, result.plan.scenarios[0]!)
      expect(applied.ok).toBe(true)
      if (!applied.ok) return
      const stream = applied.plan.incomes.find((i) => i.type === 'oneTime')!
      expect(stream.type === 'oneTime' && stream.inflationAdjusted).toBe(false)
    })
  })
})
