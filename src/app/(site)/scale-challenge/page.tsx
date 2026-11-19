import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SCALE_CHALLENGE_ENABLED, siteUrl } from '@/constants';
import { ScaleChallengeGame } from './_components/game';

export const metadata: Metadata = {
  title: 'The Scale Challenge',
  description:
    'You have 90 days and a fixed budget to staff a mission. Hire it, outsource it, or extend your team — build the mix that ships, and get your team blueprint.',
  alternates: { canonical: `${siteUrl}/scale-challenge` },
  // While the challenge is hidden the route 404s, but a crawler that still
  // holds the old URL should be told plainly not to keep it.
  robots: SCALE_CHALLENGE_ENABLED ? undefined : { index: false, follow: false },
};

/**
 * /scale-challenge — the interactive lead-generation game, ported from the
 * v2 design mockup (docs/scale-challenge-ui-mockups). Everything below the
 * header is the client game; the page itself stays a server component so
 * metadata and the shell render without the game bundle.
 *
 * Hidden site-wide for now: SCALE_CHALLENGE_ENABLED gates the route the same
 * way it gates the header CTA, the footer link, and the sitemap entry. The
 * game underneath is intact — flipping the flag brings it all back.
 */
export default function ScaleChallengePage() {
  if (!SCALE_CHALLENGE_ENABLED) notFound();

  return (
    <>
      <Header />
      <main id="main" className="pt-header-h md:pt-header-h-md">
        <ScaleChallengeGame />
      </main>
      <Footer />
    </>
  );
}
