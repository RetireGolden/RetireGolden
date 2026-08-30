## 5. Retirement accounts: contribution limits (2026)

| Item | 2026 |
|------|------|
| 401(k)/403(b)/457 employee deferral | $24,500 |
| Catch-up 50+ | $8,000 |
| **Super catch-up, ages 60-63** (SECURE 2.0) | $11,250 when the employer plan permits it (replaces the 50+ amount). The planner has no plan-term input and applies it to every eligible employer account, so it can admit a contribution that an actual plan does not offer ([IRC 414(v)(1)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim); `irc-414-v-1-plan-permitted-catch-up`, approximated / understates tax). |
| **Roth catch-up mandate** | Prior-year FICA wages (IRC 3121(a) / W-2 Box 3 from the **sponsoring employer**) **exceed** $150,000 (Notice 2025-67) ⇒ employer-plan catch-ups must be designated Roth. Exactly $150,000 is out. Zero / omitted Box 3 (new hire, SE-only) is not subject. No Roth employer account **for that owner** ⇒ high earner’s catch-up is **$0**, not pre-tax. Super catch-up ages 60–63 ($11,250) is the same §414(v) slice. Redirected catch-up remains elective deferral of the source plan for employer match. IRC §414(v)(2)(A)(ii) limits catch-up to compensation minus other elective deferrals; §414(v)(3)(A) then keeps that slice out of §415(c) annual additions, including as a charge against match. SEP / SIMPLE IRA and IRA catch-up are excepted. **2026** is statute + reasonable good-faith (Notice 2023-62 transition expired 2025-12-31); T.D. 10033’s regulatory applicability date of years after 2026-12-31 does **not** delay the mandate to 2027. Engine input: user-entered `priorCalendarYearFicaWages` on the employer account (`irc-414-v-7-A-high-earner-roth-catch-up-mandate`, `irc-414-v-7-A-prior-year-fica-wage-proxy`, `irc-414-v-2-A-catch-up-limited-to-compensation-excess`, `irc-414-v-3-A-catch-up-excluded-from-415c`). |
| IRA | $7,500; catch-up 50+ $1,100. An IRA does not receive the $11,250 employer-plan super catch-up at ages 60-63 ([IRC 219](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim); `irc-219-b-5-B-ira-catch-up-excludes-employer-plan-super-catch-up`). |
| HSA (self/family) | parameter data (≈$4,400/$8,750) + $1,000 55+ catch-up |

- **Married HSA holders share one family limit.** Where either spouse has family coverage, IRC 223(b)(5) treats
  both as having only that coverage and divides the paragraph (1) limitation equally between them absent a
  different agreement. The $1,000 age-55 catch-up sits outside the division under (5)(B), so each spouse gets half
  the base plus a whole catch-up. Paragraph (5) opens on individuals married to each other, so the ledger divides
  only for a married-filing-jointly pair with both spouses living; an unmarried pair and a sole survivor each keep
  an undivided family base (`irc-223-b-5-hsa-family-limit-divided-between-spouses`). Coverage election, the monthly
  proration of 223(b)(1), and the Medicare-entitlement zeroing of 223(b)(7) are not modeled. In particular, the
  Plan has no Part A enrollment or retroactive-entitlement date, so it cannot identify the retroactive Medicare
  period that makes a contribution excess (`irc-223-b-7-medicare-part-a-retroactive-entitlement`); it also does
  not price the resulting section 4973 6% excise (`irc-4973-a-g-hsa-excess-contribution-excise`, approximated /
  understates tax).

- **IRA treatment is more than the annual contribution ceiling.** The SECURE Act repeal of the traditional-IRA
  age ceiling is implemented, so an otherwise eligible working contributor can contribute after age 70½
  (`pl-116-94-div-o-title-I-sec-107-traditional-ira-age-cap-repeal`). However, the traditional-IRA workplace-plan
  deduction phase-out is not implemented: the ledger treats a permitted traditional-IRA deposit as pre-tax even
  when §219(g) would make it nondeductible (`irc-219-g-traditional-ira-deduction-phaseout`, approximated /
  understates tax). Neither IRA/Roth excess-contribution excise is priced
  (`irc-4973-a-b-f-ira-and-roth-excess-contribution-excise`, approximated / understates tax).

- **Plan-document contribution terms are not inferred.** A generic `401k` account does not establish a SIMPLE
  401(k), a section 401(a)(17) compensation definition, a section 411 vesting schedule, the 403(b) 15-year
  catch-up and its ordering, or a 457(b) final-three-year catch-up. The SIMPLE status, vesting, 403(b) 15-year,
  and 457(b)(3) catch-up are refusals (`irc-401-k-11-simple-401-k-elective-deferral-limit`,
  `irc-408-p-2-E-i-II-simple-enhanced-elective-deferral-election`,
  `irc-411-a-2-vesting-schedule-maximums`, `irc-402-g-7-403b-15-year-catch-up`,
  `irc-414-v-7-402-g-7-403b-15-year-catch-up-exclusion`, and
  `irc-457-b-3-final-three-year-catch-up`). The compensation-cap gap is approximated: the projection can return
  an employer-match figure computed from uncapped wages
  (`irc-401-a-17-plan-compensation-cap`). Catch-up permission, including the ages-60-through-63 amount, is
  likewise approximated — the engine returns a ceiling even though the plan term is absent
  (`irc-414-v-1-plan-permitted-catch-up`). The plan also cannot execute an actual excess-elective-
  deferral correction and its March/April notices, distribution date, or allocable income
  (`irc-402-g-2-excess-elective-deferral-correction`).

- **PLESA facts are not inputs.** SECURE 2.0 section 127, not section 115, enacted the optional
  pension-linked emergency savings account (PLESA) feature. A PLESA is generally a designated-Roth subaccount,
  but the Plan has no separate PLESA account, participant-contribution balance, sponsor cap, earnings allocation,
  or withdrawal/action vocabulary. It therefore neither applies the lesser-of-indexed-$2,500-or-sponsor-cap
  contribution ceiling, prices the section 72(t) withdrawal exception, nor gives a PLESA distribution its
  qualified designated-Roth treatment (`irc-402A-e-1-A-plesa-optional-designated-roth-subaccount`,
  `irc-402A-e-3-A-plesa-participant-contribution-cap`,
  `irc-72-t-2-J-plesa-withdrawal-early-distribution-exception`, and
  `irc-402A-e-7-B-i-plesa-distribution-qualified-roth-treatment`; all out of scope). Primary sources:
  [IRC 402A](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim),
  [IRC 72](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim),
  [Notice 2024-22](https://www.irs.gov/pub/irs-drop/n-24-22.pdf), and
  [SECURE 2.0 section 127](https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf).

- **Saver's Match is awaiting a modeled surface.** SECURE 2.0 section 103 / IRC 6433 applies for taxable years
  beginning after December 31, 2026, not for the 2026 tax year. The Plan has no Saver's Match eligibility,
  qualified-contribution, payment, receiving-account, recovery-distribution, or repayment facts, so it produces
  neither the matching contribution nor the recovery tax on a specified early distribution
  (`irc-6433-a-1-savers-match-qualified-retirement-savings-contributions` and
  `irc-6433-f-6-savers-match-early-distribution-recovery-tax`; both out of scope). Primary sources:
  [IRC 6433](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section6433&num=0&edition=prelim),
  [Notice 2026-48](https://www.irs.gov/pub/irs-drop/n-26-48.pdf), and
  [SECURE 2.0 section 103](https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf).

Sources: [Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf),
[IRC §402](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim),
[IRC §219](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim),
[IRC §223](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim), and
[IRS Publication 969](https://www.irs.gov/publications/p969).
