import { SOCIAL_LINKS } from './socialLinks.ts'

/** Quiet footer row of the free app's outbound profiles. */
export function SocialLinks() {
  return (
    <nav className="app-footer-social small" aria-label="Social media">
      <ul>
        {SOCIAL_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} (opens in a new tab)`}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
