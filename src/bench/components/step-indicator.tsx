import { Check } from 'lucide-react';

import { cn } from '@/bench/utils';

const STEPS = ['Details', 'Assessment'];

/** Two steps: save the person as Raw, then assess them. */
export function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${step} of ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className={cn('h-px w-6', done || current ? 'bg-accent/50' : 'bg-bench-line')} aria-hidden />}
            <span
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full border text-[10.5px] font-semibold',
                done && 'border-accent bg-accent text-accent-contrast',
                current && 'border-accent text-accent',
                !done && !current && 'border-bench-line text-bench-ink-faint',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check size={11} strokeWidth={3} /> : n}
            </span>
            <span className={cn('text-[12px]', current ? 'text-bench-ink' : 'text-bench-ink-faint')}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
