'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/** Element API exposed by globe-write.js once the custom element is defined. */
type GlobeElement = HTMLElement & {
  setFormProgress?: (p: number) => void;
  setReveal?: (r: number) => void;
  setHandoff?: (t: number) => void;
  setScrollDriven?: (on: boolean) => void;
};

/* ------------------------------------------------------------------
   THE SCROLL NARRATIVE — every number lives here, named, so the whole
   experience can be tuned on real hardware without archaeology.

     0  resting     0.00 .. 0.06   rest field; the full proposition
     1  dispersing  0.06 .. 0.32   cards leave (.06–.22), head lifts
                                   (.12–.30), the field sweeps up
     2  writing     0.32 .. 0.52   the stream pours down and writes the
                                   particle sphere, meridian by meridian,
                                   just left of centre — a PLAIN sphere,
                                   no continents
     3  sphere      0.52 .. 0.58   the write closes — still pure particles
     4  reveal      0.58 .. 0.74   the real Earth (fine dots, core,
                                   coastlines, Ethiopia, markers, arcs)
                                   fades in as the shell lifts into an
                                   orbiting halo, and the descriptive
                                   block latches in on the right
     5  dwell       0.74 .. 1.00   alive and interactive: spinning,
                                   draggable, flights moving, Addis label
                                   on hover; released at RELEASED_AT.
                                   Across HANDOFF the halo field pours
                                   DOWN out of the frame toward the
                                   clients section — the trust strip's
                                   canvas picks the particles up on the
                                   other side of the fold

   Scroll owns formation and the reveal; the clock owns the life.
   ------------------------------------------------------------------ */

/** Wrapper height while pinned. Driver-owned (inline style) so this
 *  constant is the single tuning point — there is no CSS copy of it. */
const HERO_SVH = 280;

const FORM: readonly [number, number] = [0.06, 0.58];
const CARDS_EXIT: readonly [number, number] = [0.06, 0.22];
const HEAD_EXIT: readonly [number, number] = [0.12, 0.3];
/** The reveal window: real globe in, particle shell out into the halo. */
const REVEAL: readonly [number, number] = [0.6, 0.72];
/** The header contract flips here. Reversible. */
const RELEASED_AT = 0.98;
/** The hand-off window: the halo streams down toward the clients
 *  section as the hero unpins, so the field the trust strip's canvas
 *  pours in is visibly the one the globe let go. Reversible. Wide
 *  enough (~36vh of real scroll) that the descent reads as a pour,
 *  not a drop. */
const HANDOFF: readonly [number, number] = [0.8, 1];
/** The desc block latches in past this much of the reveal window. */
const DESC_AT = 0.4;

/* ---------------- phones ----------------
   Below this width the resting copy stack is taller than one small
   viewport, so it cannot part sideways out of a clipped rest state. The
   phone narrative replaces the cards' exit with two moves:

     slide   the whole copy slides UP by its overhang (--hero-overflow,
             measured by the driver), so the cards are read in full
     exit    the whole copy then lifts and fades on --hero-head, ending
             exactly where state 2 hides it

   Everything after that — the write, the reveal, the desc block (which
   tucks to the bottom over its own scrim in CSS), the hand-off — is the
   desktop narrative unchanged. */
const NARROW_MAX = 768;
const SLIDE: readonly [number, number] = [0.04, 0.18];
const COPY_EXIT: readonly [number, number] = [0.18, 0.32];

/** Upper bound of each state, published as `data-hero-state`. */
const STATE_END = [0.06, 0.32, 0.52, 0.58, 0.74, 1];

const TAU = 0.16;
const SETTLED = 0.0002;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const span = (v: number, from: number, to: number) =>
  clamp01((v - from) / (to - from));

/**
 * Wrapper around `<zare-globe-write>` and the scroll narrative that
 * drives it: damped clock, cards/head exit variables, the centred write
 * and reveal, and the header's released contract. There is no copy
 * overlay in this variant — after the proposition exits, the Earth is
 * the statement.
 *
 * Gates, in order:
 *  - reduced motion   → nothing is imported; the static gradient is the
 *                       experience, one viewport, released from mount.
 *  - everything else  → the full scroll narrative, phones included.
 *                       `data-scroll-ready` (and the pinned height) is
 *                       granted only when the engine actually has a
 *                       renderer and its assets — a fallback gradient
 *                       never earns the pin, and a renderer dying later
 *                       revokes it.
 *
 * Phones used to be gated out (coarse pointer, or under 768px) and left
 * to the engine's own clock. That formed the globe behind the resting
 * copy within seconds of load and never latched the desc block, which
 * only the scroll driver can do — so a phone never saw the descriptive
 * block at all. The narrative now runs everywhere; the copy's overhang
 * on a short viewport is handled by the slide (see SLIDE above).
 */
export function GlobeHeroCanvas({
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
  const elRef = useRef<GlobeElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    (async () => {
      try {
        const THREE = await import('three');
        if (cancelled) return;
        (window as unknown as { THREE: unknown }).THREE = THREE;
        await import('./globe-write.js');
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

    const desc = host.querySelector<HTMLElement>('[data-hero-desc]');
    const copy = host.querySelector<HTMLElement>('[data-hero-copy]');

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
      el.setReveal?.(0);
      el.setHandoff?.(0);
      desc?.classList.remove('is-in');
      lastDescIn = false;
      delete host.dataset.scrollReady;
      delete host.dataset.heroState;
      delete host.dataset.cardsGone;
      host.style.removeProperty('height');
      host.style.removeProperty('--hero-cards');
      host.style.removeProperty('--hero-head');
      host.style.removeProperty('--hero-slide');
      host.style.removeProperty('--hero-overflow');
      setReleased(true);
    };

    /* ---------------- scroll clock ---------------- */
    let top = 0;
    let range = 1;
    let narrow = false;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      top = rect.top + window.scrollY;
      range = Math.max(1, host.offsetHeight - window.innerHeight);
      // Re-read on every measure (so resize flips modes live) — the phone
      // narrative needs to know how far the copy stack overhangs the
      // pinned viewport. Zero on a viewport tall enough to hold it.
      narrow = window.innerWidth < NARROW_MAX;
      const overflow =
        narrow && copy ? Math.max(0, copy.scrollHeight - copy.clientHeight) : 0;
      host.style.setProperty('--hero-overflow', `${Math.round(overflow)}px`);
    };
    const readScroll = () => clamp01((window.scrollY - top) / range);

    let lastState = -1;
    let lastCardsGone = false;
    let lastDescIn = false;

    const applyAt = (p: number) => {
      el.setFormProgress?.(span(p, FORM[0], FORM[1]));
      const rev = span(p, REVEAL[0], REVEAL[1]);
      el.setReveal?.(rev);
      el.setHandoff?.(span(p, HANDOFF[0], HANDOFF[1]));

      // The desc block rides the same window as the reveal, entering
      // once the Earth is unmistakably arriving. CSS animates it.
      const descIn = rev > DESC_AT;
      if (descIn !== lastDescIn) {
        lastDescIn = descIn;
        desc?.classList.toggle('is-in', descIn);
      }

      let cards = 0;
      if (narrow) {
        // Phone: no sideways exit. The copy slides up by its overhang,
        // then the whole stack lifts and fades on --hero-head.
        host.style.setProperty('--hero-slide', String(span(p, SLIDE[0], SLIDE[1])));
        host.style.setProperty('--hero-cards', '0');
        host.style.setProperty('--hero-head', String(span(p, COPY_EXIT[0], COPY_EXIT[1])));
      } else {
        host.style.removeProperty('--hero-slide');
        cards = span(p, CARDS_EXIT[0], CARDS_EXIT[1]);
        host.style.setProperty('--hero-cards', String(cards));
        host.style.setProperty('--hero-head', String(span(p, HEAD_EXIT[0], HEAD_EXIT[1])));
      }

      // The instant the cards' exit completes they also leave the tab
      // order (CSS keys visibility on this attribute). On phones the
      // cards leave with the copy, and state 2 takes them out of the
      // tree at the end of COPY_EXIT instead.
      const cardsGone = !narrow && cards >= 1;
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
      // next section arrives over the finished scene — Earth revealed,
      // halo orbiting — never a half-gathered cloud.
      if (targetP >= 1) curP = 1;
      kick();
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    // The pin is granted only when the engine actually rendered. The
    // globe engine also declares fallback when its mask/geo assets fail
    // to load, so asset death refuses the pin exactly like renderer
    // death; if fallback is declared later, the pin is revoked and the
    // layout returns to the degraded state.
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

  return createElement('zare-globe-write', {
    ref: elRef,
    speed: String(speed),
    scale: String(scale),
    'data-lit': String(lit),
    'aria-hidden': 'true',
    class: className,
  });
}
