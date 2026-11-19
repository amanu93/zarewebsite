import Link from 'next/link';

import { type CaseStudy, clientName } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { panelSurface, linkSurface } from '@/components/content/surface';

export function RelatedWork({ cases }: { cases: readonly CaseStudy[] }) {
  if (cases.length === 0) return null;

  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {cases.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/work/${c.slug}`}
            className={`${panelSurface} ${linkSurface} flex h-full flex-col gap-3 p-7 no-underline`}
          >
            <MonoLabel className="text-[var(--accent-text)]">
              {clientName(c.client)} · {c.industry}
            </MonoLabel>
            <p className="font-display text-heading text-[var(--heading-color)]">
              {c.summary}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
