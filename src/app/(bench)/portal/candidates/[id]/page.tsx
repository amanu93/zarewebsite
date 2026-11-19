'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Link2,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  ShieldAlert,
} from 'lucide-react';

import {
  archiveCandidate,
  exportBlockReason,
  IMMEDIATE,
  scoreLabel,
  updateContact,
  useArchetypes,
  useCallDueState,
  useCandidate,
  useCandidateCalls,
  useDuplicateCandidates,
  validateContact,
  useSeenByClients,
  useUsers,
  type ArchiveReason,
  type CallLog,
  type CallOutcome,
  type CandidateView,
  type QueueReason,
  type Layer,
} from '@/bench/data';
import {
  ARCHIVE_LABEL,
  ArchetypeTag,
  Freshness,
  LayerBadge,
  Score,
  Tag,
} from '@/bench/components/candidate-bits';
import { ApplicantCv } from '@/bench/components/applicant-cv';
import { CallOutcomeControls } from '@/bench/components/call-outcome';
import { DuplicateNotice } from '@/bench/components/duplicate-notice';
import { useCallToast } from '@/bench/components/call-toast';
import { daysFromToday, inDays, plural } from '@/bench/dates';
import { cn, formatDate, LAYER_STYLES, timeAgo } from '@/bench/utils';

/**
 * One candidate's record. Laid out in the order a recruiter needs it before
 * picking up the phone: can I put this person forward (top), how do I reach
 * them, what did we assess, and what has already happened.
 *
 * Identity fields sit in a panel explicitly marked internal. They exist here
 * and in the call queue, and nowhere a client could ever see.
 */

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const v = useCandidate(id);
  const [erasedRef, setErasedRef] = useState<string | null>(null);

  if (erasedRef) return <Erased refCode={erasedRef} />;
  if (!v) return <NotFound />;

  return <CandidateRecord v={v} onErased={() => setErasedRef(v.ref_code)} />;
}

function CandidateRecord({ v, onErased }: { v: CandidateView; onErased: () => void }) {
  const users = useUsers();
  const calls = useCandidateCalls(v.id);
  const seen = useSeenByClients(v.id);
  const name = (uid: string | null) => users.find((u) => u.id === uid)?.full_name ?? '—';

  const blocked = exportBlockReason(v);

  return (
    <div className="px-5 py-6">
      <Link
        href="/portal/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink"
      >
        <ArrowLeft size={12} /> Candidates
      </Link>

      {/* ---- header ---- */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                'text-[22px] font-semibold tracking-tight',
                v.layer === 'archived' && 'text-bench-ink-dim line-through decoration-bench-ink-faint',
              )}
            >
              {v.full_name}
            </h1>
            <span className="tabular rounded border border-bench-line bg-bench-surface-2 px-1.5 py-0.5 text-[12px] text-bench-ink-dim">
              {v.ref_code}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <LayerBadge layer={v.layer} className="text-[13px]" />
            {v.reassess_due && (
              <span className="rounded border border-bench-warning/30 px-1.5 py-px text-[11px] text-bench-warning">Re-assess due</span>
            )}
            <ArchetypeTag v={v} />
            <span className="text-[12px] text-bench-ink-faint">{v.archetype_name}</span>
            <span className="text-[12px] text-bench-ink-faint">Owner · {name(v.owner_id)}</span>
          </div>
        </div>
        {v.layer !== 'archived' && (
          <Link
            href={`/portal/candidates/${v.id}/assess`}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-medium transition-colors',
              v.assessed_at === null
                ? 'bg-accent font-semibold text-accent-contrast hover:bg-accent-bright'
                : 'border border-bench-line-bright bg-bench-surface text-bench-ink-dim hover:text-bench-ink',
            )}
          >
            <ClipboardCheck size={14} />
            {v.assessed_at === null ? 'Assess' : 'Re-assess'}
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CallPanel v={v} />
          <ExportPanel v={v} blocked={blocked} />
          <AvailabilityPanel v={v} />
          <AssessmentPanel v={v} assessor={name(v.assessed_by)} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ContactPanel v={v} />
          <Panel title="Call history" count={calls.length}>
            {calls.length === 0 ? (
              <Muted>No calls logged yet.</Muted>
            ) : (
              <ol className="relative px-4 py-3">
                {calls.map((c, i) => (
                  <li key={c.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < calls.length - 1 && (
                      <span className="absolute left-[3px] top-3 h-full w-px bg-bench-line" aria-hidden />
                    )}
                    <span
                      className={cn('relative mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full', OUTCOME[c.outcome].dot)}
                    />
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn('text-[12.5px]', OUTCOME[c.outcome].text)}>
                          {OUTCOME[c.outcome].label}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-bench-ink-faint" title={formatDate(c.called_at)}>
                          {timeAgo(c.called_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-bench-ink-faint">
                        {name(c.called_by)}
                        {c.outcome === 'archived' && c.note && c.note in ARCHIVE_LABEL
                          ? ` · ${ARCHIVE_LABEL[c.note as ArchiveReason]}`
                          : callDetail(c)
                            ? ` · ${callDetail(c)}`
                            : ''}
                      </div>
                      {c.note && c.outcome !== 'archived' && (
                        <div className="mt-0.5 text-[11.5px] text-bench-ink-dim">“{c.note}”</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Shortlist history" count={seen.length}>
            {seen.length === 0 ? (
              <Muted>Not yet put in front of any client.</Muted>
            ) : (
              <ul>
                {seen.map((s, i) => (
                  <li key={`${s.request_id}-${i}`} className={cn(i > 0 && 'border-t border-bench-line')}>
                    <Link
                      href={`/portal/requests/${s.request_id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-bench-surface-2"
                    >
                      <span className="truncate text-[12.5px]">{s.client_name}</span>
                      <span className="shrink-0 text-[11px] text-bench-ink-faint">
                        {s.exported_at ? `Sent ${formatDate(s.exported_at)}` : 'Draft'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <ArchivePanel v={v} onErased={onErased} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- call panel --

const OUTCOME: Record<CallOutcome, { label: string; dot: string; text: string }> = {
  available: { label: 'Confirmed available', dot: 'bg-bench-healthy', text: 'text-bench-healthy' },
  not_available: { label: 'Not available', dot: 'bg-bench-warning', text: 'text-bench-warning' },
  no_answer: { label: 'No answer', dot: 'bg-bench-ink-faint', text: 'text-bench-ink-dim' },
  archived: { label: 'Archived', dot: 'bg-bench-critical', text: 'text-bench-critical' },
};

/** What a call recorded, in one line for the history. */
function callDetail(c: CallLog): string | null {
  if (c.outcome === 'available') {
    const parts = [
      c.notice_period === IMMEDIATE
        ? 'can start immediately'
        : [c.notice_period && `notice ${c.notice_period}`, c.earliest_start_date && `start ${formatDate(c.earliest_start_date)}`]
            .filter(Boolean)
            .join(', '),
      c.shift_flexibility?.length ? c.shift_flexibility.join(', ') : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
  if (c.outcome === 'not_available' && c.recall_at) return `call again ${formatDate(c.recall_at)}`;
  return null;
}

const DUE_LABEL: Record<QueueReason, string> = {
  never_verified: 'Due now: never verified.',
  expired: 'Due now: availability has expired.',
  expiring_soon: 'Due now: availability expires within a week.',
  no_answer_retry: 'Due now: retry after no answer.',
  recall_due: 'Due now: recall date reached.',
};

/**
 * Logging a call from the record, so "Verify availability first." on the
 * shortlist is one click away from being resolved rather than a dead end.
 *
 * Uses the queue's own rule for whether a call is due. When it is not, the
 * outcomes sit behind "Call anyway", so nobody re-verifies a fresh candidate
 * by habit and resets their clock for nothing.
 */
function CallPanel({ v }: { v: CandidateView }) {
  const due = useCallDueState(v.id);
  const [anyway, setAnyway] = useState(false);
  const [flash, setFlash] = useState<{ from: Layer; outcome: CallOutcome } | null>(null);

  // Raw candidates are assessed before anyone calls them (M4); archived
  // candidates only come back through a due recall.
  if (!due || v.layer === 'raw') return null;
  if (v.layer === 'archived' && due.kind !== 'due') return null;

  const showControls = due.kind === 'due' || anyway;
  const status =
    due.kind === 'due'
      ? { text: DUE_LABEL[due.reason], tone: 'text-bench-warning' }
      : due.kind === 'cooldown'
        ? { text: `No answer recently. Back in the queue ${inDays(due.until)}.`, tone: 'text-bench-ink-dim' }
        : due.why === 'recall_scheduled' && due.next_due_at
          ? {
              text: `Not available. Call again on ${formatDate(due.next_due_at)}.`,
              tone: 'text-bench-ink-dim',
            }
          : due.next_due_at
            ? {
                text: `Next due in ${plural(Math.max(1, daysFromToday(due.next_due_at) ?? 0), 'day')}.`,
                tone: 'text-bench-ink-dim',
              }
            : { text: 'No call due.', tone: 'text-bench-ink-dim' };

  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
            Verify availability
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {v.phone && (
              <a href={`tel:${v.phone}`} className="tabular text-[14px] text-accent hover:text-accent-bright">
                {v.phone}
              </a>
            )}
            <span className={cn('text-[12px]', status.tone)}>{status.text}</span>
          </div>
        </div>
        {showControls ? (
          <CallOutcomeControls
            candidate={v}
            labels="always"
            className="w-full sm:w-auto"
            onLogged={(outcome) => {
              setFlash({ from: v.layer, outcome });
              setAnyway(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAnyway(true)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-bench-line bg-bench-surface-2 px-3 text-[12px] text-bench-ink-dim transition-colors hover:text-bench-ink"
          >
            <PhoneCall size={13} aria-hidden /> Call anyway
          </button>
        )}
      </div>

      {flash && (
        <div key={`${flash.outcome}-${v.updated_at}`} className="fade-up mt-3 flex items-center gap-2 border-t border-bench-line pt-3 text-[12px] text-bench-ink-dim">
          <CheckCircle2 size={13} className={OUTCOME[flash.outcome].text} aria-hidden />
          <span>Logged: {OUTCOME[flash.outcome].label.toLowerCase()}.</span>
          {flash.from !== v.layer ? (
            <span>
              Moved <span className={LAYER_STYLES[flash.from].text}>{LAYER_STYLES[flash.from].label}</span>
              {' → '}
              <span className={cn('font-medium', LAYER_STYLES[v.layer].text)}>{LAYER_STYLES[v.layer].label}</span>
            </span>
          ) : (
            <span className="text-bench-ink-faint">Still {LAYER_STYLES[v.layer].label}.</span>
          )}
        </div>
      )}
    </section>
  );
}

function ExportPanel({ v, blocked }: { v: CandidateView; blocked: string | null }) {
  if (v.layer === 'archived') return null;
  return (
    <section
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        blocked ? 'border-bench-line bg-bench-surface' : 'border-bench-healthy/25 bg-bench-healthy/[0.05]',
      )}
    >
      {blocked ? (
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-bench-warning" />
      ) : (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-bench-healthy" />
      )}
      <div className="text-[12.5px] leading-relaxed">
        {blocked ? (
          <>
            <span className="font-medium text-bench-ink">Not exportable.</span>{' '}
            <span className="text-bench-ink-dim">{blocked}</span>
          </>
        ) : (
          <>
            <span className="font-medium text-bench-healthy">Exportable.</span>{' '}
            <span className="text-bench-ink-dim">
              Can go on a client shortlist until {formatDate(v.expires_at)}.
            </span>
          </>
        )}
      </div>
    </section>
  );
}

function AvailabilityPanel({ v }: { v: CandidateView }) {
  const pct =
    v.days_until_expiry === null ? 0 : Math.max(0, Math.min(1, v.days_until_expiry / v.freshness_days));
  const barTone =
    v.layer !== 'ready' ? 'bg-bench-critical' : (v.days_until_expiry ?? 0) <= 7 ? 'bg-bench-warning' : 'bg-bench-healthy';

  return (
    <Panel title="Availability" hint="Perishable">
      <div className="px-4 py-4">
        {v.layer !== 'raw' && v.layer !== 'archived' && v.availability_status !== 'not_available' && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
              <Freshness v={v} />
              <span className="text-bench-ink-faint">{v.freshness_days}-day window</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bench-surface-3">
              <div className={cn('h-full rounded-full transition-[width] duration-500', barTone)} style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        )}
        <Fields>
          <Field label="Status" value={STATUS_LABEL[v.availability_status]} />
          <Field label="Last verified" value={v.last_verified_at ? timeAgo(v.last_verified_at) : 'Never'} />
          {v.availability_status === 'not_available' ? (
            // Someone who said no has no shelf life and no start date: only
            // the day to ask again.
            <Field label="Call again" value={formatDate(v.recall_at)} />
          ) : (
            <>
              <Field label="Good until" value={formatDate(v.expires_at)} />
              <Field label="Notice period" value={v.notice_period ?? 'Not asked yet'} />
              <Field
                label="Earliest start"
                value={
                  v.notice_period === IMMEDIATE
                    ? 'Immediately'
                    : v.earliest_start_date
                      ? formatDate(v.earliest_start_date)
                      : 'Not asked yet'
                }
              />
            </>
          )}
          <Field label="Shifts" value={v.shift_flexibility.length ? v.shift_flexibility.join(', ') : '—'} />
          <Field label="Work setup" value={v.setup_verified ? 'Verified' : 'Not verified'} />
        </Fields>
      </div>
    </Panel>
  );
}

const STATUS_LABEL = { available: 'Available', not_available: 'Not available', unknown: 'Unknown' };

function AssessmentPanel({ v, assessor }: { v: CandidateView; assessor: string }) {
  const archetype = useArchetypes().find((a) => a.id === v.archetype_id);

  if (v.assessed_at === null) {
    return (
      <Panel title="Assessment" hint="Permanent">
        <div className="px-4 py-6 text-center">
          <div className="text-[13px] font-medium">Not assessed</div>
          <p className="mx-auto mt-1 max-w-sm text-[12px] text-bench-ink-dim">
            Raw candidates are sourced but unassessed. They cannot become Ready, and they
            never appear in the call queue, until someone assesses them.
          </p>
          {v.layer !== 'archived' && (
            <Link
              href={`/portal/candidates/${v.id}/assess`}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent hover:bg-accent/20"
            >
              <ClipboardCheck size={13} /> Assess now
            </Link>
          )}
        </div>
      </Panel>
    );
  }

  const overridden =
    v.overall_score !== null &&
    v.overall_score_calculated !== null &&
    v.overall_score !== v.overall_score_calculated;
  const delta = overridden ? v.overall_score! - v.overall_score_calculated! : 0;
  // Always the role's weights from Settings. Without the optional technical
  // score, overall is communication only, and says so.
  const commShare = Math.round((archetype?.communication_weight ?? 0) * 100);

  return (
    <Panel title="Assessment" hint={`${assessor} · ${formatDate(v.assessed_at)}`}>
      <div className="grid gap-px bg-bench-line sm:grid-cols-3">
        <div className="bg-bench-surface px-4 py-3">
          <Label>Overall</Label>
          {v.overall_score !== null ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tabular text-[22px] font-semibold leading-none">
                  {v.overall_score.toFixed(1)}
                </span>
                <span className={cn('text-[11.5px]', scoreLabel(v.overall_score) ? 'text-bench-ink-dim' : 'text-bench-critical')}>
                  {scoreLabel(v.overall_score) ?? 'Below export floor'}
                </span>
              </div>
              {v.overall_basis === 'communication_only' && (
                <div className="mt-1 text-[11px] text-bench-warning">Communication only: no technical score</div>
              )}
              {v.overall_score_calculated !== null && (
                <div className="mt-1.5 text-[11px] text-bench-ink-faint">
                  Calculated <span className="tabular text-bench-ink-dim">{v.overall_score_calculated.toFixed(1)}</span>
                  {overridden && (
                    <span className={cn('tabular ml-1.5', delta > 0 ? 'text-accent' : 'text-bench-warning')}>
                      {delta > 0 ? '+' : '−'}
                      {Math.abs(delta).toFixed(1)} adjusted
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 text-[12px] text-bench-ink-faint">—</div>
          )}
        </div>
        <ScoreCell label="Communication" value={v.communication_score} weight={v.communication_score !== null ? commShare : null} />
        <ScoreCell label="Technical" value={v.technical_score} weight={100 - commShare} />
      </div>

      {overridden && (
        <div className="flex gap-2.5 border-t border-bench-line bg-bench-surface-2/50 px-4 py-2.5 text-[12px]">
          <span className="shrink-0 text-bench-ink-faint">Why adjusted</span>
          <span className="text-bench-ink-dim">{v.overall_override_reason}</span>
        </div>
      )}
      <div className="border-t border-bench-line px-4 py-4">
        <Fields>
          <Field label="Experience" value={v.years_experience !== null ? `${v.years_experience} years` : '—'} />
          <Field label="Seniority" value={v.seniority ? cap(v.seniority) : '—'} />
          <Field label="English" value={v.english_level ?? '—'} />
        </Fields>

        {(v.stack.length > 0 || v.skills.length > 0) && (
          <div className="mt-4 flex flex-col gap-2.5">
            {v.stack.length > 0 && (
              <TagRow label="Stack">
                {v.stack.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </TagRow>
            )}
            {v.skills.length > 0 && (
              <TagRow label="Skills">
                {v.skills.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </TagRow>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Strengths</Label>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {v.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-[12.5px] leading-snug">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-bench-healthy" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Consideration</Label>
            <p className="mt-1.5 flex gap-2 text-[12.5px] leading-snug">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-bench-warning" />
              {v.concern ?? '—'}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ScoreCell({ label, value, weight }: { label: string; value: number | null; weight: number | null }) {
  return (
    <div className="bg-bench-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {weight !== null && <span className="tabular text-[10px] text-bench-ink-faint">{weight}% of overall</span>}
      </div>
      <div className="mt-1">
        <Score value={value} showLabel={false} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sidebar --

function ContactPanel({ v }: { v: CandidateView }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <EditContact v={v} onDone={() => setEditing(false)} />;
  return (
    <Panel
      title="Contact"
      hint={
        v.layer === 'archived' ? (
          'Internal only'
        ) : (
          <span>
            Internal only ·{' '}
            <button type="button" onClick={() => setEditing(true)} className="text-accent hover:text-accent-bright">
              Edit
            </button>
          </span>
        )
      }
    >
      <ul className="px-4 py-3 text-[12.5px]">
        <ContactRow icon={<Phone size={12} />}>
          {v.phone ? (
            <a href={`tel:${v.phone}`} className="tabular hover:text-accent">
              {v.phone}
            </a>
          ) : (
            '—'
          )}
        </ContactRow>
        <ContactRow icon={<Mail size={12} />}>
          {v.email ? (
            <a href={`mailto:${v.email}`} className="truncate hover:text-accent">
              {v.email}
            </a>
          ) : (
            '—'
          )}
        </ContactRow>
        <ContactRow icon={<MapPin size={12} />}>{v.location ?? '—'}</ContactRow>
        <ContactRow icon={<Link2 size={12} />}>
          {v.linkedin_url ? (
            <a href={v.linkedin_url} target="_blank" rel="noreferrer" className="truncate hover:text-accent">
              Profile
            </a>
          ) : (
            <span className="text-bench-ink-faint">No profile linked</span>
          )}
        </ContactRow>
        <ContactRow icon={<FileText size={12} />}>
          {v.cv_url ? (
            <a href={v.cv_url} target="_blank" rel="noreferrer" className="hover:text-accent">
              View CV
            </a>
          ) : v.applied_job_id ? (
            <ApplicantCv applicantId={v.applied_job_id} />
          ) : (
            <span className="text-bench-ink-faint">No CV uploaded</span>
          )}
        </ContactRow>
      </ul>
      {v.notes && (
        <div className="border-t border-bench-line px-4 py-3">
          <Label>Notes</Label>
          <p className="mt-1 whitespace-pre-line text-[12.5px] text-bench-ink-dim">{v.notes}</p>
        </div>
      )}
    </Panel>
  );
}

/** Editing contact details runs the same validation and duplicate check as adding someone. */
function EditContact({ v, onDone }: { v: CandidateView; onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: v.full_name ?? '',
    phone: v.phone ?? '',
    email: v.email ?? '',
    location: v.location ?? '',
    linkedin_url: v.linkedin_url ?? '',
  });
  const [ack, setAck] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const duplicates = useDuplicateCandidates(form, v.id);
  const errors = touched ? validateContact(form) : {};
  const blocked = duplicates.phone.length > 0 || (duplicates.similar.length > 0 && !ack);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k !== 'location' && k !== 'linkedin_url') setAck(false);
  };

  const fields: [keyof typeof form, string, string][] = [
    ['full_name', 'Full name', 'text'],
    ['phone', 'Phone', 'tel'],
    ['email', 'Email', 'email'],
    ['location', 'Location', 'text'],
    ['linkedin_url', 'LinkedIn', 'url'],
  ];

  return (
    <Panel title="Edit contact" hint="Internal only">
      <form
        noValidate
        className="flex flex-col gap-3 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (Object.keys(validateContact(form)).length || blocked) return;
          void updateContact(v.id, form).then((res) => {
            if (res.ok) onDone();
            else setServerError(Object.values(res.errors)[0] ?? 'Could not save.');
          });
        }}
      >
        {fields.map(([k, label, type]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] text-bench-ink-faint">{label}</span>
            <input
              type={type}
              value={form[k]}
              onChange={set(k)}
              aria-invalid={Boolean(errors[k])}
              className="h-8 w-full rounded-md border border-bench-line bg-bench-surface-2 px-2.5 text-[12.5px] focus:border-accent/50 focus:outline-none aria-[invalid=true]:border-bench-critical/60"
            />
            {errors[k] && <span role="alert" className="mt-1 block text-[11px] text-bench-critical">{errors[k]}</span>}
          </label>
        ))}
        <DuplicateNotice matches={duplicates} acknowledged={ack} onAcknowledge={setAck} />
        {serverError && <p role="alert" className="text-[11.5px] text-bench-critical">{serverError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onDone} className="px-2.5 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={duplicates.phone.length > 0}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-contrast hover:bg-accent-bright disabled:opacity-40"
          >
            Save contact
          </button>
        </div>
      </form>
    </Panel>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 py-1">
      <span className="shrink-0 text-bench-ink-faint">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}

/**
 * Archiving from the record. do_not_contact takes a second, explicit
 * confirmation because it is the one irreversible action in the product:
 * the person's details are erased and cannot be recovered.
 */
function ArchivePanel({ v, onErased }: { v: CandidateView; onErased: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const toast = useCallToast();

  async function archive(reason: Exclude<ArchiveReason, 'do_not_contact'>) {
    const callId = await archiveCandidate(v.id, reason);
    setOpen(false);
    if (callId) toast({ callId, message: `${v.full_name ?? v.ref_code}: archived.`, noteable: false });
  }

  if (v.layer === 'archived') {
    return (
      <Panel title="Archived">
        <div className="px-4 py-3 text-[12.5px]">
          <div className="text-bench-ink">{v.archived_reason ? ARCHIVE_LABEL[v.archived_reason] : 'Archived'}</div>
          <div className="mt-1 text-bench-ink-faint">
            {v.recall_at
              ? `Back in the call queue for a recall on ${formatDate(v.recall_at)}.`
              : 'Not scheduled for recall.'}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12.5px] text-bench-ink-faint transition-colors hover:text-bench-critical"
        >
          <Archive size={13} /> Archive this candidate
        </button>
      ) : confirmErase ? (
        <div className="px-4 py-3">
          <div className="text-[12.5px] font-medium text-bench-critical">Erase {v.full_name}&rsquo;s details?</div>
          <p className="mt-1 text-[12px] leading-relaxed text-bench-ink-dim">
            Name, phone, email, LinkedIn, location, notes and CV are removed permanently.
            Only {v.ref_code} remains, so past shortlists stay intact. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onErased();
                void archiveCandidate(v.id, 'do_not_contact');
              }}
              className="rounded-md border border-bench-critical/40 bg-bench-critical/10 px-3 py-1.5 text-[12px] font-medium text-bench-critical hover:bg-bench-critical/20"
            >
              Erase details
            </button>
            <button
              type="button"
              onClick={() => setConfirmErase(false)}
              className="px-2 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="mb-2 text-[11.5px] text-bench-ink-faint">Archive reason</div>
          <div className="flex flex-wrap gap-1.5">
            {(['took_other_job', 'not_interested', 'left_country'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void archive(r)}
                className="rounded border border-bench-line bg-bench-surface-2 px-2 py-1.5 text-[11.5px] text-bench-ink-dim transition-colors hover:border-bench-critical/40 hover:text-bench-critical"
              >
                {ARCHIVE_LABEL[r]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setConfirmErase(true)}
              className="rounded border border-bench-critical/30 px-2 py-1.5 text-[11.5px] text-bench-critical/90 transition-colors hover:bg-bench-critical/10"
            >
              Do not contact
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-[11.5px] text-bench-ink-faint hover:text-bench-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------- empty states --

function NotFound() {
  return (
    <div className="px-5 py-16 text-center">
      <div className="text-[15px] font-medium">Candidate not found</div>
      <p className="mt-1 text-[12.5px] text-bench-ink-dim">
        The record does not exist, or its details were erased at the candidate&rsquo;s request.
      </p>
      <Link href="/portal/candidates" className="mt-4 inline-block text-[12.5px] text-accent hover:text-accent-bright">
        Back to candidates
      </Link>
    </div>
  );
}

function Erased({ refCode }: { refCode: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-bench-critical/10">
        <ShieldAlert size={16} className="text-bench-critical" />
      </div>
      <div className="text-[15px] font-medium">Details erased</div>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-bench-ink-dim">
        {refCode} will not be contacted again. Their personal details are gone, and the
        record no longer appears on any screen, count or export.
      </p>
      <Link href="/portal/candidates" className="mt-4 inline-block text-[12.5px] text-accent hover:text-accent-bright">
        Back to candidates
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- pieces --

function Panel({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex items-center justify-between gap-3 border-b border-bench-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
          {title}
          {count !== undefined && <span className="tabular ml-2 text-bench-ink-dim">{count}</span>}
        </span>
        {hint && <span className="truncate text-[11px] text-bench-ink-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">{children}</dl>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] text-bench-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px]">{value}</dd>
    </div>
  );
}

function TagRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 shrink-0 text-[10.5px] text-bench-ink-faint">{label}</span>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] text-bench-ink-faint">{children}</div>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-5 text-center text-[12px] text-bench-ink-faint">{children}</div>;
}


function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
