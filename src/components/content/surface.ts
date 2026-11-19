/**
 * Shared card surface styling.
 *
 * Deliberately NOT a component. There is no `<Card>` in this system: a card is
 * a visual similarity, not a business concept, and exporting one invites
 * `<Card variant="premium">` six months from now. Components that represent
 * something real, such as CaseStudyCard and PersonCard, import these strings
 * and own their own structure.
 *
 * See docs/decisions/004-no-generic-design-system-components.md
 */

/** Bordered panel that inherits the surrounding tone's hairline colour. */
export const panelSurface =
  'border border-[var(--rule-color)] bg-transparent';

/** Adds the hover affordance used by cards that are entirely one link. */
export const linkSurface =
  'transition-colors duration-150 hover:border-accent focus-visible:border-accent';

/**
 * The profile's featured treatment (Company Profile 2026, V4 deck): gradient
 * fill, strong border, inward glow. EXACTLY ONE per view — it marks the
 * payoff, and two payoffs on screen means neither is. Dark tones only.
 * Recipe lives in globals.css.
 */
export const highlightSurface = 'surface-highlight';

/**
 * Hairline for content that is not brand-owned — client logo tiles,
 * portfolio cards — so the teal hairline keeps meaning. Dark tones only.
 */
export const neutralSurface =
  'border border-rule-neutral bg-transparent';

/**
 * Client logos always sit on a white plate (globals.css). Never knock a
 * client's mark out to teal or white; their brand, their colours.
 */
export const logoPlate = 'logo-plate';
