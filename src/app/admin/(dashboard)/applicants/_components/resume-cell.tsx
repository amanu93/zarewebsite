'use client';

import { Anchor, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import {
  downloadFileAsObjectUrl,
  listResumesForApplicant,
  type DocumentRecord,
} from '@/lib/s3';

/**
 * Table-row cell that resolves whether a given applied-job has a resume
 * attached (via GET /api/s3/documents/resume/resume/{applicantId}) and
 * renders either a click-to-open link or an em-dash.
 */
export function ResumeCell({ applicantId }: { applicantId: string }) {
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setDoc(null);
    listResumesForApplicant(applicantId)
      .then((docs) => {
        if (cancelled) return;
        setDoc(docs[0] ?? null);
        setState('done');
      })
      .catch(() => {
        if (cancelled) return;
        setDoc(null);
        setState('done');
      });
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!doc || opening) return;
    setOpening(true);
    try {
      const url = await downloadFileAsObjectUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open resume', err);
      notifications.show({
        color: 'red',
        title: 'Could not open resume',
        message: 'The file link is invalid or the server is unreachable.',
      });
    } finally {
      setOpening(false);
    }
  };

  if (state === 'loading') {
    return <Loader size="xs" color="gray" />;
  }

  if (!doc) {
    return (
      <Text size="sm" c="#94a3b8">
        —
      </Text>
    );
  }

  return (
    <Anchor
      href="#"
      onClick={handleClick}
      size="sm"
      c="#0a293b"
      td="underline"
    >
      {opening ? 'Opening…' : 'View'}
    </Anchor>
  );
}
