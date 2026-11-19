'use client';

import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

import type { DuplicateMatches } from '@/bench/data';
import { LayerBadge } from '@/bench/components/candidate-bits';

/**
 * What a new or edited contact collides with. The same phone number is the
 * same person, so saving is blocked with a link to the record that exists.
 * The same name or email is only likely, so it is a warning to confirm.
 */
export function DuplicateNotice({
  matches,
  acknowledged,
  onAcknowledge,
}: {
  matches: DuplicateMatches;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}) {
  if (matches.phone.length > 0) {
    return (
      <div role="alert" className="fade-up mt-4 rounded-md border border-bench-critical/30 bg-bench-critical/[0.06] px-3 py-2.5 text-[12.5px]">
        <div className="flex items-start gap-2">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-bench-critical" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-bench-critical">This phone number is already on the bench</div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {matches.phone.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <Link href={`/portal/candidates/${d.id}`} className="text-bench-ink underline-offset-2 hover:text-accent hover:underline">
                    Open {d.full_name}&rsquo;s profile
                  </Link>
                  <span className="tabular text-[11px] text-bench-ink-faint">{d.ref_code}</span>
                  <LayerBadge layer={d.layer} className="text-[11.5px]" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
  if (matches.similar.length === 0) return null;
  return (
    <div className="fade-up mt-4 rounded-md border border-bench-warning/30 bg-bench-warning/[0.06] px-3 py-2.5 text-[12.5px]">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-bench-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-bench-warning">
            {matches.similar.length === 1 ? 'Someone with this name or email is already on the bench' : 'Records with this name or email are already on the bench'}
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {matches.similar.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <Link href={`/portal/candidates/${d.id}`} className="text-bench-ink hover:text-accent">
                  {d.full_name}
                </Link>
                <span className="tabular text-[11px] text-bench-ink-faint">{d.ref_code}</span>
                <LayerBadge layer={d.layer} className="text-[11.5px]" />
              </li>
            ))}
          </ul>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-bench-ink-dim">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            This is a different person
          </label>
        </div>
      </div>
    </div>
  );
}
