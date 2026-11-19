import type { CSSProperties } from 'react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { MonoLabel } from '@/components/typography/mono-label';
import { servicePaths } from '@/content/services';
import { MobiusHeroCanvas } from '@/components/three/mobius-hero-canvas';

// Imported directly rather than through next/dynamic. MobiusHeroCanvas is a
// client component that renders null until Three.js has loaded inside an
// effect, so it contributes nothing to the server render and Three never
// enters the initial bundle. `dynamic(..., { ssr: false })` is additionally
// not allowed from a Server Component in Next 16.

/**
 * S1 — Hero, Möbius variant.
 *
 * The scroll narrative (all ranges live as named constants in
 * mobius-hero-canvas.tsx):
 *
 *   0  resting     the full proposition: eyebrow, headline, two lines,
 *                  both path cards, the work link — over the rest field
 *   1  dispersing  cards travel out in X, head lifts, field compresses
 *   2  forming     the write: staggered streams become the Möbius strip
 *   3  formed      THE HOLD — ring complete and alive (rotation,
 *                  breathing, loop light), no copy. A beat to see it.
 *   4  message     one statement beside the living ring, latched
 *   5  released    the scene holds; the header goes solid; the next
 *                  section arrives over the finished ring. No dispersal.
 *
 * The three rules from hero.tsx govern this section unchanged:
 *
 * 1. The copy NEVER waits for the animation. State 0 is server-rendered at
 *    full opacity over a static gradient. If Three.js fails to load, WebGL
 *    is unavailable, or the visitor prefers reduced motion, the hero is
 *    state 0 and nothing else, permanently — one viewport, never pinned.
 *    Coarse pointers get the engine's own timed formation behind a
 *    single-viewport hero: no pin, no scrubbing, cards never leave.
 *
 * 2. The sequence is fully reversible. Scrolling back up returns the cards
 *    and the headline and lowers the message back out, because everything
 *    is a pure function of scroll position.
 *
 * 3. The cards leave and do not return. `TwoPaths` is the third section on
 *    the page and offers the same choice again at full weight.
 */

/**
 * State-4 statement. Approved copy — the v3 strategy review's "most
 * differentiated sentence available" (docs/superpowers/specs/2026-08-06
 * product-strategy-review; final-gate approved-copy list). Verbatim; do
 * not extend it, and do not demote it to decoration: it is real content,
 * so it is NOT aria-hidden — visibility is gated in CSS in sync with the
 * scroll latch, so assistive tech sees it exactly when sighted visitors
 * do.
 */
const MESSAGE_COPY = 'One team. Embedded in yours.';

export function HeroMobius() {
  return (
    <div data-hero-scroll data-hero-released="true">
      <section
        data-tone="ink"
        aria-label="Zare Innovations"
        className="relative flex min-h-[100svh] flex-col overflow-hidden bg-surface-ink text-on-dark [[data-scroll-ready]_&]:sticky [[data-scroll-ready]_&]:top-0 [[data-scroll-ready]_&]:h-[100svh]"
        style={{
          // Static, server-rendered. This is the reduced-motion and no-WebGL
          // experience in full, not a placeholder for one.
          backgroundImage:
            'radial-gradient(120% 130% at 50% 38%, #0a2c40 0%, #051c2b 52%, #020f18 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <MobiusHeroCanvas />
        </div>

        {/* Readability haze. Keeps the headline legible over the brightest part
            of the particle formation without dimming the whole canvas. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            backgroundImage:
              'radial-gradient(46% 34% at 50% 52%, rgba(3,16,25,.55), rgba(3,16,25,0) 70%)',
          }}
        />

        {/* State 4 — the message. One semantic statement inside the loop
            of the living ring; the ring does not move, shrink, or become
            a backdrop to accommodate it. Position, entrance and the
            visibility gate live in globals.css; the driver latches
            `is-in` (reversible). */}
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <p
            data-hero-message
            className="font-display text-display-2 text-on-dark-strong"
            style={{ textShadow: '0 2px 30px rgba(2,15,24,.8)' }}
          >
            {MESSAGE_COPY}
          </p>
        </div>

        {/* Top padding is fluid against VIEWPORT HEIGHT, not width.
            The problem it solves is specifically short viewports: a 1366x768
            screen has roughly 630px of inner height once browser chrome is
            subtracted, and the hero stack measured about 725px, which pushed
            the two path cards below the fold. Those cards are the hero's entire
            purpose, so losing them undoes the decision to use them instead of a
            generic button pair.

            clamp(104px, 13vh, 168px) keeps 104px of clearance under the 96px
            header on short screens and opens back up to 168px on tall ones, so
            the hero is not shortened everywhere to fix a laptop. No new
            breakpoint: the query is the viewport itself. */}
        <Container className="relative z-[4] flex flex-1 flex-col pb-12 pt-[clamp(104px,13vh,168px)]">
          <div
            data-hero-head
            className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
          >
            <MonoLabel className="text-accent-bright">
              ዛሬ · Zare means today
            </MonoLabel>

            <h1
              className="max-w-[15em] font-display text-display-1 text-on-dark-strong"
              style={{ textShadow: '0 2px 30px rgba(2,15,24,.8)' }}
            >
              The next leap starts here.
            </h1>

            <p
              className="max-w-[34em] text-body text-on-dark"
              style={{ textShadow: '0 1px 18px rgba(2,15,24,.8)' }}
            >
              Senior engineers, embedded in your team, under US contracts, from
              our Addis Ababa engineering centre.
            </p>

            <p className="max-w-[30em] text-body-sm text-on-dark-muted">
              Engineers who stay with your product, not rotate through your
              account.
            </p>
          </div>

          {/* State 1. The cards part outward in X and clear the frame for the
              strip. They are the primary interactive element of the hero, so
              they lead the exit rather than trailing it: the visitor sees them
              move while the headline is still readable, which reads as the
              page handing over rather than as content disappearing. */}
          <div data-hero-cards className="mt-8 flex flex-col items-center gap-5">
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-4xl">
              {servicePaths.map((path, i) => (
                <Link
                  key={path.id}
                  href={path.cta.href}
                  data-hero-card
                  style={{ '--dir': i === 0 ? -1 : 1 } as CSSProperties}
                  className="group flex flex-col gap-2 rounded-lg border border-rule-dark bg-[rgba(4,22,33,.6)] p-6 text-left no-underline backdrop-blur-[6px] transition-colors hover:border-accent hover:bg-[rgba(4,26,38,.72)]"
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-display text-body font-semibold text-on-dark-strong">
                      {path.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-accent transition-transform group-hover:translate-x-1.5"
                    >
                      →
                    </span>
                  </span>
                  <span className="text-body-sm text-on-dark-muted">
                    {path.headline}
                  </span>
                  {path.subPaths ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {path.subPaths.map((sub) => (
                        <span
                          key={sub.tag}
                          className="whitespace-nowrap border border-rule-dark px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-bright"
                        >
                          {sub.tag.split('·')[1]?.trim() ?? sub.tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>

            <Link
              href="/work"
              className="font-mono text-label uppercase text-on-dark-muted no-underline transition-colors hover:text-accent"
            >
              Explore our work →
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
