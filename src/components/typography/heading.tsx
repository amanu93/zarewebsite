import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Size = 'display-1' | 'display-2' | 'display-3' | 'heading';

const SIZE: Record<Size, string> = {
  'display-1': 'text-display-1',
  'display-2': 'text-display-2',
  'display-3': 'text-display-3',
  heading: 'text-heading',
};

interface HeadingProps {
  children: ReactNode;
  /**
   * Document outline level. Deliberately independent of `size`: a section
   * heading is usually an h2 rendered at display-1, and an h3 sometimes needs
   * to look larger than the h2 above it. Never pick a level to get a size.
   */
  level: 1 | 2 | 3 | 4;
  size?: Size;
  id?: string;
  className?: string;
}

/**
 * Colour comes from `--heading-color`, which the enclosing `<Section tone>`
 * sets. A heading is therefore correct on any ground without being told which
 * ground it is on.
 */
export function Heading({
  children,
  level,
  size = 'display-2',
  id,
  className,
}: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';

  return (
    <Tag
      id={id}
      className={cn(
        'font-display text-balance text-[var(--heading-color,currentColor)]',
        SIZE[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
