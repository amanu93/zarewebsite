/**
 * The /about page. Single source: the Company Profile 2026
 * (docs/zare-company-profile — the leader-approved PDF and its deck). Every
 * paragraph here is that document's copy, verbatim or lightly fitted for the
 * page; nothing is invented. When the profile is revised, this file is where
 * the site absorbs it.
 */

/** The profile's cover tagline. The homepage hero keeps its own line by
 *  decision; this page is where the official positioning leads. */
export const ABOUT_TAGLINE =
  'AI without people fails. Teams without AI fall behind.';

export const ABOUT_KICKER =
  'Production software, AI, and vetted talent. Proven to meet high global standards.';

/** "Who we are", verbatim from the profile. */
export const narrative: readonly string[] = [
  'Zare Innovations is a software and AI engineering firm with teams across Delaware, USA and Addis Ababa, Ethiopia. We design, build, and ship production-grade software and multi-agent AI systems, and we source, vet, and place talent at every level for engineering, design, AI, customer support, and back office work.',
  'Our talent and operations base in Addis Ababa is where we recruit and vet for every service line. Our talent is strictly vetted to high global standards, regardless of level: the engineer, designer, or specialist we place on your team is the person we hired and vetted. Every Embedded Talent engagement begins with a risk-free trial period — if the placement is not the right fit for your team, we find a replacement, and you pay nothing.',
];

/** The at-a-glance strip. The homepage metrics band answers speed, staying
 *  power, and reach; these are the company-shape numbers, and this page is
 *  their home. */
export interface GlanceStat {
  value: string;
  label: string;
  /** Where a reader can check it. */
  href?: string;
}

export const atAGlance: readonly GlanceStat[] = [
  { value: '40+', label: 'Engineers and specialists' },
  { value: '20+', label: 'Clients across the US, Europe, and Africa' },
  { value: '2', label: 'Years in operation' },
  { value: '4', label: 'Service lines across two engines' },
  {
    value: '5.0',
    label: 'Clutch rating, February 2025',
    href: 'https://clutch.co/profile/zare-innovations',
  },
];

/** The delivery structure: two nodes, one team. */
export interface DeliveryNode {
  label: string;
  place: string;
  role: string;
  detail: string;
}

export const deliveryNodes: readonly DeliveryNode[] = [
  {
    label: 'US · Delaware',
    place: 'Middletown, Delaware',
    role: 'Strategic governance',
    detail:
      'US contracts, IP ownership, account management, and client success. Zare Innovations, LLC is a Delaware registered corporation; contracts run under Delaware law.',
  },
  {
    label: 'ET · Addis Ababa',
    place: 'Addis Ababa, Ethiopia',
    role: 'Engineering and talent hub',
    detail:
      'Engineering, AI, design, and operations talent — recruited, vetted, and managed in-house. Every service line hires from here, against the same bar.',
  },
];

/** The four "Why Zare" pillars, from the profile. */
export interface Pillar {
  n: string;
  title: string;
  body: string;
}

export const pillars: readonly Pillar[] = [
  {
    n: '01',
    title: 'International engineering standards',
    body: 'Our process, code quality, security posture, and delivery rigor match what a top firm in San Francisco or New York would ship. Benchmarked, not declared.',
  },
  {
    n: '02',
    title: 'Trusted globally',
    body: 'Delivered for Mastercard Africa Growth Fund, AFIG Funds, Joveo, KEFI Gold & Copper, Tenasol, Exelia Technologies, and others — across the United States, Cyprus, the UK, Kenya, South Africa, Senegal, and Ethiopia.',
  },
  {
    n: '03',
    title: 'Risk-free embedded trial',
    body: 'Every placement starts with a trial: two weeks for individual contributors, three to four for senior roles. Wrong fit, no invoice. We take the placement risk so you do not have to.',
  },
  {
    n: '04',
    title: 'Multi-level talent, strictly vetted',
    body: 'We match the level to the engagement, not the other way around — and every person on our roster earns at least 50 percent above Ethiopia\'s national average salary. Retention on both sides is the point.',
  },
];
