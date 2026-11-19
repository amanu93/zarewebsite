'use client';

import { useReducer, useSyncExternalStore } from 'react';

import { IconRocket, IconHeadset, IconWorld } from '@tabler/icons-react';

import { MonoLabel } from '@/components/typography/mono-label';
import {
  EVENTS, MISSIONS, SOURCES, TALENT,
  type MissionIcon,
  START_PILL, START_TITLE, START_SUBLINE, START_BODY, START_TRADEOFFS,
  START_WALKAWAY_TITLE, START_WALKAWAY, START_CTA, START_CHIPS,
  MISSION_STEP_LABEL, MISSION_INTRO,
  type RoleKey, type SourceIndex, type EventChoiceEffect,
} from '@/content/scale-challenge';
import { EMPTY_MODS, fmtUsd, type Mods } from '@/lib/scale-challenge/engine';
import { cn } from '@/lib/utils';
import { Board } from './board';
import { Results } from './results';

export interface GameState {
  phase: 'start' | 'missions' | 'play' | 'results';
  mi: number;
  team: Partial<Record<RoleKey, SourceIndex>>;
  selRole: RoleKey | null;
  fired: number[];
  activeEvent: number | null;
  mods: Mods;
  toast: string | null;
  deploy: { srcIdx: SourceIndex; days: number; step: number } | null;
}

export type GameAction =
  | { type: 'start' }
  | { type: 'pickMission'; mi: number }
  | { type: 'selectRole'; role: RoleKey }
  | { type: 'pickCandidate'; role: RoleKey; si: SourceIndex }
  | { type: 'deployStep' }
  | { type: 'deployDone' }
  | { type: 'eventChoice'; effect: EventChoiceEffect }
  | { type: 'clearToast' }
  | { type: 'launch' }
  | { type: 'playAgain' };

const INITIAL: GameState = {
  phase: 'start', mi: 0, team: {}, selRole: null, fired: [],
  activeEvent: null, mods: { ...EMPTY_MODS }, toast: null, deploy: null,
};

export function reducer(st: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'start':
      return { ...st, phase: 'missions' };
    case 'pickMission':
      return {
        ...INITIAL, phase: 'play', mi: a.mi,
        selRole: MISSIONS[a.mi].roles[0],
      };
    case 'selectRole':
      return { ...st, selRole: a.role };
    case 'pickCandidate': {
      const team = { ...st.team, [a.role]: a.si };
      const roles = MISSIONS[st.mi].roles;
      const filledN = roles.filter((k) => team[k] != null).length;
      const next = roles.find((k) => team[k] == null) ?? null;
      const ev = EVENTS.findIndex((e, ei) => e.at === filledN && !st.fired.includes(ei));
      const cand = a.si;
      return {
        ...st, team, selRole: next,
        activeEvent: ev >= 0 ? ev : null,
        fired: ev >= 0 ? [...st.fired, ev] : st.fired,
        // deploy panel only when no event interrupts (mockup behaviour)
        deploy: ev >= 0 ? null : { srcIdx: cand, days: TALENT[a.role][cand].deploy, step: 0 },
      };
    }
    case 'deployStep':
      return st.deploy ? { ...st, deploy: { ...st.deploy, step: st.deploy.step + 1 } } : st;
    case 'deployDone':
      return { ...st, deploy: null };
    case 'eventChoice': {
      const mods = { ...st.mods };
      if (a.effect.costMult) mods.costMult *= a.effect.costMult;
      if (a.effect.capDelta) mods.capDelta += a.effect.capDelta;
      if (a.effect.evPts) mods.evPts += a.effect.evPts;
      if (a.effect.deadlineCut) mods.deadlineCut += a.effect.deadlineCut;
      return { ...st, mods, activeEvent: null, toast: a.effect.toast };
    }
    case 'clearToast':
      return { ...st, toast: null };
    case 'launch':
      return { ...st, phase: 'results', deploy: null, toast: null };
    case 'playAgain':
      return { ...INITIAL, phase: 'missions' };
  }
}

/**
 * Mission key → mark. Lives here rather than in the content module so that
 * file stays plain data: launch, support, and reach into a new region.
 */
const MISSION_ICONS: Record<MissionIcon, typeof IconRocket> = {
  rocket: IconRocket,
  support: IconHeadset,
  expand: IconWorld,
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/**
 * The media query is an external store, not React state: reading it through
 * useSyncExternalStore keeps the server snapshot false (no motion assumptions
 * during SSR) without the effect-then-setState cascade.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export function ScaleChallengeGame() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // `sc-stage` is the v3 mockup's ground: ink base, two drifting glows, and
  // the 44px grid panning under a radial mask. It replaces the site-wide
  // `data-atmosphere` here — the game has its own weather.
  return (
    <div
      data-tone="ink"
      className="sc-stage relative overflow-hidden text-on-dark min-h-[calc(100svh-76px)] md:min-h-[calc(100svh-96px)]"
    >
      <span aria-hidden="true" className="sc-orb sc-orb-a" />
      <span aria-hidden="true" className="sc-orb sc-orb-b" />

      {state.phase === 'start' && <Intro onStart={() => dispatch({ type: 'start' })} />}
      {state.phase === 'missions' && (
        <Missions onPick={(mi) => dispatch({ type: 'pickMission', mi })} />
      )}
      {state.phase === 'play' && <Board state={state} dispatch={dispatch} />}
      {state.phase === 'results' && <Results state={state} dispatch={dispatch} />}
    </div>
  );
}

/**
 * The start screen, to the v3 mockup: pill, split title, subline, body, the
 * three OPTION cards, the walk-away panel, then the CTA and its chips.
 */
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto flex max-w-[980px] flex-col items-center px-5 py-20 text-center md:py-28">
      <span className="sc-pill inline-flex items-center gap-2.5 rounded-full px-4 py-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse"
        />
        <MonoLabel size="caption" className="text-accent-bright">
          {START_PILL}
        </MonoLabel>
      </span>

      <h1 className="mt-7 font-display text-display-1 font-extrabold leading-[1.02] tracking-[-0.02em] text-on-dark-strong">
        {START_TITLE[0]}
        <br />
        {/* Gradient on the second line only, as the mockup sets it — its
            violet→sky re-pointed at the brand teal and its depth blue. */}
        <span className="bg-gradient-to-r from-accent-bright via-accent to-accent-depth bg-clip-text text-transparent">
          {START_TITLE[1]}
        </span>
      </h1>

      <p className="mt-6 max-w-[30em] font-display text-heading font-bold text-on-dark-strong">
        {START_SUBLINE}
      </p>
      <p className="mt-4 max-w-[46em] text-body text-on-dark-muted">
        {START_BODY}
      </p>

      {/* OPTION 1/2/3 — model name and one-liner from SOURCES, so the cards
          cannot drift from the rest of the game; only the trade-off is new. */}
      <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
        {SOURCES.map((s, i) => (
          <div
            key={s.key}
            /* popIn then floatY, staggered as the mockup staggers them;
               the Embedded card additionally takes the sheen sweep. */
            className={cn(
              'sc-optioncard border p-5 text-left',
              s.key === 'emb' && 'sc-sheen',
            )}
            style={
              {
                borderColor: s.color + '55',
                background: s.bg,
                '--sc-delay': `${i * 0.4}s`,
              } as React.CSSProperties
            }
          >
            <MonoLabel size="caption" muted className="block">
              Option {i + 1}
            </MonoLabel>
            <MonoLabel size="caption" className="mt-2 block">
              <span style={{ color: s.color }}>{s.label}</span>
            </MonoLabel>
            <p className="mt-2 font-display text-heading text-on-dark-strong">
              {s.short}
            </p>
            <p className="mt-2 text-body-sm text-on-dark-muted">
              {START_TRADEOFFS[i]}
            </p>
          </div>
        ))}
      </div>

      <div className="sc-panel mt-10 w-full p-6 text-left md:p-8">
        <MonoLabel className="text-accent-bright">
          {START_WALKAWAY_TITLE}
        </MonoLabel>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          {START_WALKAWAY.map((item, i) => (
            <li key={item} className="flex gap-3">
              <span className="font-mono text-[13px] font-bold tabular-nums text-accent-bright">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-body-sm text-on-dark">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-12 inline-flex h-13 items-center rounded-[14px] bg-accent px-9 text-[15px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright motion-safe:animate-[pulseGlow_2.6s_ease-in-out_infinite]"
      >
        {START_CTA}
      </button>
      <MonoLabel muted size="caption" className="mt-5">
        {START_CHIPS.join(' · ')}
      </MonoLabel>
    </section>
  );
}

function Missions({ onPick }: { onPick: (mi: number) => void }) {
  return (
    <section className="mx-auto max-w-[1080px] px-5 py-16 md:py-24">
      <MonoLabel className="text-accent-bright">{MISSION_STEP_LABEL}</MonoLabel>
      <h1 className="mt-4 font-display text-display-2 text-on-dark-strong">
        Pick your mission
      </h1>
      <p className="mt-4 max-w-[44em] text-body-sm text-on-dark-muted">
        {MISSION_INTRO}
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {MISSIONS.map((m, i) => (
          <button
            key={m.name}
            type="button"
            onClick={() => onPick(i)}
            className="sc-panel group flex flex-col p-6 text-left transition-colors hover:border-accent"
          >
            <span className="flex items-center justify-between gap-3">
              {/* The mission's own mark rather than its number — a rocket
                  reads as "launch" before the label does, and the number
                  still sits on the Level line below. Decorative: the card's
                  accessible name is the mission title. */}
              <span
                className="grid h-11 w-11 place-items-center rounded-md text-accent-contrast"
                style={{ background: m.iconBg }}
              >
                {(() => {
                  const Icon = MISSION_ICONS[m.icon];
                  return <Icon size={22} stroke={2} aria-hidden="true" />;
                })()}
              </span>
              {/* Difficulty, as pips. The unlit run is dimmed hard rather
                  than merely muted — at 13px on ink, `on-dark-muted` alone
                  left 2-of-5 and 3-of-5 looking like a full row of five.
                  aria-label carries the real value; the glyphs are
                  decorative. */}
              <span
                className="flex gap-0.5 font-mono text-[13px]"
                aria-label={`Difficulty ${m.stars} of 5`}
              >
                {Array.from({ length: 5 }, (_, s) => (
                  <span
                    key={s}
                    aria-hidden="true"
                    className={
                      s < m.stars
                        ? 'text-accent-bright'
                        : 'text-on-dark-muted opacity-30'
                    }
                  >
                    ★
                  </span>
                ))}
              </span>
            </span>
            <span className="mt-4 font-display text-heading text-on-dark-strong">
              <span className="mb-1 block font-mono text-caption text-on-dark-muted">
                Level {m.glyph}
              </span>
              {m.name}
            </span>
            <span className="mt-2 text-body-sm text-on-dark-muted">{m.desc}</span>
            <span className="mt-5 flex flex-col gap-1.5 border-t border-[var(--rule-color)] pt-4 font-mono text-caption">
              <span>Budget <span className="text-on-dark-strong">{fmtUsd(m.budget)}</span></span>
              <span>Deadline <span className="text-on-dark-strong">{m.days} days</span></span>
              <span>Goal <span className="text-on-dark-strong">{m.goal}</span></span>
            </span>
            <span className="mt-5 font-mono text-caption text-[var(--accent-text)] group-hover:underline">
              Accept mission →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
