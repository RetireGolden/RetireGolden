/**
 * Full retirement age (FRA) in years + months after age 65, by **year of birth**
 * (SSA “normal retirement age” schedule). Jan 1 DOB uses prior calendar year.
 *
 * @see https://www.ssa.gov/benefits/retirement/planner/agereduction.html
 */

export function effectiveBirthYear(
  year: number,
  month: number,
  day: number,
): number {
  if (month === 1 && day === 1) return year - 1
  return year
}

/** FRA as completed years + extra months (0, 2, …, 10) beyond those full years. */
export interface FraComponents {
  years: number
  extraMonths: number
}

/**
 * SSA NRA schedule (simplified to birth **year**; month-of-year refinements omitted).
 * Years before 1938: treated as 65 + 0 (legacy). Years after 2025: 67 + 0 (current law; may change).
 */
export function fraForBirthYear(birthYearEffective: number): FraComponents {
  const y = birthYearEffective
  if (y <= 1937) return { years: 65, extraMonths: 0 }
  if (y === 1938) return { years: 65, extraMonths: 2 }
  if (y === 1939) return { years: 65, extraMonths: 4 }
  if (y === 1940) return { years: 65, extraMonths: 6 }
  if (y === 1941) return { years: 65, extraMonths: 8 }
  if (y === 1942) return { years: 65, extraMonths: 10 }
  if (y >= 1943 && y <= 1954) return { years: 66, extraMonths: 0 }
  if (y === 1955) return { years: 66, extraMonths: 2 }
  if (y === 1956) return { years: 66, extraMonths: 4 }
  if (y === 1957) return { years: 66, extraMonths: 6 }
  if (y === 1958) return { years: 66, extraMonths: 8 }
  if (y === 1959) return { years: 66, extraMonths: 10 }
  return { years: 67, extraMonths: 0 }
}

/** Total “month slots” from birth to reach FRA / claim age (approximation: 12y + extra). */
export function ageToTotalMonths(ageYears: number, extraMonths = 0): number {
  return ageYears * 12 + extraMonths
}

export function fraTotalMonths(fra: FraComponents): number {
  return fra.years * 12 + fra.extraMonths
}

/**
 * Survivor (widow(er)) full retirement age — a separate, **earlier** schedule
 * than the worker retirement FRA above: 65y0m for born ≤1945, ramping to 66y0m
 * for 1951–56, then 66y2m→66y8m for 1957–60, topping out at **66y8m** for born
 * 1960+ (it never reaches 67). The widow(er) early-claim reduction (up to 28.5%
 * at 60) is measured against this FRA, not the worker FRA.
 *
 * @see https://www.ssa.gov/oact/ProgData/nra.html (Full Retirement Age for Survivors)
 */
export function survivorFraForBirthYear(birthYearEffective: number): FraComponents {
  const y = birthYearEffective
  if (y <= 1945) return { years: 65, extraMonths: 0 }
  if (y === 1946) return { years: 65, extraMonths: 2 }
  if (y === 1947) return { years: 65, extraMonths: 4 }
  if (y === 1948) return { years: 65, extraMonths: 6 }
  if (y === 1949) return { years: 65, extraMonths: 8 }
  if (y === 1950) return { years: 65, extraMonths: 10 }
  if (y >= 1951 && y <= 1956) return { years: 66, extraMonths: 0 }
  if (y === 1957) return { years: 66, extraMonths: 2 }
  if (y === 1958) return { years: 66, extraMonths: 4 }
  if (y === 1959) return { years: 66, extraMonths: 6 }
  return { years: 66, extraMonths: 8 } // born 1960+
}
