import type { Outcome } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';

/**
 * Outcomes with their context attached.
 *
 * The context line is not decoration and not optional. A bare "40%" is a number
 * a reader cannot evaluate, and a page full of them reads as marketing. The
 * schema requires it, so this component can always render it.
 */
export function OutcomeGrid({ outcomes }: { outcomes: readonly Outcome[] }) {
  return (
    <dl className="grid gap-10 md:grid-cols-3">
      {outcomes.map((o, i) => (
        <Reveal key={o.metric} delay={i * 80}>
          <dt className="sr-only">{o.metric}</dt>
          <dd>
            <span
              className={`block font-mono text-metric tabular-nums text-[var(--heading-color)] ${
                o.verified ? '' : 'opacity-25'
              }`}
            >
              {o.value}
            </span>
            <MonoLabel className="mt-3 block text-[var(--accent-text)]">
              {o.metric}
            </MonoLabel>
            <p className="mt-3 text-body-sm text-[var(--muted-color)]">
              {o.context}
            </p>
            {!o.verified ? (
              <MonoLabel muted size="caption" className="mt-2 block">
                Pending verification
              </MonoLabel>
            ) : null}
          </dd>
        </Reveal>
      ))}
    </dl>
  );
}
