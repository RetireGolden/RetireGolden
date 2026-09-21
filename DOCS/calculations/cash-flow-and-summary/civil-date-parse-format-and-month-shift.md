## Claim

Kind: formula. `actions/civilDate.ts#parseCivilIsoDate` accepts only canonical valid proleptic-Gregorian `YYYY-MM-DD` dates, `formatCivilDate` emits that form, and `addCalendarMonths` shifts by whole calendar months while preserving the day or clamping to the target month's last day.

## Justification

Gregorian leap years are divisible by 4 except century years not divisible by 400. Month addition first maps `(year,month)` to a linear month index, then clamps the original day to the target month's length; this avoids JavaScript Date rollover and timezone effects.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Civil date | 2024-01-31 | local civil date |
| Month shift | +1 | calendar month |

## Arithmetic

2024 is divisible by 4 and not an excluded century, so February has 29 days. January plus one month is February; `min(31,29)=29`. Formatting pads month and day to two digits.

## Expected

Parsed date `{year:2024,month:1,day:31}` and shifted/formatted result `2024-02-29`, exact strings/integers.

## Wrong readings

- JavaScript-style overflow can roll February 31 to `2024-03-02`.
- Using the nonleap rule yields `2024-02-28` despite 2024 being a leap year.

## Family

none yet — date scheduling is upstream and no civil-date family is displayed.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
