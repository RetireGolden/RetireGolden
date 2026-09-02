/**
 * Pins for the "absurd value accepted silently" Design QA cluster (#490,
 * #495, #496, #503, #508, #511, #516, #524, #540, #545, #548, #550, #551).
 * The engine still decides what is valid; these hold the source-level wiring
 * (a field carries its schema path, or the engine's own bound in the field's
 * unit) and the compact KPI formatter. Rendered behaviour is covered in
 * validationClusterF.test.tsx.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { fmtMoneyCompact, parseAmount } from './format'
import { boundsForPath } from './schemaBounds'
import { labelOfPath, parseIssue } from './validationIssues'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

describe('cluster F: fields carry the engine bound or its path', () => {
  it('the fields the walk cited carry their schema path, so the engine issue lands beside them', () => {
    const pins: Array<[string, string[]]> = [
      // #540: Charity share 250% was counted in the header with nothing at the field.
      ['./sections/AccountEditorSharedFields.tsx', ['path={`accounts.${index}.estateBeneficiary.charityPct`}']],
      // #516: Annuity taxable share 99999% was accepted with no field error.
      ['./sections/PensionAnnuityAccountEditors.tsx', [
        'path={`accounts.${index}.taxablePct`}',
        'path={`accounts.${index}.survivorPct`}',
        'path={`accounts.${index}.payoutForm.survivorPct`}',
        'path={`accounts.${index}.payoutForm.certainYears`}',
      ]],
      // #496: Qualified dividends 999% was clamped to 100 with no feedback.
      ['./sections/LiquidAccountEditors.tsx', ['path={`accounts.${index}.qualifiedRatio`}']],
    ]
    for (const [file, paths] of pins) {
      const src = read(file)
      for (const p of paths) expect(src, `${file} ${p}`).toContain(p)
    }
  })

  it('the pension editor and the annuity editor each carry the paths their shared fields need', () => {
    // The two editors render the same fields from separate JSX, so a single
    // `toContain` could pass with one of them unwired.
    const src = read('./sections/PensionAnnuityAccountEditors.tsx')
    const split = src.indexOf('export function AnnuityAccountEditor')
    expect(split).toBeGreaterThan(0)
    const pension = src.slice(src.indexOf('export function PensionAccountEditor'), split)
    const annuity = src.slice(split)
    for (const p of ['path={`accounts.${index}.colaPct`}', 'path={`accounts.${index}.monthlyAmount`}']) {
      expect(pension, `pension ${p}`).toContain(p)
      expect(annuity, `annuity ${p}`).toContain(p)
    }
    // Start age is the pension's alone. A bound read by path is one number for
    // `accounts.N.startAge` (the schema's pension branch, 40–80), while the
    // annuity's ceiling is the contract's own: the QLAC / non-QLAC latest start
    // for its purchase, computed per account.
    expect(pension).toContain('path={`accounts.${index}.startAge`}')
    expect(annuity).not.toContain('path={`accounts.${index}.startAge`}')
    expect(annuity).toContain('max={startAgeBounds?.binding ?? ANNUITY_MAX_START_AGE}')
  })

  it('shares stored as engine-bounded percents reach the field as that bound (0–100, or 1–100 for a joint-survivor share)', () => {
    // Every bound is the engine's, read from its schema by the path the field
    // carries (schemaBounds.ts): nothing here is a range the UI chose.
    expect(boundsForPath('accounts.0.estateBeneficiary.charityPct')).toEqual({ min: 0, max: 100 })
    expect(boundsForPath('accounts.0.taxablePct')).toEqual({ min: 0, max: 100 })
    expect(boundsForPath('accounts.0.survivorPct')).toEqual({ min: 0, max: 100 })
    expect(boundsForPath('accounts.0.payoutForm.survivorPct')).toEqual({ min: 1, max: 100 })
    expect(boundsForPath('accounts.0.payoutForm.certainYears')).toEqual({ min: 1, max: 40 })
    // The engine's 0–1 ratio, in the percent unit the card shows it in.
    expect(boundsForPath('accounts.0.qualifiedRatio')).toMatchObject({ min: 0, max: 100 })
    // Both Qualified dividends fields (plain and override) carry that path.
    const liquid = read('./sections/LiquidAccountEditors.tsx')
    expect(liquid.match(/path=\{`accounts\.\$\{index\}\.qualifiedRatio`\}/g)).toHaveLength(2)
  })

  it('the Relocation candidate knobs keep the ranges they already had, which the number field now enforces (#490, #551)', () => {
    const src = read('./RelocationComparePage.tsx')
    expect(src).toMatch(/label="Move year \(optional\)"[\s\S]*?min=\{startYear\}\s*max=\{startYear \+ 60\}/)
    expect(src).toMatch(/label="Local income tax \(optional\)"[\s\S]*?min=\{0\}\s*max=\{10\}/)
    expect(src).toMatch(/label="Spending adjustment \(optional\)"[\s\S]*?min=\{-50\}\s*max=\{50\}/)
  })

  it('the Social Security claim-age months field carries the engine range and its path (#511)', () => {
    const src = read('./SocialSecuritySection.tsx')
    expect(src).toContain('path={`incomes.${streamIndex}.claimAge.months`}')
    expect(boundsForPath('incomes.2.claimAge.months')).toEqual({ min: 0, max: 11 })
  })

  it('the premium mode select clears a premium end age the schema no longer wants (#503)', () => {
    const src = read('./sections/InsuranceSection.tsx')
    // The keep/drop check reads the schema of the policy kind being edited, and
    // both sides of the switch leave an age that schema accepts, or none.
    expect(src).toContain("const schema = p.kind === 'ltc' ? ltcPolicySchema : permanentLifePolicySchema")
    expect(src).toContain('const endAgeParses = schema.shape.premiumEndAge.safeParse(p.premiumEndAge).success')
    expect(src).toContain('if (p.premiumEndAge === undefined || !endAgeParses) p.premiumEndAge = 65')
    expect(src).toContain('} else if (!endAgeParses) delete p.premiumEndAge')
  })

  it('issue labels for the newly wired paths read as the cards do', () => {
    expect(labelOfPath('accounts.0.estateBeneficiary.charityPct')).toBe('Account 1: Estate beneficiary › Charity share')
    expect(labelOfPath('accounts.2.taxablePct')).toBe('Account 3: Taxable share')
    expect(labelOfPath('accounts.1.survivorPct')).toBe('Account 2: Survivor benefit')
    expect(labelOfPath('accounts.1.payoutForm.survivorPct')).toBe('Account 2: Survivor share')
    expect(labelOfPath('accounts.1.payoutForm.certainYears')).toBe('Account 2: Guaranteed years')
    expect(labelOfPath('accounts.0.colaPct')).toBe('Account 1: COLA')
    expect(labelOfPath('accounts.0.monthlyAmount')).toBe('Account 1: Monthly amount')
  })

  it('a stored qualifiedRatio outside the engine\'s 0–1 reads its bound in the field\'s percent unit', () => {
    // The card shows "Qualified dividends" as a percent; the engine bounds the ratio.
    expect(parseIssue('accounts.1.qualifiedRatio: Too big: expected number to be <=1').advice).toBe('Must be at most 100')
    expect(parseIssue('accounts.1.qualifiedRatio: Too small: expected number to be >=0').advice).toBe('Must be at least 0')
    expect(parseIssue('accounts.1.qualifiedRatio: Too big: expected number to be <=1').label).toBe('Account 2: Qualified dividends')
    // Other bounds are untouched.
    expect(parseIssue('accounts.1.taxablePct: Too big: expected number to be <=100').advice).toBe('Must be at most 100')
  })
})

describe('cluster F: compact KPI money degrades by magnitude, never by digit count (#495, #548)', () => {
  it('keeps the existing k and M forms', () => {
    expect(fmtMoneyCompact(0)).toBe('$0')
    expect(fmtMoneyCompact(8_200)).toBe('$8,200')
    expect(fmtMoneyCompact(45_200)).toBe('$45k')
    expect(fmtMoneyCompact(1_240_000)).toBe('$1.24M')
    expect(fmtMoneyCompact(-1_240_000)).toBe('−$1.24M')
    expect(fmtMoneyCompact(999_990_000)).toBe('$999.99M')
    // The k tier hands off before it would read $1000k.
    expect(fmtMoneyCompact(999_499)).toBe('$999k')
    expect(fmtMoneyCompact(999_500)).toBe('$1.00M')
    expect(fmtMoneyCompact(999_999.6)).toBe('$1.00M')
  })

  it('scales to B and T instead of a six-digit mantissa in millions', () => {
    // The walk's cash balance 999,999,999,999 read "$999998.61M"; it is a trillion.
    expect(fmtMoneyCompact(999_998_610_000)).toBe('$1.00T')
    expect(fmtMoneyCompact(999_999_999_999)).toBe('$1.00T')
    expect(fmtMoneyCompact(431_904_740_000)).toBe('$431.90B')
    expect(fmtMoneyCompact(2_500_000_000)).toBe('$2.50B')
    expect(fmtMoneyCompact(999_995_000)).toBe('$1.00B')
    expect(fmtMoneyCompact(1.2e12)).toBe('$1.20T')
    expect(fmtMoneyCompact(-370_261_372_999_000)).toBe('−$370.26T')
  })

  it('past 999T there is no unit left: a short bare exponent, never "e+37M"', () => {
    const s = fmtMoneyCompact(1.181e37)
    expect(s).toBe('$1.18e+37')
    // The T tier hands off exactly where its mantissa would round to 1000, never $1000.00T.
    expect(fmtMoneyCompact(999_994_000_000_000)).toBe('$999.99T')
    expect(fmtMoneyCompact(999_995_000_000_000)).toBe('$1.00e+15')
    expect(fmtMoneyCompact(1e15)).toBe('$1.00e+15')
    // The walk's "$3702613729.99M today's $" subline (#495) is 3.7 quadrillion.
    expect(fmtMoneyCompact(3_702_613_729_990_000)).toBe('$3.70e+15')
    expect(s).not.toMatch(/[kMBT]$/)
    expect(s.length).toBeLessThanOrEqual(10)
    expect(fmtMoneyCompact(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('every form the formatter emits parses back into a money field, sign and all', () => {
    // Each tier the formatter can emit, back through the field: the suffixes,
    // the bare exponent past 999T, and the Unicode minus a negative carries.
    expect(parseAmount(fmtMoneyCompact(45_000))).toBe(45_000)
    expect(parseAmount(fmtMoneyCompact(2_500_000_000))).toBe(2_500_000_000)
    expect(parseAmount(fmtMoneyCompact(1.2e12))).toBe(1.2e12)
    expect(parseAmount(fmtMoneyCompact(1e15))).toBe(1e15)
    expect(parseAmount(fmtMoneyCompact(1.181e37))).toBe(1.18e37)
    expect(fmtMoneyCompact(-370_261_372_999_000)).toBe('−$370.26T')
    expect(parseAmount('−$370.26T')).toBe(-370.26e12)
    expect(parseAmount('$45k')).toBe(45_000)
    expect(parseAmount('1.5m')).toBe(1_500_000)
    expect(parseAmount('3B')).toBe(3e9)
    expect(parseAmount('0.5t')).toBe(5e11)
    expect(parseAmount('nope')).toBeNull()
    // A bare suffix is a stray keystroke, not a balance of zero.
    for (const stray of ['k', 'm', 'B', 't', '−']) expect(parseAmount(stray), stray).toBeNull()
  })
})
