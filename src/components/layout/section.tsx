import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Container } from './container';

/**
 * `tone` is the section's ground. The homepage uses three tonal acts rather
 * than alternating every section: dark for orientation, light for evidence,
 * dark again for people. Adjacent sections should not share a tone.
 */
type Tone = 'ink' | 'deep' | 'navy' | 'paper' | 'mist';

const TONE: Record<Tone, string> = {
  ink: 'bg-surface-ink text-on-dark',
  deep: 'bg-surface-deep text-on-dark',
  navy: 'bg-surface-navy text-on-dark',
  paper: 'bg-surface-paper text-on-light',
  mist: 'bg-surface-mist text-on-light',
};

export const isDarkTone = (tone: Tone) =>
  tone === 'ink' || tone === 'deep' || tone === 'navy';

interface SectionProps {
  children: ReactNode;
  tone: Tone;
  /** Anchor target. Must be unique across the page. */
  id?: string;
  /** Accessible name. Required unless the section contains its own heading. */
  label?: string;
  /** Tightens vertical padding. Use for dense bands like the trust strip. */
  compact?: boolean;
  /** Opts out of the Container, for full-bleed content such as a photo band. */
  bleed?: boolean;
  /**
   * The profile's layered ground (globals.css, M2). Dark tones only.
   * `rings` is the full treatment; `quiet` drops the rings for dense
   * sections. Vary `atmosphereAnchors` per section — the same backdrop
   * everywhere reads as wallpaper.
   */
  atmosphere?: 'rings' | 'quiet';
  /** Ring-pair anchor positions, e.g. ['16% 78%', '30% 78%']. */
  atmosphereAnchors?: [string, string];
  className?: string;
}

export function Section({
  children,
  tone,
  id,
  label,
  compact,
  bleed,
  atmosphere,
  atmosphereAnchors,
  className,
}: SectionProps) {
  const atmoStyle =
    atmosphere && atmosphereAnchors
      ? ({
          '--atmo-ring-a': atmosphereAnchors[0],
          '--atmo-ring-b': atmosphereAnchors[1],
        } as CSSProperties)
      : undefined;

  return (
    <section
      id={id}
      aria-label={label}
      // Drives --heading-color and --rule-color for descendants. See globals.css.
      data-tone={tone}
      data-atmosphere={
        atmosphere === 'quiet' ? 'quiet' : atmosphere ? '' : undefined
      }
      style={atmoStyle}
      className={cn(
        TONE[tone],
        compact
          ? 'py-section-mobile md:py-section-compact'
          : 'py-section-mobile md:py-section',
        className,
      )}
    >
      {bleed ? children : <Container>{children}</Container>}
    </section>
  );
}
