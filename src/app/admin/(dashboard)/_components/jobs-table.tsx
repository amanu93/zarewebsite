'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBriefcase,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
import { JobRowActions } from './job-row-actions';
import { useDebounce } from 'use-debounce';
import {
  useDeleteJobMutation,
  useGetJobsQuery,
  type Job,
} from '@/store/api/job.api';
import { useGetAppliedJobsQuery } from '@/store/api/applied-jobs.api';
import type { Where } from '@/lib/query/types';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const jobIsActive = (job: Job) => {
  if (!job.endDate) return true;
  return new Date(job.endDate) >= new Date();
};

export type JobsEmptyState = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  primary?: { label: string; href: string };
};

/**
 * Reusable job listing table. Pass `extraWhere` to prefilter (e.g. only
 * expired jobs). Passes `showCreate=false` to hide the "New Job" affordance
 * (e.g. on archive views).
 */
export function JobsTable({
  extraWhere = [],
  showCreate = true,
  emptyState,
}: {
  extraWhere?: Where[][];
  showCreate?: boolean;
  emptyState?: JobsEmptyState;
}) {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebounce(searchValue, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const queryArgs = useMemo(() => {
    const where: Where[][] = [...extraWhere];
    const needle = debouncedSearch.trim();
    if (needle) {
      where.push([
        {
          column: 'title',
          value: `%${needle}%`,
          operator: 'ILIKE',
        },
      ]);
    }
    const q: Parameters<typeof useGetJobsQuery>[0] = {
      orderBy: [{ column: 'createdAt', direction: 'DESC' }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    };
    if (where.length > 0) q.where = where;
    return q;
  }, [debouncedSearch, page, pageSize, extraWhere]);

  const {
    data: jobsData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetJobsQuery(queryArgs);

  const { data: appliedJobsData } = useGetAppliedJobsQuery(undefined);
  const applicantsByJobId = useMemo(() => {
    const map: Record<string, number> = {};
    (appliedJobsData?.items ?? []).forEach((a) => {
      map[a.jobId] = (map[a.jobId] ?? 0) + 1;
    });
    return map;
  }, [appliedJobsData]);

  const [deleteJob, { isLoading: isDeleting }] = useDeleteJobMutation();

  const total = jobsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = jobsData?.items ?? [];

  const handleConfirmDelete = async () => {
    if (!selectedJob) return;
    try {
      await deleteJob({ id: selectedJob.id }).unwrap();
      notifications.show({
        color: 'teal',
        title: 'Job deleted',
        message: `${selectedJob.title} has been removed.`,
      });
      setModalOpen(false);
      setSelectedJob(null);
      refetch();
    } catch (error: unknown) {
      const message =
        (error as { data?: { message?: string } })?.data?.message ??
        'Cannot delete this job. Please try again.';
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message,
      });
    }
  };

  const showSkeleton = isLoading;
  const showFetchingOverlay = !isLoading && isFetching;

  const fallbackEmpty: JobsEmptyState = {
    icon: <IconBriefcase size={28} />,
    title: debouncedSearch ? 'No jobs match your search.' : 'No job posts yet.',
    description: debouncedSearch
      ? 'Try a different keyword or clear the search.'
      : 'Create your first job post to start receiving applications.',
    primary: showCreate
      ? { label: 'Create job post', href: '/admin/job/new' }
      : undefined,
  };
  const empty = emptyState ?? fallbackEmpty;

  return (
    <Container size="xl" py="md">
      <Paper p="lg" radius="md" withBorder className="border-[#e7eaee] bg-white">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TextInput
            className="w-full sm:max-w-md"
            placeholder="Search by title…"
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
            {showCreate && (
              <Button
                component={Link}
                href="/admin/job/new"
                leftSection={<IconPlus size={16} />}
                size="md"
                color="dark"
                style={{ backgroundColor: '#0a293b' }}
              >
                New Job
              </Button>
            )}
          </div>
        </div>

        {/* Table wrapper */}
        <div className="relative overflow-hidden rounded-lg border border-[#eef0f3]">
          {showFetchingOverlay && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
              <div className="h-full w-full animate-pulse bg-[#00a9ab]/60" />
            </div>
          )}

          <Table.ScrollContainer minWidth={960}>
            <Table verticalSpacing="md" horizontalSpacing="md" highlightOnHover>
              <Table.Thead className="bg-[#f9fafb]">
                <Table.Tr>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Job
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Location
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Type
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Status
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Applicants
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Posted
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="xs" c="#64748b" tt="uppercase">
                      Closes
                    </Text>
                  </Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {showSkeleton ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <Table.Tr key={`skeleton-${i}`}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <Table.Td key={j}>
                          <div className="h-4 w-full animate-pulse rounded bg-[#f1f5f9]" />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))
                ) : isError ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Card className="mx-auto my-6 max-w-md text-center border border-red-100 bg-red-50/40">
                        <Text c="red.7" fw={500} mb="sm">
                          Failed to load jobs.
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
                    <Table.Td colSpan={8}>
                      <div className="mx-auto my-12 flex max-w-md flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
                          {empty.icon ?? <IconBriefcase size={28} />}
                        </div>
                        <Text fw={600} c="#0a293b">
                          {empty.title}
                        </Text>
                        <Text size="sm" c="#64748b">
                          {empty.description}
                        </Text>
                        {empty.primary && (
                          <Button
                            component={Link}
                            href={empty.primary.href}
                            leftSection={<IconPlus size={16} />}
                            variant="light"
                            color="dark"
                          >
                            {empty.primary.label}
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  items.map((job) => {
                    const active = jobIsActive(job);
                    const applicants = applicantsByJobId[job.id] ?? 0;
                    return (
                      <Table.Tr key={job.id}>
                        <Table.Td>
                          <Text fw={600} size="sm" c="#0a293b">
                            {job.title}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#0a293b">
                            {job.location || '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <div className="inline-flex items-center gap-1.5">
                            <Badge
                              variant="light"
                              color="cyan"
                              size="sm"
                              radius="sm"
                            >
                              {job.type}
                            </Badge>
                            {job.workType && (
                              <>
                                <span className="text-[#cbd5e1]">·</span>
                                <Badge
                                  variant="light"
                                  color="grape"
                                  size="sm"
                                  radius="sm"
                                >
                                  {job.workType}
                                </Badge>
                              </>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant={active ? 'filled' : 'light'}
                            color={active ? 'teal' : 'gray'}
                            size="sm"
                          >
                            {active ? 'Active' : 'Closed'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Link
                            href={`/admin/applicants?jobId=${job.id}`}
                            className="inline-flex items-center gap-1.5 text-sm text-[#0a293b] hover:text-[#00a9ab] transition-colors"
                          >
                            <IconUsers size={14} />
                            <span className="font-medium">{applicants}</span>
                            <span className="text-[#64748b]">applicants</span>
                          </Link>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#64748b">
                            {formatDate(job.createdAt ?? job.startDate)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={active ? '#64748b' : '#b91c1c'}>
                            {formatDate(job.endDate)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ width: 40 }}>
                          <JobRowActions
                            job={job}
                            onEdit={(j) => router.push(`/admin/job/${j.id}`)}
                            onDelete={(j) => {
                              setSelectedJob(j);
                              setModalOpen(true);
                            }}
                          />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
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

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete job post"
        centered
        size="sm"
      >
        {selectedJob && (
          <>
            <Text size="sm" mb="md">
              Are you sure you want to delete{' '}
              <strong>{selectedJob.title}</strong>? This action cannot be
              undone.
            </Text>
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleConfirmDelete}
                loading={isDeleting}
              >
                Delete
              </Button>
            </Group>
          </>
        )}
      </Modal>
    </Container>
  );
}
