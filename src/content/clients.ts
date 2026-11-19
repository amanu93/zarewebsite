/**
 * Clients for the trust strip.
 *
 * Every entry carries its engagement shape. A logo wall without context is the
 * oldest device in the outsourcing playbook and reads as aspirational: the
 * reader assumes a one-off, or a pitch that never closed. "Pickrell · 3-dev
 * pod · since Jan 2024" is a different claim entirely, and it is checkable.
 *
 * Clients whose engagement we cannot describe accurately are held in
 * `pendingClients` and not rendered. See docs/CONTENT-CHECKLIST.md
 */

export interface ClientRef {
  name: string;
  /** What Zare actually did. Never a capability, always the engagement. */
  engagement: string;
  /** Duration where known. The strongest single signal in this list. */
  duration?: string;
  industry: string;
  /**
   * Rendered on a white plate (profile rule: never knock a client's mark
   * out to teal or white — their brand, their colours). Optional: a missing
   * logo renders the text card unchanged, it is never faked.
   */
  logo?: string;
}

export const clients: ClientRef[] = [
  {
    name: 'Joveo',
    logo: '/clients/joveo.svg',
    engagement: 'Multi-tier engineering pod',
    duration: '12+ months',
    industry: 'Recruitment advertising',
  },
  {
    name: 'Pickrell Global Technologies',
    logo: '/clients/pickrell.png',
    engagement: 'Three-developer pod',
    duration: 'Since Jan 2024',
    industry: 'Technology services',
  },
  {
    name: 'Kagool',
    logo: '/clients/kagol.svg',
    engagement: '80+ technical placements in one month',
    industry: 'Technology consultancy',
  },
  {
    name: 'Exelia Technologies',
    logo: '/clients/exelia.png',
    engagement: 'Embedded product designer',
    industry: 'Technology',
  },
  {
    name: '251 Marketing & Communications',
    logo: '/clients/251-logo.png',
    engagement: 'Custom ERP and CRM platform',
    industry: 'Marketing',
  },
  {
    name: 'Medrafa',
    logo: '/clients/madrafa-logo.png',
    engagement: 'Pharmaceutical operations dashboard',
    industry: 'Pharmaceutical',
  },
  {
    name: 'KeySquare Labs',
    logo: '/clients/keysquare.png',
    engagement: 'Custom geospatial processing tool',
    industry: 'Geospatial',
  },
  {
    name: 'AFIG Funds',
    logo: '/clients/afig-funds.png',
    engagement: 'Technology consulting programme',
    industry: 'Private equity',
  },
  {
    name: 'Africa Communications Media Group',
    logo: '/clients/acmg.png',
    engagement: 'Pan-African media database',
    industry: 'Communications',
  },
  {
    name: 'CRDLE',
    logo: '/clients/crdle.png',
    engagement: 'Managed customer support team',
    industry: 'Technology',
  },
  {
    name: '10.13 Enterprise',
    logo: '/clients/10-13.png',
    engagement: 'Embedded back-office specialist',
    industry: 'Professional services',
  },
  {
    name: 'Tenasol',
    logo: '/clients/tenasol.avif',
    engagement: 'Clinical platform design, then embedded designer',
    industry: 'Healthcare data',
  },
  {
    name: 'KEFI Gold & Copper',
    logo: '/clients/KEFI.png',
    engagement: 'Research and technology support',
    industry: 'Mining',
  },
];

/**
 * Real clients whose engagement shape is not documented well enough to state.
 * Held out of the render rather than listed as a bare name.
 *
 * Tenasol and KEFI Gold & Copper were held here until the Company Profile
 * 2026 documented both engagements; promoted above.
 */
export const pendingClients = [] as const;

/**
 * The trust strip's logo wall: the six marks with the most recognition
 * weight, logo-only (the engagement-shaped card list above remains the
 * data of record; sections that need context still read `clients`).
 * Assets live under /clients/ — public/our-work is shadowed by the
 * /our-work/:path* redirect and must not be referenced.
 *
 * `h` is the render height in px, set PER MARK to equalise visual
 * weight: a uniform height cap makes stacked marks (Mastercard AGF,
 * aspect 1.5) read half the size of wide wordmarks (Joveo, aspect 2.9).
 * Heights approximate equal area (h ≈ √(target/aspect)) and were
 * eyeballed from there.
 */
export const logoWall = [
  { name: 'AFIG Funds', src: '/clients/afig-funds.png', h: 52 },
  { name: 'Mastercard Africa Growth Fund', src: '/clients/africa-growth-fund.svg', h: 68 },
  { name: 'Joveo', src: '/clients/joveo.svg', h: 50 },
  { name: 'Africa Communications Media Group', src: '/clients/acmg.png', h: 52 },
  { name: 'Exelia Technologies', src: '/clients/exelia.png', h: 58 },
  { name: 'KEFI Gold & Copper', src: '/clients/KEFI.png', h: 58 },
] as const;

/**
 * The marquee below the wall: every remaining client with a mark on
 * file. Quieter and smaller than
 * the six-up wall — a moving undercurrent, not a second headline.
 */
export const logoMarquee = [
  { name: 'Pickrell Global Technologies', src: '/clients/pickrell.png' },
  { name: 'Kagool', src: '/clients/kagol.svg' },
  { name: '251 Marketing & Communications', src: '/clients/251-logo.png' },
  { name: 'Medrafa', src: '/clients/madrafa-logo.png' },
  { name: 'KeySquare Labs', src: '/clients/keysquare.png' },
  { name: 'CRDLE', src: '/clients/crdle.png' },
  { name: '10.13 Enterprise', src: '/clients/10-13.png' },
  { name: 'Tenasol', src: '/clients/tenasol.avif' },
] as const;

export interface VerifiedFact {
  fact: string;
  /** Where a reader can check it. Absent means not yet linkable. */
  href?: string;
}

export const verifiedFacts: VerifiedFact[] = [
  { fact: 'Zare Innovations, LLC · Delaware, US' },
  { fact: 'Engineering centre · Addis Ababa, Ethiopia' },
  // US, Cyprus, UK, Kenya, South Africa, Senegal, Ethiopia — the Company
  // Profile 2026 enumeration.
  { fact: '7 countries served' },
  // Linked, so the rating is evidence rather than assertion.
  {
    fact: '5.0 rating on Clutch',
    href: 'https://clutch.co/profile/zare-innovations',
  },
];
