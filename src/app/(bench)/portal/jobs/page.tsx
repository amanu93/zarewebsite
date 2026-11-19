'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';

import { deleteJob, isExpired, jobSkills, useApplicants, useJobs, type Job } from '@/bench/admin';
import { useArchetypes, type Archetype } from '@/bench/data';
import { Tag } from '@/bench/components/candidate-bits';
import { cn, formatDate } from '@/bench/utils';

/**
 * Job postings, moved here from /admin.
 *
 * A posting is open or closed by its end date alone — there is no status
 * column — so the tabs derive from the date rather than asking the user to
 * keep one in sync.
 */

type Tab = 'open' | 'closed' | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const inTab = (job: Job, tab: Tab) =>
  tab === 'all' || (tab === 'closed' ? isExpired(job) : !isExpired(job));

export default function JobsPage() {
  const { data: jobs, loading, error, reload } = useJobs();
  const [tab, setTab] = useState<Tab>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const { data: applicants } = useApplicants();
  const applied = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of applicants) n.set(a.jobId, (n.get(a.jobId) ?? 0) + 1);
    return n;
  }, [applicants]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [t.key, jobs.filter((j) => inTab(j, t.key)).length]),
      ) as Record<Tab, number>,
    [jobs],
  );

  const rows = jobs
    .filter((j) => inTab(j, tab))
    .sort((a, b) => (a.endDate < b.endDate ? 1 : -1));

  async function remove(job: Job) {
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    setBusy(job.id);
    try {
      await deleteJob(job.id);
      reload();
    } catch (err) {
      console.error(err);
      alert('Could not delete the job.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            Postings on the careers page, and the applications they attract.
          </p>
        </div>
        <Link
          href="/portal/jobs/new"
          className="flex h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
        >
          <Plus size={14} /> New job
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-md border border-bench-line bg-bench-surface p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-[12.5px] transition-colors',
              tab === t.key
                ? 'bg-bench-surface-3 text-bench-ink'
                : 'text-bench-ink-faint hover:text-bench-ink-dim',
            )}
          >
            {t.label}
            <span className="tabular text-[11px] text-bench-ink-faint">
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-bench-critical/40 bg-bench-critical/10 px-4 py-3 text-[12.5px] text-bench-critical">
          Could not load jobs. Is the API reachable?
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-bench-line bg-bench-surface px-6 py-14 text-center text-[13px] text-bench-ink-dim">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-14 text-center">
          <div className="text-[14px] font-medium">Nothing here</div>
          <p className="mt-1 text-[12.5px] text-bench-ink-dim">
            No jobs in this state.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          {rows.map((job, i) => (
            <JobRow
              key={job.id}
              job={job}
              first={i === 0}
              busy={busy === job.id}
              applicants={applied.get(job.id) ?? 0}
              onDelete={() => remove(job)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRow({
  job,
  first,
  busy,
  applicants,
  onDelete,
}: {
  job: Job;
  first: boolean;
  busy: boolean;
  applicants: number;
  onDelete: () => void;
}) {
  const closed = isExpired(job);
  const skills = jobSkills(job);
  const role = useArchetypes().find((a: Archetype) => a.id === job.archetypeId);

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bench-surface-2',
        !first && 'border-t border-bench-line',
      )}
    >
      <Link href={`/portal/jobs/${job.id}`} className="min-w-0 flex-1 no-underline">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-medium text-bench-ink">
            {job.title}
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider',
              closed
                ? 'bg-bench-surface-3 text-bench-ink-faint'
                : 'bg-bench-healthy/15 text-bench-healthy',
            )}
          >
            {closed ? 'Closed' : 'Open'}
          </span>
          {role && (
            <span className="flex items-center gap-1.5 text-[11px] text-bench-ink-dim">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: role.color }} aria-hidden />
              {role.name}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-bench-ink-faint">
          <span>{job.location}</span>
          <span>·</span>
          <span>{job.type}</span>
          <span>·</span>
          <span>{job.workType}</span>
          <span>·</span>
          <span>{job.yearsOfExperience}+ yrs</span>
          <span>·</span>
          <span>closes {formatDate(job.endDate)}</span>
        </div>
        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.slice(0, 6).map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
        )}
      </Link>

      <Link
        href={`/portal/jobs/${job.id}/applicants`}
        aria-label={`${applicants} applicants for ${job.title}`}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-bench-line px-2.5 py-1.5 text-[12px] text-bench-ink-dim no-underline transition-colors hover:border-accent/40 hover:text-accent"
      >
        <Users size={13} />
        <span className="tabular">{applicants}</span>
        <span className="hidden sm:inline">applicants</span>
      </Link>

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Delete ${job.title}`}
        className="shrink-0 rounded-md border border-bench-line p-2 text-bench-ink-faint transition-colors hover:border-bench-critical/50 hover:text-bench-critical disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
