import { describe, it, expect } from 'vitest';
import { calc, score, archetype, insight, fmtUsd, rank, scoreStars, EMPTY_MODS, type TeamState } from './engine';
import { MISSIONS, TALENT } from '@/content/scale-challenge';

const full = (mi: number, si: 0 | 1 | 2): TeamState => ({
  mi,
  team: Object.fromEntries(MISSIONS[mi].roles.map((r) => [r, si])),
  mods: { ...EMPTY_MODS },
});

describe('calc', () => {
  it('computes spend as monthly total × months × costMult', () => {
    const st = full(0, 2); // all embedded, mission 0 (90 days = 3 months)
    const c = calc(st);
    const monthly = MISSIONS[0].roles.reduce((a, r) => a + TALENT[r][2].monthly, 0);
    expect(c.spent).toBeCloseTo(monthly * 3);
    expect(c.filled).toHaveLength(5);
  });

  it('all-embedded beats all-local on cost and deploy for every mission', () => {
    for (let mi = 0; mi < MISSIONS.length; mi++) {
      const emb = calc(full(mi, 2));
      const loc = calc(full(mi, 0));
      expect(emb.spent).toBeLessThan(loc.spent);
      expect(emb.maxDeploy).toBeLessThan(loc.maxDeploy);
    }
  });

  it('synergy requires an internal lead plus ≥2 embedded', () => {
    // mission 0 lead is pm. All-embedded: lead is embedded (internal) → synergy.
    expect(calc(full(0, 2)).synergy).toBe(true);
    // all-outsourced: no internal lead → no synergy.
    expect(calc(full(0, 1)).synergy).toBe(false);
  });

  it('empty team yields zero capacity and no crash', () => {
    const c = calc({ mi: 0, team: {}, mods: { ...EMPTY_MODS } });
    expect(c.cap).toBe(0);
    expect(c.filled).toHaveLength(0);
  });
});

describe('score', () => {
  it('stays within 0..1000 for every uniform strategy on every mission', () => {
    for (let mi = 0; mi < MISSIONS.length; mi++) {
      for (const si of [0, 1, 2] as const) {
        const st = full(mi, si);
        const s = score(calc(st), st.mods);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('penalises going over budget', () => {
    const st = full(0, 0); // all local on mission 0 blows the budget
    const c = calc(st);
    expect(c.spent).toBeGreaterThan(c.m.budget);
    // same configuration with spend clamped to budget scores at least the
    // 120-point penalty higher (plus any savings-term gain)
    expect(score({ ...c, spent: c.m.budget }, st.mods) - score(c, st.mods)).toBeGreaterThanOrEqual(120);
  });

  it('event points add to the score', () => {
    const st = full(0, 2);
    const base = score(calc(st), st.mods);
    const boosted = score(calc(st), { ...st.mods, evPts: 55 });
    expect(boosted).toBe(Math.min(1000, base + 55));
  });
});

describe('archetype & insight', () => {
  it('all-embedded with internal lead is The Team Extender', () => {
    expect(archetype(calc(full(0, 2)))[0]).toBe('The Team Extender');
  });
  it('all-local is The Institution Builder', () => {
    expect(archetype(calc(full(0, 0)))[0]).toBe('The Institution Builder');
  });
  it('all-outsourced is The Outcome Buyer', () => {
    expect(archetype(calc(full(0, 1)))[0]).toBe('The Outcome Buyer');
  });
  it('insight is non-empty for every uniform strategy', () => {
    for (const si of [0, 1, 2] as const) {
      expect(insight(calc(full(0, si))).length).toBeGreaterThan(20);
    }
  });
});

describe('fmtUsd', () => {
  it('rounds to hundreds with $ prefix', () => {
    expect(fmtUsd(123456)).toBe('$123,500');
    expect(fmtUsd(0)).toBe('$0');
  });
});

describe('rank', () => {
  // Thresholds are the spec's, inclusive at the boundary
  // (claude-code-prompt.md: "≥850 ELITE STRATEGIST · ≥700 …").
  it('maps each band, and is inclusive at its floor', () => {
    expect(rank(1000)).toBe('ELITE STRATEGIST');
    expect(rank(850)).toBe('ELITE STRATEGIST');
    expect(rank(849)).toBe('SENIOR STRATEGIST');
    expect(rank(700)).toBe('SENIOR STRATEGIST');
    expect(rank(699)).toBe('STRATEGIST');
    expect(rank(550)).toBe('STRATEGIST');
    expect(rank(549)).toBe('OPERATOR');
    expect(rank(400)).toBe('OPERATOR');
    expect(rank(399)).toBe('ROOKIE');
    expect(rank(0)).toBe('ROOKIE');
  });
});

describe('scoreStars', () => {
  it('is score/200 rounded, clamped to 0..5', () => {
    expect(scoreStars(0)).toBe(0);
    expect(scoreStars(300)).toBe(2); // 1.5 rounds up
    expect(scoreStars(500)).toBe(3);
    expect(scoreStars(1000)).toBe(5);
  });
});
