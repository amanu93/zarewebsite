'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, FileSpreadsheet, X } from 'lucide-react';

import { createCandidate, useActiveArchetypes, useCandidates, useCurrentUser, useUsers } from '@/bench/data';
import { whenSynced } from '@/bench/data/api';
import { FormField, inputCls, Section } from '@/bench/components/form-bits';
import { plural } from '@/bench/dates';
import {
  buildImportRows,
  guessColumns,
  IMPORT_FIELDS,
  mappingProblem,
  type ColumnMap,
  type ImportRow,
} from '@/bench/import/columns';
import { readSpreadsheet, type Sheet } from '@/bench/import/spreadsheet';
import { cn } from '@/bench/utils';

/**
 * Import a list of candidates from a CSV or Excel file.
 *
 * Everyone lands as Raw, exactly as if added by hand: the same contact
 * checks, and a phone number already on the bench, or twice in the file,
 * is skipped with the reason. Nothing is written until the recruiter has
 * matched the columns and seen which rows will be skipped.
 */

const MAX_ROWS = 2000;
const TEMPLATE = `data:text/csv;charset=utf-8,${encodeURIComponent('Full name,Phone,Email,Location,LinkedIn,Notes\n')}`;

interface Result {
  imported: number;
  skipped: { line: number; name: string; reason: string }[];
}

export default function ImportCandidatesPage() {
  const uid = useId();
  const roles = useActiveArchetypes();
  const users = useUsers();
  const me = useCurrentUser();
  // Archived records too: their numbers are still on the bench.
  const bench = useCandidates({ includeArchived: true });

  const [file, setFile] = useState<{ name: string; sheet: Sheet } | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [archetypeId, setArchetypeId] = useState(roles[0]?.id ?? '');
  const [ownerId, setOwnerId] = useState(me.id);
  const [showAll, setShowAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const problem = map ? mappingProblem(map) : null;
  const rows = useMemo(
    () => (file && map && !mappingProblem(map) ? buildImportRows(file.sheet, map, bench) : []),
    [file, map, bench],
  );
  const ready = rows.filter((r) => !r.problem);
  const skipped = rows.length - ready.length;
  const flagged = rows.filter((r) => r.problem || r.warning);
  const shown = showAll ? rows : flagged;

  async function choose(f: File | undefined) {
    if (!f) return;
    setReading(true);
    setReadError(null);
    setResult(null);
    try {
      const sheet = await readSpreadsheet(f);
      if (sheet.rows.length > MAX_ROWS) {
        throw new Error(`This file has ${sheet.rows.length} rows. Import up to ${MAX_ROWS} at a time.`);
      }
      setFile({ name: f.name, sheet });
      setMap(guessColumns(sheet.headers));
      setShowAll(false);
    } catch (err) {
      setFile(null);
      setMap(null);
      setReadError(err instanceof Error ? err.message : 'Could not read this file.');
    } finally {
      setReading(false);
    }
  }

  async function runImport() {
    if (!file || !archetypeId || ready.length === 0) return;
    // Taken now: each write changes the bench, and with it the checks above.
    const toImport = ready;
    const out: Result = {
      imported: 0,
      skipped: rows.filter((r) => r.problem).map((r) => ({ line: r.line, name: r.contact.full_name, reason: r.problem! })),
    };
    setProgress({ done: 0, total: toImport.length });
    for (const [i, r] of toImport.entries()) {
      try {
        const res = await createCandidate({
          ...r.contact,
          archetype_id: archetypeId,
          owner_id: ownerId,
          notes: r.notes || `Imported from ${file.name}.`,
        });
        if (res.ok) out.imported++;
        else {
          const reason = Object.values(res.errors).filter(Boolean).join(' ');
          out.skipped.push({ line: r.line, name: r.contact.full_name, reason });
        }
      } catch (err) {
        console.error(err);
        out.skipped.push({ line: r.line, name: r.contact.full_name, reason: 'Could not be saved.' });
      }
      setProgress({ done: i + 1, total: toImport.length });
    }
    await whenSynced();
    out.skipped.sort((a, b) => a.line - b.line);
    setResult(out);
    setFile(null);
    setMap(null);
    setProgress(null);
  }

  return (
    <div className="px-5 py-6 pb-24">
      <Link href="/portal/candidates" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-bench-ink-faint hover:text-bench-ink">
        <ArrowLeft size={12} /> Candidates
      </Link>
      <h1 className="text-[19px] font-semibold tracking-tight">Import candidates</h1>
      <p className="mb-5 mt-1 text-[13px] text-bench-ink-dim">
        Upload a CSV or Excel file. Everyone is added as Raw, ready to be assessed.
      </p>

      <div className="grid max-w-3xl gap-4">
        {result && <ResultPanel result={result} onAgain={() => setResult(null)} />}

        {!result && (
          <Section title="File" description="The first row holds the column names. One person per row.">
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={`${uid}-file`}
                className={cn(
                  'flex h-9 cursor-pointer items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/20',
                  (reading || progress) && 'pointer-events-none opacity-50',
                )}
              >
                <FileSpreadsheet size={14} /> {file ? 'Choose another file' : 'Choose a file'}
              </label>
              <input
                id={`${uid}-file`}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {reading ? (
                <span className="text-[12.5px] text-bench-ink-dim">Reading…</span>
              ) : file ? (
                <span className="min-w-0 truncate text-[12.5px] text-bench-ink-dim">
                  {file.name} · {plural(file.sheet.rows.length, 'row')}
                </span>
              ) : (
                <a href={TEMPLATE} download="candidates-template.csv" className="text-[12.5px] text-bench-ink-faint hover:text-accent">
                  Download a template
                </a>
              )}
            </div>
            {readError && (
              <p role="alert" className="mt-3 text-[12.5px] text-bench-critical">
                {readError}
              </p>
            )}
          </Section>
        )}

        {file && map && (
          <Section title="Columns" description="Matched from the column names. Change any that are wrong.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Role" htmlFor={`${uid}-role`} hint="Everyone in this file joins it" error={archetypeId ? null : 'Choose a role.'}>
                <select id={`${uid}-role`} value={archetypeId} onChange={(e) => setArchetypeId(e.target.value)} className={inputCls}>
                  <option value="" disabled>
                    Choose a role
                  </option>
                  {roles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Owner" htmlFor={`${uid}-owner`} hint="Keeps their availability current">
                <select id={`${uid}-owner`} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </FormField>

              {IMPORT_FIELDS.map((f) => (
                <ColumnSelect
                  key={f.key}
                  id={`${uid}-${f.key}`}
                  field={f}
                  headers={file.sheet.headers}
                  sample={file.sheet.rows[0]?.cells}
                  value={map[f.key]}
                  onChange={(i) => setMap({ ...map, [f.key]: i })}
                />
              ))}
            </div>
            {problem && (
              <p role="alert" className="mt-4 text-[12.5px] text-bench-critical">
                {problem}
              </p>
            )}
          </Section>
        )}

        {file && map && !problem && (
          <Section title="Check" description="Rows that would be skipped, and possible duplicates worth a look.">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
              <span className="text-bench-healthy">
                <span className="tabular">{ready.length}</span> ready
              </span>
              <span className={skipped ? 'text-bench-critical' : 'text-bench-ink-faint'}>
                <span className="tabular">{skipped}</span> skipped
              </span>
              <span className={ready.some((r) => r.warning) ? 'text-bench-warning' : 'text-bench-ink-faint'}>
                <span className="tabular">{ready.filter((r) => r.warning).length}</span> to check
              </span>
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="ml-auto text-[12px] text-bench-ink-faint hover:text-bench-ink"
              >
                {showAll ? 'Show only flagged rows' : `Show all ${rows.length} rows`}
              </button>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-md border border-dashed border-bench-line px-4 py-6 text-center text-[12.5px] text-bench-ink-dim">
                Every row is ready to import.
              </p>
            ) : (
              <ul className="max-h-[420px] overflow-y-auto rounded-md border border-bench-line">
                {shown.map((r, i) => (
                  <RowLine key={r.line} r={r} first={i === 0} />
                ))}
              </ul>
            )}
          </Section>
        )}

        {file && map && !problem && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {progress && (
              <span className="mr-auto text-[12.5px] text-bench-ink-dim" role="status">
                Importing {progress.done} of {progress.total}…
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setMap(null);
              }}
              disabled={progress !== null}
              className="px-3 py-2 text-[12.5px] text-bench-ink-faint hover:text-bench-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={progress !== null || ready.length === 0 || !archetypeId}
              className="h-9 rounded-md bg-accent px-4 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:opacity-50"
            >
              Import {plural(ready.length, 'candidate')} as Raw
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnSelect({
  id,
  field,
  headers,
  sample,
  value,
  onChange,
}: {
  id: string;
  field: (typeof IMPORT_FIELDS)[number];
  headers: string[];
  sample: string[] | undefined;
  value: number | null;
  onChange: (i: number | null) => void;
}) {
  const example = value === null ? null : sample?.[value]?.trim();
  return (
    <FormField
      label={field.label}
      htmlFor={id}
      hint={example ? <span className="truncate">e.g. {example}</span> : field.hint}
    >
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(inputCls, value === null && 'text-bench-ink-faint')}
      >
        <option value="">Not in this file</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function RowLine({ r, first }: { r: ImportRow; first: boolean }) {
  return (
    <li className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[12px]', !first && 'border-t border-bench-line')}>
      <span className="tabular w-12 shrink-0 text-bench-ink-faint">Row {r.line}</span>
      <span className="min-w-0 flex-1 basis-40 truncate text-bench-ink">{r.contact.full_name || '—'}</span>
      <span className="tabular shrink-0 text-bench-ink-dim">{r.contact.phone || '—'}</span>
      <span
        className={cn(
          'flex basis-full items-center gap-1.5 sm:basis-auto',
          r.problem ? 'text-bench-critical' : r.warning ? 'text-bench-warning' : 'text-bench-healthy',
        )}
      >
        {r.problem ? <X size={12} /> : r.warning ? <AlertTriangle size={12} /> : <Check size={12} />}
        {r.problem ?? r.warning ?? 'Ready'}
      </span>
    </li>
  );
}

function ResultPanel({ result, onAgain }: { result: Result; onAgain: () => void }) {
  return (
    <section role="status" className="rounded-lg border border-bench-line bg-bench-surface p-4">
      <div className="flex items-center gap-2 text-[14px] font-medium">
        <Check size={16} className="text-bench-healthy" strokeWidth={2.5} />
        Imported {plural(result.imported, 'candidate')} as Raw.
      </div>
      {result.skipped.length > 0 && (
        <>
          <p className="mt-3 text-[12.5px] text-bench-ink-dim">
            {plural(result.skipped.length, 'row was', 'rows were')} skipped. Fix them in the file and import it again; the
            people already added will be skipped as duplicates.
          </p>
          <ul className="mt-2 max-h-[320px] overflow-y-auto rounded-md border border-bench-line">
            {result.skipped.map((s, i) => (
              <li key={s.line} className={cn('flex flex-wrap gap-x-3 px-3 py-2 text-[12px]', i > 0 && 'border-t border-bench-line')}>
                <span className="tabular w-12 shrink-0 text-bench-ink-faint">Row {s.line}</span>
                <span className="min-w-0 flex-1 truncate">{s.name || '—'}</span>
                <span className="basis-full text-bench-critical sm:basis-auto">{s.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/portal/candidates"
          className="flex h-9 items-center rounded-md bg-accent px-4 text-[12.5px] font-semibold text-accent-contrast hover:bg-accent-bright"
        >
          Go to candidates
        </Link>
        <button
          type="button"
          onClick={onAgain}
          className="h-9 rounded-md border border-bench-line-bright px-3.5 text-[12.5px] text-bench-ink-dim hover:text-bench-ink"
        >
          Import another file
        </button>
      </div>
    </section>
  );
}
