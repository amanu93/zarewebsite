import type { Metadata } from 'next';
import Link from 'next/link';
import {
  IconCompass,
  IconUsersGroup,
  IconCode,
  IconReceipt2,
} from '@tabler/icons-react';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';
import { siteUrl } from '@/constants';
import { faqGroups, allFaqs } from '@/content/faq';
import { OPENING_OFFER } from '@/content/contact';

export const metadata: Metadata = {
  title: 'FAQs',
  description:
    'How Zare engagements work: embedded teams, the risk-free trial, the EOR model, project delivery, IP ownership, and pricing structure.',
  alternates: { canonical: `${siteUrl}/faq` },
};

/**
 * /faq — the questions a buyer asks before the first call.
 *
 * Native <details>/<summary> disclosures: no client JS, keyboard and
 * screen-reader behaviour for free, and the browser's find-in-page can
 * still search closed answers in modern engines. Answers come verbatim
 * from content/faq.ts, which sources only verified copy — the FAQPage
 * JSON-LD below must stay truthful to the rendered page.
 */
/** One mark per group, in data order: orientation, embedded teams,
 *  projects, commercial terms. Update alongside content/faq.ts. */
const GROUP_ICONS = [
  IconCompass,
  IconUsersGroup,
  IconCode,
  IconReceipt2,
] as const;

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaqs().map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Header />

      <main id="main" className="pt-header-h md:pt-header-h-md">
        <Section tone="ink" label="Frequently asked questions" atmosphere="rings">
          <Eyebrow>FAQs</Eyebrow>
          <Heading level={1} size="display-1" className="mt-6 max-w-[14em]">
            The questions worth asking first.
          </Heading>
          <p className="mt-6 max-w-[38em] text-body text-on-dark-muted">
            Straight answers on how engagements actually work — the trial, the
            employment model, delivery, and who owns what. If yours is not
            here, the first conversation is free.
          </p>
        </Section>

        <Section tone="paper" label="Questions and answers">
          <div className="flex flex-col gap-16">
            {faqGroups.map((group, gi) => {
              const GroupIcon = GROUP_ICONS[gi];
              return (
              <div key={group.title} className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-16">
                <div className="flex flex-col items-start gap-4">
                  {GroupIcon ? (
                    <GroupIcon
                      size={28}
                      stroke={1.9}
                      aria-hidden="true"
                      className="text-[var(--accent-text)]"
                    />
                  ) : null}
                  <h2 className="m-0">
                    <Eyebrow>{group.title}</Eyebrow>
                  </h2>
                </div>
                <div className="flex flex-col border-t border-[var(--rule-color)]">
                  {group.items.map((f, i) => (
                    <Reveal key={f.q} delay={i * 50}>
                      <details className="group border-b border-[var(--rule-color)]">
                        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                          <span className="font-display text-heading font-semibold text-[var(--heading-color)]">
                            {f.q}
                          </span>
                          <span
                            aria-hidden="true"
                            className="shrink-0 font-mono text-[var(--accent-text)] transition-transform duration-150 group-open:rotate-45"
                          >
                            +
                          </span>
                        </summary>
                        <p className="max-w-[52em] pb-6 text-body-sm text-[var(--muted-color)]">
                          {f.a}
                        </p>
                      </details>
                    </Reveal>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
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
              Ask us directly
            </Link>
          </div>
        </Section>

        <Section tone="mist" label="Related" compact>
          <MonoLabel muted>Related</MonoLabel>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <Link href="/about" className="text-body-sm text-[var(--accent-text)] no-underline hover:underline">
              About Zare →
            </Link>
            <Link href="/work" className="text-body-sm text-[var(--accent-text)] no-underline hover:underline">
              Our work →
            </Link>
            <Link href="/contact" className="text-body-sm text-[var(--accent-text)] no-underline hover:underline">
              Contact →
            </Link>
          </div>
        </Section>
      </main>

      <Footer />
    </>
  );
}
