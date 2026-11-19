import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ContainerProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}

/**
 * The site's single horizontal measure: 1400px max, 56px gutters, 24px on
 * mobile. There is deliberately no width variant. Every full-width band on the
 * page aligns to the same edge, and that alignment is most of what makes a
 * long page read as one document rather than stacked sections.
 */
export function Container({ children, as: Tag = 'div', className }: ContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-site px-gutter-mobile md:px-gutter',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
