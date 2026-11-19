import type { EngagementCase } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { FactBlock } from '@/components/data/fact-block';

/**
 * The shape of an embedded engagement: pod size, how it integrated, and how
 * long it has run.
 *
 * This is the `engagement` variant's answer to what `SystemDiagram` answers for
 * a build. There is no architecture to show, so the honest thing to describe is
 * the working arrangement. Duration carries the most weight here: it is the
 * hardest thing to fake and the strongest proxy for whether the arrangement
 * actually worked.
 */
export function EngagementShape({ caseStudy }: { caseStudy: EngagementCase }) {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      <div className="flex flex-col gap-8">
        <div>
          <MonoLabel muted>Pod</MonoLabel>
          <p className="mt-2 text-body">{caseStudy.podShape}</p>
        </div>

        {caseStudy.duration ? (
          <div>
            <MonoLabel muted>Running</MonoLabel>
            <p className="mt-2 font-mono text-display-3 tabular-nums text-[var(--heading-color)]">
              {caseStudy.duration}
            </p>
          </div>
        ) : null}

        {caseStudy.continuity ? (
          <div>
            <MonoLabel muted>Continuity</MonoLabel>
            <p className="mt-2 text-body-sm text-[var(--muted-color)]">
              {caseStudy.continuity}
            </p>
          </div>
        ) : null}
      </div>

      <FactBlock title="How it integrated" facts={caseStudy.integration} />
    </div>
  );
}
