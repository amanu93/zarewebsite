/**
 * How we deliver.
 *
 * Rebuilt in the 2026-08 leadership comment round from the approved
 * design export ("Zare - How We Deliver"): three tracks — Build, Adopt,
 * Embed — over one shared four-phase timeline with two lanes. The older
 * two-track exports further down are retained for reference surfaces
 * that may still want them.
 */

// ------------------------------------------------- the three tracks

export interface DeliverTrack {
  tag: string;
  title: string;
  body: string;
  /** Bordered stack chips (the Build track). */
  chips?: readonly string[];
  /** Slash-marked rows (the Adopt and Embed tracks). */
  points?: readonly string[];
}

export const deliverTracks: readonly DeliverTrack[] = [
  {
    tag: '01 · Build',
    title: 'We build the system.',
    body: 'Agentic AI, workflow automation, and full-stack platforms — discovery to production, then operated after launch.',
    chips: [
      'LangGraph · MCP · RAG',
      'React · Next.js',
      'Python · FastAPI',
      'AWS · Azure',
      'Evals · Tracing · Guardrails',
    ],
  },
  {
    tag: '02 · Adopt',
    title: 'Your team learns to run it.',
    body: 'Most companies have AI tools and no working practice around them. We audit the workflows, ship the agents, and train the people who use them daily.',
    points: [
      "Workflow audit — where AI earns its keep, where it doesn't",
      'Role-specific training for engineering, sales, and operations',
      'Adoption measured against baseline, not vibes',
    ],
  },
  {
    tag: '03 · Embed',
    title: 'Or we join your team.',
    body: 'Engineers, AI specialists, designers, QA, and operations staff placed inside your workflow — employed and managed by us.',
    points: [
      'AI-native by default, not learning on your time',
      'First vetted candidate in 1 to 2 weeks',
      'Risk-free trial: wrong fit, no invoice',
    ],
  },
];

// ------------------------------------------- the seven-week timeline

export interface DeliverPhase {
  n: string;
  name: string;
  when: string;
}

export const deliverPhases: readonly DeliverPhase[] = [
  { n: '01', name: 'Talk', when: 'Day 1' },
  { n: '02', name: 'Prove', when: 'Week 1–2' },
  { n: '03', name: 'Start', when: 'Week 2–4' },
  { n: '04', name: 'Own', when: 'Week 4–7' },
];

export interface DeliverLane {
  label: string;
  /** One cell per phase, in order. */
  cells: readonly string[];
  /** The accent lane is teal; the other lane carries the navy key. */
  accent: boolean;
}

export const deliverLanes: readonly DeliverLane[] = [
  {
    label: 'Build & Adopt',
    accent: true,
    cells: [
      'Scoping conversation on the problem, not the spec.',
      'Paid discovery sprint returns a fixed scope, timeline, and price.',
      'Two-week build cycles, a working demo at the end of each.',
      'Handoff, team training, 30-day stabilization, full IP transfer.',
    ],
  },
  {
    label: 'Embed',
    accent: false,
    cells: [
      'Discovery call: role, stack, and the bar you hire at.',
      'First vetted candidates presented. You interview and choose.',
      'Risk-free trial begins. Wrong fit? Free replacement in 2 weeks or less.',
      'Long-term placement confirmed, one monthly invoice.',
    ],
  },
];

/** Zero-based phase index carrying the "you decide here" marker. */
export const DECIDE_PHASE = 1;

export interface StackLayer {
  name: string;
  description: string;
  technologies: readonly string[];
}

/** The build track: what happens when Zare builds the system. */
export const buildStack: StackLayer[] = [
  {
    name: 'BUILD',
    description:
      'Product and AI engineering that ships fast without cutting corners.',
    technologies: ['React · Next.js', 'NestJS · Python', 'FastAPI · LangGraph'],
  },
  {
    name: 'RUN',
    description: 'Managed cloud infrastructure sized to each product.',
    technologies: ['AWS · Azure', 'Docker', 'PostgreSQL · Redis'],
  },
  {
    name: 'DELIVER',
    description:
      'Automated pipelines, observable systems, access-controlled releases.',
    technologies: ['GitHub Actions · CI/CD', 'Monitoring', 'Secure deployment'],
  },
];

/** The embed track: eight steps between an application and a client's team. */
export const vettingSteps: readonly { n: string; label: string }[] = [
  { n: '01', label: 'Application screening' },
  { n: '02', label: 'Communication assessment' },
  { n: '03', label: 'Technical assessment' },
  { n: '04', label: 'Practical project' },
  { n: '05', label: 'Technical interview' },
  { n: '06', label: 'Reference verification' },
  { n: '07', label: 'Client matching' },
  { n: '08', label: 'Ongoing performance review' },
];

/**
 * Facts about the embed track that are verified today.
 *
 * The trial and replacement commitments were previously absent because they
 * were not in writing; the Company Profile 2026 now states both, so they
 * ship. The notice period and the step 02 communication standard remain
 * absent. See docs/CONTENT-CHECKLIST.md
 */
export const embedFacts: readonly string[] = [
  'First vetted candidate in 1 to 2 weeks',
  'Dedicated placements, never shared across clients',
  'Risk-free trial on every placement: wrong fit, no invoice',
  '80+ technical placements delivered in one month, for Kagool',
];

/**
 * The two engagement lifecycles, verbatim from the Company Profile 2026
 * (Engine 1 p4, Engine 2 p5). These answer the question the tracks above do
 * not: not "how do you work" but "what happens after I contact you, and
 * when". The week markers are the content — a numbered list without dates
 * is a process diagram; with them it is a commitment.
 */
export interface TimelineStep {
  n: string;
  label: string;
  when: string;
}

export const projectTimeline: readonly TimelineStep[] = [
  { n: '01', label: 'Scoping conversation', when: 'Day 1' },
  { n: '02', label: 'Discovery sprint', when: 'Week 1–2' },
  { n: '03', label: 'Fixed proposal: scope, timeline, price', when: 'On completion' },
  { n: '04', label: 'Two-week build cycles, a demo at the end of each', when: 'Build' },
  { n: '05', label: 'Handoff, 30-day stabilization, IP transfers on delivery', when: 'Close' },
];

export const placementTimeline: readonly TimelineStep[] = [
  { n: '01', label: 'Discovery call: role, stack, bar', when: 'Day 1' },
  { n: '02', label: 'Vetted candidates presented', when: 'Week 1–2' },
  { n: '03', label: 'You interview and choose', when: 'Week 2–3' },
  { n: '04', label: 'Trial starts', when: '3–5 days after selection' },
  { n: '05', label: 'Long-term placement confirmed', when: 'Week 4–7' },
];
