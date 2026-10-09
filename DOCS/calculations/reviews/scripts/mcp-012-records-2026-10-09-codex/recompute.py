"""Independent Decimal and uint32 checks for the five census worksheets."""
from decimal import Decimal, getcontext

getcontext().prec = 40
D = Decimal

tax_rows = [(D('18250.40'), D('0')), (D('21030.15'), D('2500')),
            (D('0'), D('0')), (D('24410.62'), D('1000.35'))]
print('cumulative_tax', sum((tax + penalty for tax, penalty in tax_rows), D(0)))
print('ending_trad', D('240500.25') + D('310250.50'))

estate_a = D('1500000') + D('400000') * D('0.75')
estate_b = D('1400000') + D('800000') * D('0.75')
today_a = estate_a / D('1.025') ** 24
today_b = estate_b / D('1.025') ** 28
print('estate_a', estate_a, 'estate_b', estate_b, 'nominal_delta', estate_b - estate_a)
print('headline_today_a', today_a, 'headline_today_b', today_b, 'today_delta', today_b - today_a)

seed = int('5eeded', 16)
mask = (1 << 32) - 1
def path_seed(index):
    h0 = (seed ^ ((index + 1) * 0x9e3779b9 & mask)) & mask
    h1 = ((h0 ^ (h0 >> 16)) * 0x21f0aaad) & mask
    h2 = ((h1 ^ (h1 >> 15)) * 0x735a2d97) & mask
    return h0, h1, h2, (h2 ^ (h2 >> 15)) & mask
print('mc_seed', seed, 'path0', path_seed(0), 'path1', path_seed(1))

deflator = D('1.03') ** 6
fi_number = D('88000') / deflator / D('0.04')
coast = fi_number / D('1.04') ** 6
with_conversion_tax = D('110000') / deflator / D('0.04')
print('fi_deflator', deflator, 'fi_number', fi_number, 'coast', coast,
      'conversion_tax_included', with_conversion_tax)
