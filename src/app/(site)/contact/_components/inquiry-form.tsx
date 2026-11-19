'use client';

import { useActionState } from 'react';

import { submitInquiry, type InquiryState } from '../actions';
import { pathways } from '@/content/contact';
import { RESPONSE_PROMISE } from '@/content/contact';
import type { Pathway } from '@/lib/inquiry-schema';
import { Heading } from '@/components/typography/heading';
import { MonoLabel } from '@/components/typography/mono-label';
import { TextField, TextAreaField, SelectField, Honeypot } from './field';

const initial: InquiryState = { status: 'idle' };

const BUDGET = [
  { value: 'under-50k', label: 'Under $50,000' },
  { value: '50k-200k', label: '$50,000 to $200,000' },
  { value: '200k-plus', label: '$200,000+' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;

const TIMELINE = [
  { value: 'now', label: 'Ready now' },
  { value: '1-3-months', label: '1 to 3 months' },
  { value: '3-plus-months', label: '3+ months' },
  { value: 'exploring', label: 'Exploring options' },
] as const;

const TEAM_TYPE = [
  { value: 'technology-talent', label: 'Technology Talent — engineers and product teams' },
  { value: 'business-operations', label: 'Business Operations — support and back office' },
] as const;

const START = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '1-month', label: 'Within a month' },
  { value: '1-3-months', label: '1 to 3 months' },
  { value: 'planning', label: 'Planning ahead' },
] as const;

/**
 * The inquiry form.
 *
 * The only client component on this page, and it is a progressive enhancement
 * rather than a requirement: the `<form action>` posts to the Server Action
 * natively, so the form submits and validates with JavaScript disabled. What
 * the client adds is inline errors, a pending state, and an in-place success
 * message instead of a full navigation.
 *
 * Success is a state transition, not a toast. A confirmation that disappears
 * after four seconds is a confirmation the visitor may never see.
 */
export function InquiryForm({
  pathway,
  defaultTeamType,
}: {
  pathway: Pathway;
  defaultTeamType?: string;
}) {
  const [state, formAction, pending] = useActionState(submitInquiry, initial);
  const copy = pathways[pathway];
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="border border-accent p-9"
        data-testid="inquiry-success"
      >
        <MonoLabel className="text-[var(--accent-text)]">Received</MonoLabel>
        <Heading level={3} size="display-3" className="mt-4">
          Thank you. We have it.
        </Heading>
        <p className="mt-4 max-w-[36em] text-body">
          {RESPONSE_PROMISE} If it is urgent, reply to the confirmation and it
          will reach the same inbox.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="relative flex flex-col gap-7">
      <input type="hidden" name="pathway" value={pathway} />
      <Honeypot />

      <div className="grid gap-7 sm:grid-cols-2">
        <TextField name="name" label="Your name" required defaultValue={v.name} error={e.name} />
        <TextField name="company" label="Company" required defaultValue={v.company} error={e.company} />
      </div>

      <TextField
        name="email"
        type="email"
        label="Work email"
        required
        defaultValue={v.email}
        error={e.email}
      />

      {pathway === 'project' ? (
        <>
          <TextAreaField
            name="building"
            label="What are you building?"
            rows={5}
            required
            defaultValue={v.building}
            error={e.building}
            hint="The problem, the users, and where you are today. A short paragraph is plenty."
          />
          <div className="grid gap-7 sm:grid-cols-2">
            <SelectField
              name="budget"
              label="Budget range"
              options={BUDGET}
              required
              defaultValue={v.budget}
              error={e.budget}
            />
            <SelectField
              name="timeline"
              label="Timeline"
              options={TIMELINE}
              required
              defaultValue={v.timeline}
              error={e.timeline}
            />
          </div>
        </>
      ) : (
        <>
          <SelectField
            name="teamType"
            label="Which team"
            options={TEAM_TYPE}
            required
            defaultValue={v.teamType ?? defaultTeamType}
            error={e.teamType}
          />
          <TextAreaField
            name="roles"
            label="Which roles, and how many?"
            rows={4}
            required
            defaultValue={v.roles}
            error={e.roles}
            hint="For example: two senior backend engineers and one QA, working in our Node and Postgres stack."
          />
          <SelectField
            name="startWindow"
            label="When would they start?"
            options={START}
            required
            defaultValue={v.startWindow}
            error={e.startWindow}
          />
        </>
      )}

      {state.status === 'error' && state.message ? (
        <p role="alert" className="border-l-2 border-accent-ink pl-4 text-body-sm text-accent-ink">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-5 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center rounded-md bg-accent px-7 text-[14.5px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-60"
        >
          {pending ? 'Sending…' : copy.submit}
        </button>
        <MonoLabel muted size="caption">
          {RESPONSE_PROMISE}
        </MonoLabel>
      </div>
    </form>
  );
}
