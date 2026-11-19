import type { Metadata } from 'next';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { siteUrl } from '@/constants';
import { homepageJsonLd } from '@/lib/seo';
// Globe hero — the production variant: centred Earth, no reveal copy.
// Sibling versions, one import swap away:
//   Z-mark   `import { Hero } from './_sections/hero'`
//   Möbius   `import { HeroMobius } from './_sections/hero-mobius'`
import { HeroGlobe } from './_sections/hero-globe';
import { TrustStrip } from './_sections/trust-strip';
import { TwoPaths } from './_sections/two-paths';
import { FeaturedWork } from './_sections/featured-work';
import { Testimonials } from './_sections/testimonials';
import { HowWeDeliver } from './_sections/how-we-deliver';
import { WorkingModel } from './_sections/working-model';
import { Security } from './_sections/security';
import { ContactCta } from './_sections/contact-cta';

/**
 * The homepage.
 *
 * Cut over from /home-preview in M7.2. `(marketing)` no longer owns `/`.
 *
 * Section order (2026-08 comment round: How-we-deliver follows the 02
 * Embedded section directly; The-people section removed by leadership):
 *
 *   Act I   orientation   Hero, Trust
 *   Act II  evidence      Two paths, How we deliver, Work and results,
 *                         Working model, Security and IP
 *   Act III close         Contact
 */
export const metadata: Metadata = {
  alternates: { canonical: siteUrl },
};

export default function HomePage() {
  return (
    <>
      {/* Restored in M7.4. Deleting the old marketing homepage in M7.2 removed
          the Organization, WebSite, LocalBusiness and navigation records with
          it. Rebuilt in lib/seo.ts against the current positioning. */}
      {homepageJsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <Header />

      <main id="main">
        <HeroGlobe />
        <TrustStrip />
        <TwoPaths />
        <HowWeDeliver />
        <WorkingModel />
        <FeaturedWork />
        <Testimonials />
        <Security />
        <ContactCta />
      </main>

      <Footer />
    </>
  );
}
