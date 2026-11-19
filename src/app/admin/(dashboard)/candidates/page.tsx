'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
  TextInput,
  Tooltip,
  rem,
} from '@mantine/core';
import {
  IconAddressBook,
  IconBrandGithub,
  IconDownload,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDebounce } from 'use-debounce';
import {
  useGetCandidatesQuery,
  useImportCandidatesMutation,
  type Candidate,
} from '@/store/api/candidates.api';
import { DeleteCandidateModal } from './_components/delete-candidate-modal';
import { CandidateFormModal } from './_components/candidate-form-modal';
import { CandidateDetailModal } from './_components/candidate-detail-modal';
import { CandidateRowActions } from './_components/candidate-row-actions';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

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

export default function CandidatesPage() {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebounce(searchValue, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [detailTarget, setDetailTarget] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [formTarget, setFormTarget] = useState<Candidate | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);

  const queryArgs = useMemo(() => {
    const q: Parameters<typeof useGetCandidatesQuery>[0] = {
      orderBy: [{ column: 'createdAt', direction: 'DESC' }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    };
    const needle = debouncedSearch.trim();
    if (needle) {
      q.where = [
        [
          {
            column: 'fullName',
            value: `%${needle}%`,
            operator: 'ILIKE',
          },
          {
            column: 'email',
            value: `%${needle}%`,
            operator: 'ILIKE',
          },
          {
            column: 'github',
            value: `%${needle}%`,
            operator: 'ILIKE',
          },
        ],
      ];
    }
    return q;
  }, [debouncedSearch, page, pageSize]);

  const {
    data: candidatesData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCandidatesQuery(queryArgs);

  const items = candidatesData?.items ?? [];
  const total = candidatesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [importCandidates, { isLoading: isImporting }] =
    useImportCandidatesMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    try {
      const result = await importCandidates(body).unwrap();
      notifications.show({
        color: 'teal',
        title: 'Import complete',
        message:
          result?.imported !== undefined
            ? `${result.imported} candidate${result.imported === 1 ? '' : 's'} imported.`
            : 'Import finished successfully.',
      });
    } catch (err) {
      console.error('Import failed', err);
      notifications.show({
        color: 'red',
        title: 'Import failed',
        message: 'Could not import the file. Please check the format and retry.',
      });
    }
  };

  const showSkeleton = isLoading;
  const showFetchingOverlay = !isLoading && isFetching;

  return (
    <Container size="xl" py="md">
      <Paper p="lg" radius="md" withBorder className="border-[#e7eaee] bg-white">
        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TextInput
            className="w-full sm:max-w-md"
            placeholder="Search by name, email, or github…"
            leftSection={
              <IconSearch style={{ width: rem(16), height: rem(16) }} />
            }
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.currentTarget.value);
              setPage(1);
            }}
            size="md"
          />
          <div className="flex items-center gap-2">
            <Select
              data={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(v ? Number(v) : 10);
                setPage(1);
              }}
              size="md"
              w={140}
              allowDeselect={false}
            />
            <Menu shadow="md" position="bottom-end">
              <Menu.Target>
                <Button
                  variant="default"
                  size="md"
                  leftSection={<IconUpload size={16} />}
                  loading={isImporting}
                >
                  Import
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconUpload size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Excel (.xlsx)
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDownload size={14} />}
                  disabled
                >
                  Export CSV (coming soon)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <Button
              onClick={() => {
                setFormTarget(null);
                setFormMode('create');
              }}
              leftSection={<IconPlus size={16} />}
              size="md"
              color="dark"
              style={{ backgroundColor: '#0a293b' }}
            >
              Add Candidate
            </Button>
          </div>
        </div>

        {/* Table wrapper */}
        <div className="relative overflow-hidden rounded-lg border border-[#eef0f3]">
          {showFetchingOverlay && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
              <div className="h-full w-full animate-pulse bg-[#00a9ab]/60" />
            </div>
          )}
          <Table.ScrollContainer minWidth={800}>
            <Table
              verticalSpacing="md"
              horizontalSpacing="md"
              highlightOnHover
              styles={{
                th: {
                  backgroundColor: '#f9fafb',
                  color: '#64748b',
                  fontWeight: 600,
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                },
                td: {
                  borderBottom: '1px solid #e7eaee',
                  padding: '14px 16px',
                  verticalAlign: 'middle',
                },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Candidate</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Salary</Table.Th>
                  <Table.Th>Available</Table.Th>
                  <Table.Th>Links</Table.Th>
                  <Table.Th>Added</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {showSkeleton ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <Table.Tr key={`skel-${i}`}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <Table.Td key={j}>
                          <div className="h-4 w-full animate-pulse rounded bg-[#f1f5f9]" />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))
                ) : isError ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Card className="mx-auto my-6 max-w-md text-center border border-red-100 bg-red-50/40">
                        <Text c="red.7" fw={500} mb="sm">
                          Failed to load candidates.
                        </Text>
                        <Button
                          leftSection={<IconRefresh size={16} />}
                          onClick={() => refetch()}
                          variant="light"
                          color="red"
                        >
                          Try again
                        </Button>
                      </Card>
                    </Table.Td>
                  </Table.Tr>
                ) : items.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <div className="mx-auto my-12 flex max-w-md flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
                          <IconAddressBook size={28} />
                        </div>
                        <Text fw={600} c="#0a293b">
                          {debouncedSearch
                            ? 'No candidates match your search.'
                            : 'No candidates yet.'}
                        </Text>
                        <Text size="sm" c="#64748b">
                          {debouncedSearch
                            ? 'Try a different keyword or clear the search.'
                            : 'Add a candidate manually or bulk-import from an Excel file.'}
                        </Text>
                        {!debouncedSearch && (
                          <Group gap="xs">
                            <Button
                              leftSection={<IconPlus size={16} />}
                              variant="filled"
                              color="dark"
                              onClick={() => {
                                setFormTarget(null);
                                setFormMode('create');
                              }}
                            >
                              Add candidate
                            </Button>
                            <Button
                              leftSection={<IconUpload size={16} />}
                              variant="light"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Import Excel
                            </Button>
                          </Group>
                        )}
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  items.map((c) => (
                    <Table.Tr
                      key={c.id}
                      onClick={() => setDetailTarget(c)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <div className="min-w-0">
                          <Text
                            size="sm"
                            fw={600}
                            c="#0a293b"
                            className="truncate"
                          >
                            {c.fullName}
                          </Text>
                          <Text size="xs" c="#64748b" className="truncate">
                            {c.email}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={c.phoneNumber ? '#0a293b' : '#94a3b8'}>
                          {c.phoneNumber ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={c.salary ? '#0a293b' : '#94a3b8'}>
                          {c.salary ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="#64748b">
                          {formatDate(c.startDate)}
                        </Text>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Group gap="xs" wrap="nowrap">
                          {c.github ? (
                            <Tooltip label="GitHub">
                              <ActionIcon
                                component={Link}
                                href={c.github}
                                target="_blank"
                                variant="subtle"
                                color="gray"
                                size="sm"
                                aria-label="GitHub"
                              >
                                <IconBrandGithub size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null}
                          {c.resume ? (
                            <Badge
                              size="xs"
                              variant="light"
                              color="cyan"
                              radius="sm"
                            >
                              CV
                            </Badge>
                          ) : null}
                          {c.voiceNote ? (
                            <Badge
                              size="xs"
                              variant="light"
                              color="grape"
                              radius="sm"
                            >
                              🎤
                            </Badge>
                          ) : null}
                          {!c.github && !c.resume && !c.voiceNote && (
                            <Text size="xs" c="#94a3b8">
                              —
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="#64748b">
                          {formatDate(c.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td
                        style={{ width: 40 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CandidateRowActions
                          candidate={c}
                          onView={setDetailTarget}
                          onEdit={(cand) => {
                            setFormTarget(cand);
                            setFormMode('edit');
                          }}
                          onDelete={setDeleteTarget}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>

        {/* Footer */}
        {!showSkeleton && items.length > 0 && (
          <Group justify="space-between" mt="lg" wrap="wrap">
            <Text size="xs" c="#64748b">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, total)} of {total}
            </Text>
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              size="sm"
              color="dark"
              withEdges
            />
          </Group>
        )}
      </Paper>

      <CandidateDetailModal
        candidate={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={(c) => {
          setFormTarget(c);
          setFormMode('edit');
        }}
        onDelete={setDeleteTarget}
      />

      <CandidateFormModal
        candidate={formTarget}
        mode={formMode}
        onClose={() => {
          setFormTarget(null);
          setFormMode(null);
        }}
      />

      <DeleteCandidateModal
        candidate={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </Container>
  );
}
