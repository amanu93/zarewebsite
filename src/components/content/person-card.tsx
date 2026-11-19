import Image from 'next/image';

import { cn } from '@/lib/utils';
import { MonoLabel } from '@/components/typography/mono-label';
import { panelSurface } from './surface';

export interface PersonCardProps {
  name: string;
  role: string;
  photo?: { src: string; alt: string };
  /** What this person actually built. The strongest field on the card. */
  built?: string;
  stack?: readonly string[];
  /** Year they joined. Tenure is the evidence behind the retention claim. */
  withZareSince?: string;
  linkedin?: string;
  className?: string;
}

/**
 * A named person, with what they built and how long they have been here.
 *
 * This component carries more of the site's argument than any other. The
 * product is engineers, and most competitors structurally cannot show you who
 * will do the work. `built` and `withZareSince` are the fields that matter:
 * one proves capability, the other proves retention.
 *
 * Photography is proof, not decoration. Where no portrait exists the card
 * degrades to initials rather than a stock headshot, because a labelled
 * absence is more honest than a stranger's face.
 */
export function PersonCard({
  name,
  role,
  photo,
  built,
  stack,
  withZareSince,
  linkedin,
  className,
}: PersonCardProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return (
    <article className={cn(panelSurface, 'flex flex-col', className)}>
      <div className="relative aspect-[4/5] w-full overflow-hidden border-b border-[var(--rule-color)] bg-surface-navy">
        {photo ? (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 900px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center font-display text-display-3 text-on-dark-muted"
          >
            {initials}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
        <div>
          <h3 className="font-display text-heading text-[var(--heading-color,currentColor)]">
            {name}
          </h3>
          <MonoLabel muted className="mt-1 block">
            {role}
          </MonoLabel>
        </div>

        {built ? (
          <p className="text-body-sm">
            <span className="text-[var(--muted-color,currentColor)]">
              Built:{' '}
            </span>
            {built}
          </p>
        ) : null}

        {stack?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {stack.map((tech) => (
              <li
                key={tech}
                className="border border-[var(--rule-color)] px-2 py-0.5 font-mono text-[11px] text-[var(--muted-color,currentColor)]"
              >
                {tech}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {withZareSince ? (
            <MonoLabel muted size="caption">
              With Zare since {withZareSince}
            </MonoLabel>
          ) : (
            <span />
          )}
          {linkedin ? (
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-wide text-[var(--accent-text)] hover:underline"
            >
              LinkedIn
              <span className="sr-only"> profile for {name}</span>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
