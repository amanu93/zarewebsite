'use client';

import { scoreLabel, type ArchiveReason, type CandidateView, type Layer } from '@/bench/data';
import { daysFromToday } from '@/bench/dates';
import { cn, formatDate, LAYER_STYLES } from '@/bench/utils';

/**
 * Small presentational pieces shared by the directory, the candidate record
 * and the shortlist builder, so "Ready" looks identical everywhere it appears.
 */

export const LAYER_ORDER: Layer[] = ['ready', 'known', 'raw', 'archived'];

export const ARCHIVE_LABEL: Record<ArchiveReason, string> = {
  took_other_job: 'Took other job',
  not_interested: 'Not interested',
  left_country: 'Left country',
  do_not_contact: 'Do not contact',
  placed: 'Placed',
};

export function LayerBadge({ layer, className }: { layer: Layer; className?: string }) {
  const s = LAYER_STYLES[layer];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px]', className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} aria-hidden />
      <span className={s.text}>{s.label}</span>
    </span>
  );
}

/**
 * The one line that says how much longer this candidate's availability claim
 * is good for. Phrased differently per layer because each layer has a
 * different next action.
 */
export function freshness(v: CandidateView): { text: string; tone: 'healthy' | 'warning' | 'critical' | 'dim' } {
  switch (v.layer) {
    case 'ready': {
      const d = v.days_until_expiry ?? 0;
      if (d <= 0) return { text: 'Expires today', tone: 'warning' };
      return { text: `${d}d left`, tone: d <= 7 ? 'warning' : 'healthy' };
    }
    case 'known': {
      if (v.last_verified_at === null) return { text: 'Never verified', tone: 'critical' };
      if (v.availability_status === 'not_available') {
        if (!v.recall_at) return { text: 'Not available', tone: 'dim' };
        return daysFromToday(v.recall_at)! <= 0
          ? { text: 'Not available · recall due', tone: 'warning' }
          : { text: `Not available · call again ${formatDate(v.recall_at)}`, tone: 'dim' };
      }
      const d = Math.abs(v.days_until_expiry ?? 0);
      return { text: d === 0 ? 'Expired today' : `Expired ${d}d ago`, tone: 'critical' };
    }
    case 'raw':
      return { text: 'Not assessed', tone: 'dim' };
    case 'archived': {
      const reason = v.archived_reason ? ARCHIVE_LABEL[v.archived_reason] : 'Archived';
      return {
        text: v.recall_at ? `${reason} · recall ${formatDate(v.recall_at)}` : reason,
        tone: 'dim',
      };
    }
  }
}

export function Freshness({ v, className }: { v: CandidateView; className?: string }) {
  const f = freshness(v);
  return (
    <span
      className={cn(
        'text-[12px]',
        f.tone === 'healthy' && 'text-bench-ink-dim',
        f.tone === 'warning' && 'text-bench-warning',
        f.tone === 'critical' && 'text-bench-critical',
        f.tone === 'dim' && 'text-bench-ink-faint',
        className,
      )}
    >
      {f.text}
    </span>
  );
}

export function Score({
  value,
  basis,
  showLabel = true,
}: {
  value: number | null;
  /** Pass the view's overall_basis to mark a communication-only overall. */
  basis?: CandidateView['overall_basis'];
  showLabel?: boolean;
}) {
  if (value === null) return <span className="text-[12px] text-bench-ink-faint">—</span>;
  const label = scoreLabel(value);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          'tabular text-[13px] font-semibold',
          value >= 4.5 ? 'text-bench-ink' : value >= 3.5 ? 'text-bench-ink-dim' : 'text-bench-critical',
        )}
      >
        {value.toFixed(1)}
      </span>
      {showLabel && (
        <span className={cn('text-[10.5px]', label ? 'text-bench-ink-faint' : 'text-bench-critical/80')}>
          {label ?? 'Below floor'}
        </span>
      )}
      {basis === 'communication_only' && (
        <span className="text-[10.5px] text-bench-warning" title="No technical score: overall is communication only">
          communication only
        </span>
      )}
    </span>
  );
}

export function ArchetypeTag({ v }: { v: Pick<CandidateView, 'archetype_code' | 'archetype_color'> }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-bench-ink-faint">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.archetype_color }} aria-hidden />
      {v.archetype_code}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-bench-line bg-bench-surface-2 px-1.5 py-0.5 text-[10.5px] text-bench-ink-dim">
      {children}
    </span>
  );
}

export function initials(name: string | null) {
  return (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
}
