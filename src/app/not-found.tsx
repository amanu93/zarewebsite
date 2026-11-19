import type { Metadata } from 'next';
import Link from 'next/link';

import { fontVariables } from '@/styles/fonts';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { email } from '@/constants';

/**
 * Site-wide 404. Server component.
 *
 * Lives at the app root rather than inside `(site)` so it catches every
 * unmatched URL, including ones that never resolve to a route group. The cost
 * of that placement is that the `(site)` layout does not wrap it, so this file
 * applies the font variables and `data-zare-site` scope itself. Without that
 * it would render as unstyled system text, which is what it did before.
 *
 * The header is pinned solid: this page has no dark hero for the transparent
 * state to sit over.
 *
 * A 404 status is itself the instruction not to index; the metadata below
 * states it explicitly so the intent is visible rather than implied.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

const DESTINATIONS = [
  {
    href: '/work',
    label: 'Our Work',
    note: 'Case studies, with the systems and the decisions behind them.',
  },
  {
    href: '/careers',
    label: 'Careers',
    note: 'Open roles in Addis Ababa, and why people stay.',
  },
  {
    href: '/contact',
    label: 'Contact',
    note: 'Start a project or build an embedded team.',
  },
] as const;

export default function NotFound() {
  return (
    <div data-zare-site className={fontVariables}>
      <Header solid />

      <main id="main" className="pt-header-h md:pt-header-h-md">
        <Section tone="ink" label="Page not found">
          <Eyebrow>404</Eyebrow>

          <Heading level={1} size="display-1" className="mt-6 max-w-[14em]">
            That page is not here.
          </Heading>

          <p className="mt-6 max-w-[34em] text-body text-on-dark-muted">
            The link may be out of date, or the page may have moved during our
            recent rebuild. Everything below is where it should be.
          </p>

          <ul className="mt-14 flex flex-col border-t border-[var(--rule-color)]">
            {DESTINATIONS.map((d) => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  className="group flex items-center justify-between gap-6 border-b border-[var(--rule-color)] py-7 no-underline transition-[padding,background-color] duration-150 hover:bg-[rgba(64,193,199,.05)] hover:pl-5"
                >
                  <span className="flex flex-col gap-1.5">
                    <span className="font-display text-display-3 text-on-dark-strong">
                      {d.label}
                    </span>
                    <span className="text-body-sm text-on-dark-muted">
                      {d.note}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[26px] text-accent transition-transform duration-150 group-hover:translate-x-1.5"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <MonoLabel muted size="caption" className="mt-8 block">
            Looking for something specific? Write to{' '}
            <a
              href={`mailto:${email}`}
              className="text-[var(--accent-text)] hover:underline"
            >
              {email}
            </a>
          </MonoLabel>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
