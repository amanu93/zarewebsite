'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/** Element API exposed by ring.js once the custom element is defined. */
type RingElement = HTMLElement & {
  setFormProgress?: (p: number) => void;
  setScrollDriven?: (on: boolean) => void;
};

/* ------------------------------------------------------------------
   The six states, as fractions of the hero's scroll range.

     0  0.00 .. 0.06   scattered, hero copy at rest
     1  0.06 .. 0.32   particles converge, copy travels out of frame
     2  0.32 .. 0.52   structure becomes recognisable
     3  0.52 .. 0.66   ring closes
     4  0.66 .. 0.76   ring holds and turns
     5  0.76 .. 1.00   messages arrive around it
        1.00           unpin, next narrative section

   Every boundary below is a fraction of one number, the hero wrapper's
   height in globals.css. Retiming the sequence means editing this block
   and nothing else.
   ------------------------------------------------------------------ */

/** Formation runs from the end of the state 0 hold to the end of state 3. */
const FORM_FROM = 0.06;
const FORM_TO = 0.66;

/** The two path cards lead the exit; the headline follows a beat later. */
const CARDS_FROM = 0.06;
const CARDS_TO = 0.22;
const HEAD_FROM = 0.12;
const HEAD_TO = 0.3;

/** One threshold per message, staggered through state 5. The last lands at
 *  0.93, which leaves a deliberate hold before the hero unpins. */
const MESSAGE_AT = [0.78, 0.83, 0.88, 0.93];

/** Upper bound of each state, used only to publish `data-hero-state`. */
const STATE_END = [0.06, 0.32, 0.52, 0.66, 0.76, 1];

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Normalises v into 0..1 across [from, to]. */
const span = (v: number, from: number, to: number) =>
  clamp01((v - from) / (to - from));

/**
 * Wrapper around the `<zare-ring>` web component and the scroll sequence that
 * drives it.
 *
 * Three.js is imported dynamically so it never enters the initial bundle. The
 * web component polls for `window.THREE`, so assigning it asynchronously is
 * part of its contract rather than a workaround.
 *
 * SCROLL DRIVING
 * When the sequence is active this component hands the formation clock to the
 * scrollbar and marks the nearest `[data-hero-scroll]` ancestor ready, which
 * is what gives that element its extra scroll height and makes the hero
 * sticky (see globals.css).
 *
 * The ready attribute is set here, after a successful boot, and nowhere else.
 * That is deliberate: a hero with three viewports of scroll range but no
 * animation would be two screens of empty space. No JS, reduced motion, no
 * WebGL, a failed Three import and coarse pointers all leave the attribute
 * unset, which keeps a single-viewport hero with its copy centred, its cards
 * in place and the messages hidden.
 */
export function RingCanvas({
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
  /** Drives the 2.5s dissolve in globals.css. Separate from `ready` because
   *  the transition needs a frame in which the element exists at opacity 0
   *  before the target value is applied; setting both at once would resolve
   *  the starting and ending styles together and skip the animation. */
  const [lit, setLit] = useState(false);
  const elRef = useRef<RingElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Skip the whole download under reduced motion. The static gradient behind
    // the canvas is the intended experience there, so there is nothing to load.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    (async () => {
      try {
        const THREE = await import('three');
        if (cancelled) return;
        (window as unknown as { THREE: unknown }).THREE = THREE;
        await import('./ring.js');
        if (!cancelled) setReady(true);
      } catch {
        // Leaves the static gradient in place. The hero copy is unaffected.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Two frames, not one. A single rAF can still be batched into the same style
  // resolution as the mount on some engines, which skips the transition
  // entirely and makes the canvas snap on.
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

    // Coarse pointers stay time-driven. Momentum scrolling makes progress
    // non-monotonic, so the formation would visibly stutter and reverse, and
    // on iOS the address bar collapsing mid-scroll changes the very viewport
    // height the progress calculation divides by.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const host = el.closest<HTMLElement>('[data-hero-scroll]');
    if (!host) return;

    const messages = Array.from(
      host.querySelectorAll<HTMLElement>('[data-hero-msg]'),
    );

    el.setScrollDriven(true);
    host.dataset.scrollReady = 'true';

    // Cached so the scroll handler never reads layout. Refreshed on resize,
    // which is the only thing that can invalidate it.
    let top = 0;
    let range = 1;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      top = rect.top + window.scrollY;
      range = Math.max(1, host.offsetHeight - window.innerHeight);
    };

    // Only written when they change, so a frame that moves nothing costs
    // nothing beyond the arithmetic above.
    let lastState = -1;
    let lastShown = -1;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const p = clamp01((window.scrollY - top) / range);

      // The ring itself. The component receives formation progress only; its
      // idle breathing, drift and rotation stay on the wall clock so a
      // stationary visitor never sees a dead object.
      el.setFormProgress?.(span(p, FORM_FROM, FORM_TO));

      // The copy layer. Two properties rather than one shared clock, because
      // the cards have to clear the frame before the headline starts to go.
      host.style.setProperty('--hero-cards', String(span(p, CARDS_FROM, CARDS_TO)));
      host.style.setProperty('--hero-head', String(span(p, HEAD_FROM, HEAD_TO)));

      const state = STATE_END.findIndex((end) => p <= end);
      if (state !== lastState) {
        lastState = state;
        host.dataset.heroState = String(state < 0 ? STATE_END.length - 1 : state);
      }

      // Messages latch on their own threshold and unlatch on the way back up,
      // so scrubbing in reverse plays the sequence backwards rather than
      // leaving them stranded on screen.
      let shown = 0;
      while (shown < MESSAGE_AT.length && p >= MESSAGE_AT[shown]) shown++;
      if (shown !== lastShown) {
        for (let i = 0; i < messages.length; i++) {
          messages[i].classList.toggle('is-in', i < shown);
        }
        lastShown = shown;
      }
    };

    // Coalesced to one frame. The handler itself does nothing but ask for one.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
      el.setScrollDriven?.(false);
      messages.forEach((m) => m.classList.remove('is-in'));
      host.style.removeProperty('--hero-cards');
      host.style.removeProperty('--hero-head');
      delete host.dataset.heroState;
      delete host.dataset.scrollReady;
    };
  }, [ready]);

  if (!ready) return null;

  // createElement rather than JSX, so a custom element does not require
  // augmenting the global JSX namespace for one component.
  return createElement('zare-ring', {
    ref: elRef,
    'data-lit': String(lit),
    speed: String(speed),
    markers: String(markers),
    scale: String(scale),
    'aria-hidden': 'true',
    class: className,
  });
}
