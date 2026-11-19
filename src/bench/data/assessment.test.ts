import { describe, expect, it } from 'vitest';

import { findLeaks } from '@/bench/export/shortlist';
import {
  ASSESSMENT_STALE_DAYS,
  assessmentTextWarnings,
  compareByOverall,
  isReassessDue,
  overallBasis,
  recalculateOverall,
  shortlistWarnings,
  toCandidateView,
} from './logic';
import { seedArchetypes, seedCandidates } from './seed';
import type { CandidateView } from './types';

const NOW = new Date('2026-09-17T09:00:00Z');
const CSR = { communication_weight: 0.7, technical_weight: 0.3 };

function views() {
  const t = NOW.getTime();
  const archetypes = seedArchetypes(t);
  return seedCandidates(t)
    .candidates.filter((c) => c.deleted_at === null)
    .map((c) => toCandidateView(c, archetypes.find((a) => a.id === c.archetype_id)!, NOW));
}

describe('M8: stale assessments', () => {
  it('flags at 180 calendar days, one constant', () => {
    expect(ASSESSMENT_STALE_DAYS).toBe(180);
    expect(isReassessDue('2026-03-21T09:00:00Z', NOW)).toBe(true); // 180 days
    expect(isReassessDue('2026-03-22T09:00:00Z', NOW)).toBe(false); // 179 days
    expect(isReassessDue(null, NOW)).toBe(false);
  });

  it('flags Kirubel on the profile and warns on a shortlist, without blocking', () => {
    const kirubel = views().find((v) => v.full_name === 'Kirubel Haile')!;
    expect(kirubel.reassess_due).toBe(true);
    expect(shortlistWarnings(kirubel, { required_by: null }, null)[0]).toMatch(/Re-assess/);
  });
});

describe('M2: overall always uses the role weights', () => {
  it('labels an overall without the optional technical score as communication only', () => {
    expect(overallBasis({ overall_score: 4.2, communication_score: 4.2, technical_score: null }, CSR)).toBe('communication_only');
    expect(overallBasis({ overall_score: 4.2, communication_score: 4, technical_score: 4.7 }, CSR)).toBe('weighted');
    expect(overallBasis({ overall_score: 4.2, communication_score: 4.2, technical_score: null }, { technical_weight: 0 })).toBe('weighted');
    expect(overallBasis({ overall_score: null, communication_score: null, technical_score: null }, CSR)).toBeNull();
  });

  it('sorts a weighted score above a communication-only score of the same value', () => {
    const a = { overall_score: 4.4, overall_basis: 'communication_only' as const };
    const b = { overall_score: 4.4, overall_basis: 'weighted' as const };
    const c = { overall_score: 4.5, overall_basis: 'communication_only' as const };
    expect([a, b, c].sort(compareByOverall)).toEqual([c, b, a]);
  });

  it('recalculates with new weights and keeps a manual adjustment', () => {
    const base = { communication_score: 4.0, technical_score: 5.0, overall_score: 4.6, overall_score_calculated: 4.3, overall_override_reason: 'Led the platform migration' };
    const next = recalculateOverall(base, { communication_weight: 0.4, technical_weight: 0.6 });
    expect(next.overall_score_calculated).toBe(4.6);
    expect(next.overall_score).toBe(4.9);
    expect(next.overall_override_reason).toBe('Led the platform migration');

    const plain = recalculateOverall({ ...base, overall_score: 4.3, overall_override_reason: null }, { communication_weight: 0.4, technical_weight: 0.6 });
    expect(plain.overall_score).toBe(4.6);

    const capped = recalculateOverall({ ...base, communication_score: 5, technical_score: 5, overall_score: 5, overall_score_calculated: 4.6 }, CSR);
    expect(capped.overall_score).toBe(5);
  });
});

describe('M5: assessment text stays about the work', () => {
  it('warns on availability or calls in strengths and consideration', () => {
    expect(assessmentTextWarnings({ strengths: ['Clear writer', 'Calm'], concern: 'Availability has never been confirmed' })).toHaveLength(1);
    expect(assessmentTextWarnings({ strengths: ['Did not answer twice', 'Calm'], concern: 'x' })[0]).toMatch(/calls/);
    expect(assessmentTextWarnings({ strengths: ['Calm with hostile callers', 'Good on voice calls'], concern: 'Limited night shifts' })).toEqual([]);
  });

  it('seeds no assessed candidate whose text would warn or block', () => {
    for (const v of views().filter((x) => x.assessed_at && x.layer !== 'archived')) {
      expect(assessmentTextWarnings(v), v.full_name ?? v.ref_code).toEqual([]);
      expect(findLeaks([v as CandidateView]), v.full_name ?? v.ref_code).toEqual([]);
    }
    const hiwot = views().find((v) => v.full_name === 'Hiwot Kebede')!;
    expect(hiwot.concern).not.toMatch(/availab/i);
  });
});
