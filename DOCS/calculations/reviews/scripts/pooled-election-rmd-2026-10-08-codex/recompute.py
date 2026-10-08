from decimal import Decimal, getcontext, ROUND_HALF_UP
getcontext().prec = 32
D = Decimal
CENT = D('0.01')
def money(x):
    return x.quantize(CENT, rounding=ROUND_HALF_UP)
def case(label, live1, live2=None, paid=0, paid_from='first'):
    a, b, p = D(str(live1)), (None if live2 is None else D(str(live2))), D(str(paid))
    prior1 = a + (p if paid_from == 'first' else D(0))
    prior2 = None if b is None else b + (p if paid_from == 'second' else D(0))
    req1 = prior1 / D('24.6')
    req2 = D(0) if prior2 is None else prior2 / D('24.6')
    total = req1 + req2
    forced = max(D(0), total-p)
    first_forced = max(D(0), req1-(p if paid_from == 'first' else D(0)))
    second_forced = max(D(0), req2-(p if paid_from == 'second' else D(0)))
    if paid_from == 'first' and p > req1: second_forced=max(D(0), req2-(p-req1))
    if paid_from == 'second' and p > req2: first_forced=max(D(0), req1-(p-req2))
    print(label)
    for key,value in {'prior1':prior1,'prior2':prior2,'requirement1':req1,'requirement2':req2,'requirementTotal':total,'prepaid':p,'forced1':first_forced,'forced2':second_forced,'forcedTotal':forced,'yearEnd1':a-first_forced,'yearEnd2':None if b is None else b-second_forced,'shortfall':max(D(0),total-(p+forced))}.items():
        if value is not None: print(f'  {key}: {value} -> {money(value)}')
case('own balance',100000,29600)
case('count once',99000,29600,1000)
case('lone addback',99000,None,1000)
case('large pre-election',95000,29600,5000)
case('second IRA history',100000,28600,1000,'second')
