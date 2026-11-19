'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';

import { createStaff } from '@/bench/admin';
import { addUser, ROLE_LABEL, ROLES, type Role } from '@/bench/data';
import { FormField, inputCls, Section, Segmented } from '@/bench/components/form-bits';

/**
 * Add a staff account.
 *
 * The API owns the first password: creating the account generates one, and
 * a second call exchanges it for the chosen one. Until that exchange runs
 * the account cannot sign in, so both happen behind this one button, and
 * the result is shown once for the admin to pass on — nothing is emailed.
 * The portal role is set in the same step, so their first sign-in lands
 * with the access the exec chose.
 */

interface Form {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
}

type Errors = Partial<Record<keyof Form | 'form', string>>;

const EMPTY: Form = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  role: 'recruiter',
};

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.firstName.trim()) e.firstName = 'First name is required.';
  if (!f.lastName.trim()) e.lastName = 'Last name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
    e.email = 'Enter a valid email address.';
  }
  if (!f.phone.trim()) e.phone = 'Phone is required.';
  if (f.password.length < 8) e.password = 'At least 8 characters.';
  return e;
}

export default function NewStaffPage() {
  const router = useRouter();
  const uid = useId();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    usable: boolean;
    role: Role;
    roleSet: boolean;
  } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    try {
      const account = await createStaff({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });
      let roleSet = true;
      try {
        await addUser({
          full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: account.email,
          role: form.role,
        });
      } catch (err) {
        console.error(err);
        roleSet = false;
      }
      setCreated({ ...account, role: form.role, roleSet });
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Could not create the account. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="px-5 py-6">
        <h1 className="text-[19px] font-semibold tracking-tight">Account created</h1>
        <p className="mb-5 mt-1 text-[13px] text-bench-ink-dim">
          Send these to the new person. Nothing is emailed, and the password is
          not shown again.
        </p>

        {!created.roleSet && (
          <div className="mb-4 max-w-xl rounded-md border border-bench-warning/40 bg-bench-warning/10 px-4 py-3 text-[12.5px] text-bench-warning">
            The account exists, but their portal role did not save. They will
            start as a recruiter; change it from Staff.
          </div>
        )}

        {!created.usable && (
          <div className="mb-4 max-w-xl rounded-md border border-bench-warning/40 bg-bench-warning/10 px-4 py-3 text-[12.5px] text-bench-warning">
            The account exists, but setting the password you chose did not go
            through. The generated one below is what it has now.
          </div>
        )}

        <div className="max-w-xl rounded-lg border border-bench-line bg-bench-surface p-4">
          <dl className="flex flex-col gap-3 text-[13px]">
            <div className="flex items-center gap-3">
              <dt className="w-36 shrink-0 text-bench-ink-faint">Email</dt>
              <dd className="font-mono text-[12.5px]">{created.email}</dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-36 shrink-0 text-bench-ink-faint">Role</dt>
              <dd>{ROLE_LABEL[created.roleSet ? created.role : 'recruiter']}</dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-36 shrink-0 text-bench-ink-faint">
                {created.usable ? 'Password' : 'First-time password'}
              </dt>
              <dd className="font-mono text-[12.5px]">{created.password}</dd>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.password);
                  setCopied(true);
                }}
                className="flex items-center gap-1 rounded border border-bench-line px-2 py-1 text-[11px] text-bench-ink-dim transition-colors hover:text-bench-ink"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </dl>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/portal/staff')}
            className="h-9 rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setCopied(false);
              setForm(EMPTY);
            }}
            className="h-9 rounded-md border border-bench-line px-4 text-[12.5px] text-bench-ink-dim transition-colors hover:text-bench-ink"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <Link
        href="/portal/staff"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
      >
        <ArrowLeft size={14} /> Staff
      </Link>

      <h1 className="text-[19px] font-semibold tracking-tight">Add person</h1>
      <p className="mb-5 mt-1 text-[13px] text-bench-ink-dim">
        They can sign in straight away, with the role you pick.
      </p>

      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
        <Section title="Who they are">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" htmlFor={`${uid}-first`} error={errors.firstName}>
              <input
                id={`${uid}-first`}
                className={inputCls}
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor={`${uid}-last`} error={errors.lastName}>
              <input
                id={`${uid}-last`}
                className={inputCls}
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor={`${uid}-email`} error={errors.email}>
              <input
                id={`${uid}-email`}
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="name@zareinnovations.com"
              />
            </FormField>
            <FormField label="Phone" htmlFor={`${uid}-phone`} error={errors.phone}>
              <input
                id={`${uid}-phone`}
                className={inputCls}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+251 912 345 678"
              />
            </FormField>
          </div>
        </Section>

        <Section
          title="Role"
          description="An exec manages staff, roles and role settings. A recruiter works the bench."
        >
          <Segmented
            label="Role"
            value={form.role}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            onChange={(v) => set('role', v)}
          />
        </Section>

        <Section
          title="Sign-in"
          description="Set their password and pass it on. They can change it later."
        >
          <FormField label="Password" htmlFor={`${uid}-pw`} error={errors.password}>
            <input
              id={`${uid}-pw`}
              type="password"
              className={inputCls}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="At least 8 characters"
            />
          </FormField>
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
            {saving ? 'Creating…' : 'Create account'}
          </button>
          <Link
            href="/portal/staff"
            className="h-9 rounded-md border border-bench-line px-4 text-[12.5px] leading-9 text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
