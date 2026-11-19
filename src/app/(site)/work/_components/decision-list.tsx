import type { Decision } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';

/**
 * Engineering decisions, as decision / tradeoff / result.
 *
 * This is the section that separates an engineering proof page from an agency
 * portfolio entry. A reader who builds systems does not want to know which
 * technologies were used; they want to know what was chosen over what, and
 * what it cost.
 *
 * When `decisions` is empty the section renders a labelled gap rather than
 * plausible-sounding invention. An empty section reads as pending. A fabricated
 * one reads as false the moment a domain expert arrives.
 */
export function DecisionList({ decisions }: { decisions: readonly Decision[] }) {
  if (decisions.length === 0) {
    return (
      <div className="border border-dashed border-[var(--rule-color)] p-8">
        <MonoLabel className="text-[var(--accent-text)]">
          Pending engineering review
        </MonoLabel>
        <p className="mt-4 max-w-[42em] text-body-sm text-[var(--muted-color)]">
          The architectural decisions behind this system are being documented
          with the engineers who made them. We publish the reasoning and the
          tradeoffs, or we publish nothing. This section will not be filled with
          a summary written by someone who was not in the room.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {decisions.map((d, i) => (
        <Reveal
          key={d.decision}
          as="li"
          delay={i * 80}
          className="border-t border-[var(--rule-color)] py-9 first:border-t-0 first:pt-0"
        >
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <MonoLabel className="text-[var(--accent-text)] md:pt-1">
              {String(i + 1).padStart(2, '0')}
            </MonoLabel>

            <div className="flex flex-col gap-5">
              <h3 className="font-display text-display-3 text-[var(--heading-color)]">
                {d.decision}
              </h3>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <MonoLabel muted>Tradeoff</MonoLabel>
                  <p className="mt-2 text-body-sm">{d.tradeoff}</p>
                </div>
                <div>
                  <MonoLabel muted>Result</MonoLabel>
                  <p className="mt-2 text-body-sm">{d.result}</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}
