/**
 * State records for the South Atlantic: DE, DC, FL, GA, MD, NC, SC, VA, WV.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 * Records and the commentary attached to them were moved here verbatim, so a
 * block that says "above" or "below" may now point across a module boundary.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const southAtlanticStateRecords = {
  'fl-const-7-5-a-income-tax-prohibited': {
    title: 'No Florida income tax reaches a natural person',
    statement:
      'The Florida Constitution caps any tax on the income of a natural person resident or citizen of the state at the amounts creditable against or deductible from a similar federal or state tax. The income tax Florida does impose is chapter 220\'s, and that chapter reaches no natural person: it falls on "every taxpayer", and "taxpayer" is defined as a corporation. A constitutional ceiling above and an imposition that stops at the corporate boundary below are what leave a Florida retiree with nothing to compute, which the pack encodes as `hasIncomeTax: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:FL',
    authority: [{
      kind: 'statute',
      citation: 'Fla. Const. art. VII, sec. 5(a)',
      url: 'https://www.flsenate.gov/Laws/Constitution/Article7',
      quotedText:
        'NATURAL PERSONS. No tax upon estates or inheritances or upon the income of natural persons who are residents or citizens of the state shall be levied by the state, or under its authority, in excess of the aggregate of amounts which may be allowed to be credited upon or deducted from any similar tax levied by the United States or any state.',
    }, {
      kind: 'statute',
      citation: 'Fla. Stat. 220.11(1)',
      url: 'https://www.flsenate.gov/Laws/Statutes/2025/220.11',
      quotedText:
        'A tax measured by net income is hereby imposed on every taxpayer for each taxable year for the privilege of conducting business, earning or receiving income in this state, or being a resident or citizen of this state.',
    }, {
      kind: 'statute',
      citation: 'Fla. Stat. 220.03(1)(z)',
      url: 'https://www.flsenate.gov/Laws/Statutes/2025/220.03',
      quotedText:
        '“Taxpayer” means any corporation subject to the tax imposed by this code, and includes all corporations for which a consolidated return is filed under s. 220.131.',
    }, {
      // Added 2026-08-05. The three authorities above are a ceiling and an
      // imposition, and a reader has to reason from them to reach the operative
      // fact. Worse, the ceiling is not flat: section 5(a) bars a tax "in
      // excess of" what may be "credited upon or DEDUCTED FROM" a similar
      // federal tax, and whether "deducted from" reaches the federal deduction
      // for state taxes — which would make the ceiling non-zero — is not
      // resolved on the text alone and no Florida construction of it was found.
      // The Legislature's own Office of Economic and Demographic Research
      // states the fact flatly instead, so the record no longer has to rest the
      // whole negative on a clause whose reach is open.
      kind: 'stateAgencyPublication',
      citation: 'Florida Tax Handbook 2025 (Office of Economic and Demographic Research), Personal Income Tax',
      url: 'https://edr.state.fl.us/Content/revenues/reports/tax-handbook/taxhandbook2025.pdf',
      quotedText: 'SUMMARY: Florida currently does not levy a personal income tax.',
    }],
    volatility: 'staticStatute',
    // 2026 under the convention above, not 1971. The constitutional cap does
    // carry a 1971 adoption note, but two of the three authorities here are
    // quoted from the 2025 compilation of the Florida Statutes, and chapter 220
    // has plainly been amended since 1971 — the definition of "taxpayer" in
    // particular. Dating the record from the constitution alone would extend
    // the two statutory quotations back over fifty years of text nobody read.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#FL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wv-code-11-21-12-social-security-full-modification': {
    title: 'West Virginia exempts all Social Security from 2026',
    statement:
      'West Virginia phased a decreasing modification for Social Security up to 100 percent, and from tax years beginning on or after January 1, 2026 the phase is complete at every income level. It takes all four subdivisions to see that, and each does a different job: (A) allows 100 percent of the benefits included in federal adjusted gross income as a decreasing modification, (B) confines (A) to a taxpayer whose federal AGI does NOT exceed $100,000 on a joint return or $50,000 otherwise, (E) allows 100 percent from 2026, and (F) makes (E) available precisely to the taxpayers above those thresholds — the band (B) shuts (A) out of. The two bands are complementary and exhaust the range, so from 2026 no federally taxable Social Security survives into the West Virginia base, which is what `taxesSocialSecurity: false` encodes for the pack.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WV',
    authority: [{
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(A)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'For taxable years beginning on or after January 1, 2022, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(B) of this code.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(B)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'The deduction allowed by §11-21-12(c)(8)(A) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return does not exceed $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(E)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'For taxable years beginning on or after January 1, 2026, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(F)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'The deduction allowed by §11-21-12(c)(8)(C), §11-21-12(c)(8)(D), and §11-21-12(c)(8)(E) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return exceeds $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WV',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'sc-code-12-6-1170-retirement-income-deduction': {
    title: 'South Carolina’s retirement deduction has a tier below age 65',
    statement:
      'South Carolina allows the original owner of a qualified retirement account a deduction of up to three thousand dollars of retirement income, rising to ten thousand dollars beginning in the year the taxpayer reaches sixty-five. Approximated: the pack models the upper tier only, as `{ kind: \'capped\', capPerPerson: 10000, minAge: 65 }`, so a South Carolinian under sixty-five is given no deduction at all and is charged tax on three thousand dollars the statute reaches. The separate section (B) deduction of up to fifteen thousand dollars at sixty-five, net of the (A) amount, is likewise unmodelled and errs the same way.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1170(A)(1)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        'An individual taxpayer who is the original owner of a qualified retirement account is allowed an annual deduction from South Carolina taxable income of not more than three thousand dollars of retirement income received. Beginning in the year in which the taxpayer reaches age sixty-five, the taxpayer may deduct not more than ten thousand dollars of retirement income that is included in South Carolina taxable income.',
    }, {
      kind: 'statute',
      citation: 'S.C. Code 12-6-1170(B)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        'Beginning for the taxable year during which a resident individual taxpayer attains the age of sixty-five years, the resident individual taxpayer is allowed a deduction from South Carolina taxable income received in an amount not to exceed fifteen thousand dollars reduced by any amount the taxpayer deducts pursuant to subsection (A) not including amounts deducted as a surviving spouse.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'dc-code-47-1803-03-federal-standard-and-ss': {
    title: 'The District excludes federally taxable Social Security and follows the federal standard-deduction choice',
    statement:
      'D.C. separately excludes Social Security and Tier 1 Railroad benefits that were taxable under IRC section 86, exactly the federal share omitted by the pack\'s `taxesSocialSecurity: false`. It also requires a federal standard-deduction claimant to take the applicable District standard deduction, whose amount is specified in a separate definition. The staged sections establish the Social Security subtraction and the linked filing choice; they do not restate that definition section\'s dollar amount, so this record makes no independent claim about the amount or its future indexation.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:DC',
    authority: [{
      kind: 'statute',
      citation: 'D.C. Code 47-1803.02(a)(2)(L)',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02',
      quotedText:
        'The following items shall be excluded in the computation of District gross income: ... Social security and tier 1 railroad retirement benefits subject to taxation under \u00a7\u200286 of the Internal Revenue Code of 1986.',
    }, {
      kind: 'statute',
      citation: 'D.C. Code 47-1803.03(c)',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.03',
      quotedText:
        'Every individual who claims the standard deduction on his or her federal income tax return shall claim the applicable standard deduction specified in \u00a7 47-1801.04(26).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DC',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ga-code-48-7-27-retirement-and-social-security-exclusion': {
    title: 'Georgia has a $35,000 retirement-income tier at ages 62-64 and separately subtracts taxable Social Security',
    statement:
      'Georgia DOR\'s filing instructions make taxable Social Security a subtraction and direct retirees to the official IT-511 worksheet. That worksheet allows $35,000 at ages 62-64 and $65,000 at age 65 or older. Approximated: the pack preserves the age-65 $65,000 cap and separately excludes federally taxable Social Security, but has no $35,000 62-64 tier. It therefore leaves that source-covered retirement income in the base and overstates tax for the 62-64 limb. The DOR page also says retirement income reaches investment sources and up to $5,000 of earned income; the two retirement buckets cannot represent that broader base, so the record does not pretend that the age-65 bucket alone exhausts Georgia\'s exclusion.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'Georgia\'s official Code host is script-rendered and did not yield quote-verifiable operative text. The Department of Revenue is deliberately admitted as the state\'s own publisher because its retirement page supplies the operative filing instruction and points taxpayers to its own IT-511 booklet and worksheet, which supplies the two dollar amounts. This is the same primary-agency-publication boundary used where a usable code text is unavailable, not a secondary summary substituted for one.',
    jurisdiction: 'state:GA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Georgia Department of Revenue, Retirement Income Exclusion',
      url: 'https://dor.georgia.gov/retirement-income-exclusion',
      quotedText:
        'Taxpayers who are 62 or older, or permanently and totally disabled regardless of age, may be eligible for a retirement income adjustment on their Georgia tax return.',
    }, {
      kind: 'formInstruction',
      citation: 'Georgia Department of Revenue, 2025 Form 500 Schedule 1, Retirement Income Exclusion worksheet',
      url: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download',
      quotedText:
        '*If age 62-64 or less than age 62 and permanently disabled enter $35,000, or if age 65 or older enter $65,000.',
    }, {
      kind: 'formInstruction',
      citation: 'Georgia Department of Revenue, 2025 Form 500 Schedule 1, line 8',
      url: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download',
      quotedText:
        'SUBTRACTION from INCOME (See IT-511 Tax Booklet) ... Social Security Benefits (Taxable portion from Federal return)',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#GA',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'de-code-30-1106-social-security-retirement-subtractions': {
    title: 'Delaware subtracts federally taxable Social Security and up to $12,500 of retirement income at age 60',
    statement:
      'Delaware subtracts Social Security included in federal adjusted gross income and permits a single $12,500 retirement-income subtraction for a person age 60 or older. The statute’s shared per-person ceiling reaches pensions from employers and eligible retirement income, and the pack therefore applies its capped rule once to combined private and public retirement income through `retirementRuleShared`, rather than once per bucket. Its separate `taxesSocialSecurity: false` removes exactly the federally included benefit amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1106(b)(3)(b)(2)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For persons age 60 or older, amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1106(b)(4)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'Social Security benefits paid by the United States and all payments received under the Railroad Retirement Act of 1974 [45 U.S.C. §§ 231-231[v]] to the extent included in federal adjusted gross income;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'md-tax-10-207-social-security-exclusion': {
    title: 'Maryland subtracts Social Security and railroad-retirement payments',
    statement:
      'Maryland adjusted gross income subtracts a payment received under Title II of the Social Security Act or as a benefit under the Railroad Retirement Act, to the extent the payment was included in federal adjusted gross income. That is what `taxesSocialSecurity: false` encodes: no federally taxable Social Security survives into the Maryland base. The $41,200 pension exclusion the pack also carries is not in this section — §10-207(mm) points at §10-209 for "employee retirement system" — and is registered separately at md-tax-10-209-pension-exclusion.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General 10-207(a)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-207.pdf',
      quotedText:
        'To the extent included in federal adjusted gross income, the amounts under this section are subtracted from the federal adjusted gross income of a resident to determine Maryland adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-207(j)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-207.pdf',
      quotedText:
        'The subtraction under subsection (a) of this section includes a payment received: (1) under Title II of the Social Security Act; or (2) as a benefit under the Railroad Retirement Act.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'md-tax-10-209-pension-exclusion': {
    title: 'Maryland’s pension subtraction is not a flat $41,200 of all retirement',
    statement:
      'Maryland subtracts the lesser of (1) annuity, pension or endowment income from an "employee retirement system" included in federal AGI and (2) the Comptroller’s maximum annual Social Security benefit for an individual who retired at 65 in the prior calendar year, reduced by Social Security and railroad-retirement payments received. An employee retirement system is a §401(a), §403 or §457(b) employer plan; it does not include an IRA, a Roth IRA, a rollover IRA, a SEP or a §457(f) plan. The age gate is 65, or total disability, or a 55-year-old retired forest, park or wildlife ranger. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 41200, minAge: 65 }` on the shared retirement buckets, so an IRA distribution of a 65-year-old is excluded up to $41,200 the statute withholds, and a Social Security recipient keeps the full cap the statute reduces dollar-for-dollar. Both of those flatter the taxpayer. The other way: a disabled resident or a 55-year-old ranger who is not 65 is granted nothing, and the Comptroller’s unpublished 2026 maximum may sit above or below the pack’s $41,200 — that figure is not in §10-209, and neither is the shopping-list $30,000. Social Security itself is a different section and is registered separately at md-tax-10-207-social-security-exclusion.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(a)(1)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '“employee retirement system” means a plan: (i) established and maintained by an employer for the benefit of its employees; and (ii) qualified under § 401(a), § 403, or § 457(b) of the Internal Revenue Code',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(a)(2)(i)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '“employee retirement system” does not include: (i) an individual retirement account or annuity under § 408 of the Internal Revenue Code;',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(b)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        'Subject to subsections (d) and (e) of this section, to determine Maryland adjusted gross income, if, on the last day of the taxable year, a resident is at least 65 years old or is totally disabled or the resident’s spouse is totally disabled, or the resident is 55 years old and is a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, an amount is subtracted from federal adjusted gross income equal to the lesser of:',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(b)(1)–(2)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '(1) the cumulative or total annuity, pension, or endowment income from an employee retirement system included in federal adjusted gross income; or (2) the maximum annual benefit under the Social Security Act computed under subsection (c) of this section, less any payment received as old age, survivors, or disability benefits under the Social Security Act, the Railroad Retirement Act, or both.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(c)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        'the Comptroller: (1) shall determine the maximum annual benefit under the Social Security Act allowed for an individual who retired at age 65 for the prior calendar year; and (2) may allow the subtraction to the nearest $100.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ncgs-105-153-5-social-security-exclusion': {
    title: 'North Carolina subtracts Title II Social Security benefits',
    statement:
      'North Carolina\'s other-deductions subdivision lists both benefits received under Title II of the Social Security Act and amounts received from retirement annuities or pensions paid under the Railroad Retirement Act of 1937. The pack\'s `taxesSocialSecurity: false` implements the Title II Social Security limb; Railroad Retirement has no separate input field, and this record does not extend the quoted provision to North Carolina\'s separate retirement-income rules.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.5(b)(3)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.5.html',
      quotedText:
        '(b) Other Deductions. - In calculating North Carolina taxable income, a taxpayer may deduct from the taxpayer\'s adjusted gross income any of the following items that are included in the taxpayer\'s adjusted gross income: ... (3) Benefits received under Title II of the Social Security Act and amounts received from retirement annuities or pensions paid under the provisions of the Railroad Retirement Act of 1937.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'va-code-58-1-322-03-age-deduction-and-social-security': {
    title: 'Virginia phases the age-65 deduction out against adjusted federal AGI',
    statement:
      'Virginia grants an age-65 deduction of $12,000, but reduces it dollar-for-dollar when adjusted federal AGI exceeds $50,000 for a single taxpayer or $75,000 for a married taxpayer, with a combined-AGI rule for married-separate returns. The statute defines adjusted federal AGI by subtracting Title II Social Security benefits and other benefits taxable solely under Internal Revenue Code section 86. The pack maps the $12,000 amount to a retirement-income cap and does not carry the phase-out or the wage-only age deduction, so exposure can run in both directions: high-income retirees receive a deduction the statute has phased away, while low-income age-65 filers with no modeled retirement distribution receive none.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(5)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '5. a. A deduction in the amount of $ 12,000 for individuals born on or before January 1, 1939. b. A deduction in the amount of $ 12,000 for individuals born after January 1, 1939, who have attained the age of 65. This deduction shall be reduced by $ 1 for every $ 1 that the taxpayer\'s adjusted federal adjusted gross income exceeds $ 50,000 for single taxpayers or $ 75,000 for married taxpayers. For married taxpayers filing separately, the deduction shall be reduced by $ 1 for every $ 1 that the total combined adjusted federal adjusted gross income of both spouses exceeds $ 75,000. For the purposes of this subdivision, "adjusted federal adjusted gross income" means federal adjusted gross income minus any benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code, as amended.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#VA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
