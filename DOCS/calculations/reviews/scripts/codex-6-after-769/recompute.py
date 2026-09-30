"""Independent worksheet arithmetic. Reads publisher material only, no package imports."""
import json, math, re, html, urllib.request
from pathlib import Path

ROOT=Path('.')
S=ROOT/'DOCS/calculations/social-security/sources'
cpi={int(y):float(v) for y,v in json.loads((S/'bls-cpiu/data-viewer-annual-1937-2025.json').read_text())['annual'].items()}

def today(y,start=2026,infl=.025):
    return cpi[2025]/cpi[y]*(1+infl)**(start-2025) if y<=2025 else (1+infl)**(start-y)

base={1975:14100,1976:15300,1977:16500,1978:17700,1979:22900,1980:25900,1981:29700,1982:32400,1983:35700,1984:37800,1985:39600,1986:42000,1987:43800,1988:45000,1989:48000}
def rate(y,kind):
    if kind=='se':
        if y<=1983:return .0805
        if y<=1987:return .114
        if y<=1989:return .1212
        if y in (2011,2012):return .104
        return .124
    if kind=='emp':
        if y<=1977:return .0495
        if y==1978:return .0505
        if y<=1980:return .0508
        if y==1981:return .0535
        if y<=1984:return .054
        if y<=1987:return .057
        if y<=1989:return .0606
        if y in (2011,2012):return .042
        return .062
    if kind=='er':
        if y<=1977:return .0495
        if y==1978:return .0505
        if y<=1980:return .0508
        if y==1981:return .0535
        if y<=1983:return .054
        if y<=1987:return .057
        if y<=1989:return .0606
        return .062

def payroll(yrs,earn,kind):
    terms=[min(earn,base.get(y,earn))*rate(y,kind) for y in yrs]
    return sum(terms),sum(z*today(y) for y,z in zip(yrs,terms))

for label,yrs,earn,kind in [('A',range(1982,2022),50000,'emp'),('A-SE',range(1982,2022),50000,'se'),('A ER',range(1982,2022),50000,'er'),('B',range(1975,1979),20000,'emp'),('P',range(2003,2026),60000,'emp'),('P ER',range(2003,2026),60000,'er')]:
    print('payroll',label,*payroll(yrs,earn,kind))

def break_even(birth, pia, claims, last, cola, cutyear=None, ret=0, wages=None):
    values={c:{} for c in claims}; paid={c:{} for c in claims}
    for c in claims:
        cumulative=0
        for age in range(min(62,birth[1]),last+1):
            year=birth[0]+age
            f=(.7 if c==62 else 1 if c==67 else 1.24)
            benefit=0 if age<c else pia*f*12*cola**(year-2026)*(0.83 if cutyear and year>=cutyear else 1)
            if wages and c==62 and year in wages:benefit-=12760
            if wages and c==62 and year>=2031 and age>=67:benefit=(pia*(1-36*5/900-4*5/1200)*12)
            cumulative=cumulative*(1+ret)+benefit
            values[c][age]=cumulative; paid[c][age]=benefit
    crosses={}
    for j,e in enumerate(claims):
        for l in claims[j+1:]:
            for a in values[e]:
                if a<l or values[e][a]<=0:continue
                d=values[l][a]-values[e][a]
                if d>=0:
                    d0=values[l].get(a-1,0)-values[e].get(a-1,0)
                    crosses[(e,l)]=a-1-d0/(d-d0) if d0<0 else a
                    break
    return values,crosses

for lab,args in [
    ('A',((1964,62),1950,[62,67,70],95,1.025)),
    ('A5',((1964,62),1950,[62,67,70],95,1.025,None,.05)),
    ('B',((1996,30),2500,[62,67,70],90,1.025)),
    ('C',((1964,62),1950,[62,67,70],95,1.025,2034)),
    ('D',((1962,64),2900,[67,70],92,1.02)),
    ('E',((1964,62),2000,[62,67,70],95,1,None,0,{2026,2027})),
]:
    v,x=break_even(*args)
    print('break',lab,'cross',x,'sample',{a:{c:z.get(a) for c,z in v.items()} for a in (62,63,67,80) if all(a in z for z in v.values())})

def get_q():
    q={'male':{},'female':{}}
    # The companion worksheet transcribes SSA's printed 2023 Table 4C6 q(x) column.
    # Its operative age 63-67 and 117-119 rows were checked on SSA's live table.
    h=(ROOT/'DOCS/calculations/longevity/ssa-period-life-table.md').read_text(encoding='utf-8')
    for row in h.splitlines():
        cells=[c.strip() for c in row.split('|')]
        if len(cells)>=7 and cells[1].isdigit():
            a=int(cells[1]); q['male'][a]=float(cells[2]);q['female'][a]=float(cells[4])
    assert len(q['male'])==120,(len(q['male']),list(q['male'].items())[:3])
    return q
q=get_q()

def survival(sex,start,end):
    p=1
    for a in range(start,end):p*=1-(1 if a==119 else q[sex][a])
    return p

def single(startage,sex,pia,claimage,months=0,r=.02,scale=lambda y:1,benefit=None):
    total=0
    for age in range(startage,120):
        t=age-startage; year=2026+t
        m=benefit(age) if benefit else (pia*(.7 if claimage==62 else 1 if claimage==67 else 1+(claimage-67)*.08))
        n=0 if age<claimage else (12-months if age==claimage else 12)
        total+=survival(sex,startage,age)*m*n*scale(year)/(1+r)**t
    return total

for lab,x in [
 ('S-A',single(63,'female',1850,67)),
 ('S-B',single(63,'female',1850,67,6,benefit=lambda a:1850*1.04)),
 ('S-C',single(62,'female',800,62,benefit=lambda a:560 if a<64 else 707.5)),
 ('S-D',single(63,'female',1850,67,scale=lambda y:(1.02/1.025)**(y-2026)*(.83 if y>=2034 else 1))),
 ('S-E',single(117,'male',1000,70,benefit=lambda a:1050)),
]:print('EV',lab,x)

print('survivor q117-119',*[q['male'][a] for a in (117,118,119)])
print('ratio PV A',single(66,'male',3364.4,67))
print('ratio PV B',single(70,'male',3379.2,67,benefit=lambda a:3379.2*(1+8/150)))
print('ratio PV P',sum(single(45,sex,2859.4,67) for sex in ('male','female'))/2)
print('ratio A',single(66,'male',3364.4,67)/payroll(range(1982,2022),50000,'emp')[1])
print('ratio B',(single(70,'male',3379.2,67,benefit=lambda a:3379.2*(1+8/150))+36*3379.2*(1+8/150))/(230464.3163580016))
print('ratio P',sum(single(45,sex,2859.4,67) for sex in ('male','female'))/2/(payroll(range(2003,2026),60000,'emp')[1]+17*60000*.062))
print('ratio B paid',payroll(range(1978,2018),50000,'emp'))

def ownfactor(claim,fra=67):
    early=max(0,(fra-claim)*12);late=max(0,(claim-fra)*12)
    return 1-min(early,36)*5/900-max(0,early-36)*5/1200+late/150
def widowfactor(months,fra_months=804):
    return 1-.285*max(0,fra_months-months)/(fra_months-720)

def switch_case(case,surv,own,wages_override=None):
    # Parameters are worksheet inputs; month-level deductions follow SSA 203(f).
    cfg={
      'A':dict(birth=1964,mo=6,age=62,sex='female',pia=1500,fra=67,sfra=67,
               deadpia=2400,deadpaid=1680,limit=1980,r=.02,cola=1,infl=1,cut=0,wages={}),
      'B':dict(birth=1966,mo=3,age=60,sex='female',pia=1200,fra=67,sfra=67,
               deadpia=2000,deadpaid=2000,limit=None,r=.02,cola=1.02,infl=1.025,cut=2034,wages={}),
      'C':dict(birth=1961,mo=2,age=65,sex='female',pia=2000,fra=67,sfra=66+10/12,
               deadpia=2786+2/3,deadpaid=2786+2/3,limit=None,r=.02,cola=1,infl=1,cut=0,wages={}),
      'D':dict(birth=1966,mo=3,age=60,sex='female',pia=1200,fra=67,sfra=67,
               deadpia=2000,deadpaid=2000,limit=None,r=.02,cola=1,infl=1,cut=0,wages={2026:40000,2027:40000,2028:40000}),
      'E':dict(birth=1966,mo=3,age=60,sex='average',pia=1000,fra=67,sfra=67,
               deadpia=2500,deadpaid=2500,limit=None,r=0,cola=1,infl=1,cut=0,wages={2026:50000,2027:50000}),
    }[case]
    if wages_override is not None:cfg['wages']=wages_override
    of=ownfactor(own,cfg['fra']) if own else None
    sf=widowfactor(round(surv*12),round(cfg['sfra']*12)) if surv else None
    owncredit=0; survcredit=0; applied62=0; paid_by_age={}
    for age in range(cfg['age'],120):
        year=cfg['birth']+age
        excess=max(0,math.floor((cfg['wages'].get(year,0)-24480)/2))
        annual=0
        for month in range(1,13):
            current_age_months=age*12+month-cfg['mo']
            if current_age_months==744:applied62=survcredit
            own_ent=own is not None and age>=own and (age>own or month>=cfg['mo'])
            surv_ent=surv is not None and age>=surv and (age>surv or month>=cfg['mo'])
            own_payable=own is not None and age>=own
            surv_payable=surv is not None and age>=surv
            ownbase=0
            if own_payable:
                fac=ownfactor(own+owncredit/12,cfg['fra']) if current_age_months>=cfg['fra']*12 and own<cfg['fra'] else of
                ownbase=cfg['pia']*fac
            survbase=0
            if surv_payable:
                effective=round(surv*12)+survcredit if current_age_months>=round(cfg['sfra']*12) else round(surv*12)+(applied62 if current_age_months>=744 else 0)
                survbase=cfg['deadpia']*widowfactor(effective,round(cfg['sfra']*12))
                if cfg['limit']:survbase=min(survbase,cfg['limit'])
            kind='surv' if survbase>=ownbase and surv_payable else 'own'
            b=max(ownbase,survbase)
            # A pre-entitlement month paid by the annual convention is not chargeable.
            can_charge=(surv_ent if kind=='surv' else own_ent) and current_age_months<cfg['fra']*12
            charge=min(excess,b) if can_charge else 0
            excess-=charge
            if charge:
                if kind=='surv' and current_age_months<round(cfg['sfra']*12):survcredit+=1
                if kind=='own':owncredit+=1
            annual+=b-charge
        annual*= (cfg['cola']/cfg['infl'])**(year-2026) * (.8 if cfg['cut'] and year>=cfg['cut'] else 1)
        paid_by_age[age]=annual
    sexes=('male','female') if cfg['sex']=='average' else (cfg['sex'],)
    pv=sum(sum(survival(sex,cfg['age'],age)*v/(1+cfg['r'])**(age-cfg['age']) for age,v in paid_by_age.items()) for sex in sexes)/len(sexes)
    return pv,paid_by_age

strategies={
 'A':[(62,None),(67,None),(None,62),(None,67),(None,70),(67,62)],
 'B':[(60,None),(67,None),(None,62),(None,67),(None,70),(60,70),(67,62)],
 'C':[(65,None),(66,None),(None,65),(None,67),(None,70),(66,65)],
 'D':[(60,None),(67,None),(None,62),(None,67),(None,70),(67,62)],
 'E':[(60,None),(67,None),(None,62),(None,67),(None,70),(67,62)],
}
for case,plans in strategies.items():
  for surv,own in plans:
    pv,stream=switch_case(case,surv,own)
    print('switch',case,surv,own,pv, {a:stream[a] for a in (60,61,62,63,67,70) if a in stream})
print('switch D static formula 60 only',switch_case('D',60,None,{})[0])

def p_claim(p):return p['birth']+p['claim']
def p_own(p,y):
    if y<p_claim(p):return 0
    early=max(0,p['fra']*12-p['claim']*12)
    late=max(0,p['claim']*12-p['fra']*12)
    fac=1-min(early,36)*5/900-max(0,early-36)*5/1200+late/150
    return p['pia']*fac
def p_surv_fra_months(p):return p.get('sfra',p['fra'])*12
def p_deceased_base(p,k):
    if k>=p_claim(p):return p_own(p,k)
    # Unclaimed worker: PIA plus credits earned through month before December death.
    fra_year=p['birth']+p['fra']
    credits=max(0,(k-fra_year)*12+12-p['month'])
    return p['pia']*(1+credits/150)
def p_widow_monthly(alive,dead,k,y):
    if y<p_claim(alive):return 0
    jan_age=(k+1-alive['birth'])*12-(alive['month']-1)-(1 if alive.get('day',15)==1 else 0)
    e=max(alive['claim']*12,jan_age)
    base=(dead['pia'] if k>=p_claim(dead) and dead['claim']<dead['fra'] else p_deceased_base(dead,k))
    factor=widowfactor(e,p_surv_fra_months(alive))
    reduced=base*factor
    if k>=p_claim(dead) and dead['claim']<dead['fra']:
        reduced=min(reduced,max(p_own(dead,k),.825*dead['pia']))
    return reduced
def spousefactor(months,fra):
    early=max(0,fra*12-months)
    return 1-min(early,36)*25/3600-max(0,early-36)*5/1200
def both_monthly(a,b,y):
    am,bm=p_own(a,y),p_own(b,y)
    if y>=max(p_claim(a),p_claim(b)):
        high,low=(a,b) if a['pia']>b['pia'] else (b,a)
        first_y=max(p_claim(a),p_claim(b))
        first_m=max(a['month'] if p_claim(a)==first_y else 1,b['month'] if p_claim(b)==first_y else 1)
        lowage=(first_y-low['birth'])*12+first_m-low['month']
        excess=max(0,high['pia']*.5-low['pia'])*spousefactor(lowage,low['fra'])
        if low is a:am+=excess
        else:bm+=excess
    return (am+bm)*12
def couple(a,b,r=.02):
    start=2026; agea=start-a['birth'];ageb=start-b['birth'];total=0
    for y in range(start,max(a['birth'],b['birth'])+120):
        t=y-start;aa=agea+t;ab=ageb+t
        sa=survival(a['sex'],agea,aa) if aa<=119 else 0
        sb=survival(b['sex'],ageb,ab) if ab<=119 else 0
        value=sa*sb*both_monthly(a,b,y)
        for k in range(start,y):
            ka=agea+k-start;kb=ageb+k-start
            da=survival(a['sex'],agea,ka)*(1 if ka==119 else q[a['sex']][ka]) if ka<=119 else 0
            db=survival(b['sex'],ageb,kb)*(1 if kb==119 else q[b['sex']][kb]) if kb<=119 else 0
            if sa: value+=sa*db*12*max(p_own(a,y),p_widow_monthly(a,b,k,y))
            if sb: value+=sb*da*12*max(p_own(b,y),p_widow_monthly(b,a,k,y))
        total+=value/(1+r)**t
    return total
def person(birth,month,sex,pia,claim,fra=67,**extra):
    return dict(birth=birth,month=month,sex=sex,pia=pia,claim=claim,fra=fra,**extra)
couples={
 'C-A':(person(1964,6,'female',800,62),person(1964,2,'male',2000,62)),
 'C-B':(person(1964,3,'female',800,62),person(1964,8,'male',2400,70)),
 'C-C':(person(1962,6,'female',1000,67),person(1960,6,'male',3000,70)),
 'C-D':(person(1959,3,'female',500,67,fra=66+10/12,sfra=66.5),person(1964,2,'male',2000,62)),
 'C-E':(person(1964,6,'female',100,67),person(1964,1,'male',1000,70)),
}
for label,(a,b) in couples.items():
    print('couple',label,couple(a,b),'both26',both_monthly(a,b,2026),'widow26',p_widow_monthly(a,b,2026,2027),'widow28',p_widow_monthly(a,b,2028,2029))
a,b=couples['C-D'];print('C-D no DRC',couple({**a,'fra':67},b))
print('C-G67/67',single(64,'male',2200,67)+single(62,'female',3000,67))
print('C-G70/62',single(64,'male',2200,70)+single(62,'female',3000,62,benefit=lambda age:3000*widowfactor(744)))
print('C-G components',single(64,'male',2200,70),single(62,'female',3000,62,benefit=lambda age:3000*widowfactor(744)),(878231.4248894261-single(64,'male',2200,70))/single(62,'female',1,62,benefit=lambda age:1))
def cg_extra():
    h=person(1962,3,'male',2200,70);j=person(1964,2,'female',1200,62)
    ex=3000*widowfactor(744);tot=0
    for y in range(2027,2084):
        agej=y-1964; t=y-2026
        sj=survival('female',62,agej) if agej<=119 else 0
        if not sj:continue
        for k in range(2026,y):
            ageh=k-1962
            dh=survival('male',64,ageh)*(1 if ageh==119 else q['male'][ageh]) if ageh<=119 else 0
            current=p_widow_monthly(j,h,k,y)
            tot+=sj*dh*12*max(0,current-ex)/(1.02)**t
    return tot
print('C-G extra',cg_extra(),'total',single(64,'male',2200,70)+single(62,'female',3000,62,benefit=lambda age:3000*widowfactor(744))+cg_extra())

def cf_path(ac,sc,death=None):
    people={'A':dict(birth=1962,month=4,pia=2900,claim=ac,wage=140000),
            'S':dict(birth=1964,month=9,pia=1950,claim=sc,wage=85000)}
    owncred={'A':0,'S':0};widcred={'A':0,'S':0};widdata={}
    out={}
    for y in range(2026,2085):
        alive=[key for key in people if not death or key!=death[0] or y<=death[1]]
        if death and y==death[1]+1:
            dead=people[death[0]];sur=people['S' if death[0]=='A' else 'A']
            claimed=dead['birth']+dead['claim']<=death[1]
            if claimed and dead['claim']<67:
                base=dead['pia'];lim=max(dead['pia']*ownfactor(dead['claim']+owncred[death[0]]/12),.825*dead['pia'])
            elif claimed:
                base=dead['pia']*ownfactor(dead['claim']);lim=None
            else:
                base=dead['pia']*(1+max(0,(death[1]-(dead['birth']+67))*12+12-dead['month'])/150);lim=None
            janage=(y-sur['birth'])*12-(sur['month']-1)
            e=max(sur['claim']*12,janage)
            widdata['S' if death[0]=='A' else 'A']=(base,lim,e)
        excess={key:max(0,math.floor((p['wage']*1.025**(y-2026)-24480*1.025**(y-2026))/2)/1.025**(y-2026)) if y in (2026,2027) else 0 for key,p in people.items()}
        annual=0
        for month in range(1,13):
            for key in alive:
                p=people[key];age=y-p['birth'];agemo=age*12+month-p['month']
                claimyear=p['birth']+p['claim'];ownon=y>=claimyear
                ownent=ownon and (y>claimyear or month>=p['month'])
                own=0
                if ownon:
                    fac=ownfactor(p['claim']+owncred[key]/12) if agemo>=804 and p['claim']<67 else ownfactor(p['claim'])
                    own=p['pia']*fac
                widow=0
                if key in widdata and ownon:
                    base,lim,e=widdata[key]
                    widow=base*widowfactor(e+(widcred[key] if agemo>=804 else 0))
                    if lim is not None:widow=min(widow,lim)
                kind='widow' if widow>own else 'own'
                amount=max(own,widow)
                entitled=ownent if kind=='own' else ownent # one claim age for both
                charge=min(excess[key],amount) if entitled and agemo<804 else 0
                excess[key]-=charge
                if charge:
                    if kind=='own':owncred[key]+=1
                    else:widcred[key]+=1
                annual+=amount-charge
        out[y]=annual
    return out

def cf_pv(ac,sc,r=.02):
    both=cf_path(ac,sc)
    alone={(dead,k):cf_path(ac,sc,(dead,k)) for dead in ('A','S') for k in range(2026,2084)}
    total=0
    for y in range(2026,2085):
        aa=y-1962;ss=y-1964
        sa=survival('male',64,aa) if aa<=119 else 0
        sb=survival('female',62,ss) if ss<=119 else 0
        value=sa*sb*both[y]
        for k in range(2026,y):
            ka=k-1962;ks=k-1964
            da=survival('male',64,ka)*(1 if ka==119 else q['male'][ka]) if ka<=119 else 0
            db=survival('female',62,ks)*(1 if ks==119 else q['female'][ks]) if ks<=119 else 0
            value+=sa*db*alone['S',k][y]+sb*da*alone['A',k][y]
        total+=value/(1+r)**(y-2026)
    return total
for ac,sc in [(70,63),(70,64),(70,62),(64,62),(64,63),(64,64),(64,65),(64,66),(64,67),(64,68),(64,69),(64,70),(65,62),(65,63),(65,64),(65,65),(65,66),(65,67),(65,68),(65,69),(65,70)]:
    print('C-F',ac,sc,cf_pv(ac,sc))
for ac,sc in [(69,63),(69,64)]:print('C-F4',ac,sc,cf_pv(ac,sc,.04))

from decimal import Decimal as Q, ROUND_HALF_UP
def aca(magi,fpl,low,high,whole=True):
    pct=magi/fpl*100
    read=int(pct) if whole else pct
    ap=low+(read-150)/Q(50)*(high-low)
    if whole:ap=ap.quantize(Q('.01'),rounding=ROUND_HALF_UP)
    contribution=magi*ap/100
    return pct,read,ap,contribution,Q(12660)-contribution
magi=Q('29212.50')
for label,fpl,lo,hi,whole in [
 ('published 2027',Q(15960),Q('4.30'),Q('6.78'),True),
 ('scaled 2026',Q('15650')*Q('1.025'),Q('4.19'),Q('6.60'),True),
 ('scaled 2027',Q(15960)*Q('1.025'),Q('4.30'),Q('6.78'),True),
 ('old table',Q(15960),Q('4.19'),Q('6.60'),True),
 ('unrounded poverty percentage',Q(15960),Q('4.30'),Q('6.78'),False),
]:print('ACA',label,aca(magi,fpl,lo,hi,whole))

def widow_year(pia,e,fra=804,limit=None):
    monthly=pia*widowfactor(e,fra)
    if limit is not None:monthly=min(monthly,limit)
    return monthly*12
for label,pia,e,lim in [('A',2000,775,1650),('B',2600,772,2145),('C',2600,792,2145),('D',2600,772,None),('D wrong credit',2600,782,None),('E',2600,776,None),('E Dec death',2600,775,None)]:
    print('entitlement',label,widow_year(pia,e,limit=lim))
