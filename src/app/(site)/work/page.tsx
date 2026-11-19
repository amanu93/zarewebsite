import type { Metadata } from 'next';
import Image from 'next/image';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Reveal } from '@/components/motion/reveal';
import { siteUrl } from '@/constants';
import { publishedCases, workReferences } from '@/content/work';
import { officePhotos } from '@/content/office';
import { CaseSpread } from './_components/case-spread';
import { FeaturedCase } from './_components/featured-case';
import { SelectedWorkCard } from './_components/selected-work-card';

/** The order the Company Profile 2026 prints these in, pages 7 → 10. */
const PROFILE_ORDER = [
  'womentor-africa-mentorship-platform',
  'joveo-engineering-pod',
  'pickrell-embedded-engineering-pod',
  'exelia-embedded-designer',
  'tenasol-clinical-platform-design',
  'kagool-vetting-at-volume',
];

export const metadata: Metadata = {
  title: 'Our Work',
  description:
    'Case studies in custom software, AI engineering and embedded teams, delivered from our Addis Ababa engineering centre.',
  alternates: { canonical: `${siteUrl}/work` },
};

export default function WorkPage() {
  // FORMAT FOLLOWS THE PROFILE, not our own featured ranking. The Company
  // Profile gives three cases a page each (Womentor, Tenasol, Kagool) and
  // groups the other three onto one shared page as compact
  // cards (Joveo, Pickrell, Exelia). Reading `profile.format` keeps that
  // split rather than re-deciding it here — and it matters, because a case
  // the profile prints as a card has no problem/what-we-built split to
  // render in the wide layout.
  const all = publishedCases();
  const order = (slug: string) => PROFILE_ORDER.indexOf(slug);
  const spreads = all
    .filter((c) => c.profile?.format !== 'card')
    .sort((a, b) => order(a.slug) - order(b.slug));
  const cards = all
    .filter((c) => c.profile?.format === 'card')
    .sort((a, b) => order(a.slug) - order(b.slug));

  return (
    <>
      <Header />

      <main id="main" className="pt-header-h md:pt-header-h-md">
        <Section tone="ink" label="Engineering work">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <Eyebrow>Our work</Eyebrow>
              <Heading level={1} size="display-1" className="mt-6 max-w-[15em]">
                Systems we built, and teams that stayed.
              </Heading>
              <p className="mt-6 max-w-[36em] text-body text-on-dark-muted">
                Each of these is a real engagement with a named client. Where a
                figure is not yet verified or a client has not cleared
                publication, we say so rather than rounding it into a claim.
              </p>
            </div>

            {/* The page's own subject, photographed: delivered work being
                walked through on the boardroom screen. */}
            <Reveal variant="clip">
              <Image
                src={officePhotos.boardroomScreen.src}
                alt={officePhotos.boardroomScreen.alt}
                placeholder="blur"
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="aspect-[16/10] w-full border border-[var(--rule-color)] object-cover"
              />
            </Reveal>
          </div>
        </Section>

        <Section tone="paper" label="Featured work">
          {/* The cases below are h3. Without this the outline skips h1 -> h3.
              Kept visually hidden because the hero already frames the section
              and a second visible headline here would compete with the cards. */}
          <Heading level={2} size="heading" className="sr-only">
            Featured work
          </Heading>
          {/* The showcased cases get the profile's full case spread — the
              layout it gives a case a whole page for. One per row: the
              format is horizontal by construction, argument beside screen. */}
          <div className="flex flex-col gap-20">
            {spreads.map((c, i) => (
              <Reveal key={c.slug} delay={i * 90}>
                <CaseSpread caseStudy={c} />
              </Reveal>
            ))}
          </div>

          {/* The remaining case studies, in the Company Profile's own order,
              on the compact vertical card. The spread above is the profile's
              one-case-per-page treatment and does not scale to seven; these
              keep the three-up card, which is the profile's own answer for
              cases it groups onto a single spread. */}
          {cards.length > 0 ? (
            <>
              <div className="mt-20 border-t border-[var(--rule-color)] pt-12">
                <Eyebrow>More case studies</Eyebrow>
              </div>
              <div className="mt-10 grid auto-rows-fr gap-5 md:grid-cols-2 lg:grid-cols-3">
                {cards.map((c, i) => (
                  <Reveal key={c.slug} delay={i * 90} className="h-full">
                    <FeaturedCase caseStudy={c} />
                  </Reveal>
                ))}
              </div>
            </>
          ) : null}
        </Section>

        {/* The Company Profile's "Selected Work" spread, reproduced: its
            eyebrow, its headline, its twelve one-line cards, in its order.
            Four across like the printed page, stepping down to two and one
            rather than letting the cards go narrow. */}
        <Section tone="mist" label="Other delivered work">
          <Eyebrow>Selected work</Eyebrow>
          <Heading level={2} size="display-3" className="mt-5 max-w-[20em]">
            The rest of the portfolio.
          </Heading>

          <ul className="mt-10 grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {workReferences.map((ref) => (
              <SelectedWorkCard key={ref.client} reference={ref} />
            ))}
          </ul>
        </Section>
      </main>

      <Footer />
    </>
  );
}
