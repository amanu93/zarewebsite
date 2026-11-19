import { describe, expect, it } from 'vitest';

import { daysFromToday, expiryLabel } from '@/bench/dates';
import { findDuplicates, normalizePhone, normalizeTag, PHONE_ERROR, toCandidateView, validateContact } from './logic';
import { seedArchetypes, seedCandidates } from './seed';

const NOW = new Date('2026-09-17T09:00:00Z');

function views() {
  const t = NOW.getTime();
  const archetypes = seedArchetypes(t);
  return seedCandidates(t)
    .candidates.filter((c) => c.deleted_at === null)
    .map((c) => toCandidateView(c, archetypes.find((a) => a.id === c.archetype_id)!, NOW));
}

describe('M6: phone numbers and duplicates', () => {
  it('reads an Ethiopian number the same however it is typed', () => {
    for (const raw of ['0911 234 567', '911234567', '+251 911 234 567', '251911234567', '+251-911-234-567']) {
      expect(normalizePhone(raw), raw).toBe('+251911234567');
    }
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects anything that is not a phone number', () => {
    for (const raw of ['', '12345', '+251 811 234 567', '0911 234 56', 'call me', '+1 234']) {
      expect(normalizePhone(raw), raw).toBeNull();
    }
    const base = { full_name: 'Abebe Kebede', email: '', location: '', linkedin_url: '' };
    expect(validateContact({ ...base, phone: '0911' }).phone).toBe(PHONE_ERROR);
    expect(validateContact({ ...base, phone: '0911 234 567' })).toEqual({});
  });

  it('blocks an exact phone match and only warns on a name match', () => {
    const all = views();
    const meseret = all.find((v) => v.full_name === 'Meseret Alemu')!;
    const samePhone = findDuplicates({ full_name: 'Someone Else', phone: meseret.phone!.replace('+251', '0'), email: '' }, all);
    expect(samePhone.phone.map((v) => v.id)).toEqual([meseret.id]);

    const sameName = findDuplicates({ full_name: ' meseret  alemu ', phone: '0911 999 888', email: '' }, all);
    expect(sameName.phone).toEqual([]);
    expect(sameName.similar.map((v) => v.id)).toEqual([meseret.id]);

    // Editing her own record is not a duplicate of herself.
    expect(findDuplicates({ full_name: meseret.full_name!, phone: meseret.phone!, email: meseret.email! }, all, meseret.id)).toEqual({
      phone: [],
      similar: [],
    });
  });
});

describe('M7: tags compare the same everywhere', () => {
  it('ignores case, spaces and dots', () => {
    expect(new Set(['Node.js', 'NodeJS', 'node js', ' NODE.JS '].map(normalizeTag)).size).toBe(1);
    expect(normalizeTag('Zendesk')).toBe(normalizeTag('zendesk'));
  });
});

describe('M9: day counts in calendar days, Africa/Nairobi', () => {
  it('shows 30 days to 17 Oct on 17 Sept, and 0 on the day of expiry', () => {
    expect(expiryLabel(daysFromToday('2026-10-17', NOW))).toBe('30d left');
    expect(expiryLabel(daysFromToday('2026-09-17T20:00:00Z', NOW))).toBe('expires today');
  });

  it("counts Bereket's overdue days by date, not 24-hour periods", () => {
    const bereket = views().find((v) => v.full_name === 'Bereket Solomon')!;
    // Verified 40 calendar days ago on a 30-day window: 10 days overdue, at any hour.
    expect(bereket.days_until_expiry).toBe(-10);
    const lateEvening = new Date('2026-09-17T20:30:00Z'); // 23:30 EAT, same day
    expect(daysFromToday(bereket.expires_at, lateEvening)).toBe(-10);
  });
});
