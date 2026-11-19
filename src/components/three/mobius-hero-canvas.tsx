'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/** Element API exposed by mobius-write.js once the custom element is defined. */
type MobiusElement = HTMLElement & {
  setFormProgress?: (p: number) => void;
  setScrollDriven?: (on: boolean) => void;
};

/* ------------------------------------------------------------------
   THE SCROLL NARRATIVE — every number lives here, named, so the whole
   experience can be tuned on real hardware without archaeology.

     0  resting     0.00 .. 0.06   rest field; the full proposition
     1  dispersing  0.06 .. 0.30   cards leave (.06–.22), head lifts
                                   (.12–.30), the field starts compressing
     2  forming     0.30 .. 0.55   the write: staggered streams arrive,
                                   the half-twist rebuilds, palette turns
     3  formed      0.55 .. 0.68   THE HOLD — ring complete and alive
                                   (rotation, breathing, detachers, loop
                                   light), no copy, nothing new. A beat
                                   to perceive the system.
     4  message     0.68 .. 0.92   one statement beside the living ring;
                                   latched, reversible
     5  released    0.92 .. 1.00   scene holds; the header signal flips
                                   at RELEASED_AT; next section arrives
                                   over the finished, still-living scene

   Scroll owns formation; the clock owns life. The formed ring never
   freezes.
   ------------------------------------------------------------------ */

/** Wrapper height while pinned. Driver-owned (inline style) so this
 *  constant is the single tuning point — there is no CSS copy of it. */
const HERO_SVH = 280;

const FORM: readonly [number, number] = [0.06, 0.55];
const CARDS_EXIT: readonly [number, number] = [0.06, 0.22];
const HEAD_EXIT: readonly [number, number] = [0.12, 0.3];
/** The message window; it latches past 0.40 of it (p ≈ 0.776). */
const MESSAGE: readonly [number, number] = [0.68, 0.92];
/** The header contract flips here. Reversible. */
const RELEASED_AT = 0.98;

/** Upper bound of each state, published as `data-hero-state`. */
const STATE_END = [0.06, 0.3, 0.55, 0.68, 0.92, 1];

const TAU = 0.16;
const SETTLED = 0.0002;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const span = (v: number, from: number, to: number) =>
  clamp01((v - from) / (to - from));

/**
 * Wrapper around `<zare-mobius-write>` and the scroll narrative that
 * drives it: damped clock, cards/head exit variables, the formed hold,
 * the message latch, and the header's released contract.
 *
 * Gates, in order:
 *  - reduced motion   → nothing is imported; the static gradient is the
 *                       experience, one viewport, released from mount.
 *  - coarse pointer   → the element mounts and forms on its OWN clock
 *                       (FORM_T in the engine); no pin, no scrubbing, no
 *                       message overlay, released from mount. Pointer
 *                       capability, not viewport width, decides.
 *  - fine pointer     → the full scroll narrative. `data-scroll-ready`
 *                       (and with it the pinned height) is granted only
 *                       when the engine actually has a renderer — a
 *                       fallback gradient never earns the pin, and a
 *                       renderer dying later revokes it.
 */
export function MobiusHeroCanvas({
  speed = 1.4,
  markers = true,
  scale = 1.5,
  className,
}: {
  speed?: number;
  markers?: boolean;
  scale?: number;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [lit, setLit] = useState(false);
  const elRef = useRef<MobiusElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    (async () => {
      try {
        const THREE = await import('three');
        if (cancelled) return;
        (window as unknown as { THREE: unknown }).THREE = THREE;
        await import('./mobius-write.js');
        if (!cancelled) setReady(true);
      } catch {
        // Leaves the static gradient in place; the wrapper stays 100svh
        // and `data-hero-released` keeps its server-rendered "true".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setLit(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const el = elRef.current;
    if (!el?.setScrollDriven || !el.setFormProgress) return;

    const host = el.closest<HTMLElement>('[data-hero-scroll]');
    if (!host) return;

    // Coarse pointers never scrub. The element is mounted (so the Möbius
    // forms on the engine's own clock behind the static copy) but the
    // pin, the exits, the message and the scroll clock are all skipped.
    // The hero is never pinned there, so it is truthfully released.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const message = host.querySelector<HTMLElement>('[data-hero-message]');

    /* ---------------- released contract ---------------- */
    let released = true; // server-rendered default
    const setReleased = (next: boolean) => {
      if (next === released) return;
      released = next;
      host.dataset.heroReleased = String(next);
      window.dispatchEvent(
        new CustomEvent('zare:hero-released', { detail: { released: next } }),
      );
    };

    /* ---------------- grant / revoke the pin ---------------- */
    let granted = false;
    const grant = () => {
      if (granted) return;
      granted = true;
      el.setScrollDriven?.(true);
      host.dataset.scrollReady = 'true';
      host.style.height = `${HERO_SVH}svh`;
      setReleased(false);
      measure();
      targetP = readScroll();
      curP = targetP;
      applyAt(curP);
    };
    const revoke = () => {
      if (!granted) return;
      granted = false;
      el.setScrollDriven?.(false);
      delete host.dataset.scrollReady;
      delete host.dataset.heroState;
      delete host.dataset.cardsGone;
      host.style.removeProperty('height');
      host.style.removeProperty('--hero-cards');
      host.style.removeProperty('--hero-head');
      message?.classList.remove('is-in');
      setReleased(true);
    };

    /* ---------------- scroll clock ---------------- */
    let top = 0;
    let range = 1;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      top = rect.top + window.scrollY;
      range = Math.max(1, host.offsetHeight - window.innerHeight);
    };
    const readScroll = () => clamp01((window.scrollY - top) / range);

    let lastState = -1;
    let lastCardsGone = false;
    let lastMsgIn = false;

    const applyAt = (p: number) => {
      el.setFormProgress?.(span(p, FORM[0], FORM[1]));

      const cards = span(p, CARDS_EXIT[0], CARDS_EXIT[1]);
      host.style.setProperty('--hero-cards', String(cards));
      host.style.setProperty('--hero-head', String(span(p, HEAD_EXIT[0], HEAD_EXIT[1])));

      // The instant the cards' exit completes they also leave the tab
      // order (CSS keys visibility on this attribute) — no window where
      // an invisible card is focusable.
      const cardsGone = cards >= 1;
      if (cardsGone !== lastCardsGone) {
        lastCardsGone = cardsGone;
        if (cardsGone) host.dataset.cardsGone = 'true';
        else delete host.dataset.cardsGone;
      }

      const state = STATE_END.findIndex((end) => p <= end);
      if (state !== lastState) {
        lastState = state;
        host.dataset.heroState = String(state < 0 ? STATE_END.length - 1 : state);
      }

      // The message: one statement beside the already-living ring, latched
      // mid-window so momentum cannot flicker it, fully reversible. The
      // hold before it (0.55–0.68) is deliberate emptiness — nothing is
      // driven there beyond the engine's own life.
      const msgIn = span(p, MESSAGE[0], MESSAGE[1]) > 0.4;
      if (msgIn !== lastMsgIn) {
        lastMsgIn = msgIn;
        message?.classList.toggle('is-in', msgIn);
      }

      setReleased(p >= RELEASED_AT);
    };

    let targetP = 0;
    let curP = 0;
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const gap = targetP - curP;
      if (Math.abs(gap) < SETTLED) {
        curP = targetP;
        frame = 0;
        applyAt(curP);
        return;
      }
      curP += gap * (1 - Math.exp(-dt / TAU));
      applyAt(curP);
      frame = requestAnimationFrame(step);
    };

    const kick = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    const onScroll = () => {
      targetP = readScroll();
      // Past p = 1 the hero is unpinning; land the damped clock so the
      // next section arrives over the finished scene — ring formed and
      // rotating, message standing — never a half-gathered cloud.
      if (targetP >= 1) curP = 1;
      kick();
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    // The pin is granted only when the engine actually rendered. If the
    // element already declared fallback (renderer refused at boot), the
    // hero simply stays a static viewport; if it declares it later, the
    // pin is revoked and the layout returns to the degraded state.
    const observer = new MutationObserver(() => {
      if (el.dataset.fallback === 'true') revoke();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-fallback'] });

    if (el.dataset.fallback !== 'true') grant();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      revoke();
    };
  }, [ready]);

  if (!ready) return null;

  return createElement('zare-mobius-write', {
    ref: elRef,
    speed: String(speed),
    markers: String(markers),
    scale: String(scale),
    // Centred pose from the v3 reference (option 4a): the strip sits in the
    // middle of the frame, nudged slightly up.
    'data-ox': '0',
    'data-oy': '0.1',
    'data-lit': String(lit),
    // Verbatim. Do not change or explain.
    'data-route': 'B-P-S-E-L-E-C-A',
    'aria-hidden': 'true',
    class: className,
  });
}
