/**
 * Provenance for the parameter-pack defaults: the source and key figures behind
 * every tax/limit/benefit number the engine applies. Surfaced in the UI so a
 * user can see where the assumptions come from and verify any that matter.
 *
 * This is a human-maintained summary that travels with the data pack — refresh
 * it in the same annual data-only PR that bumps `data/year<YYYY>.ts`. The
 * concise `figures` strings should track the current pack's values.
 *
 * Full per-figure detail and additional citations: DOCS/domain/domain-rules-reference.md.
 */

export interface ParameterSource {
  /** Stable id (kebab-case), unique within the list. */
  id: string
  /** Short group name shown in the first column, sentence case. */
  label: string
  /** One-line summary of the key figures this group contributes. */
  figures: string
  /** Publisher / primary authority the figures are drawn from. */
  publisher: string
  /** Link to a citable source for the figures. */
  url: string
}

/**
 * The RMD and QCD group, exported on its own because the QCD post-pass
 * (actions/annualQcdTaxCharacterPostPass.ts) cites it as evidence: reading it
 * here, rather than filtering PARAMETER_PROVENANCE by id, lets a bundle that
 * needs only this entry leave the rest of the catalog out (the planner worker
 * does). It is the same object PARAMETER_PROVENANCE lists, in its place below.
 */
export const RMD_QCD_PARAMETER_SOURCE: ParameterSource = {
  id: 'rmd-qcd',
  label: 'Required minimum distributions & QCD',
  figures:
    'IRS Uniform Lifetime Table (Pub 590-B, 2022+); RMDs begin at age 73–75 per SECURE 2.0; QCD exclusion limit $111,000.',
  publisher: 'IRS Publication 590-B',
  url: 'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
}

/**
 * One entry per logical assumption group. Order is roughly the order figures
 * appear in a projection (income tax → gains → SS → limits → RMDs → Medicare →
 * SS benefits → ACA → state).
 */
export const PARAMETER_PROVENANCE: ParameterSource[] = [
  {
    id: 'federal-brackets',
    label: 'Federal income tax brackets & standard deduction',
    figures:
      'Seven brackets, 10%–37%. Standard deduction $16,100 single / $32,200 joint; +$2,050 / $1,650 each at 65+.',
    publisher: 'IRS / Tax Foundation',
    url: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/',
  },
  {
    id: 'senior-deduction',
    label: 'Senior bonus deduction (OBBBA)',
    figures:
      '$6,000 per person 65+, phasing out above $75,000 / $150,000 MAGI; temporary, expires after 2028.',
    publisher: 'Bipartisan Policy Center / IRS',
    url: 'https://bipartisanpolicy.org/explainer/2026-federal-income-tax-brackets-and-interactive-calculator/',
  },
  {
    id: 'capital-gains-niit',
    label: 'Long-term capital gains & NIIT',
    figures:
      '0 / 15 / 20% gains (15% above $49,450 / $98,900; 20% above $545,500 / $613,700). 3.8% NIIT above $200,000 / $250,000 MAGI.',
    publisher: 'Kiplinger / IRS',
    url: 'https://www.kiplinger.com/taxes/irs-updates-capital-gains-tax-thresholds',
  },
  {
    id: 'section-121-exclusion',
    label: 'Home-sale gain exclusion (§121)',
    figures:
      '$250,000 single / $500,000 joint of primary-residence gain excluded on sale (statutory since 1997, never indexed); depreciation after May 6, 1997 is not excludable.',
    publisher: 'IRS Topic 701 / Publication 523',
    url: 'https://www.irs.gov/taxtopics/tc701',
  },
  {
    id: 'ss-benefit-taxation',
    label: 'Social Security benefit taxation',
    figures:
      'Provisional-income thresholds: up to 50% taxable above $25,000 / $32,000, up to 85% above $34,000 / $44,000 (fixed by statute, never indexed).',
    publisher: 'IRS Publication 915',
    url: 'https://www.irs.gov/forms-pubs/about-publication-915',
  },
  {
    id: 'contribution-limits',
    label: 'Contribution limits',
    figures:
      '401(k) $24,500 (+$8,000 at 50+, $11,250 ages 60–63); IRA $7,500 (+$1,100); HSA $4,400 self / $8,750 family (+$1,000 at 55+).',
    publisher: 'IRS',
    url: 'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500',
  },
  // The HSA limits are published each May for the next year, ahead of the
  // other figures, so the 2027 ones have their own row and link.
  {
    id: 'hsa-2027',
    label: 'HSA contribution limits, 2027',
    figures:
      '$4,500 self-only / $9,000 family for 2027 (Rev. Proc. 2026-24, section 3.01(1)), used as published; later years grow from 2027 at the plan\'s inflation until the IRS publishes them. The $1,000 catch-up at 55+ is set by statute and not indexed.',
    publisher: 'IRS',
    url: 'https://www.irs.gov/pub/irs-drop/rp-26-24.pdf',
  },
  RMD_QCD_PARAMETER_SOURCE,
  {
    id: 'annuity-purchase',
    label: 'Annuity purchase (exclusion ratio & QLAC)',
    figures:
      'Non-qualified exclusion ratio from IRS Pub 939 Table V expected-return multiples (life expectancy by age); QLAC premium cap $210,000 excluded from RMD balances (SECURE 2.0).',
    publisher: 'IRS Publication 939 / SECURE 2.0 Act §202',
    url: 'https://www.irs.gov/forms-pubs/about-publication-939',
  },
  {
    id: 'hecm-plf',
    label: 'HECM reverse-mortgage principal limit',
    figures:
      'Principal-limit factors at a 5.875% expected rate: 35.1% of home value at 62 rising to 61.4% at 90 (planning default; a lender quote always wins); line/loan growth default 7.5%/yr (rate + 0.5% MIP). HUD-validated mode uses the applicable case-year maximum claim amount and mortgage-insurance rates, a verified principal-limit factor, closing facts, and dated outstanding balances for monthly mortgage-insurance assessments.',
    publisher: 'HUD HECM PLF tables (as summarized for 2026)',
    url: 'https://reverse.mortgage/age-requirements',
  },
  {
    id: 'medicare-irmaa',
    label: 'Medicare Part B & IRMAA',
    figures:
      'Standard Part B $202.90/mo; five IRMAA tiers starting at $109,000 / $218,000 MAGI; Part B IRMAA totals $284.10-$689.90/mo as CMS publishes them; Part D IRMAA surcharges $14.50-$91.00/mo.',
    publisher: 'CMS',
    url: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
  },
  {
    id: 'social-security',
    label: 'Social Security COLA & wage base',
    figures:
      '2.8% COLA; taxable wage base $184,500; earnings-test exempt amounts $24,480 (pre-FRA) / $65,160 (FRA year); SSDI SGA $1,690/mo (non-blind).',
    publisher: 'SSA',
    url: 'https://www.ssa.gov/news/en/cola/factsheets/2026.html',
  },
  {
    id: 'social-security-tax-rates',
    label: 'Social Security tax rates by year',
    figures:
      'OASDI payroll tax 6.2% (employee) and 12.4% (self-employed) in 2026, and each year\'s effective rate from 1937, used for what you paid in.',
    publisher: 'SSA Office of the Chief Actuary',
    url: 'https://www.ssa.gov/oact/progdata/oasdiRates.html',
  },
  {
    id: 'social-security-credits',
    label: 'Social Security credits (quarters of coverage)',
    figures: 'One credit per $1,890 of covered earnings in 2026, at most four a year; each year\'s amount from 1978.',
    publisher: 'SSA Office of the Chief Actuary',
    url: 'https://www.ssa.gov/oact/cola/QC.html',
  },
  {
    id: 'cpi-u',
    label: 'Consumer prices (CPI-U annual averages)',
    figures:
      'CPI-U annual averages 1937–2025 (321.943 in 2025), used to restate Social Security taxes paid in today\'s dollars.',
    publisher: 'BLS',
    url: 'https://data.bls.gov/timeseries/CUUR0000SA0',
  },
  {
    id: 'ssa-life-table',
    label: 'SSA period life table',
    figures:
      'Table 4C6, the 2023 period table (2026 Trustees Report): the death probability and life expectancy by sex at each age 0–119, as published; the last row is closed at 119. Used for survival-percentile planning ages and spending horizons, Monte Carlo lifespans, Social Security expected values and joint-and-survivor annuity exclusion ratios.',
    publisher: 'SSA Office of the Chief Actuary',
    url: 'https://www.ssa.gov/oact/STATS/table4c6.html',
  },
  // The edition before it, which a planning age stored before 2026-09-27 was
  // computed on, so the Assumptions card cites the table a figure came from.
  {
    id: 'ssa-life-table-2022',
    label: 'SSA period life table, earlier edition',
    figures:
      'Table 4C6, the 2022 period table (2025 Trustees Report), which the planner used until September 2026. A survival-percentile or questionnaire planning age made before then was computed on it and is cited here; the planner now uses the 2023 table.',
    publisher: 'SSA Office of the Chief Actuary',
    url: 'https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html',
  },
  {
    id: 'federal-poverty-line',
    label: 'Federal poverty guideline (ACA)',
    figures:
      '2025 HHS guideline ($15,650 first person, +$5,500 each additional) applied to the 2026 ACA coverage year; 2026 HHS guideline ($15,960 first person, +$5,680 each additional) applied to the 2027 ACA coverage year. Each coverage year uses the guidelines in effect when its open enrollment began, as published.',
    publisher: 'HHS',
    url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
  },
  // One entry per ACA coverage year, so each schedule links to the revenue
  // procedure that publishes it. The 2026 entry keeps the id 'aca-ptc' that
  // field links already use.
  {
    id: 'aca-ptc',
    label: 'ACA premium tax credit, 2026 coverage',
    figures:
      'Applicable-percentage schedule for 2026 coverage (Rev. Proc. 2025-25: 2.10% under 133% FPL up to 9.96% at 300–400%), with the 400% FPL subsidy cliff restored (enhanced credits expired 12/31/2025).',
    publisher: 'IRS',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf',
  },
  {
    id: 'aca-ptc-2027',
    label: 'ACA premium tax credit, 2027 coverage',
    figures:
      'Applicable-percentage schedule for 2027 coverage (Rev. Proc. 2026-26: 2.15% under 133% FPL up to 10.22% at 300–400%), under the same 400% FPL cliff. Later coverage years are not priced until their figures are published.',
    publisher: 'IRS',
    url: 'https://www.irs.gov/pub/irs-drop/rp-26-26.pdf',
  },
  {
    id: 'real-yield-curve',
    label: 'TIPS real-yield curve (income floor & bridge)',
    figures:
      'Par real yields as of 2026-06-30: 1.93% (5y), 2.06% (7y), 2.20% (10y), 2.54% (20y), 2.73% (30y), as published. Prices TIPS-ladder quotes and the funded-ratio discounting; refreshed annually with the parameter sets.',
    publisher: 'U.S. Treasury',
    url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',
  },
  {
    id: 'state-income-tax',
    label: 'State income tax',
    figures:
      'Brackets, standard deduction, Social Security treatment, and major retirement-income exclusions for all 50 states + DC, from each state revenue department. California 2026: Form 540-ES estimated-tax worksheet $5,706/$11,412 standard deduction with retained 2025 Schedule X/Y bracket arrays; FTB directs the tax table through $100,000 while the engine uses continuous schedules at lower incomes (not FTB table oracle). Minnesota TY2026: $15,300/$30,600 standard deduction and DOR whole-dollar bands at 5.35%/6.80%/7.85%/9.85% represented by continuous breakpoints; §290.0132 subd. 26 simplified-subtraction thresholds are annually indexed but alternate maxima are not indexed — the pack still taxes federally taxable Social Security with zero subtraction. Delaware 2026: $3,250/$6,500 basic standard deduction plus $2,500 per age-65 person (30 Del. C. § 1108; 2026 PIT-EST), corrected from erroneous unenacted HB 89 figures; §1102(a)(14) 5.55% on $25,000–$60,000. Hawaii 2026: $8,000/$16,000 standard deduction under §235-2.4(a)(2)(F) for tax years beginning after 2025 through 2027; the later steps are in their own row. Louisiana 2026: La. R.S. 47:294 CPI-indexed standard deduction $12,875/$25,750 per LDR 2026 IT-540ESi (`la-ldr-it540es-2026-standard-deduction`); retirement cap CPI indexing remains unindexed. Oregon 2026: LRO Report #1-26 $2,910/$5,820 standard deduction and indexed breakpoints single $4,550/$11,400/$125,000 and joint $9,100/$22,800/$250,000 (`or-lro-2026-rate-schedule-and-standard-deduction`); continuous marginal rates do not replicate LRO printed whole-dollar base taxes; HOH/credits/unmodeled inputs unsupported. Rhode Island 2026: ADV 2025-22 $11,200/$22,400 standard deduction and uniform schedule at $82,050/$186,450 (3.75%/4.75%/5.99%). Utah 2026: 4.45% flat rate under enrolled S.B. 60 / §59-10-104; §59-10-1042 Social Security credit remains unmodeled. Maine 2026: basic $15,700/$31,400 plus federal age-65 addition; §5124-C(2) phase-out starts $102,250/$204,550 over $75,000/$150,000 ranges; MRS July 2026 Form 1040ES-ME (https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf) $49,824 pension-income maximum per person (`me-mrs-36-5122-2-m2-m3-2026-pension-deduction`) without SS/RRB offset, military separation, M-3 phaseout, or plan qualification. West Virginia 2026: §11-21-4j(a) 2.11%–4.58% at $0/$10k/$25k/$40k/$60k (single and MFJ share the table). Michigan 2026: ordinary qualifying combined public/private retirement ceiling $67,610 single/MFS / $135,220 MFJ (Guide 446 / RAB 2026-1); qualification, elections, pre-1946 public benefits and return-level allocation remain approximated. California, Louisiana, Minnesota, Ohio, and Oregon calendar-year records expire after 2026; later plan years may reuse the latest 2026 pack as a planning stand-in. Corrected for 2026 after the survey of every state (2026-09-28): Arkansas’s 3.7% top rate (2026 First Extraordinary Session); Maryland’s indexed $3,400/$6,850 deduction, 2% tax on capital gain above $350,000 of federal AGI and public-safety pension subtraction; Virginia’s personal exemptions; Rhode Island’s $50,000 pension modification and its Social Security modification; California’s military retirement exclusions; and the federal senior deduction in Arizona, Colorado and Idaho through 2028. Figures already enacted for 2027 and later are listed in their own rows; that list is what has been verified against the statutes, and the survey of all 51 jurisdictions, recorded state by state at the linked source index, covers the rest. Washington’s income tax from 2028 and the end of California’s top bands from 2031 are applied with votes pending on November 3, 2026 (Initiative 645, Proposition 3), and the District of Columbia’s own standard deduction for 2026 to 2029, in force by emergency act, is applied with the permanent act under congressional review to about November 20, 2026, in its own row. Changes that turn on a determination are not applied until it is made: Georgia and South Carolina 2027 rates await determinations due December 1, 2026 and February 15, 2027, so both use their 2026 rates; likewise Colorado’s TABOR cut (October 1, 2026), Minnesota (December 15, 2026), Oklahoma (December 2026 and February 2027), Michigan (January 2027), and Kansas, Missouri and West Virginia (not yet published). The plan models single and married filing jointly.',
    publisher: 'State revenue departments / state legislatures (per-state source index)',
    url: 'https://github.com/RetireGolden/RetireGolden/tree/main/DOCS/domain/state-tax-research',
  },
  // Figures a state has already enacted for 2027 and later, one row per state
  // so each links the statute or session law that sets them.
  {
    id: 'state-enacted-in',
    label: 'Indiana income tax rate from 2027',
    figures:
      '2.9% flat for 2027 through 2029 (IC 6-3-2-1(b)(8)), then carried forward: each later cut of 0.05 point applies only on a budget agency determination and is not applied until one is made.',
    publisher: 'Indiana General Assembly (Indiana Code)',
    url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
  },
  {
    id: 'state-enacted-ms',
    label: 'Mississippi income tax rates from 2027',
    figures:
      'No tax on the first $10,000; above it 3.75% for 2027, 3.5% for 2028, 3.25% for 2029 and 3% from 2030 (Miss. Code Ann. 27-7-5(1)(b)(ii), 2025 H.B. 1). The further cuts from 2031, which depend on the reserve fund and a revenue test (H.B. 1, section 2), are not applied.',
    publisher: 'Mississippi Legislature (2025 H.B. 1)',
    url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
  },
  {
    id: 'state-enacted-mt',
    label: 'Montana income tax brackets from 2027',
    figures:
      '4.7% up to $65,000 single or married filing separately, $97,500 head of household and $130,000 joint, then 5.4%; long-term capital gains 3% / 4.1% at the same breaks (MCA 15-30-2103, effective January 1, 2027). The breaks are indexed from 2028; the 2027 breaks are used until the department publishes them.',
    publisher: 'Montana Legislature (Montana Code Annotated)',
    url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0030/0150-0300-0210-0030.html',
  },
  {
    id: 'state-enacted-ne',
    label: 'Nebraska income tax rates from 2027',
    figures:
      '2.46%, 3.51% and 3.99% (rates three and four) from 2027 (Neb. Rev. Stat. 77-2715.03(2)); the 2026 bracket amounts are used until the Tax Commissioner publishes the indexed 2027 schedule.',
    publisher: 'Nebraska Legislature (Nebraska Revised Statutes)',
    url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2715.03',
  },
  {
    id: 'state-enacted-nc',
    label: 'North Carolina income tax rates from 2027',
    figures:
      '3.49% for 2027 through 2029, 3.24% for 2030 through 2032 and 2.99% after 2032 (Session Law 2026-41, section 44.1(a), rewriting G.S. 105-153.7(a)). The further cuts from 2035, which depend on General Fund revenue, are not applied.',
    publisher: 'North Carolina General Assembly (Session Law 2026-41)',
    url: 'https://www.ncleg.gov/EnactedLegislation/SessionLaws/HTML/2025-2026/SL2026-41.html',
  },
  {
    id: 'state-enacted-hi',
    label: 'Hawaii income tax from 2027',
    figures:
      'The Act 24 tables from 2027 (Act 24, SLH 2026, amending HRS 235-51): 2.5% and 5% in the second and third bands and 13% above $500,000 single, $1,000,000 joint and $750,000 head of household, with wider low bands again from 2029. Standard deduction $9,000 / $18,000 from 2028, $10,000 / $20,000 from 2030 and $12,000 / $24,000 from 2031 (HRS 235-2.4(a)(2)(G)-(I)).',
    publisher: 'Hawaii State Legislature (Act 24, SLH 2026)',
    url: 'https://data.capitol.hawaii.gov/sessions/session2026/bills/SB3125_CD2_.HTM',
  },
  {
    id: 'state-enacted-ny',
    label: 'New York income tax rates from 2027',
    figures:
      'The five lowest rates 3.8%, 4.3%, 5.05%, 5.3% and 5.8% for 2027 through 2032, and 8.82% above $2,155,350 joint and $1,077,550 single from 2033 (Tax Law 601(a) and (c), paragraphs (viii) and (ix)).',
    publisher: 'New York State Senate (Consolidated Laws, Tax Law)',
    url: 'https://www.nysenate.gov/legislation/laws/TAX/601',
  },
  {
    id: 'state-enacted-ri',
    label: 'Rhode Island income tax from 2027',
    figures:
      'A surtax of 1% for 2027, 2% for 2028 and 3% from 2029 on Rhode Island taxable income over $1,000,000, held at $1,000,000 until the indexed threshold is published (44-30-2.6(c)(3)(A)(I)(2)), and the Social Security modification without its age test from 2027 (44-30-12(c)(8)(ii)), both added by 2026 H 7127 Sub A, Article 6.',
    publisher: 'Rhode Island General Assembly (2026 H 7127 Sub A)',
    url: 'https://webserver.rilegislature.gov/BillText/BillText26/HouseText26/H7127Aaa.pdf',
  },
  {
    id: 'state-enacted-va',
    label: 'Virginia standard deduction from 2027',
    figures:
      'Standard deduction $9,200 / $18,400 for 2027, $9,300 / $18,600 for 2028 and 2029, and $3,000 / $6,000 from 2030 (Va. Code 58.1-322.03(1)(b)); personal exemptions of $930, plus $800 at 65, from 2026 (58.1-322.03(2)).',
    publisher: 'Virginia General Assembly (Code of Virginia)',
    url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
  },
  {
    id: 'state-enacted-ga',
    label: 'Georgia retirement exclusion from 2027',
    figures:
      'Retirement income exclusion $70,000 at 65 or older from 2027 (O.C.G.A. 48-7-27(a)(5)(A)(xiv), HB 463). HB 463’s rate cut and deduction steps wait on the December 1 determination and are not applied.',
    publisher: 'Office of the Governor of Georgia (HB 463, 2026 signed legislation)',
    url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download',
  },
  {
    id: 'state-enacted-de',
    label: 'Delaware military pension subtraction from 2027',
    figures:
      'Military pension subtraction $15,000 for 2027, $20,000 for 2028 and $25,000 from 2029, under 60 and as a greater-of limb at 60 and over (30 Del. C. 1106(b)(3), S.B. 219).',
    publisher: 'Delaware General Assembly (Delaware Code)',
    url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
  },
  {
    id: 'state-enacted-il',
    label: 'Illinois exemption from 2029',
    figures:
      'Basic exemption $1,000 from 2029, when the indexed amount of 35 ILCS 5/204(b)(7) ends; 2027 and 2028 stay at the 2026 amount until published.',
    publisher: 'Illinois General Assembly (Illinois Compiled Statutes)',
    url: 'https://www.ilga.gov/documents/legislation/ilcs/documents/003500050K204.htm',
  },
  {
    id: 'state-enacted-me',
    label: 'Maine standard deduction from 2027',
    figures:
      'Standard deduction equal to the federal standard deduction from 2027, subject to Maine’s phase-out (36 M.R.S. 5124-C(1-D), P.L. 2025, c. 650).',
    publisher: 'Maine Legislature (P.L. 2025, c. 650)',
    url: 'https://legislature.maine.gov/legis/bills/getPDF.asp?paper=HP1491&item=37&snum=132',
  },
  {
    id: 'state-enacted-md',
    label: 'Maryland public-safety retirement subtraction',
    figures:
      'Public-safety retirement subtraction at 55 or older of $16,000 for 2026, $17,000 for 2027, $18,000 for 2028, $19,000 for 2029 and $20,000 from 2030 (Tax-General 10-207(mm), 2026 Md. Laws ch. 686), for a pension the plan marks as public-safety service.',
    publisher: 'Maryland General Assembly (2026 Md. Laws ch. 686)',
    url: 'https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_686_sb0607T.pdf',
  },
  {
    id: 'state-enacted-or',
    label: 'Oregon retirement income credit ends from 2032',
    figures:
      'The ORS 316.157 retirement income credit cannot be claimed for tax years from 2032 (Oregon Laws 2009, chapter 913, section 36, as amended in 2025).',
    publisher: 'Oregon Legislature (Oregon Revised Statutes)',
    url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
  },
  {
    id: 'state-enacted-ca',
    label: 'California top bands end from 2031',
    figures:
      'The 10.3%, 11.3% and 12.3% bands end from 2031 (Cal. Const. art. XIII, sec. 36(f)(2)); Proposition 3 on the November 3, 2026 ballot would make them permanent, and this is revisited when it is decided. The military retirement and Survivor Benefit Plan exclusions of $20,000 each end from 2030 (RTC 17132.9, 17132.10).',
    publisher: 'California Legislature (California Constitution)',
    url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CONS&sectionNum=SEC.%2036.&article=XIII',
  },
  {
    id: 'state-enacted-wa',
    label: 'Washington income tax from 2028',
    figures:
      '9.9% of federal AGI less long-term capital gains less a $1,000,000 deduction per individual or couple, from 2028 (ESSB 6346, chapter 238, Laws of 2026), the deduction indexed every second year from 2029 (section 316). Initiative 645 on the November 3, 2026 ballot would repeal it; this is revisited when it is decided.',
    publisher: 'Washington State Legislature (ESSB 6346, chapter 238, Laws of 2026)',
    url: 'https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Session%20Laws/Senate/6346-S.SL.pdf',
  },
  {
    id: 'state-enacted-dc',
    label: 'District of Columbia standard deduction, 2026 to 2029',
    figures:
      'Basic standard deduction $15,000 single and $30,000 joint for 2026, plus the federal additional amount at 65, indexed from 2027 and rounded down to $50, and the federal standard deduction from 2030 (D.C. Code 47-1801.04(3A) and (44), D.C. Act 26-416, an emergency act in force from August 13, 2026 for no more than 90 days). The permanent act with the same text, D.C. Act 26-418, is under congressional review with a projected law date of about November 20, 2026; this is revisited then.',
    publisher: 'Council of the District of Columbia (D.C. Act 26-416)',
    url: 'https://code.dccouncil.gov/us/dc/council/acts/26-416',
  },
]
