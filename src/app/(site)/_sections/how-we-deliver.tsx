import Image from 'next/image';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';
import { officePhotos } from '@/content/office';
import {
  IconSettings,
  IconCopy,
  IconUsers,
  IconTools,
  IconUserCheck,
} from '@tabler/icons-react';

import {
  deliverTracks,
  deliverPhases,
  deliverLanes,
  DECIDE_PHASE,
} from '@/content/delivery';

/**
 * S5 — How we deliver.
 *
 * Implements the approved design export ("Zare - How We Deliver",
 * 2026-08 comment round) in the site's own tokens:
 *
 *   1. Three tracks — Build, Adopt, Embed — in one hairline-ruled band.
 *      Build carries stack chips; Adopt and Embed carry slash-marked
 *      rows. Equal width, equal weight: most clients start with one
 *      track and add the others.
 *   2. One shared timeline — four phases (Talk, Prove, Start, Own) over
 *      seven weeks, with two lanes below: the teal Build & Adopt lane
 *      and the navy Embed lane. The "you decide here" marker sits under
 *      Prove: commitment lands at the end of phase two, not phase one.
 *
 * The timeline grid needs its width; on small screens it scrolls
 * horizontally inside its own container rather than reflowing into
 * something that no longer reads as a timeline.
 */

const TRACK_ICONS = [IconSettings, IconCopy, IconUsers] as const;
const LANE_ICONS = [IconTools, IconUserCheck] as const;

/**
 * The timeline below md. The four-phase grid needs 860px and a phone
 * has 335: scrolled sideways it showed one phase and clipped the decide
 * marker, which is the one thing the timeline exists to say. Read
 * vertically instead — each phase with both lanes beneath it, the marker
 * closing Prove — so "you commit at the end of phase two" survives.
 */
function MobileTimeline() {
  return (
    <ol className="mt-10 flex flex-col md:hidden">
      {deliverPhases.map((phase, pi) => (
        <li
          key={phase.n}
          className="border-t border-[var(--rule-color)] py-8 first:border-t-0 first:pt-0"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-surface-navy font-mono text-[13px] font-bold text-on-dark-strong">
              {phase.n}
            </span>
            <span className="font-display text-[22px] font-bold leading-none text-[var(--heading-color)]">
              {phase.name}
            </span>
            <span className="ml-auto font-mono text-caption text-[var(--muted-color)]">
              {phase.when}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {deliverLanes.map((lane, li) => {
              const LaneIcon = LANE_ICONS[li];
              return (
                <div
                  key={lane.label}
                  className={cn(
                    'border-l-[3px] px-4 py-4',
                    lane.accent
                      ? 'border-accent bg-accent/[0.06]'
                      : 'border-surface-navy bg-surface-mist',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <LaneIcon
                      size={16}
                      stroke={1.8}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0',
                        lane.accent
                          ? 'text-[var(--accent-text)]'
                          : 'text-[var(--heading-color)]',
                      )}
                    />
                    <span className="font-mono text-label uppercase leading-snug text-[var(--heading-color)]">
                      {lane.label}
                    </span>
                  </span>
                  <p className="mt-2 text-body-sm leading-relaxed text-[var(--heading-color)]">
                    {lane.cells[pi]}
                  </p>
                </div>
              );
            })}
          </div>

          {pi === DECIDE_PHASE ? (
            <div className="mt-5 border-t-2 border-accent pt-3">
              <MonoLabel size="caption" className="text-[var(--accent-text)]">
                ↑ You decide here
              </MonoLabel>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function HowWeDeliver() {
  return (
    <Section tone="paper" id="how-we-deliver" label="How we deliver">
      <Eyebrow>How we deliver</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[16em]">
        Three ways in. One standard of delivery.
      </Heading>

      <p className="mt-6 max-w-[56ch] text-body text-[var(--muted-color)]">
        AI unchecked makes mistakes. Teams without it fall behind. We ship the
        combination. Most clients start with one track and add the others.
      </p>

      {/* ------------------------------------------------ three tracks */}
      <div className="mt-16 grid border-y border-[var(--rule-color)] md:grid-cols-3">
        {deliverTracks.map((track, i) => {
          const TrackIcon = TRACK_ICONS[i];
          return (
            <Reveal
              key={track.tag}
              delay={i * 90}
              className={cn(
                'py-10 md:pr-10',
                i > 0 &&
                  'border-t border-[var(--rule-color)] md:border-l md:border-t-0 md:pl-10',
              )}
            >
              <span className="flex items-center gap-3">
                <TrackIcon
                  size={26}
                  stroke={1.6}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--accent-text)]"
                />
                <MonoLabel className="text-[var(--accent-text)]">
                  {track.tag}
                </MonoLabel>
              </span>

              <Heading level={3} size="display-3" className="mt-5">
                {track.title}
              </Heading>

              <p className="mt-4 text-body-sm text-[var(--muted-color)]">
                {track.body}
              </p>

              {track.chips ? (
                <ul className="mt-7 flex flex-wrap gap-2">
                  {track.chips.map((chip) => (
                    <li
                      key={chip}
                      className="whitespace-nowrap border border-[var(--rule-color)] px-3 py-1.5 font-mono text-caption text-[var(--heading-color)]"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : null}

              {track.points ? (
                <ul className="mt-7 flex flex-col gap-3.5">
                  {track.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-3 text-body-sm text-[var(--heading-color)]"
                    >
                      <span
                        aria-hidden="true"
                        className="font-bold text-[var(--accent-text)]"
                      >
                        /
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Reveal>
          );
        })}
      </div>

      {/* -------------------------------------------- the shared timeline */}
      <div className="mt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <MonoLabel className="text-[var(--accent-text)]">
              The first seven weeks
            </MonoLabel>
            <Heading level={3} size="display-2" className="mt-5 max-w-[16em]">
              Same four phases, whichever way you start.
            </Heading>
            <p className="mt-5 max-w-[54ch] text-body text-[var(--muted-color)]">
              You commit at the end of phase two, not phase one. Follow the
              lane that matches your engagement.
            </p>
          </div>

          {/* Phase one is a conversation at a whiteboard; here is one. */}
          <Reveal variant="clip">
            <Image
              src={officePhotos.whiteboardSession.src}
              alt={officePhotos.whiteboardSession.alt}
              placeholder="blur"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[16/9] w-full border border-[var(--rule-color)] object-cover"
            />
          </Reveal>
        </div>

        <MobileTimeline />

        {/* The grid is the design; below md it gives way to the vertical
            sequence above rather than scrolling sideways. */}
        <div className="mt-12 hidden overflow-x-auto md:block">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[128px_repeat(4,minmax(0,1fr))]">
              {/* phase headers */}
              <div />
              {deliverPhases.map((phase) => (
                <div key={phase.n} className="pb-7 pr-3">
                  <span className="mb-4 flex items-center">
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-surface-navy font-mono text-[13px] font-bold text-on-dark-strong">
                      {phase.n}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-[var(--rule-color)]"
                    />
                  </span>
                  <span className="block font-display text-[24px] font-bold leading-none text-[var(--heading-color)]">
                    {phase.name}
                  </span>
                  <span className="mt-2 block font-mono text-caption text-[var(--muted-color)]">
                    {phase.when}
                  </span>
                </div>
              ))}

              {/* lanes */}
              {deliverLanes.map((lane, li) => {
                const LaneIcon = LANE_ICONS[li];
                return [
                  <div
                    key={`${lane.label}-label`}
                    className={cn(
                      'flex items-center pr-5',
                      li > 0 && 'mt-3',
                    )}
                  >
                    <span
                      className={cn(
                        'border-l-[3px] py-1 pl-3',
                        lane.accent ? 'border-accent' : 'border-surface-navy',
                      )}
                    >
                      <LaneIcon
                        size={20}
                        stroke={1.7}
                        aria-hidden="true"
                        className={cn(
                          'mb-2 block',
                          lane.accent
                            ? 'text-[var(--accent-text)]'
                            : 'text-[var(--heading-color)]',
                        )}
                      />
                      <span className="block font-mono text-label uppercase leading-snug text-[var(--heading-color)]">
                        {lane.label}
                      </span>
                    </span>
                  </div>,
                  ...lane.cells.map((cell, ci) => (
                    <div
                      key={`${lane.label}-${ci}`}
                      className={cn(
                        'border-l-[3px] p-5 text-body-sm leading-relaxed text-[var(--heading-color)]',
                        ci < lane.cells.length - 1 && 'mr-2.5',
                        li > 0 && 'mt-3',
                        lane.accent
                          ? 'border-accent bg-accent/[0.06]'
                          : 'border-surface-navy bg-surface-mist',
                      )}
                    >
                      {cell}
                    </div>
                  )),
                ];
              })}
            </div>

            {/* the decide marker, under the Prove phase */}
            <div className="mt-5 grid grid-cols-[128px_repeat(4,minmax(0,1fr))]">
              <div
                style={{ gridColumn: `${DECIDE_PHASE + 2} / ${DECIDE_PHASE + 3}` }}
                className="mr-2.5 border-t-2 border-accent pt-3"
              >
                <MonoLabel size="caption" className="text-[var(--accent-text)]">
                  ↑ You decide here
                </MonoLabel>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
