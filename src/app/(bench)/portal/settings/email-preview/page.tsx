'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Code2, Mail, Monitor, Smartphone } from 'lucide-react';

import {
  useDecayWarningPreview,
  useNewRequestPreview,
  useRequestSummaries,
  useScarcityPreview,
  useWeeklySummaryPreview,
} from '@/bench/data';
import {
  renderDecayWarning,
  renderNewRequestAlert,
  renderScarcityAlert,
  renderWeeklySummary,
  type EmailContext,
  type RenderedEmail,
} from '@/bench/emails';
import { cn } from '@/bench/utils';

/**
 * Email previews. Every template, rendered from the live demo data by the
 * same functions the real jobs will hand to Resend. Change the bench anywhere
 * in the demo and the emails here change with it.
 *
 * Nothing is sent from the demo.
 */

type TemplateKey = 'scarcity' | 'decay' | 'request' | 'weekly';

const TEMPLATES: { key: TemplateKey; label: string; trigger: string }[] = [
  { key: 'scarcity', label: 'Scarcity alert', trigger: 'When a role’s health gets worse' },
  { key: 'decay', label: 'Decay warning', trigger: 'Mondays 07:00 EAT' },
  { key: 'request', label: 'New request', trigger: 'When a request is raised' },
  { key: 'weekly', label: 'Weekly summary', trigger: 'Fridays 16:00 EAT' },
];

const FROM = 'Zare Bench <bench@zareinnovations.com>';

export default function EmailPreviewPage() {
  // Deep links from settings: /portal/settings/email-preview#decay. Read on
  // first render; this page only renders in the browser, behind the shell.
  const [template, setTemplate] = useState<TemplateKey>(() => {
    const fromHash = window.location.hash.slice(1) as TemplateKey;
    return TEMPLATES.some((t) => t.key === fromHash) ? fromHash : 'scarcity';
  });
  const [mode, setMode] = useState<'html' | 'text'>('html');
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');

  function choose(key: TemplateKey) {
    setTemplate(key);
    window.history.replaceState(null, '', `#${key}`);
  }

  return (
    <div className="px-5 py-6">
      <Link href="/portal/settings#jobs" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
        <ArrowLeft size={12} /> Settings
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Email previews</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            Rendered from the live demo data by the same templates production will send. Nothing is sent from the demo.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Email templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={template === t.key}
            onClick={() => choose(t.key)}
            className={cn(
              'rounded-lg border px-3.5 py-2.5 text-left transition-colors',
              template === t.key ? 'border-accent/50 bg-accent/[0.07]' : 'border-bench-line bg-bench-surface hover:border-bench-line-bright',
            )}
          >
            <div className={cn('text-[13px] font-medium', template === t.key ? 'text-accent' : 'text-bench-ink')}>{t.label}</div>
            <div className="mt-0.5 text-[11px] text-bench-ink-faint">{t.trigger}</div>
          </button>
        ))}
      </div>

      {template === 'scarcity' && <ScarcityPreview mode={mode} width={width} onMode={setMode} onWidth={setWidth} />}
      {template === 'decay' && <DecayPreview mode={mode} width={width} onMode={setMode} onWidth={setWidth} />}
      {template === 'request' && <RequestPreview mode={mode} width={width} onMode={setMode} onWidth={setWidth} />}
      {template === 'weekly' && <WeeklyPreview mode={mode} width={width} onMode={setMode} onWidth={setWidth} />}
    </div>
  );
}

// ------------------------------------------------------------ per template --

interface ViewProps {
  mode: 'html' | 'text';
  width: 'desktop' | 'phone';
  onMode: (m: 'html' | 'text') => void;
  onWidth: (w: 'desktop' | 'phone') => void;
}

function useCtx(): EmailContext {
  // In production this is the canonical staff URL; here, wherever the demo runs.
  return useMemo(() => ({ portalUrl: `${window.location.origin}/portal`, now: new Date() }), []);
}

function ScarcityPreview(props: ViewProps) {
  const ctx = useCtx();
  const preview = useScarcityPreview();
  const [userId, setUserId] = useRecipient(preview.alerts.map((a) => a.user.id));
  const alert = preview.alerts.find((a) => a.user.id === userId);

  if (preview.alerts.length === 0 && preview.transitions.length === 0) {
    return <Empty>Every role is at or above its Ready target, so there is nothing a scarcity alert could say.</Empty>;
  }
  return (
    <Frame
      {...props}
      notice={
        preview.example
          ? `No role has got worse and nobody is about to leave Ready, so nobody would be emailed right now. This is how the alert looks for ${preview.transitions[0].health.name}, which is ${preview.transitions[0].to}.`
          : null
      }
      recipients={preview.alerts.map((a) => a.user)}
      userId={userId}
      onUser={setUserId}
      email={alert ? renderScarcityAlert({ user: alert.user, transitions: alert.transitions, leaving: alert.leaving, ctx }) : null}
      nobody="Nobody has scarcity alerts switched on."
    />
  );
}

function DecayPreview(props: ViewProps) {
  const ctx = useCtx();
  const warnings = useDecayWarningPreview();
  const [userId, setUserId] = useRecipient(warnings.map((w) => w.user.id));
  const warning = warnings.find((w) => w.user.id === userId);

  return (
    <Frame
      {...props}
      notice="Only people with something to call get this email. Anyone whose candidates are all comfortably fresh is skipped."
      recipients={warnings.map((w) => w.user)}
      userId={userId}
      onUser={setUserId}
      email={warning ? renderDecayWarning({ warning, ctx }) : null}
      nobody="Nobody would get a decay warning this week: no one’s candidates are about to expire and no recalls are due."
    />
  );
}

function RequestPreview(props: ViewProps) {
  const ctx = useCtx();
  const requests = useRequestSummaries();
  const newest = [...requests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const [requestId, setRequestId] = useState(newest?.id ?? '');
  const alerts = useNewRequestPreview(requestId);
  const [userId, setUserId] = useRecipient(alerts.map((a) => a.user.id));
  const alert = alerts.find((a) => a.user.id === userId);

  return (
    <Frame
      {...props}
      extra={
        <label className="flex items-center gap-2 text-[12px] text-bench-ink-faint">
          Request
          <select
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="h-8 max-w-[220px] rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12.5px] text-bench-ink focus:border-accent/50 focus:outline-none"
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.client_name} · {r.archetype_code} × {r.quantity}
              </option>
            ))}
          </select>
        </label>
      }
      notice="Sent when the request is created, to everyone opted in except the person who raised it."
      recipients={alerts.map((a) => a.user)}
      userId={userId}
      onUser={setUserId}
      email={alert ? renderNewRequestAlert({ alert, ctx }) : null}
      nobody="Nobody besides the person who raised this request has new request alerts switched on."
    />
  );
}

function WeeklyPreview(props: ViewProps) {
  const ctx = useCtx();
  const summaries = useWeeklySummaryPreview();
  const [userId, setUserId] = useRecipient(summaries.map((s) => s.user.id));
  const summary = summaries.find((s) => s.user.id === userId);

  return (
    <Frame
      {...props}
      notice={null}
      recipients={summaries.map((s) => s.user)}
      userId={userId}
      onUser={setUserId}
      email={summary ? renderWeeklySummary({ user: summary.user, stats: summary.stats, ctx }) : null}
      nobody="Nobody has the weekly summary switched on. Turn it on in Settings to preview it."
    />
  );
}

/** Keeps the chosen recipient valid as the list changes. */
function useRecipient(ids: string[]): [string, (id: string) => void] {
  const [chosen, setChosen] = useState<string>('');
  const valid = ids.includes(chosen) ? chosen : (ids[0] ?? '');
  return [valid, setChosen];
}

// ------------------------------------------------------------------ frame ----

function Frame({
  mode,
  width,
  onMode,
  onWidth,
  recipients,
  userId,
  onUser,
  email,
  notice,
  nobody,
  extra,
}: ViewProps & {
  recipients: { id: string; full_name: string; email: string }[];
  userId: string;
  onUser: (id: string) => void;
  email: RenderedEmail | null;
  notice: string | null;
  nobody: string;
  extra?: React.ReactNode;
}) {
  const to = recipients.find((r) => r.id === userId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        {recipients.length > 0 && (
          <label className="flex items-center gap-2 text-[12px] text-bench-ink-faint">
            Recipient
            <select
              value={userId}
              onChange={(e) => onUser(e.target.value)}
              className="h-8 rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12.5px] text-bench-ink focus:border-accent/50 focus:outline-none"
            >
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
            <span className="tabular text-[11px]">
              {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
            </span>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Toggle
            options={[
              { value: 'html', label: 'Email', icon: <Mail size={12} /> },
              { value: 'text', label: 'Plain text', icon: <Code2 size={12} /> },
            ]}
            value={mode}
            onChange={onMode}
          />
          <Toggle
            options={[
              { value: 'desktop', label: 'Desktop', icon: <Monitor size={12} /> },
              { value: 'phone', label: 'Phone', icon: <Smartphone size={12} /> },
            ]}
            value={width}
            onChange={onWidth}
            disabled={mode === 'text'}
          />
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-md border border-bench-line bg-bench-surface px-3 py-2 text-[12px] text-bench-ink-dim">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-bench-warning" />
          {notice}
        </div>
      )}

      {!email || !to ? (
        <Empty>{nobody}</Empty>
      ) : (
        <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          <dl className="grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-bench-line px-4 py-3 text-[12.5px]">
            <dt className="text-bench-ink-faint">From</dt>
            <dd className="truncate text-bench-ink-dim">{FROM}</dd>
            <dt className="text-bench-ink-faint">To</dt>
            <dd className="truncate text-bench-ink-dim">
              {to.full_name} &lt;{to.email}&gt;
            </dd>
            <dt className="text-bench-ink-faint">Subject</dt>
            <dd className="font-medium text-bench-ink">{email.subject}</dd>
            <dt className="text-bench-ink-faint">Preview</dt>
            <dd className="text-bench-ink-faint">{email.preheader}</dd>
          </dl>

          <div className="bg-bench-surface-2 p-3 sm:p-5">
            {mode === 'text' ? (
              <pre className="mx-auto max-w-[680px] overflow-x-auto whitespace-pre-wrap rounded-md border border-bench-line bg-bench-surface px-5 py-4 font-mono text-[12.5px] leading-relaxed text-bench-ink-dim">
                {email.text}
              </pre>
            ) : (
              <EmailFrame html={email.html} width={width === 'phone' ? 375 : 680} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The email in an isolated frame, sized to its content. Sandboxed with no
 * scripts; links open in a new tab so the preview itself never navigates.
 */
function EmailFrame({ html, width }: { html: string; width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  // The frame never scrolls itself: the page does, and the frame is sized to
  // the email. Links open in a new tab so the preview never navigates.
  const doc = useMemo(
    () => html.replace('<head>', '<head><base target="_blank"><style>html,body{overflow:hidden}</style>'),
    [html],
  );

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const measure = () => {
      const body = frame.contentDocument?.body;
      if (body) setHeight(Math.max(300, body.scrollHeight + 4));
    };
    // The email reflows whenever the frame's width changes, including through
    // the max-width transition, so re-measure on every resize rather than
    // guessing when the transition ends.
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    frame.addEventListener('load', measure);
    measure();
    return () => {
      observer.disconnect();
      frame.removeEventListener('load', measure);
    };
  }, [doc]);

  return (
    <div className="mx-auto overflow-hidden rounded-md shadow-2xl transition-[max-width] duration-300" style={{ maxWidth: width }}>
      <iframe
        ref={ref}
        title="Email preview"
        srcDoc={doc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="block w-full border-0 bg-white"
        style={{ height }}
      />
    </div>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; icon: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-md border border-bench-line bg-bench-surface p-0.5', disabled && 'opacity-40')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] transition-colors',
            value === o.value ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-faint enabled:hover:text-bench-ink-dim',
          )}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-14 text-center text-[13px] text-bench-ink-dim">
      {children}
    </div>
  );
}
