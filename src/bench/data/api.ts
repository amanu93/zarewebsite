/**
 * The landing-api client, live when demo mode is off.
 *
 * With NEXT_PUBLIC_BENCH_DEMO_MODE=false the store stops seeding itself and
 * this module becomes the persistence layer: the snapshot hydrates from the
 * bench CRUD endpoints (see BENCH.md in the landing-api repo), and after
 * every local mutation the changed rows are mirrored back with POST / PUT /
 * DELETE per table. Business rules, derived views and every screen stay
 * exactly as they were against the demo store — the API carries base rows,
 * nothing else.
 *
 * The API speaks camelCase (the backend's entity style); the portal's types
 * are snake_case (the SQL's style). One mechanical key mapper covers both
 * directions; list fields are normalised because the backend stores them as
 * comma-separated text.
 */

import { deleteCookie, setCookie } from 'cookies-next';

import type { Snapshot } from './store';
import type { User } from './types';

/**
 * The API is the default. The in-memory demo store exists only for the
 * unit tests (vitest sets NEXT_PUBLIC_BENCH_DEMO_MODE=true) — deployment
 * needs no flag at all.
 */
export const API_MODE =
  process.env.NEXT_PUBLIC_BENCH_DEMO_MODE !== 'true';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3580') + '/api';

/* ------------------------------------------------------------------
   The session token. Sign-in goes through /api/accounts like the admin;
   every bench request carries the bearer token. sessionStorage, so a
   fresh browser starts at the sign-in page.
   ------------------------------------------------------------------ */

const TOKEN_KEY = 'zare-bench-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
    // The admin area reads this cookie (src/store/base-query.ts). Writing it
    // here means one sign-in covers both areas while /admin is folded into
    // the portal, and its middleware stops bouncing portal users to
    // /admin/login.
    setCookie('access_token', token);
  } catch {
    // In-memory session only; sign-in still works for the tab's lifetime.
  }
}

export function clearToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
    deleteCookie('access_token');
  } catch {
    // Nothing to clear.
  }
}

/** POST /api/accounts/sign-in. Resolves to the access token. */
export async function signInApi(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/accounts/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in -> ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('sign-in -> no token in response');
  return data.access_token;
}

/**
 * The signed-in person's bench_users row, created on first sign-in.
 *
 * The FIRST person to sign in becomes the exec; everyone after them is a
 * recruiter. Only an exec can change roles (setUserRole, mirroring
 * guard_role_change), so without this nobody could ever be promoted and
 * the role settings would stay locked forever. That exec then assigns
 * everyone else from Settings.
 */
export async function ensureBenchUser(email: string): Promise<User> {
  const q = `?q=${encodeURIComponent('t=10000')}`;
  const data = await request('GET', `bench/user${q}`);
  const rows = (data?.items ?? []) as Record<string, unknown>[];
  const existing = rows.find(
    (r) => String(r.email).toLowerCase() === email.toLowerCase(),
  );
  if (existing) return fromApi('users', existing) as unknown as User;

  const name = email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
  const created = await request('POST', 'bench/user', {
    fullName: name || email,
    email,
    role: rows.length === 0 ? 'exec' : 'recruiter',
  });
  return fromApi('users', created) as unknown as User;
}

/** Everything the diff sync mirrors, in create order (deletes run reversed). */
const COLLECTIONS = [
  ['users', 'bench/user'],
  ['archetypes', 'bench/archetype'],
  ['candidates', 'bench/candidate'],
  ['calls', 'bench/call'],
  ['requests', 'bench/request'],
  ['shortlists', 'bench/shortlist'],
  ['shortlistCandidates', 'bench/shortlist-candidate'],
  ['requestCandidates', 'bench/request-candidate'],
  ['placements', 'bench/placement'],
  ['jobRuns', 'bench/job-run'],
] as const;

type CollectionKey = (typeof COLLECTIONS)[number][0];

/** Fields the backend stores as comma-separated text, per collection. */
const LIST_FIELDS: Partial<Record<CollectionKey, string[]>> = {
  candidates: ['stack', 'skills', 'strengths', 'shift_flexibility'],
  calls: ['shift_flexibility'],
  requests: ['required_skills', 'required_shifts'],
};

const snakeToCamel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const camelToSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function mapKeys(row: Record<string, unknown>, mapKey: (k: string) => string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[mapKey(k)] = v;
  return out;
}

/** API row -> portal row: snake keys, real arrays, joined rows dropped. */
function fromApi(key: CollectionKey, row: Record<string, unknown>) {
  const out = mapKeys(row, camelToSnake);
  // relations the backend may include (archetype, candidate, ...) are not
  // part of the portal's row shape; the ids are
  for (const k of Object.keys(out)) {
    if (out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k]) && !['detail', 'exported_document'].includes(k)) {
      delete out[k];
    }
  }
  for (const field of LIST_FIELDS[key] ?? []) {
    const v = out[field];
    out[field] = Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' && v ? v.split(',') : [];
  }
  return out;
}

/** Portal row -> API row: camel keys. Arrays pass through; the backend's
 *  simple-array columns accept them. */
function toApi(row: Record<string, unknown>) {
  return mapKeys(row as Record<string, unknown>, snakeToCamel);
}

/** Shared by the bench collections and the admin screens (src/bench/admin). */
export async function request(method: string, path: string, body?: unknown) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Every collection, mapped into the snapshot's table shapes. */
export async function fetchCollections(): Promise<
  Pick<
    Snapshot,
    | 'users'
    | 'archetypes'
    | 'candidates'
    | 'calls'
    | 'requests'
    | 'shortlists'
    | 'shortlistCandidates'
    | 'requestCandidates'
    | 'placements'
    | 'jobRuns'
  >
> {
  const q = `?q=${encodeURIComponent('t=10000')}`;
  const results = await Promise.all(
    COLLECTIONS.map(async ([key, path]) => {
      const data = await request('GET', `${path}${q}`);
      const items = (data?.items ?? []) as Record<string, unknown>[];
      return [key, items.map((r) => fromApi(key, r))] as const;
    }),
  );
  return Object.fromEntries(results) as never;
}

/* ------------------------------------------------------------------
   Diff sync. After a mutation the store hands over the previous and the
   next snapshot; whatever changed per table is mirrored to the API. The
   ops run on one sequential queue so causally ordered writes (create a
   shortlist, then add to it) arrive in order.
   ------------------------------------------------------------------ */

let syncQueue: Promise<void> = Promise.resolve();

export function syncDiff(prev: Snapshot, next: Snapshot): void {
  const ops: { method: string; path: string; body?: unknown }[] = [];

  for (const [key, path] of COLLECTIONS) {
    const before = new Map(
      (prev[key] as { id: string }[]).map((r) => [r.id, r]),
    );
    const after = new Map(
      (next[key] as { id: string }[]).map((r) => [r.id, r]),
    );

    for (const [id, row] of after) {
      const old = before.get(id);
      if (!old) {
        ops.push({ method: 'POST', path, body: toApi(row as never) });
      } else if (JSON.stringify(old) !== JSON.stringify(row)) {
        ops.push({ method: 'PUT', path: `${path}/${id}`, body: toApi(row as never) });
      }
    }
  }

  // deletes after creates, reverse table order, so children go before parents
  for (const [key, path] of [...COLLECTIONS].reverse()) {
    const after = new Set((next[key] as { id: string }[]).map((r) => r.id));
    for (const row of prev[key] as { id: string }[]) {
      if (!after.has(row.id)) ops.push({ method: 'DELETE', path: `${path}/${row.id}` });
    }
  }

  if (!ops.length) return;

  syncQueue = syncQueue.then(async () => {
    for (const op of ops) {
      try {
        await request(op.method, op.path, op.body);
      } catch (err) {
        // Surfaced loudly rather than retried: local state is ahead of the
        // API and a reload will show the divergence. Good enough while the
        // integration is local-only.
        console.error('[bench api] sync failed:', err);
      }
    }
  });
}

/** Resolves once the queued mirror writes have been attempted. */
export function whenSynced(): Promise<void> {
  return syncQueue;
}
