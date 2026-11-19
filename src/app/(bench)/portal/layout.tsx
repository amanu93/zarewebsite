import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@/bench/bench.css';
import { fontVariables } from '@/styles/fonts';
import { Shell } from '@/bench/components/shell';

/**
 * Zare Bench, the staff portal, at /portal.
 *
 * Its own route group so nothing here reaches the marketing site: the portal's
 * styles (src/bench/bench.css) and its app shell load only under /portal.
 * Type comes from the site's own system, `@/styles/fonts`. `data-bench`
 * scopes the styles; see bench.css.
 *
 * Staff only and currently the demo build, so it is kept out of search
 * engines three ways: this robots metadata, an X-Robots-Tag header
 * (next.config.ts) and a Disallow in robots.ts. On the server, nginx also
 * puts a password in front of /portal until real sign-in exists; see
 * docs/bench/DEPLOY.md.
 */
export const metadata: Metadata = {
  // absolute, not default: the site's "%s | Zare Innovations" template
  // would otherwise wrap this, while pages below still use the Bench one.
  title: {
    absolute: 'Zare Bench',
    template: '%s · Zare Bench',
  },
  description: 'Zare Innovations staff portal.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  // The site's canonical points at the homepage; a staff page has none.
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export const viewport: Viewport = {
  // Lets the phone tab bar sit behind the home indicator and pad itself.
  viewportFit: 'cover',
  themeColor: '#020f18',
};

export default function BenchLayout({ children }: { children: ReactNode }) {
  return (
    <div data-bench className={fontVariables}>
      <Shell>{children}</Shell>
    </div>
  );
}
