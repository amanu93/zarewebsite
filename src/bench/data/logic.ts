/**
 * Business logic, transcribed from the SQL.
 *
 * Every function here has a named counterpart in supabase/migrations. When
 * the database arrives these functions are deleted, not ported — Postgres
 * does the work and this file stops existing. Until then it must agree with
 * the SQL exactly, so each function carries a pointer to the view or
 * expression it mirrors.
 *
 * Rounding, boundary conditions and null handling are the whole game here.
 * `>=` vs `>` on the freshness boundary is the difference between a bench
 * that looks healthy and one that is.
 */

import { addDays, dateKey, DAY_MS, daysFromToday, formatDate, todayKey } from '@/bench/dates';
import type {
  Archetype,
  BenchHealth,
  CallAttempt,
  CallDetails,
  CallDueState,
  CallErrors,
  CallLog,
  CallOutcome,
  Candidate,
  CandidateView,
  ClientRequest,
  HealthStatus,
  Layer,
  Placement,
  QueueItem,
  RequestOutcome,
  RequestStatus,
  Role,
  Shortlist,
  ShortlistCandidate,
  User,
  PipelineStage,
} from './types';

const HOUR_MS = 3_600_000;

// ----------------------------------------------------------------- roles ----
// Who may do what, in one place. The data layer enforces these; screens use
// the same functions to decide what to offer.

export const ROLES: Role[] = ['exec', 'recruiter'];

export const ROLE_LABEL: Record<Role, string> = { exec: 'Exec', recruiter: 'Recruiter' };

export const ROLE_NAME_MAX = 60;

/**
 * A new role's name and code. The code is the short label on chips and
 * filters ('SDR', 'FSD'): 2–8 letters or digits, unique across every role,
 * retired ones included, so an old candidate's code never changes meaning.
 */
export function roleIdentityProblem(
  input: { name: string; code: string },
  existing: Pick<Archetype, 'name' | 'code'>[],
): { name?: string; code?: string } {
  const out: { name?: string; code?: string } = {};
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (name.length < 2) out.name = 'Give the role a name.';
  else if (name.length > ROLE_NAME_MAX) out.name = `At most ${ROLE_NAME_MAX} characters.`;
  else if (existing.some((a) => a.name.trim().toLowerCase() === name.toLowerCase())) {
    out.name = 'A role with this name already exists.';
  }
  if (!/^[A-Z0-9]{2,8}$/.test(code)) out.code = '2 to 8 letters or digits, like SDR.';
  else if (existing.some((a) => a.code.toUpperCase() === code)) out.code = 'This code is already used.';
  return out;
}

/** Staff, roles and role settings are the exec's. */
export const isExec = (role: Role | undefined) => role === 'exec';

/**
 * Request status, closing and export. This was account-manager work; with
 * that role folded into recruiter, every signed-in role keeps it.
 */
export const canManageRequestsRole = (role: Role | undefined) => role === 'recruiter' || role === 'exec';

/** Recruiters open the queue on their own candidates; others see everyone's. */
export const queueStartsOnMine = (role: Role | undefined) => role === 'recruiter';

// ------------------------------------------------------- role settings ----

export const READY_TARGET_MAX = 500;
export const FRESHNESS_MIN_DAYS = 7;
export const FRESHNESS_MAX_DAYS = 180;

// ------------------------------------------------------------ call rules ----

/** An unanswered call buys this much quiet before the candidate is retried. */
export const NO_ANSWER_COOLDOWN_HOURS = 48;
/** How far ahead the hourly check warns an owner that a candidate leaves Ready. */
export const LEAVING_READY_ALERT_HOURS = 48;
/** A Ready candidate enters the queue this many days before expiry. */
export const EXPIRING_SOON_DAYS = 7;
/** Not available: the suggested date to call again, from today. */
export const NOT_AVAILABLE_RECALL_DAYS = 30;
/** The furthest ahead a recall can be booked. */
export const MAX_RECALL_DAYS = 365;
export const CALL_NOTE_MAX = 280;
/** Notice periods offered when confirming availability. */
export const NOTICE_OPTIONS = ['Immediate', '1 week', '2 weeks', '1 month', '2 months', '3 months'] as const;
export const IMMEDIATE = 'Immediate';
export const SHIFT_OPTIONS = ['Day', 'Evening', 'Night', 'Weekend'] as const;

/**
 * The outcomes that are calls. Archiving is logged in call history for the
 * audit trail, but it is not a conversation with anyone and never counts
 * toward calls today, the streak or the weekly summary.
 */
export const CALL_ATTEMPTS: readonly CallOutcome[] = ['available', 'not_available', 'no_answer'];

export function isCallAttempt(outcome: CallOutcome): outcome is CallAttempt {
  return CALL_ATTEMPTS.includes(outcome);
}

/** The most recent call attempt (not an archive entry), from newest-first calls. */
export function lastAttempt(callsDesc: CallLog[]): CallLog | null {
  return callsDesc.find((c) => isCallAttempt(c.outcome)) ?? null;
}

/**
 * The most recent verification: an Available or Not available call. This is
 * the ONLY source of last_verified_at, so the record and its call history can
 * never disagree about when someone was last confirmed.
 */
export function lastVerification(callsDesc: CallLog[]): CallLog | null {
  return callsDesc.find((c) => c.outcome === 'available' || c.outcome === 'not_available') ?? null;
}

/** Mirrors: make_interval(days => freshness_days) added to last_verified_at. */
export function expiresAt(
  candidate: Pick<Candidate, 'last_verified_at'>,
  freshnessDays: number,
): Date | null {
  if (!candidate.last_verified_at) return null;
  return new Date(new Date(candidate.last_verified_at).getTime() + freshnessDays * DAY_MS);
}

/**
 * Calendar days in EAT from today to the expiry date (0 on the day itself,
 * negative once past). Mirrors days_until_expiry in 0007. Null when never
 * verified.
 */
export function daysUntilExpiry(expires: Date | null, now: Date): number | null {
  if (!expires) return null;
  return daysFromToday(expires, now);
}

/**
 * Mirrors: the CASE in candidates_view.
 *
 * Order is load-bearing. Archived wins over everything — an archived
 * candidate is out of the bench however good or however fresh they are — and
 * raw is checked before ready so an unassessed record can never be Ready.
 */
export function deriveLayer(
  candidate: Candidate,
  freshnessDays: number,
  now: Date,
): Layer {
  if (candidate.archived_reason !== null) return 'archived';
  if (candidate.assessed_at === null) return 'raw';

  const fresh =
    candidate.last_verified_at !== null &&
    new Date(candidate.last_verified_at).getTime() > now.getTime() - freshnessDays * DAY_MS;

  if (candidate.availability_status === 'available' && fresh) return 'ready';
  return 'known';
}

/** Mirrors: candidates_view, including its `where deleted_at is null`. */
export function toCandidateView(
  candidate: Candidate,
  archetype: Archetype,
  now: Date,
): CandidateView {
  // Only an Available confirmation has a shelf life. Someone who said they
  // are not available has no "good until": their next date is the recall.
  const expires =
    candidate.availability_status === 'available' ? expiresAt(candidate, archetype.freshness_days) : null;
  return {
    overall_basis: overallBasis(candidate, archetype),
    reassess_due: isReassessDue(candidate.assessed_at, now),
    ...candidate,
    archetype_code: archetype.code,
    archetype_name: archetype.name,
    archetype_color: archetype.color,
    freshness_days: archetype.freshness_days,
    expires_at: expires ? expires.toISOString() : null,
    days_until_expiry: daysUntilExpiry(expires, now),
    layer: deriveLayer(candidate, archetype.freshness_days, now),
  };
}

/**
 * Mirrors: bench_health.
 *
 * one_call_away is the number that makes a scarcity alert actionable: people
 * already assessed who could be Ready after one good call today. See
 * isOneCallAway for who that excludes.
 */
export function computeBenchHealth(
  archetype: Archetype,
  views: CandidateView[],
  now: Date = new Date(),
): BenchHealth {
  const mine = views.filter((v) => v.archetype_id === archetype.id);
  const count = (layer: Layer) => mine.filter((v) => v.layer === layer).length;

  const ready_count = count('ready');
  const known_count = count('known');
  const coverage = round2(ready_count / archetype.target_ready);

  return {
    archetype_id: archetype.id,
    code: archetype.code,
    name: archetype.name,
    color: archetype.color,
    target_ready: archetype.target_ready,
    freshness_days: archetype.freshness_days,
    ready_count,
    known_count,
    raw_count: count('raw'),
    archived_count: count('archived'),
    one_call_away: mine.filter((v) => isOneCallAway(v, now)).length,
    expiring_this_week: mine.filter(
      (v) =>
        v.layer === 'ready' &&
        v.days_until_expiry !== null &&
        v.days_until_expiry >= 0 &&
        v.days_until_expiry <= 7,
    ).length,
    coverage,
    status: healthStatus(ready_count, archetype.target_ready),
  };
}

/** Mirrors: the CASE on coverage. green >= 1.0, amber >= 0.6, else red. */
export function healthStatus(readyCount: number, target: number): HealthStatus {
  const coverage = readyCount / target;
  if (coverage >= 1.0) return 'green';
  if (coverage >= 0.6) return 'amber';
  return 'red';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Whether a candidate needs a call, and why. The single rule behind the call
 * queue, the "next due" line on a record and every "call now" button.
 *
 * In order:
 *
 *   raw                   never. They need assessing, not phoning.
 *   last call unanswered  cooling down for 48 hours, then Retry, whatever the
 *                         layer. Nobody who needs a call drops out.
 *   archived              due once the recall date arrives, if there is one.
 *   not available         due once the recall date arrives.
 *   never verified        due now.
 *   expired               due now.
 *   Ready                 due within 7 days of expiry; otherwise not yet.
 *
 * Priorities: 1 expired or never verified, 2 expiring, 3 retry, 4 recall.
 */
export function callDueState(view: CandidateView, callsDesc: CallLog[], now: Date): CallDueState {
  if (view.layer === 'raw') return { kind: 'not_due', next_due_at: null, why: 'raw' };

  const recallDue = view.recall_at !== null && view.recall_at <= todayKey(now);

  // An archived candidate is only callable once their recall comes round;
  // an unanswered recall call then retries like any other.
  if (view.layer === 'archived' && !recallDue) {
    return { kind: 'not_due', next_due_at: view.recall_at, why: 'archived' };
  }

  const attempt = lastAttempt(callsDesc);
  if (attempt?.outcome === 'no_answer') {
    const until = new Date(new Date(attempt.called_at).getTime() + NO_ANSWER_COOLDOWN_HOURS * HOUR_MS);
    if (until.getTime() > now.getTime()) return { kind: 'cooldown', until: until.toISOString() };
    return { kind: 'due', reason: 'no_answer_retry', priority: 3 };
  }

  if (view.layer === 'archived') return { kind: 'due', reason: 'recall_due', priority: 4 };

  if (view.availability_status === 'not_available') {
    // A recall date is required when logging Not available. Older records
    // without one fall back to the standard interval from the verification.
    const recall =
      view.recall_at ??
      (view.last_verified_at ? addDays(dateKey(view.last_verified_at), NOT_AVAILABLE_RECALL_DAYS) : todayKey(now));
    if (recall <= todayKey(now)) return { kind: 'due', reason: 'recall_due', priority: 4 };
    return { kind: 'not_due', next_due_at: recall, why: 'recall_scheduled' };
  }

  if (view.last_verified_at === null) return { kind: 'due', reason: 'never_verified', priority: 1 };
  if (view.layer === 'known') return { kind: 'due', reason: 'expired', priority: 1 };

  // Ready.
  if (view.days_until_expiry !== null && view.days_until_expiry <= EXPIRING_SOON_DAYS) {
    return { kind: 'due', reason: 'expiring_soon', priority: 2 };
  }
  const nextDue = view.expires_at ? addDays(dateKey(view.expires_at), -EXPIRING_SOON_DAYS) : null;
  return { kind: 'not_due', next_due_at: nextDue, why: 'fresh' };
}

/**
 * Known candidates a single good call could make Ready today: assessed,
 * previously confirmed available but now expired, or not available with the
 * recall date reached. Not available before the recall date is excluded,
 * and so is anyone never verified: nothing yet says they would say yes.
 */
export function isOneCallAway(view: CandidateView, now: Date): boolean {
  if (view.layer !== 'known') return false;
  if (view.availability_status === 'available') return view.last_verified_at !== null;
  if (view.availability_status === 'not_available') {
    return view.recall_at !== null && view.recall_at <= todayKey(now);
  }
  return false;
}

/**
 * Mirrors: call_queue (0007). Everyone due a call, plus everyone cooling down
 * after an unanswered call, so nobody who needs a call is ever out of sight.
 */
export function buildCallQueue(
  views: CandidateView[],
  callsByCandidate: Map<string, CallLog[]>,
  usersById: Map<string, User>,
  now: Date,
): QueueItem[] {
  const items: QueueItem[] = [];

  for (const v of views) {
    const calls = callsByCandidate.get(v.id) ?? [];
    const state = callDueState(v, calls, now);
    if (state.kind === 'not_due') continue;

    const last = lastAttempt(calls);
    items.push({
      id: v.id,
      ref_code: v.ref_code,
      full_name: v.full_name,
      phone: v.phone,
      owner_id: v.owner_id,
      owner_name: v.owner_id ? (usersById.get(v.owner_id)?.full_name ?? null) : null,
      archetype_id: v.archetype_id,
      archetype_code: v.archetype_code,
      archetype_name: v.archetype_name,
      archetype_color: v.archetype_color,
      layer: v.layer,
      availability_status: v.availability_status,
      last_verified_at: v.last_verified_at,
      expires_at: v.expires_at,
      days_until_expiry: v.days_until_expiry,
      recall_at: v.recall_at,
      shift_flexibility: v.shift_flexibility,
      setup_verified: v.setup_verified,
      last_outcome: last?.outcome ?? null,
      last_called_at: last?.called_at ?? null,
      priority: state.kind === 'due' ? state.priority : 3,
      reason: state.kind === 'due' ? state.reason : 'no_answer_retry',
      retry_at: state.kind === 'cooldown' ? state.until : null,
    });
  }

  // Due before waiting; then by priority; then most overdue first, with
  // never-verified (no expiry) at the very top of its bucket.
  return items.sort((a, b) => {
    const wa = a.retry_at ? 1 : 0;
    const wb = b.retry_at ? 1 : 0;
    if (wa !== wb) return wa - wb;
    if (a.retry_at && b.retry_at) return a.retry_at.localeCompare(b.retry_at);
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ax = a.expires_at ? new Date(a.expires_at).getTime() : 0;
    const bx = b.expires_at ? new Date(b.expires_at).getTime() : 0;
    return ax - bx;
  });
}

/**
 * Mirrors: call_stats(). Streak counts consecutive days, in Addis time,
 * ending today, on which at least one call was logged.
 *
 * Deliberately counts calls, never pool size. Rewarding volume produces
 * hundreds of unassessed names and destroys the value of the bench. Archiving
 * is not a call and is not counted.
 */
export function computeCallStats(calls: CallLog[], userId: string, now: Date) {
  const mine = calls.filter((c) => c.called_by === userId && isCallAttempt(c.outcome));
  const today = todayKey(now);
  const days = new Set(mine.map((c) => dateKey(c.called_at)));

  let streak = 0;
  for (let key = today; days.has(key); key = addDays(key, -1)) streak += 1;

  return {
    calls_today: mine.filter((c) => dateKey(c.called_at) === today).length,
    streak_days: streak,
  };
}

/**
 * Mirrors: the checks in log_call() (0007). What each outcome must record:
 *
 *   Available      notice period, and an earliest start date unless the
 *                  notice is Immediate. Nothing is assumed.
 *   Not available  a date to call again, after today and within a year.
 *   No answer      nothing beyond an optional note.
 */
export function validateCallDetails(outcome: CallAttempt, d: CallDetails, now: Date): CallErrors {
  const e: CallErrors = {};
  const today = todayKey(now);

  if ((d.note ?? '').trim().length > CALL_NOTE_MAX) e.note = `${CALL_NOTE_MAX} characters at most.`;

  if (outcome === 'available') {
    const notice = (d.notice_period ?? '').trim();
    if (!notice) e.notice_period = 'Ask for their notice period.';
    else if (!(NOTICE_OPTIONS as readonly string[]).includes(notice)) e.notice_period = 'Choose one of the notice periods.';
    if (notice !== IMMEDIATE) {
      if (!d.earliest_start_date) e.earliest_start_date = 'Ask when they could start.';
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.earliest_start_date)) e.earliest_start_date = 'Enter a date.';
      else if (d.earliest_start_date < today) e.earliest_start_date = 'Start date cannot be in the past.';
    }
    const bad = (d.shift_flexibility ?? []).filter((x) => !(SHIFT_OPTIONS as readonly string[]).includes(x));
    if (bad.length) e.shift_flexibility = 'Unknown shift.';
  }

  if (outcome === 'not_available') {
    const r = d.recall_at ?? '';
    if (!r) e.recall_at = 'Choose when to call again.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(r)) e.recall_at = 'Enter a date.';
    else if (r <= today) e.recall_at = 'Choose a date after today.';
    else if (r > addDays(today, MAX_RECALL_DAYS)) e.recall_at = 'Within a year.';
  }

  return e;
}

/** The suggested recall date for Not available: today plus 30 days. */
export function defaultRecallDate(now: Date): string {
  return addDays(todayKey(now), NOT_AVAILABLE_RECALL_DAYS);
}

/**
 * Mirrors: the candidate update inside log_call() (0007). What a logged call
 * changes on the record, as a pure function so undo and the seed can replay
 * it exactly.
 *
 *   Available      confirmed now: status, last_verified_at, and exactly the
 *                  notice, start and shifts that were asked. Clears a recall
 *                  and, for a recalled archived candidate, returns them to
 *                  the bench.
 *   Not available  confirmed now as not available: recall date set, and any
 *                  earlier start date dropped, since it no longer holds.
 *   No answer      no change to the record.
 */
export function applyCall(candidate: Candidate, call: CallLog): Candidate {
  if (call.outcome === 'available') {
    return {
      ...candidate,
      availability_status: 'available',
      last_verified_at: call.called_at,
      notice_period: call.notice_period,
      earliest_start_date: call.notice_period === IMMEDIATE ? null : call.earliest_start_date,
      shift_flexibility: call.shift_flexibility ?? candidate.shift_flexibility,
      recall_at: null,
      archived_reason:
        candidate.archived_reason && candidate.archived_reason !== 'do_not_contact' ? null : candidate.archived_reason,
      updated_at: call.called_at,
    };
  }
  if (call.outcome === 'not_available') {
    return {
      ...candidate,
      availability_status: 'not_available',
      last_verified_at: call.called_at,
      earliest_start_date: null,
      recall_at: call.recall_at,
      updated_at: call.called_at,
    };
  }
  return candidate;
}

// ------------------------------------------------------ contact details ----

/**
 * Mirrors: normalize_phone() (0007). One canonical form, so the same number
 * typed three ways is one number. Ethiopian numbers in any local form
 * (09…, 9…, +251 9…, 251…) become +2519XXXXXXXX; other countries need their
 * + and country code. Returns null when it is not a phone number.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[^\d\s()+.-]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  const ethiopian = (local: string) => (/^[79]\d{8}$/.test(local) ? `+251${local}` : null);
  if (trimmed.startsWith('+')) {
    if (digits.startsWith('251')) return ethiopian(digits.slice(3));
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith('251')) return ethiopian(digits.slice(3));
  if (digits.startsWith('0')) return ethiopian(digits.slice(1));
  return ethiopian(digits);
}

export const PHONE_ERROR = 'Enter a valid phone number';

export interface ContactInput {
  full_name: string;
  phone: string;
  email: string;
  location: string;
  linkedin_url: string;
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

/** Mirrors the contact checks on candidates (0007). */
export function validateContact(input: ContactInput): ContactErrors {
  const e: ContactErrors = {};
  const name = input.full_name.trim();
  if (name.length < 2) e.full_name = 'Full name is required.';
  else if (name.length > 120) e.full_name = '120 characters at most.';
  if (!normalizePhone(input.phone)) e.phone = PHONE_ERROR;
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address.';
  const url = input.linkedin_url.trim();
  if (url && !/^https:\/\/([a-z]+\.)?linkedin\.com\/\S+$/i.test(url)) e.linkedin_url = 'Paste the full https://linkedin.com profile link.';
  if (input.location.trim().length > 120) e.location = '120 characters at most.';
  return e;
}

const nameKey = (n: string | null) => (n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface DuplicateMatches {
  /** Same phone number: the same person. Blocks saving. */
  phone: CandidateView[];
  /** Same name or email, different number: probably the same person. Warns. */
  similar: CandidateView[];
}

/** Existing records a new or edited contact would duplicate. Archived records count. */
export function findDuplicates(
  input: Pick<ContactInput, 'full_name' | 'phone' | 'email'>,
  views: CandidateView[],
  excludeId?: string,
): DuplicateMatches {
  const phone = normalizePhone(input.phone);
  const email = input.email.trim().toLowerCase();
  const name = nameKey(input.full_name);
  const others = views.filter((v) => v.id !== excludeId);
  const byPhone = phone ? others.filter((v) => v.phone !== null && normalizePhone(v.phone) === phone) : [];
  const similar = others.filter(
    (v) =>
      !byPhone.includes(v) &&
      ((name.length >= 3 && nameKey(v.full_name) === name) || (email.includes('@') && (v.email ?? '').toLowerCase() === email)),
  );
  return { phone: byPhone, similar };
}

// --------------------------------------------------------- request fit ----

/**
 * Mirrors: normalize_tag() (0007). How tags compare everywhere: case, spaces
 * and dots do not matter, so "Node.js", "NodeJS" and "node js" are one tool.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s.]+/g, '');
}

export interface RequestFit {
  fits: boolean;
  missing_skills: string[];
  missing_shifts: string[];
}

/**
 * Mirrors: request_fit() (0007). A candidate fits a request when they have
 * every required skill or tool (in stack or skills) and can work every
 * required shift. A candidate with no shifts on record does not fit a
 * request that requires one: nothing says they can work it.
 */
export function requestFit(
  req: Pick<ClientRequest, 'required_skills' | 'required_shifts'>,
  v: Pick<CandidateView, 'stack' | 'skills' | 'shift_flexibility'>,
): RequestFit {
  const has = new Set([...v.stack, ...v.skills].map(normalizeTag));
  const shifts = new Set(v.shift_flexibility.map(normalizeTag));
  const missing_skills = req.required_skills.filter((t) => !has.has(normalizeTag(t)));
  const missing_shifts = req.required_shifts.filter((t) => !shifts.has(normalizeTag(t)));
  return { fits: missing_skills.length === 0 && missing_shifts.length === 0, missing_skills, missing_shifts };
}

/** Where else a candidate is committed: on an active request's shortlist. */
export interface Commitment {
  request_id: string;
  client_name: string;
  submitted: boolean;
}

/**
 * Candidates on a shortlist (draft or sent) of a request that is not closed.
 * A candidate can be on several; they stay addable everywhere, but every
 * other request should know.
 */
export function commitmentsByCandidate(
  requests: ClientRequest[],
  shortlists: Shortlist[],
  entries: ShortlistCandidate[],
): Map<string, Commitment[]> {
  const active = new Map(requests.filter((r) => r.status !== 'closed').map((r) => [r.id, r]));
  const lists = new Map(shortlists.filter((sl) => active.has(sl.request_id)).map((sl) => [sl.id, sl]));
  const out = new Map<string, Commitment[]>();
  for (const e of entries) {
    const sl = lists.get(e.shortlist_id);
    if (!sl) continue;
    const req = active.get(sl.request_id)!;
    const list = out.get(e.candidate_id) ?? [];
    const existing = list.find((c) => c.request_id === req.id);
    if (existing) existing.submitted ||= sl.status === 'exported';
    else list.push({ request_id: req.id, client_name: req.client_name, submitted: sl.status === 'exported' });
    out.set(e.candidate_id, list);
  }
  return out;
}

export interface PoolEntry {
  v: CandidateView;
  fit: RequestFit;
  /** Other active requests this candidate is on. Never this one. */
  committed: Commitment[];
}

export interface RequestPool {
  /** Ready and a full fit: what "Ready now" counts. */
  ready: PoolEntry[];
  /** Ready but missing a requirement. Shown, never counted. */
  ready_partial: PoolEntry[];
  one_call_away: PoolEntry[];
  one_call_away_partial: PoolEntry[];
  /** Raw candidates in the role: sourced, not yet assessed. */
  raw: number;
  /** Fit and Ready, and on no other active request. */
  uncommitted: number;
}

/** Fit first, then fewest missing requirements, then best score. */
export function compareByFit(a: PoolEntry, b: PoolEntry): number {
  if (a.fit.fits !== b.fit.fits) return a.fit.fits ? -1 : 1;
  const ma = a.fit.missing_skills.length + a.fit.missing_shifts.length;
  const mb = b.fit.missing_skills.length + b.fit.missing_shifts.length;
  if (ma !== mb) return ma - mb;
  return compareByOverall(a.v, b.v);
}

/**
 * Mirrors: request_pool() (0007). The one definition of who counts toward a
 * request, used by the request list and page, the shortlist builder, the
 * dashboard and the New request email.
 */
export function requestPool(
  req: ClientRequest,
  views: CandidateView[],
  commitments: Map<string, Commitment[]>,
  now: Date,
): RequestPool {
  const pool = views.filter((v) => v.archetype_id === req.archetype_id);
  const entry = (v: CandidateView): PoolEntry => ({
    v,
    fit: requestFit(req, v),
    committed: (commitments.get(v.id) ?? []).filter((c) => c.request_id !== req.id),
  });
  const ready = pool.filter((v) => v.layer === 'ready').map(entry).sort(compareByFit);
  const away = pool.filter((v) => isOneCallAway(v, now)).map(entry).sort(compareByFit);
  const fits = ready.filter((e) => e.fit.fits);
  return {
    ready: fits,
    ready_partial: ready.filter((e) => !e.fit.fits),
    one_call_away: away.filter((e) => e.fit.fits),
    one_call_away_partial: away.filter((e) => !e.fit.fits),
    raw: pool.filter((v) => v.layer === 'raw').length,
    uncommitted: fits.filter((e) => e.committed.length === 0).length,
  };
}

/**
 * Warnings on a shortlisted candidate that do not block the export but that
 * an account manager must see before promising anything: the confirmation
 * runs out before the client's deadline, the last call went unanswered, or
 * the assessment is due for a refresh.
 */
export function shortlistWarnings(
  v: CandidateView,
  req: Pick<ClientRequest, 'required_by'>,
  last: CallLog | null,
): string[] {
  const out: string[] = [];
  if (v.reassess_due) out.push(`Assessed over ${ASSESSMENT_STALE_DAYS} days ago. Re-assess before relying on it.`);
  if (v.expires_at && req.required_by && dateKey(v.expires_at) < req.required_by) {
    out.push(`Availability confirmation runs out on ${formatDate(v.expires_at)}, before the ${formatDate(req.required_by)} deadline.`);
  }
  if (last?.outcome === 'no_answer') out.push('Last call went unanswered.');
  return out;
}

// ------------------------------------------------------ request lifecycle ----

export const REQUEST_QUANTITY_MAX = 100;
export const CLIENT_NAME_MAX = 120;
export const REQUEST_NOTES_MAX = 1000;
export const REQUEST_TITLE_MAX = 120;
export const PIPELINE_NOTE_MAX = 500;

/** What a request is called on screen and on its shortlist. */
export function requestLabel(
  req: Pick<ClientRequest, 'title'>,
  archetype?: Pick<Archetype, 'name'> | null,
): string {
  return req.title?.trim() || archetype?.name || 'Request';
}

export const PIPELINE_STAGES: PipelineStage[] = ['considering', 'screening', 'dropped'];
export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  considering: 'Considering',
  screening: 'Screening',
  dropped: 'Dropped',
};

export type RequestField = 'client_name' | 'title' | 'archetype_id' | 'quantity' | 'required_by' | 'notes' | 'form';
export type RequestErrors = Partial<Record<RequestField, string>>;

/** Mirrors: the checks on client_requests (0007). The deadline cannot be in the past. */
export function validateRequest(
  input: Pick<ClientRequest, 'client_name' | 'archetype_id' | 'quantity' | 'required_by' | 'notes'> &
    Partial<Pick<ClientRequest, 'title'>>,
  now: Date,
  opts: { creating: boolean } = { creating: true },
): RequestErrors {
  const e: RequestErrors = {};
  const name = input.client_name.trim();
  if (!name) e.client_name = 'Client name is required.';
  else if (name.length > CLIENT_NAME_MAX) e.client_name = `${CLIENT_NAME_MAX} characters at most.`;
  if ((input.title ?? '').trim().length > REQUEST_TITLE_MAX) e.title = `${REQUEST_TITLE_MAX} characters at most.`;
  if (!input.archetype_id) e.archetype_id = 'Choose a role.';
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > REQUEST_QUANTITY_MAX) {
    e.quantity = `A whole number from 1 to ${REQUEST_QUANTITY_MAX}.`;
  }
  if (input.required_by) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.required_by)) e.required_by = 'Enter a date.';
    else if (opts.creating && input.required_by < todayKey(now)) e.required_by = 'The deadline cannot be in the past.';
  }
  if ((input.notes ?? '').length > REQUEST_NOTES_MAX) e.notes = `${REQUEST_NOTES_MAX} characters at most.`;
  return e;
}

export interface RequestState {
  status: RequestStatus;
  /** People on the current draft or latest shortlist. */
  shortlisted: number;
  /** Whether any shortlist for this request has been exported. */
  exported: boolean;
}

/**
 * Mirrors: request_status_problem() (0007). Why a request cannot move to a
 * status, or null. Closing goes through closeRequest, which needs the
 * outcome, and a closed request never reopens.
 *
 *   open          nobody shortlisted yet
 *   shortlisting  at least one candidate on the shortlist
 *   submitted     a shortlist has been exported
 *   closed        only with an outcome
 */
export function requestStatusProblem(state: RequestState, next: RequestStatus): string | null {
  if (state.status === next) return null;
  if (state.status === 'closed') return 'A closed request cannot be reopened.';
  if (next === 'closed') return 'Close the request with its outcome.';
  if (next === 'open' && (state.shortlisted > 0 || state.exported)) {
    return 'Remove everyone from the shortlist first.';
  }
  if (next === 'shortlisting' && state.shortlisted === 0) return 'Add at least one candidate to the shortlist first.';
  if (next === 'submitted' && !state.exported) return 'Export the shortlist before marking it submitted.';
  return null;
}

/** The status a request should hold after its shortlist changes, if it moves at all. */
export function statusAfterShortlistChange(state: RequestState): RequestStatus {
  if (state.status === 'open' && state.shortlisted > 0) return 'shortlisting';
  if (state.status === 'shortlisting' && state.shortlisted === 0 && !state.exported) return 'open';
  return state.status;
}

export const OUTCOME_LABEL: Record<RequestOutcome, string> = {
  filled: 'Filled',
  partly_filled: 'Partly filled',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export interface CloseInput {
  outcome: RequestOutcome | null;
  placed_candidate_ids: string[];
  placed_outside: number;
}

export type CloseErrors = Partial<Record<'outcome' | 'placed' | 'form', string>>;

/**
 * Mirrors: close_request() (0007). Filled and Partly filled need at least one
 * placement, from the shortlist or from outside the bench; Lost and
 * Cancelled have none. Filled means every role was filled.
 */
export function validateClose(input: CloseInput, quantity: number, shortlistedIds: Set<string>): CloseErrors {
  const e: CloseErrors = {};
  if (!input.outcome) return { outcome: 'Choose how the request ended.' };
  const outside = input.placed_outside;
  if (!Number.isInteger(outside) || outside < 0 || outside > REQUEST_QUANTITY_MAX) {
    return { placed: `Outside placements must be a whole number from 0 to ${REQUEST_QUANTITY_MAX}.` };
  }
  if (input.placed_candidate_ids.some((id) => !shortlistedIds.has(id))) {
    return { placed: 'Only shortlisted candidates can be recorded as placed.' };
  }
  const total = input.placed_candidate_ids.length + outside;
  if (input.outcome === 'filled' || input.outcome === 'partly_filled') {
    if (total === 0) e.placed = 'Record who was placed, from the shortlist or from outside the bench.';
    else if (input.outcome === 'filled' && total < quantity) {
      e.placed = `${total} placed for ${quantity} needed. Choose Partly filled, or record the rest.`;
    } else if (input.outcome === 'partly_filled' && total >= quantity) {
      e.placed = `${total} placed for ${quantity} needed. Choose Filled.`;
    }
  } else if (total > 0) {
    e.placed = `${OUTCOME_LABEL[input.outcome]} requests have no placements.`;
  }
  return e;
}

/** "Q3 2026" for a moment, in East Africa Time. */
export function quarterOf(value: string | Date): { key: string; label: string } {
  const [y, m] = dateKey(value).split('-').map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
}

export interface BenchContribution {
  quarter: string;
  from_bench: number;
  from_outside: number;
  /** Whole percent, or null with no placements this quarter. */
  rate: number | null;
}

/**
 * Mirrors: bench_contribution (0007). Of the people placed through requests
 * closed this quarter, the share who came off the standing bench.
 */
export function benchContribution(requests: ClientRequest[], placements: Placement[], now: Date): BenchContribution {
  const { key, label } = quarterOf(now);
  const closed = requests.filter((r) => r.status === 'closed' && r.closed_at && quarterOf(r.closed_at).key === key);
  const ids = new Set(closed.map((r) => r.id));
  const from_bench = placements.filter((p) => ids.has(p.request_id)).length;
  const from_outside = closed.reduce((n, r) => n + r.placed_outside, 0);
  const total = from_bench + from_outside;
  return { quarter: label, from_bench, from_outside, rate: total ? Math.round((from_bench / total) * 100) : null };
}

/**
 * Mirrors: archive_candidate()'s recall_at CASE.
 * left_country and do_not_contact are never recalled.
 */
export function recallDateFor(reason: string, now: Date): string | null {
  const d = new Date(now);
  if (reason === 'took_other_job') {
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  }
  if (reason === 'not_interested') {
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Export eligibility. A candidate reaches a client only from Ready, and only
 * above the score floor.
 *
 * Below 3.5 is not exportable at all: the label vocabulary starts at "Good",
 * and inventing a gentler word for a weak score is how a shortlist stops
 * being believed.
 */
export const MIN_EXPORT_SCORE = 3.5;

// ------------------------------------------------------- overall score ----

/** How far an assessor may move overall away from the calculation. */
export const MAX_OVERALL_OVERRIDE = 0.5;
/** Shortest acceptable override reason. Blocks "ok" and "see notes". */
export const MIN_OVERRIDE_REASON = 10;

/**
 * Mirrors: calculate_overall_score() in 0005.
 *
 * Weighted mean over the sub-scores that exist, with the remaining weights
 * renormalised. Done in integer tenths and hundredths so the rounding is
 * exact and matches Postgres round(numeric, 1) — half away from zero — rather
 * than whatever binary floating point makes of 4.45.
 */
export function calculateOverall(
  archetype: Pick<Archetype, 'communication_weight' | 'technical_weight'>,
  communication: number | null,
  technical: number | null,
): number | null {
  const parts: [number, number][] = [];
  if (communication !== null) parts.push([toInt(archetype.communication_weight, 100), toInt(communication, 10)]);
  if (technical !== null) parts.push([toInt(archetype.technical_weight, 100), toInt(technical, 10)]);

  const total = parts.reduce((n, [w]) => n + w, 0);
  if (total === 0) return null;
  const weighted = parts.reduce((n, [w, s]) => n + w * s, 0); // in hundredths × tenths

  // round(weighted / total) to the nearest tenth, half up (all positive)
  const tenths = Math.floor((2 * weighted + total) / (2 * total));
  return tenths / 10;
}

function toInt(x: number, scale: number) {
  return Math.round(x * scale);
}

/**
 * Mirrors: the set_overall_score() trigger in 0005. Recomputes the
 * calculated value, defaults overall to it, and clears a reason that no
 * longer explains anything.
 */
export function applyOverallScore<
  T extends Pick<
    Candidate,
    'communication_score' | 'technical_score' | 'overall_score' | 'overall_score_calculated' | 'overall_override_reason'
  >,
>(candidate: T, archetype: Pick<Archetype, 'communication_weight' | 'technical_weight'>): T {
  const calculated = calculateOverall(archetype, candidate.communication_score, candidate.technical_score);
  const overall = candidate.overall_score ?? calculated;
  return {
    ...candidate,
    overall_score_calculated: calculated,
    overall_score: overall,
    overall_override_reason: overall === calculated ? null : candidate.overall_override_reason,
  };
}

/**
 * Mirrors: the overall_within_override_band and override_needs_reason
 * constraints in 0005. Null means the scores are acceptable.
 */
export function overallScoreProblem(
  c: Pick<Candidate, 'overall_score' | 'overall_score_calculated' | 'overall_override_reason'>,
): string | null {
  if (c.overall_score === null || c.overall_score_calculated === null) return null;
  const diff = Math.abs(toInt(c.overall_score, 10) - toInt(c.overall_score_calculated, 10));
  if (diff === 0) return null;
  if (diff > toInt(MAX_OVERALL_OVERRIDE, 10)) {
    return `Overall can move at most ${MAX_OVERALL_OVERRIDE.toFixed(1)} from the calculated ${c.overall_score_calculated.toFixed(1)}.`;
  }
  if ((c.overall_override_reason ?? '').trim().length < MIN_OVERRIDE_REASON) {
    return 'Explain why overall differs from the calculated score.';
  }
  return null;
}

/** An assessment older than this is flagged "Re-assess due". It still exports. */
export const ASSESSMENT_STALE_DAYS = 180;

export function isReassessDue(assessedAt: string | null, now: Date): boolean {
  if (!assessedAt) return false;
  return (daysFromToday(assessedAt, now) ?? 0) <= -ASSESSMENT_STALE_DAYS;
}

/**
 * Whether overall reflects every weighted sub-score, or communication alone
 * because the optional technical score was not given for a role that weights
 * it. Shown wherever the overall is, so a 4.6 on communication alone is
 * never read as a 4.6 on both.
 */
export function overallBasis(
  c: Pick<Candidate, 'overall_score' | 'communication_score' | 'technical_score'>,
  archetype: Pick<Archetype, 'technical_weight'>,
): 'weighted' | 'communication_only' | null {
  if (c.overall_score === null) return null;
  return c.technical_score === null && archetype.technical_weight > 0 ? 'communication_only' : 'weighted';
}

/** Best overall first; at a tie, a fully weighted score before communication only; unscored last. */
export function compareByOverall(
  a: Pick<CandidateView, 'overall_score' | 'overall_basis'>,
  b: Pick<CandidateView, 'overall_score' | 'overall_basis'>,
): number {
  const d = (b.overall_score ?? -1) - (a.overall_score ?? -1);
  if (d !== 0) return d;
  const rank = (x: typeof a) => (x.overall_basis === 'communication_only' ? 1 : 0);
  return rank(a) - rank(b);
}

/**
 * Mirrors: recalculate_overall_scores() (0007), run when a role's weights
 * change. Every stored calculation moves to the new weights; a manual
 * adjustment keeps its size and reason, clamped to the 1 to 5 scale.
 */
export function recalculateOverall<
  T extends Pick<
    Candidate,
    'communication_score' | 'technical_score' | 'overall_score' | 'overall_score_calculated' | 'overall_override_reason'
  >,
>(candidate: T, weights: Pick<Archetype, 'communication_weight' | 'technical_weight'>): T {
  const calculated = calculateOverall(weights, candidate.communication_score, candidate.technical_score);
  if (calculated === null) return { ...candidate, overall_score_calculated: null, overall_score: null, overall_override_reason: null };
  const adjustment =
    candidate.overall_score !== null && candidate.overall_score_calculated !== null
      ? toInt(candidate.overall_score, 10) - toInt(candidate.overall_score_calculated, 10)
      : 0;
  const overall = Math.min(50, Math.max(10, toInt(calculated, 10) + adjustment)) / 10;
  return {
    ...candidate,
    overall_score_calculated: calculated,
    overall_score: overall,
    overall_override_reason: overall === calculated ? null : candidate.overall_override_reason,
  };
}

/**
 * Words that belong on a call log or in notes, not in the strengths and
 * consideration a client reads: availability, notice, start dates and calls
 * made to the candidate. A warning, not a block: names, contact details and
 * salary are the blocking checks (findLeaks).
 */
const OFF_PAGE_TOPICS: [RegExp, string][] = [
  [/\bavailab(le|ility)\b|\bnotice period\b|\bstart date\b|\bcan start\b|\bfree from\b|\binterviewing\b/i, 'availability'],
  [/\b(did ?n[o']?t|never|no) (answer|pick(ed)? up|respond)|\bvoicemail\b|\bunreachable\b|\bcall(ed)? (him|her|them|back)\b/i, 'calls to the candidate'],
];

export function assessmentTextWarnings(texts: { strengths: string[]; concern: string | null }): string[] {
  const text = [...texts.strengths, texts.concern ?? ''].join(' \n ');
  return OFF_PAGE_TOPICS.filter(([re]) => re.test(text)).map(
    ([, topic]) => `Mentions ${topic}. That is confirmed on calls and belongs in notes, not on the client page.`,
  );
}

export function scoreLabel(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 4.5) return 'Excellent';
  if (score >= 4.0) return 'Strong';
  if (score >= 3.5) return 'Good';
  return null;
}

export function exportBlockReason(v: CandidateView): string | null {
  if (v.layer === 'raw') return 'Assess first.';
  if (v.layer !== 'ready') return 'Verify availability first.';
  // The PDF tells a client when someone can start. A confirmation that never
  // asked is not one it may repeat.
  if (!v.notice_period || (v.notice_period !== IMMEDIATE && !v.earliest_start_date)) {
    return 'Confirm notice period and start date on the next call.';
  }
  if (v.overall_score === null || v.overall_score < MIN_EXPORT_SCORE) {
    return 'Overall score is below the export floor.';
  }
  if (!v.concern) return 'A consideration is required before export.';
  if (v.strengths.length !== 2) return 'Two strengths are required before export.';
  return null;
}

// ---------------------------------------------------------- assessment ----

export interface AssessmentInput {
  years_experience: number | null;
  seniority: Candidate['seniority'];
  english_level: Candidate['english_level'];
  stack: string[];
  skills: string[];
  communication_score: number | null;
  technical_score: number | null;
  /** null = accept the calculated score. */
  overall_score: number | null;
  overall_override_reason: string | null;
  strengths: string[];
  concern: string | null;
  notes: string | null;
  /** Asked at assessment; each Available call re-confirms it. */
  shift_flexibility: string[];
  setup_verified: boolean;
}

export type AssessmentField = keyof AssessmentInput | 'strengths.0' | 'strengths.1';
export type AssessmentErrors = Partial<Record<AssessmentField, string>>;

/** Long enough to be specific, short enough to fit a PDF line. */
export const STRENGTH_MAX = 120;
export const CONCERN_MAX = 160;

/**
 * Mirrors the assessed_needs_* constraints in 0001 and the overall-score
 * constraints in 0005, plus two rules the database does not express: a
 * strength may not be blank, and a role weighted mostly on technical ability
 * needs a technical score, or its overall silently becomes a communication
 * score.
 */
export function validateAssessment(
  input: AssessmentInput,
  archetype: Pick<Archetype, 'communication_weight' | 'technical_weight'>,
): AssessmentErrors {
  const e: AssessmentErrors = {};
  const inRange = (x: number | null) =>
    x === null || (x >= 1 && x <= 5 && Math.abs(Math.round(x * 10) - x * 10) < 1e-9);

  if (input.years_experience === null) e.years_experience = 'Required.';
  else if (input.years_experience < 0 || input.years_experience > 60) e.years_experience = 'Between 0 and 60.';
  if (!input.seniority) e.seniority = 'Required.';
  if (!input.english_level) e.english_level = 'Required.';

  if (input.communication_score === null) e.communication_score = 'Required.';
  else if (!inRange(input.communication_score)) e.communication_score = '1.0 to 5.0.';
  if (!inRange(input.technical_score)) e.technical_score = '1.0 to 5.0.';
  else if (input.technical_score === null && archetype.technical_weight >= 0.5) {
    e.technical_score = 'Required for this role: it carries most of the overall score.';
  }

  const scored = applyOverallScore(
    {
      communication_score: input.communication_score,
      technical_score: input.technical_score,
      overall_score: input.overall_score,
      overall_score_calculated: null,
      overall_override_reason: input.overall_override_reason,
    },
    archetype,
  );
  if (!inRange(scored.overall_score)) e.overall_score = '1.0 to 5.0.';
  else {
    const problem = overallScoreProblem(scored);
    if (problem) {
      if (problem.startsWith('Explain')) e.overall_override_reason = problem;
      else e.overall_score = problem;
    }
  }

  if (input.strengths.length !== 2) e.strengths = 'Exactly two strengths.';
  for (const i of [0, 1] as const) {
    const t = (input.strengths[i] ?? '').trim();
    const key: AssessmentField = i === 0 ? 'strengths.0' : 'strengths.1';
    if (!t) e[key] = 'Required.';
    else if (t.length > STRENGTH_MAX) e[key] = STRENGTH_MAX + ' characters at most.';
  }

  const concern = (input.concern ?? '').trim();
  if (!concern) e.concern = 'Required. A shortlist where nobody has a consideration is not believed.';
  else if (concern.length > CONCERN_MAX) e.concern = CONCERN_MAX + ' characters at most.';

  return e;
}
