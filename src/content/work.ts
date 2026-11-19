/**
 * Delivered work. The single source of truth for /work, /work/[slug], and the
 * homepage featured-work section.
 *
 * Two case models, deliberately. A system build and an embedded engagement
 * answer different questions, and forcing one template onto both produces
 * either a thin page or invented architecture. See
 * docs/decisions/005-two-case-study-models.md
 */

import type { StaticImageData } from 'next/image';

import pickrellSite from '../../public/case-studies/pickrell-site.png';
import womentorDashboard from '../../public/case-studies/womentor-dashboard.png';
import womentorAdminMatching from '../../public/case-studies/womentor-admin-matching.png';
import womentorMenteeHome from '../../public/case-studies/womentor-mentee-home.png';
import womentorTraining from '../../public/case-studies/womentor-training.png';
import womentorMessaging from '../../public/case-studies/womentor-messaging.png';
import womentorCommunity from '../../public/case-studies/womentor-community.png';
import tenasolHomepage from '../../public/case-studies/tenasol-homepage.png';
import kagoolHomepage from '../../public/case-studies/kagool-homepage.png';
import joveoHomepage from '../../public/case-studies/joveo-homepage.png';
import exeliaSite from '../../public/case-studies/refs/exelia-site.png';

// ---------------------------------------------------------------- primitives

export type Client =
  | { named: true; name: string; url?: string }
  | { named: false; descriptor: string; reason: string };

export interface Outcome {
  value: string;
  metric: string;
  /**
   * REQUIRED. "40% improvement" is a number without meaning; "40% improvement
   * in full-text recovery after rebuilding the indexing strategy" is evidence.
   * The type makes the first one impossible to express.
   */
  context: string;
  verified: boolean;
}

export interface Decision {
  decision: string;
  /** What was given up. A decision with no tradeoff was not a decision. */
  tradeoff: string;
  result: string;
}

export interface SystemComponent {
  component: string;
  note: string;
}

export interface CaseQuote {
  text: string;
  attribution: string;
  role: string;
  source: string;
}

export interface CaseImage {
  /**
   * A static import, not a path: it carries the file's real width and height
   * and a blur preview, so frames are sized to the shot before it loads and
   * the gallery never jumps.
   */
  src: StaticImageData;
  alt: string;
  caption: string;
  /**
   * `product` is a screenshot of the system that was actually built.
   * `context` is the client's own public presence (their website) — shown
   * as the world the engagement runs inside, never passed off as the
   * deliverable. The caption must make the distinction readable.
   */
  kind: 'product' | 'context';
  /**
   * Which side of a two-sided system a shot belongs to, where the build has
   * two. Womentor is the case in point: the programme team's admin console
   * and the mentee's own experience are different products wearing one name,
   * and showing them in one undifferentiated grid reads as a single app with
   * inconsistent design. Absent means the case has one surface and the
   * gallery stays a single run.
   */
  surface?: 'admin' | 'participant';
}

/**
 * How the Company Profile 2026 prints a case, carried verbatim so the index
 * cards are the profile's cards rather than a paraphrase of them.
 *
 * The profile uses TWO formats and the choice is its own, not a ranking:
 * `spread` is a full page (pages 6, 7, 9, 10) with the argument split into
 * THE PROBLEM and WHAT WE BUILT beside the screenshot; `card` is one of the
 * three compact cards sharing page 8, which carry a single paragraph and a
 * tinted closing line instead. A case printed as a card has no problem/built
 * split in the source, so it is not given one here either.
 *
 * This is deliberately separate from `summary`, `problem` and `situation`:
 * those are the site's own longer-form copy for the detail page, and the
 * profile's spread copy is shorter and differently worded. Both are correct
 * for where they appear.
 */
export interface ProfilePrint {
  format: 'spread' | 'card';
  /** The line beside the CASE STUDY badge. */
  eyebrow: string;
  /** The profile's headline — short, and never the site's `summary`. */
  headline: string;
  /** spread: the ink-ruled block. */
  problem?: string;
  /** spread: the profile varies this — builds say "What we built", placement
   *  work says "What we did". Kagool is the latter. */
  builtLabel?: string;
  /** spread: the teal-ruled block. */
  built?: string;
  /** card: the single paragraph that replaces the split. */
  body?: string;
  /** card: the tinted closing line. */
  footnote?: string;
  /** Marks top-right. Several where the profile shows several — Womentor
   *  carries both Mastercard AGF and AFIG. */
  logos?: { src: string; alt: string }[];
}

interface CaseBase {
  slug: string;
  /** The profile's own printing of this case. See ProfilePrint. */
  profile?: ProfilePrint;
  client: Client;
  industry: string;
  location: string;
  /** Rank on /work and the homepage. `false` means it appears only in the reference list. */
  featured: false | 1 | 2 | 3;
  /** One line. Used on cards and on the homepage. The outcome, not the deliverable. */
  summary: string;
  duration?: string;
  outcomes: Outcome[];
  /** How Zare actually worked with the client. */
  delivery?: string;
  quote?: CaseQuote;
  /**
   * Real screenshots only — see CaseImage. Absent renders no gallery.
   *
   * Every shot is cropped to 16:10 at source, so cards and the gallery hold
   * one shape; a near-16:10 shot is padded with its own edge colour rather
   * than cut. Crop to the part of the screen that tells the story.
   */
  images?: CaseImage[];
  /**
   * The shot the index and homepage cards show, where it is not the
   * gallery's first. A card is one glance, so it can carry a screen chosen
   * for that, without that screen joining the gallery.
   */
  cover?: CaseImage;
  /**
   * The client's own mark, top-right of the index card exactly as the
   * Company Profile 2026 case spreads place it. Optional and never faked:
   * a case with no mark on file simply carries the label.
   */
  logo?: { src: string; alt: string };
}

export interface SystemCase extends CaseBase {
  kind: 'system';
  problem: string;
  system: SystemComponent[];
  /**
   * May be empty while the engineering interview is outstanding. The page then
   * renders a labelled gap. It is never filled with plausible-sounding
   * invention: a reader who knows the domain spots that instantly, and it
   * costs more trust than the empty section does.
   */
  decisions: Decision[];
  /** Technologies appear only inside decisions. There is no stack strip. */
  stack: string[];
}

export interface EngagementCase extends CaseBase {
  kind: 'engagement';
  situation: string;
  podShape: string;
  integration: string[];
  /** The retention argument, in this client's specific terms. */
  continuity?: string;
}

export type CaseStudy = SystemCase | EngagementCase;

/**
 * A delivered project recorded without a full narrative. Never linked.
 *
 * Shape follows the Company Profile 2026 "Selected Work" spread verbatim:
 * a client mark, the client's name, and ONE line. There is no separate
 * industry or location field because the profile's sentence opens with the
 * market ("Washington DC. CRM selection, …") — splitting that back out
 * would be paraphrasing an approved artifact.
 */
export interface WorkReference {
  /** Client name exactly as the profile prints it. */
  client: string;
  /** The profile's own one-liner, verbatim. */
  note: string;
  /** The client's own mark, rendered on a white plate. */
  logo?: { src: string; alt: string };
}

// ----------------------------------------------------------------- the cases

export const caseStudies: CaseStudy[] = [
  {
    kind: "engagement",
    slug: "pickrell-embedded-engineering-pod",
    // Company Profile 2026, page 8 — a compact card, not a spread. The
    // profile gives it one paragraph, so it is not split into problem and
    // what-we-built the way the full-page cases are.
    profile: {
      format: "card",
      eyebrow: "Pickrell · North Carolina",
      logos: [
        { src: "/clients/pickrell.png", alt: "Pickrell Global Technologies" }
      ],
      headline: "Embedded developers, proven over time.",
      body: "Pickrell needed dependable engineering capacity without a US hiring round. Three embedded developers have worked inside their team since January 2024, on their tools and sprint cadence, with Zare proactively managing performance, employment, and payroll.",
      footnote: '"Reliable, skilled, solid contributors." Their words.'
    },
    logo: { src: "/clients/pickrell.png", alt: "Pickrell Global Technologies" },
    client: {
      named: true,
      name: "Pickrell Global Technologies",
      url: "https://pickrellglobaltechnologies.com/"
    },
    industry: "Technology services",
    location: "Concord, North Carolina",
    featured: 2,
    duration: "Since January 2024",
    summary:
      "A three-developer pod embedded in the client delivery organisation, running continuously since January 2024.",
    situation:
      "The client needed to grow its engineering capacity but was constrained by the cost and competition of hiring in the United States. It needed developers inside its own delivery organisation, not a vendor working at arm's length.",
    podShape:
      "Three full-time developers, dedicated, not shared with other clients.",
    integration: [
      "Working inside the client delivery organisation",
      "Dedicated placements, never shared across clients",
      "Performance managed by Zare, with regular client check-ins"
    ],
    continuity:
      "The same engagement has run since January 2024. Continuity, not headcount, is what the client is buying.",
    images: [
      {
        src: pickrellSite,
        alt: "Pickrell Global Technologies' website",
        caption:
          "The client's delivery organisation — the pod works inside Pickrell's own workflow, on Pickrell's own clients.",
        kind: "context"
      }
    ],
    outcomes: [
      // The Company Profile's own Pickrell card leads on the shape of the
      // pod, not on spend — its two stats verbatim. The engagement-value
      // figure that used to sit first is gone: it led the case, and leading
      // with cost is the one thing metrics.ts rules out.
      {
        value: "3",
        metric: "Embedded engineers",
        context:
          "a dedicated pod inside the client delivery organisation, working their tools and sprint cadence since January 2024.",
        verified: true
      },
      {
        value: "3 stacks",
        metric: "Mobile, web, and AI/ML engineering",
        context:
          "three disciplines covered by the same pod, without three separate hiring rounds.",
        verified: true
      },
      {
        value: "5.0",
        metric: "Verified client rating",
        context:
          "Clutch review published February 2025, after a year of delivery.",
        verified: true
      },
      {
        value: ">50%",
        metric: "Reduction in talent overhead",
        context:
          "against the cost of hiring the equivalent team locally in the United States.",
        verified: true
      }
    ],
    quote: {
      text: "They are constantly responsive and check in frequently to ensure that all expectations are being met.",
      attribution: "Pickrell Global Technologies",
      role: "Technology services · Concord, NC",
      source: "Verified Clutch review · February 2025"
    }
  },

  {
    kind: "system",
    slug: "womentor-africa-mentorship-platform",
    // Company Profile 2026, page 7. Two marks, as the profile shows them.
    profile: {
      format: "spread",
      eyebrow: "Custom AI & Software · Mastercard Foundation backed",
      logos: [
        {
          src: "/clients/africa-growth-fund.svg",
          alt: "Mastercard Africa Growth Fund"
        },
        { src: "/clients/afig-funds.png", alt: "AFIG Funds" }
      ],
      headline: "Mentorship for women in finance, at continental scale.",
      problem:
        "AFIG wanted to connect women across Africa's investment industry with mentors, and no off-the-shelf platform could match, manage, and measure those relationships across multiple markets.",
      builtLabel: "What we built",
      built:
        "An end-to-end mentorship platform: AI-driven mentor-mentee matching, goal frameworks, messaging, program-wide analytics, and audit trails. Designed and built by a 12-person Ethiopian and Kenyan team, from first wireframe to production."
    },
    logo: {
      src: "/clients/africa-growth-fund.svg",
      alt: "Mastercard Africa Growth Fund"
    },
    client: { named: true, name: "Mastercard Africa Growth Fund, AFIG Funds" },
    industry: "Development finance",
    location: "Pan-African",
    featured: 3,
    summary:
      "An end-to-end mentorship platform connecting women across Africa's investment industry, live in multiple markets.",
    problem:
      "The Mastercard Foundation wanted to connect women across Africa's investment industry with mentors, and no off-the-shelf platform could match, manage, and measure those relationships across multiple markets. Run with AFIG Funds as the Mastercard Africa Growth Fund, the programme needed a platform built for its own mechanics rather than adapted to them.",
    system: [
      {
        component: "Matching engine",
        note: "AI-driven mentor-mentee matching, with goal frameworks that structure each relationship."
      },
      {
        component: "Programme operations",
        note: "Relationship lifecycle management, in-platform messaging, and calendar integration."
      },
      {
        component: "Programme analytics",
        note: "Programme-wide analytics and audit trails for administrators measuring outcomes across markets."
      }
    ],
    // Pending the engineering interview. See ADR 005.
    decisions: [],
    stack: [],
    images: [
      // Two surfaces, and the gallery splits on them: the programme team runs
      // the console, the participants live in the other four screens.
      {
        src: womentorDashboard,
        alt: "The Womentor programme-analytics dashboard: users per country and per type, with mentorship filters and AI-match export",
        caption:
          "Programme analytics: users per country and per type across markets, with mentorship filters and AI-match export.",
        kind: "product",
        surface: "admin"
      },
      {
        src: womentorAdminMatching,
        alt: "A mentee's record in the admin console, showing three matched mentors each scored by an automatic match and an AI match, with the AI's reasoning open",
        caption:
          "Matching, the part that had to be defensible: every candidate mentor carries two scores — an automatic one and an AI one — and the reasoning is written out in full before an administrator confirms or declines. The mentee's contact details are masked here.",
        kind: "product",
        surface: "admin"
      },
      {
        src: womentorMenteeHome,
        alt: "A mentee's home screen: a passed session awaiting confirmation, the tasks attached to it, and the mentorship plan beside it",
        caption:
          "A mentee’s home. The passed session asks to be confirmed, its tasks are split into before, during and after, and the plan runs alongside with the next session already scheduled.",
        kind: "product",
        surface: "participant"
      },
      {
        src: womentorTraining,
        alt: "A completed training session: speaker, bio, agenda, session date, and the recording link",
        caption:
          "A training session after the fact — speaker and bio, the agenda, and the recording — with attendance confirmed by the participant rather than assumed.",
        kind: "product",
        surface: "participant"
      },
      {
        src: womentorMessaging,
        alt: "A mentee messaging their mentor in-platform, including a shared PDF attachment",
        caption:
          "Mentor and mentee message inside the platform, attachments included, so the relationship and its record stay in the programme rather than moving to private email.",
        kind: "product",
        surface: "participant"
      },
      {
        src: womentorCommunity,
        alt: "The Womentor community feed, showing a post with an image, tags, likes and comments",
        caption:
          "The community feed, where participants post opportunities and resources to the wider cohort — the part of the programme that outlives any one pairing.",
        kind: "product",
        surface: "participant"
      }
    ],
    outcomes: [
      // The profile's band, in its order. The team line is the revision
      // supplied with it — Ethiopia and the average age, ideation through
      // launch — replacing the profile's own wording for that cell.
      {
        value: "LIVE",
        metric: "In production across multiple African markets",
        context:
          "deployed and running for the programme rather than held as a pilot build.",
        verified: true
      },
      {
        value: "12",
        metric:
          "Person team in Ethiopia (avg. age 29), ideation through launch",
        context:
          "one accountable vendor carrying the platform from first wireframe to production.",
        verified: true
      },
      {
        value: "100+",
        metric: "Active users in the pilot phase",
        context: "within the first 2 months.",
        verified: true
      }
    ],
    quote: {
      text: "Over the past six months, the Zare team has demonstrated exceptional commitment, quality, and thoughtfulness. The final product received overwhelmingly positive feedback, with very few change requests — a true reflection of the team's excellence and hard work. I'm incredibly proud of what we've built together and excited to carry this momentum forward.",
      attribution: "Mastercard Africa Growth Fund",
      role: "Womentor Africa",
      source: "Client feedback, six months into the engagement"
    }
  },

  {
    kind: "engagement",
    slug: "tenasol-clinical-platform-design",
    // Company Profile 2026, page 9.
    profile: {
      format: "spread",
      eyebrow: "Product design, then embedded talent · Tenasol, California",
      logos: [{ src: "/clients/tenasol.avif", alt: "Tenasol" }],
      headline:
        "A clinical data platform four kinds of users can actually use.",
      problem:
        "Tenasol's healthcare data platform serves admins, doctors, nurses, and patients, each needing different views of sensitive clinical data arriving as PDF, DICOM, FHIR, HL7, JSON, and CSV.",
      builtLabel: "What we built",
      built:
        "Role-based interface design for all four user types, bulk and individual upload flows for every format, and a patient portal with population-level analytics. Delivered as a Figma prototype plus a reusable design system, with FHIR and HL7 aware design decisions throughout."
    },
    logo: { src: "/clients/tenasol.avif", alt: "Tenasol" },
    client: { named: true, name: "Tenasol" },
    industry: "Healthcare data",
    location: "California, USA",
    featured: false,
    summary:
      "A clinical data platform designed for four kinds of users — a project the client converted into an ongoing embedded placement.",
    situation:
      "Tenasol's platform serves administrators, doctors, nurses, and patients, with clinical data arriving as PDF, DICOM, FHIR, HL7, JSON, and CSV. It needed role-based interfaces those four audiences could actually use, designed by people who understand the formats underneath.",
    podShape:
      "One senior product designer, on a fixed design engagement that converted into an ongoing embedded placement.",
    integration: [
      "Role-based interface design for all four user types",
      "FHIR- and HL7-aware design decisions throughout",
      "Delivered as a Figma prototype plus a reusable design system"
    ],
    continuity:
      "Tenasol kept the designer. The strongest review a design engagement can get is the client converting it into a permanent seat.",
    outcomes: [
      {
        value: "4",
        metric: "User roles designed",
        context:
          "administrators, doctors, nurses, and patients, each with a role-based interface.",
        verified: true
      },
      {
        value: "6",
        metric: "Clinical data formats",
        context:
          "PDF, DICOM, FHIR, HL7, JSON, and CSV, with bulk and individual upload flows for each.",
        verified: true
      },
      {
        value: "1",
        metric: "Reusable design system",
        context:
          "delivered alongside the clickable prototype, ready for the engineering build-out.",
        verified: true
      }
    ],
    images: [
      {
        src: tenasolHomepage,
        alt: "Tenasol's clinical intelligence platform: the document-to-FHIR pipeline, health records and claims in, a patient summary with AI-predicted probability, FHIR R4 bundle out",
        caption:
          "The client's product world — the clinical data platform the role-based interfaces were designed for.",
        kind: "context"
      }
    ]
  },

  {
    kind: "engagement",
    slug: "kagool-vetting-at-volume",
    // Company Profile 2026, page 10. Note the second label: the profile
    // says WHAT WE DID here, not WHAT WE BUILT — this was placement work,
    // not a build, and it makes that distinction on the page.
    profile: {
      format: "spread",
      eyebrow: "Embedded talent at volume · Kagool, London UK",
      logos: [{ src: "/clients/kagol.svg", alt: "Kagool" }],
      headline: "80+ placements delivered in under one month.",
      problem:
        "Kagool, a UK data consultancy, needed to staff their local Ethiopian subsidiary, at a volume that breaks most staffing pipelines and with no room to lower the bar.",
      builtLabel: "What we did",
      built:
        "Ran our vetting pipeline at volume: sourcing, testing, and placing engineers and specialists into Kagool's delivery teams, at the same bar we hold for a single placement. Throughput is a capability, not an accident."
    },
    logo: { src: "/clients/kagol.svg", alt: "Kagool" },
    client: { named: true, name: "Kagool" },
    industry: "Technology consultancy",
    location: "London, UK",
    featured: false,
    summary:
      "80+ vetted placements delivered in under one month, staffing a new Addis Ababa subsidiary on schedule.",
    situation:
      "Kagool needed to staff its local Ethiopian subsidiary at a volume that breaks most staffing pipelines, with no room to lower the bar while doing it.",
    podShape:
      "The vetting pipeline run at volume: sourcing, testing, and placing engineers and specialists into Kagool's delivery teams.",
    integration: [
      "Sourcing and testing run by Zare, at the single-placement bar",
      "Placements into Kagool's own delivery teams",
      "Full roster inside one month"
    ],
    continuity:
      "The vetting bar held: the same standard applied to one placement, applied more than eighty times. Throughput is a capability, not an accident.",
    images: [
      {
        src: kagoolHomepage,
        alt: "Kagool's homepage: its office map across three continents and its technology partners",
        caption:
          "The client: a 200-person, three-continent Microsoft and SAP consultancy — the delivery organisation the Addis Ababa roster now serves.",
        kind: "context"
      }
    ],
    outcomes: [
      {
        value: "80+",
        metric: "Candidates delivered",
        context: "sourced, tested, and placed for a single client engagement.",
        verified: true
      },
      {
        value: "<1 mo",
        metric: "Kickoff to full roster",
        context: "the subsidiary was staffed on schedule.",
        verified: true
      }
    ]
  },

  {
    kind: "engagement",
    slug: "joveo-engineering-pod",
    // Company Profile 2026, page 8 — one of three compact cards, not a
    // full spread. One paragraph, two stats, a tinted closing line.
    profile: {
      format: "card",
      eyebrow: "Joveo · California",
      logos: [{ src: "/clients/joveo.svg", alt: "Joveo" }],
      headline: "An engineering pod inside a US recruitment platform.",
      body: "Joveo needed engineering capacity across multiple skill levels without US ramp time and overhead. We sourced, vetted, and onboarded a multi-tier pod, interns through senior engineers, and handle performance, retention, and skills development so Joveo stays focused on product.",
      footnote:
        "A sustainable talent pipeline. Hiring time and cost cut, scaling with the roadmap."
    },
    logo: { src: "/clients/joveo.svg", alt: "Joveo" },
    client: { named: true, name: "Joveo" },
    industry: "Programmatic recruitment advertising",
    location: "California, USA",
    featured: false,
    duration: "12+ months",
    summary:
      "A multi-tier engineering pod inside a US recruitment platform, working in the core codebase for over a year.",
    situation:
      "Joveo needed engineering capacity inside its own delivery organisation without the time and cost of hiring it in the United States, and without handing its core platform to a vendor at arm's length.",
    podShape:
      "A multi-tier pod, interns through senior engineers, sized to the roadmap.",
    integration: [
      "Working in the core platform codebase",
      "Integrated from Sprint 1, with no training period",
      "Performance, retention, and skills development handled by Zare"
    ],
    continuity:
      "A sustainable talent pipeline: hiring time and cost cut, scaling with the roadmap while Joveo stays focused on product.",
    outcomes: [
      {
        value: "3",
        metric: "Embedded engineers",
        context: "a dedicated pod inside the client delivery organisation.",
        verified: true
      },
      {
        value: "Sprint 1",
        metric: "Immediate integration",
        context: "productive in the first sprint, with no training period.",
        verified: true
      }
    ],
    images: [
      {
        src: joveoHomepage,
        alt: "Joveo's agentic recruiting platform: the landing page, with the TA teams it is used by",
        caption:
          "The client's product world — the recruitment platform the embedded pod builds inside.",
        kind: "context"
      }
    ]
  },

  {
    kind: "engagement",
    slug: "exelia-embedded-designer",
    // Company Profile 2026, page 8 — a compact card, not a spread.
    profile: {
      format: "card",
      eyebrow: "Exelia · Nicosia, Cyprus",
      logos: [{ src: "/clients/exelia.png", alt: "Exelia Technologies" }],
      headline: "A critical UI/UX skills gap, closed.",
      body: "Facing a limited local talent pool, Exelia needed specialized UI/UX skills on a fast-moving product team. A targeted global search placed a senior remote designer, vetted to high global standards and onboarded inside the trial period, now delivering across multiple product surfaces.",
      footnote: '"He is a diamond." Their words.'
    },
    logo: { src: "/clients/exelia.png", alt: "Exelia Technologies" },
    client: { named: true, name: "Exelia Technologies" },
    industry: "Technology",
    location: "Nicosia, Cyprus",
    featured: false,
    duration: "Ongoing",
    summary:
      "A critical UI/UX skills gap closed with one senior designer, placed through a targeted global search.",
    situation:
      "Facing a limited local talent pool, Exelia needed specialised UI/UX skills on a fast-moving product team — a gap the Cypriot market could not close quickly.",
    podShape:
      "One senior UI/UX designer, vetted to global standards and onboarded inside the trial period.",
    integration: [
      "Embedded in a fast-moving product team",
      "Onboarded inside the risk-free trial period",
      "Delivering across multiple product surfaces"
    ],
    continuity:
      "The client calls him part of the Exelia family — the outcome the trial period exists to produce.",
    images: [
      {
        src: exeliaSite,
        alt: "Exelia Technologies' website",
        caption:
          "The client's product world — the fast-moving team the designer works inside.",
        kind: "context"
      }
    ],
    outcomes: [
      {
        value: "1",
        metric: "Senior UI/UX designer placed",
        context:
          "through a targeted global search, vetted to global standards.",
        verified: true
      },
      {
        value: "Ongoing",
        metric: "Embedded engagement",
        context: "now delivering across multiple product surfaces.",
        verified: true
      }
    ],
    quote: {
      text: "We are all very impressed with his designs, his professionalism, and how well he manages relationships with our clients. He is a diamond and we are extremely happy to have him as part of the Exelia family.",
      attribution: "Exelia Technologies",
      role: "Technology · Nicosia, Cyprus",
      source: "Client feedback"
    }
  }
];

// ------------------------------------------------------------- other work
// Recorded, not narrated. These have no detail page: a case study page with no
// engineering reasoning behind it damages the argument the deep pages make.

export const workReferences: WorkReference[] = [
  // The Company Profile 2026 "Selected Work" spread, in the profile's own
  // order, with its one-liners verbatim. Twelve named clients replaced the
  // site's earlier mix of screenshot cards and an "Eight clients" catch-all:
  // the profile names each engagement, so the site does too.
  {
    client: "KEFI Gold & Copper",
    note: "Saudi Arabia + Cyprus. Research and technology support, via Chesanalyst.",
    logo: { src: "/clients/kefi-gold.png", alt: "KEFI Gold & Copper" }
  },
  {
    client: "KeySquare Labs",
    note: "US. Custom .NET geotagging and field-data system.",
    logo: { src: "/clients/keysquare.png", alt: "KeySquare Labs" }
  },
  {
    client: "251 Marketing",
    note: "Ethiopia. Custom ERP and CRM for a marketing agency.",
    logo: { src: "/clients/251-logo.png", alt: "251 Marketing" }
  },
  {
    client: "Africa Communications Media Group",
    note: "South Africa. Verified database of 200 pan-African media contacts.",
    logo: { src: "/clients/acmg.png", alt: "Africa Communications Media Group" }
  },
  {
    client: "AFIG Funds",
    note: "Washington DC. CRM selection, automated ESG data collection, and intelligence reporting for a pan-African private equity firm.",
    logo: { src: "/clients/afig-funds.png", alt: "AFIG Funds" }
  },
  {
    client: "CRDLE",
    note: "US. Embedded customer service operation in the client's own tools, including two full-time support reps covering EST phone, email, and chat.",
    logo: { src: "/clients/crdle.png", alt: "CRDLE" }
  },
  {
    client: "Medrafa",
    note: "Ethiopia. Pharmaceutical operations dashboard with role-based access, built as a fixed-scope project.",
    logo: { src: "/clients/medrafa.png", alt: "Medrafa" }
  },
  {
    client: "10.13 Enterprise",
    note: "Washington DC. Embedded back-office specialist for BD administration and CRM operations.",
    logo: { src: "/clients/10-13.png", alt: "10.13 Enterprise" }
  },
  {
    client: "HK Financial Advisory",
    note: "Virginia. Financial advisory website.",
    logo: { src: "/clients/hk-financial.svg", alt: "HK Financial Advisory" }
  },
  {
    client: "Signature Residence",
    note: "Ethiopia. Real estate website.",
    logo: {
      src: "/clients/signature-residence.png",
      alt: "Signature Residence"
    }
  },
  {
    client: "USP Transportation",
    note: "US. Transportation company website.",
    logo: { src: "/clients/usp.webp", alt: "USP Transportation" }
  },
  {
    client: "Stratech Consulting",
    note: "Google for Jobs AI Research, SEO and Recruitment Support.",
    logo: { src: "/clients/stratech.webp", alt: "Stratech Consulting" }
  }
];

// ------------------------------------------------------------------ helpers

/**
 * A detail page is earned. A case is published only when it carries enough
 * narrative to be worth reading: the problem or situation, and at least one
 * outcome. Missing engineering decisions do not block publication, because the
 * page renders that gap honestly.
 */
export function hasDetailPage(c: CaseStudy): boolean {
  const hasOutcome = c.outcomes.length > 0;
  return c.kind === 'system'
    ? Boolean(c.problem) && c.system.length > 0 && hasOutcome
    : Boolean(c.situation) && hasOutcome;
}

export const publishedCases = () => caseStudies.filter(hasDetailPage);

export const featuredCases = () =>
  publishedCases()
    .filter((c) => c.featured !== false)
    .sort((a, b) => Number(a.featured) - Number(b.featured));

export const getCase = (slug: string) =>
  caseStudies.find((c) => c.slug === slug && hasDetailPage(c));

export const relatedCases = (slug: string, limit = 2) =>
  publishedCases()
    .filter((c) => c.slug !== slug)
    .slice(0, limit);

export const clientName = (c: Client) =>
  c.named ? c.name : c.descriptor;
