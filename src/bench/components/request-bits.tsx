'use client';

import Link from 'next/link';

import { SHIFT_OPTIONS, type Commitment, type RequestFit, type RequestStatus } from '@/bench/data';
import { cn } from '@/bench/utils';

const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'border-accent/30 text-accent' },
  shortlisting: { label: 'Shortlisting', cls: 'border-bench-warning/30 text-bench-warning' },
  submitted: { label: 'Submitted', cls: 'border-bench-healthy/30 text-bench-healthy' },
  closed: { label: 'Closed', cls: 'border-bench-line text-bench-ink-faint' },
};

export function RequestStatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider',
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

/**
 * Coverage against a request: green for Ready now, amber for one call away,
 * with a marker at the number needed. Reads as "how far off are we, and is
 * it phone calls or sourcing that closes the gap?"
 */
export function GapBar({
  needed,
  ready,
  oneCallAway,
}: {
  needed: number;
  ready: number;
  oneCallAway: number;
}) {
  const scale = Math.max(needed, ready + oneCallAway, 1) * 1.1;
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const readyShown = Math.min(ready, scale);
  const callShown = Math.min(oneCallAway, scale - readyShown);

  return (
    <div className="relative pt-5">
      <div
        className="absolute top-0 -translate-x-1/2 font-mono text-[9.5px] uppercase tracking-wider text-bench-ink-faint"
        style={{ left: pct(needed) }}
      >
        need {needed}
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-bench-surface-3">
        <div className="h-full bg-bench-healthy transition-[width] duration-500" style={{ width: pct(readyShown) }} />
        <div
          className="h-full bg-bench-warning/70 transition-[width] duration-500"
          style={{ width: pct(callShown) }}
        />
      </div>
      <div
        className="absolute bottom-[-4px] top-4 w-px bg-bench-ink"
        style={{ left: pct(needed) }}
        aria-hidden
      />
    </div>
  );
}

// ---------------------------------------------------------- requirements --

/** A request's structured requirements, as chips. Only these count toward Ready now. */
export function RequirementChips({
  skills,
  shifts,
  className,
}: {
  skills: string[];
  shifts: string[];
  className?: string;
}) {
  if (!skills.length && !shifts.length) {
    return <span className={cn('text-[12px] text-bench-ink-faint', className)}>No requirements beyond the role</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {skills.map((t) => (
        <Chip key={`k-${t}`}>{t}</Chip>
      ))}
      {shifts.map((t) => (
        <Chip key={`s-${t}`}>{t} shift</Chip>
      ))}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-accent/25 bg-accent/[0.07] px-1.5 py-0.5 text-[11px] text-bench-ink">
      {children}
    </span>
  );
}

/** What a candidate lacks for a request. Nothing when they fit. */
export function FitNote({ fit, className }: { fit: RequestFit; className?: string }) {
  if (fit.fits) return null;
  const missing = [...fit.missing_skills, ...fit.missing_shifts.map((s) => `${s} shift`)];
  return <span className={cn('text-[11px] text-bench-warning', className)}>Missing {missing.join(', ')}</span>;
}

/** "On Northwind Logistics shortlist". Committed elsewhere, still addable. */
export function CommittedTags({ committed }: { committed: Commitment[] }) {
  if (!committed.length) return null;
  return (
    <>
      {committed.map((c) => (
        <Link
          key={c.request_id}
          href={`/portal/requests/${c.request_id}`}
          className="inline-flex items-center rounded border border-bench-warning/30 bg-bench-warning/[0.07] px-1.5 py-0.5 text-[10.5px] text-bench-warning hover:bg-bench-warning/15"
        >
          {c.submitted ? `Submitted to ${c.client_name}` : `On ${c.client_name} shortlist`}
        </Link>
      ))}
    </>
  );
}

export function ShiftToggles({
  value,
  onChange,
  label = 'Required shifts',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {SHIFT_OPTIONS.map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
            className={cn(
              'h-8 rounded-md border px-2.5 text-[12px] transition-colors',
              on
                ? 'border-accent/50 bg-accent/15 text-bench-ink'
                : 'border-bench-line bg-bench-surface-2 text-bench-ink-faint hover:text-bench-ink-dim',
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
