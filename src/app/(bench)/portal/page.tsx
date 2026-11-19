'use client';

import Link from 'next/link';
import { ArrowRight, TrendingDown } from 'lucide-react';

import {
  useActivity,
  useBenchContribution,
  useBenchHealth,
  useCallQueue,
  useRequestMatchCounts,
  type BenchHealth,
} from '@/bench/data';
import { cn, daysUntil, timeAgo } from '@/bench/utils';

/**
 * Mission control. Dense and glanceable — a recruiter should be able to read
 * the state of the business in about four seconds without scrolling.
 *
 * The bench contribution rate is the largest number on the page on purpose.
 * It is the real scoreboard: placements sourced from the standing bench
 * rather than from scratch. Pool size is deliberately never shown as an
 * achievement anywhere in this product.
 */
export default function DashboardPage() {
  const health = useBenchHealth();
  const queue = useCallQueue();
  const activity = useActivity(12);
  const requests = useRequestMatchCounts();

  const expiringThisWeek = health.reduce((n, h) => n + h.expiring_this_week, 0);

  // Placements this quarter that came off the bench rather than fresh
  // sourcing, from the outcomes recorded when requests close.
  const contribution = useBenchContribution();
  const dueNow = queue.filter((i) => !i.retry_at).length;

  return (
    <div className="px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Bench</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            Availability is perishable. This is how much of it is still good.
          </p>
        </div>
      </div>

      {/* Explicit minmax(0, 1fr) columns: an implicit grid column sizes to
          its widest unbreakable content, so a long role name that is meant
          to truncate would push the cards off a phone screen instead. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {health.map((h) => (
              <HealthCard key={h.archetype_id} health={h} />
            ))}
          </div>

          {expiringThisWeek > 0 && (
            <Link
              href="/portal/queue"
              className="group flex items-center gap-3 rounded-lg border border-bench-warning/25 bg-bench-warning/[0.06] px-4 py-3 transition-colors hover:bg-bench-warning/10"
            >
              <TrendingDown size={16} className="shrink-0 text-bench-warning" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px]">
                  <span className="tabular font-semibold text-bench-warning">
                    {expiringThisWeek}
                  </span>{' '}
                  {expiringThisWeek === 1 ? 'candidate leaves' : 'candidates leave'} Ready
                  this week
                </div>
                <div className="mt-0.5 text-[11.5px] text-bench-ink-faint">
                  One call each keeps them on the bench.
                </div>
              </div>
              <ArrowRight
                size={14}
                className="shrink-0 text-bench-warning transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          )}

          <section className="rounded-lg border border-bench-line bg-bench-surface">
            <SectionHead title="Open requests" href="/portal/requests" />
            {requests.length === 0 ? (
              <Empty>No open requests.</Empty>
            ) : (
              <ul>
                {requests.map((r, i) => {
                  const left = daysUntil(r.required_by);
                  const short = r.matches < r.quantity;
                  return (
                    <li key={r.id} className={cn(i > 0 && 'border-t border-bench-line')}>
                      <Link
                        href={`/portal/requests/${r.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-bench-surface-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium">
                            {r.client_name}
                          </div>
                          <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-bench-ink-faint">
                            {r.archetype_code} · {r.quantity} needed
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={cn(
                              'tabular text-[14px] font-semibold',
                              short ? 'text-bench-warning' : 'text-bench-healthy',
                            )}
                          >
                            {r.matches}
                          </div>
                          <div className="text-[10.5px] text-bench-ink-faint">ready match</div>
                        </div>
                        {left !== null && (
                          <div className="w-20 text-right">
                            <div
                              className={cn(
                                'tabular text-[13px]',
                                left <= 7 ? 'text-bench-critical' : 'text-bench-ink-dim',
                              )}
                            >
                              {Math.abs(left)}d
                            </div>
                            <div className="text-[10.5px] text-bench-ink-faint">
                              {left < 0 ? 'overdue' : left === 0 ? 'due today' : 'remaining'}
                            </div>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-lg border border-accent/20 bg-gradient-to-b from-accent/[0.08] to-transparent px-5 py-5">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-accent">
              Bench contribution · {contribution.quarter}
            </div>
            {contribution.rate === null ? (
              <>
                <div className="mt-2 text-[20px] font-semibold text-bench-ink">No placements yet</div>
                <p className="mt-2 text-[12px] leading-relaxed text-bench-ink-dim">
                  Close a request with its outcome to record who was placed and where they came from.
                </p>
              </>
            ) : (
              <>
                <div className="tabular mt-2 text-[44px] font-semibold leading-none text-bench-ink">
                  {contribution.rate}
                  <span className="text-[24px] text-accent">%</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-bench-ink-dim">
                  of placements this quarter came from the standing bench:{' '}
                  <span className="tabular text-bench-ink">{contribution.from_bench}</span> from the bench,{' '}
                  <span className="tabular text-bench-ink">{contribution.from_outside}</span> sourced outside it.
                </p>
              </>
            )}
          </section>

          <section className="rounded-lg border border-bench-line bg-bench-surface">
            <SectionHead title="Call queue" href="/portal/queue" />
            <div className="px-4 py-4">
              <div className="tabular text-[28px] font-semibold leading-none">
                {dueNow}
              </div>
              <div className="mt-1 text-[12px] text-bench-ink-faint">
                waiting for a verification call
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-bench-line bg-bench-surface">
            <SectionHead title="Activity" />
            {activity.length === 0 ? (
              <Empty>Nothing logged yet.</Empty>
            ) : (
              <ul className="max-h-[420px] overflow-y-auto">
                {activity.map((a, i) => (
                  <li
                    key={a.id}
                    className={cn(
                      'flex items-start gap-2.5 px-4 py-2.5',
                      i > 0 && 'border-t border-bench-line',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                        a.outcome === 'available' && 'bg-bench-healthy',
                        a.outcome === 'not_available' && 'bg-bench-warning',
                        a.outcome === 'no_answer' && 'bg-bench-ink-faint',
                        a.outcome === 'archived' && 'bg-bench-critical',
                      )}
                    />
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="truncate text-[12.5px]">
                        {a.full_name ?? a.ref_code}{' '}
                        <span className="text-bench-ink-faint">
                          {a.outcome === 'available' && 'confirmed available'}
                          {a.outcome === 'not_available' && 'not available'}
                          {a.outcome === 'no_answer' && 'did not answer'}
                          {a.outcome === 'archived' && 'archived'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-bench-ink-faint">
                        {a.actor_name} · {timeAgo(a.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ health: h }: { health: BenchHealth }) {
  const pct = Math.min(h.coverage, 1);
  const tone =
    h.status === 'green'
      ? 'var(--color-bench-healthy)'
      : h.status === 'amber'
        ? 'var(--color-bench-warning)'
        : 'var(--color-bench-critical)';

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="rounded-lg border border-bench-line bg-bench-surface p-5">
      <div className="flex items-start gap-5">
        <div className="relative shrink-0">
          <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90" role="img" aria-label={`${h.ready_count} of ${h.target_ready} Ready: ${h.status === 'green' ? 'covered' : `${h.target_ready - h.ready_count} short of target`}`}>
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke="var(--color-bench-line)"
              strokeWidth="8"
            />
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke={tone}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              className="ring-draw"
              style={{ ['--ring-circumference' as string]: `${C}` }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <div className="tabular text-[26px] font-semibold" style={{ color: tone }}>
                {h.ready_count}
              </div>
              <div className="mt-1 font-mono text-[10px] text-bench-ink-faint">
                / {h.target_ready}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-bench-ink-faint">Ready</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: h.color }}
            />
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
              {h.code}
            </span>
          </div>
          <div className="mt-1 truncate text-[14px] font-medium">{h.name}</div>

          <div className="mt-3 flex gap-4">
            <Stat label="Known" value={h.known_count} />
            <Stat label="Raw" value={h.raw_count} />
            <Stat label="One call away" value={h.one_call_away} accent />
          </div>

          <div className="mt-3 text-[11.5px] text-bench-ink-faint">
            {h.status === 'green' && 'Covered.'}
            {h.status === 'amber' && `${h.target_ready - h.ready_count} short of target.`}
            {h.status === 'red' && `Critically short — ${h.target_ready - h.ready_count} below target.`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          'tabular text-[16px] font-semibold',
          accent ? 'text-accent' : 'text-bench-ink-dim',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] text-bench-ink-faint">{label}</div>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-bench-line px-4 py-2.5">
      <span className="font-mono text-[10.5px] uppercase tracking-widest text-bench-ink-faint">
        {title}
      </span>
      {href && (
        <Link href={href} className="text-[11px] text-accent hover:text-accent-bright">
          View
        </Link>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-[12.5px] text-bench-ink-faint">{children}</div>;
}
