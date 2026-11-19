# Changelog

Notable changes to the Zare website, newest first. Format: date · commit ·
what changed and why it matters.

## 2026-08-14

### The Scale Challenge (`feat/scale-challenge`)

An interactive lead-generation game at `/scale-challenge`, ported from the
v2 design mockup (docs/scale-challenge-ui-mockups): pick a mission, staff
five roles three ways — local hire, outsourced package, embedded talent —
survive two mid-game events, and get a Scale Score /1000 with an archetype,
cost comparisons, and a consultative hire/outsource/embed framework. The
"Get my team blueprint" form sends the exact played mix through the
Resend inquiry pipeline (shared rate limiter extracted to `lib/rate-limit`).
The game engine is pure, DOM-free, and unit-tested (vitest — the repo's
first test suite); UI is fully in the site's design language with the
embedded model wearing the brand teal. Accessibility: focus-trapped
modals via `inert`, reduced-motion users skip steppers and the score
reveal. Also fixed en route: a react-hooks lint error in the site header.

## 2026-08-13

### Expressive category icons (`b18f37d`)

Tabler line icons at the deck's spec (stroke 1.9, round caps, accent
colour) on every categorical group: the BUILD/RUN/DELIVER stack, all ten
engagement-timeline steps, the embedded sub-paths and commercial
highlights, the security columns, the contact steps, About's delivery
nodes and pillars, and the FAQ groups. Deliberately not on headings —
the eyebrow's accent rule stays the brand mark — and not on sequences
where numbering is the information (the vetting pipeline).

### New pages: /about and /faq (`f28f717`)

**/about** — the company in the profile's own words: the official tagline
("Software that ships. Talent that delivers.") leads the page, followed by
the who-we-are narrative, the at-a-glance strip (40+ / 20+ / 2 years / 4
service lines / 5.0 Clutch linked), the Delaware-governance and
Addis-engineering delivery nodes, the four Why-Zare pillars, leadership
portraits, and the 30-minute offer. **/faq** — 14 verified-copy questions
in four groups with native disclosures and FAQPage JSON-LD generated from
the same data. Both wired into header/footer navigation and the sitemap.

### Profile integration — the voice pass (`ea28908`)

The profile's language landed on the page: engine headlines verbatim
("Production systems, not prototypes." / "Your team member, our payroll."),
the EOR model stated plainly on the embedded path, Engine 1's real scope
list (multi-agent, RAG, MCP, voice/multimodal, ERP/CRM), SEO positioning
switched to the cover subhead ("Two engines, one firm"), and countries
served corrected 6 → 7.

### Profile integration — remaining items closed (`f686244`)

- **Leadership portraits** from the official Company Profile 2026 shoot on
  the People section (founder 200px frame, leadership rows 56px), the
  deck's portrait treatment at site scale.
- **The opening offer** on the Contact CTA, verbatim: "…the first
  conversation is 30 minutes and costs nothing."
- **Kagool and Joveo** promoted from one-line references to full engagement
  case pages — the profile verifies their figures. `/work` now publishes
  six detail pages.
- **The 5.0 Clutch rating links to the profile**
  (clutch.co/profile/zare-innovations), closing the standing "unlinked
  rating is an assertion" TODO. `FactBlock` accepts linked facts.
- **Deliberately held back** (decisions, not omissions): founder quote
  stays unpublished pending sign-off; "Top 2%" and SOC 2 claims stay off
  (unverified outside the older Enterprise deck); engineers stay unnamed
  (no consent); Emanuel stays "CEO" per the approved PDF.
- The reveal-on-navigation fix was backported to the legacy `zare-website`
  repo (local commit `a0e2f1f` on `v3-m0-foundation`, not pushed).

### Profile integration M3 — the design language on the page (`0940fa6`)

Visible changes, all sourced from the official Company Profile 2026:

- **Atmosphere backgrounds** on the dark homepage sections — the profile's
  layered ground (sonar ring pairs, 68px graph grid, corner glows), with
  ring anchors varied per section and a rings-free "quiet" variant on dense
  ones. `Section` gained `atmosphere` / `atmosphereAnchors` props.
- **New "In their words" section** after Featured Work: the four verbatim,
  attributed client testimonials (Pickrell, Mastercard Africa Growth Fund,
  KeySquare Labs, Exelia). The Clutch-verified quote carries the page's
  single highlight surface.
- **Engagement timelines** in How we deliver: the profile's two 5-step
  lifecycles (project: scoping → discovery → fixed proposal → build cycles →
  handoff; placement: discovery call → candidates → interview → trial →
  confirmed) with their day/week markers. Embed facts now include the
  risk-free trial commitment, which the profile puts in writing.
- **Hiring comparison table** closing the Embedded Teams path: in-house US
  hire vs Zare embedded (first candidate 3–9 wks vs 2–4 wks; wrong fit:
  full salary + restart vs $0 during trial + free replacement).
- **Client logo plates** on the trust strip: client cards carry their
  mark on a white plate. Assets live under `public/clients/` because the
  `/our-work/:path*` redirect shadows `public/our-work/`.

### Profile integration M2 — design tokens and recipes (`4385978`)

The Company Profile 2026 (V4 deck) design language folded into the token
system: `rule-neutral` / `rule-strong` hairlines, `accent-depth` (gradient
partner, never flat), `.surface-highlight` (the single featured treatment,
one per view), `.logo-plate`, and `[data-atmosphere]` grounds. The site's
teal and dark hairline were already the deck's exact values.

### Fix: sections blank after client-side navigation (`0eee7f1`)

`AnimGate` observed `[data-reveal]` elements only once, at first mount in
the persistent `(site)` layout — every element mounted by a later
client-side navigation was never observed and stayed at `opacity: 0`
forever (no error, just an empty section; hard reloads were unaffected).
A MutationObserver now hands newly-mounted elements to the observer, or to
a re-armed failsafe when the observer cannot run (hidden documents). The
failsafe is cancelled once the observer owns the page, restoring scroll
animations beyond the 3-second mark.

### Profile integration M1 — content data layer (`fd287f3`)

All copy aligned with the leader-approved Company Profile 2026 PDF:

- Leadership titles corrected: Nathnael Gebreselassie CTO → **CRO · Sales &
  Business Development**; Emanuel Nebiyu Samuel credited as **CEO**.
- Metrics band: the `[—]` uptime placeholder replaced by the verified
  **40+ engineers and specialists** roster figure.
- Tenasol and KEFI Gold & Copper promoted out of `pendingClients` — the
  profile documents both engagement shapes.
- Two new case studies: **Womentor Africa** (AFIG Funds / Mastercard
  Foundation, homepage-featured, with quote) and **Tenasol** (the
  design-to-embedded conversion). `/work` now publishes four detail pages.
- `content/testimonials.ts` added (consumed by M3's section).

### Initial import (`c43e281`)

Full working tree of `zare-website` at `v3-m0-foundation` (`0b7cd35`, the
globe-reveal hero checkpoint) as a fresh history: v3 hero variants (Z-mark,
Möbius, globe reveal), redesigned header, tracked decision records and v3
specs.
