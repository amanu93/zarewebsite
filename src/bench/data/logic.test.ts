import { describe, expect, it } from 'vitest';

import {
  applyOverallScore,
  calculateOverall,
  deriveLayer,
  exportBlockReason,
  healthStatus,
  overallScoreProblem,
  roleIdentityProblem,
  scoreLabel,
  validateAssessment,
  type AssessmentInput,
} from './logic';
import { seedArchetypes, seedCandidates } from './seed';
import type { Candidate, CandidateView } from './types';

const DAY = 86_400_000;
const CSR = { communication_weight: 0.7, technical_weight: 0.3 };
const SWE = { communication_weight: 0.4, technical_weight: 0.6 };
const NOW = new Date('2026-09-17T09:00:00Z');

const candidate = (patch: Partial<Candidate>): Candidate =>
  ({
    archived_reason: null,
    assessed_at: '2026-06-01T00:00:00Z',
    availability_status: 'available',
    last_verified_at: new Date(NOW.getTime() - 5 * DAY).toISOString(),
    ...patch,
  }) as Candidate;

describe('deriveLayer (candidates_view CASE)', () => {
  it('archived wins over everything', () => {
    expect(deriveLayer(candidate({ archived_reason: 'took_other_job' }), 30, NOW)).toBe('archived');
  });

  it('unassessed is raw even when freshly verified', () => {
    expect(deriveLayer(candidate({ assessed_at: null }), 30, NOW)).toBe('raw');
  });

  it('available and inside the window is ready', () => {
    expect(deriveLayer(candidate({}), 30, NOW)).toBe('ready');
  });

  it('the freshness boundary is exclusive', () => {
    const exactlyThirtyDays = new Date(NOW.getTime() - 30 * DAY).toISOString();
    expect(deriveLayer(candidate({ last_verified_at: exactlyThirtyDays }), 30, NOW)).toBe('known');
  });

  it('not available or never verified is known', () => {
    expect(deriveLayer(candidate({ availability_status: 'not_available' }), 30, NOW)).toBe('known');
    expect(deriveLayer(candidate({ last_verified_at: null }), 30, NOW)).toBe('known');
  });
});

describe('bench health thresholds', () => {
  it('green at target, amber from 60%, red below', () => {
    expect(healthStatus(20, 20)).toBe('green');
    expect(healthStatus(12, 20)).toBe('amber');
    expect(healthStatus(11, 20)).toBe('red');
  });
});

describe('calculated overall score (0005)', () => {
  it('uses the only sub-score in full when the other is missing', () => {
    expect(calculateOverall(CSR, 4.6, null)).toBe(4.6);
  });

  it('weights by role', () => {
    expect(calculateOverall(SWE, 4.4, 4.7)).toBe(4.6); // 4.58
    expect(calculateOverall(SWE, 4.0, 4.1)).toBe(4.1); // 4.06
  });

  it('rounds exact halves up, like Postgres round(numeric)', () => {
    const even = { communication_weight: 0.5, technical_weight: 0.5 };
    expect(calculateOverall(even, 4.4, 4.5)).toBe(4.5); // 4.45
    expect(calculateOverall(even, 1.0, 1.1)).toBe(1.1); // 1.05
  });

  it('is null with nothing to calculate from', () => {
    expect(calculateOverall(SWE, null, null)).toBeNull();
  });

  it('allows an override of up to 0.5, with a reason', () => {
    const base = { overall_score_calculated: 4.2, overall_override_reason: null };
    expect(overallScoreProblem({ ...base, overall_score: 4.2 })).toBeNull();
    expect(overallScoreProblem({ ...base, overall_score: 4.7, overall_override_reason: 'Led a team of twelve' })).toBeNull();
    expect(overallScoreProblem({ ...base, overall_score: 4.8, overall_override_reason: 'Led a team of twelve' })).toMatch(/at most/);
    expect(overallScoreProblem({ ...base, overall_score: 4.4 })).toMatch(/Explain/);
    expect(overallScoreProblem({ ...base, overall_score: 4.4, overall_override_reason: 'ok' })).toMatch(/Explain/);
  });

  it('defaults overall to the calculation and drops a stale reason', () => {
    const applied = applyOverallScore(
      { communication_score: 4.4, technical_score: 4.7, overall_score: null, overall_score_calculated: null, overall_override_reason: 'stale' },
      SWE,
    );
    expect([applied.overall_score, applied.overall_score_calculated, applied.overall_override_reason]).toEqual([4.6, 4.6, null]);
  });
});

describe('export rules', () => {
  it('labels scores and refuses anything below 3.5', () => {
    expect(scoreLabel(4.5)).toBe('Excellent');
    expect(scoreLabel(4.0)).toBe('Strong');
    expect(scoreLabel(3.5)).toBe('Good');
    expect(scoreLabel(3.4)).toBeNull();
  });

  it('asks for a verification call before anything else', () => {
    const known = { layer: 'known', overall_score: 4.5, concern: 'x', strengths: ['a', 'b'] } as CandidateView;
    expect(exportBlockReason(known)).toBe('Verify availability first.');
  });
});

describe('assessment validation', () => {
  const valid: AssessmentInput = {
    years_experience: 5,
    seniority: 'senior',
    english_level: 'C1',
    stack: [],
    skills: [],
    communication_score: 4.2,
    technical_score: 4.6,
    overall_score: null,
    overall_override_reason: null,
    strengths: ['Owns production systems', 'Reviews carefully'],
    concern: 'Small teams only so far',
    notes: null,
    shift_flexibility: [],
    setup_verified: false,
  };

  it('accepts a complete assessment', () => {
    expect(validateAssessment(valid, SWE)).toEqual({});
  });

  it('requires exactly two strengths and a consideration', () => {
    const errors = validateAssessment({ ...valid, strengths: ['Only one', ''], concern: '' }, SWE);
    expect(errors['strengths.1']).toBeDefined();
    expect(errors.concern).toBeDefined();
  });

  it('requires a technical score where it carries most of the overall', () => {
    expect(validateAssessment({ ...valid, technical_score: null }, SWE).technical_score).toBeDefined();
    expect(validateAssessment({ ...valid, technical_score: null }, CSR).technical_score).toBeUndefined();
  });
});

describe('seed', () => {
  it('satisfies the constraints the database would enforce', () => {
    const now = NOW.getTime();
    const { candidates } = seedCandidates(now);
    const archetypes = seedArchetypes(now);
    expect(candidates.length).toBeGreaterThanOrEqual(40);
    for (const c of candidates) {
      expect(overallScoreProblem(c)).toBeNull();
      if (c.assessed_at) {
        expect(c.strengths).toHaveLength(2);
        expect(c.concern).toBeTruthy();
      }
    }
    expect(archetypes.every((a) => Math.round((a.communication_weight + a.technical_weight) * 100) === 100)).toBe(true);
  });
});

describe('roleIdentityProblem', () => {
  const existing = [
    { name: 'Software Engineer', code: 'SWE' },
    { name: 'Customer Service Representative', code: 'CSR' },
  ];

  it('accepts a new name and code', () => {
    expect(roleIdentityProblem({ name: 'Sales Development Representative', code: 'sdr' }, existing)).toEqual({});
  });

  it('rejects a code already in use, whatever its case', () => {
    expect(roleIdentityProblem({ name: 'Senior Engineer', code: 'swe' }, existing).code).toBe('This code is already used.');
  });

  it('rejects a name already in use, whatever its case or spacing', () => {
    expect(roleIdentityProblem({ name: '  software engineer ', code: 'SE2' }, existing).name).toBe(
      'A role with this name already exists.',
    );
  });

  it('requires a 2–8 character alphanumeric code', () => {
    expect(roleIdentityProblem({ name: 'Designer', code: 'D' }, existing).code).toBeTruthy();
    expect(roleIdentityProblem({ name: 'Designer', code: 'UX-UI' }, existing).code).toBeTruthy();
    expect(roleIdentityProblem({ name: 'Designer', code: 'TOOLONGCODE' }, existing).code).toBeTruthy();
  });

  it('requires a name', () => {
    expect(roleIdentityProblem({ name: ' ', code: 'DES' }, existing).name).toBe('Give the role a name.');
  });
});
