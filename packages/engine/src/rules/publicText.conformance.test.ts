import { describe, expect, it } from 'vitest'
import { APPROXIMATION_KINDS, type ApproximationEntry } from './approximationKinds.js'
import { CALCULATION_REGISTRY, type CalculationRecord } from './calculationRegistry.js'
import { publicTextProblems, usesSpacedHyphenAsDash } from './publicText.js'
import { TAX_RULE_REGISTRY, type TaxRuleRecord } from './taxRuleRegistry.js'

/** One rendered field: where it is, its text, and whether it is code-like (held to the dash bans only). */
type Field = readonly [where: string, text: string | null, code?: boolean]

/**
 * What the site prints from a tax rule, plus its contrary reading (skipped
 * when null). The authorities' quotedText is
 * the source's own words and is exempt; a url is an address, not text.
 */
function ruleFields(id: string, record: TaxRuleRecord): readonly Field[] {
  return [
    [id + ' title', record.title],
    [id + ' conventionRationale', record.conventionRationale],
    [id + ' contraryReading', record.contraryReading],
    ...record.authority.map((authority, index): Field => [id + ' authority[' + index + '].citation', authority.citation]),
  ]
}

/** What the site prints beside an approximated rule. A fix entry publishes nothing of its own. */
function approximationFields(id: string, entry: ApproximationEntry): readonly Field[] {
  switch (entry.kind) {
    case 'fix':
      return []
    case 'needs-fact':
      return [[id + ' missingInput', entry.missingInput]]
    case 'convention':
      return [[id + ' reason', entry.reason]]
  }
}

/** What the site prints from a calculation record. */
function calculationFields(id: string, record: CalculationRecord): readonly Field[] {
  const formula = record.formula
  const justification = record.justification
  return [
    [id + ' title', record.title],
    [id + ' purpose', record.purpose],
    [id + ' statement', record.statement],
    ...record.limits.map((limit, index): Field => [id + ' limits[' + index + ']', limit]),
    ...(formula === null
      ? []
      : [
          [id + ' formula.expression', formula.expression, true] as const,
          [id + ' formula.timing', formula.timing] as const,
          [id + ' formula.rounding', formula.rounding] as const,
          ...formula.variables.flatMap((variable, index): Field[] => [
            [id + ' variables[' + index + '].symbol', variable.symbol, true],
            [id + ' variables[' + index + '].meaning', variable.meaning],
            [id + ' variables[' + index + '].unit', variable.unit],
            [id + ' variables[' + index + '].domain', variable.domain],
          ]),
        ]),
    ...(justification.kind === 'dataset'
      ? [
          [id + ' dataset.citation', justification.source.citation] as const,
          [id + ' dataset.asOf', justification.source.asOf] as const,
          [id + ' dataset.retrievedOn', justification.source.retrievedOn] as const,
        ]
      : []),
    ...(justification.kind === 'assumption'
      ? [
          [id + ' assumption.rationale', justification.rationale] as const,
          [id + ' assumption.intendedUse', justification.intendedUse] as const,
          [id + ' assumption.errorBound', justification.errorBound] as const,
        ]
      : []),
  ]
}

function violations(fields: readonly Field[]): readonly string[] {
  return fields.flatMap(([where, text, code]) =>
    text === null ? [] : publicTextProblems(text, { code }).map((problem) => where + ' ' + problem),
  )
}

const rules: Readonly<Record<string, TaxRuleRecord>> = TAX_RULE_REGISTRY
const kinds: Readonly<Record<string, ApproximationEntry>> = APPROXIMATION_KINDS
const calculations: Readonly<Record<string, CalculationRecord>> = CALCULATION_REGISTRY

describe('public text conformance', () => {
  it('prints every tax rule in plain public text', () => {
    expect(violations(Object.entries(rules).flatMap(([id, record]) => ruleFields(id, record)))).toEqual([])
  })

  it('prints every approximation kind in plain public text', () => {
    expect(violations(Object.entries(kinds).flatMap(([id, entry]) => approximationFields(id, entry)))).toEqual([])
  })

  it('prints every calculation record in plain public text', () => {
    expect(violations(Object.entries(calculations).flatMap(([id, record]) => calculationFields(id, record)))).toEqual([])
  })

  it('reaches every field it claims to, so an empty result cannot come from reading nothing', () => {
    // Coverage probes for the walkers above: a field the site renders that
    // the walker silently skipped would pass the three tests vacuously.
    const ruleFieldCount = Object.entries(rules).flatMap(([id, record]) => ruleFields(id, record)).length
    const calculationFieldNames = new Set(
      Object.entries(calculations)
        .flatMap(([id, record]) => calculationFields(id, record))
        .map(([where]) => where.slice(where.indexOf(' ') + 1).replace(/\[\d+\]/gu, '[]')),
    )
    const justificationKinds = new Set(Object.values(calculations).map((record) => record.justification.kind))
    expect(ruleFieldCount).toBeGreaterThan(Object.keys(rules).length * 3)
    expect(Object.entries(kinds).flatMap(([id, entry]) => approximationFields(id, entry)).length).toBeGreaterThan(0)
    for (const name of [
      'title', 'purpose', 'statement', 'limits[]', 'formula.expression', 'formula.timing', 'formula.rounding',
      'variables[].symbol', 'variables[].meaning', 'variables[].unit', 'variables[].domain',
      ...(justificationKinds.has('dataset') ? ['dataset.citation', 'dataset.asOf', 'dataset.retrievedOn'] : []),
      ...(justificationKinds.has('assumption') ? ['assumption.rationale', 'assumption.intendedUse', 'assumption.errorBound'] : []),
    ]) {
      expect(calculationFieldNames.has(name), name).toBe(true)
    }
  })

  it('checks at least one citation for every tax rule', () => {
    // The record type demands a non-empty authority list at compile time
    // (TaxRuleRecordCommonFields.authority in taxRuleRegistry.ts), and
    // taxRuleRegistry.conformance.test.ts requires a state rule to rest on a
    // source from its own state; no suite checked the non-empty list at run
    // time for every rule, so a rule that reached the registry with no
    // authority would pass the citation check above vacuously.
    const withoutCitation = Object.entries(rules)
      .filter(([id, record]) => !ruleFields(id, record).some(([where]) => where.startsWith(id + ' authority[')))
      .map(([id]) => id)
    expect(withoutCitation).toEqual([])
  })

  it('refuses every banned form, in any case where the ban is case-blind', () => {
    for (const text of [
      'a golden case',
      'Fixtures kept',
      'one fixture',
      'the Exact Ledger re-prices',
      'the exact  ledger',
      'priced on the exact-ledger path',
      'a regression',
      'the test harness',
      'a parameter pack',
      'state packs',
      'the 2026 vintage',
      'DEFECT noted',
      'this registry slice',
      'omission fails closed',
      'a fail-closed reading',
      'the candidate patch',
      'a scenario patch',
      'the tier-edge detector',
      'a no-op',
      'the MAGI cascade',
      'a feature-off plan',
      'runs in a Web Worker',
      'two parts—one clause',
      'two parts -- one clause',
      'two parts – one clause',
    ]) {
      expect(publicTextProblems(text), text).not.toEqual([])
    }
  })

  it('passes what merely contains a banned form', () => {
    for (const text of [
      'packages/engine/src/params/index.ts#irmaaTierThreshold',
      'indexFederalTaxPack',
      'packaging and unpacked backpacks',
      'packet B2-P1',
      'a known defect',
      'the Roth taxable slice',
      'D-INHERITED-ROTH-SLICE',
      'the full year-by-year projection re-prices candidates',
      'a ledger of gifts',
      'the exact-cent ledger',
      'goldenrod harnessing',
      'model/plan.test.ts',
      'lines 7–8',
      'two parts, one clause',
      'a well-known rule',
      'x = (e - 0.5)',
    ]) {
      expect(publicTextProblems(text), text).toEqual([])
    }
  })

  it('reads a spaced hyphen between words as a dash', () => {
    for (const text of [
      // The three forms this rule was added for, as they read before their rewrites.
      'records the coordination truthfully rather than omitting it - `rmdSatisfiedAmount` is zero',
      'rest on the Form 8606 instructions and Publication 590-B - uniform administrative practice, publication-level authority.',
      'from 83 percent at depletion to 65 percent by 2100 - a one-step stand-in for a declining path.',
      'Amendment note to IRC 1400Z-2, P.L. 119-21 sec. 70421 - post-2026 (a)(2)',
      'IRC 408(d)(2) - the aggregation rule',
      'a plan - not a forecast',
      'income - deduction',
      // A middle dot is a prose separator, not an arithmetic sign, so it does
      // not excuse a dash in the same clause.
      "the card shows 'Pat · Wages' - a label the ledger never prices",
    ]) {
      expect(usesSpacedHyphenAsDash(text), text).toBe(true)
      expect(publicTextProblems(text), text).toContain('uses a spaced hyphen as a dash')
    }
  })

  it('does not read subtraction or a range as a dash', () => {
    for (const text of [
      // Ranges: two numbers.
      'lines 7 - 8',
      'ages 62 - 70',
      'from $1,000 - $2,000 a year',
      'tax years 2026 - 2030',
      // Inside brackets, absolute-value bars or a code span.
      'unfundedPv = max(0, E - G)',
      'max(5, planning age - current age)',
      'the record minimizing |year(maturityIso) - target|, comparing calendar years only',
      'sum over t of [1 - (1 - S_A(t))(1 - S_B(t))]',
      'rather than `Math.abs(x - 1) < 1e-9` alone',
      // An arithmetic sign in the same clause.
      'difference = debits - credits',
      'investable close opening + contributions - withdrawals at a zero return',
      'offset t = year - startYear on the TIPS par curve',
      // Two operands.
      'takes 1 - guardrailFactor as the cut depth',
      'the complement of both being dead, 1 - (1 - S_a)(1 - S_b)',
      'careCost - ltcBenefit',
      'the gap P - b',
    ]) {
      expect(usesSpacedHyphenAsDash(text), text).toBe(false)
      expect(publicTextProblems(text), text).toEqual([])
    }
  })

  it('holds a code-like field to the dash bans that cannot be arithmetic, and only those', () => {
    expect(publicTextProblems('saltCapForYear(pack, year)', { code: true })).toEqual([])
    expect(publicTextProblems('fixture - golden', { code: true })).toEqual([])
    expect(publicTextProblems('w(y) = a + t (b - a)', { code: true })).toEqual([])
    expect(publicTextProblems('a—b', { code: true })).toEqual(['uses an em dash'])
    expect(publicTextProblems('a – b', { code: true })).toEqual(['uses a spaced en dash'])
    expect(publicTextProblems('a -- b', { code: true })).toEqual(['uses a double hyphen used as a dash'])
  })
})
