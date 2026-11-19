'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FileText, Plus, Search, UserPlus, X } from 'lucide-react';

import {
  attachToRequest,
  PIPELINE_NOTE_MAX,
  PIPELINE_STAGE_LABEL,
  PIPELINE_STAGES,
  removeFromPipeline,
  setPipelineNote,
  setPipelineStage,
  shortlistFromPipeline,
  useArchetypes,
  useCandidates,
  useCanManageRequests,
  useRequestPipeline,
  type CandidateView,
  type ClientRequest,
  type PipelineEntry,
  type PipelineStage,
} from '@/bench/data';
import { LayerBadge, Score } from '@/bench/components/candidate-bits';
import { FitNote } from '@/bench/components/request-bits';
import { cn } from '@/bench/utils';

/**
 * Everyone being considered for a request, whoever they are.
 *
 * The Ready and One-call-away lists show who the bench offers for the
 * request's role. The pipeline is the recruiter's own list: anyone on the
 * bench can be attached — another role, not yet assessed, or added just
 * now — because two requests with the same title rarely want the same
 * person. Putting someone on the shortlist still goes through the export
 * checks; whoever is not ready for a client stays here with the reason.
 */
export function RequestPipeline({ r }: { r: ClientRequest }) {
  const entries = useRequestPipeline(r.id);
  const canManage = useCanManageRequests();
  const editable = canManage && r.status !== 'closed';
  const [adding, setAdding] = useState(false);

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-bench-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-medium">Pipeline</span>
            <span className="tabular text-[12px] text-bench-ink-faint">{entries.length}</span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-bench-ink-faint">
            Anyone you are considering for this request, of any role or stage.
          </div>
        </div>
        {editable && (
          <>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              aria-expanded={adding}
              className="flex h-8 items-center gap-1.5 rounded-md border border-bench-line px-3 text-[12px] text-bench-ink-dim transition-colors hover:text-bench-ink"
            >
              <Plus size={13} aria-hidden /> Add from the bench
            </button>
            <Link
              href={`/portal/candidates/new?request=${r.id}`}
              className="flex h-8 items-center gap-1.5 rounded-md border border-bench-line px-3 text-[12px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
            >
              <UserPlus size={13} aria-hidden /> New person
            </Link>
          </>
        )}
      </div>

      {adding && editable && <AddFromBench r={r} taken={new Set(entries.map((e) => e.candidate.id))} />}

      {entries.length === 0 ? (
        <p className="px-4 py-6 text-[12.5px] text-bench-ink-faint">
          No one yet. Add someone from the bench, or add a new person straight onto this request.
        </p>
      ) : (
        <ul>
          {entries.map((e, i) => (
            <PipelineRow key={e.entry.id} r={r} e={e} first={i === 0} editable={editable} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddFromBench({ r, taken }: { r: ClientRequest; taken: Set<string> }) {
  const all = useCandidates();
  const archetypes = useArchetypes();
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return all
      .filter((v) => !taken.has(v.id) && v.layer !== 'archived')
      .filter((v) =>
        [v.full_name, v.ref_code, v.email, v.phone, ...v.stack, ...v.skills]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  }, [all, q, taken]);

  async function add(v: CandidateView) {
    setError(null);
    const res = await attachToRequest(r.id, v.id);
    if (!res.ok) setError(res.reason);
    else setQ('');
  }

  return (
    <div className="border-b border-bench-line bg-bench-surface-2/40 px-4 py-3">
      <label className="flex h-9 items-center gap-2 rounded-md border border-bench-line bg-bench-surface px-3 focus-within:border-accent/50">
        <Search size={14} className="shrink-0 text-bench-ink-faint" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, ZT code, phone, email or skill"
          aria-label="Search the bench"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none"
        />
      </label>
      {error && <p className="mt-2 text-[12px] text-bench-critical">{error}</p>}
      {q.trim().length >= 2 && (
        <ul className="mt-2 overflow-hidden rounded-md border border-bench-line bg-bench-surface">
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] text-bench-ink-faint">No one on the bench matches.</li>
          ) : (
            results.map((v, i) => {
              const role = archetypes.find((a) => a.id === v.archetype_id);
              return (
                <li key={v.id} className={cn('flex items-center gap-3 px-3 py-2', i > 0 && 'border-t border-bench-line')}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{v.full_name ?? v.ref_code}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-bench-ink-faint">
                      <span className="font-mono">{v.ref_code}</span>
                      {role && (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: role.color }} aria-hidden />
                          {role.name}
                        </span>
                      )}
                      <LayerBadge layer={v.layer} className="text-[11px]" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void add(v)}
                    className="flex h-7 items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    <Plus size={12} aria-hidden /> Add
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function PipelineRow({
  r,
  e,
  first,
  editable,
}: {
  r: ClientRequest;
  e: PipelineEntry;
  first: boolean;
  editable: boolean;
}) {
  const v = e.candidate;
  const role = useArchetypes().find((a) => a.id === v.archetype_id);
  const otherRole = v.archetype_id !== r.archetype_id;
  const dropped = e.entry.stage === 'dropped';
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(e.entry.note ?? '');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: true } | { ok: false; reason: string }>) {
    setError(null);
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) setError(res.reason);
    return res.ok;
  }

  return (
    <li className={cn('px-4 py-3', !first && 'border-t border-bench-line', dropped && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link href={`/portal/candidates/${v.id}`} className="text-[13.5px] font-medium text-bench-ink no-underline hover:text-accent">
            {v.full_name ?? v.ref_code}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-bench-ink-faint">
            <span className="font-mono">{v.ref_code}</span>
            {role && (
              <span className={cn('flex items-center gap-1', otherRole && 'text-bench-ink-dim')}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: role.color }} aria-hidden />
                {role.name}
                {otherRole && ' · another role'}
              </span>
            )}
            <LayerBadge layer={v.layer} className="text-[11.5px]" />
            {v.overall_score !== null && <Score value={v.overall_score} basis={v.overall_basis} showLabel={false} />}
          </div>
          <FitNote fit={e.fit} className="mt-1 block" />
        </div>

        <select
          value={e.entry.stage}
          disabled={!editable || busy}
          onChange={(ev) => void run(() => setPipelineStage(e.entry.id, ev.target.value as PipelineStage))}
          aria-label={`Stage for ${v.full_name ?? v.ref_code}`}
          className="h-8 rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12px] text-bench-ink focus:border-accent/50 focus:outline-none disabled:opacity-60"
        >
          {PIPELINE_STAGES.map((st) => (
            <option key={st} value={st}>
              {PIPELINE_STAGE_LABEL[st]}
            </option>
          ))}
        </select>

        {e.shortlist === 'draft' ? (
          <span className="flex h-8 items-center gap-1.5 rounded-md bg-accent/10 px-2.5 text-[11.5px] font-medium text-accent">
            <FileText size={12} aria-hidden /> On the shortlist
          </span>
        ) : e.shortlist === 'sent' ? (
          <span className="flex h-8 items-center gap-1.5 rounded-md bg-bench-surface-3 px-2.5 text-[11.5px] text-bench-ink-dim">
            <FileText size={12} aria-hidden /> Sent to client
          </span>
        ) : (
          editable &&
          !dropped && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => shortlistFromPipeline(r.id, v.id))}
              className="flex h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              <FileText size={12} aria-hidden /> Add to shortlist
            </button>
          )
        )}

        {editable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeFromPipeline(e.entry.id))}
            aria-label={`Remove ${v.full_name ?? v.ref_code} from this request`}
            className="grid h-8 w-8 place-items-center rounded-md text-bench-ink-faint transition-colors hover:bg-bench-surface-2 hover:text-bench-ink disabled:opacity-50"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[12px] text-bench-warning">{error}</p>}

      {noteOpen ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            void run(() => setPipelineNote(e.entry.id, note)).then((ok) => ok && setNoteOpen(false));
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            maxLength={PIPELINE_NOTE_MAX}
            placeholder="Why they are here, what to check"
            aria-label="Note"
            className="h-8 min-w-0 flex-1 rounded-md border border-bench-line bg-bench-surface-2 px-2.5 text-[12.5px] focus:border-accent/50 focus:outline-none"
          />
          <button type="submit" className="h-8 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-contrast">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setNote(e.entry.note ?? '');
              setNoteOpen(false);
            }}
            className="h-8 px-2 text-[12px] text-bench-ink-faint hover:text-bench-ink"
          >
            Cancel
          </button>
        </form>
      ) : e.entry.note ? (
        <button
          type="button"
          disabled={!editable}
          onClick={() => setNoteOpen(true)}
          className="mt-1.5 block text-left text-[12px] leading-relaxed text-bench-ink-dim disabled:cursor-default"
        >
          {e.entry.note}
        </button>
      ) : (
        editable && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="mt-1 text-[11.5px] text-bench-ink-faint hover:text-bench-ink"
          >
            Add a note
          </button>
        )
      )}
    </li>
  );
}
