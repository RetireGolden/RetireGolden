// Independent model of the B2-P1 slice 4 Social Security analysis figures.
// Written by the deriver from the primary sources summarized in ssa-data.json beside this file (each
// source's URL and SHA-256 are in its provenance field).
// Imports NOTHING from packages/engine or packages/planner-ui. Two families of functions:
//   ui*   re-implementations of what planner-ui computes today (to check the reading of the code)
//   the rest: the proposed engine models the worksheets define.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const DATA = JSON.parse(readFileSync(join(here, 'ssa-data.json'), 'utf8'))
const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), v]))
export const WAGE_BASE = num(DATA.wageBase)
export const AWI = num(DATA.awi)
export const BEND = num(DATA.bendPoints)
export const QC = num(DATA.qcAmount)
export const CPI = num(DATA.cpiU)
export const RATE_EMP = num(DATA.oasdiRate.employeeEffective)
export const RATE_EMP_TRUST = num(DATA.oasdiRate.employeeTrustFund)
export const RATE_SE = num(DATA.oasdiRate.selfEmployedEffective)

// ---------------------------------------------------------------- dates and ages (20 CFR 404.409, 404.102)
/** A person born on January 1 attains ages the day before, so falls in the previous year's cohort. */
export const effYear = (dob) => (dob.month === 1 && dob.day === 1 ? dob.year - 1 : dob.year)
/** The calendar month (year*12 + month-1) in which a person attains age 0 on SSA's day-before-the-birthday rule. */
export const attainedZero = (dob) => dob.year * 12 + (dob.month - 1) - (dob.day === 1 ? 1 : 0)
/** 20 CFR 404.409(a), in total months. */
export function fraMonths(dob) {
  const y = effYear(dob)
  if (y <= 1937) return 780
  if (y <= 1942) return 780 + 2 * (y - 1937)
  if (y <= 1954) return 792
  if (y <= 1959) return 792 + 2 * (y - 1954)
  return 804
}
/** 20 CFR 404.409(b): the widow(er) table, which is the (a) table two birth years later. */
export function survivorFraMonths(dob) {
  const y = effYear(dob)
  if (y <= 1939) return 780
  if (y <= 1944) return 780 + 2 * (y - 1939)
  if (y <= 1956) return 792
  if (y <= 1961) return 792 + 2 * (y - 1956)
  return 804
}
/** 20 CFR 404.313(b)(2) monthly delayed credit, percent. */
export function drcPct(dob) {
  const y = effYear(dob)
  const t = [[1943, 2 / 3], [1941, 5 / 8], [1939, 7 / 12], [1937, 13 / 24], [1935, 1 / 2], [1933, 11 / 24], [1931, 5 / 12], [1929, 3 / 8], [1927, 1 / 3], [1925, 7 / 24], [1917, 1 / 4]]
  for (const [from, p] of t) if (y >= from) return p
  return 1 / 12
}
/** 20 CFR 404.410(a) and 404.313: old-age benefit as a fraction of PIA for a claim at `m` total months. */
export function retirementFactor(dob, m) {
  if (m < 744 || m > 840) throw new RangeError('claim 62y0m..70y0m')
  const f = fraMonths(dob)
  if (m < f) { const e = f - m; return 1 - (Math.min(36, e) * (5 / 9) + Math.max(0, e - 36) * (5 / 12)) / 100 }
  if (m > f) return 1 + (Math.min(m - f, 840 - f) * drcPct(dob)) / 100
  return 1
}
/** 20 CFR 404.410(b): wife's or husband's benefit as a fraction of its unreduced amount. */
export function spousalFactor(dob, m) {
  const f = fraMonths(dob)
  if (m >= f) return 1
  const e = f - m
  return 1 - (Math.min(36, e) * (25 / 36) + Math.max(0, e - 36) * (5 / 12)) / 100
}
/** 20 CFR 404.410(c)(1): widow(er)'s factor, 0.285 x months early / months from 60 to survivor FRA. */
export function widowFactor(dob, m) {
  const F = survivorFraMonths(dob)
  if (m >= F) return 1
  if (m <= 720) return 1 - 0.285
  return 1 - (0.285 * (F - m)) / (F - 720)
}
/** 42 U.S.C. 402(e)(2)(C), 404.313(e)(1): never-claimed worker's base factor, death in December of `deathYear`. */
export function neverClaimedFactor(dob, deathYear, deathMonth = 12) {
  const zero = dob.year * 12 + (dob.month - 1) - (dob.day === 1 ? 1 : 0)
  const ageAtDeath = deathYear * 12 + (deathMonth - 1) - zero
  const f = fraMonths(dob)
  const credit = Math.min(ageAtDeath, 840) - f
  if (credit <= 0) return 1
  return 1 + (Math.min(credit, 840 - f) * drcPct(dob)) / 100
}
/**
 * 42 U.S.C. 402(e)(2)(A),(C),(D) and 402(q): widow(er)'s payable amount. When the deceased was ever
 * entitled to a reduced old-age benefit, the benefit after the age reduction is cut to the larger of the
 * deceased's reduced benefit and 82.5% of PIA only if it exceeds both (POMS RS 00615.320 order).
 */
export function widowPayable({ deceasedPia, deceasedActual, deceasedReduced, factor }) {
  if (deceasedPia <= 0) return 0
  if (deceasedReduced) return Math.min(deceasedPia * factor, Math.max(deceasedActual, 0.825 * deceasedPia))
  return Math.max(deceasedPia, deceasedActual) * factor
}
/** The engine's current order (max first, then the age factor), for the RIB-LIM comparison only. */
export function widowPayableEngineToday({ deceasedPia, deceasedActual, factor }) {
  if (deceasedPia <= 0) return 0
  return Math.max(deceasedActual, 0.825 * deceasedPia) * factor
}
/** The ledger's payable months in the claim year (annual approximation). */
export const payableMonths = (ageAttained, claim) => (ageAttained < claim.years ? 0 : ageAttained > claim.years ? 12 : Math.max(0, 12 - claim.months))

// ---------------------------------------------------------------- survival (SSA Table 4C6)
const LT = { 2022: DATA.lifeTable2022, 2023: DATA.lifeTable2023 }
function eRow(sex, vintage) {
  const t = LT[vintage]
  if (sex === 'male') return t.male.e
  if (sex === 'female') return t.female.e
  return t.male.e.map((m, i) => (m + t.female.e[i]) / 2)
}
/** q(x) by the half-year identity from the printed e(x): 1 - (e(x)-0.5)/(e(x+1)+0.5); 1 at the last row. */
export function qIdentity(x, sex, vintage = 2022) {
  const e = eRow(sex, vintage)
  if (x < 0) return 0
  if (x >= e.length - 1) return 1
  return Math.min(1, Math.max(0, 1 - (e[x] - 0.5) / (e[x + 1] + 0.5)))
}
/** q(x) as SSA publishes it ('average' = mean of the two published q; forced to 1 at 119). */
export function qPublished(x, sex, vintage = 2022) {
  const t = LT[vintage]
  if (x < 0) return 0
  if (x >= 119) return 1
  if (sex === 'male') return t.male.q[x]
  if (sex === 'female') return t.female.q[x]
  return (t.male.q[x] + t.female.q[x]) / 2
}
/** Running survival from integer age a: S[t] = P(alive at a+t | alive at a). */
export function survivalFrom(a, sex, q = qIdentity) {
  const S = [1]
  for (let t = 1; a + t <= 121; t++) S.push(S[t - 1] * (1 - q(a + t - 1, sex)))
  return S
}

// ---------------------------------------------------------------- UI re-implementations (today)
export function uiSurvivalCurve(sex) {
  const e = eRow(sex, 2022)
  const cum = [1]
  for (let age = 0; age < 120; age++) {
    const i = Math.max(0, Math.min(age, 119)), j = Math.max(0, Math.min(age + 1, 119))
    const p = Math.max(0, Math.min(1, (e[i] - 0.5) / (e[j] + 0.5)))
    cum.push(cum[age] * p)
  }
  return (a, b) => (b <= a ? 1 : cum[a] <= 0 ? 0 : cum[Math.min(b, 120)] / cum[Math.min(a, 120)])
}
export function uiExpectedPvSingle({ currentAge, dob, sex, pia, claimYears, floorMonthly = 0 }, r) {
  const S = uiSurvivalCurve(sex)
  const benefit = Math.max(pia * retirementFactor(dob, claimYears * 12), floorMonthly) * 12
  let pv = 0
  for (let age = Math.max(currentAge, claimYears); age <= 119; age++) pv += S(currentAge, age) * benefit * Math.pow(1 + r, -(age - currentAge))
  return pv
}
export function uiExpectedPvCouple(a, b, r) {
  const SA = uiSurvivalCurve(a.sex), SB = uiSurvivalCurve(b.sex)
  const bA = a.pia * retirementFactor(a.dob, a.claimYears * 12) * 12
  const bB = b.pia * retirementFactor(b.dob, b.claimYears * 12) * 12
  const lowerIsA = a.pia < b.pia
  const higher = lowerIsA ? b : a, lower = lowerIsA ? a : b
  const spousal = 0.5 * higher.pia * spousalFactor(lower.dob, lower.claimYears * 12) * 12
  let pv = 0
  for (let t = 0; ; t++) {
    const ageA = a.currentAge + t, ageB = b.currentAge + t
    if (ageA > 119 && ageB > 119) break
    const sA = SA(a.currentAge, ageA), sB = SB(b.currentAge, ageB)
    const aC = ageA >= a.claimYears, bC = ageB >= b.claimYears
    const oA = aC ? bA : 0, oB = bC ? bB : 0
    let both = oA + oB
    if (aC && bC) both = (lowerIsA ? oB : oA) + Math.max(lowerIsA ? oA : oB, spousal)
    const surv = Math.max(oA, oB)
    pv += (sA * sB * both + sA * (1 - sB) * surv + sB * (1 - sA) * surv) * Math.pow(1 + r, -t)
  }
  return pv
}
export function uiBreakEven({ dob, pia, claimAges, colaPct, growthPct, throughAge }) {
  const cola = colaPct / 100, g = growthPct / 100
  const f = Object.fromEntries(claimAges.map((c) => [c, retirementFactor(dob, c * 12)]))
  const bal = Object.fromEntries(claimAges.map((c) => [c, 0]))
  const series = []
  for (let age = 62; age <= throughAge; age++) {
    const cum = {}
    for (const c of claimAges) { bal[c] = bal[c] * (1 + g) + (age < c ? 0 : pia * f[c] * 12 * Math.pow(1 + cola, age - 62)); cum[c] = Math.round(bal[c]) }
    series.push({ age, cum })
  }
  return { series, crossings: crossings(series, claimAges, true) }
}
function crossings(series, claimAges, roundTenth) {
  const s = [...claimAges].sort((x, y) => x - y), out = []
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    let cross = null, prev = null
    for (const pt of series) {
      if (pt.cum[s[i]] <= 0) continue
      const diff = pt.cum[s[j]] - pt.cum[s[i]]
      if (diff >= 0) { cross = prev !== null && prev < 0 ? pt.age - 1 + -prev / (diff - prev) : pt.age; break }
      prev = diff
    }
    out.push({ early: s[i], late: s[j], age: cross === null ? null : roundTenth ? Math.round(cross * 10) / 10 : cross })
  }
  return out
}
export function uiPaidIn(earnings, { ratePct = 6.2, selfEmployed = false }) {
  const latest = Math.max(...Object.keys(WAGE_BASE).filter((y) => y >= 1979).map((y) => WAGE_BASE[y]))
  let emp = 0, er = 0
  for (const { year, amount } of earnings) {
    if (amount <= 0) continue
    const cap = year >= 1979 && WAGE_BASE[year] !== undefined ? WAGE_BASE[year] : latest // the engine table starts at 1979
    const c = Math.min(amount, cap)
    if (selfEmployed) emp += c * (ratePct / 100) * 2
    else { emp += c * (ratePct / 100); er += c * (ratePct / 100) }
  }
  return { paidIn: emp, employerPaid: selfEmployed ? 0 : er }
}
export function uiCredits(earnings) {
  let c = 0
  for (const e of earnings) if (e.amount > 0) c += Math.min(4, Math.floor(e.amount / 1810))
  return Math.min(40, c)
}

// ---------------------------------------------------------------- proposed models
/** Break-even on the ledger's dollars: COLA factor by calendar year from the plan start, haircut by year, exact series. */
export function breakEven({ dob, pia, claimAges, colaFactor, haircutFactor = () => 1, growthPct, throughAge }) {
  const g = growthPct / 100
  const f = Object.fromEntries(claimAges.map((c) => [c, retirementFactor(dob, c * 12)]))
  const bal = Object.fromEntries(claimAges.map((c) => [c, 0]))
  const series = []
  for (let age = 62; age <= throughAge; age++) {
    const year = dob.year + age
    const cum = {}
    for (const c of claimAges) { bal[c] = bal[c] * (1 + g) + (age < c ? 0 : pia * f[c] * 12 * colaFactor(year) * haircutFactor(year)); cum[c] = bal[c] }
    series.push({ age, cum })
  }
  return { series, crossings: crossings(series, claimAges, false) }
}

/** Divorced-spouse or current-spouse dual entitlement (42 U.S.C. 402(q)(3)(B), 402(k)(3)(A); POMS RS 00615.250 and .694). */
export function spouseTotalMonthly({ ownPia, ownActual, ownClaimMonths, fraM, halfBase, spousalFactorAtStart }) {
  if (ownClaimMonths < fraM) return ownActual + Math.max(0, halfBase - ownPia) * spousalFactorAtStart
  return Math.max(ownActual, halfBase * spousalFactorAtStart)
}

/**
 * Single expected PV. `records`: former spouses (plan shape). `household` single flag gates divorced benefits.
 * `real(year)`: ssColaFactor / inflation factor (1 under matchInflation); `haircut(year)`.
 */
export function expectedPvSingle(p, opts) {
  const { dob, sex, currentAge, pia, claim, records = [], householdSingle = true, startYear } = p
  const { r, real = () => 1, haircut = () => 1, q = qIdentity } = opts
  const S = survivalFrom(currentAge, sex, q)
  const claimM = claim.years * 12 + claim.months
  const fraM = fraMonths(dob)
  const own = pia * retirementFactor(dob, claimM)
  let pv = 0
  for (let t = 0; currentAge + t <= 119; t++) {
    const age = currentAge + t, year = startYear + t
    const months = payableMonths(age, claim)
    if (months <= 0) continue
    let monthly = own
    for (const rec of records) {
      const m = maritalMonthly(rec, { dob, pia, own, claim, claimM, fraM, age, year, householdSingle })
      if (m !== null && m > monthly) monthly = m
    }
    pv += S[t] * monthly * months * real(year) * haircut(year) * Math.pow(1 + r, -t)
  }
  return pv
}
function recDob(rec) { return { year: Number(rec.dob.slice(0, 4)), month: Number(rec.dob.slice(5, 7)), day: Number(rec.dob.slice(8, 10)) } }
/** Ledger gates (maritalBenefits.ts) with the statutory composition. Returns the claimant's total monthly or null. */
export function maritalMonthly(rec, { dob, pia, own, claim, claimM, fraM, age, year, householdSingle }) {
  if (age < claim.years) return null
  const ex = recDob(rec)
  if (rec.relationship === 'divorced') {
    if (!householdSingle || rec.marriageYears < 10 || year - ex.year < 62) return null
    // divorced-spouse entitlement starts the later of the claim and the month the ex attains 62
    // Base branch (D-SS-LAW-2 review 1): the first month the ex is 62 throughout (POMS RS 00202.005 B.2.a)
    const sM = Math.max(claimM, attainedZero(ex) + 744 + (ex.day === 2 ? 0 : 1) - attainedZero(dob))
    return spouseTotalMonthly({ ownPia: pia, ownActual: own, ownClaimMonths: claimM, fraM, halfBase: 0.5 * rec.piaMonthly, spousalFactorAtStart: spousalFactor(dob, sM) })
  }
  const widowOk = (rec.relationship === 'deceased' && rec.marriageYears >= 0.75) || (rec.relationship === 'surviving-divorced' && rec.marriageYears >= 10)
  if (!widowOk) return null
  if (rec.remarriedAtAge !== null && rec.remarriedAtAge !== undefined && rec.remarriedAtAge < 60) return null
  if (age < 60) return null
  const exFra = fraMonths(ex)
  const exClaimM = rec.deceasedClaimAge ? rec.deceasedClaimAge.years * 12 + rec.deceasedClaimAge.months : exFra
  const actual = rec.piaMonthly * retirementFactor(ex, exClaimM)
  const surv = widowPayable({ deceasedPia: rec.piaMonthly, deceasedActual: actual, deceasedReduced: exClaimM < exFra, factor: widowFactor(dob, claimM) })
  return Math.max(own, surv)
}

/**
 * Couple expected PV on the statute: both alive, the lower earner is paid own plus the separately reduced
 * excess from the later of the two claim years; after a death in year k (alive through k) the survivor is paid
 * the larger of own and the widow(er) benefit from year k+1 (and not before the survivor's own claim year),
 * reduced for the survivor's age in that first year; the deceased's base is the claimed benefit (RIB-LIM when
 * it was reduced), or the never-claimed amount for the month before a December death.
 */
export function expectedPvCouple(a, b, opts) {
  const { r, real = () => 1, haircut = () => 1, q = qIdentity, startYear } = opts
  const P = [a, b].map((x) => ({ ...x, S: survivalFrom(x.currentAge, x.sex, q), claimM: x.claim.years * 12 + x.claim.months, fraM: fraMonths(x.dob) }))
  for (const x of P) x.own = x.pia * retirementFactor(x.dob, x.claimM)
  const hi = P[0].pia >= P[1].pia ? 0 : 1, lo = 1 - hi
  const H = P[hi], L = P[lo]
  // year offset (t) at which each claims, and the lower earner's age in the spouse benefit's first year
  const tClaim = P.map((x) => x.claim.years - x.currentAge)
  const tSpouse = Math.max(tClaim[0], tClaim[1])
  // the lower earner's age in months in the month the spouse benefit starts: her own claim, or the month the higher earner claims
  const lSpouseM = Math.max(L.claimM, attainedZero(H.dob) + H.claimM - attainedZero(L.dob))
  const lBoth = spouseTotalMonthly({ ownPia: L.pia, ownActual: L.own, ownClaimMonths: L.claimM, fraM: L.fraM, halfBase: 0.5 * H.pia, spousalFactorAtStart: spousalFactor(L.dob, lSpouseM) })
  const T = Math.max(119 - a.currentAge, 119 - b.currentAge)
  let pv = 0
  for (let t = 0; t <= T; t++) {
    const year = startYear + t
    const disc = Math.pow(1 + r, -t) * real(year) * haircut(year)
    const both = [0, 1].map((i) => {
      const x = P[i], age = x.currentAge + t
      const pm = payableMonths(age, x.claim)
      if (pm <= 0) return 0
      if (i === lo && t >= tSpouse) {
        const hm = payableMonths(H.currentAge + t, H.claim)
        return lBoth * Math.min(pm, hm) + x.own * (pm - Math.min(pm, hm))
      }
      return x.own * pm
    })
    const sAt = (x) => (x.currentAge + t <= 121 ? x.S[t] ?? 0 : 0)
    let e = sAt(P[0]) * sAt(P[1]) * (both[0] + both[1])
    for (const [i, j] of [[0, 1], [1, 0]]) {
      const s = P[i], d = P[j]
      const sAlive = sAt(s)
      if (sAlive <= 0) continue
      const ageS = s.currentAge + t
      const pmS = payableMonths(ageS, s.claim)
      for (let k = 0; k < t; k++) {
        const fk = (d.S[k] ?? 0) * q(d.currentAge + k, d.sex)
        if (fk <= 0) continue
        const deathAge = d.currentAge + k
        const claimed = d.claim.years <= deathAge
        const actual = claimed ? d.own : d.pia * (deathAge >= 62 ? neverClaimedFactor(d.dob, d.dob.year + deathAge, 12) : 1)
        let monthly = pmS > 0 ? s.own : 0
        const firstT = Math.max(k + 1, tClaim[i])
        if (t >= firstT && pmS > 0 && ageS >= 60) {
          // widow(er) entitlement: the December of the death year (the ledger's death-month convention), or the survivor's own claim if later
          // Base branch (D-SS-LAW-2 review 5): January after the death year, the first month the ledger pays
          const entM = Math.max(s.claimM, (startYear + k + 1) * 12 + 0 - attainedZero(s.dob))
          const w = widowPayable({ deceasedPia: d.pia, deceasedActual: actual, deceasedReduced: claimed && d.claimM < d.fraM, factor: widowFactor(s.dob, entM) })
          monthly = Math.max(monthly, w)
        }
        e += sAlive * fk * monthly * pmS
      }
    }
    pv += e * disc
  }
  return pv
}

/** OASDI paid in, restated in start-year dollars: each year's effective rate and base, CPI-U to the latest published year, then the plan's inflation. */
export function paidIn(earnings, { selfEmployed = false, startYear, inflationPct }) {
  const cpiYears = Object.keys(CPI).map(Number)
  const L = Math.max(...cpiYears)
  const idx = (y) => (y <= L ? (CPI[L] / CPI[y]) * Math.pow(1 + inflationPct / 100, startYear - L) : Math.pow(1 + inflationPct / 100, startYear - y))
  let emp = 0, er = 0, empNominal = 0, erNominal = 0
  const excluded = []
  for (const { year, amount } of earnings) {
    if (amount <= 0) continue
    if (year > startYear || year < 1937) { excluded.push(year); continue }
    const base = WAGE_BASE[year]
    const c = Math.min(amount, base)
    const rate = selfEmployed ? RATE_SE[year] : RATE_EMP[year]
    if (rate === null || rate === undefined) { excluded.push(year); continue }
    empNominal += c * rate / 100
    emp += (c * rate / 100) * idx(year)
    if (!selfEmployed) { erNominal += c * RATE_EMP_TRUST[year] / 100; er += (c * RATE_EMP_TRUST[year] / 100) * idx(year) }
  }
  return { paidInToday: emp, employerToday: er, paidInNominal: empNominal, employerNominal: erNominal, excluded, cpiLatestYear: L }
}
export function creditsPerYear(earnings) {
  let c = 0
  for (const e of earnings) {
    if (e.amount <= 0) continue
    if (e.year >= 1978) c += Math.min(4, Math.floor(e.amount / QC[e.year] ?? QC[Math.max(...Object.keys(QC).map(Number))]))
    else c += e.amount >= WAGE_BASE[e.year] ? 4 : Math.min(4, Math.floor(e.amount / 50))
  }
  return Math.min(40, c)
}

/** PIA from an earnings history with the engine's conventions (elapsed 22..61, drop 5, top 35, index floored to $1, AIME floored to $1, PIA floored to the dime). */
export function piaFromEarnings(dob, earnings, { projection = null, statuteBase = false } = {}) {
  const ey = effYear(dob), elig = ey + 62, first = ey + 22, last = elig - 1
  const awiLatest = Math.max(...Object.keys(AWI).map(Number))
  const bpLatest = Math.max(...Object.keys(BEND).map(Number))
  const wbLatest = Math.max(...Object.keys(WAGE_BASE).map(Number))
  const awiOr = (y) => AWI[y] ?? AWI[awiLatest]
  const idxAwi = awiOr(elig - 2)
  const byYear = new Map()
  for (const e of earnings) byYear.set(e.year, (byYear.get(e.year) ?? 0) + Math.max(0, e.amount))
  const lastEarn = Math.min(Math.max(...earnings.map((e) => e.year), first), last)
  const projThrough = projection ? ey + projection.throughAge - 1 : lastEarn
  const projAmt = projection ? (projection.assumedAnnualEarnings ?? byYear.get(lastEarn) ?? 0) : 0
  const rows = []
  for (let y = first; y <= last; y++) {
    const raw = y <= lastEarn ? (byYear.get(y) ?? 0) : projection && y <= projThrough ? projAmt : 0
    const cap = (statuteBase || y >= 1979) && WAGE_BASE[y] !== undefined ? WAGE_BASE[y] : WAGE_BASE[wbLatest] // engine: latest when missing (its table starts at 1979); statuteBase reads SSA's 1937-1978 bases
    const capped = Math.max(0, Math.min(raw, cap))
    const indexed = y <= elig - 2 ? Math.floor((capped * idxAwi) / awiOr(y)) : capped
    rows.push({ year: y, raw, capped, indexed, projected: y > lastEarn && projection && y <= projThrough })
  }
  const sorted = rows.map((r) => r.indexed).sort((x, y) => x - y).slice(5).sort((x, y) => y - x)
  const top = sorted.slice(0, 35)
  const n = Math.min(35, sorted.length)
  const aime = Math.floor(top.reduce((s, v) => s + v, 0) / (12 * n))
  const bp = BEND[elig] ?? BEND[bpLatest]
  const pia = Math.floor((0.9 * Math.min(aime, bp[0]) + 0.32 * Math.max(0, Math.min(aime, bp[1]) - bp[0]) + 0.15 * Math.max(0, aime - bp[1])) * 10 + 1e-9) / 10
  return { elig, first, last, rows, top, n, aime, pia, zeros: top.filter((v) => v === 0).length, bp }
}
export function uiZeroYearGain(res, sample) {
  if (sample <= 0 || res.n <= 0) return 0
  const rate = res.aime < res.bp[0] ? 0.9 : res.aime < res.bp[1] ? 0.32 : 0.15
  return (sample / (12 * res.n)) * rate
}
/** Exact: re-run the PIA with the latest $0 base year set to `amount`. */
export function zeroYearGain(dob, earnings, amount, opts = {}) {
  const base = piaFromEarnings(dob, earnings, opts)
  if (base.zeros === 0 || amount <= 0) return null
  const zeroRows = base.rows.filter((r) => r.raw === 0)
  const y = zeroRows[zeroRows.length - 1].year
  const replaced = [...earnings.filter((e) => e.year !== y), { year: y, amount }]
  // keep the projection window as it was: re-running with a later reported year would move lastEarningsYear
  const res = piaFromEarningsFixed(dob, earnings, opts, y, amount)
  return { year: y, amount, gainMonthly: Math.round((res.pia - base.pia) * 10) / 10, before: base.pia, after: res.pia, aimeBefore: base.aime, aimeAfter: res.aime, replacedLen: replaced.length }
}
function piaFromEarningsFixed(dob, earnings, opts, year, amount) {
  // same as piaFromEarnings, with one base year's raw earnings overridden after the window is set
  const r0 = piaFromEarnings(dob, earnings, opts)
  const idxAwi = AWI[r0.elig - 2] ?? AWI[Math.max(...Object.keys(AWI).map(Number))]
  const awiOr = (y) => AWI[y] ?? AWI[Math.max(...Object.keys(AWI).map(Number))]
  const wbLatest = Math.max(...Object.keys(WAGE_BASE).map(Number))
  const rows = r0.rows.map((r) => {
    if (r.year !== year) return r
    const cap = r.year >= 1979 && WAGE_BASE[r.year] !== undefined ? WAGE_BASE[r.year] : WAGE_BASE[wbLatest]
    const capped = Math.max(0, Math.min(amount, cap))
    const indexed = r.year <= r0.elig - 2 ? Math.floor((capped * idxAwi) / awiOr(r.year)) : capped
    return { ...r, raw: amount, capped, indexed }
  })
  const sorted = rows.map((r) => r.indexed).sort((x, y) => x - y).slice(5).sort((x, y) => y - x)
  const top = sorted.slice(0, 35)
  const n = Math.min(35, sorted.length)
  const aime = Math.floor(top.reduce((s, v) => s + v, 0) / (12 * n))
  const bp = r0.bp
  const pia = Math.floor((0.9 * Math.min(aime, bp[0]) + 0.32 * Math.max(0, Math.min(aime, bp[1]) - bp[0]) + 0.15 * Math.max(0, aime - bp[1])) * 10 + 1e-9) / 10
  return { aime, pia }
}

// ---------------------------------------------------------------- survivor switching (widowed single)
function switchPvGeneric(input, strategy, r, widowFn, q = qIdentity) {
  const { dob, sex, currentAge, ownPia, deceasedPia, deceasedActual, deceasedReduced } = input
  const S = survivalFrom(currentAge, sex, q)
  const surv = strategy.survivor !== null ? widowFn({ deceasedPia, deceasedActual, deceasedReduced, factor: widowFactor(dob, strategy.survivor * 12) }) * 12 : 0
  const own = strategy.own !== null ? ownPia * 12 * retirementFactor(dob, strategy.own * 12) : 0
  let pv = 0
  for (let age = currentAge; age <= 119; age++) {
    const b = Math.max(strategy.survivor !== null && age >= strategy.survivor ? surv : 0, strategy.own !== null && age >= strategy.own ? own : 0)
    if (b > 0) pv += S[age - currentAge] * b * Math.pow(1 + r, -(age - currentAge))
  }
  return pv
}
export function switchStrategies(input) {
  const sFra = Math.floor(survivorFraMonths(input.dob) / 12)
  const oFra = Math.floor(fraMonths(input.dob) / 12)
  const sNow = Math.max(input.currentAge, 60)
  const sAges = [...new Set([sNow, Math.max(sNow, sFra)])]
  const oNow = Math.min(70, Math.max(input.currentAge, 62))
  const oAges = [...new Set([oNow, oFra, 70].filter((a) => a >= oNow && a <= 70))]
  const out = []; const seen = new Set()
  for (const s of sAges) for (const o of oAges) out.push({ survivor: s, own: o })
  for (const s of sAges) out.push({ survivor: s, own: null })
  for (const o of oAges) out.push({ survivor: null, own: o })
  return out.filter((x) => { const k = `${x.survivor}-${x.own}`; if (seen.has(k)) return false; seen.add(k); return true })
}
export const uiSwitchPv = (input, strategy, r) => switchPvGeneric(input, strategy, r, widowPayableEngineToday)
export const switchPv = (input, strategy, r) => switchPvGeneric(input, strategy, r, widowPayable)
