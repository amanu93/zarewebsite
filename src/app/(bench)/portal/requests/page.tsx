'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import {
  createRequest,
  OUTCOME_LABEL,
  REQUEST_QUANTITY_MAX,
  REQUEST_TITLE_MAX,
  useActiveArchetypes,
  useBenchTags,
  useRequestSummaries,
  type RequestErrors,
  type RequestStatus,
  type RequestSummary,
} from '@/bench/data';
import { todayKey } from '@/bench/dates';
import { TagInput } from '@/bench/components/form-bits';
import { RequirementChips, RequestStatusPill, ShiftToggles } from '@/bench/components/request-bits';
import { cn, daysUntil, formatDate } from '@/bench/utils';

/**
 * Client requests. Each row answers the question an account manager is
 * really asking: can the bench cover this, today, and if not how far off is
 * it? Match counts are live — they move the moment a call is logged.
 */

type Tab = 'active' | 'submitted' | 'closed' | 'all';

const TABS: { key: Tab; label: string; statuses: RequestStatus[] }[] = [
  { key: 'active', label: 'Active', statuses: ['open', 'shortlisting'] },
  { key: 'submitted', label: 'Submitted', statuses: ['submitted'] },
  { key: 'closed', label: 'Closed', statuses: ['closed'] },
  { key: 'all', label: 'All', statuses: ['open', 'shortlisting', 'submitted', 'closed'] },
];

export default function RequestsPage() {
  const all = useRequestSummaries();
  const [tab, setTab] = useState<Tab>('active');
  const [creating, setCreating] = useState(false);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, all.filter((r) => t.statuses.includes(r.status)).length])),
    [all],
  );
  const rows = all.filter((r) => TABS.find((t) => t.key === tab)!.statuses.includes(r.status));

  return (
    <div className="px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Requests</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            What clients have asked for, and whether the bench can answer today.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <Plus size={14} /> New request
          </button>
        )}
      </div>

      {creating && <CreateRequest onCancel={() => setCreating(false)} />}

      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-md border border-bench-line bg-bench-surface p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-[12.5px] transition-colors',
              tab === t.key ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-faint hover:text-bench-ink-dim',
            )}
          >
            {t.label}
            <span className="tabular text-[11px] text-bench-ink-faint">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-14 text-center">
          <div className="text-[14px] font-medium">Nothing here</div>
          <p className="mt-1 text-[12.5px] text-bench-ink-dim">No requests in this state.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          {rows.map((r, i) => (
            <RequestRow key={r.id} r={r} first={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ r, first }: { r: RequestSummary; first: boolean }) {
  const left = daysUntil(r.required_by);
  const closed = r.status === 'closed' || r.status === 'submitted';
  const coverage = coverageOf(r);

  return (
    <li className={cn(!first && 'border-t border-bench-line')}>
      <Link
        href={`/portal/requests/${r.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 px-4 py-3.5 transition-colors hover:bg-bench-surface-2 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))_minmax(0,1fr)]"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-medium">{r.client_name}</span>
            {r.title && <span className="truncate text-[13px] text-bench-ink-dim">{r.title}</span>}
            <RequestStatusPill status={r.status} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-bench-ink-faint">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.archetype_color }} />
            <span className="font-mono uppercase tracking-wider">{r.archetype_code}</span>
            <span>·</span>
            <span>{r.archetype_name}</span>
          </div>
          {(r.required_skills.length > 0 || r.required_shifts.length > 0) && (
            <RequirementChips skills={r.required_skills} shifts={r.required_shifts} className="mt-1.5" />
          )}
        </div>

        <Metric
          value={r.quantity}
          label="needed"
          className="text-right md:text-left"
        />
        <Metric
          value={r.matches}
          label="ready now"
          tone={closed ? 'dim' : coverage}
          className="hidden md:block"
        />
        <Metric
          value={r.one_call_away}
          label="one call away"
          tone={closed ? 'dim' : 'accent'}
          className="hidden md:block"
        />

        <div className="col-span-2 flex items-center justify-between gap-4 md:col-span-1 md:block md:text-right">
          <div className="flex gap-4 md:hidden">
            <Metric value={r.matches} label="ready" tone={closed ? 'dim' : coverage} />
            <Metric value={r.one_call_away} label="one call away" tone={closed ? 'dim' : 'accent'} />
          </div>
          <div>
            {r.status === 'closed' ? (
              <div className="text-[12px] text-bench-ink-faint">
                {r.outcome ? OUTCOME_LABEL[r.outcome] : 'Closed'}
                {r.closed_at && ` · ${formatDate(r.closed_at)}`}
              </div>
            ) : r.shortlist?.status === 'exported' ? (
              <div className="text-[12px] text-bench-ink-dim">
                {r.shortlist.count} sent · {formatDate(r.shortlist.exported_at)}
              </div>
            ) : left !== null ? (
              <div className={cn('tabular text-[12.5px]', left <= 7 ? 'text-bench-critical' : 'text-bench-ink-dim')}>
                {left < 0 ? `${Math.abs(left)}d overdue` : `${left}d to deadline`}
              </div>
            ) : (
              <div className="text-[12px] text-bench-ink-faint">No deadline</div>
            )}
            {r.shortlist?.status === 'draft' && (
              <div className="mt-0.5 text-[11px] text-bench-ink-faint">
                Draft · {r.shortlist.count} of {r.quantity}
              </div>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function coverageOf(r: RequestSummary): 'healthy' | 'warning' | 'critical' {
  if (r.matches >= r.quantity) return 'healthy';
  if (r.matches + r.one_call_away >= r.quantity) return 'warning';
  return 'critical';
}

function Metric({
  value,
  label,
  tone = 'default',
  className,
}: {
  value: number;
  label: string;
  tone?: 'default' | 'healthy' | 'warning' | 'critical' | 'accent' | 'dim';
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className={cn(
          'tabular text-[15px] font-semibold leading-none',
          tone === 'healthy' && 'text-bench-healthy',
          tone === 'warning' && 'text-bench-warning',
          tone === 'critical' && 'text-bench-critical',
          tone === 'accent' && 'text-accent',
          tone === 'dim' && 'text-bench-ink-faint',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[10.5px] text-bench-ink-faint">{label}</div>
    </div>
  );
}

// ------------------------------------------------------------------ create --

function CreateRequest({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const archetypes = useActiveArchetypes();
  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [archetypeId, setArchetypeId] = useState(archetypes[0]?.id ?? '');
  const [quantity, setQuantity] = useState(3);
  const [requiredBy, setRequiredBy] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const tags = useBenchTags(archetypeId);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [saving, setSaving] = useState(false);

  // The data layer validates; the form only shows what it says.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = await createRequest({
      client_name: client,
      title,
      archetype_id: archetypeId,
      quantity,
      required_by: requiredBy || null,
      required_skills: skills,
      required_shifts: shifts,
      notes,
    });
    if (!res.ok) {
      setSaving(false);
      return setErrors(res.errors);
    }
    router.push(`/portal/requests/${res.id}`);
  }

  return (
    <form
      onSubmit={submit}
      className="fade-up mb-5 rounded-lg border border-bench-line-bright bg-bench-surface p-4"
      noValidate
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">New request</div>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-bench-ink-faint hover:bg-bench-surface-2 hover:text-bench-ink"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Client" error={errors.client_name} className="lg:col-span-2">
          <input
            autoFocus
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. BETA Technologies"
            className={inputCls}
          />
        </FormField>
        <FormField
          label="Position title (optional)"
          error={errors.title}
          className="lg:col-span-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={REQUEST_TITLE_MAX}
            placeholder="e.g. Senior Full Stack, React + Node"
            className={inputCls}
          />
        </FormField>
        <FormField label="Role">
          <select value={archetypeId} onChange={(e) => setArchetypeId(e.target.value)} className={inputCls}>
            {archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity" error={errors.quantity}>
            <input
              type="number"
              min={1}
              max={REQUEST_QUANTITY_MAX}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={cn(inputCls, 'tabular')}
            />
          </FormField>
          <FormField label="Required by" error={errors.required_by}>
            <input
              type="date"
              min={todayKey()}
              value={requiredBy}
              onChange={(e) => setRequiredBy(e.target.value)}
              className={cn(inputCls, '[color-scheme:dark]')}
            />
          </FormField>
        </div>
        <FormField label="Required skills or tools" className="sm:col-span-2">
          <TagInput
            value={skills}
            onChange={setSkills}
            suggestions={[...tags.stack, ...tags.skills]}
            placeholder="e.g. React, Zendesk"
            label="Required skills or tools"
          />
        </FormField>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[11.5px] text-bench-ink-dim">Required shifts</span>
          <ShiftToggles value={shifts} onChange={setShifts} />
        </div>
        <p className="-mt-2 text-[11.5px] text-bench-ink-faint sm:col-span-2 lg:col-span-4">
          Only candidates with every listed skill and shift count toward Ready now. Leave empty for any.
        </p>
        <FormField label="Notes" error={errors.notes} className="sm:col-span-2 lg:col-span-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Hours, tools, anything the shortlist should reflect"
            className={cn(inputCls, 'h-auto resize-y py-2')}
          />
        </FormField>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-[12.5px] text-bench-ink-faint hover:text-bench-ink">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-50"
        >
          Create request
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'h-9 w-full rounded-md border border-bench-line bg-bench-surface-2 px-3 text-[13px] placeholder:text-bench-ink-faint focus:border-accent/50 focus:outline-none';

function FormField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[11.5px] text-bench-ink-dim">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-bench-critical">{error}</span>}
    </label>
  );
}
