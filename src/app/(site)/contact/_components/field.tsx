import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { MonoLabel } from '@/components/typography/mono-label';

const control =
  'w-full border border-[var(--rule-color)] bg-transparent px-4 py-3 text-body-sm ' +
  'text-[var(--heading-color)] transition-colors placeholder:text-[var(--muted-color)] ' +
  'focus:border-accent focus:outline-none';

interface BaseProps {
  name: string;
  label: string;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}

function Wrapper({
  name,
  label,
  error,
  hint,
  children,
  className,
}: BaseProps & { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={name}>
        <MonoLabel muted>{label}</MonoLabel>
      </label>
      {children}
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-caption text-[var(--muted-color)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-caption text-accent-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  type = 'text',
  className,
  ...props
}: BaseProps & { type?: 'text' | 'email'; className?: string }) {
  const { name, error, defaultValue, required, hint } = props;
  return (
    <Wrapper {...props} className={className}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={cn(control, error && 'border-accent-ink')}
      />
    </Wrapper>
  );
}

export function TextAreaField({
  rows = 4,
  className,
  ...props
}: BaseProps & { rows?: number; className?: string }) {
  const { name, error, defaultValue, required, hint } = props;
  return (
    <Wrapper {...props} className={className}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={cn(control, 'resize-y', error && 'border-accent-ink')}
      />
    </Wrapper>
  );
}

export function SelectField({
  options,
  className,
  ...props
}: BaseProps & {
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  const { name, error, defaultValue, required } = props;
  return (
    <Wrapper {...props} className={className}>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(control, error && 'border-accent-ink')}
      >
        <option value="" disabled>
          Select one
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/**
 * Honeypot. Off-screen rather than display:none, because some bots skip
 * hidden inputs. Hidden from assistive tech and excluded from tab order.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
