from decimal import Decimal, getcontext
getcontext().prec=50
D=Decimal
for r in ['0.03995','0.0393','0.01995','0.0395']:
  r=D(r); print('pv',r, sum(D(12000)/(1+r)**k for k in range(1,7)),sum(D(12000)/(1+r)**k for k in range(1,4)))
f=D(41)/D(40)
for n in [5,10,40]: print('factor',n,f**n)
print('today2036',D(1000000)/f**10,'today2031',D(1000000)/f**5,'FI target',D('1234567.89')*f**10)
print('wrong healthcare', D('1.045')**10,'wrong exponent', D(1000000)/f**11,'FI wrong',D('1234567.89')/f**10)
q=D('1.03')**6; fi=(D(88000)/q)/D('.04'); coast=fi/D('1.04')**6
print('fi',q,fi,coast,'wrong tax',D(110000)/q/D('.04'),'wrong horizon',fi/D('1.04')**4)
print('hsa old',D(8750)*D('1.025')**2)
