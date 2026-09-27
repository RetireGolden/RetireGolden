import { expect, it } from 'vitest'

import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../rules/describeCalculation.js'
import { fraTotalMonths, survivorFraForBirthYear } from './nra.js'
import {
  SURVIVOR_EARLIEST_AGE,
  SURVIVOR_MAX_REDUCTION,
  WIDOW_LIMIT_PIA_FRACTION,
  survivorBenefitMonthly,
  survivorReductionFactor,
} from './survivorBenefit.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-benefit-rib-lim.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-benefit-rib-lim.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'survivor-benefit-rib-lim',
  {
    example: {
      inputs: {
        caseA: { deceasedPia: 2_400, deceasedActual: 1_680, everReduced: true, survivorAgeMonths: 744, survivorBirthYear: 1964 },
        caseB: { deceasedPia: 2_000, deceasedActual: 1_400, everReduced: true, survivorAgeMonths: 756, survivorFraMonths: 792 },
        caseC: { deceasedPia: 2_000, deceasedActual: 1_400, everReduced: true, survivorAgeMonths: 720, survivorFraMonths: 800 },
        caseD: { deceasedPia: 2_000, deceasedActual: 2_480, everReduced: false, survivorAgeMonths: 756, survivorFraMonths: 792 },
        widowLimitFraction: 0.825,
        maxReduction: 0.285,
      },
      expected: {
        caseA62: after('A, survivor at 62'),
        caseAFra: after('A, survivor at FRA'),
        caseB: after('B'),
        caseC: after('C'),
        caseD: after('D'),
        beforeA62: before('A, survivor at 62'),
        beforeB: before('B'),
        beforeC: before('C'),
        factorAt62: 0.796428571428571,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    type Case = { deceasedPia: number; deceasedActual: number; everReduced: boolean; survivorAgeMonths: number; survivorFraMonths?: number; survivorBirthYear?: number }
    const inputs = example.inputs as Record<string, Case> & { widowLimitFraction: number; maxReduction: number }
    const expected = example.expected as Record<string, number>
    const monthly = (c: Case, fraMonths: number, ageMonths = c.survivorAgeMonths): number =>
      survivorBenefitMonthly({
        deceasedPiaMonthly: c.deceasedPia,
        deceasedActualMonthly: c.deceasedActual,
        deceasedEverReduced: c.everReduced,
        survivorClaimAge: { years: Math.floor(ageMonths / 12), months: ageMonths % 12 },
        survivorFraMonths: fraMonths,
      })

    it('case A: reduces for age first, and the limit does not bind at 62 (1,911.43, not 1,576.93)', () => {
      expect(WIDOW_LIMIT_PIA_FRACTION).toBe(inputs.widowLimitFraction)
      expect(SURVIVOR_MAX_REDUCTION).toBe(inputs.maxReduction)
      expect(SURVIVOR_EARLIEST_AGE).toBe(60)
      // The survivor FRA for a 1964 birth is 67, read from the production table.
      const fra = fraTotalMonths(survivorFraForBirthYear(inputs.caseA!.survivorBirthYear!))
      expect(fra).toBe(804)
      expectWithin(survivorReductionFactor(inputs.caseA!.survivorAgeMonths, fra), expected.factorAt62!, { abs: 1e-12 }, 'factorAt62')
      const paid = monthly(inputs.caseA!, fra)
      expectWithin(paid, expected.caseA62!, example.tolerance, 'caseA62')
      expect(withinTolerance(paid, expected.beforeA62!, example.tolerance)).toBe(false)
    })

    it('case A at the survivor FRA: the limit binds (1,980)', () => {
      const fra = fraTotalMonths(survivorFraForBirthYear(inputs.caseA!.survivorBirthYear!))
      expectWithin(monthly(inputs.caseA!, fra, fra), expected.caseAFra!, example.tolerance, 'caseAFra')
    })

    it('case B: the POMS case is cut to the larger limit after the age reduction (1,650, not 1,414.875)', () => {
      const paid = monthly(inputs.caseB!, inputs.caseB!.survivorFraMonths!)
      expectWithin(paid, expected.caseB!, example.tolerance, 'caseB')
      expect(withinTolerance(paid, expected.beforeB!, example.tolerance)).toBe(false)
    })

    it('case C: at 60 the reduced PIA is paid, below the limit (1,430, not 1,179.75)', () => {
      const paid = monthly(inputs.caseC!, inputs.caseC!.survivorFraMonths!)
      expectWithin(paid, expected.caseC!, example.tolerance, 'caseC')
      expect(withinTolerance(paid, expected.beforeC!, example.tolerance)).toBe(false)
    })

    it('case D: a deceased never paid a reduced benefit is not limited, and keeps the delayed credits', () => {
      expectWithin(monthly(inputs.caseD!, inputs.caseD!.survivorFraMonths!), expected.caseD!, example.tolerance, 'caseD')
      // Case B's amounts with an unreduced deceased: the 1,715 reduced PIA is paid, with no limit.
      const unreduced = { ...inputs.caseB!, deceasedActual: inputs.caseB!.deceasedPia, everReduced: false }
      expectWithin(monthly(unreduced, inputs.caseB!.survivorFraMonths!), 1_715, example.tolerance, 'unreduced')
    })

    it('pays nothing without a PIA', () => {
      expect(monthly({ ...inputs.caseB!, deceasedPia: 0 }, inputs.caseB!.survivorFraMonths!)).toBe(0)
    })
  },
)
