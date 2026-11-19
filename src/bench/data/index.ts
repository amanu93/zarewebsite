'use client';

/**
 * THE data layer. Every screen imports from here and from nowhere else.
 *
 * The whole point of this module is that it is the only thing that changes
 * when Postgres arrives. Today each function reads or mutates an in-memory
 * snapshot; tomorrow the same function issues a query. The signatures, the
 * shapes and the business rules stay exactly as they are.
 *
 * Two conventions make that swap survivable:
 *
 *   reads   are hooks (useCandidates, useBenchHealth, ...) so components
 *           re-render when the demo mutates. Against Postgres they become
 *           server-fetched props or a query client — the return TYPES do not
 *           move, so the components consuming them do not either.
 *   writes  are async functions returning promises, already shaped like
 *           network calls, so no call site learns it is talking to memory.
 *
 * Business rules are NOT implemented here. They live in logic.ts, transcribed
 * from the SQL, so there is exactly one definition of "Ready" in the codebase.
 */

import { useCallback, useSyncExternalStore } from 'react';

import {
  applyOverallScore,
  applyCall,
  buildCallQueue,
  callDueState,
  CALL_NOTE_MAX,
  benchContribution,
  canManageRequestsRole,
  commitmentsByCandidate,
  FRESHNESS_MAX_DAYS,
  FRESHNESS_MIN_DAYS,
  isExec,
  READY_TARGET_MAX,
  roleIdentityProblem,
  findDuplicates,
  normalizePhone,
  validateContact,
  type ContactErrors,
  type ContactInput,
  type DuplicateMatches,
  recalculateOverall,
  lastAttempt,
  requestStatusProblem,
  statusAfterShortlistChange,
  validateClose,
  validateRequest,
  type BenchContribution,
  type CloseErrors,
  type CloseInput,
  type RequestErrors,
  type RequestState,
  normalizeTag,
  PIPELINE_NOTE_MAX,
  requestFit,
  requestLabel,
  requestPool,
  SHIFT_OPTIONS,
  shortlistWarnings,
  type Commitment,
  type RequestFit,
  type RequestPool,
  computeBenchHealth,
  IMMEDIATE,
  computeCallStats,
  exportBlockReason,
  overallScoreProblem,
  recallDateFor,
  toCandidateView,
  validateAssessment,
  validateCallDetails,
  type AssessmentErrors,
  type AssessmentInput,
} from './logic';
import {
  getSnapshot,
  hydrateFromApi,
  isHydrated,
  mutate,
  newId,
  resetDemo,
  subscribe,
  type Snapshot,
} from './store';
import {
  API_MODE,
  clearToken as clearApiToken,
  ensureBenchUser,
  setToken as setApiToken,
  signInApi,
} from './api';
import { WEEK_MS } from '@/bench/dates';
import { DEMO_MODE } from '@/bench/demo';
import { buildShortlistExport, findLeaks, type ExportDocument } from '@/bench/export/shortlist';
import {
  buildDecayWarnings,
  nextRun,
  buildNewRequestAlerts,
  buildScarcityAlerts,
  buildWeeklyStats,
  buildWeeklySummaries,
  decayEmails,
  scarcityEmails,
  weeklyEmails,
  type DecayWarning,
  type ScarcityAlert,
  type ScarcityTransition,
  type WeeklySummary,
} from '@/bench/jobs';
import type { NewRequestAlert } from '@/bench/emails';
import type {
  ActivityItem,
  Archetype,
  ArchiveReason,
  BenchHealth,
  CallAttempt,
  CallDetails,
  CallDueState,
  CallErrors,
  CallLog,
  CallStats,
  Candidate,
  CandidateView,
  ClientRequest,
  JobName,
  JobRun,
  Layer,
  NotificationKey,
  Placement,
  RequestStatus,
  PipelineStage,
  QueueItem,
  RequestCandidate,
  Role,
  SeenByClient,
  Shortlist,
  ShortlistCandidate,
  User,
} from './types';

export * from './types';
export {
  CONCERN_MAX,
  STRENGTH_MAX,
  validateAssessment,
  type AssessmentErrors,
  type AssessmentField,
  type AssessmentInput,
  ASSESSMENT_STALE_DAYS,
  assessmentTextWarnings,
  FRESHNESS_MAX_DAYS,
  FRESHNESS_MIN_DAYS,
  isExec,
  PIPELINE_NOTE_MAX,
  PIPELINE_STAGE_LABEL,
  PIPELINE_STAGES,
  queueStartsOnMine,
  REQUEST_TITLE_MAX,
  requestLabel,
  roleIdentityProblem,
  ROLE_NAME_MAX,
  ROLE_LABEL,
  ROLES,
  READY_TARGET_MAX,
  isOneCallAway,
  normalizePhone,
  PHONE_ERROR,
  validateCallDetails,
  validateContact,
  type ContactErrors,
  type ContactInput,
  type DuplicateMatches,
  calculateOverall,
  CALL_NOTE_MAX,
  CLIENT_NAME_MAX,
  compareByOverall,
  OUTCOME_LABEL,
  REQUEST_QUANTITY_MAX,
  type BenchContribution,
  type CloseErrors,
  type CloseInput,
  type RequestErrors,
  normalizeTag,
  requestFit,
  type Commitment,
  type PoolEntry,
  type RequestFit,
  type RequestPool,
  defaultRecallDate,
  exportBlockReason,
  IMMEDIATE,
  NO_ANSWER_COOLDOWN_HOURS,
  NOT_AVAILABLE_RECALL_DAYS,
  NOTICE_OPTIONS,
  SHIFT_OPTIONS,
  overallScoreProblem,
  scoreLabel,
  MAX_OVERALL_OVERRIDE,
  MIN_EXPORT_SCORE,
  MIN_OVERRIDE_REASON,
} from './logic';
export { resetDemo };
export { API_MODE } from './api';

/**
 * False until the snapshot has loaded from the API. Always true in demo
 * mode. The shell holds its loading state on this, so screens never see a
 * half-empty bench.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isHydrated, () => !API_MODE);
}
// Job metadata and schedules are pure; re-exported so screens keep a single
// import path.
export { JOBS, nextRun, type JobMeta } from '@/bench/jobs';
export { DEMO_MODE } from '@/bench/demo';

// ------------------------------------------------------------ plumbing ----

function useStore<T>(select: (s: Snapshot) => T): T {
  // getSnapshot must return a referentially stable value between mutations,
  // so selectors that build arrays are memoised by the mutation counter via
  // the store's subscribe/notify cycle rather than by identity.
  const subscribeFn = useCallback((cb: () => void) => subscribe(cb), []);
  return useSyncExternalStore(
    subscribeFn,
    () => select(getSnapshot()),
    () => select(getSnapshot()),
  );
}

/** Cache keyed on the snapshot object so each derived list builds once. */
const derivedCache = new WeakMap<Snapshot, Map<string, unknown>>();

function derive<T>(s: Snapshot, key: string, build: () => T): T {
  let bucket = derivedCache.get(s);
  if (!bucket) {
    bucket = new Map();
    derivedCache.set(s, bucket);
  }
  if (!bucket.has(key)) bucket.set(key, build());
  return bucket.get(key) as T;
}

/**
 * Derived values must be recomputed after every mutation, but the WeakMap is
 * keyed on the snapshot OBJECT, which mutates in place. A version counter
 * gives each mutation a distinct cache key.
 */
let version = 0;

/**
 * A selector handed to useSyncExternalStore must return the SAME reference
 * until the store changes, or React re-renders forever. Anything that builds
 * a new array goes through derive(); "nothing found" returns this constant.
 */
const EMPTY: never[] = [];
subscribe(() => {
  version += 1;
});

function views(s: Snapshot): CandidateView[] {
  return derive(s, `views:${version}`, () => {
    const now = new Date();
    const byId = new Map(s.archetypes.map((a) => [a.id, a]));
    return s.candidates
      .filter((c) => c.deleted_at === null) // candidates_view: where deleted_at is null
      .map((c) => toCandidateView(c, byId.get(c.archetype_id)!, now));
  });
}

function callsByCandidate(s: Snapshot): Map<string, CallLog[]> {
  return derive(s, `calls:${version}`, () => {
    const map = new Map<string, CallLog[]>();
    for (const c of s.calls) {
      const list = map.get(c.candidate_id) ?? [];
      list.push(c);
      map.set(c.candidate_id, list);
    }
    // Descending, so [0] is always the most recent call.
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
    }
    return map;
  });
}

/** Who may do what. Enforced in the writes below, not just hidden in the UI. */
function actor(s: Snapshot): User | undefined {
  return s.users.find((u) => u.id === s.currentUserId);
}

/** Changing a request's status, closing it and exporting are account work. */
function canManageRequests(s: Snapshot): boolean {
  return canManageRequestsRole(actor(s)?.role);
}

const MANAGE_REQUESTS_DENIED = 'Sign in as a recruiter or an exec to do that.';

function requestState(s: Snapshot, requestId: string): RequestState | null {
  const req = s.requests.find((r) => r.id === requestId);
  if (!req) return null;
  const lists = s.shortlists.filter((sl) => sl.request_id === requestId);
  const current = lists.find((sl) => sl.status === 'draft') ?? lists[lists.length - 1];
  return {
    status: req.status,
    shortlisted: current ? s.shortlistCandidates.filter((sc) => sc.shortlist_id === current.id).length : 0,
    exported: lists.some((sl) => sl.status === 'exported'),
  };
}

/** Takes a candidate off every unsent shortlist, keeping request status in step. */
function removeFromDrafts(draft: Snapshot, candidateId: string) {
  const drafts = new Map(draft.shortlists.filter((sl) => sl.status === 'draft').map((sl) => [sl.id, sl]));
  const touched = new Set<string>();
  draft.shortlistCandidates = draft.shortlistCandidates.filter((sc) => {
    const sl = drafts.get(sc.shortlist_id);
    if (!sl || sc.candidate_id !== candidateId) return true;
    touched.add(sl.request_id);
    return false;
  });
  for (const requestId of touched) {
    const req = draft.requests.find((r) => r.id === requestId);
    if (req && req.status !== 'closed') syncRequestStatus(draft, requestId);
  }
}

/** After a shortlist changes, move open <-> shortlisting to match it. */
function syncRequestStatus(draft: Snapshot, requestId: string) {
  const state = requestState(draft, requestId);
  const req = draft.requests.find((r) => r.id === requestId);
  if (state && req) req.status = statusAfterShortlistChange(state);
}

function requestOfShortlist(s: Snapshot, shortlistId: string): ClientRequest | null {
  const sl = s.shortlists.find((x) => x.id === shortlistId);
  return sl ? (s.requests.find((r) => r.id === sl.request_id) ?? null) : null;
}

/**
 * Every write goes through here. Mirrors RLS on every table: nothing is
 * written without a signed-in session. The screens never offer a write to
 * a signed-out visitor; this is the rule underneath, not a UI nicety.
 */
function write(fn: (s: Snapshot) => void): void {
  if (!getSnapshot().signedIn) throw new Error('Sign in to make changes.');
  mutate(fn);
}

// --------------------------------------------------------------- reads ----

export function useCurrentUser(): User {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0]);
}

export function useUsers(): User[] {
  return useStore((s) => s.users);
}

export function useArchetypes() {
  return useStore((s) => s.archetypes);
}

/** Roles still in use. Retired roles stay in useArchetypes for their history. */
const activeArchetypes = (s: Snapshot) => s.archetypes.filter((a) => !a.retired_at);

/** Roles that can take new candidates, requests and jobs. */
export function useActiveArchetypes(): Archetype[] {
  return useStore((s) => derive(s, `active-archetypes:${version}`, () => activeArchetypes(s)));
}

export interface CandidateFilter {
  archetypeId?: string;
  layers?: Layer[];
  search?: string;
  stack?: string[];
  englishLevel?: string[];
  seniority?: string[];
  ownerId?: string;
  minScore?: number;
  includeArchived?: boolean;
}

export function useCandidates(filter: CandidateFilter = {}): CandidateView[] {
  const key = JSON.stringify(filter);
  return useStore((s) =>
    derive(s, `filtered:${version}:${key}`, () => {
      let list = views(s);

      // Archived are excluded from search unless explicitly asked for. The
      // anonymised do_not_contact records are already gone, permanently.
      if (!filter.includeArchived) list = list.filter((v) => v.layer !== 'archived');
      if (filter.archetypeId) list = list.filter((v) => v.archetype_id === filter.archetypeId);
      if (filter.layers?.length) list = list.filter((v) => filter.layers!.includes(v.layer));
      if (filter.ownerId) list = list.filter((v) => v.owner_id === filter.ownerId);
      if (filter.minScore !== undefined) {
        list = list.filter((v) => (v.overall_score ?? 0) >= filter.minScore!);
      }
      if (filter.englishLevel?.length) {
        list = list.filter((v) => v.english_level && filter.englishLevel!.includes(v.english_level));
      }
      if (filter.seniority?.length) {
        list = list.filter((v) => v.seniority && filter.seniority!.includes(v.seniority));
      }
      if (filter.stack?.length) {
        // Stack and tools together, compared the way tags match everywhere.
        const wanted = filter.stack.map(normalizeTag);
        list = list.filter((v) => {
          const has = new Set([...v.stack, ...v.skills].map(normalizeTag));
          return wanted.every((t) => has.has(t));
        });
      }
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        const tag = normalizeTag(q);
        list = list.filter(
          (v) =>
            (v.full_name ?? '').toLowerCase().includes(q) ||
            v.ref_code.toLowerCase().includes(q) ||
            (tag.length > 0 && [...v.skills, ...v.stack].some((t) => normalizeTag(t).includes(tag))),
        );
      }
      return list;
    }),
  );
}

/** Candidates moved from the careers page, keyed by the application they came from. */
export function useBenchByApplication(): Map<string, CandidateView> {
  return useStore((s) =>
    derive(s, `by-application:${version}`, () =>
      new Map(views(s).flatMap((v) => (v.applied_job_id ? [[v.applied_job_id, v] as const] : []))),
    ),
  );
}

export function useCandidate(id: string): CandidateView | null {
  return useStore((s) => views(s).find((v) => v.id === id) ?? null);
}

export function useBenchHealth(): BenchHealth[] {
  return useStore((s) =>
    derive(s, `health:${version}`, () =>
      activeArchetypes(s).map((a) => computeBenchHealth(a, views(s), new Date())),
    ),
  );
}

export function useCallQueue(archetypeId?: string): QueueItem[] {
  return useStore((s) =>
    derive(s, `queue:${version}:${archetypeId ?? 'all'}`, () => {
      const usersById = new Map(s.users.map((u) => [u.id, u]));
      const q = buildCallQueue(views(s), callsByCandidate(s), usersById, new Date());
      return archetypeId ? q.filter((i) => i.archetype_id === archetypeId) : q;
    }),
  );
}

export function useCallStats(): CallStats {
  return useStore((s) =>
    derive(s, `stats:${version}`, () =>
      computeCallStats(s.calls, s.currentUserId, new Date()),
    ),
  );
}

export function useCandidateCalls(candidateId: string): CallLog[] {
  return useStore((s) => callsByCandidate(s).get(candidateId) ?? EMPTY);
}

/** Whether this candidate needs a call now, by the same rule as the queue. */
export function useCallDueState(candidateId: string): CallDueState | null {
  return useStore((s) =>
    derive(s, `due:${version}:${candidateId}`, () => {
      const v = views(s).find((x) => x.id === candidateId);
      return v ? callDueState(v, callsByCandidate(s).get(candidateId) ?? EMPTY, new Date()) : null;
    }),
  );
}

export function useActivity(limit = 20): ActivityItem[] {
  return useStore((s) =>
    derive(s, `activity:${version}:${limit}`, () => {
      const byId = new Map(s.candidates.map((c) => [c.id, c]));
      const usersById = new Map(s.users.map((u) => [u.id, u]));
      return [...s.calls]
        .sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())
        .slice(0, limit)
        .map<ActivityItem>((c) => {
          const cand = byId.get(c.candidate_id);
          return {
            id: c.id,
            at: c.called_at,
            kind: 'call',
            outcome: c.outcome,
            note: c.note,
            candidate_id: c.candidate_id,
            ref_code: cand?.ref_code ?? null,
            // Anonymised records contribute a ref code and nothing else.
            full_name: cand?.deleted_at ? null : (cand?.full_name ?? null),
            actor_name: c.called_by ? (usersById.get(c.called_by)?.full_name ?? null) : null,
          };
        });
    }),
  );
}

export function useRequests(status?: string): ClientRequest[] {
  return useStore((s) =>
    status
      ? derive(s, `requests:${version}:${status}`, () =>
          s.requests.filter((r) => r.status === status),
        )
      : s.requests,
  );
}

export function useRequest(id: string): ClientRequest | null {
  return useStore((s) => s.requests.find((r) => r.id === id) ?? null);
}

export function useShortlistsForRequest(requestId: string): Shortlist[] {
  return useStore((s) =>
    derive(s, `shortlists:${version}:${requestId}`, () =>
      s.shortlists.filter((sl) => sl.request_id === requestId),
    ),
  );
}

export function useShortlist(id: string): Shortlist | null {
  return useStore((s) => s.shortlists.find((sl) => sl.id === id) ?? null);
}

export function useShortlistCandidates(shortlistId: string): {
  entry: ShortlistCandidate;
  candidate: CandidateView;
}[] {
  return useStore((s) =>
    derive(s, `slc:${version}:${shortlistId}`, () => {
      const byId = new Map(views(s).map((v) => [v.id, v]));
      return s.shortlistCandidates
        .filter((sc) => sc.shortlist_id === shortlistId)
        .sort((a, b) => a.position - b.position)
        .flatMap((entry) => {
          const candidate = byId.get(entry.candidate_id);
          return candidate ? [{ entry, candidate }] : [];
        });
    }),
  );
}

/**
 * Which clients have already seen this candidate. Reuse is unlimited across
 * clients; this exists so nobody submits the same person to the same client
 * twice.
 */
export function useSeenByClients(candidateId: string): SeenByClient[] {
  return useStore((s) =>
    derive(s, `seen:${version}:${candidateId}`, () =>
      s.shortlistCandidates
        .filter((sc) => sc.candidate_id === candidateId)
        .flatMap((sc) => {
          const sl = s.shortlists.find((x) => x.id === sc.shortlist_id);
          const req = sl ? s.requests.find((r) => r.id === sl.request_id) : null;
          return req
            ? [{ client_name: req.client_name, request_id: req.id, exported_at: sl!.exported_at }]
            : [];
        }),
    ),
  );
}

function commitments(s: Snapshot): Map<string, Commitment[]> {
  return derive(s, `commit:${version}`, () =>
    commitmentsByCandidate(s.requests, s.shortlists, s.shortlistCandidates),
  );
}

function poolFor(s: Snapshot, req: ClientRequest): RequestPool {
  return derive(s, `pool:${version}:${req.id}`, () => requestPool(req, views(s), commitments(s), new Date()));
}

export interface RequestSummary extends ClientRequest {
  archetype_code: string;
  archetype_name: string;
  archetype_color: string;
  /** Ready and meeting every requirement. Computed on read, never stored. */
  matches: number;
  /** Meeting every requirement, and one good call from Ready. */
  one_call_away: number;
  /** Of `matches`, how many are on no other active request. */
  uncommitted: number;
  /** The shortlist being worked on, or the last one sent. */
  shortlist: { id: string; status: Shortlist['status']; count: number; exported_at: string | null } | null;
}

/** Every request, with live match counts and its shortlist state, soonest deadline first. */
export function useRequestSummaries(): RequestSummary[] {
  return useStore((s) =>
    derive(s, `reqsum:${version}`, () =>
      s.requests
        .map<RequestSummary>((r) => {
          const pool = poolFor(s, r);
          const arch = s.archetypes.find((a) => a.id === r.archetype_id);
          const lists = s.shortlists.filter((sl) => sl.request_id === r.id);
          const current = lists.find((sl) => sl.status === 'draft') ?? lists[lists.length - 1] ?? null;
          return {
            ...r,
            archetype_code: arch?.code ?? '',
            archetype_name: arch?.name ?? '',
            archetype_color: arch?.color ?? '',
            matches: pool.ready.length,
            one_call_away: pool.one_call_away.length,
            uncommitted: pool.uncommitted,
            shortlist: current
              ? {
                  id: current.id,
                  status: current.status,
                  count: s.shortlistCandidates.filter((sc) => sc.shortlist_id === current.id).length,
                  exported_at: current.exported_at,
                }
              : null,
          };
        })
        .sort((a, b) => (a.required_by ?? '9999').localeCompare(b.required_by ?? '9999')),
    ),
  );
}

/** Open and shortlisting requests, for the dashboard and bulk actions. */
export function useRequestMatchCounts(): RequestSummary[] {
  const all = useRequestSummaries();
  return useStore((s) =>
    derive(s, `reqactive:${version}`, () =>
      all.filter((r) => r.status === 'open' || r.status === 'shortlisting'),
    ),
  );
}

export function useRequestSummary(id: string): RequestSummary | null {
  const all = useRequestSummaries();
  return all.find((r) => r.id === id) ?? null;
}

/**
 * Who counts toward a request, who nearly does, and who is committed
 * elsewhere. One rule (requestPool) behind every screen that shows it.
 */
export function useRequestPool(requestId: string): RequestPool | null {
  return useStore((s) => {
    const req = s.requests.find((r) => r.id === requestId);
    return req ? poolFor(s, req) : null;
  });
}

/** Other active requests each candidate is on, excluding `requestId`. */
export function useCommitments(requestId: string): Map<string, Commitment[]> {
  return useStore((s) =>
    derive(s, `commitfor:${version}:${requestId}`, () => {
      const out = new Map<string, Commitment[]>();
      for (const [id, list] of commitments(s)) {
        const others = list.filter((c) => c.request_id !== requestId);
        if (others.length) out.set(id, others);
      }
      return out;
    }),
  );
}

/** Everyone who has been on any shortlist for a request, for recording placements. */
export function useRequestShortlisted(requestId: string): CandidateView[] {
  return useStore((s) =>
    derive(s, `shortlisted:${version}:${requestId}`, () => {
      const lists = new Set(s.shortlists.filter((sl) => sl.request_id === requestId).map((sl) => sl.id));
      const ids = new Set(s.shortlistCandidates.filter((sc) => lists.has(sc.shortlist_id)).map((sc) => sc.candidate_id));
      return views(s).filter((v) => ids.has(v.id));
    }),
  );
}

export function usePlacements(requestId: string): Placement[] {
  return useStore((s) =>
    derive(s, `placements:${version}:${requestId}`, () => s.placements.filter((p) => p.request_id === requestId)),
  );
}

/** This quarter's bench contribution, from closed requests. */
export function useBenchContribution(): BenchContribution {
  return useStore((s) => derive(s, `contrib:${version}`, () => benchContribution(s.requests, s.placements, new Date())));
}

/** Whether the signed-in user may change status, close and export requests. */
export function useCanManageRequests(): boolean {
  return useStore((s) => canManageRequests(s));
}

/** Why the current user cannot move a request to `status`, or null. */
export function useRequestStatusProblem(requestId: string, status: RequestStatus): string | null {
  return useStore((s) => {
    if (!canManageRequests(s)) return MANAGE_REQUESTS_DENIED;
    const state = requestState(s, requestId);
    return state ? requestStatusProblem(state, status) : 'Request not found.';
  });
}

/** Non-blocking warnings for each candidate in a request's role. */
export function useShortlistWarnings(requestId: string): Map<string, string[]> {
  return useStore((s) =>
    derive(s, `warn:${version}:${requestId}`, () => {
      const out = new Map<string, string[]>();
      const req = s.requests.find((r) => r.id === requestId);
      if (!req) return out;
      const calls = callsByCandidate(s);
      for (const v of views(s)) {
        if (v.archetype_id !== req.archetype_id) continue;
        const w = shortlistWarnings(v, req, lastAttempt(calls.get(v.id) ?? EMPTY));
        if (w.length) out.set(v.id, w);
      }
      return out;
    }),
  );
}

/**
 * Candidate ids already SENT (exported) to this client, across all of its
 * requests. Used to warn before submitting the same person twice.
 */
export function useSentToClient(clientName: string): Set<string> {
  return useStore((s) =>
    derive(s, `sent:${version}:${clientName}`, () => {
      const reqIds = new Set(
        s.requests.filter((r) => r.client_name === clientName).map((r) => r.id),
      );
      const exported = new Set(
        s.shortlists
          .filter((sl) => reqIds.has(sl.request_id) && sl.status === 'exported')
          .map((sl) => sl.id),
      );
      return new Set(
        s.shortlistCandidates
          .filter((sc) => exported.has(sc.shortlist_id))
          .map((sc) => sc.candidate_id),
      );
    }),
  );
}

/**
 * Records a new or edited contact would duplicate: the same phone number
 * (blocks saving) or the same name or email (a warning).
 */
export function useDuplicateCandidates(
  input: Pick<ContactInput, 'full_name' | 'phone' | 'email'>,
  excludeId?: string,
): DuplicateMatches {
  const key = JSON.stringify([normalizePhone(input.phone), input.full_name.trim().toLowerCase(), input.email.trim().toLowerCase(), excludeId]);
  return useStore((s) => derive(s, `dupes:${version}:${key}`, () => findDuplicates(input, views(s), excludeId)));
}

/** Every stack and skill tag on the bench, for suggestions. */
export function useBenchTags(archetypeId?: string): { stack: string[]; skills: string[] } {
  return useStore((s) =>
    derive(s, `tags:${version}:${archetypeId ?? 'all'}`, () => {
      const pool = views(s).filter((v) => !archetypeId || v.archetype_id === archetypeId);
      // One entry per tag as the bench matches them: "Node.js" and "NodeJS" are one.
      const sorted = (xs: string[]) => {
        const seen = new Map<string, string>();
        for (const x of xs) if (!seen.has(normalizeTag(x))) seen.set(normalizeTag(x), x);
        return [...seen.values()].sort((a, b) => a.localeCompare(b));
      };
      return {
        stack: sorted(pool.flatMap((v) => v.stack)),
        skills: sorted(pool.flatMap((v) => v.skills)),
      };
    }),
  );
}

// -------------------------------------------------------------- writes ----
// Async by design. Nothing here should look different from a network call
// once Postgres is behind it.

export type CallResult = { ok: true; callId: string } | { ok: false; errors: CallErrors };

/**
 * The longest a logged outcome stays undoable. The toast offers Undo for about
 * 5s, longer while the pointer rests on it; this is the hard stop.
 */
export const UNDO_WINDOW_MS = 60_000;
/** A second outcome on the same candidate this soon is a double click. */
const DOUBLE_SUBMIT_MS = 3_000;

/**
 * The record as it was before each recent call, so Undo restores exactly
 * that. Against Postgres this becomes undo_call(), which deletes the call and
 * restores the same columns inside one transaction.
 */
const undoable = new Map<string, { before: Candidate; userId: string; at: number }>();

const blankCall = {
  note: null,
  notice_period: null,
  earliest_start_date: null,
  shift_flexibility: null,
  recall_at: null,
} satisfies Partial<CallLog>;

/**
 * Mirrors log_call() (0007). The ONLY thing that moves last_verified_at.
 * Validates what each outcome must record, refuses Raw candidates and double
 * submits, and returns the call id so the outcome can be undone or annotated.
 */
export async function logCall(
  candidateId: string,
  outcome: CallAttempt,
  details: CallDetails = {},
): Promise<CallResult> {
  const now = new Date();
  const errors = validateCallDetails(outcome, details, now);
  if (Object.keys(errors).length) return { ok: false, errors };

  const s = getSnapshot();
  const c = s.candidates.find((x) => x.id === candidateId && x.deleted_at === null);
  if (!c) return { ok: false, errors: { form: 'This candidate no longer exists.' } };
  if (c.assessed_at === null) return { ok: false, errors: { form: 'Not exportable. Assess first.' } };

  const last = callsByCandidate(s).get(candidateId)?.[0];
  if (
    last &&
    last.called_by === s.currentUserId &&
    now.getTime() - new Date(last.called_at).getTime() < DOUBLE_SUBMIT_MS
  ) {
    return { ok: false, errors: { form: 'That call was just logged.' } };
  }

  const available = outcome === 'available';
  const call: CallLog = {
    ...blankCall,
    id: newId('call'),
    candidate_id: candidateId,
    called_by: s.currentUserId,
    outcome,
    called_at: now.toISOString(),
    note: details.note?.trim() || null,
    notice_period: available ? (details.notice_period?.trim() ?? null) : null,
    earliest_start_date:
      available && details.notice_period !== IMMEDIATE ? (details.earliest_start_date ?? null) : null,
    shift_flexibility: available ? [...(details.shift_flexibility ?? [])] : null,
    recall_at: outcome === 'not_available' ? (details.recall_at ?? null) : null,
  };

  write((draft) => {
    const i = draft.candidates.findIndex((x) => x.id === candidateId);
    if (i < 0) return;
    undoable.set(call.id, { before: draft.candidates[i], userId: draft.currentUserId, at: now.getTime() });
    draft.calls.push(call);
    draft.candidates[i] = applyCall(draft.candidates[i], call);
    if (available && details.setup_verified !== undefined) {
      draft.candidates[i] = { ...draft.candidates[i], setup_verified: details.setup_verified };
    }
  });
  return { ok: true, callId: call.id };
}

/**
 * Takes back a call or an archive logged moments ago by the same person,
 * provided nothing has been logged on that candidate since.
 */
export async function undoCall(callId: string): Promise<boolean> {
  const entry = undoable.get(callId);
  const s = getSnapshot();
  const call = s.calls.find((c) => c.id === callId);
  if (!entry || !call) return false;
  undoable.delete(callId);
  if (entry.userId !== s.currentUserId || Date.now() - entry.at > UNDO_WINDOW_MS) return false;
  if (callsByCandidate(s).get(call.candidate_id)?.[0]?.id !== callId) return false;

  write((draft) => {
    draft.calls = draft.calls.filter((c) => c.id !== callId);
    const i = draft.candidates.findIndex((x) => x.id === call.candidate_id);
    if (i >= 0) draft.candidates[i] = entry.before;
  });
  return true;
}

/** Adds or replaces the short note on your own call. */
export async function updateCallNote(callId: string, note: string): Promise<CallResult> {
  const text = note.trim();
  if (text.length > CALL_NOTE_MAX) return { ok: false, errors: { note: `${CALL_NOTE_MAX} characters at most.` } };
  const s = getSnapshot();
  const call = s.calls.find((c) => c.id === callId);
  if (!call) return { ok: false, errors: { form: 'That call no longer exists.' } };
  if (call.called_by !== s.currentUserId) return { ok: false, errors: { form: 'Only the caller can edit this note.' } };
  if (call.outcome === 'archived') return { ok: false, errors: { form: 'Archive reasons are not editable.' } };
  write((draft) => {
    const c = draft.calls.find((x) => x.id === callId);
    if (c) c.note = text || null;
  });
  return { ok: true, callId };
}

/** Mirrors archive_candidate(), including anonymisation for do_not_contact. */
export async function archiveCandidate(
  candidateId: string,
  reason: ArchiveReason,
  note?: string,
): Promise<string | null> {
  const callId = newId('call');
  let done = false;
  write((s) => {
    const now = new Date();
    const i = s.candidates.findIndex((x) => x.id === candidateId && x.deleted_at === null);
    if (i < 0) return;
    // Anonymising is final; everything else can be undone for a few seconds.
    if (reason !== 'do_not_contact') {
      undoable.set(callId, { before: structuredClone(s.candidates[i]), userId: s.currentUserId, at: now.getTime() });
    }
    done = true;
    s.calls.push({
      ...blankCall,
      id: callId,
      candidate_id: candidateId,
      called_by: s.currentUserId,
      outcome: 'archived',
      note: reason === 'do_not_contact' ? 'do_not_contact' : (note ?? reason),
      called_at: now.toISOString(),
    });

    const c = s.candidates.find((x) => x.id === candidateId);
    if (!c) return;

    // An erased candidate can no longer be seen, so leave no draft shortlist
    // holding a row nobody can remove. Sent shortlists keep their history.
    if (reason === 'do_not_contact') removeFromDrafts(s, candidateId);

    if (reason === 'do_not_contact') {
      // Strip everything that identifies or reaches the person; keep the row
      // and its ref code so shortlist history stays intact.
      //
      // NOTE: against real Postgres this must ALSO delete the CV object from
      // Storage. SQL cannot reach it, so the app layer owns that step.
      c.full_name = null;
      c.phone = null;
      c.email = null;
      c.linkedin_url = null;
      c.location = null;
      c.notes = null;
      c.cv_url = null;
      c.archived_reason = 'do_not_contact';
      c.recall_at = null;
      c.deleted_at = now.toISOString();
      c.updated_at = now.toISOString();
      return;
    }

    c.archived_reason = reason;
    c.recall_at = recallDateFor(reason, now);
    c.updated_at = now.toISOString();
  });
  return done ? callId : null;
}

export type ContactResult =
  | { ok: true; id: string }
  | { ok: false; errors: ContactErrors & { form?: string }; duplicate?: CandidateView };

/**
 * Adds a Raw candidate. Validates contact details here, whatever the form did,
 * and refuses a phone number already on the bench, linking to that record.
 * A name or email match is only a warning, so it is the form's to show.
 */
export async function createCandidate(
  input: ContactInput &
    Pick<Candidate, 'archetype_id'> &
    Partial<Pick<Candidate, 'owner_id' | 'notes' | 'source' | 'applied_job_id'>>,
): Promise<ContactResult> {
  const id = newId('cand');
  const s = getSnapshot();
  const now = new Date().toISOString();
  const archetype = s.archetypes.find((a) => a.id === input.archetype_id);
  if (!archetype) return { ok: false, errors: { form: 'Choose a role.' } };
  // Mirrors live_candidate_has_a_name (0004) and the contact checks (0007).
  const errors = validateContact(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const duplicate = findDuplicates(input, views(s)).phone[0];
  if (duplicate) return { ok: false, errors: { phone: 'This number is already on the bench.' }, duplicate };
  // Mirrors UQ_bench_candidates_appliedJobId: an application moves once.
  if (input.applied_job_id && s.candidates.some((c) => c.applied_job_id === input.applied_job_id)) {
    return { ok: false, errors: { form: 'This applicant is already on the bench.' } };
  }

  const rest = {
    archetype_id: input.archetype_id,
    full_name: input.full_name.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(input.phone),
    email: input.email.trim().toLowerCase() || null,
    location: input.location.trim() || null,
    linkedin_url: input.linkedin_url.trim() || null,
    owner_id: input.owner_id ?? s.currentUserId,
    notes: input.notes?.trim() || null,
    source: input.source ?? 'manual',
    applied_job_id: input.applied_job_id ?? null,
  };

  const candidate = applyOverallScore<Candidate>(
    {
      id,
      // Next after the highest code ever issued, so a code is never reused.
      ref_code: `ZT-${String(Math.max(0, ...s.candidates.map((c) => Number(c.ref_code.slice(3)) || 0)) + 1).padStart(4, '0')}`,
      years_experience: null,
      seniority: null,
      stack: [],
      skills: [],
      english_level: null,
      communication_score: null,
      technical_score: null,
      overall_score: null,
      overall_score_calculated: null,
      overall_override_reason: null,
      assessed_by: null,
      assessed_at: null,
      strengths: [],
      concern: null,
      cv_url: null,
      availability_status: 'unknown',
      earliest_start_date: null,
      notice_period: null,
      last_verified_at: null,
      shift_flexibility: [],
      setup_verified: false,
      archived_reason: null,
      recall_at: null,
      ready_exit_alerted_for: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      ...rest,
    } as Candidate,
    archetype,
  );

  // Mirrors the 0005 check constraints: the insert fails, nothing is written.
  const problem = overallScoreProblem(candidate);
  if (problem) throw new Error(problem);

  write((draft) => {
    draft.candidates.push(candidate);
  });
  return { ok: true, id };
}

/** Edits a candidate's identity and contact details, with the same checks as adding one. */
export async function updateContact(id: string, input: ContactInput): Promise<ContactResult> {
  const s = getSnapshot();
  const current = s.candidates.find((c) => c.id === id && c.deleted_at === null);
  if (!current) return { ok: false, errors: { form: 'This candidate no longer exists.' } };
  const errors = validateContact(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const duplicate = findDuplicates(input, views(s), id).phone[0];
  if (duplicate) return { ok: false, errors: { phone: 'This number is already on the bench.' }, duplicate };
  await updateCandidate(id, {
    full_name: input.full_name.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(input.phone),
    email: input.email.trim().toLowerCase() || null,
    location: input.location.trim() || null,
    linkedin_url: input.linkedin_url.trim() || null,
  });
  return { ok: true, id };
}

export async function updateCandidate(
  id: string,
  patch: Partial<Candidate>,
): Promise<void> {
  const s = getSnapshot();
  const current = s.candidates.find((x) => x.id === id);
  if (!current) return;

  // last_verified_at is not writable here. Mirrors the database trigger:
  // only log_call() moves it, or "verified" comes to mean "someone edited
  // a form" and the bench looks healthy while being stale. The calculated
  // overall is likewise the database's to set.
  const {
    last_verified_at: _verified,
    overall_score_calculated: _calculated,
    ...safe
  } = patch;
  void _verified;
  void _calculated;

  let next: Candidate = { ...current, ...safe, updated_at: new Date().toISOString() };

  // Mirrors the set_overall_score trigger, which fires only when scores or
  // the archetype are written. An availability edit never rescores anyone.
  const rescored = (
    ['communication_score', 'technical_score', 'overall_score', 'archetype_id'] as const
  ).some((k) => k in safe);
  if (rescored) {
    const archetype = s.archetypes.find((a) => a.id === next.archetype_id);
    if (!archetype) throw new Error('Unknown archetype.');
    next = applyOverallScore(next, archetype);
    const problem = overallScoreProblem(next);
    if (problem) throw new Error(problem);
  }

  write((draft) => {
    const i = draft.candidates.findIndex((x) => x.id === id);
    if (i >= 0) draft.candidates[i] = next;
  });
}

/**
 * Complete, or redo, an assessment. Validates exactly what the database
 * constraints would, and returns field errors rather than throwing, because
 * its caller is a form.
 */
export async function assessCandidate(
  id: string,
  input: AssessmentInput,
): Promise<{ ok: true } | { ok: false; errors: AssessmentErrors }> {
  const s = getSnapshot();
  const candidate = s.candidates.find((c) => c.id === id && c.deleted_at === null);
  if (!candidate) return { ok: false, errors: { notes: 'Candidate not found.' } };
  const archetype = s.archetypes.find((a) => a.id === candidate.archetype_id)!;

  const errors = validateAssessment(input, archetype);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const clean = (t: string | null) => (t && t.trim() ? t.trim() : null);
  try {
    await updateCandidate(id, {
      years_experience: input.years_experience,
      seniority: input.seniority,
      english_level: input.english_level,
      stack: input.stack,
      skills: input.skills,
      communication_score: input.communication_score,
      technical_score: input.technical_score,
      overall_score: input.overall_score,
      overall_override_reason: clean(input.overall_override_reason),
      strengths: input.strengths.map((t) => t.trim()),
      concern: clean(input.concern),
      notes: clean(input.notes),
      // Notice and start are confirmed on calls (log_call), never here.
      shift_flexibility: input.shift_flexibility,
      setup_verified: input.setup_verified,
      assessed_at: new Date().toISOString(),
      assessed_by: s.currentUserId,
    });
  } catch (err) {
    return { ok: false, errors: { overall_score: err instanceof Error ? err.message : String(err) } };
  }
  return { ok: true };
}

/** Trimmed, de-duplicated the way tags compare, first spelling kept. */
function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => {
      const key = normalizeTag(t);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanShifts(shifts: string[]): string[] {
  return (SHIFT_OPTIONS as readonly string[]).filter((o) => shifts.includes(o));
}

export type RequestInput = Pick<
  ClientRequest,
  'client_name' | 'archetype_id' | 'quantity' | 'required_by' | 'notes' | 'required_skills' | 'required_shifts'
> &
  Partial<Pick<ClientRequest, 'title'>>;

/** Mirrors the client_requests checks (0007): validated here, whatever the form did. */
export async function createRequest(
  input: RequestInput,
): Promise<{ ok: true; id: string } | { ok: false; errors: RequestErrors }> {
  const s = getSnapshot();
  const errors = validateRequest(input, new Date());
  if (!s.archetypes.some((a) => a.id === input.archetype_id)) errors.archetype_id = 'Choose a role.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const id = newId('req');
  write((draft) => {
    draft.requests.push({
      id,
      client_name: input.client_name.trim(),
      title: input.title?.trim() || null,
      archetype_id: input.archetype_id,
      quantity: input.quantity,
      required_by: input.required_by || null,
      notes: input.notes?.trim() || null,
      status: 'open',
      required_skills: cleanTags(input.required_skills),
      required_shifts: cleanShifts(input.required_shifts),
      created_by: draft.currentUserId,
      created_at: new Date().toISOString(),
      outcome: null,
      closed_at: null,
      placed_outside: 0,
    });
  });
  return { ok: true, id };
}

/** Edits a request's details. Closed requests are final. Status has its own writes. */
export async function updateRequest(
  id: string,
  patch: Partial<
    Pick<ClientRequest, 'quantity' | 'required_by' | 'notes' | 'client_name' | 'title' | 'required_skills' | 'required_shifts'>
  >,
): Promise<{ ok: true } | { ok: false; errors: RequestErrors }> {
  const s = getSnapshot();
  const current = s.requests.find((r) => r.id === id);
  if (!current) return { ok: false, errors: { form: 'Request not found.' } };
  if (current.status === 'closed') return { ok: false, errors: { form: 'This request is closed.' } };
  const errors = validateRequest({ ...current, ...patch }, new Date(), { creating: false });
  if (Object.keys(errors).length) return { ok: false, errors };

  write((draft) => {
    const r = draft.requests.find((x) => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    if ('title' in patch) r.title = patch.title?.trim() || null;
    if (patch.required_skills) r.required_skills = cleanTags(patch.required_skills);
    if (patch.required_shifts) r.required_shifts = cleanShifts(patch.required_shifts);
  });
  return { ok: true };
}

/**
 * Mirrors: set_request_status() (0007). Open and shortlisting follow the
 * shortlist; submitted needs an exported shortlist; closing goes through
 * closeRequest.
 */
export async function setRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = getSnapshot();
  if (!canManageRequests(s)) return { ok: false, reason: MANAGE_REQUESTS_DENIED };
  const state = requestState(s, id);
  if (!state) return { ok: false, reason: 'Request not found.' };
  const problem = requestStatusProblem(state, status);
  if (problem) return { ok: false, reason: problem };
  write((draft) => {
    const r = draft.requests.find((x) => x.id === id);
    if (r) r.status = status;
  });
  return { ok: true };
}

/**
 * Mirrors: close_request() (0007). Records how the request ended and who was
 * placed. Placed bench candidates leave the bench (archived as placed), and
 * the request's shortlists become read-only for good.
 */
export async function closeRequest(
  id: string,
  input: CloseInput,
): Promise<{ ok: true } | { ok: false; errors: CloseErrors }> {
  const s = getSnapshot();
  if (!canManageRequests(s)) return { ok: false, errors: { form: MANAGE_REQUESTS_DENIED } };
  const req = s.requests.find((r) => r.id === id);
  if (!req) return { ok: false, errors: { form: 'Request not found.' } };
  if (req.status === 'closed') return { ok: false, errors: { form: 'This request is already closed.' } };

  const lists = new Set(s.shortlists.filter((sl) => sl.request_id === id).map((sl) => sl.id));
  const shortlisted = new Set(
    s.shortlistCandidates.filter((sc) => lists.has(sc.shortlist_id)).map((sc) => sc.candidate_id),
  );
  const placedIds = [...new Set(input.placed_candidate_ids)];
  const errors = validateClose({ ...input, placed_candidate_ids: placedIds }, req.quantity, shortlisted);
  if (Object.keys(errors).length) return { ok: false, errors };

  write((draft) => {
    const now = new Date().toISOString();
    const r = draft.requests.find((x) => x.id === id)!;
    r.status = 'closed';
    r.outcome = input.outcome;
    r.closed_at = now;
    r.placed_outside = input.placed_outside;
    for (const candidateId of placedIds) {
      draft.placements.push({ id: newId('pl'), request_id: id, candidate_id: candidateId, placed_at: now });
      // Placed people come off every other request's draft.
      removeFromDrafts(draft, candidateId);
      const c = draft.candidates.find((x) => x.id === candidateId && x.deleted_at === null);
      if (!c || c.archived_reason) continue;
      c.archived_reason = 'placed';
      c.recall_at = null;
      c.updated_at = now;
      draft.calls.push({
        ...blankCall,
        id: newId('call'),
        candidate_id: candidateId,
        called_by: draft.currentUserId,
        outcome: 'archived',
        note: 'placed',
        called_at: now,
      });
    }
  });
  return { ok: true };
}

// ------------------------------------------------------------ pipeline ----

export interface PipelineEntry {
  entry: RequestCandidate;
  candidate: CandidateView;
  /** How they measure against this request's requirements. Advisory. */
  fit: RequestFit;
  /** On the draft shortlist, already sent in an exported one, or neither. */
  shortlist: 'draft' | 'sent' | null;
}

const STAGE_ORDER: Record<PipelineStage, number> = { screening: 0, considering: 1, dropped: 2 };

/** Everyone on a request's pipeline: screening first, dropped last. */
export function useRequestPipeline(requestId: string): PipelineEntry[] {
  return useStore((s) =>
    derive(s, `pipeline:${version}:${requestId}`, () => {
      const req = s.requests.find((r) => r.id === requestId);
      if (!req) return [];
      const byId = new Map(views(s).map((v) => [v.id, v]));
      const shortlists = s.shortlists.filter((sl) => sl.request_id === requestId);
      const draftIds = new Set(shortlists.filter((sl) => sl.status === 'draft').map((sl) => sl.id));
      const sentIds = new Set(shortlists.filter((sl) => sl.status === 'exported').map((sl) => sl.id));
      const on = (candidateId: string, ids: Set<string>) =>
        s.shortlistCandidates.some((sc) => sc.candidate_id === candidateId && ids.has(sc.shortlist_id));
      return s.requestCandidates
        .filter((rc) => rc.request_id === requestId)
        .flatMap((rc) => {
          const candidate = byId.get(rc.candidate_id);
          if (!candidate) return [];
          return [
            {
              entry: rc,
              candidate,
              fit: requestFit(req, candidate),
              shortlist: on(rc.candidate_id, draftIds) ? 'draft' : on(rc.candidate_id, sentIds) ? 'sent' : null,
            } satisfies PipelineEntry,
          ];
        })
        .sort(
          (a, b) =>
            STAGE_ORDER[a.entry.stage] - STAGE_ORDER[b.entry.stage] ||
            a.entry.created_at.localeCompare(b.entry.created_at),
        );
    }),
  );
}

type PipelineResult = { ok: true } | { ok: false; reason: string };

function openRequest(s: Snapshot, requestId: string): ClientRequest | string {
  const req = s.requests.find((r) => r.id === requestId);
  if (!req) return 'Request not found.';
  if (req.status === 'closed') return 'This request is closed.';
  return req;
}

/**
 * Attaches anyone on the bench to a request: a different role, not yet
 * assessed, or just added. Attaching twice is a no-op.
 */
export async function attachToRequest(
  requestId: string,
  candidateId: string,
  stage: PipelineStage = 'considering',
): Promise<PipelineResult> {
  const s = getSnapshot();
  const req = openRequest(s, requestId);
  if (typeof req === 'string') return { ok: false, reason: req };
  if (!views(s).some((v) => v.id === candidateId)) return { ok: false, reason: 'Candidate not found.' };
  if (s.requestCandidates.some((rc) => rc.request_id === requestId && rc.candidate_id === candidateId)) {
    return { ok: true };
  }
  write((draft) => {
    draft.requestCandidates.push({
      id: newId('rc'),
      request_id: requestId,
      candidate_id: candidateId,
      stage,
      note: null,
      added_by: draft.currentUserId || null,
      created_at: new Date().toISOString(),
    });
  });
  return { ok: true };
}

export async function setPipelineStage(entryId: string, stage: PipelineStage): Promise<PipelineResult> {
  const s = getSnapshot();
  const rc = s.requestCandidates.find((x) => x.id === entryId);
  if (!rc) return { ok: false, reason: 'Not on this request.' };
  const req = openRequest(s, rc.request_id);
  if (typeof req === 'string') return { ok: false, reason: req };
  write((draft) => {
    const x = draft.requestCandidates.find((y) => y.id === entryId);
    if (x) x.stage = stage;
  });
  return { ok: true };
}

export async function setPipelineNote(entryId: string, note: string): Promise<PipelineResult> {
  const s = getSnapshot();
  const rc = s.requestCandidates.find((x) => x.id === entryId);
  if (!rc) return { ok: false, reason: 'Not on this request.' };
  const req = openRequest(s, rc.request_id);
  if (typeof req === 'string') return { ok: false, reason: req };
  if (note.length > PIPELINE_NOTE_MAX) return { ok: false, reason: `${PIPELINE_NOTE_MAX} characters at most.` };
  write((draft) => {
    const x = draft.requestCandidates.find((y) => y.id === entryId);
    if (x) x.note = note.trim() || null;
  });
  return { ok: true };
}

/** Takes someone off a request's pipeline. Not while they are on its draft shortlist. */
export async function removeFromPipeline(entryId: string): Promise<PipelineResult> {
  const s = getSnapshot();
  const rc = s.requestCandidates.find((x) => x.id === entryId);
  if (!rc) return { ok: true };
  const req = openRequest(s, rc.request_id);
  if (typeof req === 'string') return { ok: false, reason: req };
  const drafts = new Set(
    s.shortlists.filter((sl) => sl.request_id === rc.request_id && sl.status === 'draft').map((sl) => sl.id),
  );
  if (s.shortlistCandidates.some((sc) => sc.candidate_id === rc.candidate_id && drafts.has(sc.shortlist_id))) {
    return { ok: false, reason: 'Take them off the shortlist first.' };
  }
  write((draft) => {
    draft.requestCandidates = draft.requestCandidates.filter((x) => x.id !== entryId);
  });
  return { ok: true };
}

/**
 * Puts a pipeline candidate on the request's draft shortlist, opening one if
 * there is none. The shortlist's export checks apply: someone not yet Ready
 * stays on the pipeline with the reason why.
 */
export async function shortlistFromPipeline(requestId: string, candidateId: string): Promise<PipelineResult> {
  const s = getSnapshot();
  const req = openRequest(s, requestId);
  if (typeof req === 'string') return { ok: false, reason: req };
  const archetype = s.archetypes.find((a) => a.id === req.archetype_id);
  const shortlistId = await createShortlist(requestId, `${req.client_name} — ${requestLabel(req, archetype)}`);
  return addToShortlist(shortlistId, candidateId);
}

export async function createShortlist(requestId: string, title: string): Promise<string> {
  const id = newId('sl');
  const snap = getSnapshot();
  if (snap.requests.find((r) => r.id === requestId)?.status === 'closed') {
    throw new Error('This request is closed.');
  }
  // One draft per request: a second click returns the draft the first made.
  const existing = snap.shortlists.find((sl) => sl.request_id === requestId && sl.status === 'draft');
  if (existing) return existing.id;
  write((s) => {
    s.shortlists.push({
      id,
      request_id: requestId,
      title,
      status: 'draft',
      exported_at: null,
      exported_by: null,
      pdf_url: null,
      exported_document: null,
    });
  });
  return id;
}

function isSent(s: Snapshot, shortlistId: string): boolean {
  return s.shortlists.find((x) => x.id === shortlistId)?.status === 'exported';
}

/**
 * Ready-only enforcement lives here, not in the UI, so no screen can add a
 * Known candidate by taking a different route.
 */
export async function addToShortlist(
  shortlistId: string,
  candidateId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = getSnapshot();
  const view = views(s).find((v) => v.id === candidateId);
  if (!view) return { ok: false, reason: 'Candidate not found.' };

  const target = s.shortlists.find((x) => x.id === shortlistId);
  if (!target) return { ok: false, reason: 'Shortlist not found.' };
  if (requestOfShortlist(s, shortlistId)?.status === 'closed') {
    return { ok: false, reason: 'This request is closed. Its shortlist is read-only.' };
  }
  if (target.status === 'exported') {
    return { ok: false, reason: 'This shortlist has been sent. Start a new version.' };
  }

  const blocked = exportBlockReason(view);
  if (blocked) return { ok: false, reason: blocked };

  write((draft) => {
    if (
      draft.shortlistCandidates.some(
        (sc) => sc.shortlist_id === shortlistId && sc.candidate_id === candidateId,
      )
    ) {
      return;
    }
    const position = draft.shortlistCandidates.filter(
      (sc) => sc.shortlist_id === shortlistId,
    ).length;
    // Whoever is shortlisted is on the request's pipeline as well, so the
    // pipeline is the one list of everyone the request has considered.
    if (!draft.requestCandidates.some((rc) => rc.request_id === target.request_id && rc.candidate_id === candidateId)) {
      draft.requestCandidates.push({
        id: newId('rc'),
        request_id: target.request_id,
        candidate_id: candidateId,
        stage: 'screening',
        note: null,
        added_by: draft.currentUserId || null,
        created_at: new Date().toISOString(),
      });
    }
    draft.shortlistCandidates.push({
      id: newId('slc'),
      shortlist_id: shortlistId,
      candidate_id: candidateId,
      // Refreshed again at export, when it becomes what the client is told.
      verified_at: view.last_verified_at ?? new Date().toISOString(),
      position,
    });

    // Adding the first candidate moves Open to Shortlisting.
    syncRequestStatus(draft, target.request_id);
  });
  return { ok: true };
}

export async function removeFromShortlist(
  shortlistId: string,
  candidateId: string,
): Promise<void> {
  write((s) => {
    if (isSent(s, shortlistId)) return; // what was sent stays as sent
    const req = requestOfShortlist(s, shortlistId);
    if (!req || req.status === 'closed') return;
    s.shortlistCandidates = s.shortlistCandidates.filter(
      (sc) => !(sc.shortlist_id === shortlistId && sc.candidate_id === candidateId),
    );
    s.shortlistCandidates
      .filter((sc) => sc.shortlist_id === shortlistId)
      .sort((a, b) => a.position - b.position)
      .forEach((sc, i) => {
        sc.position = i;
      });
    // Emptying the only shortlist moves Shortlisting back to Open.
    syncRequestStatus(s, req.id);
  });
}

export async function reorderShortlist(
  shortlistId: string,
  orderedCandidateIds: string[],
): Promise<void> {
  write((s) => {
    if (isSent(s, shortlistId) || requestOfShortlist(s, shortlistId)?.status === 'closed') return;
    orderedCandidateIds.forEach((cid, i) => {
      const row = s.shortlistCandidates.find(
        (sc) => sc.shortlist_id === shortlistId && sc.candidate_id === cid,
      );
      if (row) row.position = i;
    });
  });
}

/**
 * Export gate. Re-checks every candidate at the moment of export, not just at
 * inclusion: someone added on Monday can have expired by Friday, and the
 * client must never receive an availability claim that is no longer true.
 *
 * On success the shortlist is frozen as sent and each entry's verified_at is
 * set to the verification the client is actually being told about. Marking
 * the request submitted is a separate, deliberate step (setRequestStatus):
 * a file can be generated and never sent.
 */
export async function markShortlistExported(
  shortlistId: string,
): Promise<
  | { ok: true; document: ExportDocument }
  | { ok: false; reason: string; blocked: { candidate_id: string; ref_code: string; reason: string }[] }
> {
  const s = getSnapshot();
  if (!canManageRequests(s)) return { ok: false, reason: MANAGE_REQUESTS_DENIED, blocked: [] };
  const sl = s.shortlists.find((x) => x.id === shortlistId);
  if (!sl) return { ok: false, reason: 'Shortlist not found.', blocked: [] };
  if (sl.status === 'exported') return { ok: false, reason: 'Already exported.', blocked: [] };
  if (requestOfShortlist(s, shortlistId)?.status === 'closed') {
    return { ok: false, reason: 'This request is closed.', blocked: [] };
  }

  const byId = new Map(views(s).map((v) => [v.id, v]));
  const entries = s.shortlistCandidates.filter((sc) => sc.shortlist_id === shortlistId);
  if (entries.length === 0) {
    return { ok: false, reason: 'Add at least one candidate.', blocked: [] };
  }

  const blocked = entries.flatMap((e) => {
    const v = byId.get(e.candidate_id);
    const reason = v ? exportBlockReason(v) : 'Candidate no longer exists.';
    return reason ? [{ candidate_id: e.candidate_id, ref_code: v?.ref_code ?? '—', reason }] : [];
  });
  // Identity, contact, links and pay in the free text block here too, not
  // only on screen, so no route to an export skips the check.
  for (const leak of findLeaks(entries.flatMap((e) => (byId.has(e.candidate_id) ? [byId.get(e.candidate_id)!] : [])))) {
    const e = entries.find((x) => byId.get(x.candidate_id)?.ref_code === leak.ref_code)!;
    blocked.push({ candidate_id: e.candidate_id, ref_code: leak.ref_code, reason: leak.reason });
  }
  if (blocked.length > 0) {
    return { ok: false, reason: 'Some candidates cannot be exported.', blocked };
  }

  const req = s.requests.find((r) => r.id === sl.request_id)!;
  const now = new Date();
  const document = buildShortlistExport({
    request: req,
    archetype: s.archetypes.find((a) => a.id === req.archetype_id)!,
    preparedBy: actor(s)!,
    entries: [...entries]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ candidate: byId.get(e.candidate_id)!, verified_at: byId.get(e.candidate_id)!.last_verified_at! })),
    now,
    frozen: true,
  });

  write((draft) => {
    const target = draft.shortlists.find((x) => x.id === shortlistId)!;
    target.status = 'exported';
    target.exported_at = now.toISOString();
    target.exported_by = draft.currentUserId;
    target.exported_document = document;

    for (const sc of draft.shortlistCandidates) {
      if (sc.shortlist_id !== shortlistId) continue;
      sc.verified_at = byId.get(sc.candidate_id)?.last_verified_at ?? sc.verified_at;
    }
  });
  return { ok: true, document };
}

export async function updateArchetype(
  id: string,
  patch: Partial<
    Pick<Archetype, 'target_ready' | 'freshness_days' | 'color' | 'communication_weight' | 'technical_weight'>
  >,
): Promise<void> {
  const snap = getSnapshot();
  // Mirrors the archetypes RLS policy (0007): targets, freshness windows,
  // weights and colour are exec decisions.
  if (!isExec(actor(snap)?.role)) throw new Error('Only an exec can change role settings.');
  const current = snap.archetypes.find((x) => x.id === id);
  if (!current) return;

  const next = { ...current, ...patch };
  const problem = archetypeProblem(next);
  if (problem) throw new Error(problem);
  const weightsChanged =
    next.communication_weight !== current.communication_weight || next.technical_weight !== current.technical_weight;

  // A new freshness window applies to everyone at once because layer is
  // derived. New weights do too: every stored overall for the role is
  // recalculated, keeping each manual adjustment and its reason, so overall
  // always means what Settings says it means.
  write((s) => {
    const a = s.archetypes.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch);
    if (!weightsChanged) return;
    const now = new Date().toISOString();
    s.candidates = s.candidates.map((c) =>
      c.archetype_id === id && c.communication_score !== null ? { ...recalculateOverall(c, a), updated_at: now } : c,
    );
  });
}

export interface NewRoleInput {
  name: string;
  code: string;
  color: string;
  target_ready: number;
  freshness_days: number;
  /** 0–1. Technical takes the rest. */
  communication_weight: number;
}

export type NewRoleErrors = Partial<Record<'name' | 'code' | 'form', string>>;

/**
 * Adds a role ('SDR', 'Full Stack Developer'). Exec only, like every other
 * role setting. A new role starts with no candidates, so its health starts
 * red until the bench is built for it.
 */
export async function createArchetype(
  input: NewRoleInput,
): Promise<{ ok: true; id: string } | { ok: false; errors: NewRoleErrors }> {
  const s = getSnapshot();
  if (!isExec(actor(s)?.role)) return { ok: false, errors: { form: 'Only an exec can add roles.' } };

  const errors: NewRoleErrors = roleIdentityProblem(input, s.archetypes);
  const role = {
    target_ready: input.target_ready,
    freshness_days: input.freshness_days,
    color: input.color,
    communication_weight: Math.round(input.communication_weight * 100) / 100,
    technical_weight: Math.round((1 - input.communication_weight) * 100) / 100,
  };
  const problem = archetypeProblem(role);
  if (problem) errors.form = problem;
  if (Object.keys(errors).length) return { ok: false, errors };

  const id = newId('arch');
  write((draft) => {
    draft.archetypes.push({
      id,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      coverage_ratio: 1,
      last_health_status: null,
      retired_at: null,
      created_at: new Date().toISOString(),
      ...role,
    });
  });
  return { ok: true, id };
}

/**
 * Retires a role, or brings it back. Nothing is deleted: candidates keep the
 * role, closed requests keep it, and restoring it puts it back as it was.
 */
export async function setArchetypeRetired(id: string, retired: boolean): Promise<void> {
  const s = getSnapshot();
  if (!isExec(actor(s)?.role)) throw new Error('Only an exec can retire roles.');
  const target = s.archetypes.find((a) => a.id === id);
  if (!target) return;
  if (retired && !target.retired_at && activeArchetypes(s).length === 1) {
    throw new Error('Keep at least one role active.');
  }
  write((draft) => {
    const a = draft.archetypes.find((x) => x.id === id);
    if (a) a.retired_at = retired ? (a.retired_at ?? new Date().toISOString()) : null;
  });
}

/** Whether the signed-in user may change role targets, freshness and weights. */
export function useCanEditRoleSettings(): boolean {
  return useStore((s) => isExec(actor(s)?.role));
}

/**
 * Validation mirrors the archetype column checks: whole-number targets, a
 * freshness window a recruiter could actually keep up with, and a hex colour
 * the health rings can use.
 */
export function archetypeProblem(
  a: Pick<Archetype, 'target_ready' | 'freshness_days' | 'color' | 'communication_weight' | 'technical_weight'>,
): string | null {
  if (!Number.isInteger(a.target_ready) || a.target_ready < 1 || a.target_ready > READY_TARGET_MAX) {
    return `Ready target must be a whole number from 1 to ${READY_TARGET_MAX}.`;
  }
  if (
    !Number.isInteger(a.freshness_days) ||
    a.freshness_days < FRESHNESS_MIN_DAYS ||
    a.freshness_days > FRESHNESS_MAX_DAYS
  ) {
    return `Freshness must be a whole number of days from ${FRESHNESS_MIN_DAYS} to ${FRESHNESS_MAX_DAYS}.`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(a.color)) return 'Colour must be a hex value like #10cfd1.';
  if (Math.round(a.communication_weight * 100) + Math.round(a.technical_weight * 100) !== 100) {
    return 'Communication and technical weights must add up to 100%.';
  }
  return null;
}

/**
 * Bench health as it WOULD be with a proposed change, so a freshness window
 * can be judged before it is saved. Nothing is written.
 */
export function useArchetypeImpact(
  id: string,
  patch: Partial<Pick<Archetype, 'target_ready' | 'freshness_days'>>,
): BenchHealth | null {
  const key = JSON.stringify(patch);
  return useStore((s) =>
    derive(s, `impact:${version}:${id}:${key}`, () => {
      const current = s.archetypes.find((a) => a.id === id);
      if (!current) return null;
      const proposed = { ...current, ...patch };
      if (!(proposed.target_ready >= 1) || !(proposed.freshness_days >= 1)) return null;
      const now = new Date();
      const views = s.candidates
        .filter((c) => c.archetype_id === id && c.deleted_at === null)
        .map((c) => toCandidateView(c, proposed, now));
      return computeBenchHealth(proposed, views, new Date());
    }),
  );
}

// ---------------------------------------------------------------- jobs ----

export function useJobRuns(): JobRun[] {
  return useStore((s) =>
    derive(s, `runs:${version}`, () =>
      [...s.jobRuns].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    ),
  );
}

/**
 * "Run now". Does exactly what the cron handler will, minus the sending:
 * builds every email the job would produce, records the run, and for the
 * scarcity check stores the new baseline so the same drop never alerts twice.
 */
/** Whether a weekly job already prepared emails since its most recent scheduled time. */
function alreadySentThisSlot(runs: JobRun[], job: JobName, now: Date): boolean {
  if (job === 'scarcity_check') return false; // idempotent by its own records
  const slotStart = nextRun(job, now).getTime() - WEEK_MS;
  return runs.some((r) => r.job === job && r.emails_prepared > 0 && new Date(r.started_at).getTime() >= slotStart);
}

export async function runJob(job: JobName): Promise<JobRun> {
  const s = getSnapshot();
  // Running a job sends email for real once it is wired to Resend.
  if (!isExec(actor(s)?.role)) throw new Error('Only an exec can run a job now.');
  const now = new Date();
  const started = now.toISOString();
  const all = views(s);
  const health = activeArchetypes(s).map((a) => computeBenchHealth(a, all, now));

  let detail: JobRun['detail'] = [];
  let nextStatus: Record<string, Archetype['last_health_status']> | null = null;
  let alerted: CandidateView[] = [];
  let skipped: string | null = null;

  if (job === 'scarcity_check') {
    const result = buildScarcityAlerts({ archetypes: activeArchetypes(s), health, users: s.users, views: all, now });
    detail = scarcityEmails(result.alerts);
    nextStatus = result.nextStatus;
    alerted = result.alertedLeaving;
  } else if (alreadySentThisSlot(s.jobRuns, job, now)) {
    // Run now is idempotent: the Monday and Friday emails go out once per
    // scheduled slot however many times someone presses it.
    skipped = 'Already sent for this week. Nothing new would be sent.';
  } else if (job === 'decay_warning') {
    detail = decayEmails(buildDecayWarnings({ views: all, users: s.users, now }));
  } else {
    const stats = buildWeeklyStats({
      health,
      calls: s.calls,
      requests: s.requests,
      shortlists: s.shortlists,
      shortlistCandidates: s.shortlistCandidates,
      now,
    });
    detail = weeklyEmails(buildWeeklySummaries({ users: s.users, stats }));
  }

  const run: JobRun = {
    id: newId('run'),
    job,
    triggered_by: s.currentUserId,
    started_at: started,
    finished_at: new Date().toISOString(),
    emails_prepared: detail.length,
    detail,
    error: null,
    skipped_reason: skipped,
  };

  write((draft) => {
    draft.jobRuns.push(run);
    // Idempotent: a candidate warned about for this expiry is never warned again.
    for (const v of alerted) {
      const c = draft.candidates.find((x) => x.id === v.id);
      if (c) c.ready_exit_alerted_for = v.expires_at;
    }
    if (nextStatus) {
      for (const a of draft.archetypes) {
        if (nextStatus[a.id]) a.last_health_status = nextStatus[a.id];
      }
    }
  });
  return run;
}

// ------------------------------------------------------- email previews ----
// What each email would contain right now, built by the same functions the
// jobs run. Read-only: nothing is recorded, no baseline moves.

export interface ScarcityPreview {
  alerts: ScarcityAlert[];
  transitions: ScarcityTransition[];
  /**
   * True when nothing has actually worsened since the last check, so the
   * preview shows how the alert WOULD look for the weakest role, from the
   * next status up. Labelled as an example on screen.
   */
  example: boolean;
}

export function useScarcityPreview(): ScarcityPreview {
  return useStore((s) =>
    derive(s, `pv-scarcity:${version}`, () => {
      const all = views(s);
      const now = new Date();
      const health = activeArchetypes(s).map((a) => computeBenchHealth(a, all, now));
      const real = buildScarcityAlerts({ archetypes: activeArchetypes(s), health, users: s.users, views: all, now });
      if (real.alerts.length > 0) return { alerts: real.alerts, transitions: real.transitions, example: false };

      const rank = { green: 0, amber: 1, red: 2 } as const;
      const worst = [...health].sort((a, b) => rank[b.status] - rank[a.status] || a.coverage - b.coverage)[0];
      if (!worst || worst.status === 'green') return { alerts: [], transitions: [], example: false };

      const transitions: ScarcityTransition[] = [
        { health: worst, from: worst.status === 'red' ? 'amber' : 'green', to: worst.status },
      ];
      return {
        alerts: s.users.filter((u) => u.notify_scarcity).map((user) => ({ user, transitions, leaving: [] })),
        transitions,
        example: true,
      };
    }),
  );
}

export function useDecayWarningPreview(): DecayWarning[] {
  return useStore((s) =>
    derive(s, `pv-decay:${version}`, () => buildDecayWarnings({ views: views(s), users: s.users, now: new Date() })),
  );
}

export function useWeeklySummaryPreview(): WeeklySummary[] {
  return useStore((s) =>
    derive(s, `pv-weekly:${version}`, () => {
      const all = views(s);
      const stats = buildWeeklyStats({
        health: activeArchetypes(s).map((a) => computeBenchHealth(a, all, new Date())),
        calls: s.calls,
        requests: s.requests,
        shortlists: s.shortlists,
        shortlistCandidates: s.shortlistCandidates,
        now: new Date(),
      });
      return buildWeeklySummaries({ users: s.users, stats });
    }),
  );
}

export function useNewRequestPreview(requestId: string): NewRequestAlert[] {
  return useStore((s) =>
    derive(s, `pv-request:${version}:${requestId}`, () => {
      const request = s.requests.find((r) => r.id === requestId);
      const archetype = request && s.archetypes.find((a) => a.id === request.archetype_id);
      if (!request || !archetype) return EMPTY;
      return buildNewRequestAlerts({ request, archetype, pool: poolFor(s, request), users: s.users });
    }),
  );
}

/** Notification preferences. Each person sets their own, nobody else's. */
export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<Record<NotificationKey, boolean>>,
): Promise<void> {
  const s = getSnapshot();
  if (userId !== s.currentUserId) throw new Error('You can only change your own notifications.');
  write((draft) => {
    const u = draft.users.find((x) => x.id === userId);
    if (u) Object.assign(u, patch);
  });
}

// ------------------------------------------------------------ session ----
// Demo authentication. Nothing here checks a password: there is no database
// and no auth provider behind the demo. The shapes match what Supabase Auth
// returns, so the sign-in page does not change when the real thing lands.

/** The one domain allowed to sign in. Staff only; clients never log in. */
export const STAFF_EMAIL_DOMAIN = 'zareinnovations.com';

export function useSession(): { signedIn: boolean; user: User | null } {
  return useStore((s) =>
    derive(s, `session:${version}`, () => ({
      signedIn: s.signedIn,
      user: s.signedIn ? (s.users.find((u) => u.id === s.currentUserId) ?? null) : null,
    })),
  );
}

/**
 * Email and password sign-in. In the real build this is
 * supabase.auth.signInWithPassword; errors are deliberately vague about
 * whether the account exists, which is what Supabase does too.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Real sign-in: the accounts API checks the password and issues the
  // bearer token every bench request carries. The first sign-in creates
  // this person's bench user record.
  if (API_MODE) {
    const address = email.trim().toLowerCase();
    if (!address) return { ok: false, error: 'Enter your email address.' };
    if (!password) return { ok: false, error: 'Enter your password.' };
    try {
      setApiToken(await signInApi(address, password));
    } catch {
      return { ok: false, error: 'That email and password do not match a staff account.' };
    }
    try {
      const me = await ensureBenchUser(address);
      await hydrateFromApi(true);
      mutate((s) => {
        if (!s.users.some((u) => u.id === me.id)) s.users.push(me);
        s.currentUserId = me.id;
        s.signedIn = true;
      });
      return { ok: true };
    } catch {
      clearApiToken();
      return { ok: false, error: 'Signed in, but the bench could not be loaded. Try again.' };
    }
  }
  // Demo sign-in checks no password, so it exists only in demo mode.
  if (!DEMO_MODE) return { ok: false, error: 'Sign-in is not available yet.' };
  const address = email.trim().toLowerCase();
  if (!address.endsWith(`@${STAFF_EMAIL_DOMAIN}`)) {
    return { ok: false, error: `Use your @${STAFF_EMAIL_DOMAIN} email address.` };
  }
  if (!password) return { ok: false, error: 'Enter your password.' };

  const user = getSnapshot().users.find((u) => u.email.toLowerCase() === address);
  if (!user) return { ok: false, error: 'That email and password do not match a staff account.' };

  mutate((s) => {
    s.currentUserId = user.id;
    s.signedIn = true;
  });
  return { ok: true };
}

/** Fake auth: switch the acting user. No credentials, so demo mode only. */
export async function signInAs(userId: string): Promise<void> {
  if (!DEMO_MODE) throw new Error('Signing in as someone else is only available in the demo.');
  if (!getSnapshot().users.some((u) => u.id === userId)) throw new Error('Unknown staff member.');
  mutate((s) => {
    s.currentUserId = userId;
    s.signedIn = true;
  });
}

export async function signOut(): Promise<void> {
  if (API_MODE) clearApiToken();
  mutate((s) => {
    s.signedIn = false;
  });
}

/**
 * Gives someone a portal role before they ever sign in, so the exec who
 * adds a person decides what they can do. Their first sign-in finds this
 * row by email instead of creating a recruiter. If the row already exists
 * the role is changed through setUserRole, with its last-exec rule.
 */
export async function addUser(input: { full_name: string; email: string; role: Role }): Promise<void> {
  const s = getSnapshot();
  const actor = s.users.find((u) => u.id === s.currentUserId);
  if (!isExec(actor?.role)) throw new Error('Only an exec can add people to the portal.');

  const email = input.email.trim().toLowerCase();
  const existing = s.users.find((u) => u.email.toLowerCase() === email);
  if (existing) return setUserRole(existing.id, input.role);

  write((draft) => {
    draft.users.push({
      id: newId('user'),
      full_name: input.full_name.trim() || email,
      email,
      role: input.role,
      notify_scarcity: true,
      notify_decay_warning: true,
      notify_new_request: true,
      notify_weekly_summary: true,
      created_at: new Date().toISOString(),
    });
  });
}

/**
 * Mirrors guard_role_change (0004, 0006): only an exec may change a role,
 * including their own, and the last exec cannot be demoted.
 */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const s = getSnapshot();
  const actor = s.users.find((u) => u.id === s.currentUserId);
  if (!isExec(actor?.role)) throw new Error('Only an exec can change a user role.');

  const target = s.users.find((u) => u.id === userId);
  if (!target || target.role === role) return;
  if (isExec(target.role) && !s.users.some((u) => isExec(u.role) && u.id !== userId)) {
    throw new Error('At least one exec must remain.');
  }

  write((draft) => {
    const u = draft.users.find((x) => x.id === userId);
    if (u) u.role = role;
  });
}
