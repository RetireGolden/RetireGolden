from decimal import Decimal as D, getcontext, ROUND_HALF_UP, ROUND_DOWN

getcontext().prec = 28

def tax(income, deduction, bands):
    taxable = max(D(0), D(income) - D(deduction))
    out = D(0)
    for i, (start, rate) in enumerate(bands):
        end = D(bands[i + 1][0]) if i + 1 < len(bands) else taxable
        out += max(D(0), min(taxable, end) - D(start)) * D(str(rate)) / 100
    return out

data = {
 'AR': (2470, [(0,0),(5600,2),(11200,3),(16000,3.4),(26400,3.7)]),
 'CA': (5706, [(0,1),(11079,2),(26264,4),(41452,6),(57542,8),(72724,9.3)]),
 'CO': (16100, [(0,4.4)]),
 'CT': (0, [(0,2),(10000,4.5),(50000,5.5),(100000,6)]),
 'DE': (3250, [(0,0),(2000,2.2),(5000,3.9),(10000,4.8),(20000,5.2),(25000,5.55),(60000,6.6)]),
 'IA': (16100, [(0,3.8)]),
 'KS': (3605, [(0,5.2),(23000,5.58)]),
 'MN': (15300, [(0,5.35),(33310,6.8),(109430,7.85)]),
 'MO': (16100, [(0,0),(1348,2),(2696,2.5),(4044,3),(5392,3.5),(6740,4),(8088,4.5),(9436,4.7)]),
 'MT': (16100, [(0,4.7),(47500,5.65)]),
 'NC': (12750, [(0,3.99)]),
 'ND': (16100, [(0,0),(49575,1.95)]),
 'NE': (8850, [(0,2.46),(4130,3.51),(24760,4.55)]),
 'NM': (16100, [(0,1.5),(5500,3.2),(16500,4.3),(33500,4.7),(66500,4.9)]),
 'NY': (8000, [(0,3.9),(8500,4.4),(11700,5.15),(13900,5.4),(80650,5.9)]),
 'OH': (0, [(0,0),(26050,0),(26050,2.75)]),
 'OK': (6350, [(0,0),(3750,2.5),(4900,3.5),(7200,4.5)]),
 'OR': (2910, [(0,4.75),(4550,6.75),(11400,8.75),(125000,9.9)]),
 'RI': (11200, [(0,3.75),(82050,4.75)]),
 'UT': (0, [(0,4.45)]),
 'VT': (7850, [(0,3.35),(50750,6.6),(122850,7.6)]),
 'WV': (0, [(0,2.11),(10000,2.81),(25000,3.16),(40000,4.22),(60000,4.58)]),
 'WI': (0, [(0,3.5),(15110,4.4),(51950,5.3),(300000,7.65)]),
}

def full(st, inc):
    if st == 'ME':
        deduction = D(15700) * max(D(0), D(1) - max(D(0), D(inc)-D(102250))/D(75000))
        return tax(inc, deduction, [(0,5.8),(27400,6.75),(64850,7.15)])
    if st == 'WI':
        deduction = max(D(0), D(13960)-D('.12')*max(D(0),D(inc)-D(20120)))
        return tax(inc, deduction, data[st][1])
    if st == 'OH':
        return D(332) + (D(inc)-D(26050))*D('.0275')
    if st == 'OK' and inc == 140000:
        inc = 130000
    deduction,bands=data[st]
    return tax(inc,deduction,bands)

def form_ratio(st, numerator, denominator):
    exact = D(numerator)/D(denominator)
    if st == 'OH':
        nonresident = (D(1)-exact).quantize(D('.0001'),rounding=ROUND_DOWN)
        return D(1)-nonresident
    if st in ('ME','IA'):
        places = '.0001' if st=='ME' else '.000001'
        nonresident = (D(1)-exact).quantize(D(places),rounding=ROUND_HALF_UP)
        return D(1)-nonresident
    return exact

for st in sorted([*data,'ME']):
    a,b=full(st,100000),full(st,140000)
    den = 130000 if st=='OK' else 140000
    nums=(80000,50000) if st=='OK' else (90000,50000)
    even=a/D(2)
    resident=b*D(nums[0])/D(den)
    texas=b*D(nums[1])/D(den)
    print(f'{st}: T100={a}; T140={b}; even={even}; resident={resident}; Texas={texas}')
    if st in ('ME','OH','IA'):
        print('  credit form, ratio rounding difference form minus exact:',*[b*form_ratio(st,n,den)-b*D(n)/D(den) for n in nums])
