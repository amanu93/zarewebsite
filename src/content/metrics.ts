/**
 * The results band that closes the featured-work section.
 *
 * Replaced in the 2026-08 leadership comment round with the profile
 * deck's three at-a-glance figures — big display numbers, sentence-case
 * descriptions, the cost figure carrying the accent and its basis
 * ("while exceeding performance standards") stated with it.
 */

export interface ResultMetric {
  value: string;
  label: string;
  verified: boolean;
  /** Renders the value in the accent — one per band at most. */
  accent?: boolean;
  note?: string;
}

export const results: ResultMetric[] = [
  {
    value: '40+',
    label: 'jobs created locally',
    verified: true,
  },
  {
    value: '20+',
    label: 'clients across the US, Europe, and Africa',
    verified: true,
  },
  {
    value: '50%+',
    label:
      'cost savings for US engineering companies, while exceeding performance standards',
    verified: true,
    accent: true,
  },
];
