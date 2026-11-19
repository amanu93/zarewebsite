import { cn } from '@/lib/utils';

interface MetricProps {
  /**
   * Rendered verbatim. A string, never a number: ranges, comparators and units
   * are part of the fact. `>99%`, `1-2 wks`, `12+ mo`, `[—]`.
   */
  value: string;
  label: string;
  /**
   * `false` renders the value dimmed and appends the note. Unverified numbers
   * are shown as visible gaps rather than removed, because an admitted gap is
   * what makes the other numbers on the page believable.
   */
  verified?: boolean;
  /** Required when `verified` is false. Explains what the placeholder is. */
  note?: string;
  className?: string;
}

export function Metric({
  value,
  label,
  verified = true,
  note,
  className,
}: MetricProps) {
  return (
    <div className={cn('font-mono', className)}>
      <span
        className={cn(
          'block text-metric text-[var(--heading-color,currentColor)]',
          !verified && 'opacity-25',
        )}
      >
        {value}
      </span>
      <span className="mt-3 block text-label uppercase text-[var(--muted-color,currentColor)]">
        {label}
        {!verified && note ? ` · ${note}` : null}
      </span>
    </div>
  );
}
