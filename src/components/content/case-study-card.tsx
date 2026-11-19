import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Heading } from '@/components/typography/heading';
import { MonoLabel } from '@/components/typography/mono-label';
import { panelSurface, linkSurface } from './surface';

export interface CaseStudyCardProps {
  /** Client organisation. Never "a leading US company"; unnamed clients read as invented. */
  client: string;
  industry: string;
  location: string;
  title: string;
  /** One line. The outcome, not the deliverable. */
  summary: string;
  href: string;
  /** Verified outcome figures. Rendered verbatim; ranges and comparators intact. */
  metrics?: readonly { value: string; label: string }[];
  stack?: readonly string[];
  image?: { src: string; alt: string };
  /** Above-the-fold card on a page. Sets image priority. */
  priority?: boolean;
  className?: string;
}

/**
 * A single piece of delivered work, as a card.
 *
 * The whole card is one link target: partial hit areas inside cards are a
 * recurring accessibility and usability failure. Where no screenshot exists
 * yet, the image area is simply omitted rather than filled with stock imagery.
 */
export function CaseStudyCard({
  client,
  industry,
  location,
  title,
  summary,
  href,
  metrics,
  stack,
  image,
  priority,
  className,
}: CaseStudyCardProps) {
  return (
    <article className={cn(panelSurface, linkSurface, 'group', className)}>
      <Link href={href} className="flex h-full flex-col no-underline">
        {image ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[var(--rule-color)]">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={priority}
              sizes="(max-width: 900px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 ease-enter group-hover:scale-[1.04]"
            />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-3.5 p-6 md:p-8">
          <MonoLabel className="text-[var(--accent-text)]">
            {client} · {industry} · {location}
          </MonoLabel>

          <Heading level={3} size="display-3">
            {title}
          </Heading>

          <p className="text-body-sm text-[var(--muted-color,currentColor)]">
            {summary}
          </p>

          {metrics?.length ? (
            <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-3">
              {metrics.map((m) => (
                <div key={m.label}>
                  <dd className="font-mono text-[22px] font-medium tabular-nums text-[var(--accent-text)]">
                    {m.value}
                  </dd>
                  <dt className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted-color,currentColor)]">
                    {m.label}
                  </dt>
                </div>
              ))}
            </dl>
          ) : null}

          {stack?.length ? (
            <ul className="mt-auto flex flex-wrap gap-2 pt-2">
              {stack.map((tech) => (
                <li
                  key={tech}
                  className="border border-[var(--rule-color)] px-2.5 py-1 font-mono text-[11px] tracking-wide text-[var(--muted-color,currentColor)]"
                >
                  {tech}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
