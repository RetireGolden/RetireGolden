export interface SocialSecurityDob {
  readonly dob: string
}

/**
 * Parse the validated ISO civil date used by annual Social Security consumers.
 * Keeping this byte-level parse shared prevents the projection and milestone
 * detector from drifting onto different date semantics.
 */
export function socialSecurityDobParts(
  person: Readonly<SocialSecurityDob>,
): { y: number; m: number; d: number } {
  return {
    y: Number(person.dob.slice(0, 4)),
    m: Number(person.dob.slice(5, 7)),
    d: Number(person.dob.slice(8, 10)),
  }
}
