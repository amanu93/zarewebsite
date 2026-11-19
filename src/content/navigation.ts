/**
 * The header's information architecture. Single source for both the desktop
 * panel system and the mobile accordion.
 *
 * Every subtitle here is verbatim copy that already exists elsewhere in the
 * repo (imported where a stable export exists, duplicated with a pointer
 * where the source is page JSX). The navigation may anticipate the future —
 * the service items deliberately live behind one `href` each so a dedicated
 * detail page can replace an anchor without touching the header — but it
 * never claims a destination that does not exist.
 *
 * Two panel groups — the offering (What we do) and the entity (Company) —
 * then two PLAIN LINKS, Work and the Scale Challenge: the proof and the
 * game each need one click, not a submenu. The CTA slot is the commercial
 * ask, 'Build with Zare'. See the 2026-08-15 header audit for the panel
 * reasoning, and NAV_CHALLENGE / NAV_CTA below for the copy.
 */

import { SCALE_CHALLENGE_ENABLED } from '@/constants';
import { servicePaths } from '@/content/services';
import { ABOUT_KICKER } from '@/content/about';
import { RESPONSE_PROMISE } from '@/content/contact';

export interface NavItem {
  title: string;
  subtitle: string;
  href: string;
  /** Renders with the site's single highlight treatment — reserve for the
   *  one genuinely distinctive destination per panel. */
  cta?: boolean;
}

export interface NavGroup {
  key: 'what' | 'work' | 'company';
  label: string;
  /** Mono eyebrow line inside the panel. */
  intro: string;
  items: NavItem[];
  /** Optional emphasized row at the panel's foot. */
  featured?: NavItem;
}

const clip = (s: string, n: number) =>
  s.length > n ? s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:]$/, '') + '…' : s;

/** The two engines from services.ts, plus the two homepage sections that
 *  answer the questions a buyer asks next. Anchor hrefs are honest: no
 *  dedicated service pages exist yet; when they do, only this file changes. */
const whatWeDo: NavGroup = {
  key: 'what',
  label: 'What we do',
  intro: 'Two engines, one firm',
  items: [
    ...servicePaths.map((p) => ({
      title: p.name,
      subtitle: p.headline,
      href: `/#${p.id}`,
    })),
    {
      title: 'How we work',
      // services.ts embedded definition, the sentence that defines the model.
      subtitle: 'Your Slack, your standups, your codebase, your roadmap.',
      // The delivery story lives in #how-we-deliver (three tracks, the
      // seven-week timeline); #working-model is the timezone band.
      href: '/#how-we-deliver',
    },
    {
      title: 'Security & IP',
      // security.ts lead + the delivery diagram's contract line.
      subtitle: 'Contracts under Delaware law. Full IP assignment.',
      href: '/#security',
    },
  ],
};

const company: NavGroup = {
  key: 'company',
  label: 'Company',
  intro: 'Delaware · Addis Ababa',
  items: [
    {
      title: 'About',
      subtitle: clip(ABOUT_KICKER, 72),
      href: '/about',
    },
    {
      title: 'Careers',
      // careers/page.tsx hero copy, trimmed.
      subtitle: 'Engineers, designers, and operators in Addis Ababa.',
      href: '/careers',
    },
    {
      title: 'FAQs',
      // faq/page.tsx h1.
      subtitle: 'The questions worth asking first.',
      href: '/faq',
    },
    { title: 'Contact', subtitle: RESPONSE_PROMISE, href: '/contact' },
  ],
};

export const navGroups: NavGroup[] = [whatWeDo, company];

/** The proof, one click away — no panel. Sits after the groups. */
export const NAV_WORK = {
  key: 'work',
  label: 'Work',
  href: '/work',
} as const;

/** The Scale Challenge — the OUTLINED half of the header's button pair,
 *  phrased as an invitation rather than a title: 'Scale Challenge' names a
 *  page, 'Try our Scale Challenge' asks for the click. Null while the
 *  challenge is hidden, which is what removes the button from both the
 *  desktop bar and the mobile menu. */
export const NAV_CHALLENGE: { label: string; href: string } | null =
  SCALE_CHALLENGE_ENABLED
    ? { label: 'Try our Scale Challenge', href: '/scale-challenge' }
    : null;

/** The commercial ask, and the FILLED half of the pair — the first call
 *  to action carries the weight. 'Build with Zare' rather than 'Contact'
 *  because the button should name the outcome, not the form. */
export const NAV_CTA: { label: string; href: string } = {
  label: 'Build with Zare',
  href: '/contact',
};
