import { isCallAttempt, LEAVING_READY_ALERT_HOURS, type RequestPool } from '@/bench/data/logic';
import { daysFromToday, WEEK_MS } from '@/bench/dates';
import { decaySubject, newRequestSubject, scarcitySubject, weeklySubject, type NewRequestAlert } from '@/bench/emails';
import type {
  Archetype,
  BenchHealth,
  CallLog,
  CandidateView,
  ClientRequest,
  HealthStatus,
  JobEmail,
  JobName,
  Shortlist,
  ShortlistCandidate,
  User,
} from '@/bench/data/types';

/**
 * The scheduled jobs, as pure functions.
 *
 * Unlike logic.ts, this file is NOT deleted when Postgres arrives. The real
 * build runs these from scheduled route handlers (cron on the server): the handler loads rows,
 * calls the same builder, renders and sends the emails, and writes job_runs.
 * The demo calls them from the data layer and sends nothing.
 *
 * Each job has a builder that returns rich data (the email preview screen
 * renders from it) and a summariser that turns that into JobEmail rows, which
 * is all job_runs keeps.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EAT_OFFSET = 3 * HOUR; // Africa/Addis_Ababa, UTC+3, no daylight saving

export interface JobMeta {
  name: JobName;
  label: string;
  schedule: string;
  description: string;
  preference: keyof Pick<User, 'notify_scarcity' | 'notify_decay_warning' | 'notify_weekly_summary'>;
}

export const JOBS: JobMeta[] = [
  {
    name: 'scarcity_check',
    label: 'Scarcity alert',
    schedule: 'Every hour',
    description: 'Emails when a role’s bench health gets worse (green to amber, or amber to red), and each owner once about their candidates leaving Ready within 48 hours. Silent otherwise.',
    preference: 'notify_scarcity',
  },
  {
    name: 'decay_warning',
    label: 'Decay warning',
    schedule: 'Mondays, 07:00 EAT',
    description: 'Each recruiter’s candidates leaving Ready this week, plus recalls coming due. Skipped when there is nothing to call.',
    preference: 'notify_decay_warning',
  },
  {
    name: 'weekly_summary',
    label: 'Weekly summary',
    schedule: 'Fridays, 16:00 EAT',
    description: 'Bench health, calls made, requests and shortlists sent this week.',
    preference: 'notify_weekly_summary',
  },
];

/** The next scheduled run after `now`, in UTC. */
export function nextRun(job: JobName, now: Date): Date {
  if (job === 'scarcity_check') {
    const d = new Date(now);
    d.setUTCMinutes(0, 0, 0);
    return new Date(d.getTime() + HOUR);
  }
  // weekday in EAT: 1 = Monday, 5 = Friday
  const [weekday, hourEat] = job === 'decay_warning' ? [1, 7] : [5, 16];
  const eat = new Date(now.getTime() + EAT_OFFSET);
  const candidate = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate(), hourEat));
  let days = (weekday - eat.getUTCDay() + 7) % 7;
  if (days === 0 && candidate.getTime() <= eat.getTime()) days = 7;
  return new Date(candidate.getTime() + days * DAY - EAT_OFFSET);
}

// ------------------------------------------------------------ scarcity ----

const RANK: Record<HealthStatus, number> = { green: 0, amber: 1, red: 2 };

export interface ScarcityTransition {
  health: BenchHealth;
  from: HealthStatus;
  to: HealthStatus;
}

export interface ScarcityAlert {
  user: User;
  transitions: ScarcityTransition[];
  /** Their own candidates leaving Ready within 48 hours, not alerted before. */
  leaving: CandidateView[];
}

export { LEAVING_READY_ALERT_HOURS };

/**
 * Transition-only: compares each role's status with the one recorded at the
 * last check. Improvements are recorded silently; only a worsening alerts.
 * A role with no recorded status is baselined, never alerted.
 */
export function buildScarcityAlerts(input: {
  archetypes: Archetype[];
  health: BenchHealth[];
  users: User[];
  views: CandidateView[];
  now: Date;
}): {
  alerts: ScarcityAlert[];
  transitions: ScarcityTransition[];
  nextStatus: Record<string, HealthStatus>;
  /** Candidates whose leaving-Ready warning went out on this run: mark them sent. */
  alertedLeaving: CandidateView[];
} {
  const nextStatus: Record<string, HealthStatus> = {};
  const transitions: ScarcityTransition[] = [];

  for (const h of input.health) {
    nextStatus[h.archetype_id] = h.status;
    const last = input.archetypes.find((a) => a.id === h.archetype_id)?.last_health_status ?? null;
    if (last !== null && RANK[h.status] > RANK[last]) {
      transitions.push({ health: h, from: last, to: h.status });
    }
  }

  // Each Ready candidate is warned about once per confirmation: the expiry it
  // was warned about is recorded, so re-running the job sends nothing new.
  const horizon = input.now.getTime() + LEAVING_READY_ALERT_HOURS * HOUR;
  const leavingAll = input.views
    .filter(
      (v) =>
        v.layer === 'ready' &&
        v.expires_at !== null &&
        new Date(v.expires_at).getTime() <= horizon &&
        v.ready_exit_alerted_for !== v.expires_at,
    )
    .sort((a, b) => a.expires_at!.localeCompare(b.expires_at!));

  const alerts = input.users
    .filter((u) => u.notify_scarcity)
    .map((user) => ({ user, transitions, leaving: leavingAll.filter((v) => v.owner_id === user.id) }))
    .filter((a) => a.transitions.length > 0 || a.leaving.length > 0);
  const alertedLeaving = leavingAll.filter((v) => alerts.some((a) => a.leaving.includes(v)));
  return { alerts, transitions, nextStatus, alertedLeaving };
}

export function scarcityEmails(alerts: ScarcityAlert[]): JobEmail[] {
  return alerts.map(({ user, transitions, leaving }) => {
    return {
      to_user_id: user.id,
      to_name: user.full_name,
      to_email: user.email,
      subject: scarcitySubject(transitions, leaving),
      summary: [
        ...transitions.map(
          (t) =>
            `${t.health.code} ${t.from} → ${t.to}, ${t.health.ready_count}/${t.health.target_ready} Ready, ${t.health.one_call_away} one call away`,
        ),
        ...(leaving.length ? [`${leaving.length} leaving Ready within 48h`] : []),
      ].join('; '),
    };
  });
}

// --------------------------------------------------------------- decay ----

export interface DecayWarning {
  user: User;
  /** Ready now, out of the freshness window within seven days. Soonest first. */
  expiring: CandidateView[];
  /** Archived or not available, with a recall date within seven days (or already past). */
  recalls: CandidateView[];
}

export function buildDecayWarnings(input: { views: CandidateView[]; users: User[]; now: Date }): DecayWarning[] {
  const recallSoon = (v: CandidateView) =>
    v.recall_at !== null &&
    (v.layer === 'archived' || v.availability_status === 'not_available') &&
    (daysFromToday(v.recall_at, input.now) ?? Infinity) <= 7;

  return input.users
    .filter((u) => u.notify_decay_warning)
    .map((user) => {
      const mine = input.views.filter((v) => v.owner_id === user.id);
      return {
        user,
        expiring: mine
          .filter((v) => v.layer === 'ready' && v.days_until_expiry !== null && v.days_until_expiry <= 7)
          .sort((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0)),
        recalls: mine.filter(recallSoon).sort((a, b) => a.recall_at!.localeCompare(b.recall_at!)),
      };
    })
    // Nothing to call means no email. A weekly "all clear" trains people to
    // ignore the one that matters.
    .filter((w) => w.expiring.length > 0 || w.recalls.length > 0);
}

export function decayEmails(warnings: DecayWarning[]): JobEmail[] {
  return warnings.map(({ user, expiring, recalls }) => ({
    to_user_id: user.id,
    to_name: user.full_name,
    to_email: user.email,
    subject: decaySubject(expiring.length, recalls.length),
    summary: [
      expiring.length ? `${expiring.length} expiring` : null,
      recalls.length ? `${recalls.length} ${recalls.length === 1 ? 'recall' : 'recalls'} due` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

// -------------------------------------------------------------- weekly ----

export interface WeeklyStats {
  week_ending: string;
  health: BenchHealth[];
  calls: number;
  confirmed_available: number;
  requests_opened: number;
  shortlists_sent: number;
  candidates_sent: number;
  expiring_next_week: number;
}

export interface WeeklySummary {
  user: User;
  stats: WeeklyStats;
}

export function buildWeeklyStats(input: {
  health: BenchHealth[];
  calls: CallLog[];
  requests: ClientRequest[];
  shortlists: Shortlist[];
  shortlistCandidates: ShortlistCandidate[];
  now: Date;
}): WeeklyStats {
  const since = input.now.getTime() - WEEK_MS;
  const inWeek = (iso: string | null) => iso !== null && new Date(iso).getTime() > since;
  const weekCalls = input.calls.filter((c) => inWeek(c.called_at));
  const sent = input.shortlists.filter((s) => s.status === 'exported' && inWeek(s.exported_at));
  const sentIds = new Set(sent.map((s) => s.id));

  return {
    week_ending: input.now.toISOString(),
    health: input.health,
    calls: weekCalls.filter((c) => isCallAttempt(c.outcome)).length,
    confirmed_available: new Set(weekCalls.filter((c) => c.outcome === 'available').map((c) => c.candidate_id)).size,
    requests_opened: input.requests.filter((r) => inWeek(r.created_at)).length,
    shortlists_sent: sent.length,
    candidates_sent: input.shortlistCandidates.filter((sc) => sentIds.has(sc.shortlist_id)).length,
    expiring_next_week: input.health.reduce((n, h) => n + h.expiring_this_week, 0),
  };
}

export function buildWeeklySummaries(input: { users: User[]; stats: WeeklyStats }): WeeklySummary[] {
  return input.users.filter((u) => u.notify_weekly_summary).map((user) => ({ user, stats: input.stats }));
}

export function weeklyEmails(summaries: WeeklySummary[]): JobEmail[] {
  return summaries.map(({ user, stats }) => {
    return {
      to_user_id: user.id,
      to_name: user.full_name,
      to_email: user.email,
      subject: weeklySubject(stats),
      summary: `${stats.calls} calls · ${stats.shortlists_sent} ${stats.shortlists_sent === 1 ? 'shortlist' : 'shortlists'} sent · ${stats.expiring_next_week} expiring next week`,
    };
  });
}

// --------------------------------------------------------- new request ----

/**
 * Event-driven rather than scheduled: fires when a request is created. Goes
 * to everyone opted in except the person who raised it, who already knows.
 */
export function buildNewRequestAlerts(input: {
  request: ClientRequest;
  archetype: Archetype;
  /** requestPool() for this request: only candidates meeting every requirement count. */
  pool: RequestPool;
  users: User[];
}): NewRequestAlert[] {
  const ready = input.pool.ready.map((e) => e.v);
  const oneCallAway = input.pool.one_call_away.length;
  const raisedBy = input.users.find((u) => u.id === input.request.created_by)?.full_name ?? null;

  return input.users
    .filter((u) => u.notify_new_request && u.id !== input.request.created_by)
    .map((user) => ({ user, request: input.request, archetype: input.archetype, raisedBy, ready, oneCallAway }));
}

export function newRequestEmails(alerts: NewRequestAlert[]): JobEmail[] {
  return alerts.map((a) => ({
    to_user_id: a.user.id,
    to_name: a.user.full_name,
    to_email: a.user.email,
    subject: newRequestSubject(a.request, a.archetype.name, a.ready.length),
    summary: `${a.ready.length} Ready · ${a.oneCallAway} one call away · ${a.request.quantity} needed`,
  }));
}
