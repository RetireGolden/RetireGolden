# Massachusetts (MA) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Massachusetts personal exemptions and TY2026 surtax threshold

Record: `ma-personal-exemptions-and-surtax`. Classification: `settled`.

The 2026 surtax adds 4% only to taxable income above $1,107,750. Personal exemptions are $4,400 single/MFS, $6,800 HOH and $8,800 joint, plus $700 for each qualifying age-65 taxpayer. These are personal exemptions, not a standard deduction. Full filing status and eligible-person counts are required. Short-term capital gain classification is a separate issue from this ordinary/LTCG computation.

Authority: [Massachusetts DOR, tax rates, tax year 2026](https://www.mass.gov/info-details/massachusetts-tax-rates).

> 5.00% Tax year 2026: For income exceeding $1,107,750, there is an additional surtax of 4%.

Authority: [Mass. Gen. Laws ch.62 §3(b)(1)-(3)](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section3).

> an additional exemption of seven hundred dollars if the taxpayer had attained the age of sixty-five before the close of his taxable year.

### Massachusetts previously taxed contributions are recovered once

Record: `ma-private-pension-basis-recovery`. Classification: `settled`.

For covered private retirement arrangements, Massachusetts excludes distributions until previously Massachusetts-taxed contributions have been recovered. Federal basis is not a substitute for Massachusetts basis. Opening basis, covered plan type, actual distribution and prior recoveries must be known. Account/owner basis must decrease by accepted recovery so a later year cannot recover it again.

Authority: [Mass. Gen. Laws ch.62 §2(a)(2)(F)](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2).

> Income from annuity, stock bonus, pension, profit-sharing, annuity or deferred-payment plans or contracts described in sections four hundred and three (b) or four hundred and four of the Code or individual retirement accounts, individual retirement annuities or retirement bonds described in sections four hundred and eight or four hundred and nine of the Code, until an aggregate amount of such income has been deducted under this subparagraph equal to the aggregate of all amounts previously subjected to taxation under this chapter; provided, that this subparagraph shall not apply to income from the optional retirement system established by section forty of chapter fifteen A.

### Massachusetts source-specific public, military and railroad exclusions

Record: `ma-rrb-and-public-pension-exclusions`. Classification: `settled`.

The public-pension exclusion requires a contributory U.S./Massachusetts public system or established out-of-state reciprocal treatment. Missing jurisdiction does not prove an in-state system; noncontributory public pensions are not covered merely because they are public. Uniformed-services retired pay and qualifying survivor benefits have their own exclusion. Tier I, Tier II and specified railroad lump sums are exempt. Only federally included amounts can be removed from the federal base.

Authority: [Mass. Gen. Laws ch.62 §2(a)(2)(E)](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2).

> Income from any contributory annuity, pension, endowment or retirement fund of the United States government or the commonwealth or any political subdivision thereof including the optional retirement system established by section forty of chapter fifteen A, to which the employee has contributed, or any income received from the United States government as retirement pay for a retired member of the Uniformed Services of the United States, as defined in 10 U.S.C. section 1072, regardless of whether the retiree contributed to the retirement system, or any income received from the United States government as survivorship benefits under 10 U.S.C. sections 1431 to 1460, inclusive.

Authority: [Massachusetts DOR, railroad retirement benefits](https://www.mass.gov/info-details/tax-treatment-of-government-pensions-in-massachusetts).

> Tier I or Tier II railroad retirement benefits are exempt from Massachusetts taxation. Railroad retirement lump-sum payments, commonly known as the insurance lump-sum payment and the residual payment, are exempt from Massachusetts taxation.

Authority: [Mass. Gen. Laws ch.62 §3B(a)(4), reciprocal contributory public pensions](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section3).

> any income from a contributory annuity, pension, endowment or retirement fund of any other state or any political subdivision thereof, to the extent that income from any such similar fund established under the laws of the commonwealth is not subject to taxation in such other state or political subdivision.

### Massachusetts contributory public-pension source boundary

Record: `ma-gen-laws-ch62-s2-public-pension-exclusion`. Classification: `settled`.

Section 2(a)(2)(E) excludes qualifying contributory U.S. and Massachusetts public pensions and specified military benefits. Other-state public plans require established reciprocity. A generic public-pension aggregate cannot prove these conditions. The characterized retirement path evaluates the source facts; unknown source or reciprocity produces an incomplete disclosure. A full public-pension shortcut is not statutory authority.

Authority: [Mass. Gen. Laws ch.62 §2(a)(2)(E)](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2).

> Income from any contributory annuity, pension, endowment or retirement fund of the United States government or the commonwealth or any political subdivision thereof including the optional retirement system established by section forty of chapter fifteen A, to which the employee has contributed, or any income received from the United States government as retirement pay for a retired member of the Uniformed Services of the United States, as defined in 10 U.S.C. section 1072, regardless of whether the retiree contributed to the retirement system, or any income received from the United States government as survivorship benefits under 10 U.S.C. sections 1431 to 1460, inclusive.

Authority: [Mass. Gen. Laws ch.62 §3B(a)(4), reciprocal contributory public pensions](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section3).

> any income from a contributory annuity, pension, endowment or retirement fund of any other state or any political subdivision thereof, to the extent that income from any such similar fund established under the laws of the commonwealth is not subject to taxation in such other state or political subdivision.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://www.mass.gov/info-details/tax-treatment-of-pensions-in-massachusetts — private pensions/IRA/401(k) taxable; government pensions exempt; SS exempt.
- https://www.mass.gov/info-details/massachusetts-personal-income-tax-exemptions — 2025 personal exemptions $4,400 / $8,800; $700 age-65; no standard deduction.
