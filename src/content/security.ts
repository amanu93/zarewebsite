/**
 * Security, IP and contractual position.
 *
 * Every line here is transcribed from the approved copy in
 * docs/zare-website-v3. Nothing is inferred, softened or extended. The
 * ROADMAP column exists specifically so that things Zare does NOT yet have
 * are stated as such rather than omitted and left to be assumed.
 *
 * The closing note is the most important sentence in this section and
 * possibly on the site: admitting a boundary buys more trust than a wall of
 * certification badges, and it is the one thing a competitor copying this
 * page would not think to include.
 */

export interface SecurityColumn {
  tag: string;
  items: readonly { lead: string; rest: string }[];
}

export const securityColumns: SecurityColumn[] = [
  {
    tag: 'Practised today',
    items: [
      {
        lead: 'Access-controlled delivery:',
        rest: 'your infrastructure, your permissions.',
      },
      { lead: 'Role-based permissions', rest: 'on every engagement.' },
      { lead: 'Encrypted communication', rest: 'and secure cloud tooling.' },
      {
        lead: 'NDA on day one,',
        rest: 'before any code or data is shared.',
      },
      {
        lead: 'Employee confidentiality',
        rest: 'agreements across the roster.',
      },
      {
        lead: 'Monitoring and backup',
        rest: 'procedures on managed systems.',
      },
    ],
  },
  {
    tag: 'Contractual',
    items: [
      {
        lead: 'Contracts under Delaware law.',
        rest: 'Zare Innovations, LLC is a US legal entity.',
      },
      {
        lead: 'Full IP assignment',
        rest: 'on all work product, in every contract.',
      },
      {
        lead: 'Dedicated placements,',
        rest: 'never shared across clients.',
      },
      {
        lead: 'Service-level agreements',
        rest: 'on managed engagements.',
      },
    ],
  },
  {
    tag: 'Roadmap',
    items: [
      {
        lead: 'Formal certifications:',
        rest: 'published here as they are pursued and earned.',
      },
      {
        lead: 'Data residency options',
        rest: 'under evaluation for regulated clients.',
      },
    ],
  },
];

export const SECURITY_NOTE =
  'No badges before they are real. Current status available on request.';

/**
 * Offered rather than published. A vendor file usually needs a reference call,
 * and saying so removes a step from procurement without claiming anything.
 */
export const REFERENCES_NOTE = 'References available on request.';
