/**
 * The /faq page. The honesty doctrine applies here harder than anywhere:
 * an FAQ is where a company is most tempted to answer the question it
 * wishes it were asked. Every answer below is sourced from the Company
 * Profile 2026 or from copy already verified elsewhere on this site
 * (services, delivery, contact) — if we cannot answer from a verified
 * source, the question does not appear.
 *
 * Rendered with FAQPage JSON-LD on /faq; keep answers self-contained plain
 * text so the schema stays truthful to the page.
 */

export interface Faq {
  q: string;
  a: string;
}

export interface FaqGroup {
  title: string;
  items: readonly Faq[];
}

export const faqGroups: readonly FaqGroup[] = [
  {
    title: 'Working with Zare',
    items: [
      {
        q: 'How do we start?',
        a: 'With a conversation: if there is a role you cannot fill or a system you need built, the first conversation is 30 minutes and costs nothing. Send an inquiry through the contact page and we reply within one business day.',
      },
      {
        q: 'Where is Zare based?',
        a: 'Zare Innovations, LLC is headquartered in Middletown, Delaware, with the talent and operations base in Addis Ababa, Ethiopia. Contracts, IP ownership, and account management run through the US entity; engineering, design, and operations talent is recruited and vetted in Addis Ababa. Teams work across US, European, and African time zones.',
      },
      {
        q: 'What are the two ways to work with you?',
        a: 'Two engines, one firm. Engine one is Custom AI & Software: fixed-scope builds, from multi-agent platforms to product and UX design. Engine two is Embedded Talent: vetted engineers, designers, and operations staff placed inside your team as long-term embedded members. Same firm, same vetting bar, one point of accountability.',
      },
    ],
  },
  {
    title: 'Embedded teams',
    items: [
      {
        q: 'What does "embedded" actually mean?',
        a: 'Your embedded team members work inside your workflow: your Slack, your standups, your codebase, your roadmap. They remain part of a stable Zare engineering team, with the management, review, and continuity that implies. Placements are dedicated to one client, never shared.',
      },
      {
        q: 'Who is the legal employer?',
        a: 'Zare is, under an Employer of Record model: Zare is the legal employer in Ethiopia and handles payroll, taxes, and compliance. You direct the work and pay one monthly all-in invoice.',
      },
      {
        q: 'How fast will I see candidates?',
        a: 'First vetted candidates are presented within 1 to 2 weeks of the discovery call. You interview and choose in weeks 2 to 3, the trial starts 3 to 5 days after selection, and a placement typically reaches confirmed long-term status in weeks 4 to 7.',
      },
      {
        q: 'What if the person is not the right fit?',
        a: 'Every placement begins with a risk-free trial: two weeks for individual contributors, three to four weeks for senior placements. Wrong fit, no invoice — and we find a replacement. New clients also get a 30-day risk-free pilot on top of the per-placement trial.',
      },
      {
        q: 'What roles can be embedded?',
        a: 'Technical: software engineers, AI specialists, designers, QA, and product roles. Operational: SDRs, virtual assistants, customer support representatives, accountants, and operations staff. The vetting bar is the same at every level.',
      },
      {
        q: 'How are people vetted?',
        a: 'An eight-step pipeline: application screening, communication assessment, technical assessment, a practical project, technical interview, reference verification, client matching, and ongoing performance review. Everyone on the roster earns at least 50 percent above Ethiopia\'s national average salary — retention on both sides is the point of the model.',
      },
    ],
  },
  {
    title: 'Projects',
    items: [
      {
        q: 'How does a project engagement run?',
        a: 'A paid discovery sprint produces a fixed scope, timeline, and price before the build starts. Work ships in two-week cycles with a reviewable demo at the end of each. Handoff includes a 30-day stabilization window.',
      },
      {
        q: 'What do you build?',
        a: 'Software and AI platforms end to end: multi-agent systems, retrieval-augmented generation, MCP integrations, voice and multimodal AI, full-stack web and mobile platforms, custom ERP and CRM systems, product and UX design, and technical consulting. The AI work runs in production for paying clients, with evaluation and guardrails built in.',
      },
      {
        q: 'Who owns the intellectual property?',
        a: 'You do. IP transfers to you on delivery and final payment, and every contract carries full IP assignment, under US contracts governed by Delaware law.',
      },
    ],
  },
  {
    title: 'Commercial terms',
    items: [
      {
        q: 'How is pricing structured?',
        a: 'Projects are fixed-price: the paid discovery sprint locks scope, timeline, and price before the build starts. Embedded placements are one monthly all-in invoice per person — no recruiter fees, and nothing during a failed trial.',
      },
      {
        q: 'What happens after I send an inquiry?',
        a: 'We reply within one business day. The first conversation is 30 minutes, costs nothing, and ends with a clear next step: a discovery sprint proposal for projects, or a role brief and candidate timeline for embedded teams.',
      },
    ],
  },
];

/** Flat list for the FAQPage JSON-LD. */
export const allFaqs = (): readonly Faq[] =>
  faqGroups.flatMap((g) => g.items);
