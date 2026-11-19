'use client';

import { cloneElement, isValidElement, useId, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

import { normalizeTag } from '@/bench/data';
import { cn } from '@/bench/utils';

/**
 * Form controls shared by the add and assess screens. Dense, keyboard
 * friendly, and every one of them shows its error in the same place.
 */

export const inputCls =
  'h-9 w-full rounded-md border border-bench-line bg-bench-surface-2 px-3 text-[13px] placeholder:text-bench-ink-faint focus:border-accent/50 focus:outline-none aria-[invalid=true]:border-bench-critical/60';

export function FormField({
  label,
  hint,
  error,
  className,
  htmlFor,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[11.5px] text-bench-ink-dim">
          {label}
        </label>
        {hint && <span className="text-[10.5px] text-bench-ink-faint">{hint}</span>}
      </div>
      {htmlFor && error && isValidElement<{ 'aria-describedby'?: string }>(children)
        ? cloneElement(children, { 'aria-describedby': `${htmlFor}-error` })
        : children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="mt-1 text-[11px] leading-snug text-bench-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface">
      <div className="border-b border-bench-line px-4 py-2.5">
        <div className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">{title}</div>
        {description && <p className="mt-0.5 text-[11.5px] text-bench-ink-faint">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  invalid,
  label,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  invalid?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex flex-wrap gap-1 rounded-md border bg-bench-surface-2 p-1',
        invalid ? 'border-bench-critical/60' : 'border-bench-line',
      )}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          // One tab stop for the group; arrow keys move and select, like a radio group.
          tabIndex={value === o.value || (value === null && i === 0) ? 0 : -1}
          onKeyDown={(e) => {
            const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
            if (!delta) return;
            e.preventDefault();
            const next = options[(i + delta + options.length) % options.length];
            onChange(next.value);
            const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
            buttons?.[(i + delta + options.length) % options.length]?.focus();
          }}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded px-2.5 py-1 text-[12px] transition-colors',
            value === o.value ? 'bg-accent/15 text-accent' : 'text-bench-ink-dim hover:bg-bench-surface-3 hover:text-bench-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A 1.0–5.0 score in tenths: a slider for speed, steppers for precision, and
 * the number itself always visible.
 */
export function ScoreInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  const v = value ?? 3.0;
  const set = (n: number) => onChange(Math.min(5, Math.max(1, Math.round(n * 10) / 10)));

  return (
    <div className={cn('flex items-center gap-3 rounded-md border bg-bench-surface-2 px-3 py-2', invalid ? 'border-bench-critical/60' : 'border-bench-line')}>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={0.1}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        className={cn('h-1.5 flex-1 cursor-pointer accent-[var(--color-accent)]', value === null && 'opacity-40')}
        aria-valuetext={value === null ? 'Not scored' : value.toFixed(1)}
      />
      <div className="flex items-center gap-1">
        <StepBtn label="Decrease" onClick={() => set(v - 0.1)} disabled={value !== null && v <= 1}>
          <Minus size={11} />
        </StepBtn>
        <span className={cn('tabular w-8 text-center text-[15px] font-semibold', value === null && 'text-bench-ink-faint')}>
          {value === null ? '—' : value.toFixed(1)}
        </span>
        <StepBtn label="Increase" onClick={() => set(v + 0.1)} disabled={value !== null && v >= 5}>
          <Plus size={11} />
        </StepBtn>
      </div>
    </div>
  );
}

export function StepBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-6 w-6 place-items-center rounded border border-bench-line text-bench-ink-dim transition-colors enabled:hover:border-bench-line-bright enabled:hover:text-bench-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Free-form tags with bench suggestions. Enter or comma adds; Backspace removes. */
export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder,
  max = 12,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  max?: number;
  /** Accessible name for the text input. */
  label?: string;
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  function add(raw: string) {
    const t = raw.trim().replace(/,$/, '').trim();
    if (!t || value.length >= max) return;
    // Tags compare the way the bench matches them (normalizeTag: case, spaces
    // and dots ignored), keeping whichever spelling the bench already uses.
    const key = normalizeTag(t);
    const existing = [...suggestions, ...value].find((x) => normalizeTag(x) === key);
    if (value.some((x) => normalizeTag(x) === key)) return setDraft('');
    onChange([...value, existing ?? t]);
    setDraft('');
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-bench-line bg-bench-surface-2 px-2 py-1.5 focus-within:border-accent/50">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded border border-bench-line-bright bg-bench-surface-3 py-0.5 pl-1.5 pr-1 text-[11.5px]">
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-bench-ink-faint hover:text-bench-ink"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        list={listId}
        aria-label={label ?? placeholder}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length >= max ? `${max} at most` : placeholder}
        disabled={value.length >= max}
        className="min-w-[120px] flex-1 bg-transparent px-1 text-[12.5px] placeholder:text-bench-ink-faint focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.some((v) => normalizeTag(v) === normalizeTag(s)))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.trim().length;
  const near = n > max * 0.85;
  return (
    <span className={cn('tabular', n > max ? 'text-bench-critical' : near ? 'text-bench-warning' : 'text-bench-ink-faint')}>
      <span aria-hidden>
        {n}/{max}
      </span>
      {/* The colour is not the only signal: near the limit it is also said. */}
      <span className="sr-only" aria-live="polite">
        {n > max ? `${n - max} characters over the limit` : near ? `${max - n} characters left` : ''}
      </span>
    </span>
  );
}
