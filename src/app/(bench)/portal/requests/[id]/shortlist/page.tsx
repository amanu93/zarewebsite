'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CopyPlus,
  Download,
  Eye,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  X,
} from 'lucide-react';

import {
  addToShortlist,
  requestLabel,
  createShortlist,
  exportBlockReason,
  markShortlistExported,
  removeFromShortlist,
  reorderShortlist,
  requestFit,
  setRequestStatus,
  useArchetypes,
  useCanManageRequests,
  useCommitments,
  useCurrentUser,
  useRequestPool,
  useRequestSummary,
  useSentToClient,
  useShortlistCandidates,
  useShortlistsForRequest,
  useShortlistWarnings,
  type CandidateView,
  type Archetype,
  type ClientRequest,
  type Commitment,
  type RequestPool,
  type RequestSummary,
  type PoolEntry,
  type Shortlist,
  type ShortlistCandidate,
} from '@/bench/data';
import { buildShortlistExport, findLeaks, type ExportDocument } from '@/bench/export/shortlist';
import { Freshness, Score } from '@/bench/components/candidate-bits';
import { burstConfetti } from '@/bench/components/confetti';
import { InlineCall } from '@/bench/components/inline-call';
import { CommittedTags, FitNote, RequirementChips } from '@/bench/components/request-bits';
import { cn, formatDate } from '@/bench/utils';

/**
 * The shortlist builder. The screen where the bench turns into something a
 * client reads.
 *
 * Three rules are enforced here and, more importantly, underneath it in the
 * data layer: only Ready candidates can be added, everyone is re-checked at
 * the moment of export, and a sent shortlist is frozen. The UI's job is to
 * make the blocked path one click long — "Verify availability first." always
 * comes with the button that does it.
 */

type Entry = { entry: ShortlistCandidate; candidate: CandidateView };

export default function ShortlistPage() {
  const { id } = useParams<{ id: string }>();
  const request = useRequestSummary(id);
  const shortlists = useShortlistsForRequest(id);
  const archetype = useArchetypes().find((a) => a.id === request?.archetype_id) ?? null;
  const pool = useRequestPool(id);

  // The draft being worked on, else the most recent one sent.
  const current: Shortlist | null =
    shortlists.find((s) => s.status === 'draft') ?? shortlists[shortlists.length - 1] ?? null;

  // Everything the builder needs is resolved here, so a request removed or
  // reset mid-session shows this state instead of crashing the builder.
  if (!request || !archetype || !pool) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="text-[15px] font-medium">Request not found</div>
        <Link href="/portal/requests" className="mt-4 inline-block text-[12.5px] text-accent hover:text-accent-bright">
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <Builder
      key={current?.id ?? 'none'}
      requestId={id}
      request={request}
      archetype={archetype}
      pool={pool}
      shortlist={current}
    />
  );
}

function Builder({
  requestId,
  request,
  archetype,
  pool,
  shortlist,
}: {
  requestId: string;
  request: RequestSummary;
  archetype: Archetype;
  pool: RequestPool;
  shortlist: Shortlist | null;
}) {
  const user = useCurrentUser();
  const entries = useShortlistCandidates(shortlist?.id ?? '__none__');
  const sent = useSentToClient(request.client_name);
  const warnings = useShortlistWarnings(requestId);
  const committed = useCommitments(requestId);

  const isSent = shortlist?.status === 'exported';
  const closed = request.status === 'closed';
  const locked = isSent || closed;
  const canExport = useCanManageRequests();
  const inList = useMemo(() => new Set(entries.map((e) => e.candidate.id)), [entries]);

  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [justExported, setJustExported] = useState(false);
  const [startingVersion, setStartingVersion] = useState(false);

  // ---- export readiness, computed the same way the data layer checks it
  const blocked = entries
    .map((e) => ({ e, reason: exportBlockReason(e.candidate) }))
    .filter((x) => x.reason);
  const leaks = useMemo(() => findLeaks(entries.map((e) => e.candidate)), [entries]);
  const problems = [
    ...(entries.length === 0 ? ['Add at least one Ready candidate.'] : []),
    ...(blocked.length ? [`${blocked.length} ${blocked.length === 1 ? 'candidate needs' : 'candidates need'} attention.`] : []),
    ...leaks.map((l) => `${l.ref_code}: ${l.reason}`),
  ];

  const built: ExportDocument = useMemo(
    () =>
      buildShortlistExport({
        request,
        archetype,
        preparedBy: user,
        // A sent shortlist shows what was sent; a draft shows what WOULD be,
        // using the verification the client would be told about.
        entries: entries.map((e) => ({
          candidate: e.candidate,
          verified_at: isSent ? e.entry.verified_at : (e.candidate.last_verified_at ?? e.entry.verified_at),
        })),
        now: isSent && shortlist?.exported_at ? new Date(shortlist.exported_at) : undefined,
        frozen: isSent,
      }),
    [request, archetype, user, entries, isSent, shortlist?.exported_at],
  );
  // A sent shortlist previews exactly what was sent.
  const doc = isSent && shortlist?.exported_document ? shortlist.exported_document : built;

  async function ensureDraft(): Promise<string> {
    if (shortlist && !isSent) return shortlist.id;
    return createShortlist(requestId, `${request.client_name} — ${requestLabel(request, archetype)}`);
  }

  async function add(candidateId: string) {
    setError(null);
    try {
      const slId = await ensureDraft();
      const res = await addToShortlist(slId, candidateId);
      if (!res.ok) setError(res.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function exportPdf(e: React.MouseEvent) {
    if (!shortlist || problems.length) return;
    setExporting(true);
    setError(null);
    const origin = { x: e.clientX, y: e.clientY };
    try {
      // The data layer re-checks every candidate and builds the document it
      // records as sent. Only that document is rendered and leaves the browser.
      const res = await markShortlistExported(shortlist.id);
      if (!res.ok) {
        setError(res.blocked.length ? `${res.reason} ${res.blocked.map((b) => `${b.ref_code}: ${b.reason}`).join(' ')}` : res.reason);
        return;
      }
      const { renderShortlistPdf } = await import('@/bench/export/shortlist-pdf');
      download(await renderShortlistPdf(res.document), fileName(request.client_name));
      setJustExported(true);
      burstConfetti(origin);
    } catch (err) {
      setError(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  async function downloadAgain() {
    try {
      const { renderShortlistPdf } = await import('@/bench/export/shortlist-pdf');
      // Exactly what was sent, never a re-render of today's records.
      const sent = shortlist?.exported_document ?? doc;
      download(await renderShortlistPdf(sent), fileName(request.client_name, shortlist?.exported_at));
    } catch (err) {
      setError(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function newVersion() {
    if (startingVersion) return;
    setStartingVersion(true);
    try {
      const slId = await createShortlist(requestId, `${request.client_name} — ${requestLabel(request, archetype)}`);
      // Carry across whoever is still exportable; the rest stay behind.
      for (const e of entries) await addToShortlist(slId, e.candidate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStartingVersion(false);
    }
  }

  // Full matches first, then near misses; each group best score first.
  const available = [...pool.ready, ...pool.ready_partial].filter((e) => !inList.has(e.v.id));
  const oneCallAway = [...pool.one_call_away, ...pool.one_call_away_partial].filter((e) => !inList.has(e.v.id));
  const fullMatches = (xs: PoolEntry[]) => xs.filter((e) => e.fit.fits).length;

  return (
    <div className="px-5 py-6">
      <Link
        href={`/portal/requests/${requestId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink"
      >
        <ArrowLeft size={12} /> {request.client_name}
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[19px] font-semibold tracking-tight">Shortlist</h1>
            {isSent ? (
              <span className="inline-flex items-center gap-1 rounded border border-bench-healthy/30 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider text-bench-healthy">
                <Lock size={9} /> Sent {formatDate(shortlist!.exported_at)}
              </span>
            ) : (
              <span className="rounded border border-bench-line px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider text-bench-ink-faint">
                Draft
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            {request.client_name} · {archetype.name} ·{' '}
            <span className={cn('tabular', entries.length >= request.quantity ? 'text-bench-healthy' : 'text-bench-ink')}>
              {entries.length}
            </span>{' '}
            of {request.quantity} requested
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-bench-ink-faint">Requires</span>
            <RequirementChips skills={request.required_skills} shifts={request.required_shifts} />
          </div>
        </div>

        {locked ? (
          <div className="flex flex-wrap gap-2">
            {isSent && (
              <button type="button" onClick={() => void downloadAgain()} className={secondaryBtn}>
                <Download size={14} aria-hidden /> Download again
              </button>
            )}
            {!closed && (
              <button type="button" onClick={() => void newVersion()} disabled={startingVersion} className={secondaryBtn}>
                <CopyPlus size={14} aria-hidden /> Start a new version
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={(e) => void exportPdf(e)}
            disabled={exporting || problems.length > 0 || !canExport}
            title={canExport ? undefined : 'Only a recruiter or an exec can export.'}
            className="flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Export PDF
          </button>
          {!canExport && <span className="text-[11.5px] text-bench-ink-faint">Only a recruiter or an exec can export.</span>}
          </div>
        )}
      </div>

      {closed && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-bench-line bg-bench-surface px-4 py-3 text-[13px] text-bench-ink-dim">
          <Lock size={14} aria-hidden /> This request is closed. Its shortlist is read-only.
        </div>
      )}

      {justExported && isSent && (
        <div className="fade-up mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-bench-healthy/25 bg-bench-healthy/[0.06] px-4 py-3 text-[13px]">
          <Check size={15} className="text-bench-healthy" aria-hidden />
          <span className="flex-1">
            <span className="font-medium text-bench-healthy">PDF exported.</span>{' '}
            <span className="text-bench-ink-dim">
              {entries.length} {entries.length === 1 ? 'candidate' : 'candidates'}. This version is locked.
              {request.status !== 'submitted' && ' Once it is with the client, mark the request submitted.'}
            </span>
          </span>
          {request.status === 'shortlisting' && (
            <button
              type="button"
              onClick={() => void setRequestStatus(requestId, 'submitted').then((res) => !res.ok && setError(res.reason))}
              className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast hover:bg-accent-bright"
            >
              Mark submitted
            </button>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="fade-up mb-4 flex items-start gap-2 rounded-lg border border-bench-critical/30 bg-bench-critical/[0.06] px-4 py-3 text-[12.5px]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-bench-critical" />
          <span className="flex-1 text-bench-ink">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-bench-ink-faint hover:text-bench-ink" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {!locked && entries.length > 0 && problems.length > 0 && (
        <div className="mb-4 rounded-lg border border-bench-warning/25 bg-bench-warning/[0.05] px-4 py-3">
          <div className="text-[12.5px] font-medium text-bench-warning">Not ready to export</div>
          <ul className="mt-1 list-inside list-disc text-[12px] text-bench-ink-dim">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-4">
          <OrderedList
            entries={entries}
            shortlistId={shortlist?.id ?? null}
            locked={locked}
            sent={sent}
            request={request}
            warnings={warnings}
            committed={committed}
          />

          {!locked && (
            <>
              <Pool title="Ready to add" count={available.length} hint={`${fullMatches(available)} meet every requirement`}>
                {available.length === 0 ? (
                  <Muted>Every Ready candidate for this role is already on the list.</Muted>
                ) : (
                  available.map(({ v, fit, committed: elsewhere }, i) => (
                    <PoolRow
                      key={v.id}
                      v={v}
                      first={i === 0}
                      sentBefore={sent.has(v.id)}
                      client={request.client_name}
                      extra={
                        <>
                          <FitNote fit={fit} />
                          <CommittedTags committed={elsewhere} />
                        </>
                      }
                    >
                      {exportBlockReason(v) ? (
                        <span className="text-[11px] text-bench-warning">{exportBlockReason(v)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void add(v.id)}
                          className="flex h-7 items-center gap-1 rounded-md border border-bench-line-bright bg-bench-surface-2 px-2.5 text-[11.5px] font-medium transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          <Plus size={12} aria-hidden /> Add
                          <span className="sr-only">{v.ref_code}</span>
                        </button>
                      )}
                    </PoolRow>
                  ))
                )}
              </Pool>

              <Pool
                title="One call away"
                count={oneCallAway.length}
                hint={`${fullMatches(oneCallAway)} meet every requirement · can't be added yet`}
              >
                {oneCallAway.length === 0 ? (
                  <Muted>Nobody waiting on a call.</Muted>
                ) : (
                  oneCallAway.map(({ v, fit, committed: elsewhere }, i) => (
                    <PoolRow
                      key={v.id}
                      v={v}
                      first={i === 0}
                      sentBefore={sent.has(v.id)}
                      client={request.client_name}
                      dim
                      extra={
                        <>
                          <FitNote fit={fit} />
                          <CommittedTags committed={elsewhere} />
                        </>
                      }
                    >
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-bench-warning">Verify availability first.</span>
                        <InlineCall
                          candidate={v}
                          // A good call from here means "I wanted them on
                          // this list", so they go straight on it.
                          onLogged={(o) => {
                            if (o === 'available') void add(v.id);
                          }}
                        />
                      </div>
                    </PoolRow>
                  ))
                )}
              </Pool>
            </>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <PdfPreview doc={doc} empty={entries.length === 0} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- ordered list --

function OrderedList({
  entries,
  shortlistId,
  locked,
  sent,
  request,
  warnings,
  committed,
}: {
  entries: Entry[];
  shortlistId: string | null;
  locked: boolean;
  sent: Set<string>;
  request: ClientRequest;
  warnings: Map<string, string[]>;
  committed: Map<string, Commitment[]>;
}) {
  const client = request.client_name;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function move(ids: string[], moved?: string) {
    if (!shortlistId) return;
    void reorderShortlist(shortlistId, ids);
    if (moved) {
      const ref = entries.find((e) => e.candidate.id === moved)?.candidate.ref_code;
      setAnnouncement(`${ref} moved to position ${ids.indexOf(moved) + 1} of ${ids.length}.`);
    }
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    // Insert at the target's original index: dragging down lands after the
    // target, dragging up lands before it, which is what the eye expects.
    const to = entries.findIndex((e) => e.candidate.id === targetId);
    const ids = entries.map((e) => e.candidate.id).filter((x) => x !== dragId);
    ids.splice(to, 0, dragId);
    move(ids, dragId);
  }

  function nudge(index: number, delta: -1 | 1) {
    const ids = entries.map((e) => e.candidate.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    const moved = ids[index];
    [ids[index], ids[j]] = [ids[j], ids[index]];
    move(ids, moved);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-bench-line-bright bg-bench-surface">
      <div className="flex items-center justify-between gap-3 border-b border-bench-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
          On the shortlist
          <span className="tabular ml-2 text-bench-ink-dim">{entries.length}</span>
        </span>
        {!locked && entries.length > 1 && (
          <span className="text-[11px] text-bench-ink-faint">Drag to set the order the client reads</span>
        )}
      </div>

      {entries.length === 0 ? (
        <Muted>Nobody yet. Add Ready candidates from below.</Muted>
      ) : (
        <ol>
          {entries.map((e, i) => {
            const v = e.candidate;
            const reason = exportBlockReason(v);
            return (
              <li
                key={v.id}
                draggable={!locked}
                onDragStart={(ev) => {
                  setDragId(v.id);
                  ev.dataTransfer.effectAllowed = 'move';
                  ev.dataTransfer.setData('text/plain', v.id);
                }}
                onDragOver={(ev) => {
                  if (!dragId) return;
                  ev.preventDefault();
                  setOverId(v.id);
                }}
                onDragLeave={() => setOverId((o) => (o === v.id ? null : o))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  drop(v.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={cn(
                  'fade-up group flex items-center gap-3 px-3 py-3 transition-colors',
                  i > 0 && 'border-t border-bench-line',
                  dragId === v.id && 'opacity-40',
                  overId === v.id && dragId !== v.id && 'bg-accent/[0.07]',
                  reason && !locked && 'bg-bench-warning/[0.04]',
                )}
              >
                {!locked ? (
                  <GripVertical size={14} className="shrink-0 cursor-grab text-bench-ink-faint active:cursor-grabbing" aria-hidden />
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="tabular w-5 shrink-0 text-center text-[12px] text-bench-ink-faint">{i + 1}</span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="tabular text-[14px] font-semibold">{v.ref_code}</span>
                    <Link href={`/portal/candidates/${v.id}`} className="truncate text-[12px] text-bench-ink-faint hover:text-accent" title="Internal only — not in the PDF">
                      {v.full_name}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Score value={v.overall_score} basis={v.overall_basis} />
                    {locked ? (
                      <span className="text-[11.5px] text-bench-ink-faint">Verified {formatDate(e.entry.verified_at)}</span>
                    ) : (
                      <Freshness v={v} className="text-[11.5px]" />
                    )}
                    {!locked && sent.has(v.id) && (
                      <span className="flex items-center gap-1 text-[11px] text-bench-warning">
                        <Eye size={11} /> Sent to {client} before
                      </span>
                    )}
                  </div>
                  {!locked && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <FitNote fit={requestFit(request, v)} />
                      <CommittedTags committed={committed.get(v.id) ?? []} />
                    </div>
                  )}
                  {!locked &&
                    (warnings.get(v.id) ?? []).map((w) => (
                      <div key={w} className="mt-1 flex items-center gap-1.5 text-[11.5px] text-bench-warning">
                        <AlertTriangle size={11} aria-hidden /> {w}
                      </div>
                    ))}
                  {reason && !locked && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11.5px] font-medium text-bench-warning">{reason}</span>
                      {v.layer !== 'ready' && <InlineCall candidate={v} />}
                    </div>
                  )}
                </div>

                {!locked && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconBtn label={`Move ${v.ref_code} up`} disabled={i === 0} onClick={() => nudge(i, -1)}>
                      <ArrowUp size={13} />
                    </IconBtn>
                    <IconBtn label={`Move ${v.ref_code} down`} disabled={i === entries.length - 1} onClick={() => nudge(i, 1)}>
                      <ArrowDown size={13} />
                    </IconBtn>
                    <IconBtn
                      label={`Remove ${v.ref_code}`}
                      danger
                      onClick={() => shortlistId && void removeFromShortlist(shortlistId, v.id)}
                    >
                      <X size={13} />
                    </IconBtn>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

// ------------------------------------------------------------ PDF preview --

/**
 * The real PDF, re-rendered as the list changes. Not an HTML imitation: the
 * preview and the export are the same document from the same whitelist, so
 * what you see is exactly what the client receives.
 */
function PdfPreview({ doc, empty }: { doc: ExportDocument; empty: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  // Serialised once per new document, not on every render.
  const key = useMemo(() => JSON.stringify(doc), [doc]);

  useEffect(() => {
    if (empty) return;
    let cancelled = false;
    setRendering(true);
    const t = window.setTimeout(async () => {
      try {
        const { renderShortlistPdf } = await import('@/bench/export/shortlist-pdf');
        const blob = await renderShortlistPdf(JSON.parse(key) as ExportDocument);
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
        setFailed(null);
      } catch (err) {
        if (!cancelled) setFailed(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [key, empty]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return (
    <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex items-center justify-between gap-3 border-b border-bench-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">PDF preview</span>
        <span className="flex items-center gap-1.5 text-[11px] text-bench-ink-faint">
          {rendering && !empty && <Loader2 size={11} className="animate-spin" />}
          {empty ? 'Nothing to preview' : `${doc.candidates.length + 2} pages · ref codes only`}
        </span>
      </div>
      <div className="relative h-[70vh] max-h-[640px] min-h-[420px] bg-bench-surface-2">
        {empty ? (
          <div className="grid h-full place-items-center px-8 text-center text-[12.5px] text-bench-ink-faint">
            The client document appears here as you add candidates.
          </div>
        ) : failed ? (
          <div className="grid h-full place-items-center px-8 text-center text-[12.5px] text-bench-critical">
            Preview failed: {failed}
          </div>
        ) : url ? (
          <iframe
            key={url}
            src={`${url}#page=1&toolbar=0&navpanes=0&view=FitH`}
            title="Shortlist PDF preview"
            className="h-full w-full"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 size={18} className="animate-spin text-bench-ink-faint" />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- pieces --

function Pool({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex items-center justify-between gap-3 border-b border-bench-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
          {title}
          <span className="tabular ml-2 text-bench-ink-dim">{count}</span>
        </span>
        {hint && <span className="truncate text-[11px] text-bench-ink-faint">{hint}</span>}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

function PoolRow({
  v,
  first,
  sentBefore,
  client,
  dim,
  extra,
  children,
}: {
  v: CandidateView;
  first: boolean;
  sentBefore: boolean;
  client: string;
  dim?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className={cn('fade-up flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5', !first && 'border-t border-bench-line')}>
      <div className={cn('min-w-0 flex-1', dim && 'opacity-80')}>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="tabular text-[13px] font-medium">{v.ref_code}</span>
          <span className="truncate text-[12px] text-bench-ink-faint">{v.full_name}</span>
          <Score value={v.overall_score} basis={v.overall_basis} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-bench-ink-faint">
          <Freshness v={v} className="text-[11.5px]" />
          {v.years_experience !== null && (
            <span className="capitalize">
              {v.years_experience}y {v.seniority}
            </span>
          )}
          {v.english_level && <span>{v.english_level}</span>}
          {(v.stack.length ? v.stack : v.skills).slice(0, 3).join(' · ')}
          {sentBefore && (
            <span className="flex items-center gap-1 text-bench-warning">
              <Eye size={11} aria-hidden /> Sent to {client} before
            </span>
          )}
        </div>
        {extra && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">{extra}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // aria-disabled, not disabled: a button that just moved to the top
      // keeps keyboard focus instead of dropping it on the page.
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-bench-ink-faint transition-colors aria-disabled:opacity-25',
        danger ? 'hover:bg-bench-critical/10 hover:text-bench-critical' : 'aria-[disabled]:hover:bg-transparent hover:bg-bench-surface-3 hover:text-bench-ink',
      )}
    >
      {children}
    </button>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-[12.5px] text-bench-ink-faint">{children}</div>;
}

const secondaryBtn =
  'flex h-10 items-center gap-2 rounded-md border border-bench-line-bright bg-bench-surface px-3.5 text-[12.5px] font-medium text-bench-ink-dim transition-colors hover:text-bench-ink';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(client: string, at?: string | null) {
  const date = (at ? new Date(at) : new Date()).toISOString().slice(0, 10);
  const slug = client.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `Zare-Shortlist-${slug}-${date}.pdf`;
}
