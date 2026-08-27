const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'packages/engine/src/rules/taxRuleRegistry.ts');
let c = fs.readFileSync(file, 'utf8');
const linesBefore = c.split('\n').length;

const WI = "  'wi-stat-71-05-retirement-income-subtraction': {";
const MD = "  'md-tax-10-207-social-security-exclusion': {";
const UT = "  'ut-code-59-10-114-social-security-tax-credit': {";
const SAT = "// `satisfies` without `as const`:";

const wiIdx = c.indexOf(WI);
if (wiIdx < 0) throw new Error('wi not found');

const mdIdx = c.indexOf(MD, wiIdx);
if (mdIdx < 0) throw new Error('old md block not found after wi/irc');

const utIdx = c.indexOf(UT, mdIdx);
if (utIdx < 0) throw new Error('ut not found in old block');

const utClose = c.indexOf('  },\n', utIdx + UT.length);
if (utClose < 0) throw new Error('ut close not found');
const blockEnd = utClose + 5;

const block = c.slice(mdIdx, blockEnd);
const n = c.slice(0, wiIdx) + block + c.slice(wiIdx, mdIdx) + c.slice(blockEnd);

if (n.length <= c.length) throw new Error('unexpected length shrink');

fs.writeFileSync(file, n, 'utf8');
console.log(JSON.stringify({ linesBefore, linesAfter: n.split('\n').length, movedChars: block.length }, null, 2));
