import Image from 'next/image';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { logoMarquee, logoWall } from '@/content/clients';
import { TrustParticles } from './trust-particles';

/**
 * S2 — Trust: the logo wall.
 *
 * Six marks, logo-only, in a calm two-row grid — the orientation of the
 * reference walls (Mercury/Linear tier): generous negative space, no
 * cards, no captions. Marks render slightly subdued at rest and take
 * their full colour on hover, which pairs with the particle ground
 * gathering around the hovered cell (trust-particles.tsx): attention is
 * answered by the field, not by a border.
 *
 * The engagement-shaped client list (what Zare actually did for each)
 * remains the data of record in content/clients.ts; the case studies and
 * /work carry that context. This section's single job is recognition.
 */
export function TrustStrip() {
  return (
    // A real destination, not a strip: ~70svh of room so the wall and its
    // particle ground get a full breath between the hero's release and
    // the two paths. The wall centres vertically in that band.
    <Section
      tone="paper"
      label="Clients"
      className="relative flex min-h-[70svh] flex-col justify-center overflow-hidden"
    >
      <TrustParticles />

      <div className="relative">
        {/* No visible caption — the wall speaks for itself. The sr-only
            heading keeps the section in the document outline so the page
            does not skip h1 -> h3. */}
        <Heading level={2} size="heading" className="sr-only">
          Clients
        </Heading>

        <ul className="mx-auto grid max-w-4xl grid-cols-2 items-center gap-x-10 gap-y-14 sm:grid-cols-3 sm:gap-x-16 sm:gap-y-16">
          {logoWall.map((client) => (
            <li key={client.name} className="flex justify-center">
              <span
                data-client-logo
                title={client.name}
                className="group grid h-20 w-full max-w-[180px] place-items-center"
              >
                {/* Per-mark height from the data (see clients.ts): equal
                    visual weight, not equal boxes. */}
                <Image
                  src={client.src}
                  alt={`${client.name} logo`}
                  width={160}
                  height={56}
                  style={{ height: client.h }}
                  className="w-auto max-w-[170px] object-contain opacity-70 grayscale-[0.4] transition-[opacity,filter] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none group-hover:opacity-100 group-hover:grayscale-0"
                />
              </span>
            </li>
          ))}
        </ul>

        {/* The undercurrent: every other mark on file, drifting. Two
            identical tracks each travel -100% so the loop is seamless;
            hovering pauses the belt (which also keeps the particle
            orbit's captured cell honest — the logo stays put). Under
            reduced motion the belt holds still and the duplicate track
            is dropped. */}
        <div
          className="group mt-20 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
          aria-label="More clients"
        >
          <div className="flex w-max motion-reduce:w-full">
            {[false, true].map((dup) => (
              <ul
                key={String(dup)}
                aria-hidden={dup || undefined}
                className={`flex w-max shrink-0 animate-infinite-scroll items-center gap-x-14 pr-14 group-hover:[animation-play-state:paused] motion-reduce:animate-none sm:gap-x-20 sm:pr-20 ${
                  dup ? 'motion-reduce:hidden' : 'motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center'
                }`}
              >
                {logoMarquee.map((client) => (
                  <li key={client.name} className="flex shrink-0 justify-center">
                    <span
                      data-client-logo
                      title={client.name}
                      className="group/mark grid h-12 place-items-center"
                    >
                      <Image
                        src={client.src}
                        alt={dup ? '' : `${client.name} logo`}
                        width={120}
                        height={40}
                        className="h-auto max-h-9 w-auto max-w-[120px] object-contain opacity-55 grayscale-[0.55] transition-[opacity,filter] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none group-hover/mark:opacity-100 group-hover/mark:grayscale-0"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
