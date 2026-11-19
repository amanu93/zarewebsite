'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, Undo2 } from 'lucide-react';

import { CALL_NOTE_MAX, undoCall, updateCallNote } from '@/bench/data';
import { cn } from '@/bench/utils';

/**
 * The confirmation after every call outcome or archive: what was logged, an
 * Undo for about five seconds, and a place to add a short note to the call.
 * One at a time; a new outcome replaces the previous toast, which commits it.
 */

export const TOAST_MS = 5_000;

export interface CallToastInput {
  callId: string;
  message: string;
  /** Archives take no note. */
  noteable?: boolean;
  onUndone?: () => void;
}

type Toast = CallToastInput & { key: number };

const Ctx = createContext<(t: CallToastInput) => void>(() => {});

export function useCallToast() {
  return useContext(Ctx);
}

export function CallToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);
  const show = useCallback((t: CallToastInput) => {
    seq.current += 1;
    setToast({ ...t, key: seq.current });
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.key} toast={toast} onClose={() => setToast(null)} />}
    </Ctx.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Auto-dismiss, paused while the pointer or focus is on the toast.
  useEffect(() => {
    if (held || noting) return;
    const t = window.setTimeout(() => onCloseRef.current(), status ? 2_000 : TOAST_MS);
    return () => window.clearTimeout(t);
  }, [held, noting, status]);

  async function undo() {
    const ok = await undoCall(toast.callId);
    if (ok) {
      toast.onUndone?.();
      onClose();
    } else {
      setStatus('Too late to undo.');
    }
  }

  // Alt+Z undoes from anywhere while the toast is showing, so keyboard users
  // never have to tab to the end of the page inside five seconds.
  const undoRef = useRef<() => void>(() => {});
  useEffect(() => {
    undoRef.current = () => void undo();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    const res = await updateCallNote(toast.callId, note);
    if (res.ok) {
      setNoting(false);
      setStatus(note.trim() ? 'Note saved.' : 'Note removed.');
    } else {
      setStatus(res.errors.note ?? res.errors.form ?? 'Could not save the note.');
    }
  }

  return (
    <div
      role="region"
      aria-label="Call logged"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      data-bench-toast
      className="fade-up fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-lg border border-bench-line-bright bg-bench-surface-2 px-3.5 py-2.5 shadow-lg md:bottom-6"
    >
      <div className="flex items-center gap-2.5">
        <Check size={14} className="shrink-0 text-bench-healthy" aria-hidden />
        <span role="status" className="min-w-0 flex-1 text-[12.5px] text-bench-ink">
          {status ?? toast.message}
          {!status && <span className="sr-only"> Press Alt+Z to undo.</span>}
        </span>
        {!status && toast.noteable !== false && !noting && (
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="shrink-0 rounded px-2 py-1 text-[12px] text-bench-ink-dim hover:text-bench-ink"
          >
            Add note
          </button>
        )}
        {!status && (
          <button
            type="button"
            onClick={() => void undo()}
            className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] font-medium text-accent hover:text-accent-bright"
          >
            <Undo2 size={12} aria-hidden /> Undo <kbd className="hidden font-mono text-[10px] text-bench-ink-faint md:inline">Alt+Z</kbd>
          </button>
        )}
      </div>
      {noting && (
        <form onSubmit={(e) => void saveNote(e)} className="mt-2 flex items-center gap-2">
          <label htmlFor="call-note" className="sr-only">
            Note on this call
          </label>
          <input
            id="call-note"
            autoFocus
            value={note}
            maxLength={CALL_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNoting(false);
            }}
            placeholder="e.g. Asked to call after 5pm"
            className={cn(
              'h-8 min-w-0 flex-1 rounded-md border border-bench-line bg-bench-surface px-2.5 text-[12.5px] text-bench-ink',
              'placeholder:text-bench-ink-faint focus:border-accent focus:outline-none',
            )}
          />
          <button
            type="submit"
            className="h-8 shrink-0 rounded-md bg-accent px-3 text-[12px] font-semibold text-accent-contrast hover:bg-accent-bright"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
