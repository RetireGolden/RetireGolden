import { expect, it } from 'vitest'

import type { InheritedAccount, InheritedBeneficiary } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import {
  classifyInheritedRegime,
  inheritedRequirementForYear,
  type InheritedRegimeClassification,
} from './inheritedIra.js'

const { pack } = packForYear(2026)
const provenance = { source: 'worksheet fixture', asOf: '2026-01-01' }

function beneficiary(overrides: Partial<InheritedBeneficiary> = {}): InheritedBeneficiary {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1980,
    soleBeneficiary: true,
    election: 'none',
    provenance,
    ...overrides,
  } as InheritedBeneficiary
}

function inherited(
  ownerDeathYear: number,
  facts: InheritedBeneficiary,
  decedentHadStartedRmds = false,
): InheritedAccount {
  return { ownerDeathYear, decedentHadStartedRmds, beneficiary: facts } as InheritedAccount
}

function classified(account: InheritedAccount): InheritedRegimeClassification {
  const result = classifyInheritedRegime({
    accountType: 'traditional',
    accountKind: 'ira',
    inherited: account,
  })
  if (result.kind !== 'regime') throw new Error(result.reason)
  return result
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
  'inherited-account-final-deadline-year',
  {
    example: {
      inputs: {
        ownerDeathYear: 2026,
        minorChildBirthYear: 2010,
        conventions: {
          nonEligibleDesignated: 'death year + 10',
          minorChild: 'birth year + 21 + 10',
          spouseTenYearElection: 'death year + 10',
          singleLife: 'no fixed deadline',
        },
      },
      expected: {
        nonEligibleDesignated: 2036,
        minorChild: 2041,
        minorMajorityYear: 2031,
        spouseTenYearElection: 2036,
        singleLifeHasNoDeadline: true,
        minorAtDeathPlusTenWrongReading: 2036,
        minorBirthPlusTenWrongReading: 2020,
        singleLifeDeathPlusTenWrongReading: 2036,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/inherited-account-final-deadline-year.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/inherited-account-final-deadline-year.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number | boolean>
    const deathYear = inputs.ownerDeathYear as number
    const minorBirthYear = inputs.minorChildBirthYear as number

    it('publishes death year plus ten for the non-eligible designated beneficiary', () => {
      const result = classified(inherited(deathYear, beneficiary()))
      expect(result.finalDeadlineYear).toBe(expected.nonEligibleDesignated)
    })

    it('reaches majority first for the minor child, then adds ten years', () => {
      const result = classified(
        inherited(deathYear, beneficiary({
          edbCategory: 'minor-child',
          beneficiaryBirthYear: minorBirthYear,
        })),
      )
      expect(result.minorMajorityYear).toBe(expected.minorMajorityYear)
      expect(result.finalDeadlineYear).toBe(expected.minorChild)
      // The worksheet's first two wrong readings.
      expect(result.finalDeadlineYear).not.toBe(expected.minorAtDeathPlusTenWrongReading)
      expect(result.finalDeadlineYear).not.toBe(expected.minorBirthPlusTenWrongReading)
    })

    it('publishes death year plus ten for the spouse ten-year election', () => {
      const result = classified(
        inherited(deathYear, beneficiary({
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1955,
          election: 'ten-year-election',
        })),
      )
      expect(result.finalDeadlineYear).toBe(expected.spouseTenYearElection)
    })

    it('leaves the single-life regime with no fixed deadline at all', () => {
      const result = classified(
        inherited(deathYear, beneficiary({
          edbCategory: 'not-more-than-10-years-younger',
          beneficiaryBirthYear: 1955,
        })),
      )
      expect(result.finalDeadlineYear).toBe(undefined)
      expect('finalDeadlineYear' in result).toBe(expected.singleLifeHasNoDeadline === false)
      // The worksheet's third wrong reading.
      expect(result.finalDeadlineYear).not.toBe(expected.singleLifeDeathPlusTenWrongReading)
    })
  },
)

describeCalculation(
  'inherited-distribution-required-annual',
  {
    example: {
      inputs: {
        firstYear: 2027,
        secondYear: 2028,
        priorYearEndBalance: 148_000,
        firstYearBeneficiaryDivisor: 14.8,
        secondYearBeneficiaryDivisor: 13.8,
        // Both post-RBD rows sit in the first year after the death year.
        postRbdYear: 2027,
        postRbdOwnerDeathYearAge: 86,
        postRbdOwnerDeathYearTableEntry: 7.6,
        postRbdOwnerDivisor: 6.6,
        postRbdBeneficiaryGreaterAge: 75,
        postRbdBeneficiaryGreaterDivisor: 14.8,
        postRbdOwnerGreaterBeneficiaryAge: 90,
        postRbdOwnerGreaterBeneficiaryDivisor: 5.7,
        noAnnualWindowYear: 2027,
        finalSweepYear: 2036,
        finalSweepPriorYearEndBalance: 83_000,
      },
      expected: {
        firstYearRequired: 10_000,
        secondYearRequired: 10_724.637681159421,
        postRbdBeneficiaryGreaterRequired: 10_000,
        postRbdOwnerGreaterRequired: 148_000 / 6.6,
        noAnnualWindowRequired: 0,
        finalSweepRequired: 83_000,
        liveBalanceInsteadOfPriorYearEndWrongReading: 8_108.108108108108,
        ageSeventySixRereadWrongReading: 10_496.453900709221,
        beneficiaryGreaterGreaterAmountWrongReading: 148_000 / 6.6,
        ownerGreaterGreaterAmountWrongReading: 25_964.912280701752,
        ownerTableRereadDivisorWrongReading: 5.6,
        ownerTableRereadWrongReading: 26_428.57142857143,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-required-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-required-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const DEATH_YEAR = 2026
    const balance = inputs.priorYearEndBalance!

    /**
     * An eligible designated beneficiary (disabled) whose age in the first
     * distribution year, 2027, is 75 — the worksheet's table lookup — on a
     * traditional IRA whose owner died in 2026 before the required beginning
     * date. That regime has annual life-expectancy amounts and no fixed
     * deadline, so the fixed beneficiary arm governs both stated years.
     */
    const annualArm = inherited(DEATH_YEAR, beneficiary({
      edbCategory: 'disabled',
      beneficiaryBirthYear: inputs.firstYear! - 75,
    }))

    /** The same owner death with a non-eligible designated beneficiary: a
     * ten-year window with no annual amount, and a 2036 final sweep. */
    const tenYearWindow = inherited(DEATH_YEAR, beneficiary())

    function requirement(account: InheritedAccount, year: number, priorYearEndBalance: number) {
      return inheritedRequirementForYear({
        pack,
        classification: classified(account),
        inherited: account,
        year,
        priorYearEndBalance,
      })
    }

    it('reads 14.8 once at age 75 and divides the prior-year-end balance by it', () => {
      // The divisor is the 2026 pack's age-75 Single Life entry, read from the
      // pack rather than written into the fixture.
      expect(pack.rmd.singleLifeTable[75]).toBe(inputs.firstYearBeneficiaryDivisor)
      const evidence = requirement(annualArm, inputs.firstYear!, balance)
      expect(evidence.kind).toBe('annual-rmd')
      expect(evidence.divisor).toBe(inputs.firstYearBeneficiaryDivisor)
      expect(evidence.divisorArm).toBe('beneficiary-fixed')
      expectWithin(
        evidence.requiredAmount, expected.firstYearRequired!, example.tolerance, '2027 required amount',
      )
      // The worksheet's first wrong reading: using a live balance instead of
      // the prior-December-31 base.
      expect(
        withinTolerance(
          evidence.requiredAmount,
          expected.liveBalanceInsteadOfPriorYearEndWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('continues the fixed divisor at 13.8 in 2028 rather than re-reading the table at 76', () => {
      // The age-76 entry the worksheet names as the wrong lookup.
      expect(pack.rmd.singleLifeTable[76]).toBe(14.1)
      const evidence = requirement(annualArm, inputs.secondYear!, balance)
      expect(evidence.divisor).toBe(inputs.secondYearBeneficiaryDivisor)
      expectWithin(
        evidence.requiredAmount, expected.secondYearRequired!, example.tolerance, '2028 required amount',
      )
      // The worksheet's second wrong reading.
      expect(
        withinTolerance(
          evidence.requiredAmount,
          expected.ageSeventySixRereadWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('publishes an exact zero inside the pre-RBD ten-year window', () => {
      const evidence = requirement(tenYearWindow, inputs.noAnnualWindowYear!, balance)
      expect(evidence.kind).toBe('none')
      expect(evidence.requiredAmount).toBe(expected.noAnnualWindowRequired)
    })

    it('requires the whole 83000 prior-year-end balance in the final-sweep year', () => {
      const evidence = requirement(
        tenYearWindow, inputs.finalSweepYear!, inputs.finalSweepPriorYearEndBalance!,
      )
      expect(evidence.kind).toBe('final-sweep')
      expect(evidence.requiredAmount).toBe(expected.finalSweepRequired)
    })

    /**
     * The worksheet's two post-RBD rows: a traditional IRA inherited on or
     * after the owner's required beginning date under the eligible-designated-
     * beneficiary life-expectancy regime, read in the first year after the
     * death year. The owner's fixed arm is the death-year age-86 entry 7.6,
     * already reduced by one elapsed year to 6.6; only the beneficiary's age
     * differs between the two rows.
     */
    const ownerBirthYear = DEATH_YEAR - inputs.postRbdOwnerDeathYearAge!
    function postRbdAccount(beneficiaryAgeInPostRbdYear: number): InheritedAccount {
      return inherited(
        DEATH_YEAR,
        beneficiary({
          edbCategory: 'disabled',
          beneficiaryBirthYear: inputs.postRbdYear! - beneficiaryAgeInPostRbdYear,
          ownerBirthYear,
          ownerYearOfDeathRmdSatisfied: true,
        }),
        true,
      )
    }

    it('takes the greater divisor 14.8 over the owner arm 6.6 and publishes the smaller 10000', () => {
      // The owner arm is derived from the pack rather than written in: the
      // age-86 death-year entry, less the one year elapsed to 2027.
      expect(pack.rmd.singleLifeTable[inputs.postRbdOwnerDeathYearAge!])
        .toBe(inputs.postRbdOwnerDeathYearTableEntry)
      expect(inputs.postRbdOwnerDeathYearTableEntry! - 1).toBe(inputs.postRbdOwnerDivisor)
      expect(pack.rmd.singleLifeTable[inputs.postRbdBeneficiaryGreaterAge!])
        .toBe(inputs.postRbdBeneficiaryGreaterDivisor)

      const account = postRbdAccount(inputs.postRbdBeneficiaryGreaterAge!)
      const classification = classified(account)
      expect(classification.regime).toBe('edb-life-expectancy')
      expect(classification.rbdComparison).toBe('on-or-after-rbd')

      const evidence = requirement(account, inputs.postRbdYear!, balance)
      expect(evidence.kind).toBe('annual-rmd')
      expect(evidence.divisor).toBe(inputs.postRbdBeneficiaryGreaterDivisor)
      expect(evidence.divisorArm).toBe('beneficiary-fixed')
      expectWithin(
        evidence.requiredAmount,
        expected.postRbdBeneficiaryGreaterRequired!,
        example.tolerance,
        'post-RBD beneficiary-greater-divisor required amount',
      )
      // The worksheet's wrong reading for this row: selecting the greater
      // AMOUNT would take the owner quotient 148,000 / 6.6.
      expect(
        withinTolerance(
          evidence.requiredAmount,
          expected.beneficiaryGreaterGreaterAmountWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
      expect(evidence.requiredAmount).toBeLessThan(balance / inputs.postRbdOwnerDivisor!)
    })

    it('takes the greater divisor 6.6 over the beneficiary arm 5.7 and publishes 22424.242424', () => {
      expect(pack.rmd.singleLifeTable[inputs.postRbdOwnerGreaterBeneficiaryAge!])
        .toBe(inputs.postRbdOwnerGreaterBeneficiaryDivisor)

      const account = postRbdAccount(inputs.postRbdOwnerGreaterBeneficiaryAge!)
      const classification = classified(account)
      expect(classification.regime).toBe('edb-life-expectancy')
      expect(classification.rbdComparison).toBe('on-or-after-rbd')

      const evidence = requirement(account, inputs.postRbdYear!, balance)
      expect(evidence.kind).toBe('annual-rmd')
      expect(evidence.divisor).toBe(inputs.postRbdOwnerDivisor)
      expect(evidence.divisorArm).toBe('owner-fixed')
      expectWithin(
        evidence.requiredAmount,
        expected.postRbdOwnerGreaterRequired!,
        example.tolerance,
        'post-RBD owner-greater-divisor required amount',
      )
      // The worksheet's wrong reading for this row: choosing an arm by amount
      // would take the beneficiary quotient 148,000 / 5.7.
      expect(
        withinTolerance(
          evidence.requiredAmount,
          expected.ownerGreaterGreaterAmountWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
      // The worksheet's owner table re-read: 6.6 is also the age-88 entry, so
      // re-reading the table at a current age and then subtracting elapsed
      // years would double-advance the fixed arm to 5.6.
      expect(pack.rmd.singleLifeTable[88]).toBe(inputs.postRbdOwnerDivisor)
      expect(evidence.divisor).not.toBe(expected.ownerTableRereadDivisorWrongReading)
      expect(
        withinTolerance(
          evidence.requiredAmount,
          expected.ownerTableRereadWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })
  },
)
