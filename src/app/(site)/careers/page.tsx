import type { Metadata } from 'next';
import Image from 'next/image';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Metric } from '@/components/data/metric';
import { FactBlock } from '@/components/data/fact-block';
import { Reveal } from '@/components/motion/reveal';
import { getOpenRoles } from '@/lib/roles';
import { careersEmail, siteUrl } from '@/constants';
import { vettingSteps } from '@/content/delivery';
import { officePhotos } from '@/content/office';
import { RoleCard } from './_components/role-card';

/** The culture strip, in narrative order: the lounge conversation, the
 *  desk you actually work at, the ceremony, the operations floor. */
const CULTURE_PHOTOS = [
  officePhotos.coffeeCorner,
  officePhotos.deskLaughter,
  officePhotos.coffeeCeremonyTasting,
  officePhotos.operationsDesk,
] as const;

// Detail pages and the whole application flow remain on (marketing)/careers/[id].
export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Engineers, designers and operators in Addis Ababa, working on products used by companies in the US, the UK and across Africa.',
  alternates: { canonical: `${siteUrl}/careers` },
};

export default async function CareersPreviewPage() {
  const roles = await getOpenRoles();

  return (
    <>
      <Header />

      <main id="main" className="pt-header-h md:pt-header-h-md">
        <Section tone="ink" label="Careers">
          <Eyebrow>Careers</Eyebrow>
          <Heading level={1} size="display-1" className="mt-6 max-w-[15em]">
            Build a career as ambitious as the future we are creating.
          </Heading>
          <p className="mt-6 max-w-[36em] text-body text-on-dark-muted">
            Engineers, designers, and operators in Addis Ababa, working on
            products used by companies in the United States, the United
            Kingdom, and across Africa.
          </p>
        </Section>

        {/* The retention argument, aimed at the candidate rather than the
            client. Same mechanism, same evidence, different reader: we pay
            above the market because engineers who are paid properly stay, and
            engagements that last are what clients are actually buying. */}
        <Section tone="paper" label="Why people stay">
          <Eyebrow>The people, and why they stay</Eyebrow>
          <Heading level={2} className="mt-6 max-w-[17em]">
            We pay above the market because retention is the product.
          </Heading>

          <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <Metric
                value="+50%"
                label="Minimum above Ethiopia's national average salary"
              />
              <p className="mt-8 max-w-[34em] text-body text-[var(--muted-color)]">
                It is not a benefit. Our clients hire embedded teams because
                the same engineers are still there a year later, and the only
                reliable way to make that true is to make leaving a bad
                decision. The wage floor is the mechanism behind every
                long-running engagement on our work page.
              </p>
            </div>

            <div className="border-t border-[var(--rule-color)] pt-8 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
              <FactBlock
                title="What the work is"
                facts={[
                  'Production systems for named clients, not internal demos',
                  'Direct contact with the client team, no account layer',
                  'One engineering centre in Addis Ababa, not remote-alone',
                ]}
              />
            </div>
          </div>

          {/* Life at the centre, photographed rather than described: the
              lounge, the desks, the coffee ceremony, the operations floor. */}
          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            {CULTURE_PHOTOS.map((photo, i) => (
              <Reveal key={photo.src.src} variant="clip" delay={i * 80}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  placeholder="blur"
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="aspect-[4/3] w-full border border-[var(--rule-color)] object-cover"
                />
              </Reveal>
            ))}
          </div>
          <MonoLabel muted size="caption" className="mt-4 block">
            The delivery centre · Addis Ababa
          </MonoLabel>
        </Section>

        {/* Vetting shown to candidates, not clients: the same eight steps read
            as "your future colleagues were chosen carefully". */}
        <Section tone="mist" label="How we hire" compact>
          <Eyebrow>How we hire</Eyebrow>
          <Heading level={2} size="display-3" className="mt-5 max-w-[18em]">
            Eight steps between an application and a client team.
          </Heading>
          <ol className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {vettingSteps.map((step) => (
              <li key={step.n} className="flex flex-col gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-accent font-mono text-[11px] text-[var(--accent-text)]">
                  {step.n}
                </span>
                <span className="font-display text-caption font-semibold leading-tight text-[var(--heading-color)]">
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section tone="paper" id="open-roles" label="Open roles">
          <Eyebrow>Open roles</Eyebrow>
          <Heading level={2} className="mt-6">
            {roles.length > 0 ? 'Where we are hiring now.' : 'Open roles.'}
          </Heading>

          {roles.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {roles.map((job, i) => (
                <Reveal key={job.id} delay={i * 70}>
                  <RoleCard job={job} />
                </Reveal>
              ))}
            </div>
          ) : (
            // Honest empty state. Also covers the API being unreachable: a
            // careers page that renders beats one that 500s, and a speculative
            // application is a better outcome than a dead end either way.
            <div className="mt-12 max-w-[42em] border border-[var(--rule-color)] p-9">
              <MonoLabel className="text-[var(--accent-text)]">
                Nothing open right now
              </MonoLabel>
              <p className="mt-4 text-body">
                No roles are posted at the moment, but good engineers are always
                worth hearing from. If you want work with named clients and a
                team that stays, write to{' '}
                <a
                  href={`mailto:${careersEmail}`}
                  className="font-mono text-[var(--accent-text)] hover:underline"
                >
                  {careersEmail}
                </a>
                {' '}and tell us what you have built.
              </p>
            </div>
          )}
        </Section>
      </main>

      <Footer />
    </>
  );
}
