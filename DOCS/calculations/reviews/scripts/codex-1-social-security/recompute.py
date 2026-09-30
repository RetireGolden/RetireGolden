"""Independent arithmetic for the Social Security catalog review.

Source data below are transcribed from SSA's public AWI and contribution-base
tables, not read from any package or test in the repository.
"""
from decimal import Decimal, ROUND_FLOOR

D = Decimal
awi_text = '''
1960 4007.12 1970 6186.24 1978 10556.03 1979 11479.46
1980 12513.46 1981 13773.10 1982 14531.34 1983 15239.24
1984 16135.07 1985 16822.51 1986 17321.82 1987 18426.51
1988 19334.04 1989 20099.55 1990 21027.98 1991 21811.60
1992 22935.42 1993 23132.67 1994 23753.53 1995 24705.66
1996 25913.90 1997 27426.00 1998 28861.44 1999 30469.84
2000 32154.82 2001 32921.92 2002 33252.09 2003 34064.95
2004 35648.55 2005 36952.94 2006 38651.41 2007 40405.48
2008 41334.97 2009 40711.61 2010 41673.83 2011 42979.61
2012 44321.67 2013 44888.16 2014 46481.52 2015 48098.63
2016 48642.15 2017 50321.89 2018 52145.80 2019 54099.99
2020 55628.60 2021 60575.07 2022 63795.13 2023 66621.80
2024 69846.57'''
base_text = '''
1951-54 3600 1955-58 4200 1959-65 4800 1966-67 6600
1968-71 7800 1972 9000 1973 10800 1974 13200 1975 14100
1976 15300 1977 16500 1978 17700 1979 22900 1980 25900
1981 29700 1982 32400 1983 35700 1984 37800 1985 39600
1986 42000 1987 43800 1988 45000 1989 48000 1990 51300
1991 53400 1992 55500 1993 57600 1994 60600 1995 61200
1996 62700 1997 65400 1998 68400 1999 72600 2000 76200
2001 80400 2002 84900 2003 87000 2004 87900 2005 90000
2006 94200 2007 97500 2008 102000 2009 106800 2010 106800
2011 106800 2012 110100 2013 113700 2014 117000 2015 118500
2016 118500 2017 127200 2018 128400 2019 132900 2020 137700
2021 142800 2022 147000 2023 160200 2024 168600 2025 176100
2026 184500'''

def pairs(s):
    x = s.split()
    return zip(x[::2], x[1::2])

AWI = {int(y): D(v) for y, v in pairs(awi_text)}
BASE = {}
for yr, amount in pairs(base_text):
    a, _, b = yr.partition('-')
    start = int(a)
    stop = int(b) if b else start
    if b and len(b) == 2:
        stop = start // 100 * 100 + stop
    for y in range(start, stop + 1):
        BASE[y] = D(amount)

def floor(v, quantum='1'):
    q = D(quantum)
    return (v / q).to_integral_value(rounding=ROUND_FLOOR) * q

def pia(aime, low, high):
    a, l, h = map(D, (aime, low, high))
    return floor(D('.9') * min(a, l) + D('.32') * min(max(a-l, 0), h-l)
                 + D('.15') * max(a-h, 0), '.1')

def earnings_case(birth, start, stop, annual, low, high, extra=None,
                  cap=True, first=None, index_floor=True):
    e = birth + 62
    index_year = e - 2
    first = max(1951, birth + 22) if first is None else first
    raw = {y: D(annual) for y in range(start, stop+1)}
    raw.update({int(y): D(v) for y, v in (extra or {}).items()})
    indexed = {}
    for y in range(first, e):
        value = raw.get(y, D(0))
        if cap is True or (cap == 'from1979' and y >= 1979):
            value = min(value, BASE.get(y, BASE[2026] if y > 2026 else D(3000)))
        if y <= index_year and value:
            value *= AWI[min(index_year, 2024)] / AWI[min(y, 2024)]
            if index_floor:
                value = floor(value)
        indexed[y] = value
    kept = sorted(indexed.values(), reverse=True)[:max(0, len(indexed)-5)]
    total = sum(kept, D(0))
    aime = floor(total / (12*len(kept)))
    return {'first': first, 'count':len(kept), 'zeros':kept.count(0),
            'sum':total, 'aime':aime, 'pia':pia(aime,low,high),
            'indexed':indexed}

def cola(p, rates):
    out=[]
    for c in rates:
        p = floor(D(p)*(1+D(c)/100), '.1')
        out.append(p)
    return out

if __name__ == '__main__':
    for name, args in [
        ('cap A', (1956,1978,2017,50000,895,5397)),
        ('cap A uncapped', (1956,1978,2017,50000,895,5397)),
        ('zeros A', (1966,1995,2024,60000,1286,7749)),
        ('zeros B', (1966,1988,2024,60000,1286,7749)),
        ('zeros C', (1966,2020,2024,60000,1286,7749)),
        ('replace C', (1966,1995,2024,300000,1286,7749)),
        ('replace O', (1958,1985,2015,50000,960,5785)),
        ('pia H', (1960,1982,2021,50000,1024,6172)),
    ]:
        kw = {'cap':'from1979'} if name=='cap A uncapped' else {}
        r=earnings_case(*args, **kw)
        print(name, {k:v for k,v in r.items() if k!='indexed'})
        if name=='cap A':
            print('1978',r['indexed'][1978], '1979',r['indexed'][1979])
        if name.startswith('zeros') or name.startswith('replace'):
            yr=2027 if name!='replace O' else 2019
            sample = 300000 if name in ('zeros C','replace C','zeros B') else 50000 if name=='replace O' else 60000
            new=earnings_case(*args, extra={yr:sample})
            print(' replacement',yr,{k:v for k,v in new.items() if k!='indexed'})
    print('cap B',earnings_case(1925,1960,1960,20000,310,1866,
                              extra={1970:20000}))
    print('COLA A',cola('2846.4',['8.7','3.2','2.5','2.8']))
    print('COLA B',cola('2551.9',['2.8','1.6','1.3','5.9','8.7','3.2','2.5','2.8']))
    print('COLA O before',cola('2520.3',['1.3','5.9','8.7','3.2','2.5','2.8']))
    print('COLA O after',cola('2538.2',['1.3','5.9','8.7','3.2','2.5','2.8']))
