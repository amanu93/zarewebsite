'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  navGroups,
  NAV_CHALLENGE,
  NAV_CTA,
  NAV_WORK,
  type NavGroup,
  type NavItem,
} from '@/content/navigation';
import { Container } from './container';
import { ZareLogo } from './logo';

/** How long an open panel survives the pointer leaving it. Long enough to
 *  cross the gap between trigger and panel diagonally, short enough that the
 *  panel never feels stuck open. */
const CLOSE_DELAY = 160;

type GroupKey = NavGroup['key'];

const groupIndex = (key: GroupKey | null) =>
  key === null ? -1 : navGroups.findIndex((g) => g.key === key);

/** Homepage sections mapped to the group that navigates to them — the
 *  scroll-spy vocabulary. Sections outside the nav (hero, testimonials)
 *  deliberately map to nothing. */
const SECTION_GROUP: Record<string, GroupKey> = {
  'tech-ai': 'what',
  embedded: 'what',
  'how-we-deliver': 'what',
  'working-model': 'what',
  security: 'what',
  work: 'work',
  contact: 'company',
};

/** Off the homepage, the active group derives from the route. */
const routeGroupOf = (pathname: string | null): GroupKey | null => {
  if (!pathname || pathname === '/') return null;
  // Work is a plain link, not a panel group — its routes still light it.
  if (pathname.startsWith(NAV_WORK.href)) return 'work';
  for (const g of navGroups) {
    const all = [...g.items, ...(g.featured ? [g.featured] : [])];
    if (all.some((i) => !i.href.includes('#') && pathname.startsWith(i.href))) {
      return g.key;
    }
  }
  return null;
};

/**
 * The site header.
 *
 * Two panel groups — the offering and the entity — open ONE shared panel
 * whose content crossfades and whose height interpolates as the pointer
 * moves between triggers: the same object changing state, not menus
 * appearing. Work is a plain link to the case-study list, and the bar ends
 * in a pair of buttons: Build with Zare solid, then the Scale Challenge
 * outlined. Same height and shape, different weight — the filled one is where
 * the eye lands, and the challenge is what a cold visitor should click.
 * All copy comes from content/navigation.ts, which sources it from existing
 * page content.
 *
 * Transparent over the homepage hero, solid ink everywhere else, decided at
 * SSR from the pathname. The hero-phase threshold (scrollY > 40) is
 * deliberately untouched here; it is replaced in the hero coordination pass.
 *
 * Below `lg` the header is the burger + full-screen accordion — the tablet
 * band deliberately uses the mobile navigation rather than a third layout.
 */
export function Header({ solid = false }: { solid?: boolean } = {}) {
  const pathname = usePathname();

  // The transparent state renders white text over whatever sits underneath,
  // which is only safe over the homepage's dark hero. Everywhere else the
  // header pins solid from the first paint — `solid` remains as an explicit
  // override for surfaces outside this layout (marketing, not-found).
  const pinned = solid || pathname !== '/';
  const [scrolled, setScrolled] = useState(pinned);

  // Desktop panel: which group is open. Mobile: menu open + which accordion
  // group is expanded. Item hover needs no state — the ghost icons reveal
  // through CSS alone.
  const [open, setOpen] = useState<GroupKey | null>(null);
  /** The most recent non-null group — keeps the slide direction and panel
   *  content stable while the panel fades out. */
  const [lastOpen, setLastOpen] = useState<GroupKey | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<GroupKey | null>(null);

  const navRef = useRef<HTMLDivElement | null>(null);
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef<Partial<Record<GroupKey, HTMLButtonElement>>>({});
  const contentRefs = useRef<Partial<Record<GroupKey, HTMLDivElement>>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const activeIndex = groupIndex(open ?? lastOpen);

  const openGroup = (key: GroupKey) => {
    setOpen(key);
    setLastOpen(key);
  };

  // The active-group indicator: route-derived everywhere, scroll-spied on
  // the homepage — the trigger whose section currently dominates the
  // viewport carries the mark.
  const [spyGroup, setSpyGroup] = useState<GroupKey | null>(null);
  const activeGroup = pathname === '/' ? spyGroup : routeGroupOf(pathname);

  useEffect(() => {
    if (pathname !== '/') return;
    const targets = Object.keys(SECTION_GROUP)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!targets.length) return;
    // A narrow band around the viewport's upper middle: a section is "the
    // one on screen" while it crosses it, and none is during the hero.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const current = targets.find((t) => visible.has(t.id));
        setSpyGroup(current ? SECTION_GROUP[current.id] : null);
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [pathname]);

  // The scroll fade runs only when the transparent state is allowed; pinned
  // routes render solid via `pinned` itself at the class-name call site.
  useEffect(() => {
    if (pinned) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pinned]);

  // Any navigation closes every surface — link taps, browser Back, and
  // programmatic routing alike. Done as a during-render state adjustment
  // (React's sanctioned pattern) rather than an effect: no post-commit
  // flash of an open menu on the new page, and no setState-in-effect.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(null);
    setMenuOpen(false);
    setMobileGroup(null);
  }

  // Measure the active panel content and write the height straight to the
  // box so CSS can transition it — a ref write, not state, so no second
  // render and no setState-in-effect. The height is never unset: keeping the
  // last value makes the close a pure fade instead of a collapse.
  useLayoutEffect(() => {
    if (!open) return;
    const apply = () => {
      const el = contentRefs.current[open];
      if (el && boxRef.current) {
        boxRef.current.style.height = `${el.offsetHeight}px`;
      }
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [open]);

  // Scroll lock while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Mobile menu focus contract: page content behind the overlay goes inert,
  // focus moves into the menu, and returns to the burger on close.
  useEffect(() => {
    if (!menuOpen) return;
    const behind = document.querySelectorAll<HTMLElement>('main, footer');
    behind.forEach((el) => el.setAttribute('inert', ''));
    menuRef.current?.focus();
    return () => {
      behind.forEach((el) => el.removeAttribute('inert'));
      burgerRef.current?.focus();
    };
  }, [menuOpen]);

  // Escape closes whichever surface is open; the panel returns focus to the
  // trigger that owns it.
  useEffect(() => {
    if (!menuOpen && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      if (open) {
        triggerRefs.current[open]?.focus();
        setOpen(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, open]);

  // A press anywhere outside the nav (triggers + panel) closes the panel.
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', onPress);
    return () => window.removeEventListener('pointerdown', onPress);
  }, [open]);

  const holdOpen = (key?: GroupKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (key) openGroup(key);
  };
  const armClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
  };

  return (
    <>
      <header
        data-tone="ink"
        className={cn(
          'fixed inset-x-0 top-0 z-50 h-header-h md:h-header-h-md',
          'flex items-center border-b transition-colors duration-300 motion-reduce:transition-none',
          pinned || scrolled || menuOpen || open
            ? 'border-[var(--rule-color)] bg-surface-ink/95 backdrop-blur-md'
            : 'border-transparent bg-transparent',
        )}
      >
        {/* First tab stop on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-accent-contrast"
        >
          Skip to content
        </a>

        <Container className="flex items-center gap-6">
          {/* Sized against the bar's fixed height (64/72px): the lockup
              takes the headroom without moving it. */}
          <Link href="/" className="text-on-dark-strong no-underline">
            <ZareLogo className="h-10 w-auto md:h-11" />
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center lg:flex">
            <div
              ref={navRef}
              className="relative flex items-center gap-8"
              onPointerLeave={armClose}
            >
              {navGroups.map((g) => (
                <button
                  key={g.key}
                  ref={(el) => {
                    if (el) triggerRefs.current[g.key] = el;
                  }}
                  type="button"
                  onClick={() =>
                    open === g.key ? setOpen(null) : openGroup(g.key)
                  }
                  onPointerEnter={() => holdOpen(g.key)}
                  aria-expanded={open === g.key}
                  aria-controls="nav-panel"
                  className={cn(
                    'relative flex items-center gap-1.5 py-2 text-[13px] font-semibold transition-colors [perspective:120px]',
                    open === g.key || activeGroup === g.key
                      ? 'text-on-dark-strong'
                      : 'text-on-dark hover:text-on-dark-strong',
                  )}
                >
                  {/* Scroll-spy mark: this group's destination is what the
                      visitor is currently looking at. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-accent',
                      'transition-[opacity,transform] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none',
                      activeGroup === g.key
                        ? 'scale-x-100 opacity-100'
                        : 'scale-x-0 opacity-0',
                    )}
                  />
                  {g.label}
                  {/* The chevron backflips on the X axis — a slow tumble
                      toward the viewer rather than a spin. */}
                  <svg
                    viewBox="0 0 10 6"
                    aria-hidden="true"
                    className={cn(
                      'h-1.5 w-2.5 transition-transform duration-700 ease-[var(--ease-enter)] motion-reduce:transition-none',
                      open === g.key && '[transform:rotateX(180deg)]',
                    )}
                  >
                    <path
                      d="M1 1l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}

              {/* Work: the proof is one click, no panel. Same typography
                  as the triggers, same scroll-spy mark. Entering it arms
                  the panel's close like leaving the nav does. */}
              <Link
                href={NAV_WORK.href}
                onPointerEnter={armClose}
                aria-current={
                  pathname.startsWith(NAV_WORK.href) ? 'page' : undefined
                }
                className={cn(
                  'relative py-2 text-[13px] font-semibold no-underline transition-colors',
                  activeGroup === 'work'
                    ? 'text-on-dark-strong'
                    : 'text-on-dark hover:text-on-dark-strong',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-accent',
                    'transition-[opacity,transform] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none',
                    activeGroup === 'work'
                      ? 'scale-x-100 opacity-100'
                      : 'scale-x-0 opacity-0',
                  )}
                />
                {NAV_WORK.label}
              </Link>

              {/* THE SHARED PANEL. One surface, kept mounted so both the
                  open/close and the state-to-state transitions animate;
                  `invisible` removes the closed panel from the tab order.
                  Content layers crossfade with a directional slide while the
                  container height interpolates — the same object changing
                  state, not three menus. */}
              <div
                id="nav-panel"
                onPointerEnter={() => holdOpen()}
                className={cn(
                  'absolute right-0 top-full w-[640px] max-w-[calc(100vw-40px)] pt-3',
                  'transition-all duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none',
                  open
                    ? 'visible translate-y-0 opacity-100'
                    : 'invisible -translate-y-2 opacity-0',
                )}
              >
                {/* The card: rounded and opaque on the header's own surface —
                    the panel reads as part of the bar, not a pane of glass
                    over the page. One soft ambient shadow for separation. */}
                <div
                  ref={boxRef}
                  className="relative overflow-hidden rounded-xl border border-rule-neutral bg-surface-ink shadow-[0_24px_48px_rgba(2,8,16,.45)] transition-[height] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none"
                >
                  {/* Top hairline: the accent entering and leaving the frame —
                      the one gradient the design language allows, depth blue
                      only ever inside it. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-4 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,var(--color-accent)_35%,var(--color-accent-depth)_70%,transparent)] opacity-60"
                  />
                  <div className="relative">
                    {navGroups.map((g, i) => {
                      const active = open === g.key;
                      const before = i < activeIndex;
                      return (
                        <div
                          key={g.key}
                          ref={(el) => {
                            if (el) contentRefs.current[g.key] = el;
                          }}
                          aria-hidden={!active}
                          className={cn(
                            'left-0 right-0 top-0 p-7',
                            'transition-[opacity,transform] duration-500 ease-[var(--ease-enter)] motion-reduce:transition-none',
                            active
                              ? 'relative translate-x-0 opacity-100'
                              : cn(
                                  'pointer-events-none absolute opacity-0',
                                  before ? '-translate-x-8' : 'translate-x-8',
                                ),
                          )}
                        >
                          <p className="inline-flex items-center gap-3 font-mono text-label uppercase text-accent-bright">
                            <span
                              aria-hidden="true"
                              className="h-0.5 w-[26px] shrink-0 bg-accent"
                            />
                            {g.intro}
                          </p>
                          <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                            {g.items.map((item) => (
                              <li key={item.href}>
                                <PanelItem
                                  item={item}
                                  active={active}
                                  current={
                                    !item.href.includes('#') &&
                                    pathname === item.href
                                  }
                                  onNavigate={() => setOpen(null)}
                                />
                              </li>
                            ))}
                          </ul>

                          {g.featured ? (
                            <div className="mt-5 border-t border-rule-dark pt-4">
                              <PanelItem
                                item={g.featured}
                                active={active}
                                current={false}
                                featured
                                onNavigate={() => setOpen(null)}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Two buttons, same height and shape, different weight. The
                outlined Scale Challenge opens the pair; Build with Zare —
                the first call to action — closes it FILLED, in the bar's
                anchor position where the primary ask belongs. */}
            <div className="ml-8 flex shrink-0 items-center gap-3">
              {NAV_CHALLENGE ? (
                <Link
                  href={NAV_CHALLENGE.href}
                  aria-current={
                    pathname.startsWith(NAV_CHALLENGE.href) ? 'page' : undefined
                  }
                  className="inline-flex h-11 items-center rounded-md border border-accent px-5 text-[14px] font-bold text-accent no-underline transition-colors hover:bg-accent/10"
                >
                  {NAV_CHALLENGE.label}
                </Link>
              ) : null}

              <Link
                href={NAV_CTA.href}
                className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-[14px] font-bold text-accent-contrast no-underline transition-colors hover:bg-accent-bright"
              >
                {NAV_CTA.label}
              </Link>
            </div>
          </nav>

          <button
            ref={burgerRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            className="ml-auto grid h-12 w-12 place-items-center rounded-md border border-[var(--rule-color)] lg:hidden"
          >
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden="true" className="grid gap-[5px]">
              <span
                className={cn(
                  'block h-0.5 w-5 bg-on-dark-strong transition-transform duration-200 motion-reduce:transition-none',
                  menuOpen && 'translate-y-[7px] rotate-45',
                )}
              />
              <span
                className={cn(
                  'block h-0.5 w-5 bg-on-dark-strong transition-opacity duration-200 motion-reduce:transition-none',
                  menuOpen && 'opacity-0',
                )}
              />
              <span
                className={cn(
                  'block h-0.5 w-5 bg-on-dark-strong transition-transform duration-200 motion-reduce:transition-none',
                  menuOpen && '-translate-y-[7px] -rotate-45',
                )}
              />
            </span>
          </button>
        </Container>
      </header>

      {/* MOBILE / TABLET MENU. Its own information architecture: three
          category accordions, then the CTA — not a shrunken desktop panel.
          Entrance animates via keyframes (conditional render, so no exit
          machinery); reduced motion renders it instantly. */}
      {menuOpen ? (
        <nav
          id="site-menu"
          ref={menuRef}
          tabIndex={-1}
          aria-label="Mobile"
          data-tone="ink"
          className="menu-enter fixed inset-0 z-40 flex flex-col overflow-y-auto bg-surface-ink px-gutter-mobile pb-10 pt-[calc(var(--spacing-header-h)+16px)] outline-none lg:hidden"
        >
          <div className="my-auto flex flex-col gap-1">
            {navGroups.map((g) => {
              const expanded = mobileGroup === g.key;
              return (
                <div key={g.key} className="border-b border-[var(--rule-color)]">
                  <button
                    type="button"
                    onClick={() => setMobileGroup(expanded ? null : g.key)}
                    aria-expanded={expanded}
                    aria-controls={`m-group-${g.key}`}
                    className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left"
                  >
                    <span className="font-display text-display-3 text-on-dark-strong">
                      {g.label}
                    </span>
                    <svg
                      viewBox="0 0 10 6"
                      aria-hidden="true"
                      className={cn(
                        'h-2 w-3.5 text-[var(--accent-text)] transition-transform duration-200 motion-reduce:transition-none',
                        expanded && 'rotate-180',
                      )}
                    >
                      <path
                        d="M1 1l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div
                    id={`m-group-${g.key}`}
                    className={cn(
                      'grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none',
                      expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <ul className="flex flex-col pb-3">
                        {[...g.items, ...(g.featured ? [g.featured] : [])].map(
                          (item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                tabIndex={expanded ? undefined : -1}
                                aria-current={
                                  !item.href.includes('#') && pathname === item.href
                                    ? 'page'
                                    : undefined
                                }
                                onClick={() => setMenuOpen(false)}
                                className="flex min-h-12 flex-col justify-center gap-0.5 py-2 no-underline"
                              >
                                <span className="font-display text-body font-semibold text-on-dark-strong">
                                  {item.title}
                                </span>
                                <span className="text-caption text-on-dark-muted">
                                  {item.subtitle}
                                </span>
                              </Link>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Work: flat row, no accordion — one tap to the proof. */}
            <div className="border-b border-[var(--rule-color)]">
              <Link
                href={NAV_WORK.href}
                aria-current={
                  pathname.startsWith(NAV_WORK.href) ? 'page' : undefined
                }
                onClick={() => setMenuOpen(false)}
                className="flex min-h-14 items-center py-3 no-underline"
              >
                <span className="font-display text-display-3 text-on-dark-strong">
                  {NAV_WORK.label}
                </span>
              </Link>
            </div>

            {/* The same pair as the desktop bar, stacked and full width:
                the outlined challenge first, the filled ask closing. */}
            <div className="mt-8 flex flex-col gap-3">
              {NAV_CHALLENGE ? (
                <Link
                  href={NAV_CHALLENGE.href}
                  aria-current={
                    pathname.startsWith(NAV_CHALLENGE.href) ? 'page' : undefined
                  }
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-md border border-accent px-6 font-bold text-accent no-underline"
                >
                  {NAV_CHALLENGE.label}
                </Link>
              ) : null}

              <Link
                href={NAV_CTA.href}
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 font-bold text-accent-contrast no-underline"
              >
                {NAV_CTA.label}
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A panel row: title + subtitle, marked on hover by the site's accent */
/* left-bar growing in — the same device every primary column on the   */
/* page uses. Pure CSS transitions; nothing runs continuously.         */
/* ------------------------------------------------------------------ */

function PanelItem({
  item,
  active,
  current,
  featured = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  current: boolean;
  featured?: boolean;
  onNavigate: () => void;
}) {
  if (item.cta) {
    // The one call-to-action row a panel may carry: the site's single
    // highlight recipe (gradient fill, strong border, inward glow), with
    // the arrow always present and pulling on hover.
    return (
      <Link
        href={item.href}
        tabIndex={active ? undefined : -1}
        onClick={onNavigate}
        className="surface-highlight group flex items-center justify-between gap-4 rounded-lg px-4 py-3.5 no-underline transition-transform duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none hover:-translate-y-0.5"
      >
        <span className="flex flex-col gap-1">
          <span className="font-display text-[15px] font-semibold text-on-dark-strong">
            {item.title}
          </span>
          <span className="text-caption leading-relaxed text-on-dark-muted">
            {item.subtitle}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-[18px] text-accent transition-transform duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      tabIndex={active ? undefined : -1}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
      className="group relative flex flex-col gap-1 rounded-lg py-3 pl-4 pr-3 no-underline transition-colors duration-300 ease-[var(--ease-enter)] hover:bg-[rgba(64,193,199,.05)]"
    >
      {/* The accent bar, grown from the middle on hover or focus. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-2.5 left-1 w-0.5 origin-center scale-y-0 rounded-full bg-accent',
          'transition-transform duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none',
          'group-hover:scale-y-100 group-focus-visible:scale-y-100',
        )}
      />
      <span
        className={cn(
          'flex items-center gap-2 font-display text-[15px] font-semibold',
          featured ? 'text-[var(--accent-text)]' : 'text-on-dark-strong',
        )}
      >
        {item.title}
        <span
          aria-hidden="true"
          className="text-accent opacity-0 transition-[opacity,transform] duration-300 ease-[var(--ease-enter)] motion-reduce:transition-none group-hover:translate-x-0.5 group-hover:opacity-100"
        >
          →
        </span>
      </span>
      <span className="text-caption leading-relaxed text-on-dark-muted">
        {item.subtitle}
      </span>
    </Link>
  );
}
