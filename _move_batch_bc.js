const fs = require('fs');
const path = 'packages/engine/src/rules/taxRuleRegistry.ts';
let c = fs.readFileSync(path, 'utf8');
const linesBefore = c.split('\n').length;
const BATCH_B = '  // WS4d Batch B';
const INSERT = "  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {";
const WI = "  'wi-stat-71-05-retirement-income-subtraction': {";
const SEP = '  // ---------------------------------------------------------------------------';
const bi = c.indexOf(BATCH_B);
if (bi < 0) throw new Error('Batch B not found');
const bs = c.lastIndexOf(SEP, bi);
const wi = c.indexOf(WI, bi);
const ce = c.indexOf('  },\n', wi + WI.length);
if (ce < 0) throw new Error('wi close not found');
const be = ce + 5;
const block = c.slice(bs, be);
let ii = c.indexOf(INSERT);
if (ii < 0) throw new Error('insert not found');
let w = c.slice(0, bs) + c.slice(be);
if (bs < ii) ii -= block.length;
const n = w.slice(0, ii) + block + w.slice(ii);
if (n.length !== c.length) throw new Error('length changed');
fs.writeFileSync(path, n, 'utf8');
const linesAfter = n.split('\n').length;
const markers = [
  ["  'ks-stat-79-32-117-public-pension-exclusion': {", 'KS public pension'],
  [BATCH_B, 'Batch B comment'],
  [WI, 'wi-stat'],
  [INSERT, 'irc-408 projection'],
];
for (const [m, name] of markers) {
  if (n.split(m).length - 1 !== 1) throw new Error('count ' + name);
}
const order = markers.map(([m, name]) => [name, n.indexOf(m) + 1]).sort((a, b) => a[1] - b[1]);
console.log(JSON.stringify({ linesBefore, linesAfter, blockLines: block.split('\n').length, order: order.map(([n, l]) => n + '@' + l) }));
