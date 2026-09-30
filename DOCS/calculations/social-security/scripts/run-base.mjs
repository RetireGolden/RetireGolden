// The deriver's independent model (ss-model-base.mjs beside this file, no engine import) with the two
// conventions the base branch (D-SS-LAW-2) settled in review: the widow(er) benefit's first
// month is January after the death year, and a divorced spouse's benefit starts in the first
// month the ex is 62 throughout. Everything else is the deriver's code unchanged.
// Run from the repository root: node DOCS/calculations/social-security/scripts/run-base.mjs
import * as M from './ss-model-base.mjs'
const r = 0.02
const f = (y, m, d) => ({ year: y, month: m, day: d })
const out = {}
out.SC = M.expectedPvSingle({ dob: f(1964, 6, 15), sex: 'female', currentAge: 62, pia: 800, claim: { years: 62, months: 0 }, records: [{ relationship: 'divorced', dob: '1966-02-10', piaMonthly: 2000, marriageYears: 12, remarriedAtAge: null }], householdSingle: true, startYear: 2026 }, { r })
const cp = (dob, sex, pia, cy) => ({ dob, sex, currentAge: 2026 - dob.year, pia, claim: { years: cy, months: 0 } })
out.CA = M.expectedPvCouple(cp(f(1964, 6, 15), 'female', 800, 62), cp(f(1964, 2, 10), 'male', 2000, 62), { r, startYear: 2026 })
out.CB = M.expectedPvCouple(cp(f(1964, 3, 10), 'female', 800, 62), cp(f(1964, 8, 20), 'male', 2400, 70), { r, startYear: 2026 })
out.CC = M.expectedPvCouple(cp(f(1962, 6, 15), 'female', 1000, 67), cp(f(1960, 6, 15), 'male', 3000, 70), { r, startYear: 2026 })
// FICA get-back on the start-year PIAs (P5 and P12 in the base branch): A 3,364.40, B 3,379.20
out.FA = M.expectedPvSingle({ dob: f(1960, 5, 1), sex: 'male', currentAge: 66, pia: 3364.4, claim: { years: 67, months: 0 }, startYear: 2026 }, { r })
out.FB = M.expectedPvSingle({ dob: f(1956, 5, 1), sex: 'male', currentAge: 70, pia: 3379.2, claim: { years: 67, months: 0 }, startYear: 2026 }, { r })
out.FBpast = 3 * 12 * 3379.2 * M.retirementFactor(f(1956, 5, 1), 804)
out.PB56 = M.paidIn(Array.from({ length: 40 }, (_, i) => ({ year: 1978 + i, amount: 50000 })), { selfEmployed: false, startYear: 2026, inflationPct: 2.5 })
out.pia56 = M.piaFromEarnings(f(1956, 5, 1), Array.from({ length: 40 }, (_, i) => ({ year: 1978 + i, amount: 50000 })), { statuteBase: true }).pia
console.log(JSON.stringify(out, null, 1))
