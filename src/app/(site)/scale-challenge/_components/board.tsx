'use client';

import { useEffect, useRef } from 'react';

import { MonoLabel } from '@/components/typography/mono-label';
import {
  EVENTS,
  LEAD_ROLES,
  MISSIONS,
  ROLES,
  SOURCES,
  TALENT,
  type SourceIndex,
} from '@/content/scale-challenge';
import { calc, fmtUsd } from '@/lib/scale-challenge/engine';
import { cn } from '@/lib/utils';
import { useReducedMotion, type GameAction, type GameState } from './game';

/**
 * Game-local status colours. These are the three signal colours of the game
 * board (fast / caution / slow, covered / stretched) and they carry meaning the
 * site palette has no token for, so they are applied as inline styles rather
 * than smuggled into the design system.
 */
const OK = '#34d399';
const WARN = '#f5b458';
const BAD = '#f47272';

const SOURCE_INDICES: SourceIndex[] = [0, 1, 2];

/** Deploy speed reads as a traffic light: ≤10 days green, ≤20 amber, else red. */
function deployColor(days: number): string {
  return days <= 10 ? OK : days <= 20 ? WARN : BAD;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

const PANEL = 'border border-[var(--rule-color)] bg-accent/[0.03]';

/**
 * The play phase: gauges, the internal-team slot grid, the outsourced strip,
 * the three-way candidate dock, the deploy stepper, events and the launch CTA.
 * Ported from the v2 mockup's `renderVals()`; every number comes from the
 * engine's `calc()`, so the board is a pure view of `state`.
 */
export function Board({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const c = calc({ mi: state.mi, team: state.team, mods: state.mods });
  const reduced = useReducedMotion();
  const m = MISSIONS[state.mi];

  // deploy stepper
  useEffect(() => {
    if (!state.deploy) return;
    const src = SOURCES[state.deploy.srcIdx];
    if (reduced) {
      dispatch({ type: 'deployDone' });
      return;
    }
    if (state.deploy.step >= src.steps.length - 1) {
      const t = setTimeout(() => dispatch({ type: 'deployDone' }), 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => dispatch({ type: 'deployStep' }),
      state.deploy.srcIdx === 0 ? 520 : 420,
    );
    return () => clearTimeout(t);
  }, [state.deploy, reduced, dispatch]);

  // toast auto-clear
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'clearToast' }), 3200);
    return () => clearTimeout(t);
  }, [state.toast, dispatch]);

  // An event takes the keyboard: focus moves into the modal panel, and the
  // board behind it is marked inert (see the section below), so Tab cannot
  // escape to the dock — picking a candidate there would clear activeEvent
  // while the event is already in `fired`, silently losing its effect.
  const eventPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.activeEvent == null) return;
    eventPanelRef.current?.focus();
  }, [state.activeEvent]);

  const dockKey =
    state.selRole && state.team[state.selRole] == null
      ? state.selRole
      : m.roles.find((k) => state.team[k] == null) ?? state.selRole;

  const total = m.roles.length;
  const filledCount = c.filled.length;

  const overBudget = c.spent > m.budget;
  const spentPct = Math.min(100, (c.spent / m.budget) * 100);
  const savings = Math.max(0, c.localSame - c.spent);
  const savingsFmt = savings > 0 ? '−' + fmtUsd(savings).slice(1) + ' saved' : '$0';

  const mgmtLoad = !filledCount
    ? '—'
    : c.hasLead
      ? 'Covered'
      : c.nOut >= filledCount
        ? 'Vendor-owned'
        : 'Stretched';
  const mgmtColor =
    mgmtLoad === 'Stretched' ? WARN : mgmtLoad === 'Covered' ? OK : undefined;
  const mgmtSub = !filledCount
    ? 'fill your first role'
    : c.hasLead
      ? 'internal lead directs the team'
      : c.nOut >= filledCount
        ? 'agencies own execution'
        : 'no internal lead — client-managed roles suffer';

  const externals = c.filled.filter((p) => p.si === 1);
  const outSource = SOURCES[1];

  const ev = state.activeEvent != null ? EVENTS[state.activeEvent] : null;
  const allFilled = filledCount === total;
  const canLaunch = allFilled && state.activeEvent == null;

  const dp = state.deploy;
  const dpSrc = dp ? SOURCES[dp.srcIdx] : null;

  return (
    <>
      {/* While an event is open everything behind the overlay is inert, so
          the keyboard cannot reach the dock and destroy the pending event. */}
      <section
        className="mx-auto max-w-[1180px] px-5 py-10 md:py-14"
        inert={ev !== null}
      >
        {/* ── mission header ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-heading text-on-dark-strong">{m.name}</h1>
            <MonoLabel muted size="caption" className="border-l border-[var(--rule-color)] pl-3">
              {m.goal}
            </MonoLabel>
          </div>
          {c.synergy && (
            /* tickerPulse, per the mockup — the synergy chip breathes so an
               active bonus reads as live rather than as another label. */
            <div
              className="border px-3 py-1.5 motion-safe:animate-[tickerPulse_2s_infinite]"
              style={{ borderColor: OK + '59' }}
            >
              <MonoLabel size="caption">
                <span style={{ color: OK }}>⚡ Team synergy · integration +15% · velocity +12%</span>
              </MonoLabel>
            </div>
          )}
          <div className="border border-[var(--rule-color)] px-3 py-1.5">
            <MonoLabel size="caption" muted>
              ⏳ {c.effDays} days
            </MonoLabel>
          </div>
          <div className="border border-[var(--rule-color)] px-3 py-1.5">
            <MonoLabel size="caption" muted>
              Team {filledCount}/{total}
            </MonoLabel>
          </div>
        </div>

        {/* ── gauges ─────────────────────────────────────────────────── */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className={cn(PANEL, 'p-4 sm:col-span-2')}>
            <div className="flex items-baseline justify-between gap-3">
              <MonoLabel muted>Budget spent over the mission</MonoLabel>
              <MonoLabel size="caption">
                <span style={overBudget ? { color: BAD } : undefined}>
                  {fmtUsd(c.spent)} / {fmtUsd(m.budget)}
                </span>
              </MonoLabel>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden bg-[var(--rule-color)]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${spentPct}%`,
                  background: overBudget
                    ? `linear-gradient(90deg, ${WARN}, ${BAD})`
                    : 'var(--color-accent)',
                }}
              />
            </div>
          </div>

          <div className={cn(PANEL, 'p-4')}>
            <MonoLabel muted>Saved vs hiring locally</MonoLabel>
            <MonoLabel as="p" size="caption" className="mt-2 text-[19px]">
              <span style={{ color: OK }}>{savingsFmt}</span>
            </MonoLabel>
          </div>

          <div className={cn(PANEL, 'p-4')}>
            <MonoLabel muted>Delivery capacity</MonoLabel>
            <MonoLabel as="p" size="caption" className="mt-2 text-[19px] text-on-dark-strong">
              {filledCount ? `${c.cap}%` : '—'}
            </MonoLabel>
            <div className="mt-2 h-1 overflow-hidden bg-[var(--rule-color)]">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${c.cap}%` }}
              />
            </div>
          </div>

          <div className={cn(PANEL, 'p-4')}>
            <MonoLabel muted>Management load</MonoLabel>
            <MonoLabel as="p" size="caption" className="mt-2 text-[19px] text-on-dark-strong">
              <span style={mgmtColor ? { color: mgmtColor } : undefined}>{mgmtLoad}</span>
            </MonoLabel>
            <p className="mt-1 text-caption text-on-dark-muted">{mgmtSub}</p>
          </div>
        </div>

        {/* ── internal team ──────────────────────────────────────────── */}
        <div className={cn(PANEL, 'mt-6 p-4')}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <MonoLabel className="text-on-dark-strong">Your internal team</MonoLabel>
            <span className="text-caption text-on-dark-muted">
              local hires &amp; embedded talent work inside this board
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {m.roles.map((k, i) => {
              const t = c.picked[i];
              const sel = state.selRole === k;
              const src = t ? SOURCES[t.si] : null;
              const isExternal = t?.si === 1;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => dispatch({ type: 'selectRole', role: k })}
                  className={cn(
                    'flex min-h-[104px] flex-col border p-3 text-left transition-colors',
                    sel
                      ? 'border-accent bg-accent/[0.07]'
                      : 'border-[var(--rule-color)] hover:border-accent',
                    t && !sel && 'bg-accent/[0.04]',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <MonoLabel size="caption" className="text-on-dark-strong">
                      {ROLES[k]}
                    </MonoLabel>
                    {LEAD_ROLES.includes(k) && (
                      <MonoLabel
                        size="caption"
                        className="shrink-0 border border-[var(--rule-color)] px-1.5 py-0.5 text-[10px] text-[var(--accent-text)]"
                      >
                        LEAD
                      </MonoLabel>
                    )}
                  </span>

                  {t && src && !isExternal && (
                    <span className="mt-3 flex items-center gap-2">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center border font-mono text-[10px]"
                        style={{ borderColor: src.color, background: src.bg, color: src.color }}
                      >
                        {initials(t.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-caption text-on-dark-strong">
                          {t.name}
                        </span>
                        <MonoLabel size="caption" className="block text-[10.5px]">
                          <span style={{ color: src.color }}>{fmtUsd(t.monthly)}/mo</span>
                        </MonoLabel>
                      </span>
                    </span>
                  )}

                  {t && isExternal && (
                    <span
                      className="mt-3 block border border-dashed p-2"
                      style={{ borderColor: outSource.color + '73' }}
                    >
                      <span className="block text-caption" style={{ color: outSource.color }}>
                        Delivered externally ↘
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-on-dark-muted">
                        see external delivery below
                      </span>
                    </span>
                  )}

                  {!t && (
                    <span className="mt-3 flex h-8 items-center justify-center border border-dashed border-[var(--rule-color)]">
                      <MonoLabel size="caption" muted>
                        {sel ? 'choosing…' : '+ fill role'}
                      </MonoLabel>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── external delivery ──────────────────────────────────────── */}
        {externals.length > 0 && (
          <>
            {/* The connector between the internal board and the external
                strip. An SVG line rather than a CSS border because the
                mockup flows the dashes along it (dashFlow animates
                stroke-dashoffset, which a border cannot do). */}
            <svg
              aria-hidden="true"
              width="2"
              height="32"
              viewBox="0 0 2 32"
              className="mx-auto block"
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="32"
                strokeWidth="2"
                strokeDasharray="6 4"
                stroke={outSource.color + '99'}
                className="motion-safe:animate-[dashFlow_1s_linear_infinite]"
              />
            </svg>
            <div
              className="border border-dashed p-4"
              style={{ borderColor: outSource.color + '66', background: outSource.bg }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <MonoLabel>
                  <span style={{ color: outSource.color }}>External delivery — outsourced</span>
                </MonoLabel>
                <span className="text-caption text-on-dark-muted">
                  agency-managed teams delivering to you
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {externals.map((x) => (
                  <div
                    key={x.role}
                    className="flex items-center gap-3 border px-4 py-2.5"
                    style={{ borderColor: outSource.color + '59' }}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center border font-mono text-[10px]"
                      style={{
                        borderColor: outSource.color,
                        background: outSource.bg,
                        color: outSource.color,
                      }}
                    >
                      EXT
                    </span>
                    <span>
                      <span className="block font-display text-caption font-semibold text-on-dark-strong">
                        {x.name}
                      </span>
                      <MonoLabel size="caption" className="block text-[10.5px]">
                        <span style={{ color: outSource.color }}>
                          {fmtUsd(x.monthly)}/mo · {ROLES[x.role]}
                        </span>
                      </MonoLabel>
                    </span>
                    <span className="ml-1 text-body-sm" style={{ color: outSource.color }}>
                      ⇄
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── the dock: one role, three ways ─────────────────────────── */}
        {dockKey && (
          <div className="mt-9">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-heading text-on-dark-strong">
                Fill the <span className="text-[var(--accent-text)]">{ROLES[dockKey]}</span> role —
                pick one of three
              </h2>
              <span className="text-caption text-on-dark-muted">
                tap a card to add it to your team · higher bars are better
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {SOURCE_INDICES.map((si) => {
                const t = TALENT[dockKey][si];
                const src = SOURCES[si];
                const chosen = state.team[dockKey] === si;
                return (
                  <button
                    key={src.key}
                    type="button"
                    onClick={() => dispatch({ type: 'pickCandidate', role: dockKey, si })}
                    className="flex flex-col border p-5 text-left transition-colors hover:bg-accent/[0.05]"
                    style={{ borderColor: chosen ? src.color : 'var(--rule-color)' }}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <MonoLabel size="caption" className="block font-semibold tracking-[0.1em]">
                          <span style={{ color: src.color }}>{src.label}</span>
                        </MonoLabel>
                        <span className="mt-1 block text-caption text-on-dark-muted">
                          {src.tagline}
                        </span>
                      </span>
                      {chosen && (
                        <MonoLabel size="caption" className="shrink-0">
                          <span style={{ color: OK }}>✓ chosen</span>
                        </MonoLabel>
                      )}
                    </span>

                    <span className="mt-4 flex items-center gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center border font-mono text-[11px]"
                        style={{ borderColor: src.color, background: src.bg, color: src.color }}
                      >
                        {si === 1 ? 'EXT' : initials(t.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-body-sm font-semibold text-on-dark-strong">
                          {t.name}
                        </span>
                        <span className="mt-0.5 block text-caption text-on-dark-muted">
                          {src.mgmt}
                        </span>
                      </span>
                    </span>

                    <span className="mt-4 flex items-baseline gap-2">
                      <MonoLabel size="caption" className="text-[24px] text-on-dark-strong">
                        {fmtUsd(t.monthly)}
                      </MonoLabel>
                      <span className="text-caption text-on-dark-muted">{src.per}</span>
                    </span>

                    <span className="mt-4 flex flex-col gap-2">
                      <span className="flex items-center gap-3">
                        <MonoLabel size="caption" muted className="w-[74px] shrink-0">
                          Deploy
                        </MonoLabel>
                        <MonoLabel size="caption">
                          <span style={{ color: deployColor(t.deploy) }}>{t.deploy} days</span>
                        </MonoLabel>
                      </span>
                      {(
                        [
                          ['Skill', t.skill],
                          ['Integration', t.integ],
                          ['Flexibility', t.flex],
                        ] as const
                      ).map(([label, value]) => (
                        <span key={label} className="flex items-center gap-3">
                          <MonoLabel size="caption" muted className="w-[74px] shrink-0">
                            {label}
                          </MonoLabel>
                          <span className="h-1 flex-1 overflow-hidden bg-[var(--rule-color)]">
                            <span
                              className="block h-full"
                              style={{ width: `${value}%`, background: src.color }}
                            />
                          </span>
                          <MonoLabel size="caption" muted className="w-6 shrink-0 text-right">
                            {value}
                          </MonoLabel>
                        </span>
                      ))}
                    </span>

                    <span
                      className="mt-4 inline-block self-start border px-2 py-1"
                      style={{ borderColor: src.color, background: src.bg }}
                    >
                      <MonoLabel size="caption" className="text-[10px]">
                        <span style={{ color: src.color }}>{src.badge}</span>
                      </MonoLabel>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── launch ─────────────────────────────────────────────────── */}
        {allFilled && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              disabled={!canLaunch}
              onClick={() => dispatch({ type: 'launch' })}
              className="inline-flex h-12 items-center rounded-md bg-accent px-7 text-[14.5px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-40"
            >
              Launch the mission →
            </button>
          </div>
        )}

        {/* ── deploy stepper ─────────────────────────────────────────── */}
        {dp && dpSrc && (
          <div
            className="fixed bottom-6 left-5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] border bg-surface-deep p-5"
            style={{ borderColor: dpSrc.color }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <MonoLabel size="caption" className="font-semibold tracking-[0.1em]">
                <span style={{ color: dpSrc.color }}>{dpSrc.label}</span>
              </MonoLabel>
              <MonoLabel size="caption">
                <span style={{ color: dpSrc.color }}>{dp.days} DAYS</span>
              </MonoLabel>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {dpSrc.steps.map((label, i) => {
                const reached = i <= dp.step;
                const done = i < dp.step || (i === dp.step && dp.step === dpSrc.steps.length - 1);
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3 transition-opacity duration-300"
                    style={{ opacity: reached ? 1 : 0.35 }}
                  >
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center border font-mono text-[9px] text-accent-contrast"
                      style={{
                        borderColor: reached ? dpSrc.color : 'var(--rule-color)',
                        background: done ? dpSrc.color : 'transparent',
                      }}
                    >
                      {done ? '✓' : ''}
                    </span>
                    <span
                      className={cn(
                        'text-caption',
                        reached ? 'text-on-dark-strong' : 'text-on-dark-muted',
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── toast ──────────────────────────────────────────────────── */}
        {state.toast && (
          <div
            className="fixed bottom-6 left-1/2 z-[55] -translate-x-1/2 border border-[var(--rule-color)] bg-surface-deep px-5 py-3"
            role="status"
            aria-live="polite"
          >
            <MonoLabel size="caption" className="text-[var(--accent-text)]">
              {state.toast}
            </MonoLabel>
          </div>
        )}
      </section>

      {/* ── event modal ─────────────────────────────────────────────────
          Sits outside the board section so that section can be inert while
          the modal itself stays focusable. It closes only through a choice. */}
      {ev && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-ink/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={ev.title}
          aria-labelledby="sc-event-title"
        >
          <div
            ref={eventPanelRef}
            tabIndex={-1}
            className="w-[520px] max-w-full border border-[var(--rule-color)] bg-surface-deep p-8 focus:outline-none"
          >
            <div
              className="inline-block border px-3 py-1"
              style={{ borderColor: WARN + '59', background: WARN + '1f' }}
            >
              <MonoLabel size="caption">
                <span style={{ color: WARN }}>⚡ Incoming event</span>
              </MonoLabel>
            </div>
            <h2
              id="sc-event-title"
              className="mt-5 font-display text-heading text-on-dark-strong"
            >
              {ev.title}
            </h2>
            <p className="mt-3 text-body-sm text-on-dark-muted">{ev.desc}</p>
            <div className="mt-6 flex flex-col gap-3">
              {ev.choices.map((ch) => (
                <button
                  key={ch.label}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'eventChoice',
                      effect: ch.fx({ avgFlex: c.avgFlex, avgDeploy: c.avgDeploy }),
                    })
                  }
                  className="border border-[var(--rule-color)] p-4 text-left transition-colors hover:border-accent hover:bg-accent/[0.06]"
                >
                  <span className="block font-display text-body-sm font-semibold text-on-dark-strong">
                    {ch.label}
                  </span>
                  <span className="mt-1 block text-caption text-on-dark-muted">{ch.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
