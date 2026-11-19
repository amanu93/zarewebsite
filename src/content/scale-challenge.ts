/**
 * The Scale Challenge — game data.
 * Source: docs/scale-challenge-ui-mockups — the v3 mockup and the
 * claude-code-prompt.md spec beside it, which the CTO signed off. Talent
 * numbers, missions and events are verbatim from that spec; stats are /100
 * and monthly is USD.
 *
 * COLOUR IS THE ONE THING NOT TAKEN FROM THE MOCKUP, on instruction: it
 * paints EMBEDDED violet (#a78bfa) over a violet/blue arcade ground, and
 * this page wears the Zare teal instead so it belongs to the site. Every
 * other visual decision — the animations, their timings and easings, the
 * surface alphas, the layout — is the mockup's. Local slate and outsourcing
 * amber are kept as-is: they are signal colours carrying meaning across the
 * whole game, not brand ones.
 */

export type RoleKey =
  | 'be' | 'fe' | 'ux' | 'qa' | 'pm' | 'ops'
  | 'cs1' | 'cs2' | 'sl' | 'da' | 'qt';

export type SourceIndex = 0 | 1 | 2; // local | outsourced | embedded

export interface Candidate {
  name: string;
  monthly: number;
  deploy: number; // days to productive
  skill: number;
  integ: number;
  flex: number;
}

/**
 * Which mark sits on a level card. A key, not a component, so this file
 * stays plain data — the mapping to an icon lives with the UI that draws it.
 */
export type MissionIcon = 'rocket' | 'support' | 'expand';

export interface Mission {
  name: string;
  /** Still the level NUMBER, used by the "Level 01" line. */
  glyph: string;
  iconBg: string;
  /** The tile's mark. Says what the mission is; the number is beneath it. */
  icon: MissionIcon;
  desc: string;
  budget: number;
  days: number;
  goal: string;
  roles: RoleKey[];
  /** Difficulty, 1–5, shown as filled pips on the level card (v3). */
  stars: number;
}

export interface Source {
  key: 'local' | 'out' | 'emb';
  label: string;
  tagline: string;
  short: string;
  badge: string;
  mgmt: string;
  color: string;
  bg: string;
  per: string;
  steps: string[];
}

export interface EventChoiceEffect {
  costMult?: number;
  capDelta?: number;
  evPts?: number;
  deadlineCut?: number;
  toast: string;
}

export interface GameEvent {
  at: number; // fires when the Nth role is filled
  title: string;
  desc: string;
  choices: {
    label: string;
    sub: string;
    fx: (c: { avgFlex: number; avgDeploy: number }) => EventChoiceEffect;
  }[];
}

const mk = (
  name: string, monthly: number, deploy: number,
  skill: number, integ: number, flex: number,
): Candidate => ({ name, monthly, deploy, skill, integ, flex });

export const ROLES: Record<RoleKey, string> = {
  be: 'Backend Engineer', fe: 'Frontend Engineer', ux: 'UI/UX Designer',
  qa: 'QA Engineer', pm: 'Project Manager', ops: 'Operations Specialist',
  cs1: 'Support Specialist', cs2: 'Support Specialist',
  sl: 'Support Team Lead', da: 'Data Analyst', qt: 'QA & Training Lead',
};

export const LEAD_ROLES: RoleKey[] = ['pm', 'sl'];

/** Per role: [local hire, outsourced package, embedded talent]. */
export const TALENT: Record<RoleKey, [Candidate, Candidate, Candidate]> = {
  be: [mk('Daniel Kim', 14000, 45, 92, 98, 45), mk('MVP Development Team', 18000, 14, 91, 72, 75), mk('Arjun Mehta', 5000, 7, 90, 94, 95)],
  fe: [mk('Sarah Lowell', 12500, 42, 90, 97, 45), mk('Frontend Build Package', 16500, 13, 90, 71, 75), mk('Lena Petrova', 4800, 6, 89, 93, 95)],
  ux: [mk('Marcus Webb', 11000, 40, 89, 96, 46), mk('UI/UX Design Sprint', 14000, 10, 92, 70, 78), mk('Camila Reyes', 4500, 7, 88, 92, 94)],
  qa: [mk('Priya Nair', 9500, 38, 88, 96, 46), mk('QA & Testing Package', 12500, 12, 89, 71, 77), mk('Tomás Silva', 3800, 5, 87, 93, 95)],
  pm: [mk('James Okafor', 12500, 44, 93, 98, 44), mk('Delivery Management Retainer', 15500, 14, 88, 68, 74), mk('Nadia Hassan', 5200, 7, 90, 92, 94)],
  ops: [mk('Emily Chen', 9000, 40, 89, 96, 45), mk('Operations Setup Project', 12000, 12, 88, 70, 76), mk('Kwame Boateng', 3800, 6, 88, 93, 95)],
  sl: [mk('Rachel Torres', 8000, 38, 91, 97, 45), mk('Support Operation Package', 10500, 10, 87, 69, 76), mk('Ana Oliveira', 3300, 5, 89, 93, 95)],
  cs1: [mk('Kevin Walsh', 6000, 35, 86, 95, 47), mk('Customer Support Operation', 8000, 9, 85, 70, 78), mk('Rhea Santos', 2400, 4, 86, 92, 95)],
  cs2: [mk('Dana Brooks', 6000, 35, 86, 95, 47), mk('Customer Support Operation', 8000, 9, 84, 70, 78), mk('Yusuf Adeyemi', 2400, 4, 86, 92, 95)],
  da: [mk('Alex Fontaine', 11000, 42, 90, 96, 45), mk('Data Migration Project', 14000, 13, 89, 71, 76), mk('Ivan Marinov', 4600, 7, 89, 92, 94)],
  qt: [mk('Monica Reed', 7500, 38, 88, 96, 46), mk('Training Program Package', 10000, 11, 86, 69, 76), mk('Grace Njeri', 3000, 5, 87, 92, 95)],
};

export const MISSIONS: Mission[] = [
  { name: 'Launch a SaaS Product', glyph: '01', icon: 'rocket', iconBg: 'linear-gradient(135deg,#40c1c7,#1a737a)', desc: 'Ship a product MVP before the runway clock runs out.', budget: 100000, days: 90, goal: 'Ship MVP in 90 days', roles: ['pm', 'be', 'fe', 'ux', 'qa'], stars: 2 },
  { name: 'Scale Customer Support', glyph: '02', icon: 'support', iconBg: 'linear-gradient(135deg,#4facfe,#1e6fd9)', desc: 'Ticket volume tripled overnight. Build a support org that keeps CSAT above 90%.', budget: 60000, days: 60, goal: 'CSAT ≥ 90% at 3× volume', roles: ['sl', 'cs1', 'cs2', 'qt', 'ops'], stars: 3 },
  { name: 'Expand Operations Fast', glyph: '03', icon: 'expand', iconBg: 'linear-gradient(135deg,#10cfd1,#0e8f91)', desc: 'New market, new region. Stand up an operations backbone in one quarter.', budget: 80000, days: 75, goal: 'Ops live in new region', roles: ['pm', 'ops', 'da', 'be', 'cs1'], stars: 3 },
];

export const SOURCES: [Source, Source, Source] = [
  { key: 'local', label: 'LOCAL FULL-TIME HIRE', tagline: 'Recruit and employ directly.', short: 'Own the hire.', badge: 'PERMANENT', mgmt: 'Client-managed', color: '#94a3b8', bg: 'rgba(148,163,184,.13)', per: '/month',
    steps: ['Job posted', 'Candidate search', 'Interviewing', 'Offer', 'Onboarding'] },
  { key: 'out', label: 'PROJECT OUTSOURCING', tagline: 'Give the project to an external team.', short: 'Outsource the outcome.', badge: 'AGENCY MANAGED', mgmt: 'Agency manages execution', color: '#f5b458', bg: 'rgba(245,180,88,.13)', per: '/month equivalent',
    steps: ['Project brief', 'Agency team assembled', 'External delivery', 'Milestone', 'Handoff'] },
  { key: 'emb', label: 'EMBEDDED TALENT', tagline: 'Add vetted talent directly to your team.', short: 'Extend your team.', badge: 'WORKS INSIDE YOUR TEAM', mgmt: 'You direct the work · provider supports the talent', color: '#40c1c7', bg: 'rgba(64,193,199,.15)', per: '/month',
    steps: ['Role requested', 'Pre-vetted match found', 'Client interview', 'Deployed'] },
];

export const EVENTS: GameEvent[] = [
  { at: 2, title: 'Investor wants lower burn', desc: 'Your lead investor just reviewed the numbers and wants monthly burn down — without gutting delivery.', choices: [
    { label: 'Flex your capacity down', sub: 'Works best with flexible sourcing models',
      fx: (c) => c.avgFlex >= 75
        ? { costMult: 0.9, evPts: 55, toast: 'Flexible contracts absorbed the cut. Burn −10%.' }
        : { costMult: 0.95, capDelta: -6, evPts: 15, toast: 'Fixed employment costs limited the cut. Delivery dipped.' } },
    { label: 'Protect the plan', sub: 'Hold spend steady, keep full capacity',
      fx: () => ({ evPts: 25, toast: 'Investor unconvinced — but delivery intact.' }) },
  ]},
  { at: 4, title: 'Deadline moved forward', desc: 'The board pulled launch in by 15 days. Speed to full capacity just became everything.', choices: [
    { label: 'Sprint with what you have', sub: 'Wins if your team ramps quickly',
      fx: (c) => c.avgDeploy <= 15
        ? { deadlineCut: 15, capDelta: 6, evPts: 55, toast: 'Your team was already ramped. Sprint on.' }
        : { deadlineCut: 15, capDelta: -8, evPts: 5, toast: 'Slow ramp-up hurt the sprint.' } },
    { label: 'Buy time with overtime pay', sub: 'Cost +8%, schedule protected',
      fx: () => ({ deadlineCut: 15, costMult: 1.08, evPts: 30, toast: 'Overtime covered the gap — at a price.' }) },
  ]},
];

/* ------------------------------------------------------------------ v3 copy
   The start and results screens the CTO signed off in
   docs/scale-challenge-ui-mockups/Scale Challenge v3.dc.html, spelled out in
   claude-code-prompt.md beside it. Verbatim: this is approved copy, and the
   spec closes by asking that the numbers and the three-model framing not be
   changed without checking first.
   ------------------------------------------------------------------------ */

/** The pill above the title, with its pulsing dot. */
export const START_PILL = 'A 2-minute staffing strategy game';

/** Title, split so the second line can carry the gradient. */
export const START_TITLE: [string, string] = ['THE SCALE', 'CHALLENGE'];

export const START_SUBLINE =
  'Build a 5-person team in 90 days on a $100K budget.';

export const START_BODY =
  'Every role can be filled three ways. Your choices set your cost, your speed, and how much of the work you have to manage yourself. Finish the mission and see exactly what your staffing mix would cost in real life.';

/**
 * The three OPTION cards. Indexes match SOURCES, so the model name, one-liner
 * and colour are read from there — only the trade-off line is new here.
 */
export const START_TRADEOFFS: [string, string, string] = [
  'Costs most, takes ~45 days, fully yours.',
  'Starts fast, agency runs it, margin costs you.',
  'Vetted people inside your team in ~7 days.',
];

export const START_WALKAWAY_TITLE = 'What you walk away with';

export const START_WALKAWAY: string[] = [
  'The real cost of your team, three different ways',
  'How many days until your team is actually working',
  'Which roles to hire, outsource, or embed — and why',
  'A scale score out of 1000 and your strategist rank',
];

export const START_CTA = '▶  PLAY — pick your mission';

export const START_CHIPS: string[] = [
  '⏱ 2 minutes',
  '3 missions',
  '15 talent cards',
  'no sign-up to play',
];

export const MISSION_STEP_LABEL = 'Step 1 of 3 — choose a level';

export const MISSION_INTRO =
  'Each mission gives you a budget, a deadline, and 5 roles to fill.';

/**
 * Strategist rank, by score. Ordered high to low; the first threshold the
 * score clears wins, so ROOKIE's 0 is the floor.
 */
export const RANKS: { min: number; name: string }[] = [
  { min: 850, name: 'ELITE STRATEGIST' },
  { min: 700, name: 'SENIOR STRATEGIST' },
  { min: 550, name: 'STRATEGIST' },
  { min: 400, name: 'OPERATOR' },
  { min: 0, name: 'ROOKIE' },
];
