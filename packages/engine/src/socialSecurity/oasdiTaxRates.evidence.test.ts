import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { ssaEffectiveRates, ssaFootnoteRates, ssaTrustFundRates } from '../testing/socialSecuritySources.test-support.js'
import { FIRST_OASDI_TAX_YEAR, LATEST_PUBLISHED_OASDI_TAX_RATE_YEAR, OASDI_TAX_RATE_BY_YEAR } from './oasdiTaxRates.js'

const WORKSHEET = 'DOCS/calculations/social-security/oasdi-tax-rate-history.md'
const MUTATION = 'DOCS/calculations/social-security/oasdi-tax-rate-history.mutation.md'

// SSA's own table (DOCS/calculations/social-security/sources/ssa-oasdi-rates.table.html,
// the rate table and its footnotes cut from the captured page): the totals by
// year, "2019 and later" read through the table's last year here, and the
// footnotes' effective rates applied by the parser.
const effective = ssaEffectiveRates(LATEST_PUBLISHED_OASDI_TAX_RATE_YEAR)

describeCalculation(
  'oasdi-tax-rate-history',
  {
    example: {
      inputs: { years: '1937 to 2026' },
      expected: { rowCount: 90, employee1984: 5.4, employer1984: 5.7, employee2011: 4.2, selfEmployed2011: 10.4 },
      tolerance: { abs: 0 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('carries SSA\'s effective rate for every year 1937 to 2026, each payer, as the page\'s table and footnotes give it', () => {
      const tableYears = Object.keys(OASDI_TAX_RATE_BY_YEAR).map(Number).sort((a, b) => a - b)
      expect(tableYears).toEqual([...effective.keys()].sort((a, b) => a - b))
      expect(tableYears).toHaveLength(expected.rowCount!)
      expect(tableYears[0]).toBe(FIRST_OASDI_TAX_YEAR)
      const mismatches: string[] = []
      for (const [year, page] of effective) {
        const row = OASDI_TAX_RATE_BY_YEAR[year]!
        if (row.employee !== page.employee || row.employer !== page.employer || row.selfEmployed !== page.selfEmployed) {
          mismatches.push(`${year}: ${JSON.stringify(row)} against the page's ${JSON.stringify(page)}`)
        }
      }
      expect(mismatches).toEqual([])
    })

    it('the parser reads the footnotes: 1984\'s employee credit to 5.4 and the 2011-2012 reduction to 4.2 and 10.4, not the employer\'s', () => {
      expect(ssaFootnoteRates()).toEqual({
        employeeCredit: { year: 1984, employee: expected.employee1984 },
        payrollReduction: { years: [2011, 2012], employee: expected.employee2011, selfEmployed: expected.selfEmployed2011 },
      })
      // The table's own totals for those years are the trust-fund rates.
      const trustFund = ssaTrustFundRates(LATEST_PUBLISHED_OASDI_TAX_RATE_YEAR)
      expect(trustFund.get(1984)).toEqual({ employeeEmployer: 5.7, selfEmployed: 11.4 })
      expect(trustFund.get(2011)).toEqual({ employeeEmployer: 6.2, selfEmployed: 12.4 })
      expect(effective.get(1984)).toEqual({ employee: 5.4, employer: 5.7, selfEmployed: 11.4 })
      expect(effective.get(1985)).toEqual({ employee: 5.7, employer: 5.7, selfEmployed: 11.4 })
      expect(effective.get(2012)).toEqual({ employee: 4.2, employer: 6.2, selfEmployed: 10.4 })
      expect(effective.get(2013)).toEqual({ employee: 6.2, employer: 6.2, selfEmployed: 12.4 })
      expect(OASDI_TAX_RATE_BY_YEAR[1984]).toEqual({ employee: expected.employee1984, employer: expected.employer1984, selfEmployed: 11.4 })
      expect(OASDI_TAX_RATE_BY_YEAR[2011]).toEqual({ employee: expected.employee2011, employer: 6.2, selfEmployed: expected.selfEmployed2011 })
      expect(OASDI_TAX_RATE_BY_YEAR[2012]).toEqual(OASDI_TAX_RATE_BY_YEAR[2011])
    })

    it('has no self-employed rate before 1951, as the page shows none', () => {
      expect(effective.get(1950)!.selfEmployed).toBeNull()
      expect(OASDI_TAX_RATE_BY_YEAR[1950]!.selfEmployed).toBeNull()
      expect(OASDI_TAX_RATE_BY_YEAR[1951]!.selfEmployed).toBe(2.25)
    })
  },
)
