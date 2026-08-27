const fs = require('fs');
const path = 'packages/engine/src/rules/taxRuleRegistry.ts';
let c = fs.readFileSync(path, 'utf8');
const linesBefore = c.split('\n').length;

const LA2 = "  'la-rs-47-44-2-social-security-federal-retirement': {";
const RI = "  'ri-gen-laws-44-30-12-social-security-and-pension-modification': {";
const WI = "  'wi-stat-71-05-retirement-income-subtraction': {";
const IRC = "  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {";
const MD = "  'md-tax-10-207-social-security-exclusion': {";
const OR = "  'or-stat-316-054-social-security-exclusion': {";
const SAT = "// `satisfies` without `as const`:";

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

fs.writeFileSync(path, n, 'utf8');
const linesAfter = n.split('\n').length;
console.log(JSON.stringify({ linesBefore, linesAfter, order }, null, 2));
