/**
 * Source-contract controls for State 47 records that make no new calculator
 * claim. These deliberately inspect the published authority and statement:
 * ND and IN are bounded negative claims, and MI's (9)(e) limb prevents an
 * invented condition. A numeric state-tax fixture would not discriminate any
 * of those evidentiary questions.
 */
import { expect, it } from 'vitest'

import { TAX_RULE_REGISTRY } from '../rules/taxRuleRegistry.js'

function record(id: keyof typeof TAX_RULE_REGISTRY) {
  return TAX_RULE_REGISTRY[id]
}

it('keeps North Dakota’s retirement negative bounded by its closed adjustment authority', () => {
  const nd = record('ndcc-57-38-30-3-2-closed-subtraction-list')

  // Negative control: the record may not turn silence into a claim that the
  // statute literally says “private pensions are taxable.” Its statement must
  // instead identify the bounded adjustment authority and the named exceptions.
  expect(nd.statement).toContain('closed enumeration')
  expect(nd.statement).toContain('retired military personnel benefits')
  expect(nd.statement).toContain('retired law enforcement personnel benefits')
  expect(nd.authority.some(({ quotedText }) =>
    quotedText.includes('only eligible for those adjustments or credits that are specifically provided'),
  )).toBe(true)
})

it('keeps Indiana’s no-general-pension conclusion anchored in the current DOR list', () => {
  const indiana = record('ic-6-3-2-no-general-retirement-deduction')

  // Negative control: both taxable pensions and the expressly nontaxable list
  // must remain on-record, so a future broad deduction cannot hide behind an
  // old inference from the absence of a private-pension line.
  expect(indiana.authority.some(({ quotedText }) =>
    quotedText.includes('Pensions (taxable portion)') && quotedText.includes('Annuities (taxable portion)'),
  )).toBe(true)
  expect(indiana.authority.some(({ quotedText }) =>
    quotedText.includes('Social Security Railroad retirement benefits'),
  )).toBe(true)
  expect(indiana.statement).toContain('no general public-pension deduction')
})

it('preserves Michigan’s permanent 2026-and-after ordinary retirement guidance', () => {
  const michigan = record('mi-mcl-206-30-retirement-and-ss')

  // Negative control: the 2026 permanent rule cannot be silently recast as a
  // birth-cohort condition. The RAB quote is the operative current guidance.
  expect(michigan.authority.some(({ quotedText }) =>
    quotedText.includes('Tax year 2026 and each year thereafter') &&
    quotedText.includes('regardless of year of birth'),
  )).toBe(true)
  expect(michigan.statement).toContain('no birth-year test')
})


/** Exhaustive original-to-authority mapping. This proves record integrity only;
 * monetary and refusal fixtures remain independently required by conformance. */
const originals: Readonly<Record<string, readonly string[]>> = {
  'rule-043/rule-043-candidate-iowa-disability-survivor-limbs': ['iowa-code-422-7-19-a-retirement-income-exclusion'],
  'rule-044/rule-044-nd-closed-list-negative-authority-gap': ['ndcc-57-38-30-3-2-closed-subtraction-list'],
  'rule-045/rule-045-in-no-pension-negative-underquoted': ['ic-6-3-2-no-general-retirement-deduction'],
  'rule-045/rule-045-mi-ss-9e-limb-unquoted-and-url-unfetched': ['mi-mcl-206-30-f-iii-social-security', 'mi-mcl-206-30-9-e-nonconditioning'],
  'rule-047/rule-047-sc-public-pension-full-override-unregistered': ['sc-code-12-6-1170-retirement-income-deduction', 'sc-code-12-6-1171-military-retirement'],
  'rule-048/rule-048-ar-307-ira-age-gate-undisclosed': ['aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate'],
  'rule-050/rule-050-F3': ['la-rs-47-44-2-social-security-federal-retirement'],
  'vault-023/F5': ['ca-hsa-state-basis-nonconformity', 'nj-hsa-state-basis-nonconformity'],
  'vault-024/F3': ['state-direct-qcd-conformity-policies', 'hi-direct-qcd-conformity', 'ks-direct-qcd-conformity', 'nj-direct-qcd-ira-basis-treatment'],
  'vault-033/vault-033-f1': ['state-direct-qcd-conformity-policies', 'hi-direct-qcd-conformity', 'ks-direct-qcd-conformity', 'nj-direct-qcd-ira-basis-treatment'],
  'vault-033/vault-033-f2': ['ca-hsa-state-basis-nonconformity', 'nj-hsa-state-basis-nonconformity'],
  'vault-036/vault-036-f001': ['co-crs-39-22-104-social-security-inclusion'],
  'vault-036/vault-036-f002': ['co-39-22-104-p-7-high-income-addback'],
  'vault-036/vault-036-f003': ['co-crs-39-22-104-federal-base-and-pension-cap'],
  'vault-037/vault-037-f002': ['de-code-30-1106-social-security-retirement-subtractions'],
  'vault-037/vault-037-f003': ['dc-code-47-1803-03-government-survivor-exclusion'],
  'vault-037/vault-037-f004': ['ct-personal-exemption-and-ct-agi-schedule'],
  'vault-037/vault-037-f005': ['de-early-distribution-gate'],
  'vault-039/vault-039-f001': ['iowa-code-422-5-alternate-minimum-tax'],
  'vault-039/vault-039-f003': ['hi-head-of-household-rate-schedule'],
  'vault-040/vault-040-f001': ['id-code-63-3022a-qualified-retirement-deduction'],
  'vault-040/vault-040-f002': ['il-ita-203-a-2-F-retirement-income-subtraction', 'il-personal-exemption-2026'],
  'vault-040/vault-040-f004': ['iowa-code-422-7-19-a-retirement-income-exclusion'],
  'vault-041/vault-041-f1': ['ks-stat-79-32-117-public-pension-exclusion'],
  'vault-042/F001': ['ky-dor-2026-standard-deduction-once-per-return'],
  'vault-042/F003': ['la-rs-47-44-1-retirement-exemption'],
  'vault-043/vault-043-f001': ['md-tax-10-209-pension-exclusion'],
  'vault-043/vault-043-f005': ['ma-personal-exemptions-and-surtax', 'ma-private-pension-basis-recovery', 'ma-rrb-and-public-pension-exclusions'],
  'vault-045/vault-045-f001': ['mo-retirement-income-deduction'],
  'vault-046/vault-046-f003': ['mt-long-term-capital-gain-schedule'],
  'vault-048/vault-048-f001': ['nj-stat-54a-6-26-military-pension-exclusion'],
  'vault-053/F-053-02': ['or-316-157-retirement-income-credit'],
  'vault-054/F-054-04': ['sc-code-12-6-1170-b-age-65-deduction', 'sc-code-12-6-1171-military-retirement'],
  'vault-054/F-054-05': ['sc-code-12-6-1170-retirement-income-deduction'],
  'vault-055/vault-055-f002': ['sc-sciad-act-110-retirement-income-deduction'],
  'vault-055/vault-055-f005': ['ut-code-59-10-1043-military-retirement-credit'],
  'vault-056/vault-056-f003': ['ut-code-59-10-114-social-security-tax-credit', 'ut-code-59-10-1019-retirement-credit', 'ut-code-59-10-114-2-d-railroad-benefits-not-modeled', 'ut-code-59-10-114-2-i-401a-prior-state-tax-subtraction', 'ut-code-59-10-1043-military-retirement-credit'],
  'vault-056/vault-056-f005': ['va-code-58-1-322-02-28-military-retirement-subtraction'],
  'vault-057/vault-057-f001': ['vt-2026-rates-standard-deduction-minimum-tax'],
  'vault-057/vault-057-f002': ['vt-32-5822-a-6-minimum-tax'],
  'vault-057/vault-057-f003': ['va-code-58-1-322-02-3-ss-tier1'],
  'vault-057/vault-057-f004': ['vt-32-5830e-retirement-election', 'vt-32-5830e-d-military-survivor', 'vt-32-5823-railroad-exclusion', 'va-code-58-1-322-02-11-basis'],
  'vault-058/WI-RATES-SD-PHASEDOWN-UNMODELED': ['wi-2026-rates-standard-deduction-exemptions'],
  'vault-059/vault-059-f2-wv-exemptions-unmodeled': ['wv-code-11-21-exemptions-retirement-public-ss'],
  'vault-059/vault-059-f3-wv-age65-approximation': ['wv-code-11-21-12-c9-age-disability-residual'],
  'vault-059/vault-059-f4-wv-public-military-rrb-gaps': ['wv-code-11-21-12-c5-c6-public-retirement', 'wv-code-11-21-12-c7-military', 'wv-code-11-21-12-c12-railroad'],
  'vault-059/vault-059-f5-wv-ss-phase-in-unmodeled': ['wv-code-11-21-12-c8-social-security-phase-in'],
}

it('maps all 47 original identities to live records with primary evidence and actual implementation references', () => {
  expect(Object.keys(originals)).toHaveLength(47)
  const registry: Readonly<Record<string, { authority: readonly { url: string; quotedText: string }[]; implementedByFunctions: readonly string[] }>> = TAX_RULE_REGISTRY
  for (const [original, ids] of Object.entries(originals)) {
    expect(ids.length, original).toBeGreaterThan(0)
    for (const id of ids) {
      const entry = registry[id]
      expect(entry, `${original}: missing ${id}`).toBeDefined()
      expect(entry.authority.length, id).toBeGreaterThan(0)
      expect(entry.authority.every((a) => a.url.startsWith('https://') && a.quotedText.trim().length > 0), id).toBe(true)
      expect(entry.implementedByFunctions.length, id).toBeGreaterThan(0)
    }
  }
})

it('does not sunset Michigan Social Security with the separate non-conditioning window', () => {
  expect(record('mi-mcl-206-30-f-iii-social-security').effectiveThrough).toBeNull()
  const socialSecurity = record('mi-mcl-206-30-f-iii-social-security')
  expect(socialSecurity.authority.some((a) =>
    a.quotedText.includes('2026 through 2028') && a.quotedText.includes('may subtract both'),
  )).toBe(true)
})

it('keeps New Jersey HSA lifecycle uncertainty visible and separates state QCD policies', () => {
  expect(record('nj-hsa-state-basis-nonconformity').classification).toBe('unsettled')
  expect(record('state-direct-qcd-conformity-policies').statement).toContain('$100,000')
  expect(record('hi-direct-qcd-conformity').jurisdiction).toBe('state:HI')
  expect(record('ks-direct-qcd-conformity').statement).toContain('charitable-credit')
})


it('bounds Michigan Tier 3 non-conditioning evidence to its cohort and 2026–2028 window', () => {
  const temporary = record('mi-mcl-206-30-9-e-nonconditioning')
  expect(temporary.effectiveFrom).toBe(2026)
  expect(temporary.effectiveThrough).toBe(2028)
  expect(temporary.classification).toBe('outOfScope')
  const source = temporary.authority.map((a) => a.quotedText).join(' ')
  expect(source).toContain('born after 1952 who reach the age of 67')
  expect(source).toContain('For tax years prior to 2026 and after 2028')
  expect(source).toContain('their standard deduction must be reduced')
  expect(source).toContain('taxable Social Security')
  expect(record('mi-mcl-206-30-f-iii-social-security').effectiveThrough).toBeNull()
})
