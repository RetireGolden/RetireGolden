/**
 * The colocated guard for the pre-pass cash-flow capture buffer.
 *
 * Two things are asserted here. The recorders' non-positive skip rules, which
 * are characterization of documented behaviour. And the seal, which is new: the
 * "record only before the pass" rule used to live in this module's header
 * comment and nowhere else, so a `record*` that a future extraction moved
 * inside the annual pass would have appended once per T0 / staging / settlement
 * re-entry and failed the reconciliation identity far from its cause.
 *
 * The case table is keyed by a type derived from `AnnualCashFlowYearSites`, so
 * a nineteenth-plus recorder added without a case here is a compile error.
 */
import { describe, expect, it } from 'vitest'

import {
  AnnualCashFlowYearSitesSealedError,
  createAnnualCashFlowYearSites,
  type AnnualCashFlowYearSites,
} from './annualCashFlowYearSites.js'

type RecorderName = Extract<keyof AnnualCashFlowYearSites, `record${string}`>

interface RecorderCase<Name extends RecorderName> {
  /** A row the recorder keeps. */
  readonly kept: Parameters<AnnualCashFlowYearSites[Name]>[0]
  /** A row the recorder drops, per its documented non-positive skip. */
  readonly skipped: Parameters<AnnualCashFlowYearSites[Name]>[0]
  /** Where a kept row lands. */
  readonly bucket: (sites: AnnualCashFlowYearSites) => readonly unknown[]
}

const CASES: { [Name in RecorderName]: RecorderCase<Name> } = {
  recordWages: {
    kept: { incomeStreamId: 'wage', personId: 'p1', amount: 1 },
    skipped: { incomeStreamId: 'wage', personId: 'p1', amount: 0 },
    bucket: (sites) => sites.wages,
  },
  recordRecurringIncome: {
    kept: { incomeStreamId: 'rec', amount: 1, taxTreatment: 'ordinary' },
    skipped: { incomeStreamId: 'rec', amount: 0, taxTreatment: 'ordinary' },
    bucket: (sites) => sites.recurring,
  },
  recordOneTimeIncome: {
    kept: { incomeStreamId: 'one', amount: 1, taxTreatment: 'capitalGain' },
    skipped: { incomeStreamId: 'one', amount: 0, taxTreatment: 'capitalGain' },
    bucket: (sites) => sites.oneTime,
  },
  recordPension: {
    kept: { accountId: 'pen', payeePersonId: 'p1', amount: 1, source: 'private' },
    skipped: { accountId: 'pen', payeePersonId: 'p1', amount: 0, source: 'private' },
    bucket: (sites) => sites.pensions,
  },
  recordAnnuityPayment: {
    kept: {
      accountId: 'ann',
      recipientPersonId: 'p1',
      paid: 1,
      nonqualifiedExcludable: 0,
      qualifiedIraFunded: false,
      fundingOwnerPersonId: null,
    },
    skipped: {
      accountId: 'ann',
      recipientPersonId: 'p1',
      paid: 0,
      nonqualifiedExcludable: 0,
      qualifiedIraFunded: false,
      fundingOwnerPersonId: null,
    },
    bucket: (sites) => sites.annuityPayments,
  },
  recordTipsLadderCash: {
    // Accretion-only, zero cash: kept on purpose, so a later stage can emit
    // phantom-OID metadata without a second walk of the ladder.
    kept: { ladderId: 'l', cash: 0, coupons: 0, maturingPrincipal: 0, accretion: 5 },
    skipped: { ladderId: 'l', cash: 0, coupons: 0, maturingPrincipal: 0, accretion: 0 },
    bucket: (sites) => sites.tipsLadderCash,
  },
  recordDistributedYield: {
    kept: {
      accountId: 'a',
      taxableGross: 0,
      interest: 0,
      ordinaryDividends: 0,
      qualified: 0,
      exempt: 3,
      reinvest: false,
    },
    skipped: {
      accountId: 'a',
      taxableGross: 0,
      interest: 0,
      ordinaryDividends: 0,
      qualified: 0,
      exempt: 0,
      reinvest: false,
    },
    bucket: (sites) => sites.distributedYield,
  },
  recordPropertySaleProceeds: {
    // A HECM payoff can consume every cash dollar while gain character is
    // still nonzero; the row survives so metadata can still be emitted.
    kept: {
      propertyAccountId: 'prop',
      netProceedsAfterHecm: 0,
      ordinaryGain: 0,
      capitalGain: 7,
    },
    skipped: {
      propertyAccountId: 'prop',
      netProceedsAfterHecm: 0,
      ordinaryGain: 0,
      capitalGain: 0,
    },
    bucket: (sites) => sites.propertySales,
  },
  recordGoalOutcome: {
    kept: {
      goalId: 'g',
      classification: 'required',
      outcome: 'funded',
      requested: 1,
      fundedNominal: 1,
    },
    skipped: {
      goalId: 'g',
      classification: 'required',
      outcome: 'skipped',
      requested: 0,
      fundedNominal: 0,
    },
    bucket: (sites) => sites.goals,
  },
  recordDebtService: {
    kept: { accountId: 'debt', ownerPersonId: null, amount: 1 },
    skipped: { accountId: 'debt', ownerPersonId: null, amount: 0 },
    bucket: (sites) => sites.debtService,
  },
  recordPropertyCosts: {
    kept: { accountId: 'prop', ownerPersonId: 'p1', amount: 1 },
    skipped: { accountId: 'prop', ownerPersonId: 'p1', amount: 0 },
    bucket: (sites) => sites.propertyCosts,
  },
  recordInsurancePremium: {
    kept: { policyId: 'pol', subjectPersonId: 'p1', amount: 1 },
    skipped: { policyId: 'pol', subjectPersonId: 'p1', amount: 0 },
    bucket: (sites) => sites.insurancePremiums,
  },
  recordLongTermCare: {
    kept: {
      personId: 'p1',
      careEventIds: ['e1'],
      payingPolicyIds: [],
      gross: 10,
      benefit: 10,
      net: 0,
    },
    skipped: {
      personId: 'p1',
      careEventIds: [],
      payingPolicyIds: [],
      gross: 0,
      benefit: 0,
      net: 0,
    },
    bucket: (sites) => sites.longTermCare,
  },
  recordContribution: {
    // Post-routing requested > 0 with credited 0 is a real unfunded use.
    kept: { destinationAccountId: 'd', ownerPersonId: null, requested: 1, credited: 0 },
    skipped: { destinationAccountId: 'd', ownerPersonId: null, requested: 0, credited: 0 },
    bucket: (sites) => sites.contributions,
  },
  recordEmployerMatch: {
    kept: { destinationAccountId: 'd', ownerPersonId: null, amount: 1 },
    skipped: { destinationAccountId: 'd', ownerPersonId: null, amount: 0 },
    bucket: (sites) => sites.employerMatch,
  },
  recordAnnuityPurchase: {
    kept: { fundingAccountId: 'f', annuityAccountId: 'a', funded: 0, capitalGainOrLoss: -3 },
    skipped: { fundingAccountId: 'f', annuityAccountId: 'a', funded: 0, capitalGainOrLoss: 0 },
    bucket: (sites) => sites.annuityPurchases,
  },
  recordTipsLadderPurchase: {
    kept: { fundingAccountId: 'f', ladderId: 'l', funded: 1, capitalGainOrLoss: 0 },
    skipped: { fundingAccountId: 'f', ladderId: 'l', funded: 0, capitalGainOrLoss: 0 },
    bucket: (sites) => sites.tipsPurchases,
  },
  recordPensionRollover: {
    kept: {
      pensionAccountId: 'pen',
      destinationAccountId: 'd',
      ownerPersonId: null,
      amount: 1,
    },
    skipped: {
      pensionAccountId: 'pen',
      destinationAccountId: 'd',
      ownerPersonId: null,
      amount: 0,
    },
    bucket: (sites) => sites.pensionRollovers,
  },
  recordRebalancingGain: {
    // Realized losses are negative; only a true zero is omitted.
    kept: { accountId: 'a', realizedCapitalGainOrLoss: -1 },
    skipped: { accountId: 'a', realizedCapitalGainOrLoss: 0 },
    bucket: (sites) => sites.rebalancingGains,
  },
}

const RECORDER_NAMES = Object.keys(CASES) as RecorderName[]

function record(
  sites: AnnualCashFlowYearSites,
  name: RecorderName,
  row: unknown,
): void {
  // One dispatch site for a table whose per-key row types are already checked
  // by `RecorderCase`; the union of nineteen distinct parameter types cannot be
  // called directly.
  ;(sites[name] as (value: unknown) => void).call(sites, row)
}

describe('annual cash-flow year sites', () => {
  it('covers every recorder on the interface', () => {
    expect(RECORDER_NAMES).toHaveLength(19)
  })

  it('keeps a recordable row and drops the documented non-recordable one', () => {
    for (const name of RECORDER_NAMES) {
      const sites = createAnnualCashFlowYearSites()
      const testCase = CASES[name]

      record(sites, name, testCase.skipped)
      expect(testCase.bucket(sites), `${name} kept a skippable row`).toEqual([])

      record(sites, name, testCase.kept)
      expect(testCase.bucket(sites), `${name} dropped a recordable row`)
        .toEqual([testCase.kept])
    }
  })

  it('appends rather than replacing, and hands back the row object itself', () => {
    const sites = createAnnualCashFlowYearSites()
    const first = { incomeStreamId: 'a', personId: 'p1', amount: 1 }
    const second = { incomeStreamId: 'b', personId: 'p1', amount: 2 }

    sites.recordWages(first)
    sites.recordWages(second)

    expect(sites.wages).toHaveLength(2)
    expect(sites.wages[0]).toBe(first)
    expect(sites.wages[1]).toBe(second)
  })

  it('starts empty on every bucket', () => {
    const sites = createAnnualCashFlowYearSites()
    for (const name of RECORDER_NAMES) {
      expect(CASES[name].bucket(sites), name).toEqual([])
    }
  })

  it('refuses every recorder once sealed, naming the site', () => {
    for (const name of RECORDER_NAMES) {
      const sites = createAnnualCashFlowYearSites()
      sites.seal()

      expect(() => { record(sites, name, CASES[name].kept) })
        .toThrow(AnnualCashFlowYearSitesSealedError)
      expect(() => { record(sites, name, CASES[name].kept) })
        .toThrow(new RegExp(name))
    }
  })

  it('refuses a skippable row after sealing too', () => {
    // The guard runs ahead of the non-positive skip on purpose: a zero-amount
    // call from inside the pass is the same misplacement as a funded one, and
    // a guard behind the skip would hold only by luck of the amount.
    const sites = createAnnualCashFlowYearSites()
    sites.seal()

    expect(() => { sites.recordWages({ incomeStreamId: 'w', personId: 'p1', amount: 0 }) })
      .toThrow(AnnualCashFlowYearSitesSealedError)
  })

  it('keeps everything already recorded readable after sealing', () => {
    const sites = createAnnualCashFlowYearSites()
    for (const name of RECORDER_NAMES) record(sites, name, CASES[name].kept)

    sites.seal()

    for (const name of RECORDER_NAMES) {
      expect(CASES[name].bucket(sites), name).toEqual([CASES[name].kept])
    }
  })

  it('is idempotent, so a second seal is not an error', () => {
    const sites = createAnnualCashFlowYearSites()
    sites.seal()
    expect(() => { sites.seal() }).not.toThrow()
  })

  it('seals one buffer without touching another year\'s', () => {
    const sealed = createAnnualCashFlowYearSites()
    const open = createAnnualCashFlowYearSites()

    sealed.seal()

    expect(() => { open.recordWages({ incomeStreamId: 'w', personId: 'p1', amount: 1 }) })
      .not.toThrow()
    expect(open.wages).toHaveLength(1)
    expect(sealed.wages).toEqual([])
  })
})
