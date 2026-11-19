'use client';

import { useEffect, useRef } from 'react';

/**
 * The trust strip's particle ground — the hero's field carried into the
 * page, SCROLL-DRIVEN: as the section scrolls into view the particles
 * travel from the globe's position (above, centre — where the hero just
 * left them) down into the section, trading the hero's pale tint for the
 * site teal in flight, and scatter into a loose rectangular field behind
 * the logo wall. Scrolling back up gathers them toward the globe again —
 * the hand-off is a pure function of scroll, damped for feel.
 *
 * Hovering a logo excites the settled particles near it: they take seats
 * on a slowly circulating orbit around that cell and brighten; leaving
 * lets them drift home.
 *
 * Deliberately NOT a second WebGL scene — a 2D canvas with ~220 dots.
 * The loop is gated by IntersectionObserver and document visibility,
 * skipped entirely under reduced motion, halved on coarse pointers,
 * DPR-capped at 2, and allocates nothing per frame.
 *
 * Decorative: `aria-hidden`, `pointer-events: none`. Hover targets are
 * the section's `[data-client-logo]` cells via delegated pointer events.
 */

const COUNT_FINE = 520;
const COUNT_COARSE = 260;

/** How much of the viewport the section must rise through for the
 *  scatter to complete (0 = top at viewport bottom → 1 = fully spread). */
const TRAVEL_SPAN = 0.85;
/** Per-particle stagger share of the travel — the cloud unfurls, it does
 *  not teleport as one body. */
const STAGGER = 0.45;
/** Damping applied to the scroll target per second-ish. */
const EASE = 3.2;

/** This section is PAPER — white ground, the inverse of the hero's ink.
 *  The hero's pale tints vanish here, so the journey runs slate → deep
 *  teal: dark enough to carry on white at modest alpha, still
 *  unmistakably the brand teal. */
const PALE = { r: 108, g: 152, b: 170 };
const TEAL = { r: 36, g: 148, b: 155 };
/** Excited tint near a hovered logo (accent-bright). */
const BRIGHT = { r: 16, g: 185, b: 190 };

interface Dot {
  /** Origin: seated on the globe's flank, above the section. */
  ox: number;
  oy: number;
  /** Home: this dot's seat in the settled rectangle. */
  hx: number;
  hy: number;
  /** Live position (spring-follows the scroll-interpolated target). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  /** This dot's slice of the stagger, 0..1. */
  stag: number;
  /** 0..1 excitement toward the hovered cell's orbit. */
  heat: number;
  /** Angle of this dot's seat on the hovered cell's orbit. */
  seat: number;
}

const smooth = (v: number) => v * v * (3 - 2 * v);
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function TrustParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const section = canvas.closest('section');
    const ctx = canvas.getContext('2d');
    if (!section || !ctx) return;

    const coarse = !window.matchMedia('(pointer: fine)').matches;
    const N = coarse ? COUNT_COARSE : COUNT_FINE;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Origins cluster around the globe's position — above the section,
    // centred (the hero's Earth sits dead centre). Homes fill the
    // rectangle. Scroll interpolates between the two.
    const seed = (): Dot => {
      const spreadX = (Math.random() + Math.random() - 1) * w * 0.18;
      return {
        ox: w / 2 + spreadX,
        oy: -h * 0.3 - Math.random() * h * 0.7,
        hx: Math.random() * w,
        hy: Math.random() * h,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0.9 + Math.random() * Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
        stag: Math.random(),
        heat: 0,
        seat: Math.random() * Math.PI * 2,
      };
    };
    const dots: Dot[] = Array.from({ length: N }, seed);
    for (const d of dots) {
      d.x = d.ox;
      d.y = d.oy;
    }

    /* Hovered cell, in canvas coordinates. */
    let cell: { cx: number; cy: number; rx: number; ry: number } | null = null;
    const onOver = (e: PointerEvent) => {
      const t = (e.target as Element).closest('[data-client-logo]');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      cell = {
        cx: r.left - c.left + r.width / 2,
        cy: r.top - c.top + r.height / 2,
        rx: r.width / 2 + 26,
        ry: r.height / 2 + 22,
      };
    };
    const onOut = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-client-logo]')) cell = null;
    };
    section.addEventListener('pointerover', onOver);
    section.addEventListener('pointerout', onOut);

    /* Run only while near the viewport. */
    let inView = false;
    let frame = 0;
    let last = 0;
    /** Damped scroll progress of the hand-off. */
    let cur = 0;

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      // Generous top margin: the travel starts while the section is still
      // below the fold, so the pour is already moving as it appears.
      { rootMargin: '160px 0px 80px 0px' },
    );
    io.observe(section);
    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);
    const ro = new ResizeObserver(() => {
      const ow = w;
      resize();
      if (ow > 0 && w > 0) {
        const s = w / ow;
        for (const d of dots) {
          d.hx *= s;
          d.ox = w / 2 + (d.ox - ow / 2) * s;
          d.x *= s;
        }
      }
    });
    ro.observe(canvas);

    const readTarget = () => {
      // 0 while the section top sits at the viewport's bottom edge; 1 once
      // it has risen TRAVEL_SPAN of the viewport. Pure function of scroll.
      const top = section.getBoundingClientRect().top;
      return clamp01((window.innerHeight - top) / (window.innerHeight * TRAVEL_SPAN));
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;

      cur += (readTarget() - cur) * Math.min(1, dt * EASE);

      // Velocity decay as a function of TIME, not frames — the pour
      // feels identical on 60Hz and 144Hz screens. exp(-dt*6.5) at
      // 60fps ≈ the old per-frame 0.9.
      const damp = Math.exp(-dt * 6.5);

      ctx.clearRect(0, 0, w, h);

      for (const d of dots) {
        // This dot's share of the journey, staggered and eased.
        const tt = smooth(clamp01((cur - d.stag * STAGGER) / (1 - STAGGER)));

        // Scroll-interpolated seat: globe flank → rectangle home.
        let tx = d.ox + (d.hx - d.ox) * tt;
        let ty = d.oy + (d.hy - d.oy) * tt;

        // Hover: settled dots near the hovered cell take orbit seats.
        let hot = false;
        if (cell && tt > 0.85) {
          const ddx = d.hx - cell.cx;
          const ddy = d.hy - cell.cy;
          const reach = Math.hypot(ddx / (cell.rx * 2.4), ddy / (cell.ry * 2.4));
          if (reach < 1) {
            hot = true;
            d.seat += dt * 0.9;
            tx = cell.cx + Math.cos(d.seat) * cell.rx;
            ty = cell.cy + Math.sin(d.seat) * cell.ry;
          }
        }
        d.heat += ((hot ? 1 : 0) - d.heat) * Math.min(1, dt * 4);

        // Spring toward the seat + a slow breathing wander once settled.
        const k = hot ? 5.5 : 3;
        d.vx += (tx - d.x) * k * dt;
        d.vy += (ty - d.y) * k * dt;
        d.vx *= damp;
        d.vy *= damp;
        d.x += d.vx + Math.sin(now * 0.0004 + d.phase) * 0.08 * tt;
        d.y += d.vy + Math.cos(now * 0.0005 + d.phase * 1.7) * 0.06 * tt;

        const r = d.size * (0.6 + 0.4 * tt) * (1 + d.heat * 0.6);
        const cr = Math.round(PALE.r + (TEAL.r - PALE.r) * tt + (BRIGHT.r - TEAL.r) * d.heat);
        const cg = Math.round(PALE.g + (TEAL.g - PALE.g) * tt + (BRIGHT.g - TEAL.g) * d.heat);
        const cb = Math.round(PALE.b + (TEAL.b - PALE.b) * tt + (BRIGHT.b - TEAL.b) * d.heat);
        // Twinkle around a base strong enough for white ground — the
        // settled field should read as plainly as the hero's rest field
        // does on ink.
        const alpha =
          (0.34 + 0.16 * Math.sin(now * 0.0011 + d.phase * 3)) *
          (0.45 + 0.55 * tt) *
          (1 + d.heat * 1.2);
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(0.8, alpha)})`;
        ctx.fill();
      }

      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      const shouldRun = inView && !document.hidden;
      if (shouldRun && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!shouldRun && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      section.removeEventListener('pointerover', onOver);
      section.removeEventListener('pointerout', onOut);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
