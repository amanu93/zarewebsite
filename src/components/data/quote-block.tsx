import { cn } from '@/lib/utils';
import { MonoLabel } from '@/components/typography/mono-label';

interface QuoteBlockProps {
  quote: string;
  /**
   * `attribution` and `role` are REQUIRED, not optional.
   *
   * This is the no-anonymous-testimonials rule expressed as a type. An
   * unattributed quote reads as invented and costs more trust than it earns,
   * so the component makes one impossible to render rather than leaving it to
   * review. If a quote cannot be attributed, it does not ship.
   */
  attribution: string;
  role: string;
  /** Provenance, e.g. "Verified Clutch review · February 2025". */
  source?: string;
  size?: 'display' | 'inline';
  className?: string;
}

export function QuoteBlock({
  quote,
  attribution,
  role,
  source,
  size = 'inline',
  className,
}: QuoteBlockProps) {
  return (
    <figure className={cn('flex flex-col gap-5', className)}>
      {/* Inline quotes drop to 17px medium below md: at 20px semibold a
          long quote in a phone-width card was a 440px block of bold
          type, and four of them in a row read as shouting. */}
      <blockquote
        className={cn(
          'font-display text-[var(--heading-color,currentColor)]',
          size === 'display'
            ? 'text-display-3'
            : 'text-[17px] font-medium leading-[1.55] md:text-heading md:font-semibold md:leading-snug',
        )}
      >
        <span aria-hidden="true" className="text-[var(--accent-text)]">
          “
        </span>
        {quote}
        <span aria-hidden="true" className="text-[var(--accent-text)]">
          ”
        </span>
      </blockquote>
      <figcaption className="flex flex-col gap-1">
        <span className="font-display text-body-sm font-semibold text-[var(--heading-color,currentColor)]">
          {attribution}
        </span>
        <MonoLabel muted>{role}</MonoLabel>
        {source ? (
          <MonoLabel muted size="caption" className="mt-1">
            {source}
          </MonoLabel>
        ) : null}
      </figcaption>
    </figure>
  );
}
