import { describe, expect, it } from 'vitest';

import { buildNewRequestAlerts } from '@/bench/jobs';
import { buildShortlistExport } from '@/bench/export/shortlist';
import {
  benchContribution,
  commitmentsByCandidate,
  requestStatusProblem,
  statusAfterShortlistChange,
  validateClose,
  validateRequest,
  normalizeTag,
  requestFit,
  requestPool,
  shortlistWarnings,
  toCandidateView,
} from './logic';
import { seedArchetypes, seedCandidates, seedRequests, seedUsers } from './seed';
import type { CallLog, CandidateView, ClientRequest } from './types';

const NOW = new Date('2026-09-17T09:00:00Z');

function world() {
  const t = NOW.getTime();
  const { candidates } = seedCandidates(t);
  const archetypes = seedArchetypes(t);
  const { requests, shortlists, shortlistCandidates, placements } = seedRequests(t, candidates);
  const byArch = new Map(archetypes.map((a) => [a.id, a]));
  const views = candidates
    .filter((c) => c.deleted_at === null)
    .map((c) => toCandidateView(c, byArch.get(c.archetype_id)!, NOW));
  const commitments = commitmentsByCandidate(requests, shortlists, shortlistCandidates);
  const request = (client: string) => requests.find((r) => r.client_name === client)!;
  const pool = (client: string) => requestPool(request(client), views, commitments, NOW);
  return { t, candidates, archetypes, requests, shortlists, shortlistCandidates, placements, views, commitments, request, pool };
}

const names = (xs: { v: CandidateView }[]) => xs.map((e) => e.v.full_name).sort();

describe('C1: requests count only candidates who meet the requirements', () => {
  it('matches tags ignoring case, spaces and dots', () => {
    expect(normalizeTag(' Node.js ')).toBe(normalizeTag('NodeJS'));
    expect(normalizeTag('node js')).toBe('nodejs');
    const fit = requestFit(
      { required_skills: ['nodejs', 'REACT'], required_shifts: ['Evening'] },
      { stack: ['React', 'Node.js'], skills: [], shift_flexibility: ['Day'] },
    );
    expect(fit).toEqual({ fits: false, missing_skills: [], missing_shifts: ['Evening'] });
  });

  it('Meridian (React and Node.js) has exactly Nebiyu, Tewodros and Naol', () => {
    const w = world();
    expect(names(w.pool('Meridian Health').ready)).toEqual(['Naol Tadesse', 'Nebiyu Alemu', 'Tewodros Kebede']);
    // Near misses are kept for judgement but never counted.
    expect(names(w.pool('Meridian Health').ready_partial)).toContain('Mikias Tesfaye');
  });

  it('Northwind counts only Ready CSRs who work evenings', () => {
    const w = world();
    const pool = w.pool('Northwind Logistics');
    expect(pool.ready.length).toBeGreaterThan(0);
    expect(pool.ready.every((e) => e.v.shift_flexibility.includes('Evening'))).toBe(true);
    expect(names(pool.ready_partial)).toContain('Yonas Haile');
  });

  it('BETA needs voice and evenings; Zendesk stays a preference in the notes', () => {
    const w = world();
    const beta = w.request('BETA Technologies');
    expect(beta.required_skills).toEqual(['Voice']);
    expect(beta.notes).toMatch(/Zendesk/);
    for (const e of w.pool('BETA Technologies').ready) {
      expect(e.v.skills).toContain('Voice');
      expect(e.v.shift_flexibility).toContain('Evening');
    }
  });

  it('sorts full matches first, then fewest missing, then score', () => {
    const w = world();
    const all = [...w.pool('Meridian Health').ready, ...w.pool('Meridian Health').ready_partial];
    const firstPartial = all.findIndex((e) => !e.fit.fits);
    expect(all.slice(firstPartial).every((e) => !e.fit.fits)).toBe(true);
    const scores = w.pool('Meridian Health').ready.map((e) => e.v.overall_score ?? 0);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('the New request email counts the same people', () => {
    const w = world();
    const req = w.request('Meridian Health');
    const alerts = buildNewRequestAlerts({
      request: { ...req, created_by: null },
      archetype: w.archetypes.find((a) => a.id === req.archetype_id)!,
      pool: w.pool('Meridian Health'),
      users: seedUsers(w.t).map((u) => ({ ...u, notify_new_request: true })),
    });
    expect(alerts[0].ready.map((v) => v.full_name).sort()).toEqual(['Naol Tadesse', 'Nebiyu Alemu', 'Tewodros Kebede']);
  });
});

describe('C2: candidates committed to another request', () => {
  it('tags them with the other request, never this one, and counts uncommitted', () => {
    const w = world();
    const beta = w.pool('BETA Technologies');
    const kalkidan = beta.ready.find((e) => e.v.full_name === 'Kalkidan Wolde')!;
    expect(kalkidan.committed).toEqual([
      expect.objectContaining({ client_name: 'Northwind Logistics', submitted: false }),
    ]);
    const northwind = w.pool('Northwind Logistics');
    expect(northwind.ready.find((e) => e.v.full_name === 'Kalkidan Wolde')!.committed).toEqual([]);
    expect(beta.uncommitted).toBe(beta.ready.filter((e) => e.committed.length === 0).length);
    expect(beta.uncommitted).toBeLessThan(beta.ready.length);
  });

  it('releases candidates once the other request is closed', () => {
    const w = world();
    const closed = w.requests.map((r) => (r.client_name === 'Northwind Logistics' ? { ...r, status: 'closed' as const } : r));
    const commitments = commitmentsByCandidate(closed, w.shortlists, w.shortlistCandidates);
    const pool = requestPool(w.request('BETA Technologies'), w.views, commitments, NOW);
    expect(pool.uncommitted).toBe(pool.ready.length);
  });
});

describe('H1: shortlist warnings and an honest cover', () => {
  const req = { required_by: '2026-09-22' } as Pick<ClientRequest, 'required_by'>;
  const view = (patch: Partial<CandidateView>) => ({ expires_at: '2026-10-30T09:00:00Z', ...patch }) as CandidateView;

  it('warns when availability lapses before the deadline or the last call went unanswered', () => {
    expect(shortlistWarnings(view({}), req, null)).toEqual([]);
    expect(shortlistWarnings(view({ expires_at: '2026-09-19T09:00:00Z' }), req, null)[0]).toMatch(/before the/);
    expect(shortlistWarnings(view({}), req, { outcome: 'no_answer' } as CallLog)).toEqual(['Last call went unanswered.']);
  });

  it('flags the seeded examples', () => {
    const w = world();
    const fikirte = w.views.find((v) => v.full_name === 'Fikirte Berhanu')!;
    expect(shortlistWarnings(fikirte, w.request('Northwind Logistics'), null)).toHaveLength(1);
  });

  it('never claims confirmed availability for a draft with unconfirmed candidates', () => {
    const w = world();
    const archetype = w.archetypes[0];
    const known = w.views.find((v) => v.full_name === 'Dagmawi Terefe')!;
    const doc = buildShortlistExport({
      request: w.request('BETA Technologies'),
      archetype,
      preparedBy: { full_name: 'A', email: 'a@zareinnovations.com' },
      entries: [{ candidate: known, verified_at: known.last_verified_at! }],
    });
    expect(doc.unconfirmed).toBe(1);
  });
});

describe('C3: closing records the outcome and bench contribution', () => {
  const shortlisted = new Set(['a', 'b', 'c']);

  it('requires an outcome, and placements that match it', () => {
    expect(validateClose({ outcome: null, placed_candidate_ids: [], placed_outside: 0 }, 3, shortlisted).outcome).toBeTruthy();
    expect(validateClose({ outcome: 'filled', placed_candidate_ids: [], placed_outside: 0 }, 3, shortlisted).placed).toBeTruthy();
    expect(validateClose({ outcome: 'filled', placed_candidate_ids: ['a'], placed_outside: 1 }, 3, shortlisted).placed).toMatch(/Partly filled/);
    expect(validateClose({ outcome: 'filled', placed_candidate_ids: ['a', 'b'], placed_outside: 1 }, 3, shortlisted)).toEqual({});
    expect(validateClose({ outcome: 'partly_filled', placed_candidate_ids: ['a'], placed_outside: 0 }, 3, shortlisted)).toEqual({});
    expect(validateClose({ outcome: 'lost', placed_candidate_ids: ['a'], placed_outside: 0 }, 3, shortlisted).placed).toBeTruthy();
    expect(validateClose({ outcome: 'cancelled', placed_candidate_ids: [], placed_outside: 0 }, 3, shortlisted)).toEqual({});
    expect(validateClose({ outcome: 'filled', placed_candidate_ids: ['zz'], placed_outside: 3 }, 3, shortlisted).placed).toMatch(/shortlisted/);
  });

  it('is the share of placements this quarter that came from the bench', () => {
    const w = world();
    expect(benchContribution(w.requests, w.placements, NOW)).toEqual({
      quarter: 'Q3 2026',
      from_bench: 2,
      from_outside: 1,
      rate: 67,
    });
    // Next quarter, nothing has closed yet.
    expect(benchContribution(w.requests, w.placements, new Date('2026-10-02T09:00:00Z')).rate).toBeNull();
  });

  it('takes placed candidates off the bench', () => {
    const w = world();
    for (const p of w.placements) {
      expect(w.candidates.find((c) => c.id === p.candidate_id)!.archived_reason).toBe('placed');
    }
  });
});

describe('H2: request status follows its data', () => {
  it('refuses a deadline in the past when creating', () => {
    const base = { client_name: 'Acme', archetype_id: 'x', quantity: 2, notes: null };
    expect(validateRequest({ ...base, required_by: '2026-09-16' }, NOW).required_by).toBeTruthy();
    expect(validateRequest({ ...base, required_by: '2026-09-17' }, NOW)).toEqual({});
    expect(validateRequest({ ...base, quantity: 0, required_by: null }, NOW).quantity).toBeTruthy();
    expect(validateRequest({ ...base, quantity: 101, required_by: null }, NOW).quantity).toBeTruthy();
  });

  it('only allows moves the shortlist supports, and never reopens', () => {
    const empty = { status: 'open' as const, shortlisted: 0, exported: false };
    expect(requestStatusProblem(empty, 'shortlisting')).toBeTruthy();
    expect(requestStatusProblem(empty, 'submitted')).toBeTruthy();
    expect(requestStatusProblem(empty, 'closed')).toMatch(/outcome/);
    expect(requestStatusProblem({ status: 'shortlisting', shortlisted: 2, exported: false }, 'submitted')).toMatch(/Export/);
    expect(requestStatusProblem({ status: 'shortlisting', shortlisted: 2, exported: true }, 'submitted')).toBeNull();
    expect(requestStatusProblem({ status: 'closed', shortlisted: 2, exported: true }, 'open')).toMatch(/reopened/);
  });

  it('moves Open to Shortlisting on the first candidate, and back when emptied', () => {
    expect(statusAfterShortlistChange({ status: 'open', shortlisted: 1, exported: false })).toBe('shortlisting');
    expect(statusAfterShortlistChange({ status: 'shortlisting', shortlisted: 0, exported: false })).toBe('open');
    expect(statusAfterShortlistChange({ status: 'submitted', shortlisted: 0, exported: true })).toBe('submitted');
  });

  it('seeds every request in a status its data supports', () => {
    const w = world();
    for (const r of w.requests) {
      const lists = w.shortlists.filter((sl) => sl.request_id === r.id);
      const current = lists.find((sl) => sl.status === 'draft') ?? lists[lists.length - 1];
      const shortlisted = current ? w.shortlistCandidates.filter((sc) => sc.shortlist_id === current.id).length : 0;
      const exported = lists.some((sl) => sl.status === 'exported');
      if (r.status === 'open') expect(shortlisted, r.client_name).toBe(0);
      if (r.status === 'shortlisting') expect(shortlisted, r.client_name).toBeGreaterThan(0);
      if (r.status === 'submitted') expect(exported, r.client_name).toBe(true);
      if (r.status === 'closed') expect(r.outcome, r.client_name).not.toBeNull();
      else expect(r.outcome, r.client_name).toBeNull();
    }
  });
});
