import type { ExportDocument } from '@/bench/export/shortlist';

/**
 * Domain types.
 *
 * These mirror supabase/migrations/0001–0004 exactly, including which fields
 * are nullable. The SQL is the target schema; this file is its TypeScript
 * shadow. If the two ever disagree, the SQL is right.
 *
 * Note what is NOT here: `layer`. It is derived on read from assessed_at,
 * availability_status and last_verified_at against the archetype's freshness
 * window — never stored, because it is only true for a while. See logic.ts.
 */

export type Role = 'exec' | 'recruiter';

export type Layer = 'ready' | 'known' | 'raw' | 'archived';

export type AvailabilityStatus = 'available' | 'not_available' | 'unknown';

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';

export type EnglishLevel = 'C2' | 'C1' | 'B2' | 'B1' | 'below';

export type CallOutcome = 'available' | 'not_available' | 'no_answer' | 'archived';

export type ArchiveReason =
  | 'took_other_job'
  | 'not_interested'
  | 'left_country'
  | 'do_not_contact'
  /** Placed with a client through a closed request. Off the bench, no recall. (0007) */
  | 'placed';

export type RequestStatus = 'open' | 'shortlisting' | 'submitted' | 'closed';

/** How a closed request ended. Required to close. (0007) */
export type RequestOutcome = 'filled' | 'partly_filled' | 'lost' | 'cancelled';

export type HealthStatus = 'green' | 'amber' | 'red';

/** Why a candidate is in the call queue. Mirrors the CASE in call_queue. */
export type QueueReason =
  | 'never_verified'
  | 'expired'
  | 'expiring_soon'
  | 'no_answer_retry'
  | 'recall_due';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  /** Which emails this person receives. (0006) */
  notify_scarcity: boolean;
  notify_decay_warning: boolean;
  notify_new_request: boolean;
  notify_weekly_summary: boolean;
  created_at: string;
}

export type NotificationKey =
  | 'notify_scarcity'
  | 'notify_decay_warning'
  | 'notify_new_request'
  | 'notify_weekly_summary';

export interface Archetype {
  id: string;
  name: string;
  code: string;
  target_ready: number;
  freshness_days: number;
  coverage_ratio: number;
  color: string;
  /** Weights for the calculated overall score. Sum to 1. (0005) */
  communication_weight: number;
  technical_weight: number;
  /** Status at the last scarcity check; alerts fire only when it worsens. (0006) */
  last_health_status: HealthStatus | null;
  /**
   * Set when an exec retires the role. Its candidates and history stay; it
   * is no longer offered for new candidates, requests or jobs, and leaves
   * bench health and the scarcity emails.
   */
  retired_at: string | null;
  created_at: string;
}

export type CandidateSource = 'manual' | 'careers';

export interface Candidate {
  id: string;
  ref_code: string;
  archetype_id: string;

  // identity — internal only, never exported
  full_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  linkedin_url: string | null;

  // assessment — permanent, does not expire
  years_experience: number | null;
  seniority: Seniority | null;
  stack: string[];
  skills: string[];
  english_level: EnglishLevel | null;
  communication_score: number | null;
  technical_score: number | null;
  /** Defaults to overall_score_calculated; may differ by at most 0.5, with a reason. */
  overall_score: number | null;
  /** Weighted mean of the sub-scores. Set by the database, never by a client. (0005) */
  overall_score_calculated: number | null;
  /** Why the assessor moved overall away from the calculation. Internal only. */
  overall_override_reason: string | null;
  assessed_by: string | null;
  assessed_at: string | null;
  strengths: string[];
  concern: string | null;
  notes: string | null;
  cv_url: string | null;

  // availability — perishable
  availability_status: AvailabilityStatus;
  earliest_start_date: string | null;
  notice_period: string | null;
  last_verified_at: string | null;
  shift_flexibility: string[];
  setup_verified: boolean;

  // lifecycle
  owner_id: string | null;
  /** Added by a recruiter, or moved from the careers page. */
  source: CandidateSource;
  /** The careers application this person was moved from. One bench record per application. */
  applied_job_id: string | null;
  archived_reason: ArchiveReason | null;
  recall_at: string | null;
  /**
   * The expires_at the hourly check last warned the owner about, so each
   * confirmation's leaving-Ready warning is sent once. (0007)
   */
  ready_exit_alerted_for: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  candidate_id: string;
  called_by: string | null;
  outcome: CallOutcome;
  note: string | null;
  called_at: string;
  /**
   * What an Available call confirmed. Recorded on the call itself, so the
   * record can show exactly what was asked and when, and so an export can
   * refuse a confirmation that never covered notice or start. (0007)
   */
  notice_period: string | null;
  earliest_start_date: string | null;
  shift_flexibility: string[] | null;
  /** Not available: the date to call again. (0007) */
  recall_at: string | null;
}

/** The outcomes a recruiter can log on a call. Archiving is not a call. */
export type CallAttempt = 'available' | 'not_available' | 'no_answer';

/** What a call records beyond its outcome. */
export interface CallDetails {
  note?: string | null;
  notice_period?: string | null;
  earliest_start_date?: string | null;
  shift_flexibility?: string[];
  recall_at?: string | null;
  /**
   * Work setup checked on an Available call. Assessment data, so it is
   * written to the record, not kept on the call; undo restores it with the rest.
   */
  setup_verified?: boolean;
}

export type CallDetailField = keyof CallDetails | 'form';
export type CallErrors = Partial<Record<CallDetailField, string>>;

/**
 * Whether a candidate needs a call, and why. One rule, used by the queue,
 * the candidate record and every "call now" button.
 */
export type CallDueState =
  | { kind: 'due'; reason: QueueReason; priority: 1 | 2 | 3 | 4 }
  /** Unanswered recently: back in Retry at `until`. Never dropped. */
  | { kind: 'cooldown'; until: string }
  /** Nothing to do yet. `next_due_at` is null when no call is ever due. */
  | { kind: 'not_due'; next_due_at: string | null; why: 'fresh' | 'recall_scheduled' | 'raw' | 'archived' };

export interface ClientRequest {
  id: string;
  client_name: string;
  /**
   * The position as the client names it ('Senior Full Stack, React + Node').
   * Tells apart requests for the same role. Null: the role's name stands in.
   */
  title: string | null;
  archetype_id: string;
  quantity: number;
  required_by: string | null;
  status: RequestStatus;
  /**
   * What a candidate must have to count toward this request: every listed
   * skill or tool (matched against stack and skills) and every listed shift.
   * Empty means no requirement. English level and seniority are not criteria
   * yet. (0007)
   */
  required_skills: string[];
  required_shifts: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  /** Set together, only when the request is closed. (0007) */
  outcome: RequestOutcome | null;
  closed_at: string | null;
  /** Roles filled by people sourced outside the bench. */
  placed_outside: number;
}

/** A shortlisted candidate placed with the client when a request closed. (0007) */
export interface Placement {
  id: string;
  request_id: string;
  candidate_id: string;
  placed_at: string;
}

export interface Shortlist {
  id: string;
  request_id: string;
  title: string;
  status: 'draft' | 'exported';
  exported_at: string | null;
  exported_by: string | null;
  pdf_url: string | null;
  /**
   * Exactly what was sent, frozen at export. "Download again" renders this,
   * never the candidates' current records. (0007)
   */
  exported_document: ExportDocument | null;
}

export interface ShortlistCandidate {
  id: string;
  shortlist_id: string;
  candidate_id: string;
  verified_at: string;
  position: number;
}

/**
 * Where a candidate stands on a request's pipeline. Whether they are on the
 * client shortlist is not a stage: it is read from the shortlist itself, so
 * there is one truth for what the client was sent.
 */
export type PipelineStage = 'considering' | 'screening' | 'dropped';

/**
 * A candidate attached to a request while they are considered. Anyone on
 * the bench can be here, of any role and any layer; the shortlist and its
 * export checks decide who goes to the client.
 */
export interface RequestCandidate {
  id: string;
  request_id: string;
  candidate_id: string;
  stage: PipelineStage;
  note: string | null;
  added_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- reads ----
// The shapes the views return. Screens consume these, not raw rows.

/** candidates_view: a candidate with its derived state resolved. */
export interface CandidateView extends Candidate {
  archetype_code: string;
  archetype_name: string;
  archetype_color: string;
  freshness_days: number;
  expires_at: string | null;
  days_until_expiry: number | null;
  layer: Layer;
  /**
   * How overall was reached: from every weighted sub-score, or from
   * communication alone because the optional technical score is missing.
   * null when not scored.
   */
  overall_basis: 'weighted' | 'communication_only' | null;
  /** Assessed more than ASSESSMENT_STALE_DAYS ago. Flagged, never blocked. */
  reassess_due: boolean;
}

/** bench_health, one row per archetype. */
export interface BenchHealth {
  archetype_id: string;
  code: string;
  name: string;
  color: string;
  target_ready: number;
  freshness_days: number;
  ready_count: number;
  known_count: number;
  raw_count: number;
  archived_count: number;
  /** Assessed people who would be Ready if one call went well. */
  one_call_away: number;
  expiring_this_week: number;
  coverage: number;
  status: HealthStatus;
}

/** call_queue, already prioritised and sorted. */
export interface QueueItem {
  id: string;
  ref_code: string;
  full_name: string | null;
  phone: string | null;
  owner_id: string | null;
  owner_name: string | null;
  archetype_id: string;
  archetype_code: string;
  archetype_name: string;
  archetype_color: string;
  layer: Layer;
  availability_status: AvailabilityStatus;
  last_verified_at: string | null;
  expires_at: string | null;
  days_until_expiry: number | null;
  recall_at: string | null;
  /** Last known shifts, to prefill the Available confirm step. */
  shift_flexibility: string[];
  /** Prefills the work-setup check on the same step. */
  setup_verified: boolean;
  last_outcome: CallOutcome | null;
  last_called_at: string | null;
  priority: 1 | 2 | 3 | 4;
  reason: QueueReason;
  /**
   * Set while an unanswered call is cooling down. The candidate stays in the
   * queue, shown as waiting, and moves to Retry once this passes.
   */
  retry_at: string | null;
}

/** activity_feed. */
export interface ActivityItem {
  id: string;
  at: string;
  kind: 'call' | 'assessment' | 'export';
  outcome: CallOutcome | null;
  note: string | null;
  candidate_id: string | null;
  ref_code: string | null;
  full_name: string | null;
  actor_name: string | null;
}

/** call_stats(). */
export interface CallStats {
  calls_today: number;
  streak_days: number;
}

export type JobName = 'scarcity_check' | 'decay_warning' | 'weekly_summary';

/** One email a job would send. Summary only: bodies are rendered on demand. */
export interface JobEmail {
  to_user_id: string;
  to_name: string;
  to_email: string;
  subject: string;
  summary: string;
}

/** job_runs. (0006) */
export interface JobRun {
  id: string;
  job: JobName;
  /** null when the schedule ran it. */
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
  emails_prepared: number;
  detail: JobEmail[];
  error: string | null;
  /** Set when a run prepared nothing because this slot already went out. */
  skipped_reason: string | null;
}

/** Which clients have already seen a candidate, so nobody resubmits. */
export interface SeenByClient {
  client_name: string;
  request_id: string;
  exported_at: string | null;
}
