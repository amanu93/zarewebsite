import { describe, expect, it } from 'vitest';

import type { CandidateView } from '@/bench/data/types';
import { findLeaks, toExportCandidate } from './shortlist';

const view = (patch: Partial<CandidateView> = {}): CandidateView =>
  ({
    ref_code: 'ZT-0042',
    full_name: 'Selam Worku',
    phone: '+251 911 555 0199',
    email: 'selam.worku@example.com',
    linkedin_url: 'https://www.linkedin.com/in/selam',
    notes: 'Referred by a friend. Salary expectation 80,000 birr.',
    location: 'Addis Ababa',
    years_experience: 5,
    seniority: 'senior',
    stack: ['React'],
    skills: [],
    english_level: 'C1',
    overall_score: 4.6,
    communication_score: 4.2,
    technical_score: 4.7,
    earliest_start_date: null,
    notice_period: '1 month',
    shift_flexibility: ['Day'],
    setup_verified: true,
    strengths: ['Owns production systems', 'Reviews carefully'],
    concern: 'Small teams only so far',
    ...patch,
  }) as CandidateView;

describe('client export whitelist', () => {
  it('carries no identity, contact, pay or internal notes', () => {
    const exported = JSON.stringify(toExportCandidate(view(), '2026-09-10T00:00:00Z'));
    for (const secret of ['Selam', 'Worku', '0199', 'example.com', 'linkedin', 'Referred', 'birr', 'Addis']) {
      expect(exported).not.toContain(secret);
    }
    expect(exported).toContain('ZT-0042');
  });
});

describe('findLeaks', () => {
  it('passes clean assessment text', () => {
    expect(findLeaks([view()])).toEqual([]);
  });

  it('catches a name, a contact detail or pay in the free text', () => {
    expect(findLeaks([view({ strengths: ['Selam led the migration', 'Reviews carefully'] })])).toHaveLength(1);
    expect(findLeaks([view({ concern: 'Call on 555 0199 first' })])).toHaveLength(1);
    expect(findLeaks([view({ concern: 'Salary expectation is above the band' })])).toHaveLength(1);
  });
});

describe('findLeaks, hardened in the audit', () => {
  it('catches location, links, short names and salary in other words', () => {
    const reasons = (patch: Partial<CandidateView>) => findLeaks([view(patch)]).map((l) => l.reason).join(' | ');
    expect(reasons({ concern: 'Based in Addis Ababa only' })).toMatch(/location/);
    expect(reasons({ strengths: ['Portfolio at github.com/octo', 'Reviews carefully'] })).toMatch(/link/);
    expect(findLeaks([view({ full_name: 'Li Wei', strengths: ['Li led the migration', 'Reviews carefully'] })])[0].reason).toMatch(/name/);
    for (const concern of ['Wants 80k a month', 'Expects 45,000 per month', 'Current payment is high', 'Asked for €2000']) {
      expect(findLeaks([view({ concern })]).some((l) => /salary/.test(l.reason)), concern).toBe(true);
    }
  });

  it('does not flag ordinary work language', () => {
    expect(findLeaks([view({ strengths: ['Handles payroll software support', 'Calm on voice calls'], concern: 'Limited night shifts' })])).toEqual([]);
  });

  it('only accepts notice periods from the standard answers', () => {
    expect(findLeaks([view({ notice_period: 'call Selam first' })]).length).toBeGreaterThan(0);
  });
});
