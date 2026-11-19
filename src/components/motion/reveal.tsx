import type { ElementType, ReactNode, CSSProperties } from 'react';

import { cn } from '@/lib/utils';

type RevealVariant = 'rise' | 'fade' | 'clip';

interface RevealProps {
  children: ReactNode;
  /** `rise` moves up 26px, `fade` opacity only, `clip` wipes upward. Images use `clip`. */
  variant?: RevealVariant;
  /** Milliseconds. Use for hand-ordered sequences; keep under ~300ms. */
  delay?: number;
  as?: ElementType;
  className?: string;
}

/**
 * Reveals its children once as they enter the viewport.
 *
 * This is a SERVER component. It renders a marker attribute and nothing else;
 * the transition is CSS and the trigger is the single observer in `AnimGate`.
 * No JavaScript ships per instance, so a page can use a hundred of these
 * without adding a hundred client components.
 *
 * Accessibility: hidden states are declared only under `html.anim`, and
 * `AnimGate` never adds that class under `prefers-reduced-motion`. Content is
 * therefore visible at rest in every environment that cannot animate.
 */
export function Reveal({
  children,
  variant = 'rise',
  delay,
  as: Tag = 'div',
  className,
}: RevealProps) {
  const style = delay
    ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties)
    : undefined;

  return (
    <Tag data-reveal={variant} style={style} className={cn(className)}>
      {children}
    </Tag>
  );
}
