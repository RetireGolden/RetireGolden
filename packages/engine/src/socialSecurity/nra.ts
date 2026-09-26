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
 * Years before 1938: treated as 65 + 0 (legacy). Years 1960 and later: 67 + 0 (current law; may change).
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
 * Survivor (widow(er)) full retirement age, a separate schedule from the worker
 * retirement FRA above. The widow(er) early-claim reduction (up to 28.5% at 60)
 * is measured against it, not the worker FRA.
 *
 * 42 U.S.C. 416(l)(1) keys retirement age to the calendar year a person
 * attains early retirement age, and (l)(2) sets that age at 62 for an old-age
 * benefit and 60 for a widow(er)'s benefit. A survivor born in year Y turns 60
 * in the same calendar year a worker born in Y - 2 turns 62, so the survivor
 * schedule is the worker schedule shifted two years: 65 for born 1939 or
 * earlier, 65y2m to 65y10m for 1940-44, 66 for 1945-56, 66y2m to 66y10m for
 * 1957-61, and 67 for 1962 and later, which is the table 20 CFR 404.409(b)
 * prints by date of birth from January 2, 1912 on. Earlier births (for which the
 * regulation gives 62) are outside any projection. Registered as
 * usc-42-416-l-survivor-fra-age-60-attainment-cohorts.
 */
export function survivorFraForBirthYear(birthYearEffective: number): FraComponents {
  return fraForBirthYear(birthYearEffective - 2)
}
