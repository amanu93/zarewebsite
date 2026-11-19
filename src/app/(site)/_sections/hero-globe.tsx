import type { CSSProperties } from 'react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { MonoLabel } from '@/components/typography/mono-label';
import { servicePaths } from '@/content/services';
import { GlobeHeroCanvas } from '@/components/three/globe-hero-canvas';

// Imported directly rather than through next/dynamic — see hero.tsx.

/**
 * S1 — Hero, globe variant. The production hero.
 *
 * The scroll narrative (all ranges live as named constants in
 * globe-hero-canvas.tsx):
 *
 *   0  resting     the full proposition: eyebrow, headline, two lines,
 *                  both path cards, the work link — over the rest field
 *   1  dispersing  cards travel out in X, head lifts, field sweeps up
 *   2  writing     the stream pours down and writes the particle sphere,
 *                  meridian by meridian, just left of centre
 *   3  sphere      the write closes — still pure particles, a plain
 *                  sphere (no continents; geography belongs to the
 *                  revealed globe underneath)
 *   4  reveal      the real v3 dotted Earth fades in as the shell lifts
 *                  off into an orbiting halo — and the descriptive block
 *                  slides in on the right, real content, clickable CTAs
 *   5  dwell       alive and interactive — spin, drag, flights, Addis
 *                  label on hover — through the release; near the end the
 *                  halo pours down toward the clients section and the
 *                  next section arrives over the finished scene
 *
 * The three rules from hero.tsx govern this section unchanged:
 *
 * 1. The copy NEVER waits for the animation. State 0 is server-rendered
 *    at full opacity over a static gradient; every degraded path (reduced
 *    motion, no WebGL, failed assets) is a single unpinned viewport of
 *    it. Phones are NOT a degraded path: they run the same narrative,
 *    with the copy sliding up to reveal its overhang before it exits
 *    (see the phone block in globe-hero-canvas.tsx and globals.css).
 * 2. The sequence is fully reversible — everything is a pure function of
 *    scroll position.
 * 3. The cards leave and do not return. `TwoPaths` offers the same choice
 *    again at full weight.
 */
export function HeroGlobe() {
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
          <GlobeHeroCanvas />
        </div>

        {/* Readability haze, nudged toward the globe's side of the frame. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            backgroundImage:
              'radial-gradient(46% 34% at 42% 50%, rgba(3,16,25,.5), rgba(3,16,25,0) 70%)',
          }}
        />

        {/* State 4. The descriptive block, right of the globe — REAL
            content with clickable CTAs, so no aria-hidden. Position and
            entrance live in globals.css; the driver latches .is-in in the
            reveal window. */}
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <div
            data-hero-desc
            className="pointer-events-auto absolute flex flex-col items-start gap-4"
          >
            <MonoLabel className="text-accent-bright">Global delivery</MonoLabel>
            <h2
              className="font-display font-semibold text-on-dark-strong"
              style={{
                fontSize: 'clamp(26px, 3vw, 44px)',
                lineHeight: 1.12,
                letterSpacing: '-0.01em',
                textShadow: '0 2px 26px rgba(2,15,24,.85)',
              }}
            >
              Rooted in Ethiopia. Connected to the world.
            </h2>
            <p
              className="text-body text-on-dark"
              style={{
                maxWidth: '46ch',
                textShadow: '0 1px 18px rgba(2,15,24,.8)',
              }}
            >
              Our entire delivery operation runs out of Addis Ababa: the
              engineers who build your software, the specialists who automate
              your workflows and guide your AI adoption, and the embedded
              talent who join your team. Vetted to global standards, working
              your hours, accountable through one firm.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-md px-7 font-semibold no-underline transition-opacity hover:opacity-85"
                style={{ background: '#40c1c7', color: '#03141d' }}
              >
                Start a project
              </Link>
              <Link
                href="/work"
                className="inline-flex h-12 items-center rounded-md border px-6 font-semibold no-underline backdrop-blur-[3px] transition-colors hover:border-accent"
                style={{
                  borderColor: 'rgba(64,193,199,.45)',
                  color: '#cfeef0',
                }}
              >
                Explore our work →
              </Link>
            </div>
          </div>
        </div>

        {/* Top padding is fluid against VIEWPORT HEIGHT, not width — see
            hero.tsx for the full rationale. `data-hero-copy` is the
            phone slide's handle: the driver measures this block's
            overhang and CSS translates it. */}
        <Container className="relative z-[4] flex flex-1 flex-col pb-12 pt-[clamp(104px,13vh,168px)]">
          <div data-hero-copy className="flex flex-1 flex-col">
          <div
            data-hero-head
            className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
          >
            {/* Leadership-approved hero copy (2026-08 comment round). The
                eyebrow is deliberately larger than the MonoLabel default. */}
            <MonoLabel className="text-[15px] tracking-[0.18em] text-accent-bright md:text-[17px]">
              ዛሬ · &ldquo;ZARE&rdquo; MEANS TODAY
            </MonoLabel>

            <h1
              className="max-w-[16em] font-display text-display-1 text-on-dark-strong"
              style={{ textShadow: '0 2px 30px rgba(2,15,24,.8)' }}
            >
              AI without people fails. Teams without AI fall behind.
            </h1>

            <p
              className="max-w-[40em] text-body text-on-dark"
              style={{ textShadow: '0 1px 18px rgba(2,15,24,.8)' }}
            >
              We bring the two together: AI systems and automations built for
              your business, run by AI-savvy engineers and operations staff
              who join your team.
            </p>

            <p className="max-w-[34em] text-body-sm text-on-dark-muted">
              40+ specialists. 20+ clients across the US, Europe, and Africa.
              Every placement starts with a risk-free trial.{' '}
              <Link
                href="/#how-we-deliver"
                className="whitespace-nowrap text-accent-bright underline decoration-[rgba(64,193,199,.5)] underline-offset-4 transition-colors hover:text-on-dark-strong"
              >
                See how it works →
              </Link>
            </p>
          </div>

          {/* State 1. The cards part outward in X and clear the frame —
              see hero.tsx for the rationale. */}
          <div data-hero-cards className="mt-8 flex flex-col items-center gap-5">
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-4xl">
              {/* The cards route to their homepage SECTIONS (01 and 02) —
                  the hero offers orientation, not a contact shortcut; the
                  sections carry their own CTAs. */}
              {servicePaths.map((path, i) => (
                <Link
                  key={path.id}
                  href={`/#${path.id}`}
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
                  {/* Both tags on ONE row. At the designed card width
                      (max-w-4xl halved, less p-6, so ~392px) the pair needed
                      ~375-398px depending on how wide the mono face renders
                      — which is why Embedded Teams sat side by side and
                      Technology & AI, whose two labels are six characters
                      longer, tipped over and wrapped. Tighter tracking and
                      padding buy back ~26px, and whitespace-nowrap stops a
                      label breaking mid-phrase. flex-wrap is kept as the
                      genuine narrow-viewport fallback. */}
                  {path.heroTags ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {path.heroTags.map((tag) => (
                        <span
                          key={tag}
                          className="whitespace-nowrap border border-rule-dark px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-bright"
                        >
                          {tag}
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
          </div>
        </Container>
      </section>
    </div>
  );
}
