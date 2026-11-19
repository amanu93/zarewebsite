'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/** Element API exposed by mark.js once the custom element is defined. */
type MarkElement = HTMLElement & {
  setFormProgress?: (p: number) => void;
  setScrollDriven?: (on: boolean) => void;
  setPeel?: (a: number, b: number, c: number) => void;
  setRelease?: (r: number) => void;
};

/* ------------------------------------------------------------------
   The states, as fractions of the hero's scroll range.

     0  0.00 .. 0.06   scattered, hero copy at rest
     1  0.06 .. 0.32   the stream gathers, copy travels out of frame
     2  0.32 .. 0.52   the mark becomes recognisable
     3  0.52 .. 0.58   the mark completes
     4  0.58 .. 0.62   it holds and sways
     5  0.62 .. 0.94   the three pillars peel off the mark, one window each
        1.00           unpin — the mark, icons and labels HOLD their formed
                       state as the next section arrives; no dispersal
   ------------------------------------------------------------------ */

const FORM_FROM = 0.06;
const FORM_TO = 0.58;

const CARDS_FROM = 0.06;
const CARDS_TO = 0.22;
const HEAD_FROM = 0.12;
const HEAD_TO = 0.3;

/** One peel window per pillar. Its label latches when the peel passes 0.45 —
 *  mid-write, when the icon is recognisable. */
const PEEL: ReadonlyArray<readonly [number, number]> = [
  [0.62, 0.72],
  [0.74, 0.84],
  [0.86, 0.94],
];

/** Upper bound of each state, used only to publish `data-hero-state`. */
const STATE_END = [0.06, 0.32, 0.52, 0.66, 0.74, 1];

const TAU = 0.16;
const SETTLED = 0.0002;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const span = (v: number, from: number, to: number) =>
  clamp01((v - from) / (to - from));

/**
 * Wrapper around the `<zare-mark>` web component and the scroll sequence that
 * drives it. Same contract as before; the message thresholds are replaced by
 * the three pillar peel windows, and the element gains `pillars`, `setPeel`
 * and `setRelease`.
 */
export function MarkCanvas({
  speed = 1.4,
  scale = 1.5,
  className,
}: {
  speed?: number;
  scale?: number;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [lit, setLit] = useState(false);
  const elRef = useRef<MarkElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    (async () => {
      try {
        const THREE = await import('three');
        if (cancelled) return;
        (window as unknown as { THREE: unknown }).THREE = THREE;
        await import('./mark.js');
        if (!cancelled) setReady(true);
      } catch {
        // Leaves the static gradient in place.
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
    if (!window.matchMedia('(pointer: fine)').matches) return;
    // Coarse pointers stay time-driven; mark.js auto-plays the peels there.

    const host = el.closest<HTMLElement>('[data-hero-scroll]');
    if (!host) return;

    const pillars = Array.from(
      host.querySelectorAll<HTMLElement>('[data-hero-msg]'),
    );

    el.setScrollDriven(true);
    host.dataset.scrollReady = 'true';

    let top = 0;
    let range = 1;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      top = rect.top + window.scrollY;
      range = Math.max(1, host.offsetHeight - window.innerHeight);
    };
    const readScroll = () => clamp01((window.scrollY - top) / range);

    let lastState = -1;
    let lastShown = -1;

    const applyAt = (p: number) => {
      el.setFormProgress?.(span(p, FORM_FROM, FORM_TO));

      host.style.setProperty('--hero-cards', String(span(p, CARDS_FROM, CARDS_TO)));
      host.style.setProperty('--hero-head', String(span(p, HEAD_FROM, HEAD_TO)));

      const state = STATE_END.findIndex((end) => p <= end);
      if (state !== lastState) {
        lastState = state;
        host.dataset.heroState = String(state < 0 ? STATE_END.length - 1 : state);
      }

      // Pillar peels, off the damped clock. There is deliberately no release
      // here: the mark, icons and labels hold their formed state through the
      // unpin, and the next section simply scrolls over them.
      const peels = PEEL.map(([a, b]) => span(p, a, b));
      el.setPeel?.(peels[0], peels[1], peels[2]);

      // Labels latch mid-peel and unlatch on the way back up.
      let shown = 0;
      while (shown < PEEL.length && peels[shown] > 0.45) shown++;
      if (shown !== lastShown) {
        for (let i = 0; i < pillars.length; i++) {
          pillars[i].classList.toggle('is-in', i < shown);
        }
        lastShown = shown;
      }
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
      // The final end. Past p = 1 the hero is unpinning, and the damped
      // clock would otherwise still be catching up while the section slides
      // away — a fast flick would hand the next section a mid-flight,
      // half-scattered field. Land it: at the unpin there is nothing left
      // to ease toward, so the scene the next section arrives over is the
      // finished one — mark formed, icons written, labels latched.
      if (targetP >= 1) curP = 1;
      kick();
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    targetP = readScroll();
    curP = targetP;
    applyAt(curP);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
      el.setScrollDriven?.(false);
      el.setPeel?.(0, 0, 0);
      el.setRelease?.(0);
      pillars.forEach((m) => m.classList.remove('is-in'));
      host.style.removeProperty('--hero-cards');
      host.style.removeProperty('--hero-head');
      delete host.dataset.heroState;
      delete host.dataset.scrollReady;
    };
  }, [ready]);

  if (!ready) return null;

  return createElement('zare-mark', {
    ref: elRef,
    'data-lit': String(lit),
    speed: String(speed),
    scale: String(scale),
    pillars: '3',
    'aria-hidden': 'true',
    class: className,
  });
}
