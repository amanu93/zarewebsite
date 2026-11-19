/**
 * The people, and why they stay.
 *
 * Names and roles follow the official Company Profile 2026
 * (docs/zare-company-profile, leader-approved PDF). Everything that is not
 * yet confirmed is represented as an explicit absence rather than filled in:
 *
 *   founder quote   marked [QUOTE PENDING FOUNDER APPROVAL] in source, so
 *                   `approved: false` and the section renders without it
 *   linkedin        source has the literal placeholder [LINK], so omitted
 *   photography     the official portraits from the Company Profile 2026
 *                   shoot (public/people, sourced from the leaders' own
 *                   profile deck)
 *   engineers       no consent yet, so none are named
 *
 * See docs/CONTENT-CHECKLIST.md items 2, 14, 15, 16.
 */

export interface Person {
  name: string;
  role: string;
  /** Omitted until real URLs exist. The source carries a [LINK] placeholder. */
  linkedin?: string;
  photo?: { src: string; alt: string };
}

// Title per the official 2026 profile, which credits "CEO" (the V4 deck's
// "Co-Founder & CEO" was not carried into the approved PDF).
export const founder: Person = {
  name: 'Emanuel Nebiyu Samuel',
  role: 'CEO',
  photo: { src: '/people/emanuel.jpeg', alt: 'Emanuel Nebiyu Samuel' },
};

/**
 * Renders only when `approved` is true. A quote awaiting sign-off is the one
 * thing on this page that must not appear early: it is attributed to a real
 * person who has not yet agreed to it.
 */
export const founderQuote = {
  text: 'We believe Africa should not only participate in the future of technology. We should help build it.',
  approved: false,
};

export const leadership: Person[] = [
  // CRO per the 2026 profile; earlier site copy carried the outdated "CTO".
  {
    name: 'Nathnael Gebreselassie',
    role: 'CRO · Sales & Business Development',
    photo: { src: '/people/nathnael.png', alt: 'Nathnael Gebreselassie' },
  },
  {
    name: 'Michael Wondimu',
    role: 'COO',
    photo: { src: '/people/michael.jpeg', alt: 'Michael Wondimu' },
  },
  {
    name: 'Addis Alemayehou',
    role: 'Strategy Advisor',
    photo: { src: '/people/addis.png', alt: 'Addis Alemayehou' },
  },
];

/**
 * The retention mechanism, stated as economics rather than as a benefit.
 *
 * This is the reframe the whole section exists to carry: the wage floor is not
 * a perk, it is the reason engagements last, and long engagements are what
 * clients are actually buying. Verified figure.
 */
export const WAGE_FLOOR = {
  value: '+50%',
  label: "Minimum above Ethiopia's national average salary",
  detail: 'for every person on our roster',
};

/**
 * Whether engineers can be named publicly is a founder decision with a real
 * tradeoff: a named engineer with their stack and tenure is the strongest
 * proof available and also the most useful thing a recruiter could ask for.
 * Until it is made, the absence is labelled.
 */
export const ENGINEERS_PENDING = true;
