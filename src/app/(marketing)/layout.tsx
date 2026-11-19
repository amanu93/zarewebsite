import '@/styles/mantine.css';

import RootStyleRegistry from '@/providers/mantine';
import { Providers } from '@/store/provider';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

/**
 * After the M7 cutover this group serves exactly ONE route: `/careers/[id]`,
 * the job detail and application flow. Everything else moved to `(site)`.
 *
 * It survives because that page owns the application pipeline: the apply form,
 * the S3 resume upload, and the JobPosting JSON-LD that makes the page
 * eligible for Google Jobs. Rebuilding it was explicitly out of scope, and
 * rewriting a working application flow to change its styling would be a poor
 * trade.
 *
 * So it keeps Mantine and Redux, which it needs, but takes the new Header and
 * Footer so a candidate arriving from /careers does not walk into different
 * chrome halfway through applying. The header is pinned solid: this page does
 * not open on a dark section, and the transparent state renders white text.
 *
 * The page body itself is untouched. It will be reskinned in the review phase.
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <RootStyleRegistry>
        <div className="flex min-h-screen flex-col">
          <Header solid />
          <div className="flex-1 pt-header-h md:pt-header-h-md">{children}</div>
          <Footer />
        </div>
      </RootStyleRegistry>
    </Providers>
  );
}
