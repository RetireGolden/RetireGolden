/**
 * RMD and QCD calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const rmdRecords = {
  'qcd-income-offset-qualified-slice': {
    title: 'QCD income offset and qualified slice',
    purpose: 'Separate the physical charitable gift from the slice of it that is excluded from income.',
    kind: 'composition',
    outputs: ['qcd-annual'],
    feeds: ['tax-total-annual', 'magi-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.qcd publishes the gross physical gift while its excludable income offset is the qualified from-RMD slice less the remaining section 408(d)(8)(A) second-sentence offset; projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan computes that character, with the qualification ceiling being the owner\'s aggregate includible IRA amount (pre-distribution owned-IRA balance less aggregate basis) rather than the taxable fraction of the RMD. Gift beyond the RMD carries no offset; gift beyond aggregate includible dollars is non-qualified ordinary distribution charged to the from-RMD portion first; rmd stays gross. Units: nominal USD. Rounding: none.',
    formula: {
      expression:
        'qualified = min(gift, max(0, preDistribution - basis)); offsetApplied = min(qualified, max(0, section219 - alreadyTaken)); nonQualified = gift - qualified; nonQualifiedFromRmd = min(fromRmd, nonQualified); qualifiedFromRmd = fromRmd - nonQualifiedFromRmd; incomeOffsetDelta = min(qualifiedFromRmd, qualified - offsetApplied)',
      variables: [
        { symbol: 'gift', meaning: 'Gross physical gift for the owner-year', unit: 'usd/year', domain: 'nonnegative' },
        { symbol: 'fromRmd', meaning: 'Part of the gift that satisfied the RMD', unit: 'usd/year', domain: '0 <= fromRmd <= gift' },
        { symbol: 'preDistribution', meaning: 'Pre-distribution aggregate owned-IRA balance', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'basis', meaning: 'Aggregate nondeductible IRA basis', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'section219', meaning: 'Post-70.5 deductible section 219 contributions, net of reductions already consumed', unit: 'usd', domain: 'nonnegative' },
      ],
      timing: 'one owner-year',
      rounding: 'none; the cross-year donor-offset ledger is carried in integer cents',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/qcd-income-offset-qualified-slice.md',
    },
    limits: [
      'The qualification ceiling is statutory: section 408(d)(8)(B), last sentence, treats a distribution as a qualified charitable distribution only to the extent it would be includible in gross income, and section 408(d)(8)(D) measures that extent as if every IRA of the owner were one contract distributed in full, which is the aggregate includible amount (pre-distribution owned-IRA balance less aggregate basis) this record uses; the second sentence of section 408(d)(8)(A) supplies the post-70.5 section 219 reduction. The allocation of the non-qualified remainder between the from-RMD and beyond-RMD portions has no statutory text and is an engine convention: the remainder is charged to the from-RMD portion first. Either order gives the same total ordinary inclusion (25,000 on the worksheet inputs: 50,000 - 35,000 + 10,000 under a qualified-first allocation, 50,000 - 30,000 + 5,000 under the engine\'s), so tax-total-annual and magi-annual do not depend on the order; only the split between the two published character rows does. The worksheet was first derived on the qualified-first order and re-derived on the engine\'s; the evidence pins the re-derived 30,000 and 5,000 and is green. The gross gift (YearResult.qcd) and the gross RMD are written by the gift planner and the RMD phase, not by the character planner this fixture exercises, so they are not asserted here.',
      'The evidence asserts the qualified slice through the exported plan builder rather than reading a private local: the slice is recovered from the published qualifiedFromRmd and nonQualifiedBeyondRmd rows',
      'An unprovable or contradictory offset history fails closed to a zero exclusion and writes nothing to the cross-year ledger; this record is asserted on a provable history',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.qcd',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'qcd-limit-and-age-proxy': {
    title: 'QCD per-donor limit and age-70.5 annual proxy',
    purpose: 'Cap each donor at the indexed annual QCD limit and gate eligibility on the annual age proxy.',
    kind: 'data',
    outputs: ['qcd-annual'],
    feeds: ['tax-total-annual', 'magi-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.qcd caps each donor at year2026.rmd.qcdAnnualLimit multiplied by the applicable limit-growth factor, and uses an annual proxy for age 70.5: eligible at attained age 71, or at attained age 70 when the birth month is June or earlier. projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan applies both, with the household scalar capped at the sum of the per-donor caps and unused capacity never pooled into a donor who has already exhausted their own limit. Units: nominal USD per donor per year. Rounding: none; a full drain of a source publishes whole ledger cents.',
    formula: {
      expression:
        'eligible(p) = alive(p) and (age(p) >= 71 or (age(p) = 70 and birthMonth(p) <= 6)); cap = qcdAnnualLimit x limitGrowth; requested = min(qcdAnnual x inflFactor, cap x donorCount)',
      variables: [
        { symbol: 'qcdAnnualLimit', meaning: 'year2026.rmd.qcdAnnualLimit', unit: 'usd/donor/year', domain: 'positive' },
        { symbol: 'limitGrowth', meaning: 'Limit-growth factor to the projection year; 1 in the published pack year', unit: '1', domain: 'positive' },
        { symbol: 'age(p)', meaning: 'Attained age of person p this year', unit: 'years', domain: 'integer >= 0' },
        { symbol: 'birthMonth(p)', meaning: 'Birth month of person p', unit: 'month', domain: 'integer 1..12' },
      ],
      timing: 'one projection year, per donor',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/qcd-limit-and-age-proxy.md',
    },
    limits: [
      'The age gate is an annual proxy for 70.5, not a dated test: a July-born donor attaining 70 is refused for the whole year even though the statute would admit the second half of it',
      'The cap is per donor, not per household: a two-donor plan carries twice the capacity, and the scalar arm never pools one donor\'s unused capacity into another',
      'The evidence exercises the scalar arm (no named QCD request); a named request returns an empty plan from this helper and is a different path',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.qcd',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'rmd-applicable-age-attain-year': {
    title: 'RMD applicable age and attain year',
    purpose: 'Place a 1951-1958 owner in the settled age-73 cohort and derive the year that age is attained.',
    kind: 'data',
    outputs: [],
    feeds: ['rmd-required-annual'],
    statement:
      'rmd/applicableAge.ts#applicableAgeAttainYears assigns an owner born in 1955 the settled applicable age 73, attained in 2028, with an IRA required beginning date of April 1 in calendar 2029; params/index.ts#rmdStartAgeForBirthYear carries the same cohort age for the annual RMD gate. For a whole-year applicable age the attain year is birth year plus age and the RBD year is one more than that. Units: calendar years. Rounding: none; integer years.',
    formula: {
      expression: 'applicableAge = 73 for births 1951..1958; attainYear = birthYear + applicableAge; rbdYear = attainYear + 1',
      variables: [
        { symbol: 'birthYear', meaning: 'Owner year of birth', unit: 'year', domain: 'integer' },
        { symbol: 'applicableAge', meaning: 'Statutory applicable age for the birth cohort', unit: 'years', domain: 'integer 72, 73 or 75, or the 70.5 tier' },
      ],
      timing: 'once per owner',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/rmd-applicable-age-attain-year.md',
    },
    limits: [
      'Scoped to the settled 1951-1958 cohort: the 1959 cohort is contested between 73 and 75 and returns two attain years, and the date-sensitive 70.5 cohort needs a birth month',
      'The RBD calendar year is asserted through deriveRbdComparison rather than as a date string: the module derives the year internally and publishes a before/on-or-after comparison, not an April 1 value',
    ],
    implementedBy: [
      'packages/engine/src/rmd/applicableAge.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/rmd/applicableAge.ts#applicableAgeAttainYears',
      'packages/engine/src/rmd/applicableAge.ts#deriveRbdComparison',
      'packages/engine/src/params/index.ts#rmdStartAgeForBirthYear',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'rmd-joint-life-divisor': {
    title: 'RMD joint-life divisor',
    purpose: 'Use the Joint and Last Survivor table when a sole-beneficiary spouse is more than ten years younger.',
    kind: 'data',
    outputs: ['rmd-required-annual'],
    feeds: [],
    statement:
      'rmd/jointLifeTable.ts#jointLifeTableDivisor and rmd/rmd.ts#requiredMinimumDistribution use the Joint and Last Survivor table of 26 CFR 1.401(a)(9)-9(d) when the sole-beneficiary spouse is more than ten years younger, dividing the prior-year-end balance by the owner-age / spouse-age table entry. The qualifying-spouse exception replaces the Uniform Lifetime divisor with the larger of the two, so the RMD falls. Units: nominal USD. Rounding: none; the published figure is a binary float compared to cents.',
    formula: {
      expression: 'divisor = ownerAge - spouseAge > 10 ? max(uniform[ownerAge], jointLife[ownerAge][spouseAge]) : uniform[ownerAge]; rmd = priorYearEndBalance / divisor',
      variables: [
        { symbol: 'ownerAge', meaning: 'Owner age attained in the distribution year', unit: 'years', domain: 'integer' },
        { symbol: 'spouseAge', meaning: 'Sole-beneficiary spouse age attained in the distribution year', unit: 'years', domain: 'integer' },
        { symbol: 'priorYearEndBalance', meaning: 'Traditional-account balance at the prior December 31', unit: 'usd', domain: 'positive; a nonpositive balance returns 0' },
      ],
      timing: 'one account-year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/rmd-joint-life-divisor.md',
    },
    limits: [
      'The gap test is strictly more than ten years: an exactly ten-year gap keeps the Uniform Lifetime divisor',
      'The engine takes the larger of the two divisors, so a joint-life entry smaller than the uniform one could never raise the RMD; at the asserted ages the joint-life entry is the larger',
      'The spouse must be the sole beneficiary; this record does not decide that fact, it prices the divisor once the caller asserts it',
    ],
    implementedBy: [
      'packages/engine/src/rmd/jointLifeTable.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/rmd/jointLifeTable.ts#jointLifeTableDivisor',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'rmd-shortfall-excise-default': {
    title: 'RMD shortfall excise at the default rate',
    purpose: 'Price a missed RMD at the post-SECURE-2 default excise rate without touching income or balances.',
    kind: 'formula',
    outputs: [],
    feeds: ['tax-penalties-annual'],
    statement:
      'rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise prices a post-SECURE-2 annual RMD shortfall as the nonnegative required amount less timely distributions, times the default 25% rate carried by RMD_SHORTFALL_DEFAULT_RATE, without changing income or account balances. The reason is default25Percent when no corrective distribution, discretionary waiver or automatic waiver applies and the tax year is 2023 or later. Units: nominal USD. Rounding: none.',
    formula: {
      expression: 'S = max(0, R - D); tax = S x q; reason = default25Percent when no relief applies and taxYear >= 2023',
      variables: [
        { symbol: 'R', meaning: 'Required amount for the obligation', unit: 'usd', domain: 'nonnegative after the floor' },
        { symbol: 'D', meaning: 'Amount distributed by the statutory deadline', unit: 'usd', domain: 'nonnegative after the floor' },
        { symbol: 'q', meaning: 'RMD_SHORTFALL_DEFAULT_RATE', unit: 'fraction', domain: '0.25' },
      ],
      timing: 'one obligation in one tax year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/rmd-shortfall-excise-default.md',
    },
    limits: [
      'The excise is a penalty, never tax: it joins the published penalties line and never AGI, MAGI or the tax line',
      'The corrected 10% rate, the discretionary waiver and the two automatic waivers are separate branches this record does not claim; the asserted case elects none of them',
      'Pre-2023 tax years take the 50% pre-SECURE-2 rate on the same shortfall arithmetic',
    ],
    implementedBy: ['packages/engine/src/rmd/rmdShortfallExcise.ts'],
    implementedByFunctions: [
      'packages/engine/src/rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#RMD_SHORTFALL_DEFAULT_RATE',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'rmd-uniform-lifetime-divisor': {
    title: 'RMD uniform lifetime divisor',
    purpose: 'Divide the prior December 31 balance by the Uniform Lifetime Table entry for the age attained.',
    kind: 'data',
    outputs: ['rmd-required-annual'],
    feeds: [],
    statement:
      'rmd/rmd.ts#requiredMinimumDistribution computes an owner RMD for the age-attained year as the prior December 31 traditional-account balance divided by the 2026 pack\'s Uniform Lifetime Table divisor, when no qualifying more-than-ten-years-younger sole-spouse beneficiary applies. Nothing is required before the owner attains the cohort applicable age. Units: nominal USD. Rounding: none.',
    formula: {
      expression: 'rmd = priorYearEndBalance / uniformLifetimeTable[ageAttained], and 0 when ageAttained < applicableAge',
      variables: [
        { symbol: 'priorYearEndBalance', meaning: 'Traditional-account balance at the prior December 31', unit: 'usd', domain: 'positive; a nonpositive balance returns 0' },
        { symbol: 'ageAttained', meaning: 'Owner age attained in the distribution year', unit: 'years', domain: 'integer' },
        { symbol: 'uniformLifetimeTable', meaning: 'year2026.rmd.uniformLifetimeTable, the pack\'s reproduction of IRS Pub. 590-B', unit: 'years', domain: 'positive entries' },
      ],
      timing: 'one account-year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/rmd-uniform-lifetime-divisor.md',
    },
    limits: [
      'The balance is the PRIOR December 31 figure; using the current year-end balance publishes a different RMD from the same table',
      'Inherited-account rules and the first-year April 1 deferral are separate phases: the RMD is taken in the age-attained year',
      'A qualifying sole-beneficiary spouse more than ten years younger replaces this divisor, which is the sibling rmd-joint-life-divisor record',
    ],
    implementedBy: ['packages/engine/src/rmd/rmd.ts'],
    implementedByFunctions: ['packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'inherited-distribution-forced-annual': {
    title: 'Annual forced inherited distribution',
    purpose: 'The gross forced cash every inherited account is required to distribute this year.',
    kind: 'composition',
    outputs: ['inherited-distribution-forced-annual'],
    feeds: ['withdrawals-by-category-annual', 'withdrawals-total-annual'],
    statement:
      'projection/internal/types/result.ts#YearResult.inheritedDistribution publishes the sum of every inheritedAccounts[] row\'s executed required amount — annual, year-of-death and final-sweep alike — across traditional and Roth inherited accounts; voluntary amounts are excluded. As a current-code limit tracked by decision D-INHERITED-ROTH-SLICE, #YearResult.inheritedTraditionalDistribution is documented as excluding Roth forced dollars, while projection/internal/annualInheritedIraDistributions.ts#AnnualInheritedIraDistributionsResult carries a Roth row\'s characterized taxable slice into its ordinary-income total, which is what that field publishes. Units: nominal USD per year. Rounding: none.',
    formula: {
      expression: 'inheritedDistribution = sum of executed required amounts; inheritedTraditionalDistribution = traditional executed + characterized Roth ordinary income',
      variables: [
        { symbol: 'executed', meaning: 'Executed required amount on one inherited row', unit: 'usd', domain: 'nonnegative' },
        { symbol: 'Roth taxable slice', meaning: 'Characterized ordinary income inside a Roth forced row', unit: 'usd', domain: '0 <= slice <= that row\'s gross' },
      ],
      timing: 'once per projection year, over every inherited row',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/rmd/inherited-distribution-forced-annual.md',
    },
    limits: [
      'Decision D-INHERITED-ROTH-SLICE: the field comment on inheritedTraditionalDistribution says Roth forced dollars are excluded, while the code publishes the phase\'s ordinary-income total, which carries a Roth row\'s characterized taxable slice. The fixture asserts the current-code 8,600 and, separately, the Roth row\'s 3,000 gross and 600 slice, so whichever way the decision lands the discriminating evidence is already recorded',
      'Asserted at the exported phase with the worksheet\'s three rows realized from plan facts: a traditional annual-RMD row whose 8,000 executed amount is min(required, live balance) at a live balance of exactly 8,000, a Roth final-sweep row executing its whole 3,000 live balance with an injected characterization returning the worksheet\'s 600 of ordinary income, and a traditional row inside a ten-year window with no annual requirement. Plan assumptions beyond the worksheet\'s inputs: each account is a sole designated-individual beneficiary IRA with asserted provenance and a 2026 owner death, and the voluntary amounts the worksheet lists belong to a later phase and are not supplied here — the fixture asserts that this phase writes zero voluntary on every row',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/types/result.ts',
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/result.ts#YearResult.inheritedDistribution',
      'packages/engine/src/projection/internal/types/result.ts#YearResult.inheritedTraditionalDistribution',
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#AnnualInheritedIraDistributionsResult',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
