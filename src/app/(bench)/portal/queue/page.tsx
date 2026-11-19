'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Phone, Archive, Clock } from 'lucide-react';

import {
  archiveCandidate,
  queueStartsOnMine,
  useArchetypes,
  useCallQueue,
  useCurrentUser,
  type ArchiveReason,
  type QueueItem,
  type QueueReason,
} from '@/bench/data';
import { CallOutcomeControls } from '@/bench/components/call-outcome';
import { TOAST_MS, useCallToast } from '@/bench/components/call-toast';
import { expiryLabel, inDays } from '@/bench/dates';
import { cn, timeAgo } from '@/bench/utils';

/**
 * The call queue. The most important screen in the application, because it is
 * the only thing that keeps the data alive.
 *
 * Optimised for one thing: the cost of logging an outcome. No answer is one
 * tap; Available and Not available ask only what the record needs. Nobody
 * who needs a call ever leaves the queue: an unanswered call waits out a
 * cooldown in plain sight and comes back as Retry.
 *
 * A logged row stays exactly where it was, marked done, until the undo
 * window closes or the pointer leaves the list, so the next row never jumps
 * under the recruiter's cursor.
 */

const REASON_META: Record<
  QueueReason,
  { label: string; tone: 'critical' | 'warning' | 'dim' }
> = {
  never_verified: { label: 'Never verified', tone: 'critical' },
  expired: { label: 'Expired', tone: 'critical' },
  expiring_soon: { label: 'Expiring', tone: 'warning' },
  no_answer_retry: { label: 'No answer, retry', tone: 'dim' },
  recall_due: { label: 'Recall due', tone: 'dim' },
};

type Section = 'due' | 'waiting';
type Held = { item: QueueItem; index: number; section: Section; label: string };

/** Puts held rows back at the positions they had when they were logged. */
function withHeld(list: QueueItem[], held: Held[], section: Section) {
  const ids = new Set(held.map((h) => h.item.id));
  const rows: { item: QueueItem; done: string | null }[] = list
    .filter((i) => !ids.has(i.id))
    .map((item) => ({ item, done: null }));
  for (const h of held.filter((x) => x.section === section).sort((x, y) => x.index - y.index)) {
    rows.splice(Math.min(h.index, rows.length), 0, { item: h.item, done: h.label });
  }
  return rows;
}

export default function QueuePage() {
  const archetypes = useArchetypes();
  const [archetypeId, setArchetypeId] = useState<string | undefined>();
  const me = useCurrentUser();
  // Recruiters start on their own candidates; everyone can see the whole queue.
  const [scope, setScope] = useState<'mine' | 'all'>(() => (queueStartsOnMine(me.role) ? 'mine' : 'all'));
  const everyone = useCallQueue(archetypeId);
  const queue = scope === 'mine' ? everyone.filter((i) => i.owner_id === me.id) : everyone;
  const [held, setHeld] = useState<Held[]>([]);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const heldIds = new Set(held.map((h) => h.item.id));
  const due = queue.filter((i) => !i.retry_at);
  const waiting = queue.filter((i) => i.retry_at);
  const liveDue = due.filter((i) => !heldIds.has(i.id));
  const liveWaiting = waiting.filter((i) => !heldIds.has(i.id));

  function release(id?: string) {
    if (!id) {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      setHeld([]);
      return;
    }
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setHeld((hs) => hs.filter((h) => h.item.id !== id));
  }

  function hold(item: QueueItem, section: Section, label: string) {
    const rows = withHeld(section === 'due' ? due : waiting, held, section);
    const index = Math.max(0, rows.findIndex((r) => r.item.id === item.id));
    setHeld((hs) => [...hs.filter((h) => h.item.id !== item.id), { item, index, section, label }]);
    window.clearTimeout(timers.current.get(item.id));
    timers.current.set(item.id, window.setTimeout(() => release(item.id), TOAST_MS));
  }

  const counts = {
    critical: liveDue.filter((i) => i.priority === 1).length,
    warning: liveDue.filter((i) => i.priority === 2).length,
    retry: liveDue.filter((i) => i.priority === 3).length,
    recall: liveDue.filter((i) => i.priority === 4).length,
  };
  const dueRows = withHeld(due, held, 'due');
  const waitingRows = withHeld(waiting, held, 'waiting');

  return (
    <div className="px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Call queue</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            {liveDue.length === 0
              ? scope === 'mine'
                ? 'Nothing of yours to verify right now.'
                : 'Nothing to verify. The bench is current.'
              : `${liveDue.length} ${liveDue.length === 1 ? 'candidate needs' : 'candidates need'} a verification call${scope === 'mine' ? ' from you' : ''}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Whose candidates" className="flex items-center gap-1 rounded-md border border-bench-line bg-bench-surface p-1">
          <FilterChip active={scope === 'mine'} onClick={() => setScope('mine')}>
            Mine
          </FilterChip>
          <FilterChip active={scope === 'all'} onClick={() => setScope('all')}>
            All
          </FilterChip>
        </div>
        <div role="group" aria-label="Role" className="flex items-center gap-1 rounded-md border border-bench-line bg-bench-surface p-1">
          <FilterChip active={!archetypeId} onClick={() => setArchetypeId(undefined)}>
            All
          </FilterChip>
          {archetypes.map((a) => (
            <FilterChip
              key={a.id}
              active={archetypeId === a.id}
              onClick={() => setArchetypeId(a.id)}
            >
              {a.code}
            </FilterChip>
          ))}
        </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Tally label="Expired" value={counts.critical} tone="critical" />
        <Tally label="Expiring" value={counts.warning} tone="warning" />
        <Tally label="Retry" value={counts.retry} tone="dim" />
        <Tally label="Recall" value={counts.recall} tone="dim" />
        <Tally label="Waiting" value={liveWaiting.length} tone="dim" />
      </div>

      {dueRows.length === 0 ? (
        <EmptyQueue waiting={liveWaiting.length} />
      ) : (
        <ul
          onPointerLeave={() => release()}
          className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface"
        >
          {dueRows.map(({ item, done }, i) => (
            <QueueRow
              key={item.id}
              item={item}
              done={done}
              first={i === 0}
              onHold={(label) => hold(item, 'due', label)}
              onRelease={() => release(item.id)}
            />
          ))}
        </ul>
      )}

      {waitingRows.length > 0 && (
        <section className="mt-6" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className="text-[13px] font-medium text-bench-ink-dim">
            Waiting to retry
          </h2>
          <p className="mb-3 mt-0.5 text-[12px] text-bench-ink-faint">
            No answer recently. Each comes back as Retry when the cooldown ends; call sooner if they ring back.
          </p>
          <ul
            onPointerLeave={() => release()}
            className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface"
          >
            {waitingRows.map(({ item, done }, i) => (
              <QueueRow
                key={item.id}
                item={item}
                done={done}
                first={i === 0}
                onHold={(label) => hold(item, 'waiting', label)}
                onRelease={() => release(item.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const LOGGED_LABEL = {
  available: 'Logged available',
  not_available: 'Logged not available',
  no_answer: 'Logged no answer',
};

function QueueRow({
  item,
  done,
  first,
  onHold,
  onRelease,
}: {
  item: QueueItem;
  /** Set once an outcome is logged: the row stays put, marked done. */
  done: string | null;
  first: boolean;
  /** Keep this row in place, marked with `label`. Called before the write. */
  onHold: (label: string) => void;
  onRelease: () => void;
}) {
  const [archiving, setArchiving] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const archiveBtn = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const who = item.full_name ?? item.ref_code;

  function closeArchive() {
    setArchiving(false);
    setConfirmErase(false);
    window.setTimeout(() => archiveBtn.current?.focus(), 0);
  }

  /** After an outcome, keyboard focus moves on to the next candidate. */
  function focusNextRow() {
    // After React has committed the held row; a timeout, not a frame, so it
    // also runs in a background tab.
    window.setTimeout(() => {
      const next = rowRef.current?.nextElementSibling;
      (next?.querySelector('button') as HTMLButtonElement | null)?.focus();
    }, 0);
  }
  const toast = useCallToast();
  const meta = REASON_META[item.reason];

  async function archive(reason: ArchiveReason) {
    onHold('Archived');
    const callId = await archiveCandidate(item.id, reason);
    setArchiving(false);
    setConfirmErase(false);
    if (!callId) return onRelease();
    focusNextRow();
    // Anonymising is final, so it offers no undo.
    if (reason !== 'do_not_contact') {
      toast({ callId, message: `${item.full_name ?? item.ref_code}: archived.`, noteable: false });
    }
  }

  return (
    <li
      ref={rowRef}
      className={cn(
        'border-bench-line px-4 py-3 transition-colors',
        !done && 'hover:bg-bench-surface-2',
        !first && 'border-t',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          className={cn('h-8 w-0.5 shrink-0 rounded-full', done && 'opacity-50')}
          style={{ background: item.archetype_color }}
          aria-hidden
        />

        <div className={cn('min-w-0 flex-1', done && 'opacity-50')}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <Link href={`/portal/candidates/${item.id}`} className="truncate text-[14px] font-medium hover:text-accent">
              {item.full_name ?? 'Unnamed'}
            </Link>
            <span className="tabular text-[11px] text-bench-ink-faint">{item.ref_code}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-bench-ink-faint">
              {item.archetype_code}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-bench-ink-faint">
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="tabular text-accent hover:text-accent-bright"
              >
                {item.phone}
              </a>
            )}
            {item.retry_at ? (
              <span>No answer · retry {inDays(item.retry_at)}</span>
            ) : (
              <span
                className={cn(
                  meta.tone === 'critical' && 'text-bench-critical',
                  meta.tone === 'warning' && 'text-bench-warning',
                )}
              >
                {meta.label}
                {item.days_until_expiry !== null && item.reason !== 'recall_due' && (
                  <> · {expiryLabel(item.days_until_expiry)}</>
                )}
              </span>
            )}
            {item.owner_name && <span>{item.owner_name}</span>}
            {item.last_called_at && (
              <span className="flex items-center gap-1">
                <Clock size={10} aria-hidden />
                <span className="sr-only">Last called</span>
                {timeAgo(item.last_called_at)}
              </span>
            )}
          </div>
        </div>

        {done ? (
          <span className="shrink-0 text-[12px] text-bench-ink-dim">{done}</span>
        ) : archiving && confirmErase ? (
          <div
            role="group"
            aria-label={`Erase ${who}'s details`}
            onKeyDown={(e) => e.key === 'Escape' && closeArchive()}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-[11px] text-bench-critical">
              Erase {who}&rsquo;s name, phone and email for good?
            </span>
            <button
              type="button"
              autoFocus
              onClick={() => void archive('do_not_contact')}
              className="rounded border border-bench-critical/40 bg-bench-critical/10 px-2 py-1.5 text-[11px] font-medium text-bench-critical hover:bg-bench-critical/20"
            >
              Erase details
            </button>
            <button type="button" onClick={closeArchive} className="px-2 py-1.5 text-[11px] text-bench-ink-faint hover:text-bench-ink">
              Cancel
            </button>
          </div>
        ) : archiving ? (
          <div
            role="group"
            aria-label={`Archive ${who}`}
            onKeyDown={(e) => e.key === 'Escape' && closeArchive()}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-[11px] text-bench-ink-faint">Reason:</span>
            {(
              [
                ['took_other_job', 'Took other job'],
                ['not_interested', 'Not interested'],
                ['left_country', 'Left country'],
              ] as const
            ).map(([reason, label], i) => (
              <button
                key={reason}
                type="button"
                autoFocus={i === 0}
                onClick={() => void archive(reason)}
                className="rounded border border-bench-line bg-bench-surface-2 px-2 py-1.5 text-[11px] text-bench-ink-dim transition-colors hover:border-bench-critical/40 hover:text-bench-critical"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setConfirmErase(true)}
              className="rounded border border-bench-critical/30 px-2 py-1.5 text-[11px] text-bench-critical/90 transition-colors hover:bg-bench-critical/10"
            >
              Do not contact
            </button>
            <button type="button" onClick={closeArchive} className="px-2 py-1.5 text-[11px] text-bench-ink-faint hover:text-bench-ink">
              Cancel
            </button>
          </div>
        ) : (
          <div className={cn('flex items-center gap-1.5', formOpen ? 'basis-full' : 'shrink-0')}>
            <CallOutcomeControls
              candidate={{
                id: item.id,
                full_name: item.full_name,
                shift_flexibility: item.shift_flexibility,
                setup_verified: item.setup_verified,
              }}
              onOpenChange={setFormOpen}
              onWillLog={(outcome) => onHold(LOGGED_LABEL[outcome])}
              onLogFailed={onRelease}
              onLogged={focusNextRow}
            />
            {!formOpen && (
              <button
                ref={archiveBtn}
                type="button"
                onClick={() => setArchiving(true)}
                aria-label={`Archive ${who}`}
                title="Archive"
                className="grid h-8 w-8 place-items-center rounded-md border border-bench-line text-bench-ink-faint transition-colors hover:border-bench-critical/40 hover:text-bench-critical"
              >
                <Archive size={13} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
        active ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-faint hover:text-bench-ink-dim',
      )}
    >
      {children}
    </button>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'critical' | 'warning' | 'dim';
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-bench-line bg-bench-surface px-3 py-1.5">
      <span
        className={cn(
          'tabular text-[15px] font-semibold',
          tone === 'critical' && 'text-bench-critical',
          tone === 'warning' && 'text-bench-warning',
          tone === 'dim' && 'text-bench-ink-dim',
        )}
      >
        {value}
      </span>
      <span className="text-[11px] text-bench-ink-faint">{label}</span>
    </div>
  );
}

function EmptyQueue({ waiting }: { waiting: number }) {
  return (
    <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-16 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-bench-healthy/10">
        <Phone size={16} className="text-bench-healthy" />
      </div>
      <div className="text-[14px] font-medium">Queue clear</div>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-bench-ink-dim">
        Every candidate on the bench has a current availability check. Nothing
        expires in the next seven days.
        {waiting > 0 && ` ${waiting} unanswered ${waiting === 1 ? 'call is' : 'calls are'} waiting to retry below.`}
      </p>
    </div>
  );
}
