'use client';

import { createElement, useEffect, useRef, useState } from 'react';

/** Element API exposed by mobius.js once the custom element is defined. */
type MobiusElement = HTMLElement & {
  setFormProgress?: (p: number) => void;
  setScrollDriven?: (on: boolean) => void;
};

/**
 * Wrapper around the `<zare-mobius>` web component.
 *
 * The component itself is ported verbatim from
 * docs/zare-website-v3/design_handoff_particle_mobius_hero/mobius.js and is
 * deliberately NOT rewritten in React Three Fiber. It already does everything
 * a rewrite would have to redo: one draw call for 14,000 particles, all motion
 * in the vertex shader driven by a single uniform, IntersectionObserver lazy
 * init, tab-visibility pause, reduced-motion static render, and a WebGL-failure
 * fallback.
 *
 * Three.js is imported dynamically so it never enters the initial bundle. The
 * web component polls for `window.THREE`, so assigning it asynchronously is
 * part of its contract rather than a workaround.
 *
 * SCROLL DRIVING
 * When the hero is scroll-driven, this component hands the formation clock to
 * the scrollbar and marks the nearest `[data-hero-scroll]` ancestor ready,
 * which is what gives that element its extra scroll height (see globals.css).
 *
 * The height is applied here, after a successful boot, and nowhere else. That
 * is deliberate: a hero with scroll range but no animation would be a screen
 * of empty space. No JS, reduced motion, no WebGL, a failed Three import and
 * coarse pointers all leave the attribute unset and keep the original
 * single-viewport hero with its original time-driven formation.
 */
export function MobiusCanvas({
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
  const elRef = useRef<MobiusElement | null>(null);

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
        await import('./mobius.js');
        if (!cancelled) setReady(true);
      } catch {
        // Leaves the static gradient in place. The hero copy is unaffected.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

    let progress = 0;
    const onScroll = () => {
      // Write only. The uniform is set from the component's own rAF loop,
      // which is already running, so this adds no frame work of its own.
      progress = (window.scrollY - top) / range;
      el.setFormProgress?.(progress);
    };

    measure();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      el.setScrollDriven?.(false);
      delete host.dataset.scrollReady;
    };
  }, [ready]);

  if (!ready) return null;

  // createElement rather than JSX, so a custom element does not require
  // augmenting the global JSX namespace for one component.
  return createElement('zare-mobius', {
    ref: elRef,
    variant: 'particles',
    speed: String(speed),
    markers: String(markers),
    scale: String(scale),
    // Verbatim. Do not change or explain.
    'data-route': 'B-P-S-E-L-E-C-A',
    'aria-hidden': 'true',
    class: className,
  });
}
