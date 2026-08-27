const fs = require('fs');
const path = 'packages/engine/src/rules/taxRuleRegistry.ts';

function fixMove(c) {
  const linesBefore = c.split('\n').length;
  const LA2 = "  'la-rs-47-44-2-social-security-federal-retirement': {";
  const RI = "  'ri-gen-laws-44-30-12-social-security-and-pension-modification': {";
  const WI = "  'wi-stat-71-05-retirement-income-subtraction': {";
  const IRC = "  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {";
  const MD = "  'md-tax-10-207-social-security-exclusion': {";
  const OR = "  'or-stat-316-054-social-security-exclusion': {";

  const la2 = c.indexOf(LA2);
  if (la2 < 0) throw new Error('la-rs-2 not found');
  const riMis = c.indexOf(RI, la2);
  if (riMis < 0) throw new Error('misplaced ri not found');
  const wiNew = c.indexOf(WI, riMis);
  if (wiNew < 0) throw new Error('wi not found');
  const irc = c.indexOf(IRC, wiNew);
  if (irc < 0) throw new Error('irc not found');
  const mdOld = c.indexOf(MD, irc);
  if (mdOld < 0) throw new Error('old md block not found');
  const orOld = c.indexOf(OR, mdOld);
  if (orOld < 0) throw new Error('old or not found');
  const orClose = c.indexOf('  },\n', orOld + OR.length);
  if (orClose < 0) throw new Error('or close not found');
  const orEnd = orClose + 5;

  const misplaced = c.slice(riMis, wiNew);
  const oldBlock = c.slice(mdOld, orEnd);
  const n =
    c.slice(0, riMis) +
    oldBlock +
    misplaced +
    c.slice(wiNew, mdOld) +
    c.slice(orEnd);

  const markers = [
    ["  'ks-stat-79-32-117-public-pension-exclusion': {", 'KS public pension'],
    ['  // WS4d Batch B', 'Batch B comment'],
    [WI, 'wi-stat'],
    [IRC, 'irc-408 projection'],
  ];
  for (const [m, name] of markers) {
    const count = n.split(m).length - 1;
    if (count !== 1) throw new Error(`Expected 1 ${name}, got ${count}`);
  }
  const order = markers
    .map(([m, name]) => [name, n.indexOf(m) + 1])
    .sort((a, b) => a[1] - b[1])
    .map(([name, line]) => `${name}@line ${line}`);
  const expected = ['KS public pension', 'Batch B comment', 'wi-stat', 'irc-408 projection'];
  const actual = order.map((x) => x.split('@')[0]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Order wrong: ${actual.join(', ')}`);
  }

  const linesAfter = n.split('\n').length;
  return { c: n, fixResult: { linesBefore, linesAfter, order } };
}

function moveBatchBc(c) {
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
  const order = markers
    .map(([m, name]) => [name, n.indexOf(m) + 1])
    .sort((a, b) => a[1] - b[1])
    .map(([name, line]) => `${name}@line ${line}`);
  return { c: n, batchResult: { linesBefore, linesAfter, blockLines: block.split('\n').length, order } };
}

try {
  let c = fs.readFileSync(path, 'utf8');
  const { c: afterFix, fixResult } = fixMove(c);
  fs.writeFileSync(path, afterFix, 'utf8');
  console.log(JSON.stringify(fixResult, null, 2));

  c = fs.readFileSync(path, 'utf8');
  const { c: afterBatch, batchResult } = moveBatchBc(c);
  fs.writeFileSync(path, afterBatch, 'utf8');
  console.log(JSON.stringify(batchResult, null, 2));

  fs.writeFileSync('_move_stdout.txt', [
    JSON.stringify(fixResult, null, 2),
    JSON.stringify(batchResult, null, 2),
  ].join('\n'), 'utf8');
} catch (e) {
  const msg = e && e.stack ? e.stack : String(e);
  fs.writeFileSync('_move_stdout.txt', msg, 'utf8');
  console.error(msg);
  process.exit(1);
}
