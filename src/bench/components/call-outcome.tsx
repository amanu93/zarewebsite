'use client';

import { useId, useRef, useState } from 'react';
import { Phone, PhoneMissed, PhoneOff } from 'lucide-react';

import {
  CALL_NOTE_MAX,
  defaultRecallDate,
  IMMEDIATE,
  logCall,
  NO_ANSWER_COOLDOWN_HOURS,
  NOTICE_OPTIONS,
  SHIFT_OPTIONS,
  validateCallDetails,
  type CallAttempt,
  type CallErrors,
} from '@/bench/data';
import { useCallToast } from '@/bench/components/call-toast';
import { addDays, formatDate, todayKey } from '@/bench/dates';
import { cn } from '@/bench/utils';

/**
 * The three call outcomes, used everywhere a call can be logged: the queue,
 * the candidate record and "Call now" on requests and shortlists.
 *
 *   Available      opens a confirm step. Notice period and earliest start are
 *                  asked, never assumed; shifts start from what we last knew.
 *   Not available  asks when to call again, suggesting today + 30 days.
 *   No answer      logs at once. The candidate stays in the queue and comes
 *                  back as Retry after the cooldown.
 *
 * Every logged outcome shows the undo toast.
 */

export interface CallTarget {
  id: string;
  full_name: string | null;
  shift_flexibility: string[];
  setup_verified: boolean;
}

const OUTCOME_TOAST: Record<CallAttempt, string> = {
  available: 'Logged available.',
  not_available: 'Logged not available.',
  no_answer: `Logged no answer. Retry in ${NO_ANSWER_COOLDOWN_HOURS / 24} days.`,
};

export function CallOutcomeControls({
  candidate,
  size = 'md',
  labels = 'responsive',
  onLogged,
  onWillLog,
  onLogFailed,
  onOpenChange,
  className,
}: {
  candidate: CallTarget;
  size?: 'sm' | 'md';
  labels?: 'always' | 'responsive';
  onLogged?: (outcome: CallAttempt, callId: string) => void;
  /**
   * Called just before the write, so a list can hold the row in place first.
   * The write removes the candidate from live data; holding afterwards would
   * unmount the row for a frame. onLogFailed undoes the hold.
   */
  onWillLog?: (outcome: CallAttempt) => void;
  onLogFailed?: () => void;
  /** Tells the parent when a confirm step opens, so it can make room. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [step, setStep] = useState<'available' | 'not_available' | null>(null);
  const [errors, setErrors] = useState<CallErrors>({});
  const [busy, setBusy] = useState(false);
  const toast = useCallToast();
  // The button that opened a confirm step gets focus back when it closes.
  const lastTrigger = useRef<'available' | 'not_available' | null>(null);
  const availableBtn = useRef<HTMLButtonElement>(null);
  const notAvailableBtn = useRef<HTMLButtonElement>(null);

  function open(next: typeof step) {
    setErrors({});
    if (next) lastTrigger.current = next;
    setStep(next);
    onOpenChange?.(next !== null);
    if (next === null) {
      window.setTimeout(() => (lastTrigger.current === 'not_available' ? notAvailableBtn : availableBtn).current?.focus(), 0);
    }
  }

  async function submit(outcome: CallAttempt, details: Parameters<typeof logCall>[2] = {}) {
    if (busy) return;
    // Check the form first, so a list only holds the row for a call that will be logged.
    const invalid = validateCallDetails(outcome, details, new Date());
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      return;
    }
    setBusy(true);
    onWillLog?.(outcome);
    const res = await logCall(candidate.id, outcome, details);
    setBusy(false);
    if (!res.ok) {
      onLogFailed?.();
      setErrors(res.errors);
      return;
    }
    const text = OUTCOME_TOAST[outcome];
    toast({ callId: res.callId, message: candidate.full_name ? `${candidate.full_name}: ${text}` : text });
    setStep(null);
    onOpenChange?.(false);
    onLogged?.(outcome, res.callId);
  }

  if (step === 'available') {
    return (
      <AvailableForm
        candidate={candidate}
        errors={errors}
        busy={busy}
        onCancel={() => open(null)}
        onSubmit={(d) => void submit('available', d)}
        className={className}
      />
    );
  }
  if (step === 'not_available') {
    return (
      <NotAvailableForm
        errors={errors}
        busy={busy}
        onCancel={() => open(null)}
        onSubmit={(d) => void submit('not_available', d)}
        className={className}
      />
    );
  }

  const h = size === 'sm' ? 'h-7 text-[11.5px]' : 'h-8 text-[12px]';
  // Buttons repeat on every row, so each names its candidate.
  const who = (label: string) => (candidate.full_name ? `${label}: ${candidate.full_name}` : label);
  const label = (t: string) => (
    <span className={cn(labels === 'responsive' && 'sr-only sm:not-sr-only')}>{t}</span>
  );
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button ref={availableBtn} type="button" onClick={() => open('available')} className={cn(BTN, h, TONE.healthy)} aria-label={who('Available')}>
        <Phone size={13} strokeWidth={2.2} aria-hidden />
        {label('Available')}
      </button>
      <button ref={notAvailableBtn} type="button" onClick={() => open('not_available')} className={cn(BTN, h, TONE.warning)} aria-label={who('Not available')}>
        <PhoneOff size={13} strokeWidth={2.2} aria-hidden />
        {label('Not available')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit('no_answer')}
        className={cn(BTN, h, TONE.dim)}
        aria-label={who('No answer')}
      >
        <PhoneMissed size={13} strokeWidth={2.2} aria-hidden />
        {label('No answer')}
      </button>
      {errors.form && (
        <span role="alert" className="text-[11.5px] text-bench-critical">
          {errors.form}
        </span>
      )}
    </div>
  );
}

const BTN =
  'flex items-center gap-1.5 rounded-md border px-2.5 font-medium transition-colors disabled:opacity-50';
const TONE = {
  healthy: 'border-bench-healthy/30 bg-bench-healthy/10 text-bench-healthy hover:bg-bench-healthy/20',
  warning: 'border-bench-warning/30 bg-bench-warning/10 text-bench-warning hover:bg-bench-warning/20',
  dim: 'border-bench-line bg-bench-surface-2 text-bench-ink-dim hover:bg-bench-surface-3',
};

const INPUT =
  'h-8 w-full rounded-md border border-bench-line bg-bench-surface px-2.5 text-[12.5px] text-bench-ink focus:border-accent focus:outline-none aria-[invalid=true]:border-bench-critical';

function AvailableForm({
  candidate,
  errors,
  busy,
  onCancel,
  onSubmit,
  className,
}: {
  candidate: CallTarget;
  errors: CallErrors;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (d: {
    notice_period: string;
    earliest_start_date: string | null;
    shift_flexibility: string[];
    setup_verified: boolean;
    note: string;
  }) => void;
  className?: string;
}) {
  const id = useId();
  const [notice, setNotice] = useState('');
  const [start, setStart] = useState('');
  const [shifts, setShifts] = useState<string[]>(candidate.shift_flexibility);
  const [setup, setSetup] = useState(candidate.setup_verified);
  const [note, setNote] = useState('');
  const immediate = notice === IMMEDIATE;

  return (
    <form
      noValidate
      aria-label="Confirm availability"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          notice_period: notice,
          earliest_start_date: immediate ? null : start || null,
          shift_flexibility: shifts,
          setup_verified: setup,
          note,
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn('fade-up w-full rounded-md border border-bench-healthy/25 bg-bench-healthy/[0.04] p-3', className)}
    >
      <div className="mb-2.5 text-[12px] font-medium text-bench-healthy">Confirm availability</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldWrap label="Notice period" htmlFor={`${id}-notice`} error={errors.notice_period}>
          <select
            id={`${id}-notice`}
            autoFocus
            required
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            aria-invalid={!!errors.notice_period}
            aria-describedby={errors.notice_period ? `${id}-notice-error` : undefined}
            className={INPUT}
          >
            <option value="" disabled>
              Ask them
            </option>
            {NOTICE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FieldWrap>
        <FieldWrap
          label="Earliest start"
          htmlFor={`${id}-start`}
          error={errors.earliest_start_date}
          hint={immediate ? 'Not needed: can start immediately.' : undefined}
        >
          <input
            id={`${id}-start`}
            type="date"
            required={!immediate}
            disabled={immediate}
            min={todayKey()}
            value={immediate ? '' : start}
            onChange={(e) => setStart(e.target.value)}
            aria-invalid={!!errors.earliest_start_date}
            aria-describedby={errors.earliest_start_date ? `${id}-start-error` : `${id}-start-hint`}
            className={cn(INPUT, 'disabled:opacity-50')}
          />
        </FieldWrap>
      </div>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[11px] text-bench-ink-faint">Shifts they can work</legend>
        <div className="flex flex-wrap gap-1.5">
          {SHIFT_OPTIONS.map((s) => {
            const on = shifts.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setShifts((xs) => (on ? xs.filter((x) => x !== s) : [...xs, s]))}
                className={cn(
                  'h-7 rounded-md border px-2.5 text-[11.5px] transition-colors',
                  on
                    ? 'border-accent/50 bg-accent/15 text-bench-ink'
                    : 'border-bench-line bg-bench-surface text-bench-ink-faint hover:text-bench-ink-dim',
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
        {errors.shift_flexibility && <ErrorText>{errors.shift_flexibility}</ErrorText>}
      </fieldset>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11.5px] text-bench-ink-dim">
        <input
          type="checkbox"
          checked={setup}
          onChange={(e) => setSetup(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
        />
        Work setup verified: power backup, connection and a quiet space
      </label>
      <NoteAndActions id={id} note={note} setNote={setNote} errors={errors} busy={busy} onCancel={onCancel} confirm="Log available" />
    </form>
  );
}

function NotAvailableForm({
  errors,
  busy,
  onCancel,
  onSubmit,
  className,
}: {
  errors: CallErrors;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (d: { recall_at: string; note: string }) => void;
  className?: string;
}) {
  const id = useId();
  const [recall, setRecall] = useState(() => defaultRecallDate(new Date()));
  const [note, setNote] = useState('');
  const today = todayKey();

  return (
    <form
      noValidate
     
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ recall_at: recall, note });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn('fade-up w-full rounded-md border border-bench-warning/25 bg-bench-warning/[0.04] p-3', className)}
    >
      <div className="mb-2.5 text-[12px] font-medium text-bench-warning">Not available</div>
      <FieldWrap
        label="Call again on"
        htmlFor={`${id}-recall`}
        error={errors.recall_at}
        hint={recall ? `Out of the queue and the counts until ${formatDate(recall)}.` : undefined}
      >
        <input
          id={`${id}-recall`}
          type="date"
          autoFocus
          required
          min={addDays(today, 1)}
          max={addDays(today, 365)}
          value={recall}
          onChange={(e) => setRecall(e.target.value)}
          aria-invalid={!!errors.recall_at}
          aria-describedby={`${id}-recall-${errors.recall_at ? 'error' : 'hint'}`}
          className={cn(INPUT, 'sm:max-w-[220px]')}
        />
      </FieldWrap>
      <NoteAndActions id={id} note={note} setNote={setNote} errors={errors} busy={busy} onCancel={onCancel} confirm="Log not available" />
    </form>
  );
}

function NoteAndActions({
  id,
  note,
  setNote,
  errors,
  busy,
  onCancel,
  confirm,
}: {
  id: string;
  note: string;
  setNote: (v: string) => void;
  errors: CallErrors;
  busy: boolean;
  onCancel: () => void;
  confirm: string;
}) {
  return (
    <>
      <div className="mt-3">
        <FieldWrap label="Note (optional)" htmlFor={`${id}-note`} error={errors.note}>
          <input
            id={`${id}-note`}
            value={note}
            maxLength={CALL_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={!!errors.note}
            aria-describedby={errors.note ? `${id}-note-error` : undefined}
            className={INPUT}
          />
        </FieldWrap>
      </div>
      {errors.form && <ErrorText>{errors.form}</ErrorText>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 px-2.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-8 rounded-md bg-accent px-3 text-[12px] font-semibold text-accent-contrast hover:bg-accent-bright disabled:opacity-50"
        >
          {confirm}
        </button>
      </div>
    </>
  );
}

function FieldWrap({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[11px] text-bench-ink-faint">
        {label}
      </label>
      {children}
      {error ? (
        <ErrorText id={`${htmlFor}-error`}>{error}</ErrorText>
      ) : hint ? (
        <div id={`${htmlFor}-hint`} className="mt-1 text-[11px] text-bench-ink-faint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function ErrorText({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} role="alert" className="mt-1 text-[11px] text-bench-critical">
      {children}
    </div>
  );
}
