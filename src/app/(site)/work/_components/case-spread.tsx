import Link from 'next/link';
import Image from 'next/image';

import { type CaseStudy, clientName } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { CaseScreenshot, coverShot } from './case-screenshot';

/**
 * A showcased case, in the Company Profile 2026 case-spread format — the
 * layout the profile gives a case its own page for, reproduced as a card.
 *
 * Reading order is the profile's: the CASE STUDY badge with the engine and
 * the client, the client's mark opposite; the headline in caps; then the
 * argument split — the problem behind an ink rule, what we built behind a
 * teal one — beside the screenshot; and a bordered band of numbers closing
 * it, the last cell filled.
 *
 * TONE. The profile prints this on white with heavy ink rules. Here it has
 * to hold on the dark homepage as well as on /work's paper, so the heavy
 * rules are drawn in `--heading-color` (ink on light, near-white on dark)
 * and the band's terminal cell is filled with the accent rather than ink —
 * an ink fill is invisible against an ink section.
 *
 * The profile's own labels are kept for BOTH case kinds: its Womentor
 * spread, an embedded engagement, is headed THE PROBLEM / WHAT WE BUILT
 * exactly as a system build is.
 */
/**
 * Column count for the numbers band, keyed by how many stats there are, so
 * the cells divide the band evenly and none is left empty. Written out as
 * whole class names because Tailwind scans source text — a template built
 * from `lg:grid-cols-${n}` produces no CSS at all.
 */
const BAND_COLUMNS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export function CaseSpread({ caseStudy }: { caseStudy: CaseStudy }) {
  const pr = caseStudy.profile;

  // Everything printed here comes from the profile where the profile has it.
  // The fallbacks are for a case the profile does not carry: the engine line
  // from `kind`, the site's own summary and problem.
  const eyebrow =
    pr?.eyebrow ??
    `${caseStudy.kind === 'system' ? 'Custom AI & Software' : 'Embedded Talent'} · ${clientName(caseStudy.client)}, ${caseStudy.location}`;
  const headline = pr?.headline ?? caseStudy.summary;
  const problem =
    pr?.problem ??
    (caseStudy.kind === 'system' ? caseStudy.problem : caseStudy.situation);
  const builtLabel = pr?.builtLabel ?? 'What we built';
  const logos = pr?.logos ?? (caseStudy.logo ? [caseStudy.logo] : []);

  // Four cells, as the profile's band carries.
  const stats = caseStudy.outcomes.slice(0, 4);
  // Beside the copy at lg the band is wide, so an upright cover gets a
  // partner there; on a phone two windows would each be thumbnail-sized.
  const shot = coverShot(caseStudy);

  return (
    <article className="group">
      <Link href={`/work/${caseStudy.slug}`} className="block no-underline">
        {/* ------------------------------------------------ the badge line */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="bg-[var(--heading-color)] px-3.5 py-1.5 font-mono text-label uppercase tracking-[0.14em] text-[var(--accent-text)]">
              Case study
            </span>
            <MonoLabel className="tracking-[0.14em] text-[var(--heading-color)]">
              {eyebrow}
            </MonoLabel>
          </div>

          {/* The marks, on white plates and sized to be legible rather than
              tucked into a corner. Several where the profile shows several —
              Womentor carries Mastercard AGF beside AFIG. */}
          {logos.length > 0 ? (
            <span className="flex shrink-0 items-center gap-3">
              {logos.map((l) => (
                <span
                  key={l.src}
                  className="logo-plate flex h-14 w-[132px] items-center justify-center px-3 py-2"
                >
                  <Image
                    src={l.src}
                    alt={`${l.alt} logo`}
                    width={132}
                    height={56}
                    className="max-h-full w-auto max-w-full object-contain"
                  />
                </span>
              ))}
            </span>
          ) : null}
        </div>

        {/* -------------------------------------------------- the headline */}
        <h3 className="mt-5 max-w-[34ch] font-display text-display-3 font-bold uppercase leading-[1.04] tracking-[-0.02em] text-[var(--heading-color)]">
          {headline}
        </h3>

        {/* ------------------------------ the argument, beside the screen */}
        <div className="mt-8 grid gap-9 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-stretch">
          {/* The heavy rules are the profile's; on a phone they took 34px
              of a 327px measure, so they thin to 4px and 20px of inset
              below sm. */}
          <div className="flex flex-col gap-6">
            <div className="border-l-4 border-[var(--heading-color)] pl-5 sm:border-l-[6px] sm:pl-7">
              <MonoLabel muted className="block tracking-[0.12em]">
                The problem
              </MonoLabel>
              <p className="mt-2.5 text-body-sm text-[var(--heading-color)]">
                {problem}
              </p>
            </div>

            <div className="border-l-4 border-accent pl-5 sm:border-l-[6px] sm:pl-7">
              <MonoLabel className="block tracking-[0.12em] text-[var(--accent-text)]">
                {builtLabel}
              </MonoLabel>
              {pr?.built ? (
                <p className="mt-2.5 text-body-sm text-[var(--heading-color)]">
                  {pr.built}
                </p>
              ) : caseStudy.kind === 'system' ? (
                <ul className="mt-2.5 flex flex-col gap-1.5 text-body-sm text-[var(--heading-color)]">
                  {caseStudy.system.map((c) => (
                    <li key={c.component}>
                      <span className="font-semibold">{c.component}</span>
                      {' — '}
                      <span className="text-[var(--muted-color)]">{c.note}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2.5 text-body-sm text-[var(--heading-color)]">
                  {caseStudy.podShape}
                </p>
              )}
            </div>
          </div>

          {/* The screenshot itself, the full width of its column, at its
              own 16:10 (see CaseScreenshot). Beside the copy at lg it keeps
              that shape rather than shrinking to the copy's height. */}
          {shot ? (
            <CaseScreenshot
              shot={shot}
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="lg:self-start"
            />
          ) : (
            <div className="grid aspect-[16/10] place-items-center border-2 border-[var(--heading-color)] bg-white lg:self-start">
              <MonoLabel muted size="caption">
                Screenshots pending clearance
              </MonoLabel>
            </div>
          )}
        </div>

        {/* The numbers band. Two-up until lg, then ONE COLUMN PER STAT —
            not a fixed four. Fixed four left a case with two or three
            outcomes trailing empty cells, and an empty cell inside a ruled
            band reads as a number that failed to load rather than as a
            case that has three things to say.

            Two-up rather than stacked below lg: four stacked cells were
            434px of a phone's 1,400px case — a third of the spread spent
            on the smallest content. The per-position rules a 2-up needs
            are computed here (top rule from the second row, left rule on
            the right column; an odd last cell spans the width) so no rule
            is ever drawn against the band's own edge. */}
        {stats.length > 0 ? (
          <div
            className={`mt-8 grid grid-cols-2 border-2 border-[var(--heading-color)] ${BAND_COLUMNS[stats.length]}`}
          >
            {stats.map((s, i) => {
              const n = stats.length;
              const last = i === n - 1 && n >= 3;
              const spans = n % 2 === 1 && i === n - 1;
              return (
                <div
                  key={s.metric}
                  className={[
                    'border-[var(--heading-color)] px-4 py-4 lg:px-6',
                    i >= 2 ? 'border-t-2' : '',
                    i % 2 === 1 ? 'border-l-2' : '',
                    spans ? 'col-span-2 lg:col-span-1' : '',
                    'lg:border-t-0 lg:border-l-2 lg:first:border-l-0',
                    last ? 'bg-accent' : '',
                  ].join(' ')}
                >
                  <span
                    className={`block font-display text-[32px] font-bold leading-none tabular-nums lg:text-[38px] ${
                      last ? 'text-accent-contrast' : 'text-[var(--heading-color)]'
                    }`}
                  >
                    {s.value}
                  </span>
                  <span
                    className={`mt-1.5 block text-body-sm ${
                      last ? 'text-accent-contrast' : 'text-[var(--muted-color)]'
                    }`}
                  >
                    {s.metric}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <span className="mt-6 inline-block font-mono text-label uppercase text-[var(--accent-text)] group-hover:underline">
          Read the case study →
        </span>
      </Link>
    </article>
  );
}
