/**
 * 26 CFR 1.401(a)(9)-9(d) Table 3 (Joint and Last Survivor Table).
 *
 * Source: https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9, Table 3.
 * Effective for RMD distribution years 2022+; extracted 2026-06-29.
 * Rows are owner ages 72-120+; columns are spouse ages 0-120+.
 *
 * Stored delta-packed and decoded once, at module load. Every entry is a whole
 * number of tenths, and along a row (spouse age ascending) it never rises and
 * never falls by more than 1.0. So each row is its spouse-age-0 divisor in
 * tenths, then one letter per later spouse age for the tenths the divisor
 * falls there: 'a' = 0.0, 'b' = 0.1, ... 'k' = 1.0. Decoding divides a whole
 * count of tenths by 10, which is the correctly rounded double of the
 * one-decimal published figure, so the decoded table is the extract value for
 * value. The encoding is lossless: jointLifeTable.test.ts compares every
 * decoded row with the literal extract (jointLifeTable.literal.test-support.ts)
 * and every (owner, spouse) age pair the lookup can see, by Object.is. It keeps
 * ~40 KiB of number literals out of each bundle graph that ships the engine.
 */

const MIN_TABLE_AGE = 0
const MAX_TABLE_AGE = 120

/** [owner age, spouse-age-0 divisor in tenths, one letter per later spouse age: 'a' + tenths it falls]. */
const TABLE_II_PACKED: readonly (readonly [ownerAge: number, firstTenths: number, drops: string])[] = [
  [72, 847, 'jkkjkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjjkjkjkjjkjjjjjjjjijiiiiiihhhhhggggfgfefededdcdcccbbcbbabbabaaabaaaaaabaaaaaaaaaaaaaaaa'],
  [73, 846, 'ikkkjkkkkkkjkkkkjkkkjkkkjkjkkjkjkjkjkjkjjkjjjkjjjjijjiijiihihhhhhggggfgfeeeeedcdccccbcbbbabbabaaabaaaaaaaaaabaaaaaaaaaaa'],
  [74, 846, 'ikkkjkkkkkkjkkkkkjkkkjkkjkkjkjkjkjkjkjkjkjjkjjjjjjjjjijiiiiihhihghggggfgefeeeddddcccbcbbbbabbaabaabaaaaaaaaaaaaaaaabaaaa'],
  [75, 846, 'ikkkjkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkjkjjkjjkjjjjjjijijiiiiihhihghggggffffeededcdcccbcbbbbabababaaaabaaaaaaaaaaaaaaaaba'],
  [76, 846, 'ikkkjkkkkkkkjkkkkjkkkjkkkjkjkkjkjkjkjkjkjkjjkjjjkjjijjijiiiiiihhihghggggfffeeeedddccccbcbbbabbabaaabaaaaaaaaaaaaabaaaaaa'],
  [77, 846, 'ikkkkjkkkkkkjkkkkkjkkkjkkjkkjkjkjkjkjkjkjkjkjjkjjjjjjjijiijihiihhighhggggffefeeddddccccbbbbbbbabaabaaaaabaaaaaaaaaaaaaab'],
  [78, 846, 'ikkkkjkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkjkjkjjkjjjkjjijjjiijiihiihhhhhhgggffffeeeddddcccbcbbbbabbaabaaaabaaaaaaaaaaaaabaa'],
  [79, 846, 'ikkkkjkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkjkjkjkjjkjjjjjjjijiijiihiihhhhhgggggffeeeeddddccbcbbbbbbabaabaaabaaaaaaaaaaaaabaa'],
  [80, 846, 'ikkkkjkkkkkkkjkkkkjkkkkjkkjkjkkjkjkjkjkjkkjjkjkjjjkjjijjijiijiihihihhhghgggfffefdedddccccbbcabbbabaabaaaaaaabaaaaaaaaaba'],
  [81, 846, 'ikkkkjkkkkkkkjkkkkkjkkkjkkjkjkkjkjkjkkjkjkjkjkjjkjjjjjjijjiiijihiihhihghghfgfffeeeeddcccccbbbbbbababaabaaaaaaaaaaaabaaab'],
  [82, 846, 'ikkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkjkkjkjkjkjkjjkjjjjjjjjijiiiiiiihihhhhghggffffeeedddcccccbbbbbabbaabaaaaaaaaaabaaaaaba'],
  [83, 846, 'jjkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkjkjkjkjkjjkjjjjijjijiiiiiihihihhghgggffffeeddddccccbcbbabbabaabaaaaaaaaabaaaabaa'],
  [84, 846, 'jjkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkjkkjkjjkjkjjjjjjjijiijiiiihihihhhhggggfffeeeddddcccbcbbbbababaabaaaaaaaaaabaaaba'],
  [85, 846, 'jjkkkkjkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkkjkjkjkjjkjjjjjjjjijiiijihiihihhhhhggggffeeeedddccccbcbbbabbaabaaaaaabaaaaaabaab'],
  [86, 846, 'jjkkkkjkkkkkkkjkkkkjkkkkjkkjkjkjkkjkjkkjkjkjkjkjkjjjkjjijjjiijiiiiiihihihhghgggfffeeedecdccccbbbbbbbaabaaaabaaaaaaabaaba'],
  [87, 846, 'jjkkkkjkkkkkkkjkkkkkjkkkjkkjkjkkjkjkjkkjkjkjkjkjkjjkjjjjjijijiijiiihiihihhhghggffffeeedddccccbcbbbbababaaaaaaabaaaaababa'],
  [88, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkjkkjkjkjkkjkjkjkkjjkjkjjjjjjjijijiiiiiiiihihhhhggggffffededdcdccbcbbbbabbaabaaaaaaaaabaabba'],
  [89, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkjkkjkjkjkkjkjkkjkjkjjkjjjjjjjijjiiijiiihiihihhhghggffffeeeddcdcccbcbbbabbaabaaaaaaabaaababb'],
  [90, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkjkkjkjkkjkjkjkkjkjkjjkjjjjjjjjijijiiiiiiihihihhghgggfffeeeddddccccbbbbbbababaaaaaaaabaabbab'],
  [91, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkjkkjkjkjkjjjkjjijjijijiiiiiiiiihhihghggggffeeeeddcdcccbbcbbababaaabaaaaaabababb'],
  [92, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjjjkjjjijjijiijiiiiihiihhhhhghfgfffeeedddcdcbcbcbbbababaaaaaaabaababbb'],
  [93, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjjkjjjjijjijijiiiiiiiihihhhhgggggfefeeddddccccbbcbbababaaaaaaabaababbb'],
  [94, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjjkjjjjjijjiijiiiiiiiiihhihghggggffeeeedddcccccbbbbbbaabaaaaaabaababbb'],
  [95, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjjkjjjjjijjijiiiiijihiihihhhhggggffefededcdccccbcbbbabaaabaaaaabaabbbb'],
  [96, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjkjjjjjjjijijiiijiiiihiihihhghggfgfefeeddddccccbcbbbababaaaaaabaabbbbb'],
  [97, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjkjjjjjjjijijiijiiiiiihiihhhhgggggfefeedddddcccbcbbbbabaaaaaabaaabbbbc'],
  [98, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjkjjjjjjjijijijiiiiiiiihihhhhhgggffffeededcdccccbcbbababaaaaabaaabbbcb'],
  [99, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkjkjkjkjjjjjjjijjiijiiiiiiiiihhihghghfgfffeededdcdccbcbbbbbaabaaaaabaabbbcb'],
  [100, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkkjkjjkjjjjjjjjijiijiiiiiiiiihihhhghggfgfeeeeeddcdcccbbcbbabaaaabaaaabbaccb'],
  [101, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkkjkjjkjjjjjjjjijiijiiiiiiiiihihhhhggggfffeeededcdcccbcbbbbaabaaaaaababbbcc'],
  [102, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkjkkjkjkkjkjkkjkjjkjjjjjjjjijijiiiiijihiiihhhhhghfgffffededdddcccbcbbbbabaaaaaabaabbccb'],
  [103, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkkjkjkkjkjjkjjjjjjjjijijiiiijiihiiihhhhhhggfgffeeededdccdbccbbbbabaaaaaabaabbccc'],
  [104, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkjkkjkjkkjkjjkjjjjjjjjijijiiiijiiihiihhihghgggfffeeeeddddccccbcbbabaabaaaaababbccc'],
  [105, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiiijiiihiihihhghgggffffeededcdcdbccbbbbbaaaaabaaabbbbcd'],
  [106, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiiijiiihiihihhghgggffffeededdcdccbcbcbabaabaaaaababbccc'],
  [107, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiiijiiihiihihhghgggffffeededdcdcccbcbbababaaaaabaabbccc'],
  [108, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiiijiiihiihihhghgggfgefeeeddddccccbcbbbabaaaaabaababccd'],
  [109, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihihihhhggggfgefeeeddddccccbcbbbabaaaaabaabacbcd'],
  [110, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihihihhhgggggfefeeeddddcccccbbbbabaaaabaaabbbbdc'],
  [111, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihihihhhgggggffeeeeddddcccccbbbbbaaaabaaababbccc'],
  [112, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihihihhhgggggffeeeeddddcdcbcbbbbbaabaaaaababbccc'],
  [113, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihihihhhghgfgffefdeeddcdcccbbcbababaaaaabaabbccd'],
  [114, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihiihhhhghgfgffefededddccccbcbbbabaaaabaaabbbbdc'],
  [115, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiihiihhhhghggffffeeeddddcccccbbbbbaabaaaaababbccd'],
  [116, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiiijiiiiiihihhhhhgggfgefeeeeddcdccccbbbbbaaaabaaababbccc'],
  [117, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijijiijiiiiiiihihhhhhggggffefeedddddcccbcbbbbaaabaaaababbccd'],
  [118, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjijjiiijiiiiiiihihihghghfgfffefdeddddccccbcbbabaaaabaaabbbccd'],
  [119, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjjjjjjjijiiijiiiiiiiihhihhghggfgffeeeeddddcdccbcbbabaaabaaababbcec'],
  [120, 846, 'jjkkkkjkkkkkkkkjkkkkjkkkjkkjkkjkjkkjkjkkjkjkjkkjkjjkjjjkijjjjijiijiiiiiiiiihihhhhggggffffeeedddddccccbcbbaabaaaababaccdb'],
]

const LETTER_A = 97

function decodeRow(firstTenths: number, drops: string): readonly number[] {
  const row = [firstTenths / 10]
  let tenths = firstTenths
  for (let i = 0; i < drops.length; i++) {
    tenths -= drops.charCodeAt(i) - LETTER_A
    row.push(tenths / 10)
  }
  return row
}

const TABLE_II_BY_OWNER_AGE: Readonly<Record<number, readonly number[]>> = Object.fromEntries(
  TABLE_II_PACKED.map(([ownerAge, firstTenths, drops]) => [ownerAge, decodeRow(firstTenths, drops)]),
)

function tableAge(age: number): number | null {
  if (!Number.isFinite(age)) return null
  const wholeAge = Math.floor(age)
  if (wholeAge < MIN_TABLE_AGE) return null
  return Math.min(wholeAge, MAX_TABLE_AGE)
}

export function jointLifeTableDivisor(ownerAge: number, spouseAge: number): number | undefined {
  const ownerTableAge = tableAge(ownerAge)
  const spouseTableAge = tableAge(spouseAge)
  if (ownerTableAge === null || spouseTableAge === null) return undefined
  return TABLE_II_BY_OWNER_AGE[ownerTableAge]?.[spouseTableAge - MIN_TABLE_AGE]
}
