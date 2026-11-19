'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { MonoLabel } from '@/components/typography/mono-label';
import { siteName } from '@/constants';
import { ROLES, SOURCES } from '@/content/scale-challenge';
import { archetype, calc, fmtUsd, insight, rank, score, scoreStars } from '@/lib/scale-challenge/engine';
import { cn } from '@/lib/utils';
import { submitBlueprint, type BlueprintState } from '../actions';
import { useReducedMotion, type GameAction, type GameState } from './game';

/**
 * Validation red. The design system has no error colour for dark grounds
 * (`accent-ink` is the light-surface token and reads as mud on ink), so the
 * game board's local signal red is reused here rather than smuggled into the
 * palette. Same rationale as the OK/WARN/BAD trio in board.tsx.
 */
const ERR = '#f47272';

/** 2π · 98 — the score ring's radius is fixed by the 230px dial. */
const RING = 615.7;
const REVEAL_MS = 1700;

const PANEL = 'border border-[var(--rule-color)] bg-accent/[0.03]';

/** Mirrors the contact form's control idiom (contact/_components/field.tsx). */
const CONTROL =
  'w-full border border-[var(--rule-color)] bg-transparent px-4 py-3 text-body-sm ' +
  'text-[var(--heading-color)] transition-colors placeholder:text-[var(--muted-color)] ' +
  'focus:border-accent focus:outline-none';

const INITIAL_BLUEPRINT: BlueprintState = { status: 'idle' };

/**
 * The results screen's rising motes, on the v3 mockup's own four `rise`
 * timings. Fixed rather than random so the server and client agree and so
 * the drift never syncs into a visible pulse.
 */
const RISERS = [
  { left: '12%', dur: '5s', delay: '0s' },
  { left: '34%', dur: '5.6s', delay: '.6s' },
  { left: '68%', dur: '6.5s', delay: '1.2s' },
  { left: '86%', dur: '7s', delay: '2s' },
] as const;

/**
 * The reveal progress `r`, 0 → 1 over 1700ms on a cubic ease-out. Every number
 * on this screen is multiplied by it, so one timer drives the whole page.
 * Reduced motion skips straight to the finished state — no timer at all.
 */
function useReveal(reduced: boolean): number {
  const [eased, setEased] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / REVEAL_MS);
      setEased(1 - Math.pow(1 - p, 3));
      if (p >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [reduced]);

  // Reduced motion never starts the timer: the finished numbers render on the
  // first paint rather than being animated to.
  return reduced ? 1 : eased;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

/**
 * The results screen: score dial, sourcing mix, the four headline numbers, the
 * three-way cost comparison, the insight line, the hire/outsource/embed
 * framework, and the blueprint lead capture. Ported from the v2 mockup's
 * results view; every figure comes from the engine's `calc()`.
 */
export function Results({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const c = calc({ mi: state.mi, team: state.team, mods: state.mods });
  const reduced = useReducedMotion();
  const r = useReveal(reduced);

  const sc = score(c, state.mods);
  const [arch, archDesc] = archetype(c);
  const rk = rank(sc);
  const stars = scoreStars(sc);
  const fullSavings = Math.max(0, c.localAll - c.spent);
  const overBudget = c.spent > c.m.budget;

  // The lead modal is view state, not game state: it never affects a score, a
  // mission or a reducer transition, so it stays local to this component.
  const [leadOpen, setLeadOpen] = useState(false);
  const [blueprint, formAction, pending] = useActionState(submitBlueprint, INITIAL_BLUEPRINT);
  const openRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Same pattern as the event modal in board.tsx: focus moves into the panel
  // and everything behind it is inert. Unlike that one, this modal is
  // dismissible, so Escape closes it and the cleanup hands focus back to the
  // button that opened it — however it was dismissed.
  useEffect(() => {
    if (!leadOpen) return;
    const trigger = openRef.current;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeadOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [leadOpen]);

  // On success the submit button — which held focus — is removed. Without this
  // the keyboard would be dropped on <body>, and since the header and footer
  // are outside this component (and so not inert), the next Tab would land in
  // the site nav *behind* the overlay. The error path never loses focus: the
  // submit button is `aria-disabled` while pending rather than `disabled`, so
  // the focused element is never disabled out from under the user.
  useEffect(() => {
    if (leadOpen && blueprint.status === 'success') panelRef.current?.focus();
  }, [leadOpen, blueprint.status]);

  const mix = [
    c.nLocal ? { src: SOURCES[0], label: plural(c.nLocal, 'Local Full-Time Hire') } : null,
    c.nOut ? { src: SOURCES[1], label: plural(c.nOut, 'Outsourced Package') } : null,
    c.nEmb ? { src: SOURCES[2], label: plural(c.nEmb, 'Embedded Professional') } : null,
  ].filter((x): x is { src: (typeof SOURCES)[number]; label: string } => x !== null);

  const roleLines = c.m.roles
    .map((k, i) => {
      const p = c.picked[i];
      return `${ROLES[k]} → ${p ? SOURCES[p.si].label : 'unfilled'}`;
    })
    .join('\n');

  const summary = [
    `Mission: ${c.m.name} · Score ${sc}/1000 · ${arch}`,
    `Mix: ${c.nLocal} local / ${c.nOut} outsourced / ${c.nEmb} embedded`,
    `Roles:\n${roleLines}`,
    `Team cost: ${fmtUsd(c.spent)} vs fully local ${fmtUsd(c.localAll)} (saved ${fmtUsd(fullSavings)})`,
  ].join('\n');

  const bars = [
    { label: 'Fully local model', value: fmtUsd(c.localAll), pct: 100 * r, color: SOURCES[0].color, strong: false },
    {
      label: 'Fully outsourced model',
      value: fmtUsd(c.outAll),
      pct: Math.min(1.15, c.outAll / c.localAll) * 100 * r,
      color: SOURCES[1].color,
      strong: false,
    },
    { label: 'Your mix', value: fmtUsd(c.spent), pct: (c.spent / c.localAll) * 100 * r, color: 'var(--color-accent)', strong: true },
  ];

  const tiles = [
    { label: 'Your model', value: fmtUsd(c.spent * r), accent: false },
    { label: 'Fully local model', value: fmtUsd(c.localAll * r), accent: false },
    { label: 'Potential savings', value: fmtUsd(fullSavings * r), accent: true },
    { label: 'Time to full capacity', value: `${Math.round(c.maxDeploy * r)} days`, accent: false },
  ];

  const e = blueprint.errors ?? {};
  const v = blueprint.values ?? {};

  return (
    <>
      <section className="relative mx-auto max-w-[1080px] px-5 py-14 md:py-20" inert={leadOpen}>
        {/* Rising particles, per the mockup — four motes on its own `rise`
            timings (5s, 5.6s+.6, 6.5s+1.2, 7s+2). Decorative and behind
            everything, so it is aria-hidden and drops under reduced motion. */}
        {!reduced ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            {RISERS.map((p, i) => (
              <span
                key={i}
                className="absolute bottom-0 block h-1 w-1 rounded-full bg-accent animate-[rise_linear_infinite]"
                style={{
                  left: p.left,
                  animationDuration: p.dur,
                  animationDelay: p.delay,
                }}
              />
            ))}
          </div>
        ) : null}

        {/* ── verdict ────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <MonoLabel muted>
            {overBudget ? 'Mission complete — over budget' : 'Mission accomplished'}
          </MonoLabel>

          {/* The rank medal. v3 puts this above the archetype: the rank is
              the thing a player repeats out loud, the archetype explains it. */}
          <span className="mt-4 sc-pill inline-flex items-center gap-2.5 rounded-full px-4 py-1.5">
            <span aria-hidden="true" className="text-[15px] motion-safe:animate-[badgeSpin_3.2s_ease-in-out_infinite]">
              🏆
            </span>
            <MonoLabel className="text-accent-bright">Rank · {rk}</MonoLabel>
          </span>

          <h1 className="mt-4 font-display text-display-3 text-on-dark-strong">{arch}</h1>
          <p className="mt-3 max-w-[46em] text-body-sm text-on-dark-muted">{archDesc}</p>

          {/* Score as stars, out of five — round(score / 200). Each earned
              star pops in on the mockup's starPop, staggered so they land
              one after another rather than all at once. */}
          <span
            className="mt-4 flex gap-1.5 font-mono text-[16px]"
            aria-label={`${stars} of 5 stars`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  i < stars
                    ? 'text-accent-bright motion-safe:animate-[starPop_.5s_ease_both]'
                    : 'text-on-dark-muted',
                )}
                style={
                  i < stars
                    ? ({ animationDelay: `${0.9 + i * 0.12}s` } as React.CSSProperties)
                    : undefined
                }
              >
                ★
              </span>
            ))}
          </span>
        </div>

        {/* ── score dial ─────────────────────────────────────────────── */}
        <div className="relative mx-auto mt-10 h-[230px] w-[230px]">
          <svg
            width="230"
            height="230"
            viewBox="0 0 230 230"
            aria-hidden="true"
            className="-rotate-90"
          >
            <circle
              cx="115"
              cy="115"
              r="98"
              fill="none"
              stroke="rgba(64,193,199,.15)"
              strokeWidth="11"
            />
            <circle
              cx="115"
              cy="115"
              r="98"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - (sc / 1000) * r)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <MonoLabel
              as="p"
              size="caption"
              className="text-[52px] leading-none text-on-dark-strong"
            >
              {Math.round(sc * r)}
            </MonoLabel>
            <MonoLabel muted size="caption" className="mt-2 tracking-[0.12em]">
              SCALE SCORE / 1000
            </MonoLabel>
          </div>
        </div>

        {/* ── sourcing mix ───────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {mix.map((m) => (
            <span
              key={m.src.key}
              className="border px-4 py-2"
              style={{ borderColor: m.src.color + '59', background: m.src.bg }}
            >
              <MonoLabel size="caption">
                <span style={{ color: m.src.color }}>{m.label}</span>
              </MonoLabel>
            </span>
          ))}
        </div>

        {/* ── headline numbers ───────────────────────────────────────── */}
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={cn(
                'p-4 text-center',
                t.accent ? 'border border-accent bg-accent/[0.07]' : PANEL,
              )}
            >
              <MonoLabel muted size="caption" className="block">
                {t.label}
              </MonoLabel>
              <MonoLabel
                as="p"
                size="caption"
                className={cn('mt-2 text-[20px]', t.accent ? 'text-[var(--accent-text)]' : 'text-on-dark-strong')}
              >
                {t.value}
              </MonoLabel>
            </div>
          ))}
        </div>

        {/* ── cost — same mission, three ways ────────────────────────── */}
        <div className={cn(PANEL, 'mt-6 p-6 md:p-7')}>
          <MonoLabel muted>Cost — same mission, three ways</MonoLabel>

          <div className="mt-5 flex flex-col gap-4">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'text-caption',
                      b.strong ? 'font-semibold text-on-dark-strong' : 'text-on-dark-muted',
                    )}
                  >
                    {b.label}
                  </span>
                  <MonoLabel size="caption">
                    <span className={b.strong ? 'text-[var(--accent-text)]' : 'text-on-dark-muted'}>
                      {b.value}
                    </span>
                  </MonoLabel>
                </div>
                <div className="mt-2 h-3 overflow-hidden bg-[var(--rule-color)]">
                  <div
                    className="h-full"
                    style={{ width: `${b.pct}%`, background: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 border-t border-[var(--rule-color)] pt-5 md:grid-cols-[1fr_auto_220px]">
            <div>
              <MonoLabel muted size="caption" className="block">
                Delivery capacity
              </MonoLabel>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="text-caption text-on-dark-muted">Fully local</span>
                <MonoLabel size="caption" muted>
                  {c.localCapFull}%
                </MonoLabel>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden bg-[var(--rule-color)]">
                <div
                  className="h-full"
                  style={{ width: `${c.localCapFull * r}%`, background: SOURCES[0].color }}
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="text-caption font-semibold text-on-dark-strong">Your mix</span>
                <MonoLabel size="caption" className="text-[var(--accent-text)]">
                  {c.cap}%
                </MonoLabel>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden bg-[var(--rule-color)]">
                <div className="h-full bg-accent" style={{ width: `${c.cap * r}%` }} />
              </div>
            </div>

            <div className="hidden w-px bg-[var(--rule-color)] md:block" />

            <div>
              <MonoLabel muted size="caption" className="block">
                Time to full capacity
              </MonoLabel>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="text-caption text-on-dark-muted">Fully local</span>
                <MonoLabel size="caption" muted>
                  {c.tradMax} days
                </MonoLabel>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-[var(--rule-color)] pt-2">
                <span className="text-caption font-semibold text-on-dark-strong">Your mix</span>
                <MonoLabel size="caption" className="text-[var(--accent-text)]">
                  {c.maxDeploy} days
                </MonoLabel>
              </div>
            </div>
          </div>

          <p className="mt-6 text-body-sm text-on-dark">{insight(c)}</p>
        </div>

        {/* ── the framework, stated plainly ──────────────────────────── */}
        <div className="mt-4 grid gap-4 border border-[var(--rule-color)] p-6 text-caption text-on-dark-muted md:grid-cols-3">
          <p>
            <span className="font-semibold" style={{ color: SOURCES[0].color }}>
              HIRE
            </span>{' '}
            when the role belongs permanently inside the organization.
          </p>
          <p>
            <span className="font-semibold" style={{ color: SOURCES[1].color }}>
              OUTSOURCE
            </span>{' '}
            when someone else should own a defined outcome.
          </p>
          <p>
            <span className="font-semibold" style={{ color: SOURCES[2].color }}>
              EMBED
            </span>{' '}
            when you need more people working inside your existing operation.
          </p>
        </div>

        {/* ── what next ──────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            ref={openRef}
            type="button"
            onClick={() => setLeadOpen(true)}
            className="inline-flex h-12 items-center rounded-md bg-accent px-7 text-[14.5px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright"
          >
            Get my team blueprint
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'playAgain' })}
            className="inline-flex h-12 items-center rounded-md border border-[var(--rule-color)] px-7 text-[14.5px] font-semibold text-on-dark transition-colors hover:border-accent"
          >
            Play again
          </button>
        </div>

        <MonoLabel as="p" muted size="caption" className="mt-6 text-center">
          Powered by {siteName} — your talent partner for embedded teams
        </MonoLabel>
      </section>

      {/* ── blueprint modal ─────────────────────────────────────────────
          Outside the results section so that section can be inert while the
          panel itself stays focusable. Escape or the close button dismiss it;
          focus returns to the button that opened it. */}
      {leadOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-surface-ink/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sc-blueprint-title"
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative my-auto w-[460px] max-w-full border border-[var(--rule-color)] bg-surface-deep p-8 focus:outline-none"
          >
            <button
              type="button"
              onClick={() => setLeadOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-body-sm text-on-dark-muted transition-colors hover:text-on-dark-strong"
            >
              ✕
            </button>

            {blueprint.status === 'success' ? (
              <div role="status" className="py-3 text-center">
                <span
                  className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-accent text-[22px] text-[var(--accent-text)]"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <h2
                  id="sc-blueprint-title"
                  className="mt-5 font-display text-heading text-on-dark-strong"
                >
                  Blueprint on its way
                </h2>
                <p className="mt-2 text-body-sm text-on-dark-muted">
                  A talent strategist from {siteName} will follow up with your custom team
                  plan within one business day.
                </p>
              </div>
            ) : (
              <>
                <h2
                  id="sc-blueprint-title"
                  className="font-display text-heading text-on-dark-strong"
                >
                  Your team blueprint
                </h2>
                <p className="mt-2 text-body-sm text-on-dark-muted">
                  We&rsquo;ll send your hire / outsource / embed mix and its estimated monthly
                  cost — built from the exact roles you just played.
                </p>

                <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
                  <input type="hidden" name="summary" value={summary} />

                  {/* Honeypot. Off-screen rather than display:none, because some
                      bots skip hidden inputs; never tabbable, never announced. */}
                  <div
                    aria-hidden="true"
                    className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
                  >
                    <label htmlFor="sc-website">Website</label>
                    <input
                      id="sc-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <BlueprintField
                    name="name"
                    label="Your name"
                    required
                    defaultValue={v.name}
                    error={e.name}
                  />
                  <BlueprintField
                    name="email"
                    type="email"
                    label="Work email"
                    required
                    defaultValue={v.email}
                    error={e.email}
                  />
                  <BlueprintField
                    name="company"
                    label="Company (optional)"
                    defaultValue={v.company}
                    error={e.company}
                  />

                  {blueprint.status === 'error' && blueprint.message ? (
                    <p
                      role="alert"
                      className="border-l-2 pl-4 text-body-sm"
                      style={{ borderColor: ERR, color: ERR }}
                    >
                      {blueprint.message}
                    </p>
                  ) : null}

                  {/* `aria-disabled`, not `disabled`. A disabled button loses
                      focus to <body>, and on the error path the button comes
                      back enabled with the keyboard already stranded outside
                      the dialog. The click guard is what actually blocks the
                      double submit — it catches Enter as well as the mouse. */}
                  <button
                    type="submit"
                    aria-disabled={pending}
                    onClick={(ev) => {
                      if (pending) ev.preventDefault();
                    }}
                    className={cn(
                      'inline-flex h-12 items-center justify-center rounded-md bg-accent px-7 text-[14.5px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright',
                      pending && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {pending ? 'Sending…' : 'Send my blueprint'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BlueprintField({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  type?: 'text' | 'email';
  required?: boolean;
  defaultValue?: string;
  error?: string;
}) {
  const id = `sc-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id}>
        <MonoLabel muted size="caption">
          {label}
        </MonoLabel>
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
        style={error ? { borderColor: ERR } : undefined}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption" style={{ color: ERR }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
