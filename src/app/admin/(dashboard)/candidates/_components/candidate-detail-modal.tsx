'use client';

import {
  Anchor,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconBrandGithub,
  IconCalendar,
  IconCash,
  IconCheck,
  IconCopy,
  IconEdit,
  IconExternalLink,
  IconFileDescription,
  IconMail,
  IconMicrophone,
  IconPhone,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { Candidate } from '@/store/api/candidates.api';
import { downloadFileAsObjectUrl } from '@/lib/s3';

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: 'medium',
    });
  } catch {
    return iso;
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

export function CandidateDetailModal({
  candidate,
  onClose,
  onEdit,
  onDelete,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onEdit: (c: Candidate) => void;
  onDelete: (c: Candidate) => void;
}) {
  const [resumeLoading, setResumeLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const openStoredFile = async (
    ref: string,
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true);
    try {
      const url = /^https?:\/\//i.test(ref)
        ? ref
        : await downloadFileAsObjectUrl(ref);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open file', err);
      notifications.show({
        color: 'red',
        title: 'Could not open file',
        message: 'The link is invalid or the server is unreachable.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={candidate !== null}
      onClose={onClose}
      centered
      size="lg"
      radius="md"
      padding={0}
      withCloseButton={false}
    >
      {candidate && (
        <div className="flex flex-col">
          {/* Header */}
          <div className="relative overflow-hidden rounded-t-md bg-gradient-to-br from-[#0a293b] to-[#0d4257] p-6 text-white">
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#00a9ab]/25 blur-3xl" />
            <div className="relative">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                Candidate
              </div>
              <h2 className="text-xl font-semibold text-white truncate pr-8">
                {candidate.fullName}
              </h2>
              <div className="mt-1 text-sm text-white/80 truncate">
                {candidate.email}
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
                    href={`mailto:${candidate.email}`}
                    size="sm"
                    c="#0a293b"
                    className="truncate"
                  >
                    {candidate.email}
                  </Anchor>
                  <CopyableInline value={candidate.email} label="email" />
                </div>
              </InfoRow>

              <InfoRow icon={<IconPhone size={14} />} label="Phone">
                {candidate.phoneNumber ? (
                  <div className="flex items-center gap-1.5">
                    <Anchor
                      href={`tel:${candidate.phoneNumber}`}
                      size="sm"
                      c="#0a293b"
                    >
                      {candidate.phoneNumber}
                    </Anchor>
                    <CopyableInline
                      value={candidate.phoneNumber}
                      label="phone"
                    />
                  </div>
                ) : (
                  <Text size="sm" c="#64748b">
                    Not provided
                  </Text>
                )}
              </InfoRow>

              <InfoRow icon={<IconCash size={14} />} label="Expected salary">
                {candidate.salary ? (
                  <Text size="sm" c="#0a293b">
                    {candidate.salary}
                  </Text>
                ) : (
                  <Text size="sm" c="#64748b">
                    —
                  </Text>
                )}
              </InfoRow>

              <InfoRow
                icon={<IconCalendar size={14} />}
                label="Availability start"
              >
                <Text size="sm" c="#0a293b">
                  {formatDate(candidate.startDate)}
                </Text>
              </InfoRow>

              <InfoRow icon={<IconBrandGithub size={14} />} label="GitHub">
                {candidate.github ? (
                  <div className="flex items-center gap-1.5">
                    <Anchor
                      href={candidate.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      c="#0a293b"
                      className="truncate"
                    >
                      {candidate.github.replace(/^https?:\/\//i, '')}
                    </Anchor>
                    <IconExternalLink size={12} className="text-[#64748b]" />
                  </div>
                ) : (
                  <Text size="sm" c="#64748b">
                    —
                  </Text>
                )}
              </InfoRow>

              <InfoRow icon={<IconCalendar size={14} />} label="Added">
                <Text size="sm" c="#0a293b">
                  {formatDate(candidate.createdAt)}
                </Text>
              </InfoRow>
            </div>

            {(candidate.remark?.trim() ?? '').length > 0 && (
              <>
                <Divider my="md" color="#eef0f3" />
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
                    Remark
                  </div>
                  <ScrollArea.Autosize
                    mah={200}
                    className="rounded-md border border-[#eef0f3] bg-[#fafbfc]"
                  >
                    <Text
                      size="sm"
                      c="#0a293b"
                      className="whitespace-pre-wrap leading-relaxed p-4"
                    >
                      {candidate.remark}
                    </Text>
                  </ScrollArea.Autosize>
                </div>
              </>
            )}

            <Divider my="md" color="#eef0f3" />

            {/* Attachments */}
            <div className="grid gap-2 sm:grid-cols-2">
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
                      {candidate.resume ? 'Attached' : 'Not provided'}
                    </div>
                  </div>
                </div>
                {candidate.resume && (
                  <Button
                    variant="light"
                    color="dark"
                    size="xs"
                    onClick={() =>
                      openStoredFile(candidate.resume!, setResumeLoading)
                    }
                    loading={resumeLoading}
                  >
                    Open
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-[#eef0f3] bg-[#fafbfc] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#00a9ab] text-white">
                    <IconMicrophone size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#0a293b]">
                      Voice note
                    </div>
                    <div className="text-xs text-[#64748b]">
                      {candidate.voiceNote ? 'Attached' : 'Not provided'}
                    </div>
                  </div>
                </div>
                {candidate.voiceNote && (
                  <Button
                    variant="light"
                    color="dark"
                    size="xs"
                    onClick={() =>
                      openStoredFile(candidate.voiceNote!, setVoiceLoading)
                    }
                    loading={voiceLoading}
                  >
                    Open
                  </Button>
                )}
              </div>
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
                onDelete(candidate);
                onClose();
              }}
            >
              Delete candidate
            </Button>
            <Group>
              <Button
                variant="default"
                size="sm"
                leftSection={<IconEdit size={14} />}
                onClick={() => {
                  onEdit(candidate);
                  onClose();
                }}
              >
                Edit
              </Button>
              <Button variant="filled" color="dark" size="sm" onClick={onClose}>
                Close
              </Button>
            </Group>
          </div>
        </div>
      )}
    </Modal>
  );
}
