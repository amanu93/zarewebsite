import type { ReactNode } from 'react';

import { fontVariables } from '@/styles/fonts';
import { AnimGate } from '@/components/motion/anim-gate';

/**
 * The rebuilt marketing site.
 *
 * Deliberately carries NO providers. The current `(marketing)` group still
 * needs Mantine and Redux; this one is being built without either, which is
 * the whole point of the M0 provider isolation.
 *
 * The new type stack is applied here rather than in the root layout so the
 * live marketing and admin routes keep Gotham and never download these fonts.
 *
 * `data-zare-site` scopes the design system's base styles. See globals.css.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-zare-site className={fontVariables}>
      <AnimGate />
      {children}
    </div>
  );
}
