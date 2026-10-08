"""Independent Decimal arithmetic from cited return mechanics and committed evidence.

No repository modules are imported and no engine or test is executed.
"""
from decimal import Decimal as D, getcontext

getcontext().prec = 30

def n(value):
    return D(str(value))

def bracket_tax(income, bands):
    income = n(income)
    return sum(max(D(0), min(income, n(hi)) - n(lo)) * n(rate)
               for lo, hi, rate in bands)

def ky(spread, months, resident_pension):
    income = n(spread) * n(months) / 12
    exclusion = min(n(resident_pension), n(31110))
    return max(D(0), income - exclusion - n(3360)) * n('.035')

def pa(spread, months, conversion, other_exempt=0):
    income = n(spread) * n(months) / 12
    return max(D(0), income - n(conversion) - n(other_exempt)) * n('.0307')

ca_bands = [
    (0, 11079, '.01'), (11079, 26264, '.02'),
    (26264, 41452, '.04'), (41452, 57542, '.06'),
    (57542, 72724, '.08'), (72724, 371479, '.093'),
    (371479, 445771, '.103'), (445771, 742953, '.113'),
    (742953, 999999999, '.123'),
]

def ca(spread, months):
    return bracket_tax(n(spread)-n(5706), ca_bands) * n(months) / 12

print('KY even', (n(50000)-n(3360))*n('.035'))
print('KY uneven resident', (n(90000)-n(3360)-n(31110))*n('.035'))
print('KY cap', (n(30000)-n(3360)-n(20000))*n('.035'))

or_tax = bracket_tax(n(20000)-n(2910), [(0,4550,'.0475'),(4550,11400,'.0675'),(11400,999999,'.0875')])
or_credit = n('.09') * min(n(6000), n(7500)-max(n(0),n(20000)-n(15000)))
print('OR annual tax, credit, slice tax', or_tax, or_credit, or_tax/n(2)-or_credit)

ar_bands = [(0,5600,0),(5600,11200,'.02'),(11200,16000,'.03'),(16000,26400,'.034'),(26400,999999,'.037')]
for pension in (4000,10000):
    year_excl = min(n(pension), n(6000))
    annual_income = n(50000)-year_excl
    annual_tax = bracket_tax(annual_income-n(2470), ar_bands)
    months_excl = min(n(pension)/2, year_excl/2)
    whole_excl = min(n(pension)/2, n(6000))
    months_ratio = (n(25000)-months_excl)/annual_income
    whole_ratio = (n(25000)-whole_excl)/annual_income
    print('AR', pension, 'annual',annual_tax,'months/whole exclusion',months_excl,whole_excl,'months/whole tax',annual_tax*months_ratio,annual_tax*whole_ratio)

for label, spread, months, pension in [
    ('U1 with annuity',241661.73,10,4397.59),
    ('U1 without annuity',232156.33,10,25963.61),
    ('FL 2030 KY',258017.89,6,86572.55),
    ('AZ 2028 KY',236393.87,3,47454.92),
    ('PA 2031 KY',224300.29,9,108559.70),
]:
    print(label,ky(spread,months,pension))

print('PA 2031 example',pa(224300.29,3,36186.57))
print('PA 2031 glidepath',pa(299650.23,3,35025.33,39881.33))
print('PA 2031 static',pa(304819.13,3,35031.23,41173.56))
print('CA 2031 glidepath',ca(299650.23,9))
print('CA 2031 static',ca(304819.13,9))

for label, old, new in [
    ('U1 with annuity KY',6930.87,6776.95),
    ('U1 without annuity KY',6653.63,5744.90),
    ('FL 2030 split',4407.57,3308.86),
    ('AZ 2028 split',5373.60,4273.26),
    ('PA 2031 example split',7532.46,5292.01),
    ('PA 2031 glidepath split',19029.95,17831.77),
    ('PA 2031 static split',19390.50,18192.12),
]:
    print(label,'delta',n(new)-n(old))
