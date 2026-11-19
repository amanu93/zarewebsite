'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Eye,
  Loader2,
  Archive,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Users,
  Wrench,
} from 'lucide-react';

import {
  JOBS,
  nextRun,
  archetypeProblem,
  createArchetype,
  setArchetypeRetired,
  FRESHNESS_MAX_DAYS,
  FRESHNESS_MIN_DAYS,
  isExec,
  READY_TARGET_MAX,
  resetDemo,
  ROLE_LABEL,
  ROLES,
  runJob,
  setUserRole,
  updateArchetype,
  useCanEditRoleSettings,
  updateNotificationPrefs,
  useArchetypeImpact,
  useArchetypes,
  useBenchHealth,
  useCurrentUser,
  useJobRuns,
  useUsers,
  type Archetype,
  type HealthStatus,
  type JobMeta,
  type JobRun,
  type NotificationKey,
  type Role,
} from '@/bench/data';
import { cn, HEALTH_COLOR, timeAgo } from '@/bench/utils';

/**
 * Settings. Everything here changes how the bench behaves for everyone, so
 * each control shows its consequence before it is saved: a shorter freshness
 * window says how many people it will knock out of Ready.
 *
 * Role settings, the team and the scheduled jobs are the exec's; a
 * recruiter sees only their own notifications.
 */

const SECTIONS = [
  { id: 'roles', label: 'Roles and targets', icon: Sliders, exec: true },
  { id: 'team', label: 'Team', icon: Users, exec: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, exec: false },
  { id: 'jobs', label: 'Scheduled jobs', icon: Clock, exec: true },
  { id: 'demo', label: 'Demo', icon: Wrench, exec: false },
];

export default function SettingsPage() {
  const archetypes = useArchetypes();
  const exec = isExec(useCurrentUser().role);
  const sections = SECTIONS.filter((s) => exec || !s.exec);
  const [savedId, setSavedId] = useState<string | null>(null);

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="text-[19px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-bench-ink-dim">
          {exec ? 'How the bench is measured, who is on the team, and what gets emailed.' : 'Which emails you receive.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Settings sections">
          <ul className="sticky top-4 flex flex-col gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-bench-ink-dim transition-colors hover:bg-bench-surface-2 hover:text-bench-ink"
                >
                  <s.icon size={13} /> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 max-w-4xl flex-col gap-10">
          {exec && (
          <Block id="roles" title="Roles and targets" description="What Ready means for each role, and how much of it the business needs.">
            <div className="flex flex-col gap-4">
              {archetypes.filter((a) => !a.retired_at).map((a) => (
                // Keyed on the saved values too, so a demo reset or a change
                // made elsewhere remounts the form instead of leaving stale
                // inputs on screen.
                <ArchetypeCard
                  key={`${a.id}:${a.target_ready}:${a.freshness_days}:${a.color}:${a.communication_weight}`}
                  archetype={a}
                  saved={savedId === a.id}
                  onSaved={() => {
                    setSavedId(a.id);
                    window.setTimeout(() => setSavedId((cur) => (cur === a.id ? null : cur)), 2500);
                  }}
                />
              ))}
              <AddRole />
              <RetiredRoles roles={archetypes.filter((a) => a.retired_at)} />
            </div>
          </Block>
          )}

          {exec && (
            <Block id="team" title="Team" description="An exec manages staff, roles and role settings. A recruiter works the bench: calls, candidates and requests.">
              <Team />
            </Block>
          )}

          <Block id="notifications" title="Your notifications" description="Each person chooses their own. Sign in as someone else in the sidebar to see theirs.">
            <Notifications />
          </Block>

          {exec && (
            <Block id="jobs" title="Scheduled jobs" description="Run on a schedule in production. Run one now to see exactly what it would send. The demo sends nothing.">
              <Jobs />
            </Block>
          )}

          <Block id="demo" title="Demo">
            <Demo />
          </Block>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- roles ----

const PALETTE = ['#10cfd1', '#7c8cf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#60a5fa', '#fb7185'];

function ArchetypeCard({
  archetype: a,
  saved,
  onSaved,
}: {
  archetype: Archetype;
  saved: boolean;
  onSaved: () => void;
}) {
  const current = useBenchHealth().find((h) => h.archetype_id === a.id);
  const canEdit = useCanEditRoleSettings();

  const [target, setTarget] = useState(String(a.target_ready));
  const [freshness, setFreshness] = useState(String(a.freshness_days));
  const [color, setColor] = useState(a.color);
  const [commWeight, setCommWeight] = useState(Math.round(a.communication_weight * 100));
  const [error, setError] = useState<string | null>(null);

  const proposed = {
    target_ready: Number(target),
    freshness_days: Number(freshness),
    color: color.trim(),
    communication_weight: commWeight / 100,
    technical_weight: (100 - commWeight) / 100,
  };
  const dirty =
    proposed.target_ready !== a.target_ready ||
    proposed.freshness_days !== a.freshness_days ||
    proposed.color.toLowerCase() !== a.color.toLowerCase() ||
    commWeight !== Math.round(a.communication_weight * 100);
  const problem = archetypeProblem(proposed);

  const impactPatch = useMemo(
    () =>
      Number.isInteger(proposed.target_ready) && Number.isInteger(proposed.freshness_days) && proposed.target_ready >= 1 && proposed.freshness_days >= 1
        ? { target_ready: proposed.target_ready, freshness_days: proposed.freshness_days }
        : {},
    [proposed.target_ready, proposed.freshness_days],
  );
  const impact = useArchetypeImpact(a.id, impactPatch);
  const measuresChanged = proposed.target_ready !== a.target_ready || proposed.freshness_days !== a.freshness_days;
  const weightsChanged = commWeight !== Math.round(a.communication_weight * 100);

  async function save() {
    setError(null);
    try {
      await updateArchetype(a.id, proposed);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function retire() {
    const ok = window.confirm(
      `Retire ${a.name}? Its candidates keep the role, but it is no longer offered for new candidates, requests or jobs. You can restore it later.`,
    );
    if (!ok) return;
    setError(null);
    try {
      await setArchetypeRetired(a.id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function discard() {
    setTarget(String(a.target_ready));
    setFreshness(String(a.freshness_days));
    setColor(a.color);
    setCommWeight(Math.round(a.communication_weight * 100));
    setError(null);
  }

  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-bench-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-[14px] font-medium">{a.name}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">{a.code}</span>
        {current && (
          <span className="ml-auto flex items-center gap-2 text-[12px] text-bench-ink-dim">
            <StatusDot status={current.status} />
            <span className="tabular">
              {current.ready_count} of {current.target_ready}
            </span>{' '}
            Ready now
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => void retire()}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] text-bench-ink-faint transition-colors hover:text-bench-ink',
              !current && 'ml-auto',
            )}
          >
            <Archive size={12} aria-hidden /> Retire
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="flex items-center gap-1.5 border-b border-bench-line px-4 py-2 text-[12px] text-bench-ink-faint">
          <Lock size={12} aria-hidden /> Only an exec can change role settings.
        </p>
      )}
      <fieldset disabled={!canEdit} className="grid gap-5 p-4 md:grid-cols-2 disabled:opacity-70">
        <Field label="Ready target" hint="How many Ready candidates this role should always have">
          <NumberInput value={target} onChange={setTarget} min={1} max={READY_TARGET_MAX} suffix="candidates" />
        </Field>

        <Field label="Freshness window" hint="How long a confirmed availability stays true">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput value={freshness} onChange={setFreshness} min={FRESHNESS_MIN_DAYS} max={FRESHNESS_MAX_DAYS} suffix="days" />
            <div className="flex gap-1">
              {[14, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFreshness(String(d))}
                  className={cn(
                    'tabular rounded border px-2 py-1 text-[11px] transition-colors',
                    Number(freshness) === d ? 'border-accent/40 bg-accent/10 text-accent' : 'border-bench-line text-bench-ink-faint hover:text-bench-ink',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Scoring weights" hint="How overall is calculated from the two sub-scores">
          <div className="rounded-md border border-bench-line bg-bench-surface-2 px-3 py-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span>
                Communication <span className="tabular font-semibold">{commWeight}%</span>
              </span>
              <span>
                <span className="tabular font-semibold">{100 - commWeight}%</span> Technical
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={commWeight}
              onChange={(e) => setCommWeight(Number(e.target.value))}
              aria-label="Communication weight"
              aria-valuetext={`${commWeight}% communication, ${100 - commWeight}% technical`}
              className="mt-2 w-full accent-[var(--color-accent)]"
            />
          </div>
        </Field>

        <Field label="Colour" hint="Used on the health ring and role tags">
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`Use ${p}`}
                aria-pressed={color.toLowerCase() === p}
                onClick={() => setColor(p)}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  color.toLowerCase() === p ? 'border-bench-ink' : 'border-transparent',
                )}
                style={{ background: p }}
              />
            ))}
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Hex colour"
              className="tabular h-7 w-24 rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12px] focus:border-accent/50 focus:outline-none"
            />
          </div>
        </Field>
      </fieldset>

      {dirty && canEdit && (
        <div className="fade-up flex flex-wrap items-center gap-3 border-t border-bench-line bg-bench-surface-2/40 px-4 py-3">
          <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
            {problem ? (
              <span className="text-bench-critical">{problem}</span>
            ) : (
              <>
                {measuresChanged && impact && current && (
                  <div>
                    <span className="text-bench-ink-faint">With these settings: </span>
                    <span className="tabular">
                      {current.ready_count} → <span className="font-semibold">{impact.ready_count}</span> Ready of {impact.target_ready}
                    </span>
                    {impact.status !== current.status && (
                      <span className="ml-2 inline-flex items-center gap-1.5">
                        <StatusDot status={current.status} />
                        <span style={{ color: HEALTH_COLOR[current.status] }}>{current.status}</span>→
                        <StatusDot status={impact.status} />
                        <span style={{ color: HEALTH_COLOR[impact.status] }}>{impact.status}</span>
                      </span>
                    )}
                    {impact.ready_count < current.ready_count && (
                      <span className="ml-2 text-bench-warning">
                        {current.ready_count - impact.ready_count} would drop out of Ready immediately.
                      </span>
                    )}
                  </div>
                )}
                {weightsChanged && (
                  <div className="text-bench-ink-faint">
                    Saving recalculates every {a.name} overall score with these weights. Manual adjustments and their reasons are kept.
                  </div>
                )}
              </>
            )}
            {error && <div className="text-bench-critical">{error}</div>}
          </div>
          <button type="button" onClick={discard} className="px-2 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
            Discard
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={Boolean(problem)}
            className="h-8 rounded-md bg-accent px-3.5 text-[12px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
      {saved && !dirty && (
        <div className="fade-up flex items-center gap-1.5 border-t border-bench-line px-4 py-2.5 text-[12px] text-bench-healthy">
          <Check size={13} /> Saved. The dashboard and queue already reflect it.
        </div>
      )}
    </section>
  );
}

/**
 * Adds a role. Collapsed to one button until asked for: most visits to
 * Settings are about the roles that already exist.
 */
function AddRole() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState(PALETTE[2]);
  const [target, setTarget] = useState('10');
  const [freshness, setFreshness] = useState('30');
  const [commWeight, setCommWeight] = useState(50);
  const [errors, setErrors] = useState<{ name?: string; code?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setCode('');
    setColor(PALETTE[2]);
    setTarget('10');
    setFreshness('30');
    setCommWeight(50);
    setErrors({});
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createArchetype({
      name,
      code,
      color: color.trim(),
      target_ready: Number(target),
      freshness_days: Number(freshness),
      communication_weight: commWeight / 100,
    });
    setSaving(false);
    if (!res.ok) return setErrors(res.errors);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-bench-line text-[12.5px] text-bench-ink-dim transition-colors hover:border-accent/40 hover:text-bench-ink"
      >
        <Plus size={14} aria-hidden /> Add a role
      </button>
    );
  }

  return (
    <form onSubmit={save} className="fade-up rounded-lg border border-accent/30 bg-bench-surface">
      <div className="border-b border-bench-line px-4 py-3 text-[14px] font-medium">New role</div>
      <div className="grid gap-5 p-4 md:grid-cols-2">
        <Field label="Name" hint="As recruiters and clients say it">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
            placeholder="Sales Development Representative"
            aria-invalid={Boolean(errors.name)}
            className="h-9 w-full rounded-md border border-bench-line bg-bench-surface-2 px-3 text-[13px] focus:border-accent/50 focus:outline-none"
          />
          {errors.name && <p className="mt-1.5 text-[11.5px] text-bench-critical">{errors.name}</p>}
        </Field>
        <Field label="Code" hint="The short label on chips and filters">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErrors((x) => ({ ...x, code: undefined }));
            }}
            placeholder="SDR"
            maxLength={8}
            aria-invalid={Boolean(errors.code)}
            className="tabular h-9 w-32 rounded-md border border-bench-line bg-bench-surface-2 px-3 font-mono text-[13px] uppercase focus:border-accent/50 focus:outline-none"
          />
          {errors.code && <p className="mt-1.5 text-[11.5px] text-bench-critical">{errors.code}</p>}
        </Field>
        <Field label="Ready target" hint="How many Ready candidates this role should always have">
          <NumberInput value={target} onChange={setTarget} min={1} max={READY_TARGET_MAX} suffix="candidates" />
        </Field>
        <Field label="Freshness window" hint="How long a confirmed availability stays true">
          <NumberInput value={freshness} onChange={setFreshness} min={FRESHNESS_MIN_DAYS} max={FRESHNESS_MAX_DAYS} suffix="days" />
        </Field>
        <Field label="Scoring weights" hint="How overall is calculated from the two sub-scores">
          <div className="rounded-md border border-bench-line bg-bench-surface-2 px-3 py-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span>
                Communication <span className="tabular font-semibold">{commWeight}%</span>
              </span>
              <span>
                <span className="tabular font-semibold">{100 - commWeight}%</span> Technical
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={commWeight}
              onChange={(e) => setCommWeight(Number(e.target.value))}
              aria-label="Communication weight"
              aria-valuetext={`${commWeight}% communication, ${100 - commWeight}% technical`}
              className="mt-2 w-full accent-[var(--color-accent)]"
            />
          </div>
        </Field>
        <Field label="Colour" hint="Used on the health ring and role tags">
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`Use ${p}`}
                aria-pressed={color.toLowerCase() === p}
                onClick={() => setColor(p)}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  color.toLowerCase() === p ? 'border-bench-ink' : 'border-transparent',
                )}
                style={{ background: p }}
              />
            ))}
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-bench-line bg-bench-surface-2/40 px-4 py-3">
        <p className="min-w-0 flex-1 text-[12px] text-bench-critical">{errors.form}</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="px-2 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-8 rounded-md bg-accent px-3.5 text-[12px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add role'}
        </button>
      </div>
    </form>
  );
}

/** Retired roles, one line each, with a way back. */
function RetiredRoles({ roles }: { roles: Archetype[] }) {
  const [error, setError] = useState<string | null>(null);
  if (roles.length === 0) return null;
  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface/50">
      <div className="border-b border-bench-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
        Retired
      </div>
      <ul>
        {roles.map((a, i) => (
          <li key={a.id} className={cn('flex items-center gap-3 px-4 py-2.5', i > 0 && 'border-t border-bench-line')}>
            <span className="h-2 w-2 rounded-full opacity-50" style={{ background: a.color }} />
            <span className="text-[13px] text-bench-ink-dim">{a.name}</span>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">{a.code}</span>
            <button
              type="button"
              onClick={() =>
                setArchetypeRetired(a.id, false).catch((e) => setError(e instanceof Error ? e.message : String(e)))
              }
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] text-bench-ink-faint transition-colors hover:text-bench-ink"
            >
              <RotateCcw size={12} aria-hidden /> Restore
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="border-t border-bench-line px-4 py-2 text-[12px] text-bench-critical">{error}</p>}
    </section>
  );
}

// ----------------------------------------------------------------- team ----

function Team() {
  const users = useUsers();
  const me = useCurrentUser();
  const [error, setError] = useState<{ userId: string; message: string } | null>(null);
  const canEdit = isExec(me.role);

  async function change(userId: string, role: Role) {
    setError(null);
    try {
      await setUserRole(userId, role);
    } catch (e) {
      setError({ userId, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      {!canEdit && (
        <div className="flex items-center gap-2 border-b border-bench-line bg-bench-surface-2/40 px-4 py-2.5 text-[12px] text-bench-ink-dim">
          <Lock size={12} className="text-bench-ink-faint" /> Only an exec can change roles, including their own.
        </div>
      )}
      <ul>
        {users.map((u, i) => (
          <li key={u.id} className={cn('px-4 py-3', i > 0 && 'border-t border-bench-line')}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bench-surface-3 text-[11px] font-semibold">
                {u.full_name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13.5px]">
                  {u.full_name}
                  {u.id === me.id && (
                    <span className="rounded border border-bench-line px-1 font-mono text-[9px] uppercase tracking-wider text-bench-ink-faint">you</span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-bench-ink-faint">{u.email}</div>
              </div>
              {canEdit ? (
                <select
                  value={u.role}
                  onChange={(e) => void change(u.id, e.target.value as Role)}
                  aria-label={`Role for ${u.full_name}`}
                  className="h-8 rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12.5px] focus:border-accent/50 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12.5px] text-bench-ink-dim">{ROLE_LABEL[u.role]}</span>
              )}
            </div>
            {error?.userId === u.id && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 pl-12 text-[12px] text-bench-critical">
                <AlertTriangle size={12} /> {error.message}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-bench-line px-4 py-2.5 text-[11.5px] text-bench-ink-faint">
        Add people, and pick their role, from{' '}
        <Link href="/portal/staff" className="text-accent no-underline hover:underline">
          Staff
        </Link>
        .
      </div>
    </div>
  );
}

// -------------------------------------------------------- notifications ----

const NOTIFICATIONS: { key: NotificationKey; label: string; when: string; description: string }[] = [
  {
    key: 'notify_scarcity',
    label: 'Scarcity alert',
    when: 'When it happens',
    description: 'A role’s bench health gets worse, with how many people are one call away.',
  },
  {
    key: 'notify_decay_warning',
    label: 'Decay warning',
    when: 'Mondays 07:00',
    description: 'Your candidates leaving Ready this week, and recalls coming due.',
  },
  {
    key: 'notify_new_request',
    label: 'New request',
    when: 'When it happens',
    description: 'A client request is raised, with how many Ready matches the bench has.',
  },
  {
    key: 'notify_weekly_summary',
    label: 'Weekly summary',
    when: 'Fridays 16:00',
    description: 'Bench health, calls, requests and shortlists sent this week.',
  },
];

function Notifications() {
  const me = useCurrentUser();
  return (
    <div className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bench-line px-4 py-2.5 text-[12px] text-bench-ink-dim">
        <span>
          Sent to <span className="text-bench-ink">{me.email}</span>
        </span>
        <Link href="/portal/settings/email-preview" className="flex items-center gap-1.5 text-accent hover:text-accent-bright">
          <Eye size={12} /> Preview every email
        </Link>
      </div>
      <ul>
        {NOTIFICATIONS.map((n, i) => (
          <li key={n.key} className={cn('flex items-center gap-4 px-4 py-3', i > 0 && 'border-t border-bench-line')}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px]">{n.label}</span>
                <span className="text-[11px] text-bench-ink-faint">{n.when}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-bench-ink-faint">{n.description}</p>
            </div>
            <Switch
              checked={me[n.key]}
              label={n.label}
              onChange={(checked) => void updateNotificationPrefs(me.id, { [n.key]: checked })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        checked ? 'border-accent bg-accent' : 'border-bench-line-bright bg-bench-surface-3',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all',
          checked ? 'left-[18px] bg-accent-contrast' : 'left-0.5 bg-bench-ink-faint',
        )}
      />
    </button>
  );
}

// ----------------------------------------------------------------- jobs ----

const eat = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function Jobs() {
  const runs = useJobRuns();
  const users = useUsers();
  const name = (id: string | null) => (id ? (users.find((u) => u.id === id)?.full_name ?? 'Someone') : 'Schedule');

  return (
    <div className="flex flex-col gap-4">
      {JOBS.map((job) => (
        <JobCard key={job.name} job={job} last={runs.find((r) => r.job === job.name) ?? null} name={name} />
      ))}

      <section className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
        <div className="border-b border-bench-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
          Recent runs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-bench-line text-[10.5px] text-bench-ink-faint">
                <th className="px-4 py-2 font-normal">Job</th>
                <th className="px-4 py-2 font-normal">Started (EAT)</th>
                <th className="px-4 py-2 font-normal">Triggered by</th>
                <th className="px-4 py-2 text-right font-normal">Emails</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b border-bench-line last:border-b-0">
                  <td className="px-4 py-2">{JOBS.find((j) => j.name === r.job)?.label}</td>
                  <td className="tabular px-4 py-2 text-bench-ink-dim">{eat(r.started_at)}</td>
                  <td className="px-4 py-2 text-bench-ink-dim">{name(r.triggered_by)}</td>
                  <td className="tabular px-4 py-2 text-right">{r.emails_prepared}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const PREVIEW_KEY: Record<JobMeta['name'], string> = {
  scarcity_check: 'scarcity',
  decay_warning: 'decay',
  weekly_summary: 'weekly',
};

function JobCard({
  job,
  last,
  name,
}: {
  job: JobMeta;
  last: JobRun | null;
  name: (id: string | null) => string;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<JobRun | null>(null);
  const next = nextRun(job.name, new Date());
  const recipients = useUsers().filter((u) => u[job.preference]).length;

  async function run() {
    setRunning(true);
    try {
      // A short, honest pause: the real job queries and renders, and an
      // instant result reads as "nothing happened".
      const [r] = await Promise.all([runJob(job.name), new Promise((res) => setTimeout(res, 450))]);
      setResult(r);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-bench-line bg-bench-surface">
      <div className="flex flex-wrap items-start gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[14px] font-medium">{job.label}</span>
            <span className="text-[11.5px] text-bench-ink-faint">{job.schedule}</span>
          </div>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-bench-ink-dim">{job.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-bench-ink-faint">
            <span>
              Last run{' '}
              {last ? (
                <span className="text-bench-ink-dim">
                  {timeAgo(last.started_at)} · {name(last.triggered_by)} · {last.emails_prepared}{' '}
                  {last.emails_prepared === 1 ? 'email' : 'emails'}
                </span>
              ) : (
                'never'
              )}
            </span>
            <span>
              Next <span className="text-bench-ink-dim">{eat(next)} EAT</span>
            </span>
            <span>
              <span className="tabular text-bench-ink-dim">{recipients}</span> opted in
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/portal/settings/email-preview#${PREVIEW_KEY[job.name]}`}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-bench-ink-faint transition-colors hover:text-bench-ink"
          >
            <Eye size={12} /> Preview email
          </Link>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="flex h-8 items-center gap-1.5 rounded-md border border-bench-line-bright bg-bench-surface-2 px-3 text-[12px] font-medium transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-60"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run now
          </button>
        </div>
      </div>

      {result && (
        <div className="fade-up border-t border-bench-line bg-bench-surface-2/40 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[12px] text-bench-ink-dim">
              {result.emails_prepared === 0
                ? job.name === 'scarcity_check'
                  ? 'No role got worse since the last check. Nothing would be sent.'
                  : 'Nobody has anything to act on. Nothing would be sent.'
                : `Would send ${result.emails_prepared} ${result.emails_prepared === 1 ? 'email' : 'emails'}:`}
            </span>
            <button type="button" onClick={() => setResult(null)} className="text-[11.5px] text-bench-ink-faint hover:text-bench-ink">
              Close
            </button>
          </div>
          {result.detail.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {result.detail.map((e) => (
                <li key={e.to_user_id} className="rounded-md border border-bench-line bg-bench-surface px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[12.5px] font-medium">{e.subject}</span>
                    <span className="text-[11px] text-bench-ink-faint">to {e.to_name}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-bench-ink-dim">{e.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------- demo ----

function Demo() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="rounded-lg border border-bench-line bg-bench-surface px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px]">Reset demo data</div>
          <p className="mt-0.5 text-[12px] text-bench-ink-faint">
            Puts every candidate, call, request and setting back to the seeded state. Only affects this browser tab.
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemo();
                setConfirming(false);
                setDone(true);
                window.setTimeout(() => setDone(false), 2500);
              }}
              className="h-8 rounded-md border border-bench-critical/40 bg-bench-critical/10 px-3 text-[12px] font-medium text-bench-critical hover:bg-bench-critical/20"
            >
              Reset everything
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-bench-line-bright bg-bench-surface-2 px-3 text-[12px] font-medium text-bench-ink-dim transition-colors hover:text-bench-ink"
          >
            {done ? <Check size={12} className="text-bench-healthy" /> : <RotateCcw size={12} />}
            {done ? 'Reset' : 'Reset demo'}
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- pieces ----

function Block({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description && <p className="mb-3 mt-0.5 text-[12.5px] text-bench-ink-faint">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-bench-ink-dim">{label}</div>
      {hint && <div className="mb-2 text-[11px] text-bench-ink-faint">{hint}</div>}
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <label className="flex h-9 w-44 items-center rounded-md border border-bench-line bg-bench-surface-2 focus-within:border-accent/50">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular h-full w-20 bg-transparent px-3 text-[13px] focus:outline-none"
      />
      <span className="pr-3 text-[11.5px] text-bench-ink-faint">{suffix}</span>
    </label>
  );
}

function StatusDot({ status }: { status: HealthStatus }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[status] }} />;
}
