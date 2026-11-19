import Image from 'next/image';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { FactBlock } from '@/components/data/fact-block';
import { Reveal } from '@/components/motion/reveal';
import {
  ADDIS_UTC_OFFSET,
  clientRegions,
  communicationModel,
} from '@/content/working-model';
import { officePhotos } from '@/content/office';

/**
 * The offset band.
 *
 * A horizontal scale anchored on Addis, with each client region placed by how
 * far behind it sits. This is the whole point of the section: a reader finds
 * their own region and gets a number, which a world map cannot give them.
 *
 * Rendered as a definition list rather than a graphic so it survives with no
 * CSS, reads correctly to a screen reader, and needs no image.
 */
/** "Same time" reads better than "0h", and "−1h / −0h" reads like a typo. */
function formatOffset(std: number, dst?: number): string {
  const one = (h: number) => (h === 0 ? 'same time' : `−${h}h`);
  if (dst === undefined || dst === std) {
    return std === 0 ? 'Same time' : one(std);
  }
  return `${one(std)} / ${one(dst)}`;
}

function OffsetBand() {
  const max = Math.max(...clientRegions.map((r) => r.hoursBehind));

  return (
    <dl className="flex flex-col">
      {clientRegions.map((r, i) => {
        // Bar length is proportional to distance from Addis. Purely
        // illustrative; the number beside it is the actual information.
        const width = max === 0 ? 0 : (r.hoursBehind / max) * 100;

        return (
          <Reveal
            key={r.region}
            delay={i * 60}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-t border-[var(--rule-color)] py-5 sm:grid-cols-[150px_1fr_auto] sm:gap-6"
          >
            <dt className="font-display text-body font-semibold text-[var(--heading-color)]">
              {r.region}
            </dt>

            {/* Client-name labels removed (2026-08 comment round): the
                bar alone carries the distance; engagements are named in
                the work section. This also removes what used to be the
                page's one mobile overflow (the nowrap US East label).

                On phones the region and its offset share a line and the
                bar drops beneath them, full width, so its length still
                reads as distance. Stacked between the two it looked like
                an underline of arbitrary length. */}
            <dd className="order-3 col-span-2 flex items-center sm:order-none sm:col-span-1">
              <span
                aria-hidden="true"
                className="h-0.5 bg-accent sm:h-px"
                style={{ width: `${Math.max(width, 2)}%` }}
              />
            </dd>

            <dd className="text-right font-mono text-body tabular-nums text-[var(--accent-text)]">
              {formatOffset(r.hoursBehind, r.hoursBehindDst)}
            </dd>
          </Reveal>
        );
      })}
    </dl>
  );
}

/**
 * How we work with your team.
 *
 * Replaces what earlier drafts called the "global presence" section. Country
 * counts and arcs on a globe are a flex; this answers the operational question
 * a buyer actually has before they can picture working with a team abroad.
 */
export function WorkingModel() {
  return (
    <Section tone="mist" id="working-model" label="How we work with your team">
      <Eyebrow>Working together</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[15em]">
        One delivery centre. Your working day.
      </Heading>

      <p className="mt-6 max-w-[38em] text-body text-[var(--muted-color)]">
        Our team works from one place, Addis Ababa, at UTC{ADDIS_UTC_OFFSET}.
        Ethiopia does not observe daylight saving, so the distance between your
        team and ours only changes when your clocks change, never when ours do.
      </p>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <div>
          <MonoLabel muted>
            Hours behind Addis · standard / daylight saving
          </MonoLabel>
          <div className="mt-6">
            <OffsetBand />
          </div>
        </div>

        <div className="border-t border-[var(--rule-color)] pt-8 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
          <FactBlock title="How the work happens" facts={communicationModel} />

          <p className="mt-8 max-w-[30em] text-body-sm text-[var(--muted-color)]">
            An embedded team member is reachable the way your own team is
            reachable. There is no account manager between you and the person
            writing the code.
          </p>
        </div>
      </div>

      {/* The room the section keeps talking about. One wide, quiet frame —
          evidence that "one delivery centre" is a place, not a phrase. */}
      <Reveal variant="clip" className="mt-14">
        <Image
          src={officePhotos.workspaceCalm.src}
          alt={officePhotos.workspaceCalm.alt}
          placeholder="blur"
          sizes="(min-width: 1400px) 1288px, 100vw"
          className="aspect-[21/9] w-full border border-[var(--rule-color)] object-cover"
        />
        <MonoLabel muted size="caption" className="mt-4 block">
          The delivery centre, Addis Ababa · UTC{ADDIS_UTC_OFFSET}
        </MonoLabel>
      </Reveal>
    </Section>
  );
}
