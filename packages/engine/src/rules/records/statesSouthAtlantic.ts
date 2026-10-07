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

  'wv-code-11-21-4j-graduated-income-tax-rate-schedule': {
    title: 'West Virginia’s 2026 graduated rates run on the modeled taxable base',
    statement:
      'For taxable years beginning on or after January 1, 2026, §11-21-4j applies in lieu of §11-21-4i. Subsection (a) sets a five-band schedule on West Virginia taxable income for every individual except a married individual filing separately — including heads of household, joint filers, surviving spouses, and estates and trusts (with a stated trust exception). The pack models single and married filing jointly against the same (a) table; subsection (b)\'s separate married-filing-separately schedule is out of scope. Subsection (e) makes the section apply for all such taxable years. The pack\'s `brackets` carry the rates and shared break points; `bracketTax` applies them to the modeled West Virginia taxable base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Personal exemptions under §11-21-16, the age-65 or disability modification under §11-21-12(c)(9), military and other listed subtractions, and a full return reconciliation are not certified here. This record registers only the progressive rates and shared break points the per-state tax data carries as a stand-in for 2026.',
    jurisdiction: 'state:WV',
    authority: [{
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(a)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        '(a) Rate of tax on individuals (except married individuals filing separate returns), individuals filing joint returns, heads of households, and estates and trusts. — For taxable years beginning on and after January 1, 2026, the tax imposed by §11-21-3 of this code on the West Virginia taxable income of every individual (except married individuals filing separate returns); every individual who is a head of a household in the determination of his or her federal income tax for the taxable year; every husband and wife who file a joint return under this article; every individual who is entitled to file his or her federal income tax return for the taxable year as a surviving spouse; and every estate and trust (except non-grantor trusts administered by licensed private trust companies created pursuant to the provisions of §31I-1-1 et seq. of this code) shall be determined in accordance with the following table:',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(a)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        'If the West Virginia taxable income is: The tax is: Not over $10,000 2.11% of the taxable income Over $10,000 but not over $25,000 $211 plus 2.81% of excess over $10,000 Over $25,000 but not over $40,000 $632.50 plus 3.16% of excess over $25,000 Over $40,000 but not over $60,000 $1,106.50 plus 4.22% of excess over $40,000 Over $60,000 $1,950.50 plus 4.58% of excess over $60,000',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(e)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        '(e) Applicability of this section. — The provisions of this section shall be applicable in determining the rates of tax imposed by this article and shall apply for all taxable years beginning on and after January 1, 2026, and shall be in lieu of the rates of tax specified in §11-21-4i of this code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WV',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'sc-code-12-6-1120-4-social-security-subtraction': {
    title: 'South Carolina determines gross income without Internal Revenue Code section 86 for Social Security',
    statement:
      'South Carolina gross income is determined without application of Internal Revenue Code section 86. That is what `taxesSocialSecurity: false` encodes for the Social Security limb only: federally included Social Security never reaches the South Carolina base. Railroad Retirement Act annuity provenance is outside this record and is registered separately at `sc-45-usc-231m-railroad-annuities-not-modeled`; the 2025 return-instruction limb at `sc-form1040-line-o-railroad-benefits-not-modeled`, the retirement deduction at `sc-code-12-6-1170-retirement-income-deduction`, and Guard or Reserve pay at `sc-code-12-6-1120-7-reserve-national-guard-pay-not-modeled` are separate limbs as well.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(4)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(4) South Carolina gross income is determined without application of Internal Revenue Code Sections 78 (Gross-up of Dividends received from Certain Foreign Corporations), 86 (Social Security and Tier 1 Railroad Retirement Benefits), and 87 (Alcohol Fuel Credit).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'sc-45-usc-231m-railroad-annuities-not-modeled': {
    title: '45 U.S.C. 231m exempts Railroad Retirement Act annuities from South Carolina income tax, so a railroad annuity comes off the South Carolina base in full',
    statement:
      'Section 231m(a) of title 45 forbids any tax on an annuity or supplemental annuity under the Railroad Retirement Act, notwithstanding any law of any State, except as subsection (b) and the Internal Revenue Code provide; subsection (b)(1) only keeps the supplemental annuity in federal income. An annuity under the Act is built from a tier I amount (45 U.S.C. 231b(a)) increased by a tier II amount (231b(b)), with the vested dual benefit of 231b(h); the supplemental annuity is 231a(b). A pension whose source is Railroad Tier I, Railroad Tier II or Railroad Retirement Act (other) is one of these, so for a South Carolina year `characterizedRetirementDelta` subtracts its federally included amount (`railroadRetirementActSubtraction`) before the military and section 12-6-1170 deductions, and none of the three enters the section 1170 pool. A single filer aged 60 with 160,000 dollars of ordinary income that includes a 20,000 dollar tier II annuity has South Carolina taxable income of 140,000 dollars (the SCIAD deduction is fully phased out at that federal AGI) and pays 6,328.00 dollars for 2026; before 2026-09-30 the engine taxed the annuity like any pension and charged 7,370.00. Settled for a pension tagged with one of the three railroad sources. A railroad employer’s own plan is not an annuity under the Act; it is a private pension and is not subtracted. Railroad unemployment and sickness benefits have no income type in the plan and are outside this record. S.C. Code 12-6-1120(4) independently leaves IRC section 86 Social Security and tier 1 benefits out of South Carolina gross income; the Social Security limb is registered at `sc-code-12-6-1120-4-social-security-subtraction`, and the 2025 return instruction for line o at `sc-form1040-line-o-railroad-benefits-not-modeled`. `effectiveFrom: 2026` marks the first modeled year, not the start of section 231m. The id keeps its earlier suffix.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: '45 U.S.C. 231m(a)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(a) Except as provided in subsection (b) of this section and the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.], notwithstanding any other law of the United States, or of any State, territory, or the District of Columbia, no annuity or supplemental annuity shall be assignable or be subject to any tax or to garnishment, attachment, or other legal process under any circumstances whatsoever, nor shall the payment thereof be anticipated',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231m(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(b)(1) This section shall not operate to exclude the amount of any supplemental annuity paid to an individual under section 231a(b) of this title from income taxable pursuant to the Federal income tax provisions of the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.].',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231b(a)(1), tier I',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231b',
      quotedText:
        '(1) The annuity of an individual under section 231a(a)(1) of this title shall be in an amount equal to the amount (before any reduction on account of age and before any deductions on account of work) of the old-age insurance benefit or disability insurance benefit to which such individual would have been entitled under the Social Security Act [42 U.S.C. 301 et seq.] if all of his or her service as an employee after December 31, 1936, had been included in the term "employment" as defined in that Act.',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231b(b)(1), tier II',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231b',
      quotedText:
        '(1) The amount of the annuity of an individual provided under subsection (a) shall be increased by an amount equal to seven-tenths of 1 per centum of the product which is obtained by multiplying such individual\'s "years of service" by such individual\'s "average monthly compensation" as determined under this subsection.',
    }, {
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(4)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(4) South Carolina gross income is determined without application of Internal Revenue Code Sections 78 (Gross-up of Dividends received from Certain Foreign Corporations), 86 (Social Security and Tier 1 Railroad Retirement Benefits), and 87 (Alcohol Fuel Credit).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-30',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts#mapPensionSourceToStateKind',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#federalRailroadRetirementActKinds',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#railroadRetirementActSubtraction',
      'packages/engine/src/tax/stateTax.ts#characterizedRetirementDelta',
    ],
  },

  'sc-form1040-line-o-railroad-benefits-not-modeled': {
    title: 'South Carolina’s SC1040 line o subtracts railroad retirement taxed on the federal return, and it takes no room from the retirement deduction',
    statement:
      'The 2025 South Carolina Form SC1040 instructions direct taxpayers to enter on line o the amount of Social Security from Title 2 of the Social Security Act or railroad retirement that was taxed on the federal return, and say that railroad retirement income does not qualify for the retirement deduction on lines p-1 to p-3 because South Carolina does not tax it. For a South Carolina year `characterizedRetirementDelta` subtracts the federally included amount of every pension whose source is Railroad Tier I, Railroad Tier II or Railroad Retirement Act (other) (`railroadRetirementActSubtraction`), and `scSection1170Deduction` leaves all three out of its pool, so the owner’s retirement deduction stays available for other retirement income. A single filer aged 64 with 160,000 dollars of ordinary income that includes a 20,000 dollar tier II annuity and a 10,000 dollar IRA distribution subtracts the 20,000 dollars on line o and 3,000 dollars of the IRA as the under-65 retirement deduction, has South Carolina taxable income of 137,000 dollars and pays 6,171.70 dollars for 2026; before 2026-09-30 the engine subtracted only the 3,000 dollars and charged 7,213.70. Settled for a pension tagged with one of the three railroad sources; the federal rule behind line o is registered at `sc-45-usc-231m-railroad-annuities-not-modeled`, and the Title 2 Social Security limb, carried by the state not taxing Social Security, at `sc-code-12-6-1120-4-social-security-subtraction`. The instructions quoted are for tax year 2025, and the federal statute carries the rule to later years. The id keeps its earlier suffix.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'formInstruction',
      citation: 'South Carolina Department of Revenue, 2025 Form SC1040 instructions, line o',
      url: 'https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf',
      quotedText:
        '2025 Individual Income Tax Instructions ... Line o: Social Security and/or railroad retirement if taxed on your federal return Enter the amount of Social Security from Title 2 of the Social Security Act or railroad retirement that was taxed on your federal return.',
    }, {
      kind: 'formInstruction',
      citation: 'South Carolina Department of Revenue, 2025 Form SC1040 instructions, lines p-1 through p-3, income that does not qualify',
      url: 'https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf',
      quotedText:
        'Disability retirement income due to total and permanent disability, Social Security income, and railroad retirement income do not qualify because these items are not taxed by South Carolina.',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231m(a)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(a) Except as provided in subsection (b) of this section and the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.], notwithstanding any other law of the United States, or of any State, territory, or the District of Columbia, no annuity or supplemental annuity shall be assignable or be subject to any tax or to garnishment, attachment, or other legal process under any circumstances whatsoever, nor shall the payment thereof be anticipated',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-09-30',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts',
      'packages/engine/src/tax/stateSouthCarolinaRetirement.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts#mapPensionSourceToStateKind',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#federalRailroadRetirementActKinds',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#railroadRetirementActSubtraction',
      'packages/engine/src/tax/stateSouthCarolinaRetirement.ts#scSection1170Deduction',
      'packages/engine/src/tax/stateTax.ts#characterizedRetirementDelta',
    ],
  },

  'sc-code-12-6-1170-roth-conversion-not-premature': {
    title: 'South Carolina counts a Roth conversion toward its retirement deduction at any age, because no premature distribution penalty applies to one',
    statement:
      'S.C. Code 12-6-1170(A)(2) counts as retirement income the otherwise taxable income from plans under IRC 401, 403, 408 and 457 that is not subject to a penalty for premature distribution. IRC 408A(d)(3)(A)(ii) says section 72(t) does not apply to a conversion, so a conversion is never penalized and counts toward the $3,000 deduction, $10,000 from 65, whatever the owner’s age. The engine counts the conversion part of a row (`rothConversionAmount`) before the premature distribution test (tax/stateSouthCarolinaRetirement.ts#scSection1170Deduction). Until 2026-10-06 it withheld a conversion by an owner under 59 and a half on January 1 as of unknown premature status, so the year lost up to $3,000 of deduction, $156.30 of tax in the 5.21% band, and was marked incomplete. Settled for conversions; the deduction’s other conditions stay with sc-code-12-6-1170-retirement-income-deduction.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code §12-6-1170(A)(2)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(2) The term "retirement income", as used in this subsection, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer\'s surviving spouse in a taxable year from qualified retirement plans which include those plans defined in Internal Revenue Code Sections 401, 403, 408, and 457,',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(A)(i)-(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'in the case of any distribution to which this paragraph applies— (i) there shall be included in gross income any amount which would be includible were it not part of a qualified rollover contribution, (ii) section 72(t) shall not apply,',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-10-06',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/projection/internal/annualStateRetirementEvents.ts',
      'packages/engine/src/tax/stateRetirementFacts.ts',
      'packages/engine/src/tax/stateSouthCarolinaRetirement.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/projection/internal/annualStateRetirementEvents.ts#stateRetirementEventsFromAccountAmounts',
      'packages/engine/src/tax/stateRetirementFacts.ts#rothConversionPart',
      'packages/engine/src/tax/stateSouthCarolinaRetirement.ts#scSection1170Deduction',
    ],
  },

  "sc-code-12-6-1170-retirement-income-deduction": {
    "title": "South Carolina ordinary retirement deduction has owner, age and penalty gates",
    "statement": "An original account owner may deduct up to $3,000 of qualifying included retirement income, increasing to $10,000 in the year the owner turns 65. Premature-penalty distributions do not qualify. Surviving-spouse income attributable to the decedent retains its separate statutory treatment. Ordinary nonmilitary public income belongs in this capped pool, not the full military exclusion. Legacy aggregate classification remains approximate when source and penalty facts are unavailable. A Roth conversion counts at any age, registered at sc-code-12-6-1170-roth-conversion-not-premature.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "bothDirections",
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1170(A)(1)-(4)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "(A)(1) An individual taxpayer who is the original owner of a qualified retirement account is allowed an annual deduction from South Carolina taxable income of not more than three thousand dollars of retirement income received. Beginning in the year in which the taxpayer reaches age sixty-five, the taxpayer may deduct not more than ten thousand dollars of retirement income that is included in South Carolina taxable income. (2) The term \"retirement income\", as used in this subsection, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from qualified retirement plans which include those plans defined in Internal Revenue Code Sections 401, 403, 408, and 457, and all public employee retirement plans of the federal, state, and local governments, including military retirement. (3) A surviving spouse receiving retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "sc-code-12-6-1171-military-retirement": {
    "title": "South Carolina fully deducts qualifying military retirement",
    "statement": "Qualifying included military retirement and qualifying military survivor benefits are deductible in full under §1171. Ordinary public pensions are not military retirement. Premature-distribution and survivor definitions remain operative. Inactive-duty National Guard/reserve compensation under §1120(7) is a separate rule and is not silently treated as military retirement.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1171(A)-(D)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "(A) An individual taxpayer may deduct all military retirement income that is included in South Carolina taxable income. (B) The term \"retirement income\", as used in this section, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from a qualified military retirement plan. For purposes of a surviving spouse, \"retirement income\" also includes a retirement benefit plan and dependent indemnity compensation related to the deceased spouse's military service. (C) A surviving spouse receiving military retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "sc-code-12-6-1170-b-age-65-deduction": {
    "title": "South Carolina age-65 deduction follows each owner’s retirement deductions",
    "statement": "Beginning in the year a resident reaches 65, up to $15,000 of that owner’s remaining South Carolina income is deductible. Reduce the limit by that owner’s §1170(A) and §1171 deductions, except deductions claimed as a surviving spouse. Two eligible spouses have separate $15,000 limits; one owner cannot consume the other’s remaining income. Unknown owner-attributed remaining income produces incomplete results.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1170(B)-(C)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "Beginning for the taxable year during which a resident individual taxpayer attains the age of sixty-five years, the resident individual taxpayer is allowed a deduction from South Carolina taxable income received in an amount not to exceed fifteen thousand dollars reduced by any amount the taxpayer deducts pursuant to subsection (A) not including amounts deducted as a surviving spouse. If married taxpayers eligible for this deduction file a joint federal income tax return, then the maximum deduction allowed is fifteen thousand dollars in the case when only one spouse has attained the age of sixty-five years and thirty thousand dollars when both spouses have attained such age. … Notwithstanding any other provision of this section, if a taxpayer claims a deduction pursuant to Section 12-6-1171, then the deduction allowed by this section must be reduced by the amount the taxpayer deducts pursuant to Section 12-6-1171; however, this subsection does not apply if the deduction claimed pursuant to Section 12-6-1171 is claimed by a surviving spouse."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  'sc-code-12-6-1120-7-reserve-national-guard-pay-not-modeled': {
    title: 'South Carolina excludes limited Guard and Reserve pay under §12-6-1120(7); the engine cannot certify service or pay type',
    statement:
      'S.C. Code §12-6-1120(7) excludes from South Carolina gross income compensation or retirement benefits from the United States or any state for service in a state National Guard or reserve component, but only for the customary annual training period (not exceeding fifteen days for guard members or fourteen days plus travel time for reserve members), weekend drills, and inactive duty training, with a fifteen-day active-duty deduction when annual-training pay was not excluded in the same taxable year. That exclusion is a different limb from the retirement deduction at `sc-code-12-6-1170-retirement-income-deduction` and from federally taxable Social Security the pack removes through `taxesSocialSecurity: false`; it does not reach every Guard or Reserve dollar. Out of scope: `wagesIncomeSchema` carries only annual gross wages with no Guard or reserve service, pay-type, training-day, drill, inactive-duty, or active-duty facts, `pensionSchema` distinguishes only private versus public source, and `StateTaxParams` / `StateRetirementExclusion` carry no National Guard or reserve pay-type facts — so no accepted wages, ordinary, public or private pension input can identify qualifying §12-6-1120(7) compensation or retirement benefits. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'compensation or retirement benefits from the United States or any state for service in a state National Guard or reserve component',
        'pay limited to customary annual training (not more than fifteen days for guard or fourteen days plus travel for reserve), weekend drills, inactive duty training, or fifteen days of active-duty pay when annual-training pay was not excluded in the same year: wagesIncomeSchema has no Guard or reserve service or pay-type fields',
        'National Guard or reserve service category on pensionSchema, whose `source` enum is only private or public',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(7)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(7) South Carolina gross income does not include compensation or retirement benefits received from the United States or any state for service in a state National Guard or a reserve component of the Armed Forces of the United States. This exclusion only applies to compensation and retirement benefits received for the customary annual training period not to exceed fifteen days for guard members or fourteen days plus travel time for reserve members, weekend drills, and inactive duty training. National Guard or reserve members that are called to active duty are allowed to deduct fifteen days of active duty pay if they have not excluded pay for the annual training period for the same taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#wagesIncomeSchema',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },

  'dc-code-47-1803-03-federal-standard-and-ss': {
    title: 'The District excludes federally taxable Social Security and follows the federal standard-deduction choice',
    statement:
      'D.C. separately excludes Social Security and Tier 1 Railroad benefits that were taxable under IRC section 86, exactly the federal share omitted by the pack\'s `taxesSocialSecurity: false`. It also requires a federal standard-deduction claimant to take the applicable District standard deduction, whose amount is specified in a separate definition. The staged sections establish the Social Security subtraction and the linked filing choice; they do not restate that definition section\'s dollar amount, so this record makes no claim about the amount; dc-code-47-1801-04-3a-standard-deduction-2026-2029 records the amount the act in force sets for 2026 to 2029 and what happens at each date.',
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

  'dc-code-47-1801-04-3a-standard-deduction-2026-2029': {
    title: 'The District’s own standard deduction for 2026 to 2029 is loaded as the emergency act in force sets it, with the permanent act’s congressional review named',
    statement:
      'Which act is in force on 2026-09-28, and what happens at each date. D.C. Act 26-416, the Fiscal Year 2027 Budget Support Emergency Act of 2026, took effect August 13, 2026 and remains in effect for no longer than 90 days, so to about November 11, 2026. It adds D.C. Code 47-1801.04(3A): a basic standard deduction of $15,000 single or married filing separately, $22,500 head of household and $30,000 joint for taxable years 2026 to 2029, increased annually by the District cost-of-living adjustment from a 2025 base year and rounded down to a multiple of $50, so 2026 carries no adjustment; it amends (44) so that the standard deduction is that basic amount plus the IRC 63(c)(3) additional amount for 2025 to 2029, and the federal standard deduction from 2030. The temporary law whose text the code site printed, D.C. Law 26-89, expired September 25, 2026. The permanent act with the same text, D.C. Act 26-418 (B26-0661), was enacted August 14, 2026 and transmitted to Congress on August 20, 2026, with a projected law date of November 20, 2026 (the Council’s legislative record, read 2026-09-28; the act is not yet on the code site). The engine loads the law in force: the 2026 figures (params/state/data/year2026.ts) carry $15,000 and $30,000 with the federal additional amount, indexed from 2027 at the plan’s inflation and rounded down to $50 (tax/stateEnactedLaw.ts#statutorilyIndexedStandardDeduction), and the figures enacted for 2030 (params/state/data/enacted2030.ts) return to the federal deduction. A single filer under 65 with $60,000 of District income pays $2,525.00 for 2026, where the federal deduction the engine carried before gave $2,453.50; a couple with $120,000, $6,050.00 where it gave $5,863.00. If Act 26-418 becomes law, nothing here changes; if Congress disapproves it and no further emergency act follows the lapse of Act 26-416, the code’s permanent text, the federal deduction for every year after 2017, returns, and this record and the figures are revisited on November 20, 2026. Stated limit, the indexing vintage: the engine projects every indexed figure, the federal brackets included (irc-1-j-3-B-rate-tables-adjusted-each-year), by the plan’s cumulative inflation from the latest loaded year, so 2027 is the 2026 amount times the plan’s inflation from 2026 to 2027. The statute measures the adjustment with a lag, against its base year, and the engine models that lag nowhere; the contrary reading gives 2027 the change from 2025 to 2026. Under constant inflation the two agree ($15,350 for 2027 at 2.5% a year). On a declining path, 3% from 2025 to 2026, 2% to 2027 and 1% a year after, the engine gives $15,300, $15,450 and $15,600 for 2027 to 2029 where the contrary reading gives $15,450, $15,750 and $15,900, so a single filer under 65 with $60,000 of District income pays $9.75 more for 2027 and $19.50 more for 2028 and 2029. Settled for the act in force on 2026-09-28, with the indexing vintage a stated limit.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Law in force is loaded, and a pending event that could change it is named, dated and revisited (decision of 2026-09-28, State income tax follows each state’s enacted law, applied as it is for Washington’s and California’s votes): congressional review of the permanent act is that event here. The plan’s general inflation stands in for the District’s consumer price index.',
    jurisdiction: 'state:DC',
    authority: [{
      kind: 'statute',
      citation: 'D.C. Act 26-416, sec. 7112(b)(1), adding D.C. Code 47-1801.04(3A)(A)(ii)(I)',
      url: 'https://code.dccouncil.gov/us/dc/council/acts/26-416',
      quotedText:
        'For taxable years beginning after December 31, 2025, but before January 1, 2030: ... In the case of a return filed by a single individual or married individual filing a separate return, $15,000, increased annually pursuant to the cost-of living adjustment (if the adjustment does not result in a multiple of $50, rounded down to the next multiple of $50);',
    }, {
      kind: 'statute',
      citation: 'D.C. Act 26-416, sec. 7112(b)(1), D.C. Code 47-1801.04(3A)(B), base year',
      url: 'https://code.dccouncil.gov/us/dc/council/acts/26-416',
      quotedText:
        'shall mean the calendar year beginning January 1, 2025, or the calendar year beginning one calendar year before the calendar year in which the new dollar amount of the basic standard deduction shall become effective, whichever is later',
    }, {
      kind: 'statute',
      citation: 'D.C. Act 26-416, sec. 7112(b)(3), D.C. Code 47-1801.04(44)(A)(v)(II) and (vi)',
      url: 'https://code.dccouncil.gov/us/dc/council/acts/26-416',
      quotedText:
        'The additional standard deduction as prescribed in section 63(c)(3) of the Internal Revenue Code of 1986; or ... For taxable years beginning after December 31, 2029, the standard deduction as prescribed in section 63(c) of the Internal Revenue Code of 1986.',
    }, {
      kind: 'statute',
      citation: 'D.C. Act 26-416, sec. 9003',
      url: 'https://code.dccouncil.gov/us/dc/council/acts/26-416',
      quotedText:
        'This act shall take effect following approval by the Mayor (or in the event of veto by the Mayor, action by the Council to override the veto), and shall remain in effect for no longer than 90 days',
    }, {
      kind: 'statute',
      citation: 'D.C. Code 47-1801.04(44)(A)(iv), permanent version',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1801.04(Perm)',
      quotedText:
        'For taxable years beginning after December 31, 2017, the standard deduction as prescribed in section 63(c) of the Internal Revenue Code of 1986.',
    }, {
      kind: 'legislativeHistory',
      citation: 'D.C. Code 47-1801.04, code site note on D.C. Law 26-89',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1801.04',
      quotedText:
        'This section includes amendments by temporary legislation that will expire on September 25, 2026.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/data/enacted2030.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateEnactedLaw.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DC',
      'packages/engine/src/params/state/data/enacted2030.ts#states.DC',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateEnactedLaw.ts#statutorilyIndexedStandardDeduction',
    ],
  },

  'ga-code-48-7-27-retirement-and-social-security-exclusion': {
    title: 'Georgia has a $35,000 retirement-income tier at ages 62-64 and separately subtracts taxable Social Security',
    statement:
      'Georgia DOR\'s filing instructions make taxable Social Security a subtraction and direct retirees to the official IT-511 worksheet. That worksheet allows $35,000 at ages 62-64 and $65,000 at age 65 or older. From 2027, HB 463 raises the amount at 65 or older to $70,000 (ga-hb-463-2027-retirement-exclusion). Approximated: the pack preserves the age-65 cap, $65,000 for 2026, and separately excludes federally taxable Social Security, but has no $35,000 62-64 tier. It therefore leaves that source-covered retirement income in the base and overstates tax for the 62-64 limb. The DOR page also says retirement income reaches investment sources and up to $5,000 of earned income; the two retirement buckets cannot represent that broader base, so the record does not pretend that the age-65 bucket alone exhausts Georgia\'s exclusion. The missing tier reaches a Roth conversion too: the IT-511 says the taxability of a conversion from a traditional IRA to a Roth IRA is the same for Georgia as for the IRS, and the exclusion worksheet counts taxable IRA distributions, so the engine taxes in full a conversion by a filer of 62 to 64 that Georgia would exclude up to $35,000 (medium confidence: the instructions, not a rule written for conversions).',
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

  'ga-hb-463-2027-retirement-exclusion': {
    title: 'Georgia raises the retirement income exclusion at 65 or older to $70,000 from 2027',
    statement:
      'HB 463 (2026), section 2-3, adds O.C.G.A. 48-7-27(a)(5)(A)(xiv): for taxable years beginning on or after January 1, 2027, retirement income from any source is excluded up to $35,000 for each taxpayer who meets division (i) or (ii) of subparagraph (D), the ages 62 to 64 and permanent disability tests, and up to $70,000 for each taxpayer who meets division (iii), age 65 or older, up from $65,000 under (xiii), which now ends with 2026. No condition applies to it: the determination as of December 1 that can delay HB 463’s rate cut and standard deduction steps does not reach this division, and the act’s automatic repeal reaches only its overtime and tip exclusions. The act took effect on the Governor’s approval (section 5-1). The figures enacted for 2027 (params/state/data/enacted2027.ts) carry a $70,000 cap at 65 or older for both retirement buckets, which Georgia shares as one rule, and hold it for later years. The $35,000 tier for ages 62 to 64 is still not carried (ga-code-48-7-27-retirement-and-social-security-exclusion), so that limb still overstates tax. Settled for the amount at 65 or older; the 62 to 64 tier, the earned income limb and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Georgia’s Code host renders its text in the browser and yields no quote-verifiable page, so the act is quoted from the copy the Governor’s office publishes among its 2026 signed legislation, admitted by exact URL only. HB 463’s rate cut and standard deduction steps are not loaded: they turn on the Office of Planning and Budget’s determination as of December 1.',
    jurisdiction: 'state:GA',
    authority: [{
      kind: 'statute',
      citation: 'HB 463 (2026), section 2-3, adding O.C.G.A. §48-7-27(a)(5)(A)(xiv)',
      url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download',
      quotedText:
        '(xiv) For taxable years beginning on or after January 1, 2027, retirement income from any source not to exceed an exclusion amount of $35,000.00 for each taxpayer meeting the eligibility requirement set forth in division (i) or (ii) of subparagraph (D) of this paragraph or an amount of $70,000.00 for each taxpayer meeting the eligibility requirement set forth in division (iii) of subparagraph (D) of this paragraph.',
    }, {
      kind: 'statute',
      citation: 'HB 463 (2026), section 2-3, revising O.C.G.A. §48-7-27(a)(5)(A)(xiii)',
      url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download',
      quotedText:
        '(xiii) For taxable years beginning on or after January 1, 2012, and ending on or … before December 31, 2026, retirement income from any source not to exceed an',
    }, {
      kind: 'statute',
      citation: 'HB 463 (2026), section 5-1',
      url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download',
      quotedText:
        'This Act shall become effective upon its approval by the Governor or upon its becoming law',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2027,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/enacted2027.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/enacted2027.ts#states.GA',
      'packages/engine/src/params/state/index.ts#stateParamsFor',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  "de-code-30-1106-social-security-retirement-subtractions": {
    "title": "Delaware pension exclusions distinguish age, source and tax year",
    "statement": "For TY2026, each recipient under 60 takes the greater of qualifying ordinary pension capped at $2,000 or U.S. military pension capped at $12,500; the two amounts are not added. At 60 or older, the $12,500 pension/eligible-retirement-income cap applies separately to each owner. Source, age, and early-distribution facts must establish eligibility. SB219 (85 Del. Laws ch.426), signed August 17, 2026, increases future military tiers beginning in 2027; it does not increase the 2026 cap. The broad aggregate retirement path remains an approximation of qualifying source and owner allocation.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "bothDirections",
    "conventionRationale": null,
    "jurisdiction": "state:DE",
    "authority": [
      {
        "kind": "statute",
        "citation": "30 Del. C. §1106(b)(3)b-c",
        "url": "https://delcode.delaware.gov/title30/c011/sc02/index.html",
        "quotedText": "For persons age 60 or older, amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income. … Amounts received, not to exceed $2,000, as pensions from employers, the United States, this State, or any subdivision of this State; or … Amounts received, not to exceed $12,500, as a United States military pension."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DE",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction"
    ]
  },

  'de-code-30-1102-a-14-rate-schedule': {
    title: 'Delaware assigns 5.55% to taxable income over $25,000 through $60,000',
    statement:
      'For taxable years after 2013, Delaware’s graduated rate schedule assigns 5.55 percent to the slice of taxable income over $25,000 but not over $60,000. The pack carries the shared bracket thresholds and rates for single and married filing jointly; `bracketTax` applies them to modeled Delaware taxable income after the standard deduction. Personal credits, exemptions, itemization, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record registers only the statutory rate schedule on modeled taxable income. Delaware’s basic standard deduction is registered separately at `de-code-30-1108-standard-deduction`. Qualifying-surviving-spouse routing, blindness, retirement subtractions, and credits are outside this record.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, §1102(a)(14) (effective period)',
      url: 'https://delcode.delaware.gov/title30/c011/sc01/index.html',
      quotedText:
        '(14) For taxable years beginning after December 31, 2013, the amount of tax shall be determined as follows:',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, §1102(a)(14) (5.55% band)',
      url: 'https://delcode.delaware.gov/title30/c011/sc01/index.html',
      quotedText:
        '5.55% of taxable income in excess of $25,000 but not in excess of $60,000; and',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2014,
    effectiveThrough: null,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'de-code-30-1108-standard-deduction': {
    title: 'Delaware’s standard deduction is $3,250 single and $6,500 joint plus $2,500 per age-65 person',
    statement:
      'For a nonblind Delaware resident taking the standard deduction on a single or married-filing-jointly return, the basic deduction is $3,250 or $6,500 respectively, with an additional $2,500 for each qualifying taxpayer or spouse age 65 or older.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Blindness, the itemization election under § 1107, personal credits, and whole-return accuracy are outside this record. Delaware’s amounts are fixed statutory dollars with no federal scaling tag. `effectiveFrom: 2000` is the first tax year in which this record’s combined $3,250 single / $6,500 joint basic deductions and $2,500 age addition all governed. Verification is against the 2026 tax parameters; the selector’s use of those parameters for earlier years is an unmarked historical approximation, and this record does not certify other Delaware parameters for those years. Qualifying-surviving-spouse years are outside this settled single/MFJ record and are disclosed separately at `de-pit-est-2026-qss-standard-deduction-joint-mapper`. The § 1102 rate schedule is registered separately at `de-code-30-1102-a-14-rate-schedule`.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1107',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The deduction of a resident individual shall be the standard deduction, unless the individual elects to itemize deductions as provided in § 1109 of this title.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(a)(3)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For taxable periods beginning after December 31, 1999, the standard deduction of a resident individual shall be $3,250, and the standard deduction of resident spouses shall be $6,500 if they file a joint return and $3,250 each if they file separate returns.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(b)(1)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The sum of $2,500 shall be added to the standard deduction determined under subsection (a) of this section in each of the following circumstances: … For the taxpayer who has attained the age of 65 before the close of the taxable year;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Delaware Division of Revenue, 2026 Form PIT-EST instructions, line 3',
      url: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf',
      quotedText:
        '(a) If deductions will be itemized, enter estimated itemized deductions total. If not itemizing, use Standard Deduction ($3,250 single, divorced or widow(er), head of household) ($6,500 if married filing jointly), or ($3,250 if married or entered into a civil union filing separately). (b) Additional Standard Deduction Allowance(s) of $2,500 for taxpayer &/or spouse. If 65 years old or over or blind and filing Standard Deduction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2000,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
    ],
  },

  'de-pit-est-2026-qss-standard-deduction-joint-mapper': {
    title: 'Delaware QSS is routed through the joint standard-deduction row',
    statement:
      'For a modeled Delaware qualifying-surviving-spouse year resolved through the 2026 state parameter pack, the engine selects the married-filing-jointly row: $6,500 basic and $9,000 for one nonblind survivor age 65. Current §1108 and the 2026 Form PIT-EST instructions put a widow(er) on the $3,250 individual row, or $5,750 with one age-65 addition. For projection years after 2026, `stateParamsFor` repeats these amounts only by carrying the latest published pack forward. That is a disclosed frozen-pack product approximation, not verification of a future Delaware form, future legislation, or any other future-year Delaware parameter.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DISCLOSED APPROXIMATION. ProjectedFilingStatus can express qualifyingSurvivingSpouse, but taxParameterFilingStatus maps every non-single status to marriedFilingJointly before computeStateTaxableIncome selects the Delaware deduction row. The $3,250 excess deduction can understate Delaware tax where it reduces positive taxable income; tax can be unchanged at a floor. `effectiveFrom: 2026` is the first observed and test-backed modeled year. `effectiveThrough: null` means the current mapper and unsunset statutory comparison have no scheduled expiry. Later-year persistence depends on the fallback to the latest per-state tax data and must be rechecked when new per-state tax data, a new form, or an amendment appears. Earlier years, QSS brackets, itemization, credits, blindness, other return lines, and whole-return accuracy remain outside this record.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(a)(3)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For taxable periods beginning after December 31, 1999, the standard deduction of a resident individual shall be $3,250, and the standard deduction of resident spouses shall be $6,500 if they file a joint return and $3,250 each if they file separate returns.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(b)(1)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The sum of $2,500 shall be added to the standard deduction determined under subsection (a) of this section in each of the following circumstances: … For the taxpayer who has attained the age of 65 before the close of the taxable year;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Delaware Division of Revenue, 2026 Form PIT-EST instructions, line 3',
      url: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf',
      quotedText:
        '(a) If deductions will be itemized, enter estimated itemized deductions total. If not itemizing, use Standard Deduction ($3,250 single, divorced or widow(er), head of household) ($6,500 if married filing jointly), or ($3,250 if married or entered into a civil union filing separately). (b) Additional Standard Deduction Allowance(s) of $2,500 for taxpayer &/or spouse. If 65 years old or over or blind and filing Standard Deduction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-06',
    implementedBy: [
      'packages/engine/src/projection/internal/types/tax.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/tax.ts#taxParameterFilingStatus',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
    ],
  },

  'md-tax-10-207-social-security-exclusion': {
    title: 'Maryland subtracts Social Security and railroad-retirement payments',
    statement:
      'Maryland adjusted gross income subtracts a payment received under Title II of the Social Security Act or as a benefit under the Railroad Retirement Act, to the extent the payment was included in federal adjusted gross income. That is what `taxesSocialSecurity: false` encodes: no federally taxable Social Security survives into the Maryland base. The $40,600 pension exclusion the pack also carries is not in this section — §10-207(mm) points at §10-209 for "employee retirement system" — and is registered separately at md-tax-10-209-pension-exclusion.',
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

  "md-tax-10-209-pension-exclusion": {
    "title": "Maryland TY2026 pension maximum is $40,600 before the benefit offset",
    "statement": "For TY2026 the published maximum is $40,600 per qualifying recipient. Section 10-209 permits the lesser of included qualifying employee-plan income and the maximum less all Social Security/Railroad Retirement benefits received, including nontaxable benefits. IRAs, Roth IRAs, rollover IRAs, SEPs and ineligible deferred compensation do not qualify. Age 65, total disability, or a totally disabled spouse supplies the ordinary eligibility gate. The current coarse cap does not establish source eligibility, disability or the recipient-specific gross-benefit offset and remains approximated; $50,000 qualifying pension and $20,000 benefits require $20,600, not $40,600. An IRA converted to a Roth IRA does not qualify, as no IRA does, and the engine counts no IRA row. Whether an in-plan Roth rollover from an employee retirement system qualifies is not determined; the engine counts such an employer plan row at 65 or older like any plan distribution.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "understatesTax",
    "conventionRationale": null,
    "jurisdiction": "state:MD",
    "authority": [
      {
        "kind": "stateAgencyPublication",
        "citation": "Maryland Comptroller, Pension Exclusion, calendar 2026 maximum",
        "url": "https://services.marylandcomptroller.gov/taxes/en/maryland-pension-exclusion?id=kb_article_view&sysparm_article=KB0010012",
        "quotedText": "For calendar year 2025. For calendar year 2026, the maximum pension exclusion is $40,600."
      },
      {
        "kind": "statute",
        "citation": "Md. Tax-General §10-209(a)-(e)",
        "url": "https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-209.pdf",
        "quotedText": "(a) In this section: (1) “employee retirement system” means a plan: (i) established and maintained by an employer for the benefit of its employees; and (ii) qualified under § 401(a), § 403, or § 457(b) of the Internal Revenue Code; and (2) “employee retirement system” does not include: (i) an individual retirement account or annuity under § 408 of the Internal Revenue Code; (ii) a Roth individual retirement account under § 408A of the Internal Revenue Code; (iii) a rollover individual retirement account; (iv) a simplified employee pension under Internal Revenue Code § 408(k); or (v) an ineligible deferred compensation plan under § 457(f) of the Internal Revenue Code. (b) Subject to subsections (d) and (e) of this section, to determine Maryland adjusted gross income, if, on the last day of the taxable year, a resident is at least 65 years old or is totally disabled or the resident’s spouse is totally disabled, or the resident is 55 years old and is a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, an amount is subtracted from federal adjusted gross income equal to the lesser of: (1) the cumulative or total annuity, pension, or endowment income from an employee retirement system included in federal adjusted gross income; or (2) the maximum annual benefit under the Social Security Act computed under subsection (c) of this section, less any payment received as old age, … survivors, or disability benefits under the Social Security Act, the Railroad Retirement Act, or both. (c) For purposes of subsection (b)(2) of this section, the Comptroller: (1) shall determine the maximum annual benefit under the Social Security Act allowed for an individual who retired at age 65 for the prior calendar year; and (2) may allow the subtraction to the nearest $100. (d) (1) Military retirement income that is included in the subtraction under § 10–207(q) of this subtitle may not be taken into account for purposes of the subtraction under this section. (2) Public safety employee retirement income that is included in the subtraction under § 10–207(mm) of this subtitle may not be taken into account for purposes of the subtraction under this section. (e) In the case of a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, the amount included under subsection (b)(1) of this section is limited to the first $15,000 of retirement income that is attributable to the resident’s employment as a forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State unless: (1) the resident is at least 65 years old or is totally disabled; or (2) the resident’s spouse is totally disabled."
      }
    ],
    "volatility": "annuallyIndexed",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#MD",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  'md-tg-10-217-2026-indexed-standard-deduction': {
    title: 'Maryland indexes its standard deduction from 2026; the engine carries $3,400 single and $6,850 joint, where the Comptroller has printed two different amounts',
    statement:
      'Md. Tax-General 10-217(b) sets the standard deduction at $3,350 for an individual and $6,700 for spouses on a joint return, a head of household or a surviving spouse, and (c) increases each amount for every taxable year beginning after December 31, 2025 by the IRC 1(f)(3) cost-of-living adjustment with calendar year 2024 as the base, as determined by the Comptroller, each increase rounded down to a multiple of $50. The Comptroller has printed two different 2026 figures: the 2026 Employer Withholding Guide gives $3,400, and the 2026 estimated-tax worksheet (Form PV, dated April 2026) gives $3,350 single and $6,700 joint, the 2025 amounts. The engine keeps $3,400 single, from the withholding guide, and computes the joint amount by the statute’s rule: the chained CPI average for September 2024 to August 2025 (177.2058) over that for September 2023 to August 2024 (173.0158) is a 2.4217% adjustment; $6,700 grows by $162.26, rounded down to $150, giving $6,850, and $3,350 grows by $81.13, rounded down to $50, giving the withholding guide’s $3,400. The 2026 figures (params/state/data/year2026.ts) carry $3,400 and $6,850; they carried $3,350 and $6,700 until the survey of 2026-09-28. Approximated because the statute leaves the adjustment to the Comptroller and the only joint amount the Comptroller has printed is $6,700: if that stands, the engine understates Maryland tax by $150 of deduction on a joint return, about $11.60 a year with a 3% county rate, and by $50 single. It is settled when the 2026 Form 502 instructions print the amounts, expected in January 2027. Later years are indexed the same way and stand at the 2026 amounts until the Comptroller publishes them.',
    classification: 'approximated',
    contraryReading:
      'Use the Comptroller’s 2026 estimated-tax worksheet, $3,350 single and $6,700 joint: the statute makes the adjustment the one the Comptroller determines, and the worksheet is the Comptroller’s latest print. Not taken because the Comptroller’s withholding guide prints $3,400 single, which is what the statute’s formula gives, and the worksheet’s amounts are the unindexed 2025 ones.',
    errorDirection: 'understatesTax',
    conventionRationale:
      'The joint figure rests on the statute’s rule and the Bureau of Labor Statistics chained CPI (series SUUR0000SA0); the same adjustment reproduces the withholding guide’s $3,400 and the federal $16,100 single deduction for 2026, which uses the same base-year substitution. The record is revisited when the 2026 Form 502 instructions publish.',
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General §10-217(b)(1) and (3)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-217.pdf',
      quotedText:
        '(b) (1) For an individual other than one described in paragraphs (2) and (3) of this subsection, the standard deduction is $3,350. … (3) For spouses on a joint return, the standard deduction is $6,700.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General §10-217(c)(1) and (3)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-217.pdf',
      quotedText:
        '(c) (1) For each taxable year beginning after December 31, 2025, the standard deduction amount specified in subsection (b) of this section shall be increased by an amount equal to the product of multiplying the standard deduction amount by the … (3) If any increase determined under paragraph (1) of this subsection is not a multiple of $50, the increase shall be rounded down to the next lowest multiple of $50',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Maryland Comptroller, 2026 Employer Withholding Guide, Reminders (single standard deduction)',
      url: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf',
      quotedText: 'For the purpose of the percentage method calculation the Standard Deduction is $3,400.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General §10-217(c)(2)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-217.pdf',
      quotedText:
        'for the calendar year in which a taxable year begins, as determined by the Comptroller, by substituting',
    }, {
      kind: 'formInstruction',
      citation: 'Maryland Comptroller, 2026 Form PV estimated-tax worksheet instructions, standard deduction',
      url: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/2026-pv-worksheet.pdf',
      quotedText:
        'your standard deduction amount … is $3,350. … amount is $6,700.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult',
    ],
  },

  'md-tg-10-105-a-3-capital-gain-surtax': {
    title: 'Maryland adds 2% on net capital gain when federal AGI exceeds $350,000; the engine also charges it on a primary-residence gain the law excludes',
    statement:
      'Md. Tax-General 10-105(a)(3), in effect since tax year 2025, makes the state income tax of an individual whose Maryland AGI includes net capital gain the sum of the rate schedule on Maryland taxable income and an additional 2% of the net capital gain included in Maryland AGI; (a)(4) applies it only to an individual with federal AGI above $350,000. (a)(3)(ii) excludes gain on a primary residence sold for less than $1,500,000, on assets held in 401(k), 403(b), 457(b), IRA, Roth IRA and similar plans, and on some farm, easement, section 179 and affordable-housing property. The 2026 figures (params/state/data/year2026.ts) carry the 2% and the $350,000 threshold, and the engine adds 2% of the net capital gain it taxes to Maryland state tax when federal AGI is above the threshold; county tax is not charged on it. Before the survey of 2026-09-28 it was not modeled, understating Maryland tax by $2,000 for a single filer with $500,000 of federal AGI that includes $100,000 of gain. Approximated because the state calculation receives a home sale’s taxable gain as capital gain like any other: the plan knows a property is a primary residence and its sale price, but the gain reaches the Maryland calculation without them, so a primary-residence gain on a sale under $1,500,000, which (a)(3)(ii) excludes, is surcharged, overstating Maryland tax by 2% of that gain ($2,000 on $100,000 above the section 121 exclusion). Gain on a taxable account is priced as the law requires; the other excluded assets (farm, easement, section 179 and affordable-housing property) are not modeled, and gain inside retirement plans never reaches net capital gain; whole-return accuracy is outside this record.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General §10-105(a)(3)(i)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-105.pdf',
      quotedText:
        'the State income tax for the individual is the sum of: 1. the rates specified in paragraph (1) or (2) of this subsection applied to Maryland taxable income; and 2. an additional 2% of the amount of net capital gain included in the individual’s Maryland adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General §10-105(a)(4)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-105.pdf',
      quotedText:
        '(4) The provisions of paragraph (3) of this subsection shall apply for individuals described in paragraph (1) or (2) of this subsection with a federal adjusted gross income in excess of $350,000.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General §10-105(a)(3)(ii)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-105.pdf',
      quotedText:
        'any amount of capital gain from the sale or exchange of the following assets is not subject to the additional 2% tax rate specified in subparagraph (i)2 of this paragraph: 1. any residential dwelling sold for less than $1,500,000 that is the individual’s primary residence',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateEnactedLaw.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateEnactedLaw.ts#marylandCapitalGainSurtax',
    ],
  },

  'md-tg-10-207-mm-public-safety-retirement-subtraction': {
    title: 'Maryland subtracts the first $16,000 of public-safety retirement income at 55, rising to $20,000 by 2030',
    statement:
      'Md. Tax-General 10-207(mm), as amended by 2026 Md. Laws ch. 686 (S.B. 607, approved May 26, 2026, effective July 1, 2026), subtracts income from an employee retirement system attributable to service as a correctional officer, law enforcement officer, or fire, rescue or emergency services personnel of the United States, the State or a political subdivision, received by an individual at least 55 on the last day of the taxable year: the first $16,000 for 2026, $17,000 for 2027, $18,000 for 2028, $19,000 for 2029 and $20,000 from 2030. 10-209(d)(2) keeps that income out of the pension exclusion. The 2026 figures and the figures enacted for 2027 to 2030 (params/state/data/year2026.ts, enacted2027.ts to enacted2030.ts) carry the amounts, and the engine subtracts them for each retiree 55 or older from a pension the plan marks with the state eligibility code MD-PUBLIC-SAFETY, taking the subtracted amount out of the pension exclusion. The planner’s pension editor does not yet offer that marker, so it reaches a plan only through its file or the MCP interface; an unmarked public-safety pension is taxed without the subtraction, which overstates Maryland tax by up to 4.75% of the amount, $760.00 in 2026 on a $30,000 police pension at 58. Settled for a marked pension; whole-return accuracy is outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute names the service, not a retirement system, so the plan states it with a marker on the pension rather than the engine inferring it from the payer, as West Virginia’s police and fire exclusion does with WV-POLICE-FIRE.',
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: '2026 Md. Laws ch. 686 (S.B. 607), Tax-General §10-207(mm)(2)',
      url: 'https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_686_sb0607T.pdf',
      quotedText:
        'income from an employee retirement system that is attributable to service as a public safety employee, if the income is received by an individual who is at least 55 years old on the last day of the taxable year.',
    }, {
      kind: 'statute',
      citation: '2026 Md. Laws ch. 686 (S.B. 607), Tax-General §10-207(mm)(3)(II) to (VI)',
      url: 'https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_686_sb0607T.pdf',
      quotedText:
        '(II) FOR A TAXABLE YEAR BEGINNING AFTER DECEMBER 31, 2025, BUT BEFORE JANUARY 1, 2027, THE FIRST $16,000 OF INCOME DESCRIBED UNDER PARAGRAPH (2) OF THIS SUBSECTION; (III) FOR A TAXABLE YEAR BEGINNING AFTER DECEMBER 31, 2026, BUT BEFORE JANUARY 1, 2028, THE FIRST $17,000 OF INCOME DESCRIBED UNDER PARAGRAPH (2) OF THIS SUBSECTION; … (VI) FOR A TAXABLE YEAR BEGINNING AFTER DECEMBER 31, 2029, THE FIRST $20,000 OF INCOME DESCRIBED UNDER PARAGRAPH (2) OF THIS SUBSECTION.',
    }, {
      kind: 'statute',
      citation: '2026 Md. Laws ch. 686 (S.B. 607), section 2 and approval',
      url: 'https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_686_sb0607T.pdf',
      quotedText: 'That this Act shall take effect July 1, 2026. Approved by the Governor, May 26, 2026.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General §10-209(d)(2)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-209.pdf',
      quotedText:
        '(2) Public safety employee retirement income that is included in the subtraction under … of this subtitle may not be taken into account for purposes of the subtraction under this section',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/data/enacted2027.ts',
      'packages/engine/src/params/state/data/enacted2028.ts',
      'packages/engine/src/params/state/data/enacted2029.ts',
      'packages/engine/src/params/state/data/enacted2030.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateEnactedLaw.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MD',
      'packages/engine/src/params/state/data/enacted2027.ts#states.MD',
      'packages/engine/src/params/state/data/enacted2028.ts#states.MD',
      'packages/engine/src/params/state/data/enacted2029.ts#states.MD',
      'packages/engine/src/params/state/data/enacted2030.ts#states.MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult',
      'packages/engine/src/tax/stateEnactedLaw.ts#marylandPublicSafetySubtraction',
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

  'ncgs-105-153-7-2026-flat-rate-and-standard-deduction': {
    title: 'North Carolina taxes TY2026 ordinary income at 3.99% after supported single/MFJ standard deductions',
    statement:
      'For taxable years beginning in 2026, N.C. Gen. Stat. §105-153.7(a) imposes a flat 3.99% tax on North Carolina taxable income. The codified table quoted below still reads "After 2025 3.99%"; Session Law 2026-41, section 44.1(a), rewrote it to 3.99% for 2026 and lower rates from 2027, and moved the first section 105-153.7(a1) revenue trigger to taxable years beginning in 2035 (nc-sl-2026-41-2027-flat-rate). Later years are outside this record. Section 105-153.5(a)(1) sets fixed standard-deduction amounts by filing status: $12,750 single and $25,500 married filing jointly/surviving spouse. The statute has no annual indexing formula; NCDOR\'s 2026 NC-40 worksheet republishes the same cells under a "For Tax Years Beginning on or after January 1, 2026" footer. The pack stores those deduction cells and a single 3.99% bracket for both supported filing statuses. North Carolina does not import the federal age-65 standard-deduction addition; the state amount is filing-status based only. Settled only for that TY2026 flat ordinary rate and supported single/MFJ standard-deduction mapping; head-of-household, married-filing-separate, itemization, child-deduction schedules, Bailey and military limbs, and whole-return accuracy are outside this record. The record is bounded to TY2026, the year the rewritten table still sets at 3.99%.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Except as otherwise provided in subsection (a1) of this section, the tax is a percentage of the taxpayer\'s North Carolina taxable income computed as follows:',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a), TY2026 flat rate',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Taxable Years Beginning	Tax\nIn 2022	4.99%\nIn 2023	4.75%\nIn 2024	4.5%\nIn 2025	4.25%\nAfter 2025	3.99%.',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a1) (trigger scope)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Notwithstanding the tax rates set out in subsection (a) of this section, if total General Fund revenue in a fiscal year set out below exceeds the trigger amount indicated for that fiscal year, then the applicable tax rate for the indicated and subsequent tax years shall be equal to the greater of (i) the prior taxable year\'s rate decreased by one-half percentage point (0.50%) or (ii) two and forty-nine hundredths percent (2.49%). For purposes of this subsection, total General Fund revenue is the amount stated in the final accounting of total General Fund Reverting Net Tax and Non-Tax Revenues for the fiscal year, as reported by the Office of State Controller in August following the end of the fiscal year.\nFiscal Year	Trigger Amount	Taxable Year Beginning\nFY 2025-2026	$33,042,000,000	In 2027',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.5(a)(1), standard deduction table',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.5.html',
      quotedText:
        'The standard deduction amount is zero for a person who is not eligible for a standard deduction under section 63 of the Code. For all other taxpayers, the standard deduction amount is equal to the amount listed in the table below based on the taxpayer\'s filing status: … Filing Status Standard Deduction Married, filing jointly/surviving spouse $25,500 Head of Household 19,125 Single 12,750 Married, filing separately 12,750.',
    }, {
      kind: 'formInstruction',
      citation: 'North Carolina DOR, Form NC-40 2026, worksheet Line 6 standard deduction instruction',
      url: 'https://www.ncdor.gov/individual-estimated-income-tax/open',
      quotedText:
        'If you plan to claim the N.C. standard deduction, use the amount shown below for your filing status.',
    }, {
      kind: 'formInstruction',
      citation: 'North Carolina DOR, Form NC-40 2026, worksheet page 2 standard deduction table',
      url: 'https://www.ncdor.gov/individual-estimated-income-tax/open',
      quotedText:
        'If you plan to claim the N.C. standard deduction, use the amount shown below for your filing status. … Married, filing jointly/surviving spouse $ 25,500 … Single $ 12,750 … For Tax Years Beginning on or after January 1, 2026',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'nc-sl-2026-41-2027-flat-rate': {
    title: 'North Carolina taxes TY2027 ordinary income at 3.49% under Session Law 2026-41',
    statement:
      'Session Law 2026-41 (Senate Bill 257, the Current Operations Appropriations Act of 2026, chaptered on July 7, 2026), section 44.1(a), rewrites the rate table in N.C. Gen. Stat. §105-153.7(a): 3.99% for taxable years beginning in 2026, 3.49% in 2027, 2028 and 2029, 3.24% in 2030, 2031 and 2032, and 2.99% after 2032. The same section rewrites the (a1) revenue trigger: its first row is now fiscal year 2033-2034 for taxable years beginning in 2035, so the 2027 rate no longer depends on fiscal year 2025-2026 revenue. Section 44.1(b) makes the section effective when the act became law. The rates enacted for 2027 (params/state/data/enacted2027.ts) carry 3.49% for 2027, read as enacted rather than projected from 2026, and hold it through 2029; the 3.24% and 2.99% steps are the record nc-sl-2026-41-rate-steps-2030-and-after. The standard deduction is the fixed §105-153.5(a)(1) amount, as for 2026. The codified statute page still showed the table before the act when this was verified.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The session law is quoted rather than the codified section because the codified page had not been updated when this was verified on 2026-09-28. The act strikes the fiscal year 2025-2026 trigger row, so no revenue test can move the 2027 rate. The record covers 2027 to 2029, the years the 3.49% row names.',
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(a), rewriting N.C. Gen. Stat. §105-153.7(a)',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'In 2026 3.99% In 2027, 2028, and 2029 3.49% In 2030, 2031, and 2032 3.24% After 2032 2.99%',
    }, {
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(a), rewriting N.C. Gen. Stat. §105-153.7(a1), first trigger rows',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'FY 2033‑2034 $40,258,000,000 In 2035 FY 2034‑2035 $41,087,000,000 In 2036',
    }, {
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(b)',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'SECTION 44.1.(b) This section is effective when this act becomes law.',
    }, {
      kind: 'legislativeHistory',
      citation: 'N.C. General Assembly, Senate Bill 257 / SL 2026-41, bill history',
      url: 'https://www.ncleg.gov/BillLookUp/2025/S257',
      quotedText:
        'Ch. SL 2026-41 Documents: None Votes: None Date: 7/7/2026 Chamber: Action: Signed by Gov. 7/7/2026',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2027,
    effectiveThrough: 2029,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/enacted2027.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/enacted2027.ts#states.NC',
      'packages/engine/src/params/state/index.ts#stateParamsFor',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'nc-sl-2026-41-rate-steps-2030-and-after': {
    title: 'North Carolina taxes TY2030 to TY2032 at 3.24% and later years at 2.99% under Session Law 2026-41',
    statement:
      'Session Law 2026-41, section 44.1(a), sets the rate in N.C. Gen. Stat. §105-153.7(a) at 3.24% for taxable years beginning in 2030, 2031 and 2032 and 2.99% for taxable years beginning after 2032. Neither step depends on revenue. The rewritten (a1) trigger can cut the rate further, to the greater of the prior year\'s rate less one-fourth of a point (the act strikes "one-half" and "(0.50%)" and inserts "one-fourth" and "(0.25%)") or 2.49%, but only for the taxable year named beside a fiscal year whose General Fund revenue exceeds its trigger amount; the first such row is fiscal year 2033-2034, for taxable years beginning in 2035. The enacted-year figures carry 3.24% for 2030 (params/state/data/enacted2030.ts) and 2.99% for 2033 (enacted2033.ts), read as enacted, each held until the next; from 2035 the engine holds 2.99% and overstates the rate in any year a trigger fires. The standard deduction is the fixed §105-153.5(a)(1) amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The session law is quoted because the codified page had not been updated when this was verified on 2026-09-28. The (a1) cuts from 2035 turn on General Fund revenue that no projection can know, so the record covers 2030 to 2034, the years the unconditional rows fix.',
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(a), rewriting N.C. Gen. Stat. §105-153.7(a), rows for 2027 on',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'In 2027, 2028, and 2029 3.49% In 2030, 2031, and 2032 3.24% After 2032 2.99%',
    }, {
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(a), rewriting N.C. Gen. Stat. §105-153.7(a1), the trigger',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'Notwithstanding the tax rates set out in subsection (a) of this section, if total General Fund revenue in a fiscal year set out below exceeds the trigger amount indicated for that fiscal year, then the applicable tax rate for the indicated and subsequent tax years shall be equal to the greater of (i) the prior taxable year\'s rate decreased by ... or (ii) two and forty‑nine hundredths percent (2.49%).',
    }, {
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(a), rewriting N.C. Gen. Stat. §105-153.7(a1), first trigger rows',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'FY 2033‑2034 $40,258,000,000 In 2035 FY 2034‑2035 $41,087,000,000 In 2036',
    }, {
      kind: 'statute',
      citation: 'S.L. 2026-41, section 44.1(b)',
      url: 'https://www.ncleg.gov/Sessions/2025/Bills/Senate/HTML/S257v8.html',
      quotedText:
        'SECTION 44.1.(b) This section is effective when this act becomes law.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2030,
    effectiveThrough: 2034,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/enacted2030.ts',
      'packages/engine/src/params/state/data/enacted2033.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/enacted2030.ts#states.NC',
      'packages/engine/src/params/state/data/enacted2033.ts#states.NC',
      'packages/engine/src/params/state/index.ts#stateParamsFor',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'va-code-58-1-322-03-age-deduction-and-social-security': {
    title: 'Virginia deducts $12,000 at 65 from income of every kind, reduced above $50,000 or $75,000 of adjusted federal AGI',
    statement:
      'Va. Code 58.1-322.03(5) allows a deduction of $12,000 for each taxpayer born on or before January 1, 1939, and $12,000 for each later-born taxpayer who has attained 65, reduced $1 for each $1 by which the taxpayer\'s adjusted federal AGI exceeds $50,000 for a single taxpayer or $75,000 for married taxpayers. Form 760\'s instructions and its Age 65 and Older Deduction Worksheet settle what the subsection leaves open, and the engine follows them (tax/stateWestExtras.ts#virginiaAgeDeduction): adjusted federal AGI is federal AGI less the taxable Social Security and Tier 1 Railroad Retirement benefits in it, not less the gross benefits; a married couple\'s adjusted federal AGI is their joint figure, and when both spouses are income-tested the reduction comes once off their combined $24,000, which is then split evenly; and a taxpayer has attained 65 for a year when born on or before January 1 of the year 64 years earlier (for 2025, January 1, 1961). The deduction is Form 760 line 4, taken against income of every kind, so the engine applies it to wages, interest and gains as well as to pensions and IRA distributions (tax/stateTax.ts#computeStateTaxableIncomeResult). For a couple both 70 with $60,000 of pensions and no Social Security in 2026 it is $24,000, and their Virginia tax is $622.00. Until 2026-10-06 the pack carried the $12,000 as a retirement-income exclusion with no income test, and from #710 (2026-09-13) every projected year lost even that, because the projection always supplies characterized retirement rows and Virginia\'s branch for them had no age deduction; that couple was charged $1,987.30. A qualifying surviving spouse is unmarried and is held to the $50,000 threshold, and a part-year resident\'s deduction is prorated with the months of residence, as the standard deduction is (Form 760PY multiplies it by a ratio of days), while the Virginia slice is taxed on the unscaled rate schedule (va-code-58-1-322-03-2-personal-exemptions). Settled for the deduction, its income test and its cohorts. The engine models no Virginia conformity adjustment to federal AGI (worksheet lines 3 and 5), does not offer the disability income subtraction or the credits for low-income individuals and earned income that a taxpayer may claim instead of the deduction, and does not compute separate returns for a married couple; whole-return accuracy is outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(5)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '5. a. A deduction in the amount of $ 12,000 for individuals born on or before January 1, 1939. b. A deduction in the amount of $ 12,000 for individuals born after January 1, 1939, who have attained the age of 65. This deduction shall be reduced by $ 1 for every $ 1 that the taxpayer\'s adjusted federal adjusted gross income exceeds $ 50,000 for single taxpayers or $ 75,000 for married taxpayers. For married taxpayers filing separately, the deduction shall be reduced by $ 1 for every $ 1 that the total combined adjusted federal adjusted gross income of both spouses exceeds $ 75,000. For the purposes of this subdivision, "adjusted federal adjusted gross income" means federal adjusted gross income minus any benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code, as amended.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760 Resident Individual Income Tax Instructions, Line 4 Age Deduction',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
      quotedText:
        'Are you eligible to claim an age deduction? For the 2025 taxable year, taxpayers born on or before January 1, 1961, may qualify to claim an age deduction based on their birth date, filing status and income.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760 Resident Individual Income Tax Instructions, Taxpayers Age 65 and Older, adjusted federal adjusted gross income',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
      quotedText:
        'Your age deduction is based on your income. A taxpayer’s income, for purposes of determining an income-based age deduction, is the taxpayer’s adjusted federal adjusted gross income or “AFAGI.” A taxpayer’s AFAGI is the taxpayer’s federal adjusted gross income, modified for any conformity adjustments and reduced by any taxable Social Security and Tier 1 Railroad Benefits.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760 Resident Individual Income Tax Instructions, Taxpayers Age 65 and Older, married taxpayers',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
      quotedText:
        'For all married taxpayers, whether filing jointly or separately, the maximum allowable age deduction of $12,000 each is reduced $1 for every $1 the married taxpayers’ joint AFAGI exceeds $75,000.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760 Resident Individual Income Tax Instructions, Taxpayers Age 65 and Older, All Married Taxpayers',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
      quotedText:
        'If both spouses are claiming an income-based age deduction, regardless of whether filing jointly or separately, the married taxpayers must compute a joint age deduction first, then allocate half of the joint deduction to each spouse.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-10-06',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#VA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult',
      'packages/engine/src/tax/stateTax.ts#virginiaAdjustedFederalAgi',
      'packages/engine/src/tax/stateTax.ts#virginiaAgeDeductionClaimants',
      'packages/engine/src/tax/stateWestExtras.ts#virginiaAgeDeduction',
    ],
  },

  'va-railroad-retirement-and-unemployment-benefits-not-modeled': {
    title: 'Virginia subtracts Tier 2 and the other Railroad Retirement Act benefits included in federal AGI, beside the Tier 1 subtraction',
    statement:
      'Virginia Department of Taxation guidance on Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits states that federal and Virginia law exempt Tier 2 vested dual benefits, as well as certain other Railroad Retirement Act benefits and Railroad Unemployment Insurance benefits, from income tax, and that the subtraction is the benefit amount included in federal adjusted gross income as a taxable pension or annuity that was not already deducted on the federal return; the federal law is 45 U.S.C. 231m(a), which forbids any state tax on an annuity or supplemental annuity under the Railroad Retirement Act. Social Security and Tier 1 Railroad Retirement benefits are the separate subtraction of Va. Code 58.1-322.02(3), registered at `va-code-58-1-322-02-3-ss-tier1`. For a Virginia year `characterizedRetirementDelta` subtracts the federally included amount of every pension whose source is Railroad Tier II or Railroad Retirement Act (other) (`railroadRetirementActSubtraction`), beside the Tier I subtraction, so each railroad dollar comes off once. A single filer aged 60 with 100,000 dollars of ordinary income that includes a 20,000 dollar tier II annuity has Virginia taxable income of 70,320 dollars after the 8,750 dollar standard deduction and the 930 dollar exemption and pays 3,785.90 dollars for 2026; before 2026-09-30 the engine taxed the annuity like any pension and charged 4,935.90. Settled for a pension tagged with one of these railroad sources; the engine deducts nothing for them on the federal return, so the whole federally included amount is subtracted. A railroad employer’s own plan is a private pension and is not subtracted; Railroad Unemployment Insurance benefits have no income type in the plan and are outside this record. The id keeps its earlier suffix.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, Subtractions: Social Security Act and Equivalent Tier 1 Railroad Retirement Act Benefits',
      url: 'https://www.tax.virginia.gov/subtractions',
      quotedText:
        'Virginia law exempts Social Security and Tier 1 Railroad Retirement benefits from taxation. If you were required to include any of your benefits in federal adjusted gross income, subtract that amount on your Virginia return. Do not include Tier 2 Railroad Retirement Benefits and Other Railroad Retirement and Railroad Unemployment Benefits. For subtracting other benefits, see Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, Subtractions: Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits',
      url: 'https://www.tax.virginia.gov/subtractions',
      quotedText:
        'Federal and Virginia law exempt Tier 2 vested dual benefits, as well as certain other Railroad Retirement Act benefits and Railroad Unemployment Insurance benefits from income tax. The amount to be subtracted is the benefit amount that was included in federal adjusted gross income as a taxable pension or annuity, and that was not already deducted on your federal return.',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231m(a)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(a) Except as provided in subsection (b) of this section and the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.], notwithstanding any other law of the United States, or of any State, territory, or the District of Columbia, no annuity or supplemental annuity shall be assignable or be subject to any tax or to garnishment, attachment, or other legal process under any circumstances whatsoever, nor shall the payment thereof be anticipated',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-30',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.VA',
      'packages/engine/src/projection/internal/stateRetirementFactsAdapter.ts#mapPensionSourceToStateKind',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#federalRailroadRetirementActKinds',
      'packages/engine/src/tax/stateRailroadAndMilitary.ts#railroadRetirementActSubtraction',
      'packages/engine/src/tax/stateTax.ts#characterizedRetirementDelta',
    ],
  },
  'va-code-58-1-322-03-standard-deduction-steps': {
    title: 'Virginia’s standard deduction is $9,200 and $18,400 for 2027, $9,300 and $18,600 for 2028 and 2029, and $3,000 and $6,000 from 2030',
    statement:
      'Va. Code 58.1-322.03(1)(b) sets the standard deduction for a taxpayer who has not itemized on the federal return: $8,750 single and $17,500 married for 2025 and 2026 ((v)); $9,200 and $18,400 for taxable years beginning in 2027 ((vi)); $9,300 and $18,600 for 2028 and 2029 ((vii)); and $3,000 and $6,000 on and after January 1, 2030 ((i)), when the temporary amounts end. A married individual filing a separate return takes half. The code attaches no condition to any of these amounts. The figures enacted for 2027, 2028 and 2030 (params/state/data/enacted2027.ts, enacted2028.ts and enacted2030.ts) carry them and hold the 2030 amounts for later years, so from 2030 the engine charges more Virginia tax on the same income than in 2029. Settled for the single and joint amounts; the requirement not to itemize federally, the limit for a dependent and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Virginia has extended its temporary amounts before; the record carries the code as it reads on 2026-09-28, and the 2030 amount is re-read at each refresh.',
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(1)(b)(vi) and (vii)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '(vi) for taxable years beginning on and after January 1, 2027, but before January 1, 2028, $9,200 for single individuals and $18,400 for married persons (one-half of such amounts in the case of a married individual filing a separate return); and (vii) for taxable years beginning on and after January 1, 2028, but before January 1, 2030, $9,300 for single individuals and $18,600 for married persons',
    }, {
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(1)(b)(i)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        'b. Provided that the taxpayer has not itemized deductions for the taxable year on his federal income tax return: (i) for taxable years beginning before January 1, 2019, and on and after January 1, 2030, $ 3,000 for single individuals and $ 6,000 for married persons',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2027,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/enacted2027.ts',
      'packages/engine/src/params/state/data/enacted2028.ts',
      'packages/engine/src/params/state/data/enacted2030.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/enacted2027.ts#states.VA',
      'packages/engine/src/params/state/data/enacted2028.ts#states.VA',
      'packages/engine/src/params/state/data/enacted2030.ts#states.VA',
      'packages/engine/src/params/state/index.ts#stateParamsFor',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'va-code-58-1-322-03-optimizer-state-base-uses-federal-deduction': {
    title: 'The optimizer prices a state’s brackets on federal taxable income, so a state deduction smaller than the federal one and the state’s exemptions are left out of its in-solve state tax (Virginia is the pinned case)',
    statement:
      'The optimizer’s linear program lays a state’s brackets over its own taxable ordinary income, which is gross ordinary income less the federal deduction (projection/optimizePlan.ts#stateBracketSegmentsFor, strategies/optimizer.ts#buildOptimizerModel). It therefore uses the federal deduction in place of the state’s own deduction and ignores the state’s personal exemptions. Where the state’s own deduction is larger than the federal one, the difference is added as a zero-rate band, which is Washington’s $1,000,000 alone today (wa-essb-6346-s316-standard-deduction-indexing). Every other state’s deduction and exemptions together are smaller than the federal deduction, so the solve starts the state’s brackets too high and understates its state tax, most in the lower bands. Virginia is the pinned case: for 2026 Va. Code 58.1-322.03 allows $8,750 single plus a $930 exemption, where the LP subtracts the federal $16,100; on $60,000 of ordinary income the LP charges $2,266.75 of Virginia tax where the law charges $2,635.90, $369.15 less, which is the $6,420 between the two deductions at 5.75%. The marginal rate the solve sees is the state’s own except within that width of a bracket boundary, and the exact projection re-prices every schedule the solve proposes, so the gap reaches a recommendation only through the schedule it proposes. A deduction tagged as the federal one is exact already. State retirement exclusions are also left to the exact projection, as the model states, and so is Virginia’s age deduction at 65 (va-code-58-1-322-03-age-deduction-and-social-security), which the pinned filer, under 65, does not take.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(1)(b)(i)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        'b. Provided that the taxpayer has not itemized deductions for the taxable year on his federal income tax return: (i) for taxable years beginning before January 1, 2019, and on and after January 1, 2030, $ 3,000 for single individuals and $ 6,000 for married persons',
    }, {
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(2)(a)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '2. a. A deduction in the amount of $ 930 for each personal exemption allowable to the taxpayer for federal income tax purposes.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/projection/optimizePlan.ts',
      'packages/engine/src/strategies/optimizer.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.VA',
      'packages/engine/src/projection/optimizePlan.ts#stateBracketSegmentsFor',
      'packages/engine/src/projection/optimizePlan.ts#buildOptimizerInput',
      'packages/engine/src/strategies/optimizer.ts#buildOptimizerModel',
    ],
  },

  'va-code-58-1-322-03-2-personal-exemptions': {
    title: 'Virginia deducts $930 for each personal exemption and $800 more for each taxpayer 65 or older',
    statement:
      'Va. Code 58.1-322.03(2)(a) deducts $930 for each personal exemption allowable to the taxpayer for federal income tax purposes, and (2)(b) gives each blind or aged taxpayer, as IRC 63(f) defines them, an additional $800. Both apply whether or not the taxpayer itemizes. The 2026 figures (params/state/data/year2026.ts) carry them: one exemption for a single filer and two on a joint return, plus $800 for each taxpayer 65 or older. Before the survey of 2026-09-28 the engine allowed neither, overstating Virginia tax by $99.48 for a single filer aged 65 and $198.95 for a couple both 65 in the 5.75% band. The $800 goes to a taxpayer 65 on or before January 1 of the following year, as Form 760 counts it, read from the claimants’ dates of birth (stateTax.ts#virginiaAgedTaxpayerCount); until 2026-10-06 the engine counted the age at the end of the year, so a taxpayer whose 65th birthday is January 1 lost the $800 for the year before it, $46 of tax in the 5.75% band. A part-year resident’s $930 and $800 are prorated with the months of residence, as Form 760PY’s Prorated Exemption Worksheet prorates the personal exemptions by days resident and the $800 is an additional personal exemption (stateTax.ts#prorateParams); until 2026-10-06 the engine gave the Virginia slice of the year the whole exemptions. The slice is taxed on the ordinary rate schedule, unscaled, because Form 760PY computes the tax on its Virginia taxable income from the same Tax Rate Schedule a full-year resident uses, and prorates only the standard deduction, the exemptions and the age deduction (the pack’s partYearRateSchedule, stateTax.ts#prorateParams). Until 2026-10-06 the engine scaled the brackets with the months as well: a single filer under 65, resident six months with $60,000 of ordinary income, paid $1,317.95 of Virginia tax where 760PY gives $1,189.20. The engine spreads the year’s income evenly over the months, so it prorates by months where 760PY prorates the standard deduction by the share of federal AGI received while resident and the exemptions by days; a year whose income fell unevenly across the move is outside this record. Every other state’s slice still scales its brackets with the months, which is the same as taxing the year’s income as a full-year resident and keeping the resident share; that overstates the tax of a state whose part-year return taxes the resident-period income on its ordinary schedule, as New Jersey’s does, and no other state’s part-year method has been reviewed. Settled for the taxpayer and spouse exemptions and the age addition; dependents are not collected by the plan, blindness is not modeled, and whole-return accuracy is outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(2)(a)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '2. a. A deduction in the amount of $ 930 for each personal exemption allowable to the taxpayer for federal income tax purposes.',
    }, {
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(2)(b)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        'b. Each blind or aged taxpayer as defined under § 63(f) of the Internal Revenue Code shall be entitled to an additional personal exemption in the amount of $ 800. The additional deduction for blind or aged taxpayers allowed under this subdivision shall be allowable regardless of whether the taxpayer itemizes deductions for the taxable year for federal income tax purposes.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760 Resident Individual Income Tax Instructions, Exemptions, 65 or Older',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
      quotedText:
        '65 or Older: To qualify for the additional personal exemption for age 65 or older, you must have been age 65 or older on or before January 1, 2026.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760PY Part-Year Resident Instructions, Part 2 Prorated Exemption Worksheet',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf',
      quotedText:
        'The prorated exemptions worksheet is used to reduce your personal and dependent exemptions to an amount which is proportional to the number of days you resided in Virginia during the taxable year.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760PY Part-Year Resident Instructions, Line 17 Income Tax',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf',
      quotedText:
        'If Line 16 exceeds the amount listed in the Tax Table included in these instructions, compute the tax from the Tax Rate Schedule for You on Line 17a and Spouse on Line 17b.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, 2025 Form 760PY Part-Year Resident Instructions, Tax Rate Schedule',
      url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf',
      quotedText:
        'If your taxable income is $90,000, your tax is $720 + 5.75% of the amount over $17,000.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-10-06',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateEnactedLaw.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.VA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult',
      'packages/engine/src/tax/stateTax.ts#prorateParams',
      'packages/engine/src/tax/stateTax.ts#virginiaAgedTaxpayerCount',
      'packages/engine/src/tax/stateEnactedLaw.ts#virginiaPersonalExemptions',
    ],
  },

  'de-code-30-1106-b-3-military-pension-steps-2027-2029': {
    title: 'Delaware raises the military pension subtraction to $15,000, $20,000 and $25,000 over 2027 to 2029, and adds it at 60 and over',
    statement:
      '30 Del. C. 1106(b)(3), as amended by S.B. 219 (85 Del. Laws c. 426, signed and effective August 17, 2026), lets a person under 60 subtract the greater of up to $2,000 of employer or government pension and up to $15,000 of U.S. military pension for 2027, $20,000 for 2028 and $25,000 from 2029, up from $12,500; and a person 60 or older the greater of up to $12,500 of pension or eligible retirement income and the same military amount, where before a military pension counted only inside the $12,500. The limits apply to each spouse receiving a military pension. The figures enacted for 2027, 2028 and 2029 (params/state/data/enacted2027.ts to enacted2029.ts) carry both limbs, and the engine applies them to a pension the plan marks as U.S. military retirement. The same act adds a domicile test for the whole subtraction at 60 or older: three years of Delaware domicile, or five for a person domiciled from 2027. The plan holds no domicile history, so the engine assumes the test is met, which understates Delaware tax for a retiree who moved in recently; the act names no taxable year for the test, so whether it reaches 2026 is unresolved. Settled for the military limbs; the domicile test and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: '30 Del. C. §1106(b)(3)c. (S.B. 219, 85 Del. Laws c. 426)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'c. For the taxable year beginning on January 1, 2027: 1. For persons under age 60, the greater of: A. Amounts received, not to exceed $2,000, as pensions from employers, the United States, this State, or any subdivision of this State; or B. Amounts received, not to exceed $15,000, as a United States military pension. 2. For persons age 60 or older, the greater of: A. Amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income; or B. Amounts received, not to exceed $15,000, as a United States military pension.',
    }, {
      kind: 'statute',
      citation: '30 Del. C. §1106(b)(3)d. and e.',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'd. For the taxable year beginning on January 1, 2028: … B. Amounts received, not to exceed $20,000, as a United States military pension. … e. For taxable years beginning on or after January 1, 2029: … B. Amounts received, not to exceed $25,000, as a United States military pension.',
    }, {
      kind: 'statute',
      citation: '30 Del. C. §1106(b)(3)f.3. and f.4.',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The dollar limits of the subtraction modifications specified in this paragraph (b)(3) apply individually to each spouse who is receiving a United States military pension on a joint return. … A person who is age 60 or older is eligible for the subtraction under this paragraph (b)(3) only if 1 of the following applies:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2027,
    effectiveThrough: null,
    verifiedOn: '2026-09-28',
    implementedBy: [
      'packages/engine/src/params/state/data/enacted2027.ts',
      'packages/engine/src/params/state/data/enacted2028.ts',
      'packages/engine/src/params/state/data/enacted2029.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateNortheastExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/enacted2027.ts#states.DE',
      'packages/engine/src/params/state/data/enacted2028.ts#states.DE',
      'packages/engine/src/params/state/data/enacted2029.ts#states.DE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult',
      'packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction',
    ],
  },

  "de-early-distribution-gate": {
    "title": "Delaware early-distribution gate applies before pension exclusions",
    "statement": "An early distribution with Form 1099-R Box 7 code 1 or a federal premature-distribution penalty does not qualify for the pension exclusion, including the age-60-plus branch. Unknown classification is incomplete, not eligibility. The latest final TY2025 instructions are carried forward for TY2026 because enacted SB219 does not change this classification; final TY2026 instructions must be checked when published. A Roth conversion carries no premature distribution penalty (IRC 408A(d)(3)(A)(ii)), but the engine holds no date for the conversions its conversion strategy makes and marks an undated conversion of unknown early status unless the owner is 59 and a half on January 1. Such a conversion by a younger owner is withheld from the exclusion and the year marked incomplete, and one by an owner who turns 60 during the year but was under 59 and a half on January 1 gets no exclusion even when it came later; both overstate Delaware tax.",
    "classification": "unsettled",
    "contraryReading": "Final TY2026 administrative instructions may clarify or revise the carried-forward classification.",
    "errorDirection": null,
    "conventionRationale": "Use the latest final administrative classification without treating future instructions as published.",
    "jurisdiction": "state:DE",
    "authority": [
      {
        "kind": "formInstruction",
        "citation": "2025 PIT-RES instructions, p.6, Line 6 pension exclusion",
        "url": "https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf",
        "quotedText": "An early distribution from an IRA or pension fund for emergency reasons or following a separation from employment does not qualify for the pension exclusion. If the distribution code listed in Box 7 of your 1099 R is a 1 (one), or if you were assessed an early withdrawal penalty on federal 1040, Schedule 2, Line 8 for the distribution, then that distribution DOES NOT qualify for the pension exclusion."
      }
    ],
    "volatility": "awaitingGuidance",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DE",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction"
    ]
  },

  "dc-code-47-1803-03-government-survivor-exclusion": {
    "title": "District government survivor exclusion remains after the old pension exclusion expires",
    "statement": "Section 47-1803.02(a)(2)(N)(ii) excludes District or federal government survivor benefits received by a person age 62 or older at year end. It is separate from the $3,000 government-pension provision in (N)(i), which applies only before 2015. The eligible amount must be included in the federal base; ordinary pensions, nonqualifying issuers, Social Security survivor benefits and unknown issuer/age cannot establish this subtraction.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:DC",
    "authority": [
      {
        "kind": "statute",
        "citation": "D.C. Code §47-1803.02(a)(2)(N)(ii)",
        "url": "https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02",
        "quotedText": "Survivor benefits received from the District of Columbia or the federal government by persons who are 62 years of age or older by the end of the taxable year."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#dcGovernmentSurvivorExclusion"
    ]
  },

  "sc-sciad-act-110-retirement-income-deduction": {
    "title": "South Carolina SCIAD replaces the federal deduction for TY2026",
    "statement": "Act 110 establishes SCIAD of $15,000 single/MFS, $22,500 HOH, and $30,000 joint/surviving spouse. The phaseout uses federal AGI and status-specific start/width values in the 2026 pack, with zero deduction at or beyond the endpoint. It is a general return deduction, not a pension-only allowance. The rate schedule and SCIAD first apply after 2025.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "2026 Act 110, H.4216, SCIAD and effective date",
        "url": "https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm",
        "quotedText": "a South Carolina Income Adjusted Deduction (SCIAD) equal to: (i) fifteen thousand dollars for taxpayers who file as single or married filing separately; (ii) twenty-two thousand five hundred dollars for taxpayers who file as head of household; and (iii) thirty thousand dollars for taxpayers who file as married filing jointly or as a surviving spouse. … The deduction set forth in subitem (a)(i) is subject to being reduced by a fraction whereby the numerator is the amount the taxpayer's federal adjusted gross income exceeds forty thousand dollars and the denominator is fifty-five thousand. … If the fraction calculated by this subitem is equal to or exceeds one, then the deduction is not allowed. If the fraction is zero, then the deduction is not subject to being reduced. If the fraction is between zero and one, then the deduction must be reduced by the corresponding fraction. … This act takes effect upon approval by the Governor and first applies to tax years beginning after 2025."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "va-code-58-1-322-02-28-military-retirement-subtraction": {
    "title": "Virginia military subtraction is $40,000 per recipient from TY2025",
    "statement": "Section 58.1-322.02(18)(c) permits up to $40,000 of qualifying military benefits for TY2025 and later, at any age. Qualifying survivor benefits are included. OPM civil-service income and amounts already excluded or deducted under another provision do not enter this pool. Each recipient has a separate cap. The stable record ID retains its earlier suffix; the operative current paragraph is (18), not (28).",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(18)(c)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "For taxable years beginning on and after January 1, 2024, but before January 1, 2025, up to $30,000 of military benefits; and for taxable years beginning on and after January 1, 2025, up to $40,000 of military benefits. … For purposes of subdivisions b and c, \"military benefits\" means any (i) military retirement income received for service in the Armed Forces of the United States, (ii) qualified military benefits received pursuant to § 134 of the Internal Revenue Code, (iii) benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States under the Survivor Benefit Plan program established by the U.S. Department of Defense, and (iv) military benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States. The subtraction allowed by subdivision b shall be allowed only for military benefits received by an individual age 55 or older. The subtraction allowed by subdivision c shall be allowed for military benefits received by an individual of any age. No subtraction shall be allowed pursuant to subdivisions b and c if a credit, exemption, subtraction, or deduction is claimed for the same income pursuant to subdivision a or any other provision of Virginia or federal law."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaMilitarySubtraction"
    ]
  },

  "va-code-58-1-322-02-3-ss-tier1": {
    "title": "Virginia paragraph (3) subtracts included Social Security and Tier I",
    "statement": "Paragraph (3) subtracts benefits taxable solely under IRC §86, including included Social Security and Tier I Railroad Retirement. Do not subtract Social Security again when already removed from the state base. Tier II and ordinary annuities are outside this paragraph; separate federal-protection authority may govern other railroad benefits.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(3)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "Benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaSsTier1Subtraction"
    ]
  },

  "va-code-58-1-322-02-11-basis": {
    "title": "Virginia recovers contributions previously taxed by another state",
    "statement": "The subtraction covers included distributions from the enumerated §401, §408, §457 and federal retirement arrangements only to the extent contributions were federally deductible but taxed by another state. A Virginia-only contribution history is not sufficient. Require the prior taxing jurisdiction, qualifying plan and remaining unrecovered contribution basis; reduce the basis ledger only by accepted recovery. An employer plan qualifies when its plan type is 401(a), 401(k), 457(b) or an IRA (stateTax.ts#virginiaEnumeratedEmployerPlan). A 403(b) is not enumerated: it is not a §401 plan, a §408 IRA or a §457 plan, so a 403(b) distribution gets no subtraction whatever basis another state taxed, and neither does an employer plan of other, unknown or undeclared type. Until 2026-10-06 the engine accepted every declared employer-plan type but other and unknown, so a 403(b) with $4,000 federally included and $6,000 of basis taxed by another state had $4,000 subtracted. The statute's separate federal-government-retirement-program limb is reached through a federal civil service source, never through the 403(b) label.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(11)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "Any income received during the taxable year derived from a qualified pension, profit-sharing, or stock bonus plan as described by § 401 of the Internal Revenue Code, an individual retirement account or annuity established under § 408 of the Internal Revenue Code, a deferred compensation plan as defined by § 457 of the Internal Revenue Code, or any federal government retirement program, the contributions to which were deductible from the taxpayer's federal adjusted gross income, but only to the extent the contributions to such plan or program were subject to taxation under the income tax in another state."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-10-06",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateTax.ts#virginiaEnumeratedEmployerPlan",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaPriorStateBasisSubtraction"
    ]
  },

  "wv-code-11-21-exemptions-retirement-public-ss": {
    "title": "West Virginia personal and surviving-spouse exemptions",
    "statement": "The personal exemption is $2,000 per qualifying exemption. The $500 alternative applies specifically to the IRC §151(d)(2) dependency reason, not every zero federal exemption. An unremarried surviving spouse receives the additional $2,000 in each of the two tax years after death. Unknown exemption count, zero-exemption reason or survivor conditions cannot establish an allowance. Retirement modifications and historical Social Security have separate records.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-16(a),(c),(d)",
        "url": "https://code.wvlegislature.gov/11-21-16/",
        "quotedText": "… with respect to any taxable year beginning on or after January 1, 1987, said exemption shall be $2,000. … For taxable years beginning after December 31, 1986, a surviving spouse shall be allowed one additional exemption of $2,000 for the two taxable years beginning after the year of death of the deceased spouse."
      },
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-16(d)",
        "url": "https://code.wvlegislature.gov/11-21-16/",
        "quotedText": "Notwithstanding any provisions in this section, for taxable years beginning after December 31, 1986, a resident individual whose exemption amount for federal tax purposes is zero by virtue of section 151(d)(2) of the Internal Revenue Code of 1986, shall be allowed a single West Virginia exemption in the amount of $500."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaExemptions"
    ]
  },

  "wv-code-11-21-12-c9-age-disability-residual": {
    "title": "West Virginia $8,000 age/disability modification uses the owner’s residual limit",
    "statement": "An owner age 65 at year end or properly certified permanently and totally disabled may deduct no more than $8,000 of included income less that owner’s modifications under (c)(1),(2),(5),(6),(7),(8). The total cannot exceed remaining included income. Apply the prior-modification ledger per person, not a new household $8,000 allowance. Unknown certification or prior modifications is incomplete.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(9)(i)-(ii)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(9) Federal adjusted gross income in the amount of $8,000 received from any source after December 31, 1986, by any person who has attained the age of 65 on or before the last day of the taxable year, or by any person certified by proper authority as permanently and totally disabled, regardless of age, on or before the last day of the taxable year, to the extent includable in federal adjusted gross income for federal tax purposes: Provided, That if a person has a medical certification from a prior year and he or she is still permanently and totally disabled, a copy of the original certificate is acceptable as proof of disability. A copy of the form filed for the federal disability income tax exclusion is acceptable: Provided, however, That: (i) Where the total modification under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection is $8,000 per person or more, no deduction shall be allowed under this subdivision; and (ii) Where the total modification under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection is less than $8,000 per person, the total modification allowed under this subdivision for all gross income received by that person shall be limited to the difference between $8,000 and the sum of modifications under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection;"
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaAge65Modification"
    ]
  },

  "wv-code-11-21-12-c5-c6-public-retirement": {
    "title": "West Virginia distinguishes the combined $2,000 public bucket from full police/fire exclusions",
    "statement": "PERS, Teachers and qualifying federal retirement systems share a $2,000 limit per recipient; they do not each create a new cap. Named West Virginia police/fire systems have a separate full exclusion. A generic public or federalCivilService label without statutory-system proof does not establish the appropriate bucket.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(5)-(6)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(5) Annuities, retirement allowances, returns of contributions and any other benefit received under the West Virginia Public Employees Retirement System, and the West Virginia State Teachers Retirement System, including any survivorship annuities derived therefrom, to the extent includable in gross income for federal income tax purposes: Provided, That notwithstanding any provisions in this code to the contrary this modification shall be limited to the first $2,000 of benefits received under the West Virginia Public Employees Retirement System, the West Virginia State Teachers Retirement System and, including any survivorship annuities derived therefrom, to the extent includable in gross income for federal income tax purposes for taxable years beginning after December 31, 1986; and the first $2,000 of benefits received under any federal retirement system to which 4 U.S.C. § 111 applies: Provided, however, That the total modification under this paragraph shall not exceed $2,000 per person receiving retirement benefits and this limitation shall apply to all returns or amended returns filed after December 31, 1988; (6) Retirement income received in the form of pensions and annuities after December 31, 1979, under any West Virginia police, West Virginia Firemen’s Retirement System or the West Virginia State Police Death, Disability and Retirement Fund, the West Virginia State Police Retirement System or the West Virginia Deputy Sheriff Retirement System, including any survivorship annuities derived from any of these programs, to the extent includable in gross income for federal income tax purposes;"
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaPublicMilitary"
    ]
  },

  "wv-code-11-21-12-c7-military": {
    "title": "West Virginia qualifying uniformed-services retirement and survivors are fully excluded",
    "statement": "The current military/uniformed-services provisions exclude the included qualifying retirement and survivor amount without the older $20,000 cap. The named military, reserve, Guard, PHS and NOAA source definitions matter; private and unclassified public pensions do not qualify.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(7)(C)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "For taxable years beginning after December 31, 2017, military retirement income, including retirement income from the regular Armed Forces, Reserves and National Guard paid by the United States or by this state after December 31, 2017, including any survivorship annuities, to the extent included in federal adjusted gross income for the taxable year. … For taxable years beginning after December 31, 2018, retirement income from the uniformed services, including the Army, Navy, Marines, Air Force, Space Force, Coast Guard, Public Health Service, National Oceanic Atmospheric Administration, reserves, and National Guard, paid by the United States or by this state after December 31, 2018, including any survivorship annuities, to the extent included in federal adjusted gross income for the taxable year."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaPublicMilitary"
    ]
  },

  "wv-code-11-21-12-c12-railroad": {
    "title": "West Virginia subtracts federally protected Tier I income",
    "statement": "Included Tier I Railroad Retirement is protected by (c)(12). Do not subtract gross benefits exceeding the amount in federal AGI or claim a second subtraction for an already removed amount. Ordinary pensions are outside this category.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(12)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "Any other income which this state is prohibited from taxing under the laws of the United States including, but not limited to, tier I retirement benefits as defined in Section 86(d)(4) of the Internal Revenue Code."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "wv-code-11-21-12-c8-social-security-phase-in": {
    "title": "West Virginia historical Social Security phase-in depends on AGI and year",
    "statement": "At or below $50,000 AGI ($100,000 joint), 100% of federally included Social Security is subtracted since 2022. Above that threshold the subtraction is 35% in 2024, 65% in 2025 and 100% from 2026. The year-specific rule applies only to the federally included amount; the 2026 no-SS-tax base must not subtract it twice. Unsupported historical years must not inherit a guessed percentage.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(8)(A)-(F)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(A) For taxable years beginning on or after January 1, 2022, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(B) of this code. (B) The deduction allowed by §11-21-12(c)(8)(A) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return does not exceed $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return. (C) For taxable years beginning on and after January 1, 2024, 35 percent of the amount of social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (D) For taxable years beginning on or after January 1, 2025, 65 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (E) For taxable years beginning on or after January 1, 2026, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (F) The deduction allowed by §11-21-12(c)(8)(C), §11-21-12(c)(8)(D), and §11-21-12(c)(8)(E) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return exceeds $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2022,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaSocialSecuritySubtraction"
    ]
  },

} satisfies Record<string, TaxRuleRecord>
