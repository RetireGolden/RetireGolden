/**
 * State records for the West: AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY.
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
export const westStateRecords = {
  'nv-const-10-1-9-no-personal-income-tax': {
    title: 'Nevada may not tax the personal income of a natural person',
    statement:
      'The Nevada Constitution forbids an income tax on the wages OR the personal income of natural persons, reserving to the Legislature only the income or revenue of a business conducted for profit. The bar is not confined to earned income, so a Nevada retiree\'s pension, IRA and 401(k) distributions, Social Security and capital gains are all beyond the state\'s reach. The pack models this as `hasIncomeTax: false`, which makes the whole state base zero rather than exempting income category by category.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NV',
    authority: [{
      kind: 'statute',
      citation: 'Nev. Const. art. 10, sec. 1(9)',
      url: 'https://www.leg.state.nv.us/const/nvconst.html',
      quotedText:
        'No income tax shall be levied upon the wages or personal income of natural persons. Notwithstanding the foregoing provision, and except as otherwise provided in subsection 1 of this Section, taxes may be levied upon the income or revenue of any business in whatever form it may be conducted for profit in the State.',
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
      'packages/engine/src/params/state/data/year2026.ts#NV',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
  // ---------------------------------------------------------------------------
  // The remaining no-individual-income-tax states, researched 2026-08-05.
  //
  // Nevada, Texas and Florida were registered in the first state slice above.
  // Alaska, South Dakota, Tennessee and Wyoming are the rest of the seven, and
  // they are here in one block because they share a problem the earlier three
  // did not have: what has to be established is an ABSENCE, and an absence has
  // no operative language. There is no section to quote, because the point is
  // that no section exists.
  //
  // That splits the seven into two grades, and the grade is the most important
  // thing each record below carries:
  //
  //   Constitutional — a prohibition addressed to a natural person's income.
  //   It carries the whole claim by itself, because the legislature CANNOT
  //   levy: the absence is not a policy fact that could change between pack
  //   refreshes. Nevada, Texas and Tennessee (for earned income only).
  //
  //   Statutory absence — no imposition exists in the code. That is a fact
  //   about what is missing, so the record rests on the revenue department's
  //   or the legislature's own affirmative statement of the negative, and the
  //   state is one ordinary session away from changing. South Dakota and
  //   Wyoming, and Tennessee again for everything a retiree actually lives on.
  //
  // Alaska sits between them and closer to the top: 43.20.012(a) is not an
  // absence at all but an express statutory exclusion of individuals from the
  // only income tax Alaska has, which needs no negative inference. What it
  // lacks is permanence.
  //
  // Two of these records quote an authority that appears to CONTRADICT the
  // statement above it. That is deliberate and it is the whole reason the
  // record is trustworthy. South Dakota's constitution expressly EMPOWERS its
  // legislature to tax incomes, and Wyoming's conditions an income tax on a
  // full credit rather than barring one — so a reader who saw only "no income
  // tax" would come away believing both states are locked the way Nevada is.
  // Quoting the provision that runs the other way is what stops that, and what
  // tells the annual re-verification pass which of these five can move.
  // ---------------------------------------------------------------------------

  'ak-stat-43-20-012-a-tax-does-not-apply-to-individuals': {
    title: 'Alaska’s net income tax does not apply to an individual',
    statement:
      'Alaska has one income tax, the Alaska Net Income Tax Act of chapter 43.20, and 43.20.012(a) states in terms that the tax imposed by that chapter does not apply to an individual or to a fiduciary. What the chapter does impose, at 43.20.011(e), falls on the taxable income of every CORPORATION. So no wage, capital gain, Social Security benefit, pension, or IRA or 401(k) distribution of an Alaska individual is subject to Alaska income tax, which is what the pack encodes as `hasIncomeTax: false`. This is a stronger footing than an absence: the exclusion is enumerated, so nobody has to be persuaded that a list of impositions is exhaustive. It is a weaker footing than Nevada\'s or Texas\'s: Alaska has no constitutional bar on an income tax, and a later legislature can amend 43.20.012(a) by simple majority.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AK',
    authority: [{
      // The print-fetch URL rather than the practitioner one. akleg.gov serves
      // its statutes through an AJAX endpoint: `statutes.asp#43.20.012`
      // resolves in a browser and returns a shell to everything else, so a
      // citation to it could never be checked against the text it claims to
      // quote. This URL is the same publisher serving the same chapter, and it
      // is the one that actually contains the words below.
      kind: 'statute',
      citation: 'Alaska Stat. 43.20.012(a)',
      url: 'https://www.akleg.gov/basis/statutes.asp?media=print&type=fetch&secEnd=43.20.030',
      quotedText:
        'The tax imposed by this chapter does not apply to (1) an individual; (2) a fiduciary;',
    }, {
      // Quoted so the record is not read as "Alaska has no income tax". It has
      // one; individuals are excluded from it. Without this the reader cannot
      // tell whether the exclusion above is the whole chapter or a carve-out
      // from something broader.
      kind: 'statute',
      citation: 'Alaska Stat. 43.20.011(e)',
      url: 'https://www.akleg.gov/basis/statutes.asp?media=print&type=fetch&secEnd=43.20.030',
      quotedText:
        'There is imposed for each taxable year upon the entire taxable income of every corporation derived from sources within the state a tax computed as follows:',
    }],
    volatility: 'staticStatute',
    // Not 1981. The individual tax was dismantled in two steps — 43.20.010 in
    // 1975 and the rate schedules that had moved to 43.20.011(a)-(d) in 1980 —
    // and neither session law is published on akleg.gov in any form. The only
    // evidence of either is the codifier's bracketed note in the current
    // statute, which this record deliberately does not quote: akleg.gov serves
    // latin-1, so the section sign in "[Repealed, § 13 ch 70 SLA 1975.]" cannot
    // survive as text and a quote carrying it could never be verified. A start
    // year inferred from a repeal nobody can read is a guess.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AK',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wy-stat-39-12-101-no-state-or-local-income-tax': {
    title: 'Wyoming levies no income tax, and no local one is possible',
    statement:
      'Wyoming\'s entire statutory income tax chapter is one section, and it imposes nothing. Title 39 chapter 12 consists of 39-12-101 alone, which preempts the field of income, earning and wage-based taxation to the state and forbids every county, city, town and other political subdivision to impose, levy or collect one. So the state-level negative the pack carries as `hasIncomeTax: false` is a statutory absence — the field is simply empty — while the LOCAL negative is affirmative, quotable and stronger: no Wyoming local income tax can exist, whatever rate a caller supplies. Article 15, section 18 of the Wyoming Constitution does not change the first half. It is not a prohibition but a condition on imposition: no income tax without a full credit for the sales, use and ad valorem taxes the same taxpayer paid that year. That is a severe practical deterrent and a legal presupposition that an income tax MAY be imposed, so Wyoming, like South Dakota, is one session away from changing.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WY',
    authority: [{
      // The whole chapter, quoted in full. The line after it in the title is
      // "CHAPTER 13 - AD VALOREM TAXATION"; the former income tax chapter is
      // printed as "39-7-101. Repealed By Laws 1998, ch. 5, § 4."
      kind: 'statute',
      citation: 'Wyo. Stat. § 39-12-101',
      url: 'https://www.wyoleg.gov/statutes/compress/title39.pdf',
      quotedText:
        'The state of Wyoming does hereby preempt for itself the field of imposing and levying income taxes, earning taxes, or any other form of tax based on wages or other income and no county, city, town or other political subdivision shall have the right to impose, levy or collect such taxes.',
    }, {
      // Quoted for what it is NOT. "No tax shall be imposed upon income
      // WITHOUT allowing full credit" is a condition, and a reader told only
      // that Wyoming has a constitutional provision about income tax would
      // reasonably assume a bar.
      kind: 'statute',
      citation: 'Wyo. Const. art. 15, § 18',
      url: 'https://sos.wyo.gov/Forms/Publications/WYConstitution.pdf',
      quotedText:
        'No tax shall be imposed upon income without allowing full credit against such tax liability for all sales, use, and ad valorem taxes paid in the taxable year by the same taxpayer to any taxing authority in Wyoming.',
    }],
    volatility: 'staticStatute',
    // The pack year, for South Dakota's reason: no primary source was found
    // establishing when Wyoming last levied an individual income tax or whether
    // it ever did. 39-12-101 states no operative date of its own.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  // ---------------------------------------------------------------------------
  // Arizona — 2026-08-05.
  //
  // Two things about these citations, said once.
  //
  // The URL for the rate is load-bearing and counter-intuitive. Laws 2021
  // chapters 411 and 412 both amended A.R.S. 43-1011 and were never blended, so
  // azleg publishes two versions of the section. `/ars/43/01011.htm` — the URL
  // any reasonable citation would reach for — is the chapter 411 version, whose
  // rate table stops at the 2019-2021 graduated schedule and never prints
  // paragraph 9. The 2.5% flat rate is only on `/ars/43/01011.01.htm`. The
  // `.01` is a versioning artifact in the filename; there is no A.R.S.
  // 43-1011.01.
  //
  // And azleg publishes no session-law history for most of Title 43. Only
  // 43-1011's two versions carry a source note, so the effective years on the
  // records below rest on each statute's own "for taxable years beginning from
  // and after" language where it has one, and otherwise on the year the current
  // text is known to have been operative. Where a record would want a
  // `legislativeHistory` authority there is nothing on the host to point at.
  // ---------------------------------------------------------------------------

  'ars-43-1011-a-9-flat-rate': {
    title: 'Arizona taxes individual income at a flat 2.5%',
    statement:
      'A.R.S. 43-1011(A)(9) imposes a single rate of 2.5% on Arizona taxable income, with no graduated bands and no dependence on filing status. The paragraph is conditioned on the revenue notice of 43-243(B)(2); that notice was given, 43-243(D) directs the department to use paragraph 9 from the following taxable year, and 43-243(E) makes the notice a one-time event, so the rate cannot ratchet back. The department has applied 2.5% since tax year 2023 and the 2025 return still computes tax as 2.5% of line 45. The pack carries a single bracket at 2.5% for both filing statuses.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1011(A)(9)',
      url: 'https://www.azleg.gov/ars/43/01011.01.htm',
      quotedText:
        'Subject to subsection F of this section, for taxable years beginning from and after December 31 of the year in which notice is provided to the department pursuant to section 43-243, subsection B, paragraph 2, the tax is 2.5% of taxable income.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-243(D)',
      url: 'https://www.azleg.gov/ars/43/00243.htm',
      quotedText:
        'On receipt of the notice required pursuant to subsection B, paragraph 2 of this section, the department shall use the tax rates provided in section 43-1011, subsection A, paragraph 9 for taxable years beginning from and after December 31 of the year in which the notice required pursuant to subsection B, paragraph 2 of this section is received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 46',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText: '46 Tax: Multiply line 45 by 2.5% (.025). Enter the result',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ars-43-1041-standard-deduction-published-amount': {
    title: 'Arizona’s standard deduction is its own amount, indexed in the federal manner',
    statement:
      'A.R.S. 43-1041(A) prescribes Arizona’s own standard deductions, and 43-1041(H) directs the department to adjust those amounts for inflation "in the same manner in which" the federal basic standard deduction is adjusted under IRC 63. That is a borrowed method, not an incorporated amount: no provision of Title 43 says the Arizona deduction equals the federal one, and 43-105(A) excludes from Arizona’s conformity any change to the Code enacted after January 1, 2025. The pack therefore carries Arizona’s published figures — $15,750 single and $31,500 joint for 2025, the most recent the department has published — with NO `standardDeductionConformity` tag, which is also what keeps the federal age-65 additional standard deduction off the Arizona base, since Arizona grants no such addition. Arizona was tagged `federal` until 2026-08-05; the published amounts have in fact equalled the federal basic deduction in every year checked, but that is administrative practice rather than Arizona law, and the tag was importing a federal age-65 amount alongside it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1041(A)(1)',
      url: 'https://www.azleg.gov/ars/43/01041.htm',
      quotedText:
        'In the case of a single person or a married person filing separately, the standard deduction is $12,200, subject to subsection H of this section.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1041(H)',
      url: 'https://www.azleg.gov/ars/43/01041.htm',
      quotedText:
        'For each taxable year beginning from and after December 31, 2019, the department shall adjust the dollar amounts prescribed by subsection A, paragraphs 1, 2 and 3 of this section for inflation in the same manner in which the federal basic standard deduction is adjusted for inflation pursuant to section 63 of the internal revenue code.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-105(A)',
      url: 'https://www.azleg.gov/ars/43/00105.htm',
      quotedText:
        'For the purposes of computing income tax pursuant to this title, for taxable years beginning from and after December 31, 2024, "internal revenue code" means the United States internal revenue code of 1986, as amended, in effect on January 1, 2025, including those provisions that became effective during 2024 with the specific adoption of all retroactive effective dates, but excluding any changes to the code enacted after January 1, 2025.',
    }, {
      // The published dollar amounts, from the short form's own deduction line
      // rather than from the booklet's "What's New" bullet list, which reflows
      // through a two-column page and cannot be quoted as printed.
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140A, line 18',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        '18 Standard deduction: If you checked filing status box 4 enter $31,500; box 5 enter $23,625; or box 6 or 7 enter $15,750.',
    }],
    // The amount moves every year under (H) even though the mechanism is
    // statutory, so this falls due with the autumn figures rather than on the
    // annual statutory pass.
    volatility: 'annuallyIndexed',
    effectiveFrom: 2020,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1022-10-social-security-railroad-exclusion': {
    title: 'Arizona subtracts every federally taxable Social Security dollar',
    statement:
      'A.R.S. 43-1022(10) subtracts from Arizona gross income the amount included in federal adjusted gross income under IRC 86 — Social Security benefits under Title II of the Social Security Act and railroad retirement benefits alike — with no income threshold, age condition or cap. The department extends the same line to tier 1 and tier 2 railroad retirement, railroad disability, unemployment and sickness payments. The pack expresses it as `taxesSocialSecurity: false`, so no benefit dollar reaches the 2.5% rate at any income level.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(10)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'The amount included in federal adjusted gross income pursuant to section 86 of the internal revenue code, relating to taxation of social security and railroad retirement benefits.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 30',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you included such social security or railroad retirement benefits as income on your federal return, use line 30 to subtract this income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1022-26-uniformed-services-exclusion': {
    title: 'Arizona excludes uniformed-services retired and retainer pay in full',
    statement:
      'For taxable years beginning after December 31, 2020, A.R.S. 43-1022(26)(c) subtracts from Arizona gross income the full amount of benefits, annuities and pensions received as retired or retainer pay of the uniformed services of the United States — no cap, no age condition, no phase-out — where the same paragraph capped the subtraction at $2,500 through 2018 and $3,500 for 2019 and 2020. The department extends it to each spouse on a joint return and to a surviving spouse receiving payments from the uniformed services. The pack expresses it by listing AZ in `PUBLIC_PENSION_OVERRIDES` as `{ kind: \'full\' }`, which is also what stops the public rule being copied onto private retirement income: Arizona subtracts nothing for a private pension or an IRA, and must keep subtracting nothing.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(26)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'Benefits, annuities and pensions received as retired or retainer pay of the uniformed services of the United States in amounts as follows: (a) For taxable years through December 31, 2018, an amount totaling not more than $2,500. (b) For taxable years beginning from and after December 31, 2018 through December 31, 2020, an amount totaling not more than $3,500. (c) For taxable years beginning from and after December 31, 2020, the full amount received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29b',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you received benefits, annuities and pensions as retired or retainer pay of the uniformed services of the United States, you may subtract 100% of the amount you received.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ars-43-1022-no-private-retirement-exclusion': {
    title: 'Arizona grants no exclusion for a private pension, annuity or IRA distribution',
    statement:
      'The subtractions that turn Arizona gross income into Arizona adjusted gross income are the closed enumeration of A.R.S. 43-1022. Two of its paragraphs reach retirement income — uniformed-services retired pay under (26) and government pensions under (2) — and none of them reaches a private pension, a commercial annuity, or a distribution from a traditional IRA or 401(k), so that income is taxed in full at 2.5%. The pack keeps `retirementPrivate` at `{ kind: \'none\' }`, and the entry for Arizona in `PUBLIC_PENSION_OVERRIDES` leaves `retirementRuleShared` false, so the public bucket’s exclusion cannot spill onto the private one.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      // A negative claim's evidence is the closedness of the enumeration. The
      // opening line makes the list exhaustive; the return's own subtraction
      // line for pensions names only the government ones.
      kind: 'statute',
      citation: 'A.R.S. 43-1022',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'In computing Arizona adjusted gross income, the following amounts shall be subtracted from Arizona gross income:',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 29a',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        '29a Exclusion for federal, Arizona state or local government pensions (up to $2,500 per taxpayer)',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ars-43-1022-2-government-pension-exclusion': {
    title: 'Arizona caps a civil-service pension subtraction at $2,500, and the pack exempts it in full',
    statement:
      'A.R.S. 43-1022(2) subtracts benefits, annuities and pensions "in an amount totaling not more than $2,500" received from the federal civil-service and foreign-service retirement systems and any other retirement system established by federal law other than uniformed-services retired pay, and from the Arizona State Retirement System, the Corrections Officer Retirement Plan, the Public Safety Personnel Retirement System, the Elected Officials\' Retirement Plan, the Arizona Board of Regents and community-college optional programs, and county, city or town plans. Each spouse may claim their own $2,500, and a public pension from another state qualifies for nothing. Not modelled. `retirementPublic` is one flag covering every public pension the input model can carry, and it is set to `full` for the sake of 43-1022(26)’s uniformed-services exclusion, so a federal, Arizona state or Arizona local government pension is exempted outright when Arizona exempts only $2,500 of it. The error runs toward the taxpayer: an Arizona civil-service retiree is shown a state tax lower than they owe, by 2.5% of everything above $2,500.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(2)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'Benefits, annuities and pensions in an amount totaling not more than $2,500 received from one or more of the following: (a) The United States government service retirement and disability fund, the United States foreign service retirement and disability system and any other retirement system or plan established by federal law, except retired or retainer pay of the uniformed services of the United States that qualifies for a subtraction under paragraph 26 of this section.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1022(2)(b)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'The Arizona state retirement system, the corrections officer retirement plan, the public safety personnel retirement system, the elected officials\' retirement plan, an optional retirement program established by the Arizona board of regents under section 15-1628, an optional retirement program established by a community college district board under section 15-1451 or a retirement plan established for employees of a county, city or town in this state.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29a',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you received pension income from any of the sources listed below, subtract the amount you received or $2,500, whichever is less.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29a, out-of-state public pensions',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'NOTE: Public retirement pensions from states other than Arizona do not qualify for this subtraction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ars-43-1022-22-long-term-capital-gain-subtraction': {
    title: 'Arizona subtracts 25% of long-term gain on a post-2011 asset only',
    statement:
      'A.R.S. 43-1022(22) subtracts a share of net long-term capital gain included in federal adjusted gross income, but only gain "derived from an investment in an asset acquired after December 31, 2011", and subdivision (c) sets that share at twenty-five percent for taxable years after 2014 while adding that no subtraction is allowed at all where the acquisition date cannot be verified. The pack carries `capitalGainsTaxablePct: 75`, which is right for an asset bought after 2011 and wrong for one bought before. Not modelled: the engine holds no acquisition date for the position a gain came from, so it applies the seventy-five percent inclusion to every Arizona gain, including one on a long-held pre-2012 holding that Arizona taxes in full. The error runs toward the taxpayer on exactly the households most likely to have one — a retiree realizing a position held for fifteen years — at 2.5% of the quarter Arizona does not exclude.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(22)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'An amount of any net long-term capital gain included in federal adjusted gross income for the taxable year that is derived from an investment in an asset acquired after December 31, 2011, as follows:',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1022(22)(c)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'For taxable years beginning from and after December 31, 2014, twenty-five percent of the net long-term capital gain included in federal adjusted gross income. For the purposes of this paragraph, a transferee that receives an asset by gift or at the death of a transferor is considered to have acquired the asset when the asset was acquired by the transferor. If the date an asset is acquired cannot be verified, a subtraction under this paragraph is not allowed.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 24',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'You may subtract 25% (.25) of any net long-term capital gain included in your federal adjusted gross income that is derived from an investment in an asset acquired after December 31, 2011.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2015,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AZ.capitalGainsTaxablePct',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1023-e-age-65-exemption': {
    title: 'Arizona’s age-65 relief is a flat $2,100 exemption the pack does not model',
    statement:
      'A.R.S. 43-1023(E) allows an exemption of $2,100 to a taxpayer who has attained age 65 before the close of the taxable year, and a second $2,100 for a spouse who has on a joint return. It reaches the return through 43-1022(1), which subtracts the 43-1023 exemptions from Arizona gross income — so it sits above the deduction line, and it is not an addition to the standard deduction. Nothing in 43-1023 indexes it. Not modelled: the pack has one age-65 field, `standardDeductionAge65Addition`, and `conformStateStandardDeduction` attaches it only to a state whose deduction IS the federal one, which Arizona’s is not. So an Arizona household aged 65 or over is charged 2.5% on $2,100 per person that Arizona exempts. Modelling it through the conformity tag was the alternative and is worse: that path attaches the FEDERAL age-65 addition, a different figure under a different statute, indexed every year while Arizona’s $2,100 is frozen, so the gap between the two would widen in every projected year of a plan.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1023(E)',
      url: 'https://www.azleg.gov/ars/43/01023.htm',
      quotedText:
        'A taxpayer is allowed an exemption of $2,100: 1. If the taxpayer has attained sixty-five years of age before the close of the taxable year filing a separate or joint return and the taxpayer is not claimed as a dependent by another taxpayer. 2. For the taxpayer\'s spouse if the spouse has attained sixty-five years of age before the close of the taxable year, a joint return is filed and the spouse is not a dependent of another taxpayer.',
    }, {
      // Where the exemption enters the return, and why it is not a deduction:
      // 43-1022(1) subtracts it from Arizona GROSS income, so it is gone before
      // 43-1001(11) reaches taxable income by taking the article 4 deductions
      // off Arizona adjusted gross income. 43-1001 is not cited alongside it
      // because that page carries under 1,600 characters of text and the quote
      // verifier cannot tell so short a document from a shell page.
      kind: 'statute',
      citation: 'A.R.S. 43-1022(1)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText: 'The amount of exemptions allowed by section 43-1023.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 38',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText: '38 Age 65 or over: Multiply the number in box 8 by $2,100',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // WS4d Batch A — 2026-08-27.
  //
  // These records deliberately cover only the parts of the Batch A packs whose
  // staged primary texts carry operative language. The CA, CO, DC, and GA
  // records below use the refreshed sources; they are not reconstructed from
  // the old matrix. Alabama is registered separately below from the 2025 Form
  // 40 booklet and the DOR individual-income-tax page (verified 2026-08-28).
  // ---------------------------------------------------------------------------

  'ca-rtc-17087-social-security-exclusion': {
    title: 'California does not apply IRC 86 to Social Security or Tier 1 Railroad benefits',
    statement:
      'California says IRC section 86 does not apply, so federally taxable Social Security and Tier 1 Railroad benefits are not part of the California base. The pack\'s `taxesSocialSecurity: false` omits precisely that federal inclusion. This source does not decide California\'s treatment of pension or IRA income, so the separate `{ kind: \'none\' }` data choice is deliberately not claimed by this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CA',
    authority: [{
      kind: 'statute',
      citation: 'Cal. Rev. & Tax. Code 17087(a)',
      url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17087.',
      quotedText:
        'Section 86 of the Internal Revenue Code, relating to Social Security and Tier 1 Railroad Retirement Benefits, shall not apply.',
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
      'packages/engine/src/params/state/data/year2026.ts#CA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'co-crs-39-22-104-federal-base-and-pension-cap': {
    title: 'Colorado starts from federal taxable income but has a $20,000 pension-and-annuity tier at ages 55-64',
    statement:
      'Colorado taxes federal taxable income, modified by section 39-22-104(4). That is why the pack carries the federal standard-deduction figure and conforms it as the federal figure moves. The same subsection, however, permits a $20,000 per-person subtraction for pensions and annuities from age 55 through 64, and expressly includes non-premature IRA distributions. Approximated: the pack has only its $24,000 age-65 cap, so it removes none of a source-covered age-60 IRA or pension distribution. The resulting base is $20,000 too high before the federal deduction, overstating Colorado tax for that limb.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:CO',
    authority: [{
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(1.7)(c), (2)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'Except as otherwise provided in section 39-22-627, subject to subsection (2) of this section, with respect to taxable years commencing on or after January 1, 2022, a tax of four and forty one-hundredths percent is imposed on the federal taxable income, as determined pursuant to section 63 of the internal revenue code, of every individual, estate, and trust. … Prior to the application of the rate of tax prescribed in subsection (1), (1.5), or (1.7) of this section, the federal taxable income shall be modified as provided in subsections (3) and (4) of this section.',
    }, {
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(4)(f)(III)(A), (D)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'Amounts subtracted under this subsection (4)(f) are capped at twenty thousand dollars per tax year for any individual who is fifty-five years of age or older but less than sixty-five years of age at the close of the taxable year. ... "Pensions and annuities" includes distributions from individual retirement arrangements and self-employed retirement accounts to the extent that such distributions are not deemed to be premature distributions for federal income tax purposes, amounts received from fully matured privately purchased annuities, social security benefits, and amounts paid from any such sources by reason of permanent disability or death of the person entitled to receive the benefits.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#CO',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'co-crs-39-22-104-social-security-inclusion': {
    title: 'Colorado fully subtracts federally taxable Social Security at age 65 and older',
    statement:
      'For a taxpayer age 65 or older, Colorado first considers federally taxable Social Security against the ordinary $24,000 pension-and-annuity cap and raises that cap to the full federally taxable benefit if necessary. The source therefore removes all of that federal share before Colorado tax. Approximated: `taxesSocialSecurity: true` leaves the share in the pack base at every age, so it overstates tax for this age-65 source-covered limb. The same statutory mechanism is income-tested for taxpayers 55-64; the engine has no field for that income test, so this record pins the unconditional 65-plus limb only.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:CO',
    authority: [{
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(4)(f)(III)(B)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'For income tax years commencing on or after January 1, 2022, the cap set forth in this subsection (4)(f)(III)(B) is calculated by first considering the total amount of social security benefits a taxpayer received that were included in federal taxable income at the close of the taxable year. If the total amount of such social security benefits exceeds the cap set forth in this subsection (4)(f)(III)(B), then the cap is increased to an amount equal to the total amount of such social security benefits.',
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
      'packages/engine/src/params/state/data/year2026.ts#CO',
      'packages/engine/src/params/state/types.ts#taxesSocialSecurity',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'hi-hrs-235-7-pension-and-social-security': {
    title: 'Hawaii excludes every pension for past services, not only public pensions',
    statement:
      'Hawaii excludes public-retirement-system benefits and any compensation received as a pension for past services from gross, adjusted gross, and taxable income. The public-pension override correctly makes the public bucket full, but the `privateRetirementIncome` bucket combines private pensions with IRAs and other distributions, so the pack gives it `{ kind: \'none\' }`. A private pension is therefore taxed even though the statute excludes it. The output overstates tax for that source-covered limb; treating the entire bucket as exempt would instead overreach to private IRA distributions, which the staged text does not establish. No staged source here states the separate `taxesSocialSecurity: false` behavior, so that limb is intentionally not claimed by this record.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:HI',
    authority: [{
      kind: 'statute',
      citation: 'Haw. Rev. Stat. 235-7(a)(2)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        'Rights, benefits, and other income exempted from taxation by section 88-91, having to do with the state retirement system, and the rights, benefits, and other income, comparable to the rights, benefits, and other income exempted by section 88-91, under any other public retirement system;',
    }, {
      kind: 'statute',
      citation: 'Haw. Rev. Stat. 235-7(a)(3)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText: 'Any compensation received in the form of a pension for past services;',
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
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'id-code-63-3022-federal-standard-and-ss': {
    title: 'Idaho subtracts the federally included Social Security and Railroad amount',
    statement:
      'Idaho deducts every amount that IRC 86 included in gross income for Social Security and Railroad benefits. The state’s `taxesSocialSecurity: false` setting therefore removes the same federally taxable share before Idaho brackets apply. The staged section does not define Idaho taxable income or the standard-deduction reference, so this record deliberately registers only the Social Security behavior despite its planned umbrella id.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ID',
    authority: [{
      kind: 'statute',
      citation: 'Idaho Code 63-3022(l)',
      url: 'https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch30/sect63-3022/',
      quotedText:
        'Deduct any amounts included in gross income under the provisions of section 86 of the Internal Revenue Code relating to certain social security and railroad benefits.',
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
      'packages/engine/src/params/state/data/year2026.ts#ID',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mt-mca-15-30-2120-federal-taxable-income-base': {
    title: 'Montana starts from federal taxable income, so federally taxable Social Security stays in the base',
    statement:
      'Montana taxable income means federal taxable income adjusted as provided in 15-30-2120, and the subtraction list in 15-30-2120(3), quoted below END-TO-END so the negative is checkable rather than an absence-from-excerpt, contains no Social Security item of any kind, so the federally taxable share of benefits stays in the Montana base - `taxesSocialSecurity: true`. Starting from federal TAXABLE income also imports the federal standard deduction directly, which is what `standardDeductionConformity: \'federal\'` encodes and what the 2026 department withholding notice confirms. This record supersedes mt-mca-15-30-2110-federal-agi-social-security: former 15-30-2110 was repealed by Secs. 65 and 70(1) of Ch. 503, L. 2021 (SB 399). The income-tested Social Security subtraction and the $3,600 pension exclusion that the research corpus and the predecessor record\'s 2013-compilation source DESCRIBED lived in that repealed section; whether or not they read exactly as described, the quoted, complete current subtraction list settles the operative claim on its own - so under current law those reliefs are a NO-GRANT, not an unmodeled subtraction, which closes the BLOCKED-SOURCE residual the predecessor record carried. The age-65 subtraction current law DOES grant is registered separately as mt-mca-15-30-2120-3-g-age-65-subtraction.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MT',
    authority: [{
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2101(22) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0010/0150-0300-0210-0010.html',
      quotedText:
        '"Montana taxable income" means federal taxable income as determined for federal income tax purposes and adjusted as provided in 15-30-2120',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(1) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText:
        'The items in subsection (2) are added to and the items in subsection (3) are subtracted from federal taxable income to determine Montana taxable income.',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(3) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      // Online 2025 MCA compilation dropped already-expired (3)(r) (property-tax
      // rebate under 15-1-2307; terminated June 30, 2026 per sec. 29, Ch. 767,
      // L. 2025). Quote now ends at (q); (3)(a)'s still-literal "(3)(r)" cross-
      // reference is preserved as published. Source hygiene only — no new law.
      quotedText:
        '(3) To the extent they are included as income or gain or not already excluded as a deduction or expense in determining federal taxable income, the following are subtracted from federal taxable income: (a) a deduction for an income distribution from an estate or trust to a beneficiary in accordance with sections 651 and 661 of the Internal Revenue Code, 26 U.S.C. 651 and 661, recalculated according to the additions and subtractions in subsections (2) and (3)(b) through (3)(r); (b) if exempt from taxation by Montana under federal law: (i) interest from obligations of the United States government and exempt-interest dividends attributable to that interest; and (ii) railroad retirement benefits; (c) (i) salary received from the armed forces by residents of Montana who are serving on active duty in the regular armed forces and who entered into active duty from Montana; (ii) the salary received by residents of Montana for active duty in the national guard. For the purposes of this subsection (3)(c)(ii), "active duty" means duty performed under an order issued to a national guard member pursuant to: (A) Title 10, U.S.C.; or (B) Title 32, U.S.C., for a homeland defense activity, as defined in 32 U.S.C. 901, or a contingency operation, as defined in 10 U.S.C. 101, and the person was a member of a unit engaged in a homeland defense activity or contingency operation. (iii) the amount received by a beneficiary pursuant to 10-1-1201 ; and (iv) all payments made under the World War I bonus law, the Korean bonus law, and the veterans\' bonus law. Any income tax that has been or may be paid on income received from the World War I bonus law, Korean bonus law, and the veterans\' bonus law is considered an overpayment and must be refunded upon the filing of an amended return and a verified claim for refund on forms prescribed by the department in the same manner as other income tax refund claims are paid. (d) annual contributions and income in a medical care savings account provided for in Title 15, chapter 61, and any withdrawal for payment of eligible medical expenses or for the long-term care of the employee or account holder or a dependent of the employee or account holder; (e) contributions or earnings withdrawn from a family education savings account provided for in Title 15, chapter 62, or from a qualified tuition program established and maintained by another state as provided in section 529(b)(1)(A)(ii) of the Internal Revenue Code, 26 U.S.C. 529(b)(1)(A)(ii), for qualified education expenses, as defined in 15-62-103 , of a designated beneficiary; (f) interest and other income related to contributions that were made prior to January 1, 2024, that are retained in a first-time home buyer savings account provided for in Title 15, chapter 63, and any withdrawal for payment of eligible costs for the first-time purchase of a single-family residence; (g) for each taxpayer that has attained the age of 65, an additional subtraction of $5,500; (h) the amount of a scholarship to an eligible student by a student scholarship organization pursuant to 15-30-3104 ; (i) a payment received by a private landowner for providing public access to public land pursuant to Title 76, chapter 17, part 1; (j) the amount of any refund or credit for overpayment of income taxes imposed by this state or any other taxing jurisdiction to the extent included in gross income for federal income tax purposes but not previously allowed as a deduction for Montana income tax purposes; (k) the recovery during the tax year of any amount deducted in any prior tax year to the extent that the recovered amount did not reduce the taxpayer\'s Montana income tax in the year deducted; (l) the amount of the gain recognized from the sale or exchange of a mobile home park as provided in 15-31-163 ; (m) payments from the Montana end of watch trust as provided in 2-15-2041 ; (n) (i) subject to subsection (9), a portion of military pensions or military retirement income as calculated pursuant to subsection (8) that is received by a retired member of: (A) the armed forces of the United States, as defined in 10 U.S.C. 101; (B) the Montana army national guard or the army national guard of other states; (C) the Montana air national guard or the air national guard of other states; or (D) a reserve component, as defined in 38 U.S.C. 101, of the United States armed forces; and (ii) subject to subsection (9), up to 50% of all income received as survivor benefits for military service provided for in subsections (3)(n)(i)(A) through (3)(n)(i)(D); (o) subject to subsection (10), for each taxpayer that is a qualified volunteer firefighter or volunteer emergency care provider, an additional subtraction of $3,000; (p) income received from the manufacture of ammunition components by an entity, owner, or partner engaged in the primary business of the manufacture of ammunition components as provided in 30-20-207 ; and (q) income attributable to providing a bona fide loan in an arms\'-length transaction to a manufacturer of ammunition components as provided in 30-20-208 .',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2110 (repealed) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0100/0150-0300-0210-0100.html',
      quotedText: 'Repealed. Secs. 65, 70(1), Ch. 503, L. 2021.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Montana Department of Revenue, Updated Montana Wage Withholding Tables and MW-4 Now Available (2026)',
      url: 'https://revenue.mt.gov/news/recent-news/2026-withholding-updates',
      quotedText:
        'Additionally, recent federal legislation changed the standard deductions amounts which affect Montana taxable income. The withholding tax tables were updated to also reflect these changes.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mt-mca-15-30-2120-3-g-age-65-subtraction': {
    title: 'Montana subtracts $5,500 per taxpayer at 65, inflation-adjusted; the pack has no such knob',
    statement:
      'For each taxpayer that has attained the age of 65, 15-30-2120(3)(g) subtracts an additional $5,500 from federal taxable income, and 15-30-2120(7) directs the department to multiply that subtraction by the inflation factor each year (rounded to the nearest $10), so the operative figure grows above the statutory floor. The pack carries `retirement: { kind: \'none\' }`, and while the schema does have one age-keyed relief path - the federal standard-deduction age-65 addition that flows through conformity against `peopleAged65Plus` - it has no state-subtraction knob, so beyond that federal addition the engine taxes the full base. Produced pin: on the fixture household (single, age 65, $90,000 ordinary income, $16,100 federal-conformed deduction) the engine leaves Montana taxable income at $73,900 where the statute reads at most $68,400 - overstating tax by the top-bracket rate on the subtraction, about $311 at 5.65% on the $5,500 floor alone, and by more once the (7) inflation factor lifts it. A married couple who have both attained 65 doubles the gap.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The record pins the $5,500 statutory floor rather than the department\'s inflation-adjusted figure for the tax year: the floor is in the quoted statute, while the adjusted amount is published administratively under 15-30-2120(7) and no primary source for the 2026 figure is staged. The floor understates the size of the overstatement, never the direction.',
    jurisdiction: 'state:MT',
    authority: [{
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(3)(g) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText: 'for each taxpayer that has attained the age of 65, an additional subtraction of $5,500;',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(7)(a) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText:
        'By November 1 of each year, the department shall multiply the subtractions from federal taxable income in subsections (3)(g) and (3)(o) by the inflation factor for that tax year for a taxpayer that either: (i) has attained the age of 65; or (ii) is a qualified volunteer firefighter or volunteer emergency care provider.',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(7)(b) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText: 'The department shall round the results in subsection (7)(a) to the nearest $10.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // Batch C state records — verified against the staged sources on 2026-08-27.
  'nm-stat-7-2-5-14-social-security-and-federal-standard': {
    title: 'New Mexico applies an income-tested Social Security exemption',
    statement:
      'New Mexico does not exempt every dollar of Social Security. The Taxation and Revenue Department describes the exemption as beginning in 2022 but limits it by filing status and income: a single filer must be below $100,000, a joint filer, surviving spouse, or head of household below $150,000, and a married-separate filer below $75,000. The pack\'s `taxesSocialSecurity: false` is therefore a conservative boolean for low-income retirees but understates a high-income retiree\'s New Mexico tax. This record registers that source-backed Social Security limb. The federal-standard-deduction component remains covered by the federal conformity record `irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`; the staged New Mexico statutes index did not expose operative NMSA §7-2-5.14 text, so no separate New Mexico deduction reading is asserted here.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:NM',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New Mexico Taxation and Revenue Department, Social Security Income Tax Exemption',
      url: 'https://www.tax.newmexico.gov/social-security-income-tax-exemption/',
      quotedText:
        'Beginning with tax year 2022, most seniors will be exempt from paying taxes on their Social Security benefits when they file their New Mexico Personal Income Tax returns. Tax relief from the new Social Security exemption is expected to total $84.1 million in the first year. The exemption is available to single taxpayers with less than $100,000 in income, to married couples filing jointly, surviving spouses and heads of household with under $150,000 in income, and to married couples filing separately with under $75,000 in income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NM',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'or-stat-316-054-social-security-exclusion': {
    title: 'Oregon subtracts federally taxable Social Security from federal taxable income',
    statement:
      'Oregon starts its resident income-tax base with federal taxable income and then subtracts every Social Security benefit included in federal gross income under Internal Revenue Code section 86. The pack\'s `taxesSocialSecurity: false` expresses that full subtraction; Oregon has no separate retirement exclusion in this record, so private and public retirement distributions remain in the ordinary base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:OR',
    authority: [{
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.054',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText:
        '316.054 Social Security benefits to be subtracted from federal taxable income. In addition to the other modifications to federal taxable income contained in this chapter, there shall be subtracted from federal taxable income the amount of any Social Security benefits, as defined in section 86 of the Internal Revenue Code (Title II Social Security or tier 1 railroad retirement benefits) included in gross income for federal income tax purposes under section 86 of the Internal Revenue Code.',
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
      'packages/engine/src/params/state/data/year2026.ts#OR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ut-code-59-10-114-social-security-tax-credit': {
    title: 'Utah taxes Social Security but offers a separate Social Security benefits credit',
    statement:
      'Utah publishes a single 4.5% individual income-tax rate. Its Tax Commission TC-40A instructions provide a Social Security Benefits Credit for taxable Social Security included in adjusted gross income: the worksheet multiplies that benefit by 4.5%, then reduces the result by 2.5% of the worksheet\'s income-over-threshold amount above $54,000 for a single filer, $90,000 for a joint filer or qualifying widow(er), and the corresponding $45,000 married-separate threshold. The pack includes the federally taxable Social Security share but models no credit, so it overstates tax on a qualifying return; Utah\'s separate retirement and military credits are also outside this state-tax base model.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Utah State Tax Commission, 2025 TC-40A Supplemental Schedule Instructions, Social Security Benefits Credit (UCA §59-10-1042)',
      url: 'https://incometax.utah.gov/tc-40a/',
      quotedText:
        '(AH) Social Security Benefits Credit (UCA §59-10-1042) You may qualify for this credit if you (or your spouse, if filing jointly) received taxable Social Security retirement, disability or survivor benefits. Complete the Social Security Credit Worksheet, below, to calculate this credit. You may only claim this credit for Social Security benefits included in adjusted gross income on this return. You may not claim this credit if you (or your spouse, if filing jointly) claim the Retirement Credit (code 18). Social Security Credit Worksheet Calculation Steps Amount For yourself (and/or your spouse), enter the amount from federal form 1040 or 1040-SR, line 6b; or 1040-NR, Schedule NEC, line 8 1 _________ Did you report Native American Income (code 77) or Railroad Retirement Income (code 78) as a subtraction from income on TC-40, Schedule A, Part 2? If yes, enter any Social Security benefit included in those amounts. If no, enter “0” 2 _________ Line 1 minus line 2 3 _________ Multiply line 3 by 0.045 4 _________ Enter the amount from TC-40, line 9 (Utah taxable income/loss) 5 _________ Enter municipal bond interest from TC-40, Schedule A, Part 1, code 57 6 _________ Line 5 minus line 6 7 _________ Enter tax exempt interest from federal form 1040, 1040-SR or 1040-NR, line 2a 8 _________ Add lines 7 and 8 9 _________ Enter: a. Married filing separately: $45,000 b. Married filing federal return 1040-NR: $45,000 c. Married filing joint: $90,000 d. Single: $54,000 e. Qualifying surviving spouse or head of household: $90,000 10 _________ Line 9 minus line 10 (not less than zero) 11 _________ Multiply line 11 by 0.025 12 _________ Social Security Benefits Credit: Line 4 minus line 12 (not less than zero) 13 _________ If claiming this credit, enter the total amount on TC-40A, Part 3, using code AH. Note: You may not carry forward or back any credit that is more than your tax liability.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Utah State Tax Commission, Tax Rates (2025)',
      url: 'https://incometax.utah.gov/file-pay/tax-rates/',
      quotedText:
        'Multiply line 9 by 4.5 percent (.045). If the result is zero or less, enter “0.” Utah has a single tax rate for all income levels, as follows: Date Range Tax Rate January 1, 2025 – current 4.5% or .045',
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
      'packages/engine/src/params/state/data/year2026.ts#UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wa-dor-no-broad-individual-income-tax': {
    title: 'Washington has no broad individual income-tax figure in this pack',
    statement:
      'Washington\'s staged Department of Revenue page describes a capital-gains excise that applies only to individuals and only on sales or exchanges of long-term capital assets under RCW 82.87, not a broad tax on wages, pensions, IRA distributions, or Social Security. The pack therefore keeps `hasIncomeTax: false`, so the ordinary-income state-tax path returns zero and `capitalGainsAsOrdinary: true` is inert on that path. The separate capital-gains excise levy itself is registered at `wa-rcw-82-87-capital-gains-excise` and is not settled by this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Washington Department of Revenue, Capital gains tax',
      url: 'https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax',
      quotedText:
        'The 2021 Washington State Legislature passed ESSB 5096 ( RCW 82.87 ) which created a 7% tax on the sale or exchange of long-term capital assets such as stocks, bonds, business interests, or other investments and tangible assets. This tax only applies to individuals.',
    }, {
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.040(1)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.040',
      quotedText:
        '(1)(a) Beginning January 1, 2022, an excise tax is imposed on the sale or exchange of long-term capital assets. Only individuals are subject to payment of the tax, which equals seven percent multiplied by an individual\'s Washington capital gains. (b) Beginning January 1, 2025, an additional excise tax is imposed on the sale or exchange of long-term capital assets, which equals 2.90 percent multiplied by the portion of an individual\'s Washington capital gains exceeding $1,000,000.',
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
      'packages/engine/src/params/state/data/year2026.ts#WA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wa-rcw-82-87-capital-gains-excise': {
    title: 'Washington’s long-term capital-gains excise is absent from the state-tax surface',
    statement:
      'RCW 82.87.040 imposes a separate excise on an individual’s Washington capital gains from sales or exchanges of long-term capital assets, with a further tier above $1,000,000, and RCW 82.87.050 excepts retirement-savings vehicles. Typed absence: `model/plan.ts` and `params/types.ts` do not carry the holding-period, Washington allocation, adjusted-capital-gain, exemption, deduction, or $1,000,000 tier facts needed to price that levy, and `tax/stateTax.ts` has no refusal naming the missing excise — with `hasIncomeTax: false` a capital-gain input emits zero state tax and continues, so the ordinary path never surfaces the levy.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'the holding period that makes a capital asset long-term',
      'the Washington allocation of the gain',
      'adjusted capital gain after the statutory exemptions and deductions',
      'the 1,000,000-dollar tier boundary in the ParameterPack',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WA',
    authority: [{
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.040(1)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.040',
      quotedText:
        '(1)(a) Beginning January 1, 2022, an excise tax is imposed on the sale or exchange of long-term capital assets. Only individuals are subject to payment of the tax, which equals seven percent multiplied by an individual\'s Washington capital gains. (b) Beginning January 1, 2025, an additional excise tax is imposed on the sale or exchange of long-term capital assets, which equals 2.90 percent multiplied by the portion of an individual\'s Washington capital gains exceeding $1,000,000.',
    }, {
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.050(3)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.050',
      quotedText:
        '(3) Assets held under a retirement savings account under Title 26 U.S.C. Sec. 401(k) of the internal revenue code, a tax-sheltered annuity or custodial account described in Title 26 U.S.C. Sec. 403(b) of the internal revenue code, a deferred compensation plan under Title 26 U.S.C. Sec. 457(b) of the internal revenue code, an individual retirement account or individual retirement annuity described in Title 26 U.S.C. Sec. 408 of the internal revenue code, a Roth individual retirement account described in Title 26 U.S.C. Sec. 408A of the internal revenue code, an employee defined contribution program, an employee defined benefit plan, or a similar retirement savings vehicle, whether foreign or domestic, that penalizes withdrawals until the legal or beneficial owner reaches a certain age;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Washington Department of Revenue, Capital gains tax',
      url: 'https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax',
      quotedText:
        'The 2021 Washington State Legislature passed ESSB 5096 ( RCW 82.87 ) which created a 7% tax on the sale or exchange of long-term capital assets such as stocks, bonds, business interests, or other investments and tangible assets. This tax only applies to individuals.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
      'packages/engine/src/params/state/data/year2026.ts#WA',
      'packages/engine/src/params/types.ts#ParameterPack',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
