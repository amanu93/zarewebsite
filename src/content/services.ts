/**
 * The two categories. This is the information architecture spine: every
 * visitor routes into one of these, and they carry strictly equal weight.
 * The moment one looks like the main offering, half the audience self-selects
 * out.
 */

export interface SubPath {
  tag: string;
  title: string;
  description: string;
  capabilities: readonly string[];
}

export interface ComparisonRow {
  measure: string;
  inHouse: string;
  zare: string;
}

export interface ServicePath {
  id: string;
  index: string;
  name: string;
  headline: string;
  description: string;
  /** Uppercase chips on the hero's path card — both cards carry two. */
  heroTags?: readonly string[];
  capabilities?: readonly string[];
  /** Commercial de-risking. Display weight, not bullets. */
  highlights?: readonly string[];
  subPaths?: readonly SubPath[];
  /**
   * The in-house-vs-Zare table from the Company Profile 2026 (p3). Only on
   * the embedded path: it is a hiring argument, and putting it under the
   * build path would frame projects as a staffing decision.
   */
  comparison?: readonly ComparisonRow[];
  cta: { label: string; href: string };
  /**
   * Rendered before anything else in the panel. "Embedded engineering"
   * collides with "embedded systems" for exactly the technical audience we
   * are addressing, and without this a reader files Zare next to Toptal.
   */
  definition?: string;
}

export const servicePaths: ServicePath[] = [
  {
    id: 'tech-ai',
    index: '01',
    name: 'Technology & AI',
    // 2026-08 leadership copy: build AND run, with AI enablement folded in.
    headline: 'From idea to launch, and the team to run it.',
    description:
      "Zare designs, builds, and operates software and AI systems end to end — from discovery and product design through engineering, deployment, and support. Our Addis Ababa engineering centre delivers agentic AI, workflow automation, and full-stack web, mobile, and enterprise platforms, with evaluation, guardrails, and monitoring built in from day one. Most companies now have AI tools and no idea how to use them properly, so we also teach your teams how to work with AI day to day — where it earns its keep, where it doesn't, and how to move from scattered experiments to measurable adoption. Tell us what's slowing you down and we'll scope it in a week.",
    heroTags: ['Agentic AI & Automation', 'Prototype to Production'],
    capabilities: [
      'Multi-agent systems, RAG, and MCP integrations',
      'AI adoption and enablement — audit workflows, train your teams, measure the gains',
      'Workflow automation across your existing tools and data',
      'Voice and multimodal AI',
      'Full-stack web and mobile platforms',
      'Custom ERP and CRM systems',
    ],
    cta: { label: 'Build with Zare', href: '/contact?pathway=project' },
  },
  {
    id: 'embedded',
    index: '02',
    name: 'Embedded Teams',
    // The profile's Engine 2 headline: the whole commercial model in six
    // words — your direction, our employment overhead.
    headline: 'Your team member, our payroll.',
    definition:
      'Embedded means your engineers work inside your workflow. Your Slack, your standups, your codebase, your roadmap. They remain part of a stable Zare engineering team, with the management, review, and continuity that implies.',
    // The EOR model stated plainly (Company Profile 2026, Engine 2). This is
    // the paragraph that pre-empts "so is this a bodyshop?" — the legal and
    // commercial shape, not an adjective.
    description:
      'Zare is the legal employer in Ethiopia and handles payroll, taxes, and compliance. You direct the work and pay one monthly invoice. Placements are dedicated to one client, never shared.',
    heroTags: ['Technology Talent', 'Business Operations'],
    highlights: [
      'One monthly invoice, all-in',
      'Risk-free trial on every placement',
      'Dedicated placements, never shared',
    ],
    subPaths: [
      {
        tag: 'A · Technology Talent',
        title: 'Vetted engineers, inside your standups.',
        description:
          'Engineers, developers, technical specialists, and dedicated product teams integrated into your organisation.',
        capabilities: [
          'Dedicated engineers and managed development teams',
          'Product and engineering specialists',
          'Client-specific talent matching',
          'First vetted candidate in 1 to 2 weeks',
        ],
      },
      {
        tag: 'B · Business Operations',
        title: 'Managed operations, run as your own.',
        description:
          'Managed customer experience and back-office teams designed to operate as an extension of your business.',
        capabilities: [
          'Customer and technical support',
          'Data processing and administrative operations',
          'Virtual assistance and back-office workflows',
          'Operational reporting',
        ],
      },
    ],
    comparison: [
      {
        measure: 'First candidate',
        inHouse: '3 to 9 weeks',
        zare: '2 to 4 weeks',
      },
      {
        measure: 'Cost of a wrong fit',
        inHouse: 'Full salary, then a restart',
        zare: '$0 during the trial, free replacement',
      },
    ],
    cta: { label: 'Build an embedded team', href: '/contact?pathway=team' },
  },
];
