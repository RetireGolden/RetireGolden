from decimal import Decimal, getcontext
import math
getcontext().prec=35
D=Decimal
print('ACA', D(57000)/D(313), 28500*D('0.0573'))
print('Medicare tiers Part B', [D(x)*12 for x in ('202.90','284.10','405.80','527.50','649.20','689.90')])
print('Medicare IRMAA', [(D(b)-D('202.90')+D(d))*12 for b,d in zip(('284.10','405.80','527.50','649.20','689.90'),('14.50','37.50','60.40','83.30','91.00'))])
print('Healthcare', (D('284.10')+D('14.50'))*12, D('3583.20')+D(50)*12*D('1.10'), D('3583.20')*8/12+D(50)*8*D('1.10')+D(400)*4*D('1.10'))
print('PIA years', [(95-age+1)*factor for age,factor in [(70,D('1.24')),(67,D(1)),(62,D('.70'))]])
print('W', D(50000-24480)/2, D('3364.40')*(1-D(12)*D(5)/D(900)), D(12)*D('3140.10666666666666666667')-D(12760), D(3)*D('3140.10666666666666666667')+D(9)*D('3364.40')*(1-D(7)*D(5)/D(900)))
for label,pv,paid in [('W',D('556896.90'),D('225418.24')),('W full',D('554544.12'),D('225418.24')),('X',D('240848.22'),D('47740.87')),('X own',D('223082.93'),D('47740.87')),('X ex',D('329200.82'),D('47740.87'))]: print(label,'ratio',pv/paid)
for total,bs in [(100000.01,[1028.55,2057.21]),(822519.53,[1251.79,84015.57,138302.07])]:
    rem=total
    for b in bs: rem-=b
    vals=bs+[rem]
    print('bucket',repr(rem),repr(sum(vals)),(total-sum(vals))/math.ulp(total))
print('GARCH band',5*D('0.0142836'))
import pathlib,re
table=(pathlib.Path('DOCS/calculations/longevity/ssa-period-life-table.md').read_text(encoding='utf-8'))
q={}
for line in table.splitlines():
    m=re.match(r'\| (\d{1,3}) \| (0\.\d{6}|1\.\d{6}) \| [\d.]+ \| (0\.\d{6}|1\.\d{6}) \|',line)
    if m:q[int(m[1])]=(float(m[2]),float(m[3]))
def survival(age,sex,t):
    v=1.0
    for a in range(age,age+t):v*=1-(1.0 if a>=119 else q[a][sex])
    return v
w=0.0;wfull=0.0;x=0.0;xown=0.0;xex=0.0
for t in range(54):
    sm=survival(66,0,t); discount=1.02**t
    early=3364.4*(1-12*5/900)
    adjusted=3364.4*(1-7*5/900)
    wbenefit=12*early-12760 if t==0 else 3*early+9*adjusted if t==1 else 12*adjusted
    wfbenefit=12*early
    w+=sm*wbenefit/discount;wfull+=sm*wfbenefit/discount
    if t>=1:
        sf=survival(64,1,t)
        x+=sm*(12*1355.30*sf+24000*(1-sf))/discount
        xown+=sm*12*1355.30/discount
        xex+=sm*24000/discount
print('W PV independent',w,wfull)
print('X PV independent',x,xown,xex)
d=0.0
for t in range(60):
    benefit=(9400 if t in (0,1) else 10350 if t==2 else 18300 if t in (3,4,5,6) else 2*1525+10*(2000*(1-.285*66/84)) if t==7 else 12*(2000*(1-.285*66/84)))
    d+=survival(60,1,t)*benefit/1.02**t
print('D survivor PV independent',d)
