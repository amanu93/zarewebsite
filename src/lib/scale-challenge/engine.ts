/**
 * The Scale Challenge — pure game formulas, ported line-for-line from the
 * v2 mockup engine (see plan header for the spec path). No DOM, no React:
 * everything here is unit-tested.
 */
import {
  ROLES, LEAD_ROLES, TALENT, MISSIONS, RANKS,
  type RoleKey, type SourceIndex, type Candidate, type Mission,
} from '@/content/scale-challenge';

export interface Mods {
  costMult: number;
  capDelta: number;
  evPts: number;
  deadlineCut: number;
}

export const EMPTY_MODS: Mods = { costMult: 1, capDelta: 0, evPts: 0, deadlineCut: 0 };

export interface TeamState {
  mi: number;
  team: Partial<Record<RoleKey, SourceIndex>>;
  mods: Mods;
}

export interface PickedCandidate extends Candidate {
  si: SourceIndex;
  role: RoleKey;
}

export interface Calc {
  m: Mission;
  months: number;
  picked: (PickedCandidate | null)[];
  filled: PickedCandidate[];
  spent: number;
  localSame: number;
  localAll: number;
  outAll: number;
  nLocal: number;
  nOut: number;
  nEmb: number;
  hasLead: boolean;
  synergy: boolean;
  avgSkill: number;
  avgInteg: number;
  avgFlex: number;
  avgDeploy: number;
  maxDeploy: number;
  cap: number;
  effDays: number;
  tradMax: number;
  localCapFull: number;
}

export function calc(st: TeamState): Calc {
  const m = MISSIONS[st.mi];
  const months = m.days / 30;
  const picked = m.roles.map((k): PickedCandidate | null => {
    const si = st.team[k];
    return si != null ? { ...TALENT[k][si], si, role: k } : null;
  });
  const filled = picked.filter((p): p is PickedCandidate => p !== null);
  const spent = filled.reduce((a, c) => a + c.monthly, 0) * months * st.mods.costMult;
  const localSame = filled.reduce((a, c) => a + TALENT[c.role][0].monthly, 0) * months;
  const localAll = m.roles.reduce((a, k) => a + TALENT[k][0].monthly, 0) * months;
  const outAll = m.roles.reduce((a, k) => a + TALENT[k][1].monthly, 0) * months;
  const nLocal = filled.filter((c) => c.si === 0).length;
  const nOut = filled.filter((c) => c.si === 1).length;
  const nEmb = filled.filter((c) => c.si === 2).length;
  // internal management: a lead role filled client-side (local or embedded)
  const hasLead = m.roles.some((k, i) => LEAD_ROLES.includes(k) && picked[i] !== null && picked[i]!.si !== 1);
  const synergy = hasLead && nEmb >= 2;
  const avgSkill = filled.length ? filled.reduce((a, c) => a + c.skill, 0) / filled.length : 0;
  let avgInteg = filled.length ? filled.reduce((a, c) => a + c.integ, 0) / filled.length : 0;
  if (synergy) avgInteg = Math.min(100, avgInteg * 1.15);
  const avgFlex = filled.length ? filled.reduce((a, c) => a + c.flex, 0) / filled.length : 0;
  const avgDeploy = filled.length ? filled.reduce((a, c) => a + c.deploy, 0) / filled.length : 0;
  const maxDeploy = filled.length ? Math.max(...filled.map((c) => c.deploy)) : 0;
  // management fit: without an internal lead, client-managed people
  // underperform; outsourcing shines
  let mgmtAdj = 0;
  if (filled.length) {
    if (!hasLead) mgmtAdj = nOut > 0 ? -3 * (nLocal + nEmb) + 3 : -4 * (nLocal + nEmb);
    else mgmtAdj = 2;
  }
  let cap = filled.length
    ? avgSkill * 0.6 + avgInteg * 0.4 + st.mods.capDelta + mgmtAdj
    : 0;
  if (synergy) cap *= 1.12;
  cap = Math.max(0, Math.min(100, Math.round(cap)));
  const effDays = m.days - st.mods.deadlineCut;
  const tradMax = Math.max(...m.roles.map((k) => TALENT[k][0].deploy));
  const localCapFull = Math.round(
    m.roles.reduce((a, k) => a + TALENT[k][0].skill * 0.6 + TALENT[k][0].integ * 0.4, 0) / m.roles.length + 2,
  );
  return {
    m, months, picked, filled, spent, localSame, localAll, outAll,
    nLocal, nOut, nEmb, hasLead, synergy, avgSkill, avgInteg, avgFlex,
    avgDeploy, maxDeploy, cap, effDays, tradMax, localCapFull,
  };
}

export function score(c: Calc, mods: Mods): number {
  let s = 0;
  s += 260 * Math.max(0, Math.min(1, (c.localAll - c.spent) / c.localAll / 0.6));
  s += 260 * (c.cap / 100);
  s += 180 * Math.max(0, Math.min(1, 1 - (c.maxDeploy - 4) / 42));
  s += 120 * Math.max(0, Math.min(1, (c.avgFlex - 40) / 55));
  s += c.hasLead ? 80 : c.nOut >= c.filled.length - 1 ? 60 : 20;
  s += Math.max(0, Math.min(100, mods.evPts));
  if (c.spent > c.m.budget) s -= 120;
  return Math.max(0, Math.min(1000, Math.round(s)));
}

export function archetype(c: Calc): [string, string] {
  const n = c.filled.length || 1;
  if (c.synergy && c.nEmb >= 2) return ['The Team Extender', 'Internal leadership plus embedded execution — capacity without the overhead.'];
  if (c.nLocal / n >= 0.6) return ['The Institution Builder', 'A strong permanent team — with the burn and hiring timeline to match.'];
  if (c.nOut / n >= 0.6) return ['The Outcome Buyer', 'You handed execution to external vendors and kept your management load low.'];
  if (c.maxDeploy <= 10) return ['The Hyper Scaler', 'Full team live in days, not months. Speed is your weapon.'];
  if (c.nLocal > 0 && c.nOut > 0 && c.nEmb > 0) return ['The Portfolio Strategist', 'Hire, outsource, and embed — each where it fits best.'];
  return ['The Balanced Builder', 'A pragmatic mix of speed, control, and spend.'];
}

export function insight(c: Calc): string {
  const n = c.filled.length || 1;
  if (c.synergy) return 'You embedded specialists around your existing leadership — team integration rose 15% and delivery velocity 12%. This is where embedded talent compounds: internal management plus external execution capacity.';
  if (c.nLocal / n >= 0.6) return 'You relied heavily on local hiring, creating a strong permanent team but significantly increasing your burn and your time to full capacity (' + c.maxDeploy + ' days).';
  if (c.nOut / n >= 0.6) return 'You outsourced most of the mission — fast to start and light to manage, but agency margins raised the cost and the team stayed outside your organization.';
  if (c.nOut > 0 && c.nEmb > 0) return 'You outsourced defined deliverables but embedded ongoing operational roles — external vendors own outcomes while embedded talent builds your internal capacity.';
  if (c.nEmb / n >= 0.6) return 'You used embedded talent to expand execution capacity while keeping spend at ' + Math.round((c.spent / c.localAll) * 100) + '% of a fully local model.';
  return 'You balanced hiring models across the mission — no single model wins everywhere; the mix is the strategy.';
}

export function fmtUsd(n: number): string {
  return '$' + Math.max(0, Math.round(n / 100) * 100).toLocaleString('en-US');
}

/**
 * Strategist rank for a score. RANKS is ordered high to low and ends at 0,
 * so the find always resolves — the fallback exists only to satisfy the
 * compiler, not because a score can miss.
 */
export function rank(score: number): string {
  return (RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1]).name;
}

/** Filled stars out of 5, as the results screen shows them. */
export function scoreStars(score: number): number {
  return Math.max(0, Math.min(5, Math.round(score / 200)));
}

export { ROLES, LEAD_ROLES, TALENT, MISSIONS, RANKS };
