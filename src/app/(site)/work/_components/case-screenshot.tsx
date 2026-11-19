import Image from 'next/image';

import type { CaseImage, CaseStudy } from '@/content/work';
import { cn } from '@/lib/utils';

/**
 * Product screenshots carry small UI text, which WebP smears at any lossy
 * setting below 100. Must stay listed in `images.qualities` in next.config.ts.
 */
export const SCREENSHOT_QUALITY = 100;

/** What a card shows: the case's chosen cover, else its first screenshot. */
export function coverShot(caseStudy: CaseStudy): CaseImage | undefined {
  return caseStudy.cover ?? caseStudy.images?.[0];
}

/**
 * A case screenshot on a card: the image itself, full width, at its own
 * shape. No frame, stage or drawn window around it — only a 1px hairline in
 * the section's rule colour and the gallery's 8px radius, so a mostly-white
 * screen still has an edge on /work's white ground.
 *
 * Every case image is cropped to 16:10 at source (see `images` in
 * src/content/work.ts), so laying the image out at its natural ratio is what
 * keeps the cards consistent — nothing is cropped here, and a shot that ever
 * arrives at another ratio shows whole rather than cut.
 */
export function CaseScreenshot({
  shot,
  sizes,
  className,
}: {
  shot: CaseImage;
  sizes: string;
  className?: string;
}) {
  return (
    <Image
      src={shot.src}
      alt={shot.alt}
      sizes={sizes}
      quality={SCREENSHOT_QUALITY}
      placeholder="blur"
      className={cn(
        'block h-auto w-full rounded-lg border border-[var(--rule-color)]',
        className,
      )}
    />
  );
}
