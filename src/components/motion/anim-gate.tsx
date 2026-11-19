'use client';

import { useEffect } from 'react';

/**
 * Enables reveal animations, and drives every `<Reveal>` on the page from a
 * single IntersectionObserver.
 *
 * Two responsibilities, deliberately combined so there is exactly one observer
 * per page rather than one per revealed element:
 *
 * 1. Add `anim` to <html>, but only when the reveal is guaranteed to run.
 *    Hidden initial states live behind `html.anim` in globals.css, so without
 *    this class every element is visible at rest. That is what keeps content
 *    from vanishing in prerendered snapshots, with JS disabled, or in a
 *    background tab where IntersectionObserver never fires.
 *
 * 2. Observe `[data-reveal]` and add `is-in` as each enters the viewport.
 *
 * Rendered once, in the site layout.
 */
export function AnimGate() {
  useEffect(() => {
    const root = document.documentElement;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // No observer support, reduced motion, or a document that is not visible:
    // leave `anim` off entirely so everything renders in its final state.
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      return;
    }

    let observer: IntersectionObserver | null = null;
    let mutations: MutationObserver | null = null;
    let failsafe = 0;

    const revealAll = () => {
      root.classList.add('anim');
      document
        .querySelectorAll('[data-reveal]:not(.is-in)')
        .forEach((el) => el.classList.add('is-in'));
    };

    // Failsafe. If observation fails to run — or new elements arrive that it
    // somehow misses — reveal everything rather than leaving the page blank.
    // Re-armed on every batch of new elements, because this component mounts
    // once in a persistent layout while pages come and go beneath it.
    const armFailsafe = () => {
      window.clearTimeout(failsafe);
      failsafe = window.setTimeout(revealAll, 3000);
    };

    const observeAll = () => {
      document
        .querySelectorAll('[data-reveal]:not(.is-in)')
        .forEach((el) => observer?.observe(el));
    };

    const start = () => {
      if (observer) return;
      root.classList.add('anim');

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-in');
            // Reveals run once. Stop observing immediately so scrolling back
            // up does not re-trigger, and so the observer sheds work.
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
      );
      observeAll();
      // The observer now owns revelation; the pending failsafe would only
      // pre-fire every below-fold reveal at the 3s mark.
      window.clearTimeout(failsafe);
    };

    if (document.visibilityState === 'visible') {
      start();
    } else {
      document.addEventListener('visibilitychange', start, { once: true });
    }
    armFailsafe();

    // The layout — and therefore this effect — survives client-side
    // navigation, so every route change mounts `[data-reveal]` elements the
    // initial snapshot never saw. Without this they stay at opacity 0
    // forever: no error, no content, just an empty section. Watch the DOM
    // and hand every new arrival to the observer — or, if the observer never
    // started (document hidden since load), to a fresh failsafe so the
    // content is at worst revealed unanimated. Deliberately OUTSIDE the
    // visibility gate.
    mutations = new MutationObserver((batch) => {
      for (const m of batch) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          if (el.matches('[data-reveal]') || el.querySelector('[data-reveal]')) {
            if (observer) observeAll();
            else armFailsafe();
            return;
          }
        }
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(failsafe);
      document.removeEventListener('visibilitychange', start);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, []);

  return null;
}
