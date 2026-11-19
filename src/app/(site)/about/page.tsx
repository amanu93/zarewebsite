import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  IconBuildingBank,
  IconBuildingSkyscraper,
  IconAward,
  IconWorld,
  IconShieldCheck,
  IconStack2,
} from '@tabler/icons-react';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Metric } from '@/components/data/metric';
import { Reveal } from '@/components/motion/reveal';
import { panelSurface } from '@/components/content/surface';
import { siteUrl } from '@/constants';
import {
  ABOUT_TAGLINE,
  ABOUT_KICKER,
  narrative,
  atAGlance,
  deliveryNodes,
  pillars,
} from '@/content/about';
import { founder, leadership } from '@/content/people';
import { officePhotos } from '@/content/office';
import { OPENING_OFFER } from '@/content/contact';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Custom AI & software builds, and embedded talent strictly vetted to high global standards. Two engines, one firm — Delaware, USA and Addis Ababa, Ethiopia.',
  alternates: { canonical: `${siteUrl}/about` },
};

/**
 * /about — the company, in the profile's own words.
 *
 * The homepage argues with evidence; this page answers the direct question
 * "who are these people". Content is the Company Profile 2026 narrative
 * (content/about.ts), the delivery structure, the four pillars, and the
 * leadership block shared with the homepage. The profile's cover tagline
 * leads here — the homepage hero deliberately keeps its own line.
 */
/** Governance seat vs engineering hub; the four pillars in data order:
 *  standards, global trust, the trial, multi-level vetting. */
const NODE_ICONS = [IconBuildingBank, IconBuildingSkyscraper] as const;
const PILLAR_ICONS = [IconAward, IconWorld, IconShieldCheck, IconStack2] as const;

export default function AboutPage() {
  const people = [founder, ...leadership];

  return (
    <>
      <Header />

      <main id="main" className="pt-header-h md:pt-header-h-md">
        <Section tone="ink" label="About Zare" atmosphere="rings">
          <Eyebrow>About Zare</Eyebrow>
          <Heading level={1} size="display-1" className="mt-6 max-w-[13em]">
            {ABOUT_TAGLINE}
          </Heading>
          <p className="mt-6 max-w-[38em] text-body text-on-dark-muted">
            {ABOUT_KICKER}
          </p>
        </Section>

        <Section tone="paper" label="Who we are">
          <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
            <div>
              <Eyebrow>Who we are</Eyebrow>
              <div className="mt-8 flex max-w-[44em] flex-col gap-6">
                {narrative.map((p) => (
                  <p key={p.slice(0, 24)} className="text-body">
                    {p}
                  </p>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--rule-color)] pt-8 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
              <MonoLabel muted>At a glance</MonoLabel>
              <ul className="mt-8 flex flex-col gap-8">
                {atAGlance.map((s) => (
                  <li key={s.label}>
                    {s.href ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        <Metric value={s.value} label={s.label} />
                      </a>
                    ) : (
                      <Metric value={s.value} label={s.label} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The narrative above claims one delivery centre; these are its
              photographs. The wide frame is the room, the pair beneath it
              the two things that actually happen there: the work, and the
              ceremony that is unmistakably Addis. */}
          <div className="mt-16">
            <Reveal variant="clip">
              <Image
                src={officePhotos.workspaceWide.src}
                alt={officePhotos.workspaceWide.alt}
                placeholder="blur"
                sizes="(min-width: 1400px) 1288px, 100vw"
                className="aspect-[21/9] w-full border border-[var(--rule-color)] object-cover"
              />
            </Reveal>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Reveal variant="clip" delay={90}>
                <Image
                  src={officePhotos.engineeringCode.src}
                  alt={officePhotos.engineeringCode.alt}
                  placeholder="blur"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="aspect-[3/2] w-full border border-[var(--rule-color)] object-cover"
                />
              </Reveal>
              <Reveal variant="clip" delay={180}>
                <Image
                  src={officePhotos.coffeeCeremonyPour.src}
                  alt={officePhotos.coffeeCeremonyPour.alt}
                  placeholder="blur"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="aspect-[3/2] w-full border border-[var(--rule-color)] object-cover"
                />
              </Reveal>
            </div>
            <MonoLabel muted size="caption" className="mt-4 block">
              The delivery centre · Addis Ababa
            </MonoLabel>
          </div>
        </Section>

        <Section
          tone="deep"
          label="How Zare is structured"
          atmosphere="rings"
          atmosphereAnchors={['80% 20%', '94% 20%']}
        >
          <Eyebrow>Two nodes, one team</Eyebrow>
          <Heading level={2} className="mt-6 max-w-[16em]">
            Governed in Delaware. Built in Addis Ababa.
          </Heading>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {deliveryNodes.map((node, i) => {
              const NodeIcon = NODE_ICONS[i];
              return (
              <Reveal key={node.label} delay={i * 90}>
                <article className={`${panelSurface} flex h-full flex-col gap-4 p-7`}>
                  <span className="flex items-center gap-3">
                    {NodeIcon ? (
                      <NodeIcon
                        size={24}
                        stroke={1.9}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--accent-text)]"
                      />
                    ) : null}
                    <MonoLabel className="text-[var(--accent-text)]">
                      {node.label}
                    </MonoLabel>
                  </span>
                  <Heading level={3} size="heading">
                    {node.role}
                  </Heading>
                  <p className="text-body-sm text-[var(--muted-color)]">
                    {node.detail}
                  </p>
                  <MonoLabel muted size="caption" className="mt-auto pt-2">
                    {node.place}
                  </MonoLabel>
                </article>
              </Reveal>
              );
            })}
          </div>
        </Section>

        <Section tone="mist" label="Why clients choose Zare">
          <Eyebrow>Why Zare</Eyebrow>
          <Heading level={2} className="mt-6 max-w-[15em]">
            Four reasons, none of them price.
          </Heading>
          <div className="mt-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
            {pillars.map((pillar, i) => {
              const PillarIcon = PILLAR_ICONS[i];
              return (
              <Reveal key={pillar.n} delay={i * 70}>
                <div className="border-t border-[var(--rule-color)] pt-5">
                  <span className="flex items-center justify-between">
                    <MonoLabel className="text-[var(--accent-text)]">
                      {pillar.n}
                    </MonoLabel>
                    {PillarIcon ? (
                      <PillarIcon
                        size={24}
                        stroke={1.9}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--accent-text)]"
                      />
                    ) : null}
                  </span>
                  <Heading level={3} size="heading" className="mt-3">
                    {pillar.title}
                  </Heading>
                  <p className="mt-3 max-w-[34em] text-body-sm text-[var(--muted-color)]">
                    {pillar.body}
                  </p>
                </div>
              </Reveal>
              );
            })}
          </div>
        </Section>

        <Section
          tone="ink"
          label="Leadership"
          atmosphere="rings"
          atmosphereAnchors={['16% 78%', '30% 78%']}
        >
          <Eyebrow>Leadership</Eyebrow>
          <Heading level={2} className="mt-6 max-w-[14em]">
            The people accountable to you.
          </Heading>
          <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {people.map((p, i) => (
              <Reveal as="li" key={p.name} delay={i * 70}>
                {p.photo ? (
                  <Image
                    src={p.photo.src}
                    alt={p.photo.alt}
                    width={280}
                    height={280}
                    className="aspect-square w-full border border-[var(--rule-color)] object-cover object-[center_20%]"
                  />
                ) : null}
                <p className="mt-4 font-display text-body font-semibold text-on-dark-strong">
                  {p.name}
                </p>
                <MonoLabel muted size="caption" className="mt-1 block">
                  {p.role}
                </MonoLabel>
              </Reveal>
            ))}
          </ul>
        </Section>

        <Section tone="deep" label="Next step" compact>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[38em] text-body text-on-dark-muted">
              {OPENING_OFFER}
            </p>
            <Link
              href="/contact"
              className="inline-flex h-12 shrink-0 items-center rounded-md bg-accent px-7 text-[14.5px] font-bold text-accent-contrast no-underline transition-colors hover:bg-accent-bright"
            >
              Start the conversation
            </Link>
          </div>
        </Section>
      </main>

      <Footer />
    </>
  );
}
