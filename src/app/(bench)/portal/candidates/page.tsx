'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  FileSpreadsheet,
  LayoutGrid,
  ListPlus,
  Rows3,
  Search,
  SlidersHorizontal,
  UserPlus,
  X,
} from 'lucide-react';

import {
  addToShortlist,
  archiveCandidate,
  compareByOverall,
  isOneCallAway,
  normalizeTag,
  useBenchTags,
  createShortlist,
  useArchetypes,
  useCandidates,
  useRequestMatchCounts,
  useShortlistsForRequest,
  useUsers,
  type ArchiveReason,
  type CandidateView,
  type EnglishLevel,
  type Layer,
  type Seniority,
} from '@/bench/data';
import {
  ARCHIVE_LABEL,
  ArchetypeTag,
  Freshness,
  LAYER_ORDER,
  LayerBadge,
  Score,
  Tag,
} from '@/bench/components/candidate-bits';
import { cn, LAYER_STYLES } from '@/bench/utils';

/**
 * The candidate directory. Answers "who do we have?" — but always with the
 * layer next to the name, because "we have them" and "they are available"
 * are different claims and this product exists to keep them apart.
 *
 * Archived is off by default. It is history, not supply.
 */

type SortKey = 'layer' | 'name' | 'score' | 'freshness' | 'experience';
type View = 'table' | 'cards';

const SENIORITY: Seniority[] = ['junior', 'mid', 'senior', 'lead'];
const ENGLISH: EnglishLevel[] = ['C2', 'C1', 'B2', 'B1', 'below'];
const englishLabel = (e: EnglishLevel) => (e === 'below' ? 'Below B1' : e);
const VIEW_KEY = 'zare-bench-directory-view';

export default function CandidatesPage() {
  const archetypes = useArchetypes();
  const users = useUsers();

  const [search, setSearch] = useState('');
  const [archetypeId, setArchetypeId] = useState<string | undefined>();
  const [layers, setLayers] = useState<Layer[]>(['ready', 'known', 'raw']);
  const [seniority, setSeniority] = useState<Seniority[]>([]);
  const [english, setEnglish] = useState<EnglishLevel[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [minScore, setMinScore] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'layer', dir: 1 });
  // Table or cards is a per-viewer convenience, so it lives in localStorage.
  // Read on first render: this page only renders in the browser, behind the
  // shell's mount gate.
  const [view, setView] = useState<View>(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      return v === 'table' || v === 'cards' ? v : 'table';
    } catch {
      return 'table';
    }
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<React.ReactNode>(null);

  function chooseView(v: View) {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  // Every filter except layer goes to the data layer. Layer is applied here
  // so the layer chips can show what each one WOULD contain.
  const pool = useCandidates({
    archetypeId,
    search,
    seniority,
    englishLevel: english,
    stack,
    ownerId,
    minScore,
    includeArchived: true,
  });

  const layerCounts = useMemo(() => {
    const c: Record<Layer, number> = { ready: 0, known: 0, raw: 0, archived: 0 };
    for (const v of pool) c[v.layer] += 1;
    return c;
  }, [pool]);

  const stackOptions = useAllStack(archetypeId);
  const [now] = useState(() => new Date());

  const rows = useMemo(() => {
    const list = pool.filter((v) => layers.includes(v.layer));
    const cmp = (a: CandidateView, b: CandidateView): number => {
      switch (sort.key) {
        case 'name':
          return (a.full_name ?? '').localeCompare(b.full_name ?? '');
        case 'score':
          // Ascending is the reverse of best-first, so communication-only
          // overalls sort below a fully weighted score of the same value.
          return -compareByOverall(a, b);
        case 'experience':
          return (a.years_experience ?? -1) - (b.years_experience ?? -1);
        case 'freshness':
          return (a.days_until_expiry ?? -9999) - (b.days_until_expiry ?? -9999);
        case 'layer': {
          const l = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
          return l !== 0 ? l : compareByOverall(a, b);
        }
      }
    };
    return [...list].sort((a, b) => cmp(a, b) * sort.dir);
  }, [pool, layers, sort]);

  // Selection only ever counts rows on screen. A filter change that hides a
  // selected row leaves it out of every bulk action, so nothing unseen is
  // ever touched; it is simply not counted until it is visible again.
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const activeFilterCount =
    seniority.length + english.length + stack.length + (ownerId ? 1 : 0) + (minScore ? 1 : 0);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: key === 'name' || key === 'layer' ? 1 : -1 },
    );
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function clearFilters() {
    setSeniority([]);
    setEnglish([]);
    setStack([]);
    setOwnerId(undefined);
    setMinScore(undefined);
  }

  return (
    <div className="px-5 py-6 pb-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Candidates</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            {/* Everything on screen: search, role, filters and layer chips. */}
            <span className="tabular text-bench-ink">{rows.length}</span> shown ·{' '}
            <span className="tabular text-bench-healthy">{rows.filter((v) => v.layer === 'ready').length}</span> ready now ·{' '}
            <span className="tabular text-bench-warning">{rows.filter((v) => isOneCallAway(v, now)).length}</span> one call away
          </p>
        </div>

        <div className="flex items-center gap-2">
        <Link
          href="/portal/candidates/import"
          className="flex h-9 items-center gap-1.5 rounded-md border border-bench-line px-3 text-[12.5px] text-bench-ink-dim transition-colors hover:text-bench-ink"
        >
          <FileSpreadsheet size={14} /> Import
        </Link>
        <Link
          href="/portal/candidates/new"
          className="flex h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <UserPlus size={14} /> Add candidate
        </Link>
        <div className="flex items-center gap-1 rounded-md border border-bench-line bg-bench-surface p-1">
          <ViewButton active={view === 'table'} onClick={() => chooseView('table')} label="Table">
            <Rows3 size={14} />
          </ViewButton>
          <ViewButton active={view === 'cards'} onClick={() => chooseView('cards')} label="Cards">
            <LayoutGrid size={14} />
          </ViewButton>
        </div>
        </div>
      </div>

      {/* ---- search + primary filters ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bench-ink-faint"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ref code, skill or stack"
            aria-label="Search candidates"
            className="h-9 w-full rounded-md border border-bench-line bg-bench-surface pl-9 pr-8 text-[13px] placeholder:text-bench-ink-faint focus:border-accent/50 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-bench-ink-faint hover:text-bench-ink"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </label>

        <div role="group" aria-label="Role" className="flex flex-wrap items-center gap-1 rounded-md border border-bench-line bg-bench-surface p-1">
          <Chip active={!archetypeId} onClick={() => setArchetypeId(undefined)}>
            All
          </Chip>
          {archetypes.map((a) => (
            <Chip
              key={a.id}
              active={archetypeId === a.id}
              onClick={() => {
                setArchetypeId(a.id);
                setStack([]);
              }}
            >
              {a.code}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((f) => !f)}
          aria-expanded={showFilters}
          className={cn(
            'flex h-9 items-center gap-2 rounded-md border px-3 text-[12.5px] transition-colors',
            showFilters || activeFilterCount
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-bench-line bg-bench-surface text-bench-ink-dim hover:text-bench-ink',
          )}
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="tabular rounded bg-accent/20 px-1.5 text-[10.5px]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div role="group" aria-label="Layers" className="mb-4 flex flex-wrap items-center gap-1.5">
        {LAYER_ORDER.map((l) => {
          const on = layers.includes(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setLayers((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))
              }
              className={cn(
                'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                on
                  ? 'border-bench-line-bright bg-bench-surface-2 text-bench-ink'
                  : 'border-bench-line bg-transparent text-bench-ink-faint hover:text-bench-ink-dim',
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', on ? LAYER_STYLES[l].dot : 'bg-bench-line-bright')}
              />
              <span className={cn(l === 'archived' && on && 'line-through')}>
                {LAYER_STYLES[l].label}
              </span>
              <span className="tabular text-[11px] text-bench-ink-faint">{layerCounts[l]}</span>
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="fade-up mb-4 grid gap-4 rounded-lg border border-bench-line bg-bench-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterGroup label="Seniority">
            {SENIORITY.map((s) => (
              <Toggle
                key={s}
                on={seniority.includes(s)}
                onClick={() => setSeniority((cur) => toggleIn(cur, s))}
              >
                <span className="capitalize">{s}</span>
              </Toggle>
            ))}
          </FilterGroup>

          <FilterGroup label="English">
            {ENGLISH.map((e) => (
              <Toggle
                key={e}
                on={english.includes(e)}
                onClick={() => setEnglish((cur) => toggleIn(cur, e))}
              >
                {englishLabel(e)}
              </Toggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Minimum score">
            {[undefined, 3.5, 4.0, 4.5].map((m) => (
              <Toggle key={String(m)} on={minScore === m} onClick={() => setMinScore(m)}>
                {m === undefined ? 'Any' : `${m.toFixed(1)}+`}
              </Toggle>
            ))}
          </FilterGroup>

          <FilterGroup label="Owner">
            <select
              aria-label="Owner"
              value={ownerId ?? ''}
              onChange={(e) => setOwnerId(e.target.value || undefined)}
              className="h-8 w-full rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12.5px] focus:border-accent/50 focus:outline-none"
            >
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </FilterGroup>

          {stackOptions.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <FilterGroup label="Stack and tools: must have all selected">
                {stackOptions.map((t) => (
                  <Toggle
                    key={t}
                    on={stack.includes(t)}
                    onClick={() => setStack((cur) => toggleIn(cur, t))}
                  >
                    {t}
                  </Toggle>
                ))}
              </FilterGroup>
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="button"
                onClick={clearFilters}
                className="text-[12px] text-accent hover:text-accent-bright"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          hasQuery={Boolean(search) || activeFilterCount > 0 || layers.length < 3}
          onReset={() => {
            setSearch('');
            clearFilters();
            setLayers(['ready', 'known', 'raw']);
          }}
        />
      ) : view === 'table' ? (
        <CandidateTable
          rows={rows}
          users={users}
          selected={selected}
          allSelected={allSelected}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          sort={sort}
          onSort={toggleSort}
        />
      ) : (
        <CandidateCards rows={rows} selected={selected} onToggle={toggleOne} />
      )}

      {selectedRows.length > 0 ? (
        <BulkBar
          rows={selectedRows}
          onDone={(msg) => {
            setSelected(new Set());
            setNotice(msg);
          }}
          onClear={() => setSelected(new Set())}
        />
      ) : (
        notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ table --

function CandidateTable({
  rows,
  users,
  selected,
  allSelected,
  onToggle,
  onToggleAll,
  sort,
  onSort,
}: {
  rows: CandidateView[];
  users: { id: string; full_name: string }[];
  selected: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const router = useRouter();
  const ownerName = new Map(users.map((u) => [u.id, u.full_name.split(' ')[0]]));

  return (
    <div className="overflow-x-auto rounded-lg border border-bench-line bg-bench-surface">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <caption className="sr-only">Candidates, {rows.length} shown</caption>
        <thead>
          <tr className="border-b border-bench-line font-mono text-[10px] uppercase tracking-widest text-bench-ink-faint">
            <th className="w-10 py-2.5 pl-4">
              <Checkbox checked={allSelected} onChange={onToggleAll} label="Select all" />
            </th>
            <SortHead k="name" sort={sort} onSort={onSort}>Candidate</SortHead>
            <SortHead k="layer" sort={sort} onSort={onSort}>Layer</SortHead>
            <SortHead k="freshness" sort={sort} onSort={onSort}>Availability</SortHead>
            <SortHead k="score" sort={sort} onSort={onSort}>Score</SortHead>
            <SortHead k="experience" sort={sort} onSort={onSort}>Experience</SortHead>
            <th className="px-3 py-2.5 font-normal">English</th>
            <th className="px-3 py-2.5 font-normal">Skills</th>
            <th className="px-3 py-2.5 pr-4 font-normal">Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const isSel = selected.has(v.id);
            const tags = v.stack.length ? v.stack : v.skills;
            return (
              <tr
                key={v.id}
                onClick={() => router.push(`/portal/candidates/${v.id}`)}
                className={cn(
                  'cursor-pointer border-b border-bench-line transition-colors last:border-b-0',
                  isSel ? 'bg-accent/[0.06]' : 'hover:bg-bench-surface-2',
                  v.layer === 'archived' && 'opacity-60',
                )}
              >
                <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSel}
                    onChange={() => onToggle(v.id)}
                    label={`Select ${v.full_name ?? v.ref_code}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/portal/candidates/${v.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'block truncate text-[13.5px] font-medium hover:text-accent',
                      v.layer === 'archived' && 'line-through decoration-bench-ink-faint',
                    )}
                  >
                    {v.full_name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="tabular text-[11px] text-bench-ink-faint">{v.ref_code}</span>
                    <ArchetypeTag v={v} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <LayerBadge layer={v.layer} />
                </td>
                <td className="px-3 py-2.5">
                  <Freshness v={v} />
                </td>
                <td className="px-3 py-2.5">
                  <Score value={v.overall_score} basis={v.overall_basis} />
                </td>
                <td className="px-3 py-2.5 text-[12px] text-bench-ink-dim">
                  {v.years_experience !== null ? (
                    <>
                      <span className="tabular">{v.years_experience}y</span>
                      {v.seniority && (
                        <span className="ml-1.5 capitalize text-bench-ink-faint">{v.seniority}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-bench-ink-faint">—</span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-[12px] text-bench-ink-dim">
                  {v.english_level ? englishLabel(v.english_level) : <span className="text-bench-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex max-w-[240px] flex-wrap gap-1">
                    {tags.slice(0, 3).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    {tags.length > 3 && (
                      <span className="text-[10.5px] text-bench-ink-faint">+{tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 pr-4 text-[12px] text-bench-ink-faint">
                  {v.owner_id ? ownerName.get(v.owner_id) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHead({
  k,
  sort,
  onSort,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <th className="px-3 py-2.5 font-normal" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-widest transition-colors',
          active ? 'text-bench-ink' : 'hover:text-bench-ink-dim',
        )}
      >
        {children}
        {active && (sort.dir === 1 ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
  );
}

// ------------------------------------------------------------------ cards --

function CandidateCards({
  rows,
  selected,
  onToggle,
}: {
  rows: CandidateView[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((v) => {
        const isSel = selected.has(v.id);
        const tags = v.stack.length ? v.stack : v.skills;
        return (
          <div
            key={v.id}
            className={cn(
              'relative overflow-hidden rounded-lg border bg-bench-surface transition-colors',
              isSel ? 'border-accent/50 bg-accent/[0.05]' : 'border-bench-line hover:border-bench-line-bright',
              v.layer === 'archived' && 'opacity-60',
            )}
          >
            <div
              className={cn('absolute inset-y-0 left-0 w-0.5', LAYER_STYLES[v.layer].dot)}
              aria-hidden
            />
            <Link href={`/portal/candidates/${v.id}`} className="block p-4 pl-5">
              <div className="flex items-start justify-between gap-3 pr-7">
                <div className="min-w-0">
                  <div
                    className={cn(
                      'truncate text-[14px] font-medium',
                      v.layer === 'archived' && 'line-through decoration-bench-ink-faint',
                    )}
                  >
                    {v.full_name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="tabular text-[11px] text-bench-ink-faint">{v.ref_code}</span>
                    <ArchetypeTag v={v} />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <LayerBadge layer={v.layer} />
                <Score value={v.overall_score} basis={v.overall_basis} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
                <Freshness v={v} />
                <span className="text-bench-ink-faint">
                  {v.years_experience !== null && `${v.years_experience}y`}
                  {v.english_level && ` · ${v.english_level}`}
                </span>
              </div>

              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.slice(0, 4).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
            </Link>
            <div className="absolute right-3 top-3">
              <Checkbox
                checked={isSel}
                onChange={() => onToggle(v.id)}
                label={`Select ${v.full_name ?? v.ref_code}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------- bulk bar --

/**
 * Bulk actions. Two, because those are the two things a recruiter does to a
 * group: put them in front of a client, or take them off the bench.
 *
 * Shortlisting goes through addToShortlist(), which enforces Ready-only in
 * the data layer, so anyone not exportable is reported back rather than
 * silently added. do_not_contact is deliberately NOT a bulk reason: it
 * erases a person's details and should always be a decision about one person.
 */
function BulkBar({
  rows,
  onDone,
  onClear,
}: {
  rows: CandidateView[];
  onDone: (msg: React.ReactNode) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'shortlist' | 'archive'>('idle');
  const requests = useRequestMatchCounts();

  const readyCount = rows.filter((r) => r.layer === 'ready').length;

  async function archive(reason: ArchiveReason) {
    const n = rows.length;
    for (const r of rows) await archiveCandidate(r.id, reason);
    onDone(`${n} archived · ${ARCHIVE_LABEL[reason]}`);
  }

  return (
    <div data-bench-bar className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-4 md:pl-56">
      <div className="fade-up flex w-full max-w-3xl flex-col gap-2 rounded-lg border border-bench-line-bright bg-bench-surface-2/95 p-2 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-2">
            <span className="tabular text-[13px] font-semibold">{rows.length}</span>
            <span className="text-[12px] text-bench-ink-faint">
              selected · <span className="text-bench-healthy">{readyCount} ready</span>
            </span>
          </div>
          <div className="flex-1" />

          {mode === 'idle' && (
            <>
              <BarButton onClick={() => setMode('shortlist')}>
                <ListPlus size={13} /> Add to shortlist
              </BarButton>
              <BarButton onClick={() => setMode('archive')} danger>
                <Archive size={13} /> Archive
              </BarButton>
            </>
          )}
          <button
            type="button"
            onClick={onClear}
            className="grid h-8 w-8 place-items-center rounded-md text-bench-ink-faint hover:bg-bench-surface-3 hover:text-bench-ink"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>

        {mode === 'archive' && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-bench-line px-2 pt-2">
            <span className="mr-1 text-[11.5px] text-bench-ink-faint">Archive {rows.length} as:</span>
            {(['took_other_job', 'not_interested', 'left_country'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void archive(r)}
                className="rounded border border-bench-line bg-bench-surface px-2 py-1.5 text-[11.5px] text-bench-ink-dim transition-colors hover:border-bench-critical/40 hover:text-bench-critical"
              >
                {ARCHIVE_LABEL[r]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="px-2 py-1.5 text-[11.5px] text-bench-ink-faint hover:text-bench-ink"
            >
              Cancel
            </button>
            <span className="basis-full pt-1 text-[11px] text-bench-ink-faint">
              Do not contact is set one person at a time, from their record.
            </span>
          </div>
        )}

        {mode === 'shortlist' && (
          <div className="border-t border-bench-line px-2 pt-2">
            <div className="mb-1.5 text-[11.5px] text-bench-ink-faint">Add to the shortlist for:</div>
            {requests.length === 0 ? (
              <div className="py-2 text-[12px] text-bench-ink-dim">No open requests.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {requests.map((r) => (
                  <ShortlistTarget
                    key={r.id}
                    request={r}
                    rows={rows}
                    onDone={onDone}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="mt-1 px-0 py-1.5 text-[11.5px] text-bench-ink-faint hover:text-bench-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShortlistTarget({
  request,
  rows,
  onDone,
}: {
  request: { id: string; client_name: string; archetype_id: string; archetype_code: string; quantity: number };
  rows: CandidateView[];
  onDone: (msg: React.ReactNode) => void;
}) {
  const shortlists = useShortlistsForRequest(request.id);
  const draft = shortlists.find((s) => s.status === 'draft');
  const eligible = rows.filter((r) => r.archetype_id === request.archetype_id);
  const wrongArchetype = rows.length - eligible.length;

  async function add() {
    const shortlistId = draft?.id ?? (await createShortlist(request.id, `${request.client_name} shortlist`));
    let added = 0;
    const blocked: string[] = [];
    for (const r of eligible) {
      const res = await addToShortlist(shortlistId, r.id);
      if (res.ok) added += 1;
      else blocked.push(r.full_name ?? r.ref_code);
    }
    onDone(
      <span>
        <span className="text-bench-healthy">{added} added</span> to {request.client_name}
        {blocked.length > 0 && (
          <>
            {' · '}
            <span className="text-bench-warning">
              {blocked.length} {blocked.length === 1 ? 'needs' : 'need'} availability verified
              first
            </span>
          </>
        )}
        {wrongArchetype > 0 && <> · {wrongArchetype} skipped, wrong archetype</>}
        {' · '}
        <Link href={`/portal/requests/${request.id}/shortlist`} className="text-accent hover:text-accent-bright">
          Open shortlist
        </Link>
      </span>,
    );
  }

  return (
    <button
      type="button"
      disabled={eligible.length === 0}
      onClick={() => void add()}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors enabled:hover:bg-bench-surface-3 disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block truncate text-[12.5px]">{request.client_name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-bench-ink-faint">
          {request.archetype_code} · {request.quantity} needed
          {draft ? ' · draft in progress' : ''}
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-bench-ink-faint">
        {eligible.length === 0 ? 'No matching archetype' : `${eligible.length} eligible`}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- helpers --

/** Every stack tag present in the bench, for the stack filter. */
/** Stack and tools present on the bench for the selected role, one per tag. */
function useAllStack(archetypeId?: string): string[] {
  const tags = useBenchTags(archetypeId);
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of [...tags.stack, ...tags.skills]) if (!seen.has(normalizeTag(t))) seen.set(normalizeTag(t), t);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [tags]);
}

function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        // 16px box, 32px target: the pseudo-element takes the clicks around it.
        "relative grid h-4 w-4 place-items-center rounded border transition-colors before:absolute before:-inset-2 before:content-['']",
        checked
          ? 'border-accent bg-accent text-accent-contrast'
          : 'border-bench-line-bright bg-bench-surface-2 hover:border-bench-ink-faint',
      )}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
        active ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-faint hover:text-bench-ink-dim',
      )}
    >
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'grid h-7 w-8 place-items-center rounded transition-colors',
        active ? 'bg-bench-surface-3 text-bench-ink' : 'text-bench-ink-faint hover:text-bench-ink-dim',
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} className="mb-2 font-mono text-[10px] uppercase tracking-widest text-bench-ink-faint">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
        on
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-bench-line bg-bench-surface-2 text-bench-ink-dim hover:text-bench-ink',
      )}
    >
      {children}
    </button>
  );
}

function BarButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
        danger
          ? 'border-bench-line bg-bench-surface text-bench-ink-dim hover:border-bench-critical/40 hover:text-bench-critical'
          : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
      )}
    >
      {children}
    </button>
  );
}

function Notice({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div data-bench-bar className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-4 md:pl-56">
      <div
        role="status"
        className="fade-up flex max-w-3xl items-center gap-3 rounded-lg border border-bench-line-bright bg-bench-surface-2/95 py-2 pl-4 pr-2 text-[12.5px] text-bench-ink-dim shadow-2xl backdrop-blur"
      >
        <div className="min-w-0">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-bench-ink-faint hover:bg-bench-surface-3 hover:text-bench-ink"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasQuery, onReset }: { hasQuery: boolean; onReset: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-16 text-center">
      <div className="text-[14px] font-medium">No candidates match</div>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-bench-ink-dim">
        {hasQuery
          ? 'Nothing on the bench fits these filters.'
          : 'The bench is empty.'}
      </p>
      {hasQuery && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 text-[12.5px] text-accent hover:text-accent-bright"
        >
          Reset search and filters
        </button>
      )}
    </div>
  );
}
