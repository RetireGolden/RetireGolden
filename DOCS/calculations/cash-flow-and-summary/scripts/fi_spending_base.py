"""Hand arithmetic for the projection-summary-fi-spending-base worksheet (exact decimals)."""
from decimal import Decimal as D, getcontext
getcontext().prec = 40
start = 2026
infl = D('0.03')
swr = D('0.04')
# Pat 1980-12-31 retires at 50 -> 2030; Robin 1983-05-01 retires at 49 -> 2032 (the later one)
year = 2032
factor = (1 + infl) ** (year - start)
converting = D(80000) + D(30000) + D(0)       # the ledger's 2032 row: tax includes the conversion's
conversion_free = D(80000) + D(8000) + D(0)    # the same year with the plan's conversions removed
print('deflator 1.03^6 =', factor)
print('FI (conversion-free) =', conversion_free / factor / swr)
print('FI (conversion tax kept, wrong) =', converting / factor / swr)
pat_year = 2030
f2 = (1 + infl) ** (pat_year - start)
print('first-person year 2030 deflator', f2)
# coast: real 7% - 3% = 4%, horizon 2032 - 2026 = 6
fi = conversion_free / factor / swr
print('coast (6 years at 4%) =', fi / (D('1.04') ** 6))
print('coast (first person, 4 years, wrong) =', fi / (D('1.04') ** 4))
