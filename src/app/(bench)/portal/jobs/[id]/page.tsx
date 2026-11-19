'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';

import {
  createJob,
  JOB_TYPES,
  jobSkills,
  updateJob,
  useJob,
  WORK_TYPES,
  type JobType,
  type WorkType,
} from '@/bench/admin';
import { useActiveArchetypes, useArchetypes } from '@/bench/data';
import { FormField, inputCls, Section, Segmented, TagInput } from '@/bench/components/form-bits';
import { cn } from '@/bench/utils';

/**
 * Create or edit a job posting. Same fields the admin form had, in the
 * portal's own controls — including its tag input for skills, which the API
 * stores as a comma-separated string.
 */

const DAY = 24 * 60 * 60 * 1000;
const dateInput = (v: string | number | Date) =>
  new Date(v).toISOString().slice(0, 10);

interface Form {
  title: string;
  yearsOfExperience: string;
  location: string;
  type: JobType;
  workType: WorkType;
  skills: string[];
  startDate: string;
  endDate: string;
  description: string;
  aboutJob: string;
  aboutCompany: string;
  archetypeId: string;
}

type Errors = Partial<Record<keyof Form | 'form', string>>;

const EMPTY: Form = {
  title: '',
  yearsOfExperience: '2',
  location: '',
  type: 'Remote',
  workType: 'Full-Time',
  skills: [],
  startDate: dateInput(Date.now()),
  endDate: dateInput(Date.now() + 30 * DAY),
  description: '',
  aboutJob: '',
  aboutCompany: '',
  archetypeId: '',
};

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.title.trim().length < 2) e.title = 'Give the role a title.';
  const yrs = Number(f.yearsOfExperience);
  if (!Number.isInteger(yrs) || yrs < 0 || yrs > 50) {
    e.yearsOfExperience = 'Whole years, 0 to 50.';
  }
  if (f.location.trim().length < 2) e.location = 'Where is this role based?';
  if (f.skills.length === 0) e.skills = 'Add at least one skill.';
  if (f.description.trim().length < 10) e.description = 'Describe the role.';
  if (!f.startDate) e.startDate = 'Pick a start date.';
  if (!f.endDate) e.endDate = 'Pick a closing date.';
  if (f.startDate && f.endDate && new Date(f.endDate) <= new Date(f.startDate)) {
    e.endDate = 'Closing date must be after the start date.';
  }
  return e;
}

export default function JobFormPage() {
  const { id } = useParams();
  const jobId = Array.isArray(id) ? id[0] : id;
  const isEdit = Boolean(jobId && jobId !== 'new');
  const router = useRouter();
  const uid = useId();

  const { data: job, loading } = useJob(isEdit ? jobId! : null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  // Retired roles are not offered, except the one this job already has.
  const allRoles = useArchetypes();
  const activeRoles = useActiveArchetypes();
  const roleOptions = allRoles.filter((a) => !a.retired_at || a.id === form.archetypeId);

  useEffect(() => {
    if (!job) return;
    setForm({
      title: job.title ?? '',
      yearsOfExperience: String(job.yearsOfExperience ?? 0),
      location: job.location ?? '',
      type: job.type ?? 'Remote',
      workType: job.workType ?? 'Full-Time',
      skills: jobSkills(job),
      startDate: dateInput(job.startDate),
      endDate: dateInput(job.endDate),
      description: job.description ?? '',
      aboutJob: job.aboutJob ?? '',
      aboutCompany: job.aboutCompany ?? '',
      archetypeId: job.archetypeId ?? '',
    });
  }, [job]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      yearsOfExperience: Number(form.yearsOfExperience),
      location: form.location.trim(),
      type: form.type,
      workType: form.workType,
      skills: form.skills.join(','),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      description: form.description.trim(),
      aboutJob: form.aboutJob.trim() || undefined,
      aboutCompany: form.aboutCompany.trim() || undefined,
      archetypeId: form.archetypeId || null,
    };

    try {
      if (isEdit) await updateJob(jobId!, payload);
      else await createJob(payload);
      router.push('/portal/jobs');
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Could not save the job. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loading) {
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
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {isEdit ? 'Edit job' : 'New job'}
          </h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            This is what candidates see on the careers page.
          </p>
        </div>
        {isEdit && (
          <Link
            href={`/portal/jobs/${jobId}/applicants`}
            className="flex h-9 items-center gap-1.5 rounded-md border border-bench-line px-3 text-[12.5px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
          >
            <Users size={14} /> Applicants
          </Link>
        )}
      </div>

      <form onSubmit={submit} className="flex max-w-3xl flex-col gap-4">
        <Section title="The role">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Title" htmlFor={`${uid}-title`} error={errors.title}>
              <input
                id={`${uid}-title`}
                className={inputCls}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Full-Stack AI Engineer"
              />
            </FormField>

            <FormField label="Location" htmlFor={`${uid}-loc`} error={errors.location}>
              <input
                id={`${uid}-loc`}
                className={inputCls}
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Addis Ababa"
              />
            </FormField>

            <FormField
              label="Years of experience"
              htmlFor={`${uid}-yrs`}
              error={errors.yearsOfExperience}
            >
              <input
                id={`${uid}-yrs`}
                type="number"
                min={0}
                max={50}
                className={inputCls}
                value={form.yearsOfExperience}
                onChange={(e) => set('yearsOfExperience', e.target.value)}
              />
            </FormField>

            <FormField label="Arrangement">
              <Segmented
                label="Arrangement"
                value={form.type}
                options={JOB_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => set('type', v)}
              />
            </FormField>

            <FormField
              label="Bench role"
              htmlFor={`${uid}-role`}
              hint={activeRoles.length ? 'Applicants moved to the bench join this role' : undefined}
              className="sm:col-span-2"
            >
              <select
                id={`${uid}-role`}
                className={inputCls}
                value={form.archetypeId}
                onChange={(e) => set('archetypeId', e.target.value)}
              >
                <option value="">No bench role</option>
                {roleOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.retired_at ? ' (retired)' : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Contract" className="sm:col-span-2">
              <Segmented
                label="Contract"
                value={form.workType}
                options={WORK_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => set('workType', v)}
              />
            </FormField>

            <FormField
              label="Skills"
              hint={`${form.skills.length}/10`}
              error={errors.skills}
              className="sm:col-span-2"
            >
              <TagInput
                label="Skills"
                value={form.skills}
                onChange={(v) => set('skills', v)}
                suggestions={[]}
                max={10}
                placeholder="React, Node.js…"
              />
            </FormField>
          </div>
        </Section>

        <Section title="Dates" description="The posting closes itself on the closing date.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Opens" htmlFor={`${uid}-start`} error={errors.startDate}>
              <input
                id={`${uid}-start`}
                type="date"
                className={inputCls}
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </FormField>
            <FormField label="Closes" htmlFor={`${uid}-end`} error={errors.endDate}>
              <input
                id={`${uid}-end`}
                type="date"
                className={inputCls}
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </FormField>
          </div>
        </Section>

        <Section
          title="Description"
          description="HTML is allowed; the careers page renders it."
        >
          <div className="flex flex-col gap-4">
            <FormField
              label="Job description"
              htmlFor={`${uid}-desc`}
              error={errors.description}
            >
              <textarea
                id={`${uid}-desc`}
                rows={8}
                className={cn(inputCls, 'h-auto py-2 leading-relaxed')}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Responsibilities, requirements, what the team is like…"
              />
            </FormField>
            <FormField label="About the job" htmlFor={`${uid}-aboutjob`} hint="optional">
              <textarea
                id={`${uid}-aboutjob`}
                rows={4}
                className={cn(inputCls, 'h-auto py-2 leading-relaxed')}
                value={form.aboutJob}
                onChange={(e) => set('aboutJob', e.target.value)}
              />
            </FormField>
            <FormField
              label="About the company"
              htmlFor={`${uid}-aboutco`}
              hint="optional"
            >
              <textarea
                id={`${uid}-aboutco`}
                rows={4}
                className={cn(inputCls, 'h-auto py-2 leading-relaxed')}
                value={form.aboutCompany}
                onChange={(e) => set('aboutCompany', e.target.value)}
              />
            </FormField>
          </div>
        </Section>

        {errors.form && (
          <p role="alert" className="text-[12.5px] text-bench-critical">
            {errors.form}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
          </button>
          <Link
            href="/portal/jobs"
            className="h-9 rounded-md border border-bench-line px-4 text-[12.5px] leading-9 text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
