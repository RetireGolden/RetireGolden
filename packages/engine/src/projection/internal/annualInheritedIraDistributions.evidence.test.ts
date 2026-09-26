import { expect, it } from 'vitest'

import type { Account, InheritedAccount, InheritedBeneficiary } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { classifyInheritedRegime } from '../../strategies/inheritedIra.js'
import {
  annualInheritedIraDistributions,
  type AnnualInheritedIraClassCacheEntry,
} from './annualInheritedIraDistributions.js'

const { pack } = packForYear(2026)
const provenance = { source: 'worksheet fixture', asOf: '2026-01-01' }

function beneficiary(overrides: Partial<InheritedBeneficiary> = {}): InheritedBeneficiary {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1981,
    soleBeneficiary: true,
    election: 'none',
    provenance,
    ...overrides,
  } as InheritedBeneficiary
}

function inheritedFacts(
  ownerDeathYear: number,
  facts: InheritedBeneficiary,
  decedentHadStartedRmds = false,
): InheritedAccount {
  return {
    ownerDeathYear,
    decedentHadStartedRmds,
    beneficiary: facts,
    decedentId: 'decedent',
  } as InheritedAccount
}

function inheritedAccount(
  id: string,
  type: 'traditional' | 'roth',
  facts: InheritedAccount,
): Extract<Account, { type: 'traditional' | 'roth' }> {
  return {
    type,
    id,
    name: id,
    ownerPersonId: 'beneficiary',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
    inherited: facts,
  } as Extract<Account, { type: 'traditional' | 'roth' }>
}

function classEntry(
  account: Extract<Account, { type: 'traditional' | 'roth' }>,
): AnnualInheritedIraClassCacheEntry {
  if (account.inherited === undefined) throw new Error('expected inherited account')
  const primary = classifyInheritedRegime({
    accountType: account.type,
    accountKind: account.kind,
    inherited: account.inherited,
  })
  if (primary.kind !== 'regime') throw new Error(primary.reason)
  return {
    accountId: account.id,
    accountType: account.type,
    ownerPersonId: account.ownerPersonId ?? 'beneficiary',
    path: 'classified',
    primary,
    schedule: primary,
    isS2: false,
  }
}

function runPhase(input: {
  year: number
  rows: readonly {
    account: Extract<Account, { type: 'traditional' | 'roth' }>
    balance: number
    startOfYear: number
  }[]
  characterizeInheritedRothDistribution?: Parameters<
    typeof annualInheritedIraDistributions
  >[0]['characterizeInheritedRothDistribution']
}) {
  return annualInheritedIraDistributions({
    year: input.year,
    startYear: input.year,
    pack,
    primaryPersonId: 'beneficiary',
    balances: input.rows.map((row) => ({ account: row.account, balance: row.balance })),
    startOfYearBalance: new Map(input.rows.map((row) => [row.account.id, row.startOfYear])),
    classCache: new Map(input.rows.map((row) => [row.account.id, classEntry(row.account)])),
    beneficiaryState: () => ({ alive: true, ageAttained: input.year - 1981 }),
    ...(input.characterizeInheritedRothDistribution === undefined
      ? {}
      : { characterizeInheritedRothDistribution: input.characterizeInheritedRothDistribution }),
  })
}

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'inherited-distribution-required-executed-annual',
  {
    example: {
      inputs: {
        ordinarySufficient: { required: 8_000, liveBalance: 20_000, status: 'annual RMD' },
        ordinaryInsufficient: { required: 8_000, liveBalance: 5_000, status: 'annual RMD' },
        finalSweep: { required: 83_000, liveBalance: 61_000, status: 'final sweep' },
        noAnnualRequirement: { required: 0, liveBalance: 20_000, status: 'none' },
        noticeWaived: { required: 8_000, liveBalance: 20_000, status: 'notice waived' },
      },
      expected: {
        ordinarySufficientExecuted: 8_000,
        ordinaryInsufficientExecuted: 5_000,
        finalSweepExecuted: 61_000,
        noAnnualRequirementExecuted: 0,
        noticeWaivedExecuted: 0,
        uncappedOrdinaryWrongReading: 8_000,
        sweepEvidenceAsCashWrongReading: 83_000,
        forcedNoticeWaivedWrongReading: 8_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-required-executed-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-required-executed-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number | string>>
    const expected = example.expected as Record<string, number>

    /**
     * An 8,000 annual requirement realized exactly: an eligible designated
     * beneficiary (disabled) aged 46 in the 2027 first distribution year reads
     * a 40.0 Single Life divisor, so a 320,000 prior-December-31 balance
     * divides to exactly the worksheet's whole dollar.
     */
    const annualArmFacts = inheritedFacts(
      2026, beneficiary({ edbCategory: 'disabled', beneficiaryBirthYear: 1981 }),
    )
    const ANNUAL_PRIOR_YEAR_END = 320_000

    /** A non-eligible designated beneficiary: no annual amount inside the
     * window, a full-balance sweep at deathYear + 10. */
    const tenYearFacts = inheritedFacts(2026, beneficiary())

    it('caps an ordinary requirement at the live balance and never above it', () => {
      const sufficient = runPhase({
        year: 2027,
        rows: [{
          account: inheritedAccount('sufficient', 'traditional', annualArmFacts),
          balance: inputs.ordinarySufficient!.liveBalance as number,
          startOfYear: ANNUAL_PRIOR_YEAR_END,
        }],
      })
      const sufficientRow = sufficient.rows[0]!
      expect(sufficientRow.evidence.requiredAmount).toBe(inputs.ordinarySufficient!.required)
      expect(sufficientRow.evidence.executedRequiredAmount).toBe(expected.ordinarySufficientExecuted)

      const insufficient = runPhase({
        year: 2027,
        rows: [{
          account: inheritedAccount('insufficient', 'traditional', annualArmFacts),
          balance: inputs.ordinaryInsufficient!.liveBalance as number,
          startOfYear: ANNUAL_PRIOR_YEAR_END,
        }],
      })
      const insufficientRow = insufficient.rows[0]!
      // The requirement evidence keeps its legal-year amount; only the cash is capped.
      expect(insufficientRow.evidence.requiredAmount).toBe(inputs.ordinaryInsufficient!.required)
      expect(insufficientRow.evidence.executedRequiredAmount).toBe(expected.ordinaryInsufficientExecuted)
      // The worksheet's first wrong reading: executing the uncapped requirement.
      expect(insufficientRow.evidence.executedRequiredAmount).not.toBe(expected.uncappedOrdinaryWrongReading)
      expect(insufficientRow.distribution?.sourceBalanceAfter).toBe(0)
    })

    it('sweeps the 61000 live balance rather than the 83000 requirement evidence', () => {
      const result = runPhase({
        year: 2036,
        rows: [{
          account: inheritedAccount('sweep', 'traditional', tenYearFacts),
          balance: inputs.finalSweep!.liveBalance as number,
          startOfYear: inputs.finalSweep!.required as number,
        }],
      })
      const row = result.rows[0]!
      expect(row.evidence.requirementKind).toBe('final-sweep')
      expect(row.evidence.requiredAmount).toBe(inputs.finalSweep!.required)
      expect(row.evidence.executedRequiredAmount).toBe(expected.finalSweepExecuted)
      // The worksheet's second wrong reading: taking the evidence as cash.
      expect(row.evidence.executedRequiredAmount).not.toBe(expected.sweepEvidenceAsCashWrongReading)
    })

    it('forces nothing when the requirement is none, and nothing when it is notice-waived', () => {
      const none = runPhase({
        year: 2027,
        rows: [{
          account: inheritedAccount('none', 'traditional', tenYearFacts),
          balance: inputs.noAnnualRequirement!.liveBalance as number,
          startOfYear: ANNUAL_PRIOR_YEAR_END,
        }],
      })
      expect(none.rows[0]!.evidence.requirementKind).toBe('none')
      expect(none.rows[0]!.evidence.requiredAmount).toBe(inputs.noAnnualRequirement!.required)
      expect(none.rows[0]!.evidence.executedRequiredAmount).toBe(expected.noAnnualRequirementExecuted)
      expect(none.rows[0]!.distribution).toBe(null)

      // A post-RBD ten-year row for a 2022 death, in relief year 2024: the
      // 312,000 prior-year-end balance over the 39.0 continuation divisor is
      // again exactly the worksheet's 8,000 requirement.
      const waivedFacts = inheritedFacts(
        2022,
        beneficiary({ beneficiaryBirthYear: 1977, ownerBirthYear: 1940, ownerYearOfDeathRmdSatisfied: true }),
        true,
      )
      const waived = runPhase({
        year: 2024,
        rows: [{
          account: inheritedAccount('waived', 'traditional', waivedFacts),
          balance: inputs.noticeWaived!.liveBalance as number,
          startOfYear: 312_000,
        }],
      })
      const waivedRow = waived.rows[0]!
      expect(waivedRow.evidence.noticeWaived).toBe(true)
      expect(waivedRow.evidence.requiredAmount).toBe(inputs.noticeWaived!.required)
      expect(waivedRow.evidence.executedRequiredAmount).toBe(expected.noticeWaivedExecuted)
      // The worksheet's third wrong reading: forcing the waived amount.
      expect(waivedRow.evidence.executedRequiredAmount).not.toBe(expected.forcedNoticeWaivedWrongReading)
    })
  },
)

describeCalculation(
  'inherited-distribution-forced-annual',
  {
    example: {
      inputs: {
        traditionalAnnualRmd: { executedRequired: 8_000, voluntary: 4_000, rothTaxableSlice: 0 },
        rothFinalSweep: { executedRequired: 3_000, voluntary: 0, rothTaxableSlice: 600 },
        traditionalNoRequirement: { executedRequired: 0, voluntary: 2_000, rothTaxableSlice: 0 },
      },
      expected: {
        inheritedDistribution: 11_000,
        inheritedTraditionalDistribution: 8_600,
        rothGrossForced: 3_000,
        rothTaxableSlice: 600,
        voluntaryExcluded: 6_000,
        addingVoluntaryWrongReading: 17_000,
        excludingRothSweepWrongReading: 8_000,
        addingSliceAgainWrongReading: 11_600,
        traditionalCommentOnlyWrongReading: 8_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/rmd/inherited-distribution-forced-annual.md',
    mutation: 'DOCS/calculations/rmd/inherited-distribution-forced-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number>>
    const expected = example.expected as Record<string, number>
    const YEAR = 2036

    it('sums 11000 of forced cash and carries the 600 Roth slice into the traditional share', () => {
      /*
       * Three real rows in one 2036 year. The traditional annual arm is an
       * eligible designated beneficiary (disabled) whose fixed divisor has
       * declined from 40.0 to 31.0 by 2036, so a 248,000 prior-December-31
       * balance is exactly an 8,000 requirement against a 20,000 live balance.
       * The inherited Roth reaches its deathYear + 10 sweep in 2036 and empties
       * its 3,000 live balance, with the characterization hook returning the
       * worksheet's 600 of ordinary income. The third row is a separate
       * non-eligible designated beneficiary whose owner died in 2030, still
       * inside its ten-year window and so carrying no annual requirement.
       */
      const result = runPhase({
        year: YEAR,
        rows: [
          {
            account: inheritedAccount(
              'traditional-annual', 'traditional',
              inheritedFacts(2026, beneficiary({ edbCategory: 'disabled', beneficiaryBirthYear: 1981 })),
            ),
            balance: 20_000,
            startOfYear: 248_000,
          },
          {
            account: inheritedAccount(
              'roth-sweep', 'roth',
              inheritedFacts(2026, beneficiary({ beneficiaryBirthYear: 1981, roth5YearStartYear: 2010 })),
            ),
            balance: inputs.rothFinalSweep!.executedRequired!,
            startOfYear: inputs.rothFinalSweep!.executedRequired!,
          },
          {
            account: inheritedAccount(
              'traditional-none', 'traditional',
              inheritedFacts(2030, beneficiary({ beneficiaryBirthYear: 1981 })),
            ),
            balance: 20_000,
            startOfYear: 20_000,
          },
        ],
        characterizeInheritedRothDistribution: () => ({
          ordinaryIncome: inputs.rothFinalSweep!.rothTaxableSlice!,
          status: 'characterized',
        }),
      })

      const byId = new Map(result.rows.map((row) => [row.accountId, row]))
      // Each row really executes the worksheet's amount.
      expect(byId.get('traditional-annual')!.evidence.executedRequiredAmount)
        .toBe(inputs.traditionalAnnualRmd!.executedRequired)
      expect(byId.get('roth-sweep')!.evidence.executedRequiredAmount)
        .toBe(inputs.rothFinalSweep!.executedRequired)
      expect(byId.get('traditional-none')!.evidence.executedRequiredAmount)
        .toBe(inputs.traditionalNoRequirement!.executedRequired)

      // The gross forced total, which is what YearResult.inheritedDistribution publishes.
      expect(result.totals.inherited).toBe(expected.inheritedDistribution)
      // The ordinary income from inherited accounts, the meaning decision
      // D-INHERITED-ROTH-SLICE settled on.
      expect(result.totals.ordinaryIncome).toBe(expected.inheritedTraditionalDistribution)
      // How that figure is composed, kept separately.
      expect(result.totals.rothForced).toBe(expected.rothGrossForced)
      expect(result.rothTaxCharacterOperations[0]?.ordinaryIncome).toBe(expected.rothTaxableSlice)
      expect(result.rothTaxCharacterStatus).toBe('complete')

      // Voluntary amounts are not this phase's business and contribute nothing.
      for (const row of result.rows) expect(row.evidence.voluntaryAmount).toBe(0)

      // The worksheet's four wrong readings.
      expect(result.totals.inherited).not.toBe(expected.addingVoluntaryWrongReading)
      expect(result.totals.inherited).not.toBe(expected.excludingRothSweepWrongReading)
      expect(result.totals.inherited).not.toBe(expected.addingSliceAgainWrongReading)
      expect(result.totals.ordinaryIncome).not.toBe(expected.traditionalCommentOnlyWrongReading)
      expectWithin(
        inputs.traditionalAnnualRmd!.voluntary! + inputs.traditionalNoRequirement!.voluntary!,
        expected.voluntaryExcluded!,
        example.tolerance,
        'voluntary amounts excluded from the forced total',
      )
    })
  },
)
