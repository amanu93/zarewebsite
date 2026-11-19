import { describe, expect, it } from 'vitest';

import type { Archetype, BenchHealth, CandidateView, User } from '@/bench/data/types';
import { buildDecayWarnings, buildScarcityAlerts, nextRun } from './index';

const NOW = new Date('2026-09-17T09:00:00Z');

/** Formats a UTC instant as Addis Ababa local time, e.g. "Mon 2026-09-21 07:00". */
const eat = (d: Date) => {
  const local = new Date(d.getTime() + 3 * 3_600_000);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][local.getUTCDay()];
  return `${day} ${local.toISOString().slice(0, 16).replace('T', ' ')}`;
};

describe('job schedules (Africa/Addis_Ababa, UTC+3)', () => {
  // 2026-09-17 is a Thursday.
  it('runs the decay warning on Monday at 07:00', () => {
    expect(eat(nextRun('decay_warning', new Date('2026-09-17T12:37:00Z')))).toBe('Mon 2026-09-21 07:00');
  });

  it('counts the weekday in Addis time, not UTC', () => {
    // Sunday 22:30 UTC is already Monday 01:30 in Addis Ababa.
    expect(eat(nextRun('decay_warning', new Date('2026-09-20T22:30:00Z')))).toBe('Mon 2026-09-21 07:00');
  });

  it('moves to next week once the slot has passed', () => {
    expect(eat(nextRun('decay_warning', new Date('2026-09-21T04:00:00Z')))).toBe('Mon 2026-09-28 07:00');
    expect(eat(nextRun('weekly_summary', new Date('2026-09-18T13:30:00Z')))).toBe('Fri 2026-09-25 16:00');
  });

  it('runs the weekly summary on Friday at 16:00', () => {
    expect(eat(nextRun('weekly_summary', new Date('2026-09-17T12:37:00Z')))).toBe('Fri 2026-09-18 16:00');
  });

  it('checks scarcity at the top of the next hour', () => {
    expect(nextRun('scarcity_check', new Date('2026-09-17T12:37:10Z')).toISOString()).toBe('2026-09-17T13:00:00.000Z');
  });
});

describe('scarcity alerts', () => {
  const health = (status: BenchHealth['status']) =>
    ({ archetype_id: 'a1', code: 'CSR', name: 'Customer Service Representative', status, ready_count: 13, target_ready: 20, one_call_away: 7 }) as BenchHealth;
  const archetype = (last: Archetype['last_health_status']) => ({ id: 'a1', last_health_status: last }) as Archetype;
  const users = [
    { id: 'u1', notify_scarcity: true },
    { id: 'u2', notify_scarcity: false },
  ] as User[];

  it('alerts opted-in users when a role gets worse', () => {
    const result = buildScarcityAlerts({ archetypes: [archetype('green')], health: [health('amber')], users, views: [], now: NOW });
    expect(result.transitions).toHaveLength(1);
    expect(result.alerts.map((a) => a.user.id)).toEqual(['u1']);
    expect(result.nextStatus.a1).toBe('amber');
  });

  it('stays silent on no change and on improvement', () => {
    expect(buildScarcityAlerts({ archetypes: [archetype('amber')], health: [health('amber')], users, views: [], now: NOW }).alerts).toEqual([]);
    expect(buildScarcityAlerts({ archetypes: [archetype('red')], health: [health('amber')], users, views: [], now: NOW }).alerts).toEqual([]);
  });

  it('baselines a role with no recorded status instead of alerting', () => {
    const result = buildScarcityAlerts({ archetypes: [archetype(null)], health: [health('red')], users, views: [], now: NOW });
    expect(result.alerts).toEqual([]);
    expect(result.nextStatus.a1).toBe('red');
  });
});

describe('M11: leaving Ready within 48 hours', () => {
  const users = [
    { id: 'u1', notify_scarcity: true, notify_decay_warning: true },
    { id: 'u2', notify_scarcity: true, notify_decay_warning: true },
  ] as User[];
  const archetypes = [{ id: 'a1', last_health_status: 'green' }] as Archetype[];
  const health = [{ archetype_id: 'a1', status: 'green' }] as BenchHealth[];
  const view = (patch: Partial<CandidateView>) =>
    ({ id: 'c1', owner_id: 'u1', layer: 'ready', expires_at: '2026-09-18T20:00:00Z', ready_exit_alerted_for: null, recall_at: null, ...patch }) as CandidateView;

  it('warns only the owner, once per expiry, without a health change', () => {
    const first = buildScarcityAlerts({ archetypes, health, users, views: [view({})], now: NOW });
    expect(first.alerts.map((a) => a.user.id)).toEqual(['u1']);
    expect(first.alertedLeaving.map((v) => v.id)).toEqual(['c1']);

    const again = buildScarcityAlerts({
      archetypes,
      health,
      users,
      views: [view({ ready_exit_alerted_for: '2026-09-18T20:00:00Z' })],
      now: NOW,
    });
    expect(again.alerts).toEqual([]);
  });

  it('ignores anyone leaving later than 48 hours', () => {
    const later = buildScarcityAlerts({ archetypes, health, users, views: [view({ expires_at: '2026-09-19T10:00:00Z' })], now: NOW });
    expect(later.alerts).toEqual([]);
  });

  it('keeps the Monday decay warning, including not-available recalls', () => {
    const warnings = buildDecayWarnings({
      views: [view({ layer: 'known', availability_status: 'not_available', expires_at: null, recall_at: '2026-09-20' })],
      users,
      now: NOW,
    });
    expect(warnings[0].recalls).toHaveLength(1);
  });
});
