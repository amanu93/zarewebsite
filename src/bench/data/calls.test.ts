import { describe, expect, it } from 'vitest';

import { buildWeeklyStats } from '@/bench/jobs';
import { toExportCandidate } from '@/bench/export/shortlist';
import {
  applyCall,
  buildCallQueue,
  callDueState,
  computeBenchHealth,
  computeCallStats,
  exportBlockReason,
  isOneCallAway,
  lastVerification,
  NO_ANSWER_COOLDOWN_HOURS,
  toCandidateView,
  validateCallDetails,
} from './logic';
import { seedArchetypes, seedCandidates, seedUsers, USER_RECRUITER_1 } from './seed';
import type { CallLog, Candidate, CandidateView } from './types';

// 17 Sept 2026, 12:00 EAT
const NOW = new Date('2026-09-17T09:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function world(now = NOW) {
  const t = now.getTime();
  const { candidates, calls } = seedCandidates(t);
  const archetypes = seedArchetypes(t);
  const byArch = new Map(archetypes.map((a) => [a.id, a]));
  const views = candidates
    .filter((c) => c.deleted_at === null)
    .map((c) => toCandidateView(c, byArch.get(c.archetype_id)!, now));
  const callsBy = new Map<string, CallLog[]>();
  for (const c of [...calls].sort((a, b) => b.called_at.localeCompare(a.called_at))) {
    callsBy.set(c.candidate_id, [...(callsBy.get(c.candidate_id) ?? []), c]);
  }
  const users = new Map(seedUsers(t).map((u) => [u.id, u]));
  const queue = buildCallQueue(views, callsBy, users, now);
  const view = (name: string) => views.find((v) => v.full_name === name)!;
  const due = (name: string) => callDueState(view(name), callsBy.get(view(name).id) ?? [], now);
  return { candidates, calls, archetypes, views, callsBy, queue, view, due };
}

const call = (patch: Partial<CallLog>): CallLog => ({
  id: 'x',
  candidate_id: 'c',
  called_by: USER_RECRUITER_1,
  outcome: 'available',
  note: null,
  called_at: NOW.toISOString(),
  notice_period: null,
  earliest_start_date: null,
  shift_flexibility: null,
  recall_at: null,
  ...patch,
});

describe('C4: no answer never drops anyone from the queue', () => {
  it('keeps a never-verified candidate in the queue, cooling down, after no answer', () => {
    const { candidates, archetypes } = world();
    const hiwot = candidates.find((c) => c.full_name === 'Hiwot Kebede')!;
    const view = toCandidateView(hiwot, archetypes.find((a) => a.id === hiwot.archetype_id)!, NOW);
    const noAnswer = call({ outcome: 'no_answer', candidate_id: hiwot.id, called_at: new Date(NOW.getTime() - HOUR).toISOString() });

    expect(callDueState(view, [noAnswer], NOW).kind).toBe('cooldown');
    // After the cooldown she is due again as Retry, like everyone else.
    const later = new Date(NOW.getTime() + NO_ANSWER_COOLDOWN_HOURS * HOUR);
    expect(callDueState(view, [noAnswer], later)).toEqual({ kind: 'due', reason: 'no_answer_retry', priority: 3 });
  });

  it('treats expired and Ready candidates the same way', () => {
    const w = world();
    expect(w.due('Bereket Solomon').kind).toBe('cooldown'); // expired, no answer 6h ago
    expect(w.due('Tewodros Kebede')).toMatchObject({ kind: 'due', reason: 'no_answer_retry' }); // Ready, 76h ago
    const ids = new Set(w.queue.map((q) => q.full_name));
    expect(ids.has('Bereket Solomon')).toBe(true);
    expect(ids.has('Tewodros Kebede')).toBe(true);
    expect(ids.has('Hiwot Kebede')).toBe(true);
    expect(w.queue.find((q) => q.full_name === 'Bereket Solomon')!.retry_at).not.toBeNull();
  });
});

describe('C5: not available', () => {
  it('requires a recall date after today and within a year', () => {
    expect(validateCallDetails('not_available', {}, NOW).recall_at).toBeTruthy();
    expect(validateCallDetails('not_available', { recall_at: '2026-09-17' }, NOW).recall_at).toBeTruthy();
    expect(validateCallDetails('not_available', { recall_at: '2027-12-01' }, NOW).recall_at).toBeTruthy();
    expect(validateCallDetails('not_available', { recall_at: '2026-10-17' }, NOW)).toEqual({});
  });

  it('shows no Good until and no start date', () => {
    const w = world();
    const robel = w.view('Robel Assefa');
    expect(robel.availability_status).toBe('not_available');
    expect(robel.expires_at).toBeNull();
    expect(robel.earliest_start_date).toBeNull();
    expect(robel.recall_at).not.toBeNull();
  });

  it('is out of the queue and One call away until the recall date, then Recall due', () => {
    const w = world();
    const robel = w.view('Robel Assefa');
    expect(w.queue.some((q) => q.id === robel.id)).toBe(false);
    expect(isOneCallAway(robel, NOW)).toBe(false);

    const onRecall = new Date(`${robel.recall_at}T09:00:00+03:00`);
    const view = toCandidateView(w.candidates.find((c) => c.id === robel.id)!, w.archetypes[0], onRecall);
    expect(callDueState(view, w.callsBy.get(robel.id)!, onRecall)).toMatchObject({ kind: 'due', reason: 'recall_due' });
    expect(isOneCallAway(view, onRecall)).toBe(true);
  });
});

describe('C6: available asks, never invents', () => {
  it('requires notice, and a start date unless Immediate', () => {
    expect(validateCallDetails('available', {}, NOW)).toMatchObject({
      notice_period: expect.any(String),
      earliest_start_date: expect.any(String),
    });
    expect(validateCallDetails('available', { notice_period: 'Immediate' }, NOW)).toEqual({});
    expect(validateCallDetails('available', { notice_period: '2 weeks', earliest_start_date: '2026-09-01' }, NOW).earliest_start_date).toBeTruthy();
    expect(validateCallDetails('available', { notice_period: '2 weeks', earliest_start_date: '2026-10-01' }, NOW)).toEqual({});
  });

  it('records exactly what was asked, with no start date for Immediate', () => {
    const before = { earliest_start_date: '2026-09-01', notice_period: '1 month', shift_flexibility: ['Day'] } as Candidate;
    const after = applyCall(before, call({ notice_period: 'Immediate', earliest_start_date: '2026-10-01', shift_flexibility: ['Evening'] }));
    expect(after.notice_period).toBe('Immediate');
    expect(after.earliest_start_date).toBeNull();
    expect(after.shift_flexibility).toEqual(['Evening']);
  });

  it('never claims a start date the PDF cannot back up', () => {
    const w = world();
    const lidya = w.view('Lidya Tesfaye');
    expect(lidya.notice_period).toBe('Immediate');
    expect(lidya.earliest_start_date).toBeNull();
    const exported = toExportCandidate({ ...lidya, layer: 'ready' }, NOW.toISOString());
    expect(exported.availability).toMatchObject({ earliest_start: 'immediately', notice_period: null });

    // Bereket's old confirmation never asked notice or start: not exportable.
    const bereket: CandidateView = { ...w.view('Bereket Solomon'), layer: 'ready' };
    expect(exportBlockReason(bereket)).toMatch(/notice period and start date/);
  });
});

describe('H3: only call outcomes count', () => {
  it('excludes archiving from calls today, the streak and the weekly summary', () => {
    const calls = [
      call({ called_at: new Date(NOW.getTime() - HOUR).toISOString() }),
      call({ outcome: 'archived', called_at: new Date(NOW.getTime() - HOUR).toISOString() }),
      call({ outcome: 'archived', called_at: new Date(NOW.getTime() - DAY).toISOString() }),
    ];
    expect(computeCallStats(calls, USER_RECRUITER_1, NOW)).toEqual({ calls_today: 1, streak_days: 1 });
    const weekly = buildWeeklyStats({ health: [], calls, requests: [], shortlists: [], shortlistCandidates: [], now: NOW });
    expect(weekly.calls).toBe(1);
  });

  it('gives Hanna three calls today and a four-day streak in the seed', () => {
    const { calls } = world();
    expect(computeCallStats(calls, USER_RECRUITER_1, NOW)).toEqual({ calls_today: 3, streak_days: 4 });
  });
});

describe('H4: last verified comes from the latest confirmation', () => {
  it('matches the most recent Available or Not available call for every seeded candidate', () => {
    const w = world();
    for (const c of w.candidates.filter((x) => x.deleted_at === null)) {
      const latest = lastVerification(w.callsBy.get(c.id) ?? []);
      expect(c.last_verified_at, c.full_name ?? c.ref_code).toBe(latest?.called_at ?? null);
      if (latest?.outcome === 'available') {
        expect(c.notice_period).toBe(latest.notice_period);
        expect(c.availability_status).toBe('available');
      }
    }
  });

  it('holds whatever time of day the demo starts', () => {
    for (const iso of ['2026-09-16T21:05:00Z', '2026-09-17T20:55:00Z']) {
      const w = world(new Date(iso));
      const meseret = w.view('Meseret Alemu');
      expect(lastVerification(w.callsBy.get(meseret.id)!)!.called_at).toBe(meseret.last_verified_at);
      expect(computeCallStats(w.calls, USER_RECRUITER_1, new Date(iso)).calls_today).toBe(3);
    }
  });
});

describe('H6: nobody is called before they are due', () => {
  it('seeds no call on a candidate whose previous confirmation was still fresh', () => {
    const w = world();
    for (const v of w.views) {
      const history = [...(w.callsBy.get(v.id) ?? [])].reverse();
      for (let i = 1; i < history.length; i++) {
        // Archiving (including placement) is not a call.
        if (history[i].outcome === 'archived') continue;
        const prev = history.slice(0, i).reverse();
        const at = new Date(history[i].called_at);
        const state = callDueState(
          toCandidateView(applyAll(w.candidates.find((c) => c.id === v.id)!, prev), w.archetypes.find((a) => a.id === v.archetype_id)!, at),
          prev,
          at,
        );
        expect(state.kind, `${v.full_name} call ${i}`).not.toBe('not_due');
      }
    }
  });

  it('reports when a fresh candidate is next due', () => {
    const w = world();
    const yonas = w.due('Yonas Haile');
    expect(yonas).toMatchObject({ kind: 'not_due', why: 'fresh' });
  });
});

describe('One call away', () => {
  it('counts expired confirmations, not never-verified or not-yet-recalled', () => {
    const w = world();
    const csr = w.archetypes.find((a) => a.code === 'CSR')!;
    const health = computeBenchHealth(csr, w.views, NOW);
    const expected = w.views.filter((v) => v.archetype_id === csr.id && isOneCallAway(v, NOW));
    expect(health.one_call_away).toBe(expected.length);
    expect(expected.map((v) => v.full_name)).not.toContain('Hiwot Kebede');
    expect(expected.map((v) => v.full_name)).not.toContain('Robel Assefa');
    expect(expected.map((v) => v.full_name)).toContain('Dagmawi Terefe');
  });
});

/** Rebuild the availability a candidate had after a prefix of their calls. */
function applyAll(c: Candidate, callsDesc: CallLog[]): Candidate {
  const blank: Candidate = { ...c, availability_status: 'unknown', last_verified_at: null, recall_at: null, archived_reason: null };
  return [...callsDesc].reverse().reduce(applyCall, blank);
}
