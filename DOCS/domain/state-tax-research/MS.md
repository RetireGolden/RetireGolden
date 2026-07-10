# Mississippi (MS) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.4% on taxable income over $10,000; first $10,000 effectively 0%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 4.4%)
- Retirement income (pension, IRA, 401k): **fully exempt** — qualified retirement income (pensions, IRA/401(k), annuities) is not taxed

## Proposed StateTaxParams (2025)
- code: "MS"
- name: "Mississippi"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 2300, marriedFilingJointly: 4600 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 10000, ratePct: 4.4 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 10000, ratePct: 4.4 }
- retirement: { kind: "full" }

## Retirement-income detail
Mississippi imposes a flat **4.4%** (2025) income tax, but the first **$10,000**
of taxable income is exempt, modeled as a 0% bracket below $10,000 then 4.4%.
Social Security is fully exempt. Mississippi **fully exempts qualified
retirement income** — distributions from pensions (public and private), IRAs,
401(k)/403(b), and retirement annuities are entirely tax-free. Mapped to
`retirement: { kind: "full" }`, with no age gate (the exemption applies to
qualified retirement plan distributions regardless of age, though early
non-qualified withdrawals can be taxable — see Simplifications). Capital gains
are taxed as ordinary income at 4.4%.

## Simplifications / not modeled
- The $10,000 exemption is the same for single and MFJ (it is per return, not
  doubled for joint filers) — modeled identically for both, which is correct.
- Personal exemption ($6,000 single / $12,000 MFJ) and standard deduction
  ($2,300 / $4,600) both apply on top of the $10,000 zero bracket; only the
  standard deduction is modeled (personal exemption omitted — overstates tax).
- The "full" retirement exemption requires income to be a **qualified**
  distribution; early/non-qualified withdrawals before retirement age can be
  taxable. Not modeled (we treat all pension/IRA/401(k) as exempt).
- Mississippi's flat rate is scheduled to decline further (toward eventual
  repeal); the 2025 nominal 4.4% is held forward.

## Citations
- https://ustax.tools/tax-by-state/mississippi/ — 2025 flat 4.4% rate on income over $10,000.
- https://www.ntu.org/foundation/detail/mississippi-moves-to-end-individual-income-taxheres-what-taxpayers-need-to-know — 4.4% rate 2025, first $10,000 exempt, scheduled rate reductions.
- https://blog.turbotax.intuit.com/income-tax-by-state/mississippi-108486/ — standard deduction $2,300 / $4,600; personal exemption $6,000 / $12,000; qualified retirement income fully exempt; SS exempt.
- https://www.kiplinger.com/state-by-state-guide-taxes/mississippi — qualified pensions/IRA/401(k) fully exempt; capital gains taxed as ordinary income.
