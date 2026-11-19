'use client';

import { useEffect, useState } from 'react';

import { downloadFileAsObjectUrl, listResumesForApplicant, type DocumentRecord } from '@/lib/s3';
import { cn } from '@/bench/utils';

/**
 * The CV a careers applicant uploaded. It stays with the application, so a
 * candidate moved to the bench reaches it through the application too.
 */
export function ApplicantCv({ applicantId, className }: { applicantId: string; className?: string }) {
  // undefined while the document list loads, null when there is none
  const [doc, setDoc] = useState<DocumentRecord | null | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    listResumesForApplicant(applicantId)
      .then((docs) => {
        if (live) setDoc(docs[0] ?? null);
      })
      .catch(() => {
        if (live) setDoc(null);
      });
    return () => {
      live = false;
    };
  }, [applicantId]);

  async function open() {
    if (!doc || opening) return;
    setOpening(true);
    setFailed(false);
    try {
      window.open(await downloadFileAsObjectUrl(doc.id), '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }

  if (doc === undefined) return <span className={cn('text-bench-ink-faint', className)}>Checking for a CV…</span>;
  if (!doc) return <span className={cn('text-bench-ink-faint', className)}>No CV uploaded</span>;
  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className={cn('hover:text-accent disabled:opacity-60', failed && 'text-bench-critical', className)}
    >
      {opening ? 'Opening…' : failed ? 'Could not open the CV. Try again' : 'View CV'}
    </button>
  );
}
