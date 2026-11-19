'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  Check,
  ChevronDown,
  FileSignature,
  FileText,
  Flame,
  Lock,
  LogOut,
  PhoneCall,
  Settings,
  Users,
  UserCog,
  X,
} from 'lucide-react';

import {
  DEMO_MODE,
  ROLE_LABEL,
  ROLES,
  signInAs,
  signOut,
  useCallQueue,
  useCallStats,
  useCurrentUser,
  useHydrated,
  useSession,
  useUsers,
  type Role,
  type User,
} from '@/bench/data';
import { CallToastProvider } from '@/bench/components/call-toast';
import { ZareLogo } from '@/components/layout/logo';
import { ZareMark } from '@/bench/components/zare-mark';
import { useMounted } from '@/bench/use-mounted';
import { cn } from '@/bench/utils';

/**
 * Navigation is role-aware. Two roles: an exec runs the portal (staff,
 * roles, role settings); a recruiter works the bench. Pages a role cannot
 * use are left out of its navigation, and exec-only pages refuse to render
 * for anyone else even when reached by URL. The data layer and the API
 * enforce the same rules underneath.
 *
 * Two layouts from one list. Desktop gets the sidebar. Phones get a bottom
 * tab bar, because the phone is where calls actually get made: the queue has
 * to be one thumb away, not behind a menu.
 */
const ALL: Role[] = ROLES;

interface NavItem {
  href: string;
  label: string;
  /** Tab bar label. Five tabs on a 375px screen leave about 70px each. */
  short: string;
  icon: LucideIcon;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: '/portal', label: 'Dashboard', short: 'Bench', icon: BarChart3, roles: ALL },
  // An exec has no reason to live in the call queue.
  { href: '/portal/queue', label: 'Call queue', short: 'Queue', icon: PhoneCall, roles: ['recruiter'] },
  { href: '/portal/candidates', label: 'Candidates', short: 'Candidates', icon: Users, roles: ALL },
  { href: '/portal/requests', label: 'Requests', short: 'Requests', icon: Briefcase, roles: ALL },
  // Folded in from /admin. Jobs and contracts are everyday work; staff
  // administration is the exec's.
  { href: '/portal/jobs', label: 'Jobs', short: 'Jobs', icon: FileText, roles: ALL },
  { href: '/portal/contracts', label: 'Contracts', short: 'Contracts', icon: FileSignature, roles: ALL },
  { href: '/portal/staff', label: 'Staff', short: 'Staff', icon: UserCog, roles: ['exec'] },
  { href: '/portal/settings', label: 'Settings', short: 'Settings', icon: Settings, roles: ALL },
];

const isActive = (href: string, pathname: string) =>
  href === '/portal' ? pathname === '/portal' : pathname === href || pathname.startsWith(`${href}/`);

/** Pages only an exec may open, by URL as well as from the navigation. */
const EXEC_ONLY = NAV.filter((n) => n.roles.length === 1 && n.roles[0] === 'exec').map((n) => n.href);
const isExecOnly = (pathname: string) => EXEC_ONLY.some((href) => isActive(href, pathname));

const initials = (name: string | null) =>
  (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signedIn } = useSession();
  const isSignIn = pathname === '/portal/login';
  const user = useCurrentUser();
  const stats = useCallStats();
  const queue = useCallQueue();
  // Open for one page only: the sheet records the path it was opened on,
  // so navigating anywhere closes it without an effect.
  const [accountOpenOn, setAccountOpenOn] = useState<string | null>(null);
  const accountOpen = accountOpenOn === pathname;
  const accountButton = useRef<HTMLButtonElement>(null);

  // The store seeds from Date.now() on the server and rehydrates from
  // sessionStorage on the client, so the two passes can never produce
  // identical HTML. Rather than pretend otherwise, hold the first paint until
  // mount: server and first client render both emit the same shell, and the
  // data arrives one frame later. Costs a frame, removes the mismatch
  // entirely. A real database makes this unnecessary — the server would hold
  // the truth and this gate comes out with it.
  const mounted = useMounted();
  // API mode: the snapshot starts empty and fills from landing-api; the
  // shell holds its skeleton until that first fetch lands. Always true in
  // demo mode, so nothing changes there.
  const hydrated = useHydrated();

  // Signed out: every page sends you to sign in, remembering where you were
  // going. In the real build this is middleware checking the Supabase
  // session on the server, so a signed-out request never renders a page.
  useEffect(() => {
    if (mounted && !signedIn && !isSignIn) {
      router.replace(`/portal/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, signedIn, isSignIn, pathname, router]);

  const nav = NAV.filter((n) => n.roles.includes(user?.role ?? 'recruiter'));
  // Candidates cooling down after no answer are in the queue but not due.
  const dueNow = queue.filter((i) => !i.retry_at).length;

  // The sign-in page is its own full-screen layout: no sidebar, no counters.
  if (isSignIn) return <>{children}</>;
  if (!mounted || !hydrated) return <ShellSkeleton />;
  // Redirecting. Render nothing that belongs to a signed-in user.
  if (!signedIn) return <div className="min-h-screen bg-bench-ground" />;

  return (
    <div className="flex min-h-screen bg-bench-ground">
      {/* ---------------------------------------------------- desktop ---- */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-bench-line bg-bench-surface md:flex">
        <Brand />
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
          {nav.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            const badge = item.href === '/portal/queue' ? dueNow : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors',
                  active ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-dim hover:bg-bench-surface-2 hover:text-bench-ink',
                )}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="tabular rounded bg-bench-critical/15 px-1.5 py-0.5 text-[10px] text-bench-critical">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <RolePicker />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-bench-line bg-bench-surface/60 px-4 backdrop-blur md:px-5">
          <Link href="/portal" className="flex items-center gap-2.5 md:hidden" aria-label="Zare Bench, dashboard">
            <ZareMark className="h-7 w-auto" />
            <span className="brand-label text-[11px] text-bench-ink">Bench</span>
          </Link>
          <div className="hidden md:block" />

          <div className="flex items-center gap-2 md:gap-4">
            <div
              className="flex items-center gap-1.5 rounded-md border border-bench-line bg-bench-surface-2 px-2.5 py-1.5 md:gap-2 md:px-3"
              title={`${stats.calls_today} ${stats.calls_today === 1 ? 'call' : 'calls'} logged today`}
            >
              <PhoneCall size={13} className="text-accent" strokeWidth={2} />
              <span className="tabular text-[13px] font-semibold">{stats.calls_today}</span>
              <span className="hidden text-[11px] text-bench-ink-faint sm:inline">
                {stats.calls_today === 1 ? 'call' : 'calls'} today
              </span>
            </div>
            {stats.streak_days > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-md border border-bench-warning/25 bg-bench-warning/10 px-2 py-1.5 md:px-2.5"
                title={`${stats.streak_days} consecutive days with at least one call logged`}
              >
                <Flame size={13} className="text-bench-warning" strokeWidth={2} />
                <span className="tabular text-[13px] font-semibold text-bench-warning">{stats.streak_days}</span>
                <span className="hidden text-[11px] text-bench-warning/70 sm:inline">day streak</span>
              </div>
            )}
            <button
              ref={accountButton}
              type="button"
              onClick={() => setAccountOpenOn(pathname)}
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              aria-label={`Account: ${user.full_name}, ${ROLE_LABEL[user.role]}`}
              className="grid h-9 w-9 place-items-center rounded-full bg-bench-surface-3 text-[11px] font-semibold ring-accent/50 transition-shadow focus-visible:ring-2 md:hidden"
            >
              {initials(user.full_name)}
            </button>
          </div>
        </header>

        {/* Clear the tab bar, including the home indicator on notched phones. */}
        <main className="min-w-0 flex-1 overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <CallToastProvider>
            {isExecOnly(pathname) && user?.role !== 'exec' ? <ExecOnly /> : children}
          </CallToastProvider>
        </main>
      </div>

      {/* ----------------------------------------------------- phone ----- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-bench-line bg-bench-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            const badge = item.href === '/portal/queue' ? dueNow : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={badge > 0 ? `${item.label}, ${badge} waiting` : item.label}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] transition-colors',
                    active ? 'text-accent' : 'text-bench-ink-faint active:text-bench-ink',
                  )}
                >
                  {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-accent" aria-hidden />}
                  <span className="relative">
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                    {badge > 0 && (
                      <span className="tabular absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-bench-critical px-1 text-center text-[10px] font-semibold leading-[16px] text-on-dark-strong">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span className={cn(active && 'font-medium')}>{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpenOn(null)} returnFocus={accountButton} />
    </div>
  );
}

/** The company lockup, then the product name in the site's label style. */
function Brand() {
  return (
    <Link href="/portal" className="flex h-14 items-center gap-3 border-b border-bench-line px-4 text-bench-ink" aria-label="Zare Bench, dashboard">
      <ZareLogo className="h-8 w-auto" />
      <span className="h-5 w-px bg-bench-line-bright" aria-hidden />
      <span className="brand-label text-[10.5px] text-accent-bright">Bench</span>
    </Link>
  );
}

/** What the server and the first client paint both render. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-bench-ground">
      <aside className="hidden w-56 shrink-0 border-r border-bench-line bg-bench-surface md:block">
        <div className="flex h-14 items-center gap-3 border-b border-bench-line px-4 text-bench-ink">
          <ZareLogo className="h-8 w-auto" />
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-14 items-center border-b border-bench-line bg-bench-surface/60 px-4 md:px-5">
          <ZareMark className="h-7 w-auto md:hidden" />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 h-16 border-t border-bench-line bg-bench-surface/95 pb-[env(safe-area-inset-bottom)] md:hidden" />
    </div>
  );
}

// ------------------------------------------------------------ fake login ----

/**
 * Fake login. A role picker, no credentials — this is a demo build with no
 * database and no auth behind it. Swapping in Supabase Auth replaces this
 * and the account sheet, and nothing else.
 */
function RolePicker() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Escape or a click anywhere else closes the menu; opening it moves focus
  // into it, and closing with Escape returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    wrapper.current?.querySelector<HTMLButtonElement>('[data-menu] button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative border-t border-bench-line p-2">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-bench-surface-2"
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bench-surface-3 text-[11px] font-semibold">
          {initials(user.full_name)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px]">{user.full_name}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-bench-ink-faint">{user.role.replace('_', ' ')}</div>
        </div>
        <ChevronDown size={13} className="shrink-0 text-bench-ink-faint" />
      </button>

      {open && (
        <div data-menu className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-md border border-bench-line bg-bench-surface-2 shadow-2xl">
          {DEMO_MODE && (
            <>
              <div className="border-b border-bench-line px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-bench-ink-faint">
                Demo — sign in as
              </div>
              <UserList compact onPicked={() => setOpen(false)} />
            </>
          )}
          <SignOutButton compact />
        </div>
      )}
    </div>
  );
}

function UserList({ compact, onPicked }: { compact?: boolean; onPicked: () => void }) {
  const users = useUsers();
  const me = useCurrentUser();
  return (
    <ul>
      {users.map((u: User) => (
        <li key={u.id}>
          <button
            type="button"
            onClick={() => {
              void signInAs(u.id);
              onPicked();
            }}
            aria-current={u.id === me.id ? 'true' : undefined}
            className={cn(
              'flex w-full items-center gap-3 text-left transition-colors',
              compact ? 'px-3 py-2 text-[12px] hover:bg-bench-surface-3' : 'min-h-[52px] px-4 py-2.5 text-[14px] active:bg-bench-surface-3',
              u.id === me.id && 'bg-bench-surface-3',
            )}
          >
            {!compact && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bench-surface-2 text-[11px] font-semibold">
                {initials(u.full_name)}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{u.full_name}</span>
            <span className={cn('shrink-0 font-mono uppercase tracking-wider text-bench-ink-faint', compact ? 'text-[10px]' : 'text-[10.5px]')}>
              {u.role.replace('_', ' ')}
            </span>
            {!compact && u.id === me.id && <Check size={15} className="shrink-0 text-accent" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The phone's account sheet: who you are, and the demo's sign-in-as list.
 * A real dialog — Escape and the backdrop close it, focus moves in and comes
 * back, and the page behind it does not scroll.
 */
function AccountSheet({
  open,
  onClose,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  /** Where focus goes on close. Taps do not focus buttons on iOS, so
   * "whatever was focused before" is usually just the page body. */
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const me = useCurrentUser();
  const panel = useRef<HTMLDivElement>(null);
  // Held in a ref: the parent passes a new function every render, and the
  // store re-renders the parent on every change. Depending on it directly
  // would re-run this effect and bounce focus while the sheet is open.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const trigger = returnFocus.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab' && panel.current) {
        // Keep focus inside the sheet.
        const items = panel.current.querySelectorAll<HTMLElement>('button, a[href]');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open, returnFocus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Close" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-surface-ink/70" tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        tabIndex={-1}
        className="sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-bench-line-bright bg-bench-surface pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-bench-line-bright" aria-hidden />
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-bench-surface-3 text-[13px] font-semibold">
            {initials(me.full_name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-medium">{me.full_name}</div>
            <div className="truncate text-[12px] text-bench-ink-faint">
              {ROLE_LABEL[me.role]} · {me.email}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full text-bench-ink-faint active:bg-bench-surface-2"
          >
            <X size={18} />
          </button>
        </div>
        {DEMO_MODE && (
          <>
            <div className="border-t border-bench-line px-4 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-wider text-bench-ink-faint">
              Demo — sign in as
            </div>
            <UserList onPicked={onClose} />
          </>
        )}
        <div className="mt-2 border-t border-bench-line pt-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function SignOutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
        router.replace('/portal/login');
      }}
      className={cn(
        'flex w-full items-center gap-2.5 text-left text-bench-ink-dim transition-colors',
        compact
          ? 'border-t border-bench-line px-3 py-2 text-[12px] hover:bg-bench-surface-3 hover:text-bench-ink'
          : 'min-h-[52px] px-4 py-2.5 text-[14px] active:bg-bench-surface-3',
      )}
    >
      <LogOut size={compact ? 13 : 16} /> Sign out
    </button>
  );
}

function ExecOnly() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-10">
      <div className="max-w-sm text-center">
        <Lock size={18} className="mx-auto text-bench-ink-faint" />
        <h1 className="mt-3 text-[15px] font-semibold">Exec only</h1>
        <p className="mt-1 text-[12.5px] text-bench-ink-dim">
          Staff and roles are managed by an exec. Ask one if you need access.
        </p>
        <Link
          href="/portal"
          className="mt-4 inline-flex h-8 items-center rounded-md border border-bench-line px-3 text-[12px] text-bench-ink-dim no-underline transition-colors hover:text-bench-ink"
        >
          Back to the bench
        </Link>
      </div>
    </div>
  );
}
