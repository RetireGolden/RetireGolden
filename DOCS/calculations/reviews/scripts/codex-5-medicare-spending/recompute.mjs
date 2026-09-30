// Standalone arithmetic only. No RetireGolden imports or engine execution.
const out = (name, value) => console.log(name, JSON.stringify(value))
const floor100 = x => Math.floor(x / 100) * 100
const halfUp2 = x => Math.floor(x * 100 + 0.5) / 100

out('contract', {
  A2026: (12 + 6) * 800,
  A2027Plan: 12 * 800 * (1 + .025 + .02),
  A2027Path: 12 * 800 * (1 + .03 + .02),
  B2026: 2 * 12 * 700,
  B2027Stated: 12 * 700,
  B2027Field: 12 * 700 * (1 + .025 + .02),
  wrongNoGrowth: 12 * 800,
  wrongStatedGrowth: 12 * 700 * 1.045,
  wrongAfterDeath: 2 * 12 * 700,
})
const fplTwo = 15650 + 5500
const f = 28500 / 15650 * 100
const rateWhole = 4.19 + (Math.floor(f) - 150) / 50 * 2.41
const rateExact = 4.19 + (f - 150) / 50 * 2.41
out('ACA', {
  fplTwo, pctTwo: 42300 / fplTwo * 100, contributionTwo: 42300 * 6.6 / 100,
  pctOne: f, rateWhole, roundedRate: halfUp2(rateWhole), contributionOne: 28500 * halfUp2(rateWhole) / 100,
  wrongOnePersonPct: 42300 / 15650 * 100,
  wrongRateExact: rateExact, wrongExactContribution: 28500 * rateExact / 100,
  wrongRoundedExactContribution: 28500 * halfUp2(rateExact) / 100,
  wrongUnroundedWholeContribution: 28500 * rateWhole / 100,
  wrongPercentAsFraction: 42300 * 6.6,
})
const cCost = 53932.241304, cCap = 10756.3
const cBenefit = cCap + (cCost - cCap)
const ledgerCost = 53932.24, ledgerCap = 501.68 * 12
const ledgerBenefit = ledgerCap + (ledgerCost - ledgerCap)
out('care', { A: 72000 - 54000, B: 60000, cRemainder: cCost - cCap, cBenefit, cDifference: cCost - cBenefit, C: Math.max(0, cCost-cBenefit), refusedDifference: 1000-1000.01, ledgerCap, ledgerBenefit, ledgerDifference: ledgerCost-ledgerBenefit })
const tier = 3582.72, publishedTier = (284.10 + 14.50) * 12
const health = annual => {
  const first = annual + 50*12*1.1
  const second = 400*4*1.1 + annual*8/12 + 50*8*1.1
  return { first, second, total: first+second }
}
out('healthcare', { worksheet: health(tier), sourceCorrected: health(publishedTier), publishedTier, wrongNoMarketplaceInflation: health(tier).total-160, wrongForgetMedicare: health(tier).first+1760, wrongDoubleTierInflation: health(tier*1.1).total })
const totalBLeft = (40477.35+18353.95)+539.21
const totalBRight = 40477.35+(18353.95+539.21)
out('display', { totalA: 64321.50+7000.25+500, totalBLeft, totalBRight, wrongNoPenalties: 64321.50+7000.25, wrongNoTax: 64321.50+500, upsideA: 12000.40+3000.35, upsideB: .3+.1, upsideC: 8000, shortfallA: 4200+3000.35, shortfallB: .2+.25, oldFourWayB: .3+0+.2+.25, shortfallC: 0 })
const baseB = 812345.67+422222.22
out('guardrails', {
  A: { lowerPct: Math.round(1.4036718749999997*10000)/100, upperPct: Math.round(1.9011718749999997*10000)/100, lower: (140.37/100)*500000, upper: (190.12/100)*500000, oldLower: 1.4036718749999997*500000, oldUpper: 1.9011718749999997*500000 },
  B: { base: baseB, lower: 63.47/100*baseB, upper: 148.05/100*baseB },
  F: 60/100*500000,
  H: { lower: 50.03/100*500000, upper: 150.02/100*500000, otherLower: 50.03*500000/100, otherUpper: 150.02*500000/100 },
  ties: { k192Exact: .02+192*3.98/1024, k192ClaimedBinary: .7662499999999999, k192Rounded: Math.round(.7662499999999999*10000)/100, k64Rounded: Math.round((.02+64*3.98/1024)*10000)/100 },
})
out('rate', [[62800,1500000],[40000,1000000],[41200,800000],[62800,0],[0,750000],[33300,612345.67]].map(([m,b]) => b>0 ? (m/b)*100 : null))
const pairs = [[50050,50149],[50099,50100],[50000,50099],[50100,50001],[62813,67109],[null,55000],[48000,48000]]
out('shapes', pairs.map(([flat,shape]) => ({ flat: flat===null?null:floor100(flat), shape: floor100(shape), old: flat===null?null:shape-flat, delta: flat===null?null:floor100(shape)-floor100(flat) })))
out('smirk', [5,10,15,20,25,30,35].map(n => ({n, pow: Math.pow(.99,n), rounded: halfUp2(Math.pow(.99,n))})))
out('rounding', [[62813,40000],[62813,40000.4],[62800,60000],[45099,48500.5],[0,12000],[99,0],[61080,60050]].map(([f,current]) => ({f,current,published:floor100(f),slack:floor100(f)-current})))
const bisectThreshold = crossing => {
  let lo=.02, hi=4
  for(let i=0;i<10;i++){
    const mid=(lo+hi)/2
    if(mid>=crossing) hi=mid
    else lo=mid
  }
  return { fraction:hi, pct:Math.round(hi*10000)/100 }
}
out('latticeTies', { k192:bisectThreshold(.76624), k64:bisectThreshold(.2687), k448:bisectThreshold(1.76124), k704:bisectThreshold(2.75624) })
const solverProbes = (seed, required, through, resolution, floorFails=false) => {
  const probes=[]
  const pass=x=>{probes.push(x);return x<=through && (!floorFails || x!==62800)}
  let lo=null, hi=null
  const first=Math.max(Math.round(seed),Math.ceil(required))
  if(pass(first)){
    lo=first;let candidate=first*2
    while(true){if(pass(candidate)){lo=candidate;candidate*=2}else{hi=candidate;break}}
  }else{
    hi=first
    lo=Math.ceil(required)
    if(lo<first && !pass(lo))return {probes}
  }
  while(hi-lo>resolution){
    const mid=Math.round((lo+hi)/2)
    if(pass(mid))lo=mid;else hi=mid
  }
  return {probes,feasible:lo,floor:floor100(lo)}
}
out('solverA',solverProbes(40000,0,62850,500))
out('solverJ',solverProbes(40060,40050,40060,500))
out('solverK',solverProbes(41000,40000,40060,50))
