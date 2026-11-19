import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface MonoLabelProps {
  children: ReactNode;
  as?: ElementType;
  /** Drops to the muted colour of the current surface. */
  muted?: boolean;
  /** Slightly larger, for metadata lines rather than labels. */
  size?: 'label' | 'caption';
  className?: string;
}

/**
 * Mono type carries facts: dates, addresses, entity names, stack names, status,
 * metadata. It is never used for prose.
 *
 * That single rule does most of the work of making the site read as a systems
 * company, and it is what makes a verified fact *look* verified. If the text is
 * a sentence, it belongs in Manrope; if it is a datum, it belongs here.
 */
export function MonoLabel({
  children,
  as: Tag = 'span',
  muted,
  size = 'label',
  className,
}: MonoLabelProps) {
  return (
    <Tag
      className={cn(
        'font-mono tabular-nums',
        size === 'label' ? 'text-label uppercase' : 'text-caption tracking-wide',
        muted && 'text-[var(--muted-color,currentColor)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
