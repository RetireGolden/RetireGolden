/**
 * OASDI (Social Security) payroll tax rates, percent of taxable earnings, by
 * calendar year from 1937, when the tax began, through 2026: SSA's "Social
 * Security Tax Rates" (ssa.gov/oact/progdata/oasdiRates.html), which gives
 * the OASI, DI and total rates "for employees and employers, each" and "for
 * self-employed workers", as received by the trust funds.
 *
 * The rates here are the effective rates each payer paid, which differ from
 * the trust-fund rates in three places the same page's footnotes give:
 * - 1984: "an immediate credit of 0.3 percent of taxable wages was allowed
 *   against the OASDI taxes paid by employees, resulting in an effective
 *   employee tax rate of 5.4 percent" (the employer paid the 5.7 percent
 *   trust-fund rate);
 * - 2011 and 2012: "the OASDI tax rate is reduced by 2 percentage points for
 *   employees and for self-employed workers, resulting in a 4.2 percent
 *   effective tax rate for employees and a 10.4 percent effective tax rate for
 *   self-employed workers" (the employer paid 6.2 percent);
 * - self-employment tax did not exist before 1951 (null).
 * The self-employed credits of 1984-89, which the page gives against the
 * combined OASDI and HI tax without allocating them, are not applied (a
 * stated limit of oasdi-paid-in-today-dollars). IRC 3101(a) sets today's
 * 6.2 percent employee rate and IRC 1401(a) the 12.4 percent self-employed
 * rate.
 *
 * @see DOCS/calculations/social-security/oasdi-tax-rate-history.md
 */

export interface OasdiTaxRates {
  /** The employee's effective rate, percent. */
  readonly employee: number
  /** The employer's rate, percent. */
  readonly employer: number
  /** The self-employed effective rate, percent; null before 1951. */
  readonly selfEmployed: number | null
}

export const OASDI_TAX_RATE_BY_YEAR: Readonly<Record<number, OasdiTaxRates>> = {
  1937: { employee: 1, employer: 1, selfEmployed: null },
  1938: { employee: 1, employer: 1, selfEmployed: null },
  1939: { employee: 1, employer: 1, selfEmployed: null },
  1940: { employee: 1, employer: 1, selfEmployed: null },
  1941: { employee: 1, employer: 1, selfEmployed: null },
  1942: { employee: 1, employer: 1, selfEmployed: null },
  1943: { employee: 1, employer: 1, selfEmployed: null },
  1944: { employee: 1, employer: 1, selfEmployed: null },
  1945: { employee: 1, employer: 1, selfEmployed: null },
  1946: { employee: 1, employer: 1, selfEmployed: null },
  1947: { employee: 1, employer: 1, selfEmployed: null },
  1948: { employee: 1, employer: 1, selfEmployed: null },
  1949: { employee: 1, employer: 1, selfEmployed: null },
  1950: { employee: 1.5, employer: 1.5, selfEmployed: null },
  1951: { employee: 1.5, employer: 1.5, selfEmployed: 2.25 },
  1952: { employee: 1.5, employer: 1.5, selfEmployed: 2.25 },
  1953: { employee: 1.5, employer: 1.5, selfEmployed: 2.25 },
  1954: { employee: 2, employer: 2, selfEmployed: 3 },
  1955: { employee: 2, employer: 2, selfEmployed: 3 },
  1956: { employee: 2, employer: 2, selfEmployed: 3 },
  1957: { employee: 2.25, employer: 2.25, selfEmployed: 3.375 },
  1958: { employee: 2.25, employer: 2.25, selfEmployed: 3.375 },
  1959: { employee: 2.5, employer: 2.5, selfEmployed: 3.75 },
  1960: { employee: 3, employer: 3, selfEmployed: 4.5 },
  1961: { employee: 3, employer: 3, selfEmployed: 4.5 },
  1962: { employee: 3.125, employer: 3.125, selfEmployed: 4.7 },
  1963: { employee: 3.625, employer: 3.625, selfEmployed: 5.4 },
  1964: { employee: 3.625, employer: 3.625, selfEmployed: 5.4 },
  1965: { employee: 3.625, employer: 3.625, selfEmployed: 5.4 },
  1966: { employee: 3.85, employer: 3.85, selfEmployed: 5.8 },
  1967: { employee: 3.9, employer: 3.9, selfEmployed: 5.9 },
  1968: { employee: 3.8, employer: 3.8, selfEmployed: 5.8 },
  1969: { employee: 4.2, employer: 4.2, selfEmployed: 6.3 },
  1970: { employee: 4.2, employer: 4.2, selfEmployed: 6.3 },
  1971: { employee: 4.6, employer: 4.6, selfEmployed: 6.9 },
  1972: { employee: 4.6, employer: 4.6, selfEmployed: 6.9 },
  1973: { employee: 4.85, employer: 4.85, selfEmployed: 7 },
  1974: { employee: 4.95, employer: 4.95, selfEmployed: 7 },
  1975: { employee: 4.95, employer: 4.95, selfEmployed: 7 },
  1976: { employee: 4.95, employer: 4.95, selfEmployed: 7 },
  1977: { employee: 4.95, employer: 4.95, selfEmployed: 7 },
  1978: { employee: 5.05, employer: 5.05, selfEmployed: 7.1 },
  1979: { employee: 5.08, employer: 5.08, selfEmployed: 7.05 },
  1980: { employee: 5.08, employer: 5.08, selfEmployed: 7.05 },
  1981: { employee: 5.35, employer: 5.35, selfEmployed: 8 },
  1982: { employee: 5.4, employer: 5.4, selfEmployed: 8.05 },
  1983: { employee: 5.4, employer: 5.4, selfEmployed: 8.05 },
  1984: { employee: 5.4, employer: 5.7, selfEmployed: 11.4 },
  1985: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
  1986: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
  1987: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
  1988: { employee: 6.06, employer: 6.06, selfEmployed: 12.12 },
  1989: { employee: 6.06, employer: 6.06, selfEmployed: 12.12 },
  1990: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1991: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1992: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1993: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1994: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1995: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1996: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1997: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1998: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  1999: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2000: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2001: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2002: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2003: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2004: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2005: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2006: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2007: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2008: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2009: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2010: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2011: { employee: 4.2, employer: 6.2, selfEmployed: 10.4 },
  2012: { employee: 4.2, employer: 6.2, selfEmployed: 10.4 },
  2013: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2014: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2015: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2016: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2017: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2018: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2019: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2020: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2021: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2022: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2023: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2024: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2025: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
  2026: { employee: 6.2, employer: 6.2, selfEmployed: 12.4 },
} as const

/** The first year of the OASDI payroll tax. */
export const FIRST_OASDI_TAX_YEAR = 1937

/** The last year the table carries; a later year is taxed at its rates, current law. */
export const LATEST_PUBLISHED_OASDI_TAX_RATE_YEAR = Math.max(...Object.keys(OASDI_TAX_RATE_BY_YEAR).map(Number))
