import type { SystemComponent } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';

/**
 * The named parts of what was built.
 *
 * Not a technology strip. Each entry is a component of the delivered system
 * with a sentence saying what it does. A reader should be able to describe the
 * shape of the thing after reading this.
 */
export function SystemDiagram({
  components,
}: {
  components: readonly SystemComponent[];
}) {
  return (
    <ol className="flex flex-col">
      {components.map((c, i) => (
        <li
          key={c.component}
          className="grid gap-4 border-t border-[var(--rule-color)] py-7 first:border-t-0 first:pt-0 md:grid-cols-[auto_220px_1fr] md:gap-8"
        >
          <MonoLabel className="text-[var(--accent-text)]">
            {String(i + 1).padStart(2, '0')}
          </MonoLabel>
          <h3 className="font-display text-heading text-[var(--heading-color)]">
            {c.component}
          </h3>
          <p className="text-body-sm text-[var(--muted-color)]">{c.note}</p>
        </li>
      ))}
    </ol>
  );
}
