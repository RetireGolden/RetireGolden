## Claim

Kind: formula. `ladder/bridge.ts#sizeBridge` sizes a real-dollar Social Security bridge by multiplying monthly PIA by the age-62 claim factor, annualizing by 12, paying from the later of age 62, retirement year and next calendar year through the year before a January claim (or through a mid-year claim year), and pricing those annual payments as a TIPS ladder purchased in the current year without stated output rounding; the date formula is derived from the comments' stated convention and must be checked against the engine.

## Justification

The forgone monthly benefit is `M=PIA*f_62` and the level annual replacement is `A=12M`. For a January claim the inclusive payment count is `N=claimYear-startYear`; for a mid-year claim it is `N=claimYear-startYear+1`. The ladder cost is the present price returned for those `N` real annual payments on the supplied curve; at a zero real curve each payment has unit present value, so `cost=NA`. The valid domain here has claim age above 62 and a nonempty bridge window; otherwise the function returns null.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| PIA | 2,000 | today's dollars/month |
| Age-62 claim factor `f_62` | 7/10 | ratio |
| Date of birth | 1965-01-01 | civil date |
| Claim age | 65 years, 0 months | age |
| Current year | 2026 | calendar year |
| Retirement year | 2026 | calendar year |
| Real-yield curve | 0 at all maturities | percent/year |

## Arithmetic

Age 62 begins in `2027`; next year is `2027`; therefore `startYear=max(2027,2026,2027)=2027`. A January age-65 claim begins in `2030`, so `endYear=2029` and `N=2029-2027+1=3`. `M=$2,000*(7/10)=$1,400/month`. `A=12*$1,400=$16,800/year`. With zero real yields, `ladderCost=3*$16,800=$50,400`.

## Expected

Expected monthly age-62 benefit `$1,400.00`, annual real amount `$16,800.00`, start year `2027`, end year `2029`, years `3`, and ladder cost `$50,400.00`; years are exact integers and dollar outputs have exact-cent tolerance because the zero-yield example requires only exact multiplication and addition.

## Wrong readings

- Starting in the current year creates four payments (2026-2029) and costs `$67,200.00`.
- Including the January claim year creates a 2027-2030 four-year bridge and also costs `$67,200.00`.

## Family

outputs: `social-security-bridge-sizing`.

feeds: `insight-ss-bridge-gap-total`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
