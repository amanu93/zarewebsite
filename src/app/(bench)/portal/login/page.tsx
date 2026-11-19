'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2 } from 'lucide-react';

import {
  DEMO_MODE,
  ROLE_LABEL,
  signInAs,
  signInWithPassword,
  STAFF_EMAIL_DOMAIN,
  useSession,
  useUsers,
} from '@/bench/data';
import { ZareLogo } from '@/components/layout/logo';
import { useMounted } from '@/bench/use-mounted';
import { cn } from '@/bench/utils';

/**
 * Staff sign-in, at zareinnovations.com/portal/login.
 *
 * Built to look like it belongs to the marketing site, because it does: same
 * logo, same type stack, the site's dark stage. Everything a signed-out
 * visitor can see is here, so it shows nothing about the bench itself.
 *
 * Links back to the marketing site use next/link: the site and the portal are
 * one app, so leaving the portal is an ordinary navigation, and client-side
 * navigation cannot cross that boundary.
 */



/**
 * Where to go after signing in. Only ever a path inside the portal:
 * "//evil.com", full URLs and site pages are refused, so the sign-in page
 * cannot be used as a redirector.
 */
function returnPath(search: string): string {
  const requested = new URLSearchParams(search).get('next');
  if (
    requested &&
    (requested === '/portal' || requested.startsWith('/portal/')) &&
    !requested.startsWith('/portal/login')
  ) {
    return requested;
  }
  return '/portal';
}

export default function SignInPage() {
  const router = useRouter();
  const { signedIn } = useSession();
  const mounted = useMounted();
  const next = mounted ? returnPath(window.location.search) : '/portal';

  useEffect(() => {
    if (mounted && signedIn) router.replace(next);
  }, [mounted, signedIn, next, router]);

  return (
    <div className="brand-stage flex min-h-screen flex-col text-bench-ink">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6 md:h-[72px] md:px-10">
        <Link href="/" className="text-on-dark-strong" aria-label="Zare Innovations home">
          <ZareLogo className="h-9 w-auto md:h-10" />
        </Link>
        <Link href="/"
          className="brand-label hidden items-center gap-1.5 text-[11px] text-bench-ink-dim transition-colors hover:text-accent-bright sm:inline-flex">
          zareinnovations.com <ArrowUpRight size={13} />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-12 px-6 py-10 md:px-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20">
        {/* ---- the statement: the site's voice, no bench data ---- */}
        <section className="hidden lg:block">
          <p className="brand-label inline-flex items-center gap-3 text-accent-bright">
            <span className="h-0.5 w-[26px] bg-accent" aria-hidden />
            Staff portal
          </p>
          <h1 className="mt-6 max-w-[520px] text-[52px] font-semibold leading-[1.08] tracking-[-0.02em] text-on-dark-strong">
            The bench, kept current.
          </h1>
          <p className="mt-6 max-w-[460px] text-[16.5px] leading-[1.65] text-bench-ink-dim">
            Every candidate assessed once, and their availability confirmed by phone. So when a client asks,
            the answer takes a day, not a hiring cycle.
          </p>
          <dl className="mt-12 grid max-w-[480px] grid-cols-3 gap-6 border-t border-rule-neutral pt-6">
            {[
              ['For', 'Zare staff'],
              ['Clients see', 'Ref codes only'],
              ['Based in', 'Addis Ababa'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="brand-label text-[10.5px] text-bench-ink-faint">{k}</dt>
                <dd className="mt-2 text-[14px] text-on-dark-strong">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- the form ---- */}
        <section className="mx-auto w-full max-w-[440px]">
          <SignInCard />
          {mounted && DEMO_MODE && <DemoAccess onSignedIn={() => router.replace(next)} />}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 pb-8 text-[12.5px] text-bench-ink-faint md:px-10">
        <span>© {new Date().getFullYear()} Zare Innovations</span>
        <span>
          Staff only. Working with us?{' '}
          <Link href="/contact" className="text-bench-ink-dim underline-offset-4 hover:text-accent-bright hover:underline">
            Contact your account manager
          </Link>
        </span>
      </footer>
    </div>
  );
}

function SignInCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetNote, setResetNote] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // A short, fixed pause. Real sign-in takes a round trip, and an instant
    // failure is also a hint to anyone guessing addresses.
    const [res] = await Promise.all([signInWithPassword(email, password), new Promise((r) => setTimeout(r, 450))]);
    setBusy(false);
    if (!res.ok) setError(res.error);
    // On success the page's signed-in effect navigates.
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-rule-neutral bg-surface-ink/85 p-7 shadow-[0_24px_48px_rgba(2,8,16,.45)] backdrop-blur md:p-8">
      <span
        className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-accent)_35%,var(--color-accent-depth)_70%,transparent)] opacity-60"
        aria-hidden
      />
      <p className="brand-label text-[11px] text-accent-bright lg:hidden">Staff portal</p>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-on-dark-strong lg:mt-0">Sign in</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-bench-ink-dim">Use your Zare Innovations email and password.</p>

      <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-bench-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name@${STAFF_EMAIL_DOMAIN}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'signin-error' : undefined}
            className={fieldCls}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-bench-ink">
              Password
            </label>
            <button
              type="button"
              onClick={() => setResetNote((v) => !v)}
              className="text-[13px] text-accent underline-offset-4 hover:text-accent-bright hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'signin-error' : undefined}
              className={cn(fieldCls, 'pr-12')}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-bench-ink-faint transition-colors hover:text-bench-ink"
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {resetNote && (
            <p className="fade-up mt-2 text-[13px] leading-relaxed text-bench-ink-dim">
              In the live portal this emails you a reset link. This demo has no real accounts, so there is
              nothing to reset. Use demo access below.
            </p>
          )}
        </div>

        {error && (
          <p id="signin-error" role="alert" className="rounded-md border border-bench-critical/30 bg-bench-critical/10 px-3 py-2.5 text-[13.5px] text-bench-critical">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 text-[15px] font-bold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-60"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : null}
          {busy ? 'Signing in' : 'Sign in'}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>
    </div>
  );
}

const fieldCls =
  'h-12 w-full rounded-md border border-rule-neutral bg-surface-deep/70 px-4 text-[15px] text-on-dark-strong placeholder:text-bench-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-bench-critical/60';

/**
 * Demo only. Partners need to look around without an account, so each
 * seeded staff member is one click away. This whole block is deleted when
 * real sign-in lands.
 */
function DemoAccess({ onSignedIn }: { onSignedIn: () => void }) {
  const users = useUsers();
  return (
    <div className="mt-6 rounded-xl border border-dashed border-rule-neutral bg-surface-ink/60 p-5 backdrop-blur">
      <p className="brand-label text-[10.5px] text-bench-ink-faint">Demo access</p>
      <p className="mt-2 text-[13px] leading-relaxed text-bench-ink-dim">
        No real accounts and no passwords are checked in this demo. Choose someone to sign in as, or type any
        staff email above with any password.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => {
                void signInAs(u.id);
                onSignedIn();
              }}
              className="flex h-full w-full items-center justify-between gap-3 rounded-md border border-rule-neutral bg-on-dark-strong/[0.03] px-3 py-2.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] text-on-dark-strong">{u.full_name}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-bench-ink-faint">
                  {ROLE_LABEL[u.role]}
                </span>
              </span>
              <ArrowRight size={14} className="shrink-0 text-bench-ink-faint" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
