import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import {
  computeRmdShortfallExcise,
  RMD_SHORTFALL_DEFAULT_RATE,
  type RmdShortfallObligation,
} from '../../rmd/rmdShortfallExcise.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import { simulatePlan } from '../simulate.js'
import { annualFundingWithdrawalEffects } from './annualFundingWithdrawalEffects.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
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
  'tax-penalties-annual',
  {
    example: {
      inputs: {
        preFiftyNineAndAHalfTaxableTraditionalWithdrawal: 20_000,
        earlyWithdrawalPenaltyRatePct: 10,
        rmdRequiredAmount: 12_000,
        distributedByDeadline: 4_000,
        section4974DefaultRatePct: 25,
        reliefElection: 'none',
      },
      expected: {
        earlyWithdrawalPenalty: 2_000,
        rmdShortfall: 8_000,
        section4974Excise: 2_000,
        penalties: 4_000,
        exciseOnWholeRequirementWrongReading: 3_000,
        exciseOnWholeRequirementTotalWrongReading: 5_000,
        correctedRateExciseWrongReading: 800,
        correctedRateTotalWrongReading: 2_800,
        earlyComponentOmittedWrongReading: 2_000,
        inheritedEarlyPenalty: 0,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/tax-penalties-annual.md',
    mutation: 'DOCS/calculations/taxes/tax-penalties-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number>
    const YEAR = 2026
    const withdrawal = inputs.preFiftyNineAndAHalfTaxableTraditionalWithdrawal as number

    function traditionalAccountRow(id: string, inherited: boolean): Account {
      return {
        type: 'traditional',
        id,
        name: id,
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 500_000,
        annualContribution: 0,
        ...(inherited
          ? {
              inherited: {
                ownerDeathYear: 2021,
                decedentHadStartedRmds: false,
                beneficiary: {
                  beneficiaryClass: 'designated-individual',
                  edbCategory: 'none',
                  beneficiaryBirthYear: 1976,
                  soleBeneficiary: true,
                  election: 'none',
                  provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
                },
              },
            }
          : {}),
      } as unknown as Account
    }

    function withdrawalEffects(id: string, inherited: boolean) {
      return annualFundingWithdrawalEffects({
        accounts: [{
          kind: 'traditional',
          sourceAccountId: id,
          account: traditionalAccountRow(id, inherited) as Extract<Account, { type: 'traditional' }>,
          ownerAgeAttained: 50,
          ownerRetirementAge: null,
          treatAsOwnEffective: false,
        }],
        withdrawalsByAccountId: new Map([[id, withdrawal]]),
        traditionalTaxableByAccountId: new Map([[id, withdrawal]]),
        rothBasisByPool: new Map(),
        year: YEAR,
        hsaQualifiedCap: 0,
      })
    }

    const obligation: RmdShortfallObligation = {
      obligationId: 'owned-iras:p1:2026',
      distributionCalendarYear: YEAR,
      taxYear: YEAR,
      taxImposedOn: `${YEAR}-12-31`,
      applicablePlan: { kind: 'ownedTraditionalIras', payeePersonId: 'p1' },
      requirementKind: 'ownedAnnual',
      requiredAmount: inputs.rmdRequiredAmount as number,
      distributedByDeadline: inputs.distributedByDeadline as number,
    }

    it('charges 10 percent of the 20000 pre-59-and-a-half taxable traditional withdrawal', () => {
      const effects = withdrawalEffects('owned', false)
      expect(effects.penaltyExcludingRmdShortfallExcise).toBe(expected.earlyWithdrawalPenalty)
      expect(effects.traditional.penalty).toBe(expected.earlyWithdrawalPenalty)
      expect(effects.traditional.rows[0]?.sourceAccountId).toBe('owned')
    })

    it('charges nothing on an inherited distribution, which is never subject to the early penalty', () => {
      // The worksheet's fourth wrong reading, stated as a rule.
      const effects = withdrawalEffects('inherited', true)
      expect(effects.penaltyExcludingRmdShortfallExcise).toBe(expected.inheritedEarlyPenalty)
      expect(effects.traditional.rows).toEqual([])
    })

    it('prices the 8000 shortfall at the default 25 percent into a 2000 excise', () => {
      // The default rate is read from production rather than written in.
      expect(RMD_SHORTFALL_DEFAULT_RATE * 100).toBe(inputs.section4974DefaultRatePct)
      const result = computeRmdShortfallExcise(obligation)
      expect(result.shortfall).toBe(expected.rmdShortfall)
      expect(result.tax).toBe(expected.section4974Excise)
      expect(result.reason).toBe('default25Percent')
      // The worksheet's first two wrong readings.
      expect(result.tax).not.toBe(expected.exciseOnWholeRequirementWrongReading)
      expect(result.tax).not.toBe(expected.correctedRateExciseWrongReading)
    })

    it('publishes 4000 of penalties on a real 2026 ledger row carrying both channels', () => {
      /*
       * A 50-year-old whose only portfolio is a traditional IRA, with a
       * zero-rate test calculator so tax is 0 and the whole need is spending
       * plus penalties. The 16,000 of required lifestyle and the 2,000 excise
       * close the 10-percent relation W = 16,000 + 2,000 + 0.10 W at exactly
       * the worksheet's 20,000 withdrawal. The excise itself comes from an
       * inherited Roth whose completed five-year deadline observation records
       * the worksheet's 12,000 required against 4,000 distributed by the 2026
       * deadline; that obligation is priced from observed legal-year facts and
       * replays no cash, so it adds a penalty without adding a distribution.
       */
      const plan = singlePersonPlan({ dob: `${YEAR - 50}-06-15`, planningAge: 95 })
      plan.accounts = [
        traditionalAccountRow('owned-ira', false),
        {
          type: 'roth', id: 'inherited-roth', name: 'Inherited Roth', ownerPersonId: 'p1',
          annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0,
          inherited: {
            ownerDeathYear: 2021,
            ownerDeathDate: '2021-03-01',
            decedentHadStartedRmds: false,
            beneficiary: {
              beneficiaryClass: 'estate',
              soleBeneficiary: true,
              provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
            },
            verifiedNonDesignatedRegime: {
              classification: 'non-designated-beneficiary',
              schedule: 'five-year',
              provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
            },
            completedDeadlineObservation: {
              taxYear: YEAR,
              openingBenefit: inputs.rmdRequiredAmount as number,
              distributedByDeadline: inputs.distributedByDeadline as number,
              legalDistributionDeadline: `${YEAR}-12-31`,
              observedAsOfDate: `${YEAR + 1}-01-15`,
              provenance: { source: 'worksheet fixture', asOf: `${YEAR + 1}-02-01` },
            },
          },
        } as unknown as Account,
      ]
      plan.expenses.baseAnnual = 16_000

      const result = simulatePlan(validated(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFlatTaxCalculator(0),
      })
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      // The constructed year really carries both channels at the worksheet's
      // amounts: a 20,000 traditional withdrawal and a 2,000 IRC 4974 excise.
      // The two component calls above are exact, as the worksheet says; this
      // ledger cross-check is judged at the engine's own annual funding
      // tolerance, because the withdrawal is the root of a solved fixed point
      // and converges to 20,000 within that bound rather than landing on it.
      const solverTolerance = { abs: ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS }
      expectWithin(row.withdrawals.traditional, withdrawal, solverTolerance, 'traditional withdrawal')
      expect(row.rmdShortfallExciseTax).toBe(expected.section4974Excise)
      expect(row.tax).toBe(0)
      expectWithin(row.penalties, expected.penalties!, solverTolerance, 'penalties')

      // The worksheet's wrong readings, on the published composition.
      for (const wrong of [
        expected.exciseOnWholeRequirementTotalWrongReading!,
        expected.correctedRateTotalWrongReading!,
        expected.earlyComponentOmittedWrongReading!,
      ]) {
        expect(withinTolerance(row.penalties, wrong, solverTolerance)).toBe(false)
      }
      // Penalties stay out of tax.
      expect(row.tax).not.toBe(expected.penalties)
    })
  },
)
