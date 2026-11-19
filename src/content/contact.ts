import type { Pathway } from '@/lib/inquiry-schema';

export interface PathwayCopy {
  id: Pathway;
  tab: string;
  headline: string;
  description: string;
  submit: string;
}

export const pathways: Record<Pathway, PathwayCopy> = {
  project: {
    id: 'project',
    tab: 'Start a project',
    headline: 'Tell us what you are building.',
    description:
      'Software, AI, or a digital product engineered end to end by our Addis Ababa engineering centre.',
    submit: 'Send project inquiry',
  },
  team: {
    id: 'team',
    tab: 'Build an embedded team',
    headline: 'Tell us who you need.',
    description:
      'Vetted engineers or a managed operations team, working inside your workflow. One monthly invoice, all-in, with a risk-free trial on every placement.',
    submit: 'Send team inquiry',
  },
};

/**
 * The three steps after submit.
 *
 * Buyers hesitate at unknown process far more than at price. Naming what
 * happens, and committing to a reply window, removes the black-hole fear that
 * stops a form being sent at all.
 */
export const whatHappensNext = [
  {
    n: '01',
    title: 'You send the details',
    body: 'Six fields. Nothing we do not need in order to reply usefully.',
  },
  {
    n: '02',
    title: 'We reply within one business day',
    body: 'A real answer from someone who has read it, not an autoresponder.',
  },
  {
    n: '03',
    title: 'A 30-minute scoping call',
    body: 'With the people who would do the work. No sales layer in between.',
  },
] as const;

export const RESPONSE_PROMISE = 'We reply within one business day.';

/**
 * The profile's closing offer, verbatim (Company Profile 2026, p13). It
 * de-risks the first message the same way the trial de-risks the first
 * placement: a named, bounded, free step.
 */
export const OPENING_OFFER =
  'If there is a role you cannot fill or a system you need built, the first conversation is 30 minutes and costs nothing.';
