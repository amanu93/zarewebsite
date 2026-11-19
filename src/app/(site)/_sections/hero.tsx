import type { CSSProperties } from 'react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { MonoLabel } from '@/components/typography/mono-label';
import { servicePaths } from '@/content/services';
import { MarkCanvas } from '@/components/three/mark-canvas';

// Imported directly rather than through next/dynamic. MarkCanvas is a client
// component that renders null until Three.js has loaded inside an effect, so it
// contributes nothing to the server render and Three never enters the initial
// bundle. `dynamic(..., { ssr: false })` is additionally not allowed from a
// Server Component in Next 16.

/**
 * S1 — Hero.
 *
 * A six-state scroll sequence. The state boundaries live in mark-canvas.tsx;
 * this file owns only what is on screen at each one.
 *
 *   0  today's hero exactly: eyebrow, headline, two lines, both path cards
 *   1  the particle stream gathers while the cards travel out of frame in X
 *   2  the Z mark becomes recognisable
 *   3  the mark completes
 *   4  it holds and sways
 *   5  the three pillars peel off the mark, one per scroll window, each
 *      connected to it by a two-way particle stream; labels latch mid-peel
 *   6  the unpin — mark, icons and labels hold their formed, solid state;
 *      the next section arrives over the finished scene, no dispersal
 *
 * Three rules govern this section:
 *
 * 1. The copy NEVER waits for the animation. State 0 is server-rendered at
 *    full opacity over a static gradient. If Three.js fails to load, WebGL is
 *    unavailable, the pointer is coarse, or the visitor prefers reduced
 *    motion, the hero is state 0 and nothing else, permanently.
 *
 * 2. The sequence is fully reversible. Scrolling back up returns the cards and
 *    the headline and retracts the messages, because everything is a pure
 *    function of scroll position rather than a one-way trigger.
 *
 * 3. The cards leave and do not return. That is affordable only because
 *    `TwoPaths` is the third section on the page and offers the same choice
 *    again at full weight. Without it this would strand the visitor.
 */
/** State-5 pillar rows. The icons themselves are particles (mark.js); these
 *  are only the labels that latch beside them mid-peel. */
const pillars = [
  { title: 'CREATE', body: 'Ideas shaped into products, from first sketch.' },
  { title: 'BUILD', body: 'Engineering that ships, embedded in your team.' },
  { title: 'TRANSFORM', body: 'Legacy systems carried into what comes next.' },
];

export function Hero() {
  return (
    <div data-hero-scroll>
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
          <MarkCanvas />
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

        {/* State 5. The three pillars peel out of the mark; aria-hidden here —
            their accessible home is the section that explains them. Position
            and entrance live in globals.css, keyed off the index. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3]"
          data-hero-messages
        >
          {pillars.map((pillar, i) => (
            <div
              key={pillar.title}
              data-hero-msg={i}
              className="absolute flex flex-col gap-1.5"
            >
              <span
                className="font-display font-medium tracking-[0.14em] text-on-dark-strong"
                style={{
                  fontSize: 'clamp(16px, 1.9vw, 26px)',
                  textShadow: '0 2px 24px rgba(2,15,24,.9)',
                }}
              >
                {pillar.title}
              </span>
              <span
                className="text-on-dark-muted"
                style={{
                  fontSize: 'clamp(12px, 1.4vw, 14px)',
                  lineHeight: 1.55,
                  maxWidth: 'min(26ch, 26vw)',
                }}
              >
                {pillar.body}
              </span>
            </div>
          ))}
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
              ring. They are the primary interactive element of the hero, so
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
