import Link from 'next/link';
import Image from 'next/image';

import { type CaseStudy, clientName } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { panelSurface, linkSurface } from '@/components/content/surface';
import { CaseScreenshot, coverShot } from './case-screenshot';

/**
 * A case on the index, as the Company Profile 2026 case spreads set it out:
 * one vertical card, read top to bottom. Who it was for, with the client's
 * own mark opposite. The screenshot. The headline. The argument. The numbers.
 *
 * Vertical at every width — the profile arranges these three-up and the card
 * is designed to be read as a column, so the earlier split layout (argument
 * left, media right) was a different card wearing the same content.
 *
 * The screenshot is the image itself, full width and uncropped. Every case
 * image is 16:10 at source, so the three cards come out the same height.
 *
 * The closing band appears only where the client actually said something.
 * The profile prints one on every card, but four of these seven have no such
 * line on file, and inventing a takeaway to fill a box is exactly the kind of
 * thing the rest of this content model refuses to do.
 */
export function FeaturedCase({ caseStudy }: { caseStudy: CaseStudy }) {
  const pr = caseStudy.profile;

  // The profile's page-8 cards carry one paragraph, not the site's longer
  // problem statement — `body` where the profile has it, ours otherwise.
  const eyebrow = pr?.eyebrow ?? clientName(caseStudy.client);
  const headline = pr?.headline ?? caseStudy.summary;
  const problem =
    pr?.body ??
    (caseStudy.kind === 'system' ? caseStudy.problem : caseStudy.situation);
  const logo = pr?.logos?.[0] ?? caseStudy.logo;

  // Two, as the profile's cards carry — one number is a teaser, two a shape.
  const stats = caseStudy.outcomes.slice(0, 2);
  const shot = coverShot(caseStudy);

  return (
    <article className={`${panelSurface} ${linkSurface} group h-full`}>
      <Link
        href={`/work/${caseStudy.slug}`}
        className="flex h-full flex-col p-6 no-underline md:p-7"
      >
        {/* -------------------------------------- who it was for */}
        <div className="flex items-center justify-between gap-3">
          <MonoLabel className="text-[var(--accent-text)]">
            {eyebrow}
          </MonoLabel>
          {logo ? (
            <span className="logo-plate flex h-10 w-[104px] shrink-0 items-center justify-center px-2 py-1">
              <Image
                src={logo.src}
                alt={`${logo.alt} logo`}
                width={104}
                height={36}
                className="max-h-full w-auto max-w-[104px] object-contain object-right"
              />
            </span>
          ) : null}
        </div>
        <MonoLabel muted size="caption" className="mt-1 block">
          {caseStudy.industry} · {caseStudy.location}
          {caseStudy.duration ? ` · ${caseStudy.duration}` : ''}
        </MonoLabel>

        {/* ------------------------------------------- the screenshot */}
        {shot ? (
          <CaseScreenshot
            shot={shot}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid aspect-[16/10] place-items-center border-2 border-[var(--rule-color)] bg-white">
            <MonoLabel muted size="caption">
              Screenshots pending clearance
            </MonoLabel>
          </div>
        )}

        {/* ---------------------------------------------- the argument */}
        <h3 className="mt-5 font-display text-[25px] font-bold leading-[1.15] text-[var(--heading-color)]">
          {headline}
        </h3>

        <p className="mt-3 line-clamp-5 text-body-sm text-[var(--muted-color)]">
          {problem}
        </p>

        {/* ------------------------------------------------ the numbers */}
        {stats.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            {stats.map((s) => (
              <div key={s.metric}>
                <span className="block font-mono text-[28px] font-bold leading-none tabular-nums text-[var(--heading-color)]">
                  {s.value}
                </span>
                <MonoLabel className="mt-2 block text-[var(--accent-text)]">
                  {s.metric}
                </MonoLabel>
              </div>
            ))}
          </div>
        ) : null}

        {/* The profile's tinted closing line — its own words where it has
            them, the client's quote otherwise. mt-auto pins it to the foot
            so a row of cards agrees on where it sits. */}
        {pr?.footnote ? (
          <p className="mt-auto bg-accent/15 px-5 py-4 text-body-sm font-semibold text-[var(--heading-color)]">
            {pr.footnote}
          </p>
        ) : caseStudy.quote ? (
          <p className="mt-auto bg-accent/15 px-5 py-4 text-body-sm text-[var(--heading-color)]">
            <span className="line-clamp-2 font-semibold">
              “{caseStudy.quote.text}”
            </span>
            <span className="mt-1 block text-[var(--muted-color)]">
              {caseStudy.quote.attribution}
            </span>
          </p>
        ) : null}

        <span
          className={`${pr?.footnote || caseStudy.quote ? 'mt-5' : 'mt-auto pt-5'} font-mono text-label uppercase text-[var(--accent-text)] group-hover:underline`}
        >
          Read the case study →
        </span>
      </Link>
    </article>
  );
}
