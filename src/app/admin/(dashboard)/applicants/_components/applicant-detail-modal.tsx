'use client';

import {
  Anchor,
  Button,
  CopyButton,
  Divider,
  Modal,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconBriefcase,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconFileDescription,
  IconMail,
  IconPhone,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { AppliedJob } from '@/store/api/applied-jobs.api';
import {
  downloadFileAsObjectUrl,
  listResumesForApplicant,
  type DocumentRecord,
} from '@/lib/s3';
import { StatusSelect } from './status-select';

function formatFull(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string) {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH} hr ago`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `${diffD} day${diffD === 1 ? '' : 's'} ago`;
    const diffMo = Math.round(diffD / 30);
    if (diffMo < 12) return `${diffMo} mo ago`;
    const diffY = Math.round(diffMo / 12);
    return `${diffY} yr ago`;
  } catch {
    return '';
  }
}

const CopyableInline = ({
  value,
  label,
}: {
  value: string;
  label: string;
}) => (
  <CopyButton value={value} timeout={1500}>
    {({ copied, copy }) => (
      <Tooltip label={copied ? 'Copied' : `Copy ${label}`}>
        <button
          onClick={copy}
          className="rounded p-1 text-[#64748b] hover:text-[#0a293b] hover:bg-[#f1f5f9]"
          aria-label={`Copy ${label}`}
          type="button"
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
      </Tooltip>
    )}
  </CopyButton>
);

const InfoRow = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-2">
    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#f1f5f9] text-[#0a293b]">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-[#0a293b] break-words">
        {children}
      </div>
    </div>
  </div>
);

export function ApplicantDetailModal({
  applicant,
  jobTitle,
  onClose,
  onDelete,
}: {
  applicant: AppliedJob | null;
  jobTitle?: string;
  onClose: () => void;
  onDelete: (a: AppliedJob) => void;
}) {
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeDoc, setResumeDoc] = useState<DocumentRecord | null>(null);
  const [resumeLookupState, setResumeLookupState] = useState<
    'idle' | 'loading' | 'done'
  >('idle');

  // When the modal opens for an applicant, ask the S3 documents endpoint for
  // any resume attached to this applied-job. The backend links documents by
  // (type, key, itemId); the apply form uploads with type=resume and no
  // explicit key, so the backend defaults key to "resume".
  useEffect(() => {
    let cancelled = false;
    if (!applicant) {
      setResumeDoc(null);
      setResumeLookupState('idle');
      return;
    }
    setResumeLookupState('loading');
    setResumeDoc(null);
    listResumesForApplicant(applicant.id)
      .then((docs) => {
        if (cancelled) return;
        setResumeDoc(docs[0] ?? null);
        setResumeLookupState('done');
      })
      .catch((err) => {
        console.error('resume lookup failed', err);
        if (cancelled) return;
        setResumeDoc(null);
        setResumeLookupState('done');
      });
    return () => {
      cancelled = true;
    };
  }, [applicant?.id]);

  const handleResumeOpen = async () => {
    if (!resumeDoc) return;
    setResumeLoading(true);
    try {
      const url = await downloadFileAsObjectUrl(resumeDoc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open resume', err);
      notifications.show({
        color: 'red',
        title: 'Could not open resume',
        message: 'The file link is invalid or the server is unreachable.',
      });
    } finally {
      setResumeLoading(false);
    }
  };

  return (
    <Modal
      opened={applicant !== null}
      onClose={onClose}
      centered
      size="lg"
      radius="md"
      padding={0}
      withCloseButton={false}
    >
      {applicant && (
        <div className="flex flex-col">
          {/* Header */}
          <div className="relative overflow-hidden rounded-t-md bg-gradient-to-br from-[#0a293b] to-[#0d4257] p-6 text-white">
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#00a9ab]/25 blur-3xl" />
            <div className="relative">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                Applicant
              </div>
              <h2 className="text-xl font-semibold text-white truncate pr-8">
                {applicant.fullName}
              </h2>
              <div className="mt-3">
                <StatusSelect applicant={applicant} />
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                type="button"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pt-4 pb-6">
            <div className="grid gap-1 sm:grid-cols-2">
              <InfoRow icon={<IconMail size={14} />} label="Email">
                <div className="flex items-center gap-1.5">
                  <Anchor
                    href={`mailto:${applicant.email}`}
                    size="sm"
                    c="#0a293b"
                    className="truncate"
                  >
                    {applicant.email}
                  </Anchor>
                  <CopyableInline value={applicant.email} label="email" />
                </div>
              </InfoRow>

              <InfoRow icon={<IconPhone size={14} />} label="Phone">
                {applicant.phone ? (
                  <div className="flex items-center gap-1.5">
                    <Anchor
                      href={`tel:${applicant.phone}`}
                      size="sm"
                      c="#0a293b"
                    >
                      {applicant.phone}
                    </Anchor>
                    <CopyableInline value={applicant.phone} label="phone" />
                  </div>
                ) : (
                  <Text size="sm" c="#64748b">
                    Not provided
                  </Text>
                )}
              </InfoRow>

              <InfoRow icon={<IconBriefcase size={14} />} label="Applied for">
                <div className="flex items-center gap-1.5">
                  <Anchor
                    component={Link}
                    href={`/careers/${applicant.jobId}`}
                    target="_blank"
                    size="sm"
                    c="#0a293b"
                    className="truncate"
                  >
                    {jobTitle ?? applicant.jobId}
                  </Anchor>
                  <IconExternalLink size={12} className="text-[#64748b]" />
                </div>
              </InfoRow>

              <InfoRow
                icon={<IconFileDescription size={14} />}
                label="Applied"
              >
                <div>
                  <div>{formatRelative(applicant.createdAt)}</div>
                  <div className="text-xs text-[#64748b]">
                    {formatFull(applicant.createdAt)}
                  </div>
                </div>
              </InfoRow>
            </div>

            <Divider my="md" color="#eef0f3" />

            {/* Cover letter */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
                Cover letter
              </div>
              {applicant.coverLetter?.trim() ? (
                <ScrollArea.Autosize
                  mah={220}
                  className="rounded-md border border-[#eef0f3] bg-[#fafbfc]"
                >
                  <Text
                    size="sm"
                    c="#0a293b"
                    className="whitespace-pre-wrap leading-relaxed p-4"
                  >
                    {applicant.coverLetter}
                  </Text>
                </ScrollArea.Autosize>
              ) : (
                <Text size="sm" c="#64748b" className="italic">
                  No cover letter provided.
                </Text>
              )}
            </div>

            <Divider my="md" color="#eef0f3" />

            {/* Resume */}
            <div className="flex items-center justify-between gap-3 rounded-md border border-[#eef0f3] bg-[#fafbfc] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0a293b] text-white">
                  <IconFileDescription size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#0a293b]">
                    Resume
                  </div>
                  <div className="text-xs text-[#64748b]">
                    {resumeLookupState === 'loading'
                      ? 'Looking for attached resume…'
                      : resumeDoc
                        ? resumeDoc.title ?? 'Attached to this application'
                        : 'Not provided'}
                  </div>
                </div>
              </div>
              {resumeDoc && (
                <Button
                  variant="light"
                  color="dark"
                  size="xs"
                  onClick={handleResumeOpen}
                  loading={resumeLoading}
                >
                  Open
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-[#eef0f3] bg-[#fafbfc] px-6 py-3">
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconTrash size={14} />}
              onClick={() => {
                onDelete(applicant);
                onClose();
              }}
            >
              Delete application
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
