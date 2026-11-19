'use client';

import { useState } from 'react';
import { PhoneCall } from 'lucide-react';

import type { CallAttempt, CandidateView } from '@/bench/data';
import { CallOutcomeControls } from '@/bench/components/call-outcome';
import { cn } from '@/bench/utils';

/**
 * "Call now", wherever a candidate is blocked only by stale availability.
 * One click reveals the number and the three outcomes, which work exactly as
 * they do in the queue. The block this resolves is the most common one in
 * the product, so it should never cost a trip to another screen.
 */
export function InlineCall({
  candidate,
  onLogged,
  className,
}: {
  candidate: Pick<CandidateView, 'id' | 'phone' | 'full_name' | 'shift_flexibility' | 'setup_verified'>;
  onLogged?: (outcome: CallAttempt) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/20',
          className,
        )}
      >
        <PhoneCall size={12} aria-hidden /> Call now
      </button>
    );
  }

  return (
    <div className={cn('fade-up flex flex-wrap items-center justify-end gap-1.5', formOpen && 'w-full', className)}>
      {candidate.phone && !formOpen && (
        <a href={`tel:${candidate.phone}`} className="tabular mr-1 text-[12px] text-accent hover:text-accent-bright">
          {candidate.phone}
        </a>
      )}
      <CallOutcomeControls
        candidate={candidate}
        size="sm"
        labels="always"
        onOpenChange={setFormOpen}
        className={formOpen ? 'text-left' : undefined}
        onLogged={(outcome) => {
          setOpen(false);
          onLogged?.(outcome);
        }}
      />
      {!formOpen && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1.5 text-[11px] text-bench-ink-faint hover:text-bench-ink"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
