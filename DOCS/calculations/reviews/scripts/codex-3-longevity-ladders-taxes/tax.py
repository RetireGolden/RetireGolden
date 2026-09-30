from decimal import Decimal as D
T=D('49450');ded=D('16100')
for name,O,P,G in [('A',40000,10000,0),('B',17600,10000,0),('C',10000,10000,0),('E',40000,0,0),('G',40000,10000,4000),('H',40000,10000,-2000)]:
 O,P,G=map(D,(O,P,G));usedG=min(P,max(G,0));avail=P-usedG+max(-G,0);usedO=min(avail,D(3000));remaining=avail-usedO
 slack=max(0,ded+usedO-O)
 R=remaining+min(usedO,slack)+(max(0,T+ded-O) if slack>=usedO else 0)
 print(name,'usedG',usedG,'usedO',usedO,'remaining',remaining,'R',R)
g=D(9000)+D(9650)/D('.85');print('D',g,'floor at cents',g.quantize(D('.01')))
print('NIIT',D(200000),'band',D('148350')+D('54450'),'tax at band',(D('202800')-D(200000))*D('.038'))
print('senior', (D('50686.25')-D('4541.7418'))/D('1.06'),'band',D('43548.97'),'tax at band',D('.15')*D('.06')*D(290))
