import Link from 'next/link';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { Reveal } from '@/components/motion/reveal';
import { publishedCases } from '@/content/work';
import { results } from '@/content/metrics';
import { CaseSpread } from '../work/_components/case-spread';

/**
 * S4 — Work and results.
 *
 * The load-bearing section. Work and results are merged because they make one
 * argument: separate sections state the same claim twice, and a metric
 * detached from the engagement that produced it is an assertion rather than
 * evidence.
 *
 * The cases use the profile's full case spread, shared with /work: the
 * CASE STUDY badge, the headline in caps, the problem and what was built
 * beside the screenshot, and a bordered band of numbers. The homepage
 * routes; the detail page convinces. Nothing here is a substitute for
 * opening the case study.
 */
export function FeaturedWork() {
  // The profile's own full-page cases, in its order, capped at three for the
  // homepage. Picking by `profile.format` rather than by our featured rank
  // keeps the homepage showing the cases the profile itself gives a page to,
  // and guarantees every one of them has the problem/what-we-built copy the
  // spread needs.
  // publishedCases() preserves work.ts order, which is the profile's page
  // order, so this is Womentor, Tenasol, Kagool — pages 7, 9 and 10.
  const cases = publishedCases()
    .filter((c) => c.profile?.format !== 'card')
    .slice(0, 3);

  return (
    <Section tone="ink" id="work" label="Featured work" atmosphere="quiet">
      <Eyebrow>Featured work</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[13em]">
        Evidence, not adjectives.
      </Heading>

      {/* The profile's full case spread, one per row — the same treatment
          the showcased cases get on /work. */}
      {/* Stacked on a phone, one case ends and the next begins with
          nothing but a gap; a hairline marks the break there. Wide, the
          80px gap is the break. */}
      <div className="mt-14 flex flex-col gap-14 md:gap-20">
        {cases.map((c, i) => (
          <Reveal
            key={c.slug}
            delay={i * 90}
            className="border-t border-[var(--rule-color)] pt-14 first:border-t-0 first:pt-0 md:border-t-0 md:pt-0"
          >
            <CaseSpread caseStudy={c} />
          </Reveal>
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/work"
          className="font-mono text-label uppercase text-[var(--accent-text)] hover:underline"
        >
          All work →
        </Link>
      </div>

      {/* Results band. Closes the section rather than forming its own, so
          the numbers sit next to the engagements that produced them. Deck
          layout (2026-08 comment round): big display numbers, sentence-case
          descriptions, hairline dividers between columns, the accented
          figure carrying its basis in the same breath. */}
      <div className="mt-20 border-t border-[var(--rule-color)] pt-14">
        <Eyebrow>Results</Eyebrow>
        <div className="mt-12 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {results.map((r, i) => (
            <Reveal
              key={r.label}
              delay={i * 70}
              className="sm:border-l sm:border-[var(--rule-color)] sm:pl-10 sm:first:border-l-0 sm:first:pl-0"
            >
              <span
                className={
                  r.accent
                    ? 'block font-display text-display-1 font-bold text-[var(--accent-text)]'
                    : 'block font-display text-display-1 font-bold text-[var(--heading-color)]'
                }
              >
                {r.value}
              </span>
              <p className="mt-4 max-w-[22em] text-body-sm text-[var(--muted-color)]">
                {r.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
