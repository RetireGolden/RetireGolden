import { expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { annualPropertyCarryingCosts } from './annualPropertyCarryingCosts.js'
import { effectivePropertySaleYear } from '../propertySaleYear.js'

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
  'spending-property-costs-annual',
  {
    example: {
      inputs: {
        homeA: { propertyTaxAnnual: 3_000, insuranceAnnual: 1_200, plannedSaleYear: 2031 },
        homeB: { propertyTaxAnnual: 2_000, insuranceAnnual: 800, plannedSaleYear: 2030 },
        currentYear: 2030,
        inflationFactor: 1.1,
        anyAlive: true,
      },
      expected: {
        propertyCosts: 4_620,
        homeAAmount: 4_620,
        chargingSoldHomeWrongReading: 7_700,
        taxOnlyInflatedWrongReading: 4_500,
        mortgagePaidOffWrongReading: 0,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-property-costs-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-property-costs-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number> | number | boolean>
    const expected = example.expected as Record<string, number>
    const homeA = inputs.homeA as Record<string, number>
    const homeB = inputs.homeB as Record<string, number>
    const YEAR = inputs.currentYear as number

    function property(id: string, row: Record<string, number>): Account {
      return {
        type: 'property',
        id,
        name: id,
        ownerPersonId: null,
        annualReturnPct: 0,
        value: 400_000,
        plannedSaleYear: row.plannedSaleYear!,
        expectedNetProceeds: null,
        propertyTaxAnnual: row.propertyTaxAnnual!,
        insuranceAnnual: row.insuranceAnnual!,
      } as unknown as Account
    }

    const accounts = [property('home-a', homeA), property('home-b', homeB)]

    it('inflates both carrying components on Home A and charges nothing in Home B sale year', () => {
      const rows = annualPropertyCarryingCosts({
        accounts,
        year: YEAR,
        // The worksheet's current year is inside a projection that began earlier.
        startYear: YEAR - 10,
        anyAlive: inputs.anyAlive as boolean,
        inflFactor: inputs.inflationFactor as number,
      })
      // Home B is in its sale year, so it produces no row at all.
      expect(rows.map((row) => row.account.id)).toEqual(['home-a'])
      expectWithin(rows[0]!.amount, expected.homeAAmount!, example.tolerance, 'Home A carrying cost')

      const total = rows.reduce((sum, row) => sum + row.amount, 0)
      expectWithin(total, expected.propertyCosts!, example.tolerance, 'expenses.propertyCosts')

      // The worksheet's three wrong readings.
      expect(withinTolerance(total, expected.chargingSoldHomeWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(total, expected.taxOnlyInflatedWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(total, expected.mortgagePaidOffWrongReading!, example.tolerance)).toBe(false)
    })

    it('charges nothing at all once nobody in the household is alive', () => {
      const rows = annualPropertyCarryingCosts({
        accounts,
        year: YEAR,
        // The worksheet's current year is inside a projection that began earlier.
        startYear: YEAR - 10,
        anyAlive: false,
        inflFactor: inputs.inflationFactor as number,
      })
      expect(rows).toEqual([])
    })

    it('charges nothing from the start year for a sale dated before it, the year the ledger sells it (restated 2026-09-29)', () => {
      // Decision D-2027-ROLLOVER, review H1: Home B's sale dated the year
      // before a projection that starts in YEAR runs in YEAR
      // (effectivePropertySaleYear), and its costs stop from YEAR, the same
      // year; Home A, sold later, is still charged.
      const earlier = [property('home-a', homeA), property('home-b', { ...homeB, plannedSaleYear: YEAR - 1 })]
      expect(effectivePropertySaleYear({ plannedSaleYear: YEAR - 1 }, YEAR)).toBe(YEAR)
      const rows = annualPropertyCarryingCosts({
        accounts: earlier,
        year: YEAR,
        startYear: YEAR,
        anyAlive: inputs.anyAlive as boolean,
        inflFactor: inputs.inflationFactor as number,
      })
      expect(rows.map((row) => row.account.id)).toEqual(['home-a'])
      expectWithin(rows[0]!.amount, expected.homeAAmount!, example.tolerance, 'Home A carrying cost')
    })
  },
)
