# Zare website — working rules for Claude

Read this before touching anything. It is short on purpose.

## What this repo is

zareinnovations.com. Next.js 16 (App Router), React 19, TypeScript,
Tailwind v4, pnpm 10.28 (see `packageManager`), Node 24 in CI.

Three areas, three route groups:

- `src/app/(site)` — the public v3 marketing site: home, `/work` and its
  case pages, `/about`, `/faq`, `/contact`, `/careers`, `/scale-challenge`.
  Almost all contribution work happens here.
- `src/app/(marketing)` — careers job detail and the apply flow (Mantine).
- `src/app/admin` — the jobs/applicants admin (Mantine, RTK Query against
  the backend at `NEXT_PUBLIC_API_URL`).

Inside the site: approved copy and verified facts live in `src/content/*.ts`;
homepage sections in `src/app/(site)/_sections`; design primitives in
`src/components` (layout, typography, data, content, motion, three); design
tokens in `src/app/globals.css`; WebGL hero engine in
`src/components/three/globe-write.js` with its scroll driver
`globe-hero-canvas.tsx`.

## Status (2026-09-03)

- v3.0 is live on `main` (PR #69). `main` is production.
- `dev` is the integration branch. Every push to `dev` auto-deploys to the
  dev server (GitHub Actions → SSH → `deploy.sh` → Docker Compose).
- `dev` is promoted to `main` by a maintainer with a rebase branch. Never
  open a PR against `main`.
- Open content items and their fallbacks: `docs/CONTENT-CHECKLIST.md`.
  What shipped when: `CHANGELOG.md`. Architecture decisions: `docs/decisions/`.

## Branch and PR workflow — not optional

1. **Start from a fresh `origin/dev`.**
   `git fetch origin && git checkout -b <type>/<short-name> origin/dev`
   Types: `feat`, `fix`, `docs`, `chore`, `refactor`.
2. **Commit small and clean.** One line, imperative, `type(scope): what
   changed`. Example: `fix(faq): open the first group by default`. No
   trailers: no `Co-Authored-By`, no "Generated with Claude" lines, in
   commits or PR bodies.
3. **Rebase before the PR, every time.**
   `git fetch origin && git rebase origin/dev`
   Resolve conflicts keeping what `dev` intends. Never merge `dev` into the
   branch. Force-push only your own branch, only with `--force-with-lease`.
4. **Verify on the rebased branch** (next section).
5. **Push and open the PR against `dev`.**
   `git push -u origin <branch>` then `gh pr create --base dev`.
   Title: simple and descriptive, one line. Body: a bulleted list of what
   changed, each bullet naming the file(s) it touched. No boilerplate
   checklists.
6. One topic per PR. Never push to `dev` or `main` directly.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm dev            # http://localhost:3000 (Turbopack)
pnpm build && pnpm start   # production check; the build script sets the heap
```

`.env` is gitignored. `NEXT_PUBLIC_API_URL` is only needed for the admin and
careers pages. `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` are only needed to
make the contact forms send; without them the forms reject, by design. Never
commit keys, and never put a key in a Dockerfile.

## Verify before every PR

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. CI runs lint and
  build on every PR; the other two are on you.
- Anything visual: open it in the browser at desktop (1440) and phone (375)
  widths. The homepage hero is a scroll-driven scene: check the resting copy,
  the sphere write, the "Rooted in Ethiopia" block and the release on both
  widths. Full-page screenshots wrap past 16,384px, so capture long pages in
  parts.
- Say what you verified and how. Do not claim a fix works from reading code.

## House rules for the site

- **Tokens only.** `bg-surface-*`, `text-on-dark*` / `text-on-light*`,
  `accent`, `accent-bright`, `accent-ink`, `rule-*`. No raw hex in
  components, no Tailwind default palette (no `teal-600`, no `gray-400`).
  Teal as text on a light ground must be `--accent-text` (accent-ink); the
  bright teal fails contrast on white.
- **Primitives.** Every band is a `Section` with a `tone`; headings through
  `Heading`, kickers through `Eyebrow`, data and metadata through
  `MonoLabel`. Mono type is for facts, never prose.
- **No generic components.** There is no `Card` or `Button` component and
  there will not be one (`docs/decisions/004`). Surfaces come from
  `src/components/content/surface.ts`. Exactly one `surface-highlight` per
  view.
- **Client marks** sit on white plates and keep their own colours.
- **Copy is data.** Edit `src/content/*.ts`, not JSX. Testimonials, metrics
  and client facts are approved or verified; do not paraphrase, invent, or
  add clients, numbers or quotes. No anonymous testimonials. Banned words:
  world-class, best-in-class, cutting edge, seamless, leverage, synergy,
  robust, revolutionary. No "BPO" or "outsourcing" in headlines. No
  certification badges (none are held). Two categories only: 01 Technology &
  AI and 02 Embedded Teams (A Technology Talent, B Business Operations).
- **Motion.** Reveals are gated on `html.anim`; never ship content that is
  hidden by default. Respect `prefers-reduced-motion`.
- **Mobile.** Gutters are 24px and bands 80px on phones, from the tokens.
  Check at 375 before you call it done.
- **Accessibility.** Keep the heading outline (h1 → h2 → h3), give sections
  without a visible heading an `aria-label`, keep `focus-visible` styles.
- **Assets** go under `public/clients` and `public/case-studies`, referenced
  through `next/image`. `public/our-work` is shadowed by a redirect; do not
  use it.
- **Founder marks** stay: the footer ticker `ZARE : ——.——` and the hero's
  `data-route`. Do not remove or explain them.

## Do not

- Touch `Dockerfile*`, `docker-compose*.yml`, `deploy.sh` or `.github/`
  without a maintainer's go-ahead.
- Bump or add dependencies casually; a lockfile change needs a maintainer.
- Edit `docs/zare-website-v3/index.html`; it is the old prototype, kept for
  reference.
- Commit screenshots, scratch files, or `.env`.
- Rewrite history on `dev` or `main`.
