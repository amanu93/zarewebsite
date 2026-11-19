'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, FileText, Pencil } from 'lucide-react';

import {
  closeRequest,
  exportBlockReason,
  OUTCOME_LABEL,
  setRequestStatus,
  REQUEST_TITLE_MAX,
  updateRequest,
  useBenchTags,
  useCanManageRequests,
  usePlacements,
  useRequestShortlisted,
  useRequestStatusProblem,
  useRequestPool,
  useRequestSummary,
  useSentToClient,
  useUsers,
  type ClientRequest,
  type CloseErrors,
  type PoolEntry,
  type RequestOutcome,
  type RequestSummary,
} from '@/bench/data';
import { TagInput } from '@/bench/components/form-bits';
import { RequestPipeline } from '@/bench/components/request-pipeline';
import { Freshness, Score, Tag } from '@/bench/components/candidate-bits';
import { InlineCall } from '@/bench/components/inline-call';
import {
  CommittedTags,
  FitNote,
  GapBar,
  RequestStatusPill,
  RequirementChips,
  ShiftToggles,
} from '@/bench/components/request-bits';
import { cn, daysUntil, formatDate, timeAgo } from '@/bench/utils';

/**
 * A single request, arranged as a decision: how big is the gap, is it closed
 * by phone calls or by sourcing, and who exactly should go on the shortlist.
 *
 * The "one call away" list is the most useful thing on this page. Calling
 * someone from here moves them into the Ready list above while you watch.
 */

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const r = useRequestSummary(id);
  const users = useUsers();
  const pool = useRequestPool(id);
  const sent = useSentToClient(r?.client_name ?? '');

  if (!r || !pool) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="text-[15px] font-medium">Request not found</div>
        <Link href="/portal/requests" className="mt-4 inline-block text-[12.5px] text-accent hover:text-accent-bright">
          Back to requests
        </Link>
      </div>
    );
  }

  const left = daysUntil(r.required_by);
  const gap = Math.max(0, r.quantity - r.matches);
  const afterCalls = Math.max(0, r.quantity - r.matches - r.one_call_away);
  const creator = users.find((u) => u.id === r.created_by)?.full_name;
  const ready = pool.ready;
  const exportableReady = ready.filter((e) => !exportBlockReason(e.v)).length;
  const committedElsewhere = r.matches - r.uncommitted;

  return (
    <div className="px-5 py-6">
      <Link
        href="/portal/requests"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink"
      >
        <ArrowLeft size={12} /> Requests
      </Link>

      {/* ---- header ---- */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight">{r.client_name}</h1>
            <RequestStatusPill status={r.status} />
          </div>
          <TitleLine r={r} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-bench-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.archetype_color }} />
              <span className="font-mono uppercase tracking-wider">{r.archetype_code}</span>
              {r.archetype_name}
            </span>
            <span className="tabular">{r.quantity} needed</span>
            {r.required_by && (
              <span className={cn(left !== null && left <= 7 && r.status !== 'closed' && 'text-bench-critical')}>
                By {formatDate(r.required_by)}
                {left !== null && r.status !== 'closed' && ` · ${left < 0 ? `${Math.abs(left)}d overdue` : `${left}d left`}`}
              </span>
            )}
            {creator && (
              <span>
                Raised by {creator} · {timeAgo(r.created_at)}
              </span>
            )}
          </div>
          <Requirements r={r} />
          {r.notes && <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-bench-ink-dim">{r.notes}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusActions r={r} />
          <Link
            href={`/portal/requests/${r.id}/shortlist`}
            className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright"
          >
            <FileText size={14} />
            {r.shortlist?.status === 'draft'
              ? `Shortlist · ${r.shortlist.count}`
              : r.shortlist?.status === 'exported'
                ? 'View shortlist'
                : 'Build shortlist'}
          </Link>
        </div>
      </div>

      <ClosePanel r={r} />

      {/* A closed request is history: no gap to close, no one to call. */}
      {r.status !== 'closed' && (
      <>
      {/* ---- gap analysis ---- */}
      <section className="mb-4 rounded-lg border border-bench-line bg-bench-surface p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="grid grid-cols-4 gap-3">
            <Big label="Needed" value={r.quantity} />
            <Big label="Ready now" value={r.matches} tone={r.matches >= r.quantity ? 'healthy' : 'warning'} />
            <Big label="One call away" value={r.one_call_away} tone="accent" />
            <Big label="Raw" value={pool.raw} tone="dim" />
          </div>
          <div>
            <GapBar needed={r.quantity} ready={r.matches} oneCallAway={r.one_call_away} />
            <div className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed">
              {gap === 0 ? (
                <>
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-bench-healthy" />
                  <span>
                    <span className="font-medium text-bench-healthy">Covered from the bench.</span>{' '}
                    <span className="text-bench-ink-dim">
                      {r.matches} ready for {r.quantity} needed
                      {exportableReady < r.matches && `, ${exportableReady} of them exportable today`}
                      {committedElsewhere > 0 && `, ${r.uncommitted} uncommitted`}.
                    </span>
                  </span>
                </>
              ) : afterCalls === 0 ? (
                <>
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bench-warning" />
                  <span>
                    <span className="font-medium text-bench-warning">{gap} short.</span>{' '}
                    {committedElsewhere > 0 && (
                      <span className="text-bench-ink-dim">{r.uncommitted} of {r.matches} Ready are uncommitted. </span>
                    )}
                    <span className="text-bench-ink-dim">
                      {r.one_call_away} assessed {r.one_call_away === 1 ? 'candidate is' : 'candidates are'} one
                      call away — calling them could close this without any sourcing.
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bench-critical" />
                  <span>
                    <span className="font-medium text-bench-critical">
                      {afterCalls} short even if every call goes well.
                    </span>{' '}
                    {committedElsewhere > 0 && (
                      <span className="text-bench-ink-dim">{r.uncommitted} of {r.matches} Ready are uncommitted. </span>
                    )}
                    <span className="text-bench-ink-dim">
                      {pool.raw > 0
                        ? `${pool.raw} raw ${pool.raw === 1 ? 'candidate needs' : 'candidates need'} assessing; beyond that, this needs sourcing.`
                        : 'This needs sourcing.'}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ---- ready ---- */}
        <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          <Head title="Ready now" count={ready.length} hint="Meets every requirement · best score first" />
          {ready.length === 0 ? (
            <Muted>No one Ready meets every requirement. Start with the list on the right.</Muted>
          ) : (
            <ul>
              {ready.map((e, i) => (
                <CandidateLine key={e.v.id} e={e} first={i === 0} sentBefore={sent.has(e.v.id)} client={r.client_name}>
                  <ReadyState e={e} />
                </CandidateLine>
              ))}
            </ul>
          )}
          <Partial entries={pool.ready_partial} sent={sent} client={r.client_name} label="Ready, missing a requirement" />
        </section>

        {/* ---- one call away ---- */}
        <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          <Head title="One call away" count={pool.one_call_away.length} hint="Meets every requirement · availability stale" />
          {pool.one_call_away.length === 0 ? (
            <Muted>Nobody waiting on a call.</Muted>
          ) : (
            <ul>
              {pool.one_call_away.map((e, i) => (
                <CandidateLine key={e.v.id} e={e} first={i === 0} sentBefore={sent.has(e.v.id)} client={r.client_name}>
                  <InlineCall candidate={e.v} />
                </CandidateLine>
              ))}
            </ul>
          )}
          <Partial
            entries={pool.one_call_away_partial}
            sent={sent}
            client={r.client_name}
            label="One call away, missing a requirement"
            call
          />
        </section>
      </div>
      </>
      )}

      <RequestPipeline r={r} />
    </div>
  );
}

/** The position title, editable in place while the request is open. */
function TitleLine({ r }: { r: RequestSummary }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(r.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const editable = r.status !== 'closed';

  if (editing) {
    return (
      <form
        className="mt-1.5 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void updateRequest(r.id, { title }).then((res) => {
            if (res.ok) setEditing(false);
            else setError(res.errors.title ?? res.errors.form ?? 'Could not save.');
          });
        }}
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={REQUEST_TITLE_MAX}
          placeholder="e.g. Senior Full Stack, React + Node"
          aria-label="Position title"
          className="h-8 w-72 max-w-full rounded-md border border-bench-line bg-bench-surface-2 px-2.5 text-[13px] focus:border-accent/50 focus:outline-none"
        />
        <button type="submit" className="h-8 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-contrast">
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(r.title ?? '');
            setEditing(false);
            setError(null);
          }}
          className="h-8 px-2 text-[12px] text-bench-ink-faint hover:text-bench-ink"
        >
          Cancel
        </button>
        {error && <span className="text-[12px] text-bench-critical">{error}</span>}
      </form>
    );
  }

  if (!r.title && !editable) return null;
  return (
    <div className="mt-1 flex items-center gap-2">
      {r.title ? (
        <span className="text-[14.5px] text-bench-ink-dim">{r.title}</span>
      ) : (
        <span className="text-[12.5px] text-bench-ink-faint">No position title</span>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit position title"
          className="grid h-6 w-6 place-items-center rounded text-bench-ink-faint hover:bg-bench-surface-2 hover:text-bench-ink"
        >
          <Pencil size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * The status moves that make sense now. Open and Shortlisting follow the
 * shortlist on their own; Submitted and Closed are deliberate steps.
 */
function StatusActions({ r }: { r: RequestSummary }) {
  const submitProblem = useRequestStatusProblem(r.id, 'submitted');
  const [error, setError] = useState<string | null>(null);
  if (r.status === 'closed') return null;
  return (
    <>
      {r.status === 'shortlisting' && !submitProblem && (
        <button
          type="button"
          onClick={() =>
            void setRequestStatus(r.id, 'submitted').then((res) => setError(res.ok ? null : res.reason))
          }
          className="flex h-9 items-center rounded-md border border-bench-line-bright bg-bench-surface px-3 text-[12.5px] text-bench-ink-dim hover:text-bench-ink"
        >
          Mark submitted
        </button>
      )}
      {error && (
        <span role="alert" className="text-[12px] text-bench-critical">
          {error}
        </span>
      )}
    </>
  );
}

const OUTCOMES: RequestOutcome[] = ['filled', 'partly_filled', 'lost', 'cancelled'];

/**
 * Closing asks how the request ended and, when roles were filled, who from
 * the shortlist was placed and how many came from outside the bench. That is
 * what the dashboard's bench contribution is made of.
 */
function ClosePanel({ r }: { r: RequestSummary }) {
  const shortlisted = useRequestShortlisted(r.id);
  const placements = usePlacements(r.id);
  const canClose = useCanManageRequests();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [outside, setOutside] = useState(0);
  const [errors, setErrors] = useState<CloseErrors>({});

  if (r.status === 'closed') {
    const fromBench = placements.length;
    const names = shortlisted.filter((v) => placements.some((p) => p.candidate_id === v.id)).map((v) => v.full_name ?? v.ref_code);
    return (
      <section className="mb-4 rounded-lg border border-bench-line bg-bench-surface px-4 py-3 text-[13px]">
        <span className="font-medium">Closed{r.outcome ? `: ${OUTCOME_LABEL[r.outcome]}` : ''}</span>
        <span className="text-bench-ink-dim">
          {r.closed_at && ` on ${formatDate(r.closed_at)}`}
          {(r.outcome === 'filled' || r.outcome === 'partly_filled') &&
            ` · ${fromBench} from the bench${names.length ? ` (${names.join(', ')})` : ''}, ${r.placed_outside} from outside`}
          . The shortlist is read-only.
        </span>
      </section>
    );
  }
  if (!canClose) return null;

  if (!open) {
    return (
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12.5px] text-bench-ink-faint underline-offset-2 hover:text-bench-ink hover:underline"
        >
          Close this request
        </button>
      </div>
    );
  }

  const fills = outcome === 'filled' || outcome === 'partly_filled';
  return (
    <form
      noValidate
      aria-labelledby="close-heading"
      onSubmit={(e) => {
        e.preventDefault();
        void closeRequest(r.id, {
          outcome,
          placed_candidate_ids: fills ? placed : [],
          placed_outside: fills ? outside : 0,
        }).then((res) => {
          if (res.ok) setOpen(false);
          else setErrors(res.errors);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
        }
      }}
      className="fade-up mb-4 rounded-lg border border-bench-line-bright bg-bench-surface p-4"
    >
      <h2 id="close-heading" className="text-[14px] font-medium">
        Close {r.client_name}
      </h2>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[11.5px] text-bench-ink-dim">How did it end?</legend>
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((o) => (
            <label
              key={o}
              className={cn(
                'flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12.5px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50',
                outcome === o ? 'border-accent/50 bg-accent/15 text-bench-ink' : 'border-bench-line text-bench-ink-dim',
              )}
            >
              <input
                type="radio"
                name="outcome"
                value={o}
                checked={outcome === o}
                onChange={() => setOutcome(o)}
                className="sr-only"
                autoFocus={o === 'filled'}
              />
              {OUTCOME_LABEL[o]}
            </label>
          ))}
        </div>
        {errors.outcome && <p role="alert" className="mt-1 text-[11.5px] text-bench-critical">{errors.outcome}</p>}
      </fieldset>

      {fills && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <fieldset>
            <legend className="mb-1.5 text-[11.5px] text-bench-ink-dim">Placed from the shortlist</legend>
            {shortlisted.length === 0 ? (
              <p className="text-[12px] text-bench-ink-faint">Nobody was shortlisted.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {shortlisted.map((v) => (
                  <li key={v.id}>
                    <label className="flex items-center gap-2 text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={placed.includes(v.id)}
                        onChange={(e) =>
                          setPlaced((xs) => (e.target.checked ? [...xs, v.id] : xs.filter((x) => x !== v.id)))
                        }
                        className="accent-[var(--color-accent)]"
                      />
                      <span className="tabular text-bench-ink-dim">{v.ref_code}</span> {v.full_name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-bench-ink-dim">Placed from outside the bench</span>
            <input
              type="number"
              min={0}
              max={100}
              value={outside}
              onChange={(e) => setOutside(Number(e.target.value))}
              className="tabular h-9 w-full rounded-md border border-bench-line bg-bench-surface-2 px-3 text-[13px] focus:border-accent/50 focus:outline-none"
            />
          </label>
          {errors.placed && (
            <p role="alert" className="text-[11.5px] text-bench-critical sm:col-span-2">
              {errors.placed}
            </p>
          )}
        </div>
      )}
      {errors.form && <p role="alert" className="mt-2 text-[11.5px] text-bench-critical">{errors.form}</p>}
      <p className="mt-3 text-[11.5px] text-bench-ink-faint">
        Closing is final. Placed candidates leave the bench, and the shortlist becomes read-only.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-[12.5px] text-bench-ink-faint hover:text-bench-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-accent-contrast hover:bg-accent-bright">
          Close request
        </button>
      </div>
    </form>
  );
}

/** Near misses: shown for judgement, never counted. */
function Partial({
  entries,
  sent,
  client,
  label,
  call,
}: {
  entries: PoolEntry[];
  sent: Set<string>;
  client: string;
  label: string;
  call?: boolean;
}) {
  if (!entries.length) return null;
  return (
    <details className="border-t border-bench-line">
      <summary className="cursor-pointer px-4 py-2.5 text-[12px] text-bench-ink-faint hover:text-bench-ink-dim">
        {label} <span className="tabular">({entries.length})</span>
      </summary>
      <ul>
        {entries.map((e) => (
          <CandidateLine key={e.v.id} e={e} first={false} sentBefore={sent.has(e.v.id)} client={client}>
            {call ? <InlineCall candidate={e.v} /> : <ReadyState e={e} />}
          </CandidateLine>
        ))}
      </ul>
    </details>
  );
}

/** The request's structured requirements, editable in place. */
function Requirements({ r }: { r: ClientRequest }) {
  const [editing, setEditing] = useState(false);
  const [skills, setSkills] = useState(r.required_skills);
  const [shifts, setShifts] = useState(r.required_shifts);
  const tags = useBenchTags(r.archetype_id);
  const locked = r.status === 'closed';

  if (!editing) {
    return (
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-bench-ink-faint">Requires</span>
        <RequirementChips skills={r.required_skills} shifts={r.required_shifts} />
        {!locked && (
          <button
            type="button"
            onClick={() => {
              setSkills(r.required_skills);
              setShifts(r.required_shifts);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-bench-ink-faint hover:text-bench-ink"
          >
            <Pencil size={11} aria-hidden /> Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="mt-3 grid max-w-2xl gap-3 rounded-lg border border-bench-line bg-bench-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void updateRequest(r.id, { required_skills: skills, required_shifts: shifts }).then((res) => {
          if (res.ok) setEditing(false);
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] text-bench-ink-dim">Required skills or tools</span>
        <TagInput value={skills} onChange={setSkills} suggestions={[...tags.stack, ...tags.skills]} placeholder="e.g. React, Zendesk" label="Required skills or tools" />
      </label>
      <div>
        <span className="mb-1.5 block text-[11.5px] text-bench-ink-dim">Required shifts</span>
        <ShiftToggles value={shifts} onChange={setShifts} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-contrast hover:bg-accent-bright">
          Save requirements
        </button>
      </div>
    </form>
  );
}

function ReadyState({ e }: { e: PoolEntry }) {
  const blocked = exportBlockReason(e.v);
  if (blocked) return <span className="text-right text-[11px] text-bench-warning">{blocked}</span>;
  return <span className="text-[11px] text-bench-healthy">Exportable</span>;
}

function CandidateLine({
  e,
  first,
  sentBefore,
  client,
  children,
}: {
  e: PoolEntry;
  first: boolean;
  sentBefore: boolean;
  client: string;
  children: React.ReactNode;
}) {
  const v = e.v;
  const tags = v.stack.length ? v.stack : v.skills;
  return (
    <li className={cn('fade-up px-4 py-3', !first && 'border-t border-bench-line')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <Link href={`/portal/candidates/${v.id}`} className="truncate text-[13.5px] font-medium hover:text-accent">
              {v.full_name}
            </Link>
            <span className="tabular text-[11px] text-bench-ink-faint">{v.ref_code}</span>
            <Score value={v.overall_score} basis={v.overall_basis} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Freshness v={v} className="text-[11.5px]" />
            {v.years_experience !== null && (
              <span className="text-[11.5px] capitalize text-bench-ink-faint">
                {v.years_experience}y {v.seniority}
              </span>
            )}
            {v.english_level && <span className="text-[11.5px] text-bench-ink-faint">{v.english_level}</span>}
            {sentBefore && (
              <span className="flex items-center gap-1 text-[11px] text-bench-warning" title={`Already sent to ${client}`}>
                <Eye size={11} aria-hidden /> Sent to {client} before
              </span>
            )}
            <FitNote fit={e.fit} />
            <CommittedTags committed={e.committed} />
          </div>
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.slice(0, 4).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end">{children}</div>
      </div>
    </li>
  );
}

function Big({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'healthy' | 'warning' | 'accent' | 'dim';
}) {
  return (
    <div>
      <div
        className={cn(
          'tabular text-[28px] font-semibold leading-none',
          tone === 'healthy' && 'text-bench-healthy',
          tone === 'warning' && 'text-bench-warning',
          tone === 'accent' && 'text-accent',
          tone === 'dim' && 'text-bench-ink-faint',
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-bench-ink-faint">{label}</div>
    </div>
  );
}

function Head({ title, count, hint }: { title: string; count: number; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bench-line px-4 py-2.5">
      <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
        {title}
        <span className="tabular ml-2 text-bench-ink-dim">{count}</span>
      </span>
      {hint && <span className="truncate text-[11px] text-bench-ink-faint">{hint}</span>}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-[12.5px] text-bench-ink-faint">{children}</div>;
}

