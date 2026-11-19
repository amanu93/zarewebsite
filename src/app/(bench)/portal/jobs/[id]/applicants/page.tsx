'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, Mail, Phone } from 'lucide-react';

import { moveToBench, useApplicants, useJob, type Applicant } from '@/bench/admin';
import {
  useActiveArchetypes,
  useBenchByApplication,
  type CandidateView,
  type ContactResult,
} from '@/bench/data';
import { ApplicantCv } from '@/bench/components/applicant-cv';
import { LayerBadge } from '@/bench/components/candidate-bits';
import { inputCls } from '@/bench/components/form-bits';
import { plural } from '@/bench/dates';
import { cn, formatDate } from '@/bench/utils';

/**
 * Who applied for a job on the careers page.
 *
 * Moving someone to the bench adds them as a Raw candidate of the job's
 * bench role, to be called and assessed like anyone added by hand. The
 * application itself stays as it is; the bench record remembers it, so this
 * list shows who has already moved and links to them.
 */

type Failure = Extract<ContactResult, { ok: false }>;

export default function ApplicantsPage() {
  const { id } = useParams();
  const jobId = (Array.isArray(id) ? id[0] : id) ?? '';
  const uid = useId();

  const { data: job, loading: jobLoading } = useJob(jobId);
  const { data: all, loading, error } = useApplicants();
  const onBench = useBenchByApplication();
  const roles = useActiveArchetypes();

  // The job's role unless the recruiter picks another. A retired role takes
  // no one new, so a job still naming one starts with nothing chosen.
  const [chosenRole, setChosenRole] = useState<string | null>(null);
  const jobRole = roles.some((a) => a.id === job?.archetypeId) ? (job?.archetypeId ?? '') : '';
  const roleId = chosenRole ?? jobRole;

  const applicants = all
    .filter((a) => a.jobId === jobId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const moved = applicants.filter((a) => onBench.has(a.id)).length;

  if (jobLoading) {
    return <div className="px-5 py-6 text-[13px] text-bench-ink-dim">Loading…</div>;
  }

  return (
    <div className="px-5 py-6">
      <Link
        href="/portal/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
      >
        <ArrowLeft size={14} /> Jobs
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold tracking-tight">{job?.title ?? 'Applicants'}</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            {plural(applicants.length, 'applicant')} from the careers page · {moved} on the bench
          </p>
        </div>
        <Link
          href={`/portal/jobs/${jobId}`}
          className="h-9 rounded-md border border-bench-line px-3 text-[12.5px] leading-9 text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
        >
          Edit job
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-bench-line bg-bench-surface px-4 py-3">
        <label htmlFor={`${uid}-role`} className="text-[12.5px] text-bench-ink-dim">
          Moving to the bench adds them as
        </label>
        <select
          id={`${uid}-role`}
          className={cn(inputCls, 'h-8 w-full sm:w-64')}
          value={roleId}
          onChange={(e) => setChosenRole(e.target.value)}
        >
          <option value="">Choose a bench role</option>
          {roles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {!jobRole && (
          <span className="text-[11.5px] text-bench-ink-faint">
            This job names no bench role. Set one on the job to skip this step.
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-bench-critical/40 bg-bench-critical/10 px-4 py-3 text-[12.5px] text-bench-critical">
          Could not load applicants. Is the API reachable?
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-bench-line bg-bench-surface px-6 py-14 text-center text-[13px] text-bench-ink-dim">
          Loading…
        </div>
      ) : applicants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-14 text-center">
          <div className="text-[14px] font-medium">No applicants yet</div>
          <p className="mt-1 text-[12.5px] text-bench-ink-dim">
            Applications to this job on the careers page appear here.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          {applicants.map((a, i) => (
            <ApplicantRow
              key={a.id}
              a={a}
              first={i === 0}
              benched={onBench.get(a.id) ?? null}
              roleId={roleId}
              jobTitle={job?.title ?? 'a job'}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicantRow({
  a,
  first,
  benched,
  roleId,
  jobTitle,
}: {
  a: Applicant;
  first: boolean;
  benched: CandidateView | null;
  roleId: string;
  jobTitle: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function move() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await moveToBench(a, roleId, jobTitle);
      if (!res.ok) setFailure(res);
    } catch (err) {
      console.error(err);
      setFailure({ ok: false, errors: { form: 'Could not move them to the bench. Try again.' } });
    } finally {
      setBusy(false);
    }
  }

  const messages = failure ? Object.values(failure.errors).filter(Boolean) : [];

  return (
    <li className={cn('px-4 py-3.5', !first && 'border-t border-bench-line')}>
      <div className="flex flex-wrap items-start gap-3">
        {/* basis-64: on a phone the action wraps below rather than squeezing the details */}
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[14px] font-medium text-bench-ink">{a.fullName}</span>
            <span className="text-[11.5px] text-bench-ink-faint">applied {formatDate(a.createdAt)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-bench-ink-dim">
            {a.email && (
              <a href={`mailto:${a.email}`} className="inline-flex min-w-0 items-center gap-1 break-all hover:text-accent">
                <Mail size={12} className="shrink-0" /> {a.email}
              </a>
            )}
            {a.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} /> {a.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <FileText size={12} /> <ApplicantCv applicantId={a.id} />
            </span>
          </div>
          {a.coverLetter?.trim() && (
            <details className="mt-2 text-[12px]">
              <summary className="cursor-pointer text-bench-ink-faint hover:text-bench-ink-dim">Cover letter</summary>
              <p className="mt-1.5 max-w-prose whitespace-pre-line text-bench-ink-dim">{a.coverLetter}</p>
            </details>
          )}
        </div>

        <div className="shrink-0">
          {benched ? (
            <Link
              href={`/portal/candidates/${benched.id}`}
              className="flex h-8 items-center gap-2 rounded-md border border-bench-line px-3 text-[12px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
            >
              <span className="tabular">{benched.ref_code}</span>
              <LayerBadge layer={benched.layer} />
              <ArrowRight size={12} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={move}
              disabled={busy || !roleId}
              title={roleId ? undefined : 'Choose a bench role first'}
              className="h-8 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {busy ? 'Moving…' : 'Move to bench'}
            </button>
          )}
        </div>
      </div>

      {messages.length > 0 && (
        <p role="alert" className="mt-2 text-[12px] text-bench-critical">
          {messages.join(' ')}
          {failure?.duplicate && (
            <>
              {' '}
              <Link href={`/portal/candidates/${failure.duplicate.id}`} className="underline hover:text-bench-ink">
                Open {failure.duplicate.ref_code}
              </Link>
            </>
          )}
        </p>
      )}
    </li>
  );
}
