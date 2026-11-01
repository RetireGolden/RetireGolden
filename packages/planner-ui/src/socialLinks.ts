/**
 * Canonical outbound profiles for the free-app footer. One list: the shell
 * renders this and nothing else. Approved set is YouTube, X, LinkedIn,
 * Facebook, and Reddit.
 */
export interface SocialLink {
  /** Visible name. Also the start of the link's accessible label. */
  label: string
  /** Canonical profile URL. */
  href: string
}

export const SOCIAL_LINKS = [
  { label: 'YouTube', href: 'https://www.youtube.com/@RetireGolden' },
  { label: 'X', href: 'https://x.com/RetireGoldenLLC' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/retiregolden/' },
  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591546122081' },
  { label: 'Reddit', href: 'https://www.reddit.com/r/retiregolden' },
] as const satisfies readonly SocialLink[]
