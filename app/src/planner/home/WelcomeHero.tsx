type WelcomeHeroProps = {
  onTryExample: () => void
  onDismiss?: () => void
  showDismiss?: boolean
  headingLevel?: 'h1' | 'h2'
}

export function WelcomeHero({
  onTryExample,
  onDismiss,
  showDismiss = false,
  headingLevel = 'h1',
}: WelcomeHeroProps) {
  const Heading = headingLevel
  return (
    <section className="home-hero" aria-labelledby="home-hero-heading">
      <Heading id="home-hero-heading">Plan your retirement — privately, in your browser</Heading>
      <p className="home-hero-subhead lede">
        Model your household, stress-test taxes and withdrawals, and explore scenarios — with no account and no data
        leaving this device.
      </p>
      <ul className="trust-chips" aria-label="Why RetireGolden">
        <li>No accounts</li>
        <li>Nothing leaves your device</li>
        <li>Educational, with sources</li>
      </ul>
      <div className="home-hero-cta">
        <button type="button" className="btn btn-primary" onClick={onTryExample}>
          Try an example
        </button>
        {showDismiss && onDismiss ? (
          <button type="button" className="btn btn-ghost btn-small" onClick={onDismiss}>
            Hide getting started
          </button>
        ) : null}
      </div>
    </section>
  )
}
