import { cn } from '@/lib/utils';
import { Eyebrow } from '@/components/typography/eyebrow';

interface FactBlockProps {
  /** Short heading for the group, e.g. "Verified". */
  title?: string;
  /**
   * Each entry is a single checkable fact: an entity name, a location, a
   * rating, a jurisdiction. Facts are structurally costly to fake, which is
   * why they persuade. Claims do not belong here.
   *
   * A fact with an `href` renders as a link to where it can be checked —
   * an unlinked rating is an assertion, a linked one is evidence.
   */
  facts: readonly (string | { fact: string; href?: string })[];
  className?: string;
}

/**
 * A checked list of verifiable facts. Used for the trust strip's credential
 * column and anywhere a claim needs to be stated as a record rather than a
 * sentence.
 */
export function FactBlock({ title, facts, className }: FactBlockProps) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {title ? <Eyebrow className="mb-1.5">{title}</Eyebrow> : null}
      <ul className="flex flex-col gap-2.5">
        {facts.map((entry) => {
          const fact = typeof entry === 'string' ? entry : entry.fact;
          const href = typeof entry === 'string' ? undefined : entry.href;
          return (
            <li
              key={fact}
              className="flex items-baseline gap-2.5 font-mono text-caption tabular-nums"
            >
              <span
                aria-hidden="true"
                className="text-[var(--accent-text,currentColor)]"
              >
                ✓
              </span>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-text)] underline decoration-[rgba(64,193,199,.4)] underline-offset-2 hover:decoration-current"
                >
                  {fact}
                </a>
              ) : (
                <span>{fact}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
