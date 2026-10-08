"""Independent Decimal worksheets from the cited return lines; no engine imports."""
from decimal import Decimal as D, getcontext

getcontext().prec = 28

def tax_brackets(income, bands):
    income = D(income)
    return sum(max(D(0), min(income, D(upper)) - D(lower)) * D(rate)
               for lower, upper, rate in bands)

half = D('0.5')

# The 2026 rate/deduction amounts are stated in the versioned pack; allocation
# and return ordering come from the official 2025 forms cited in REVIEW.md.
il = (D(50000) - D(2925)*half) * D('.0495')
ma = (D(50000) - D(4400)*half) * D('.05')
ct = (D(10000)*D('.02') + D(25000)*D('.045'))*half
wi_deduction = D(13960) - D('.12')*(D(100000)-D(20120))
wi_tax = tax_brackets(D(100000)-wi_deduction-D(700),
    [(0,15110,'.035'),(15110,51950,'.044'),(51950,999999,'.053')])
wi = wi_tax*half
or_tax = tax_brackets(D(20000)-D(2910),
    [(0,4550,'.0475'),(4550,11400,'.0675'),(11400,999999,'.0875')])
or_credit = D('.09')*min(D(12000),D(7500)-(D(20000)-D(15000)))
or_code = (or_tax-or_credit)*half
or_form = or_tax*half-or_credit  # OR-40-P lines 45 then 51, OR-17 credit code 811
ut = (D(20000)*D('.0445')-D(450))*half
ia = min((D(26000)-D(16100))*D('.038'),D(9200)-D(9000))*half
sc = tax_brackets(D(50000),[(0,30000,'.0199'),(30000,999999,'.0521')])

ny_full = D('3183'); ny = ny_full*(D(45000)-D(15000))/D(70000)
de_full = D(3224); de = de_full*(D(45000)-D(12500)*D(2)/D(3))/D(67500)
wi_cap_tax = tax_brackets(D(80000)-D('6774.4')-D(24000),
    [(0,15110,'.035'),(15110,51950,'.044'),(51950,999999,'.053')])
wi_cap = wi_cap_tax*(D(40000)-D(24000)*half)/D(80000)
wv = D('2500.10')*half
ky_code = (D(30000)-D(3360)-D(31110)*half)*D('.035')
ky_form = (D(30000)-D(3360)-min(D(20000),D(31110)))*D('.035')

for name, value in locals().copy().items():
    if name in {'il','ma','ct','wi','or_tax','or_credit','or_code','or_form','ut','ia','sc',
                'ny','de','wi_cap','wv','ky_code','ky_form'}:
        print(f'{name}={value}')

# Two six-month slices. The dated March row follows its date; all other AGI
# components, including the undated gain and dividend, split by months.
ordinary = D(140000); dated = D(40000); gain = D(6000); dividend = D(2000)
early = (ordinary-dated)*half+dated+(gain+dividend)*half
late = (ordinary-dated)*half+(gain+dividend)*half
print(f'allocator_early={early}; late={late}; annual={early+late}')
