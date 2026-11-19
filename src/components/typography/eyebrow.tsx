import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

/**
 * The section kicker: a short mono label preceded by a 26px accent rule.
 *
 * This is the site's most repeated brand mark, so it is a component rather
 * than a utility class. Colour comes from `--eyebrow-color`, set by the
 * enclosing Section: accent-bright on dark, muted on light. Teal is never
 * used as small text on a light ground, because it fails WCAG AA there.
 */
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-mono text-label uppercase',
        'text-[var(--eyebrow-color,currentColor)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-0.5 w-[26px] shrink-0 bg-accent"
      />
      {children}
    </span>
  );
}
