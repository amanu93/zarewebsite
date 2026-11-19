import Image from 'next/image';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Metric } from '@/components/data/metric';
import { Reveal } from '@/components/motion/reveal';
import {
  founder,
  founderQuote,
  leadership,
  WAGE_FLOOR,
  ENGINEERS_PENDING,
} from '@/content/people';
import { caseStudies } from '@/content/work';

/**
 * S7 — The people, and why they stay.
 *
 * The argument runs mechanism, then evidence, then humans:
 *
 *   1. We pay above the market            the mechanism
 *   2. Engagements last years             the evidence it works
 *   3. Here are the accountable people    who you are dealing with
 *
 * That order matters. Stated on its own the wage floor reads as CSR, which a
 * client buyer discounts immediately. Placed in front of two multi-year
 * engagements it reads as the reason those engagements exist, which is the
 * thing they are actually buying.
 *
 * Durations are derived from the case studies rather than retyped, so the
 * evidence cannot drift from the work pages.
 */

function retentionEvidence() {
  return caseStudies
    .filter((c) => Boolean(c.duration))
    .map((c) => ({
      client: c.client.named ? c.client.name : c.client.descriptor,
      duration: c.duration as string,
      slug: c.slug,
    }));
}

export function People() {
  const evidence = retentionEvidence();

  return (
    <Section
      tone="ink"
      id="people"
      label="The people, and why they stay"
      atmosphere="rings"
      atmosphereAnchors={['16% 78%', '30% 78%']}
    >
      <Eyebrow>The people</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[17em]">
        We pay above the market because retention is the product.
      </Heading>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* ---------------------------------------------- the mechanism */}
        <div>
          <Metric value={WAGE_FLOOR.value} label={WAGE_FLOOR.label} />
          <MonoLabel muted size="caption" className="mt-2 block">
            {WAGE_FLOOR.detail}
          </MonoLabel>

          <p className="mt-8 max-w-[34em] text-body text-on-dark-muted">
            It is not a benefit. Clients hire embedded teams because the same
            engineers are still there a year later, and the only reliable way
            to make that true is to make leaving a bad decision.
          </p>
        </div>

        {/* ------------------------------------------------ the evidence */}
        <div className="border-t border-[var(--rule-color)] pt-8 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
          <MonoLabel muted>What that produces</MonoLabel>
          <dl className="mt-6 flex flex-col">
            {evidence.map((e, i) => (
              <Reveal
                key={e.slug}
                delay={i * 70}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--rule-color)] py-4 first:pt-0"
              >
                <dt className="font-display text-body font-semibold text-on-dark-strong">
                  {e.client}
                </dt>
                <dd className="font-mono text-body tabular-nums text-[var(--accent-text)]">
                  {e.duration}
                </dd>
              </Reveal>
            ))}
          </dl>
          <p className="mt-6 max-w-[30em] text-body-sm text-on-dark-muted">
            The same engineers, on the same product, across years rather than
            sprints.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------- the humans */}
      <div className="mt-20 border-t border-[var(--rule-color)] pt-12">
        <MonoLabel muted>Accountable for the work</MonoLabel>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            {/* Official portrait from the Company Profile 2026 shoot. Square
                with the hairline border, faces biased upward — the deck's
                portrait frame, at the site's scale. */}
            {founder.photo ? (
              <Image
                src={founder.photo.src}
                alt={founder.photo.alt}
                width={200}
                height={200}
                className="mb-7 h-[200px] w-[200px] border border-[var(--rule-color)] object-cover object-[center_20%]"
              />
            ) : null}
            <p className="font-display text-display-3 text-on-dark-strong">
              {founder.name}
            </p>
            <MonoLabel muted className="mt-2 block">
              {founder.role}
            </MonoLabel>

            {/* Renders only once the founder has signed off. A quote is
                attributed to a real person; publishing it early would put
                words in their mouth. */}
            {founderQuote.approved ? (
              <blockquote className="mt-6 max-w-[34em] font-display text-display-3 text-on-dark-strong">
                {founderQuote.text}
              </blockquote>
            ) : null}
          </div>

          <ul className="flex flex-col gap-5">
            {leadership.map((p) => (
              <li
                key={p.name}
                className="flex items-center gap-4 border-b border-[var(--rule-color)] pb-4"
              >
                {p.photo ? (
                  <Image
                    src={p.photo.src}
                    alt={p.photo.alt}
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 border border-[var(--rule-color)] object-cover object-[center_20%]"
                  />
                ) : null}
                <span className="flex flex-1 flex-wrap items-baseline justify-between gap-3">
                  <span className="font-display text-body font-semibold text-on-dark-strong">
                    {p.name}
                  </span>
                  <MonoLabel muted size="caption">
                    {p.role}
                  </MonoLabel>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The strongest proof available here is a named engineer with their
            stack and their tenure. It is also the most useful thing a
            recruiter could be handed, so it is a founder decision. Labelled
            rather than quietly omitted. */}
        {ENGINEERS_PENDING ? (
          <div className="mt-12 max-w-[42em] border border-dashed border-[var(--rule-color)] p-7">
            <MonoLabel className="text-[var(--accent-text)]">
              Engineers · pending consent
            </MonoLabel>
            <p className="mt-3 text-body-sm text-on-dark-muted">
              We would rather show you the engineers than their managers. Naming
              someone publicly, with what they built and how long they have been
              here, is their decision to make and we are asking. Until then, ask
              us and you will meet the actual team on the first call.
            </p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
