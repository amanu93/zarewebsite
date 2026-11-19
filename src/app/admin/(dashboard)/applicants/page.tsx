'use client';

import { useMemo, useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Card, Select } from '@mantine/core';
import { useDebounce } from 'use-debounce';
import { ApplicantsTable } from '../_components/applicants-table';
import { DeleteApplicantModal } from './_components/delete-applicant-modal';
import { ApplicantDetailModal } from './_components/applicant-detail-modal';
import {
  useGetAppliedJobsQuery,
  type AppliedJob,
} from '@/store/api/applied-jobs.api';
import { useGetJobsQuery } from '@/store/api/job.api';
import {
  APPLIED_JOB_STATUS_OPTIONS,
  getStatusStyles,
} from '../_components/status-badge';

type StatusFilter = 'all' | (typeof APPLIED_JOB_STATUS_OPTIONS)[number];

export default function JobApplicantTracker() {
  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [debouncedQuery] = useDebounce(query, 300);
  const [applicantToDelete, setApplicantToDelete] = useState<AppliedJob | null>(
    null,
  );
  const [applicantToView, setApplicantToView] = useState<AppliedJob | null>(
    null,
  );
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  const {
    data: appliedJobsData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetAppliedJobsQuery(undefined);

  const { data: jobsData } = useGetJobsQuery({
    orderBy: [{ column: 'createdAt', direction: 'DESC' }],
  });

  const jobTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    (jobsData?.items ?? []).forEach((j) => {
      map[j.id] = j.title;
    });
    return map;
  }, [jobsData]);

  const jobOptions = useMemo(
    () =>
      (jobsData?.items ?? []).map((j) => ({
        value: j.id,
        label: j.title,
      })),
    [jobsData]
  );

  const applicants = useMemo(() => {
    let all = appliedJobsData?.items ?? [];
    if (selectedJobId) {
      all = all.filter((a) => a.jobId === selectedJobId);
    }
    if (selectedStatus !== 'all') {
      all = all.filter((a) => a.status === selectedStatus);
    }
    const needle = debouncedQuery.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((a) => {
      const title = jobTitleById[a.jobId] ?? '';
      return (
        a.fullName.toLowerCase().includes(needle) ||
        a.email.toLowerCase().includes(needle) ||
        title.toLowerCase().includes(needle)
      );
    });
  }, [
    appliedJobsData,
    debouncedQuery,
    jobTitleById,
    selectedJobId,
    selectedStatus,
  ]);

  // Counts respect the OTHER filters (job + search) but ignore the status
  // filter — so each tab shows how many applicants of that status would
  // appear under the currently selected job/search.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    APPLIED_JOB_STATUS_OPTIONS.forEach((s) => {
      counts[s] = 0;
    });
    const needle = debouncedQuery.trim().toLowerCase();
    (appliedJobsData?.items ?? []).forEach((a) => {
      if (selectedJobId && a.jobId !== selectedJobId) return;
      if (needle) {
        const title = jobTitleById[a.jobId] ?? '';
        const matches =
          a.fullName.toLowerCase().includes(needle) ||
          a.email.toLowerCase().includes(needle) ||
          title.toLowerCase().includes(needle);
        if (!matches) return;
      }
      counts.all += 1;
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    });
    return counts;
  }, [appliedJobsData, debouncedQuery, jobTitleById, selectedJobId]);

  const showEmpty =
    !isLoading && !isFetching && !isError && applicants.length === 0;
  const totalCount = appliedJobsData?.items.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
      {/* Status pipeline tabs */}
      {totalCount > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-[#e7eaee] bg-white p-2">
          {(['all', ...APPLIED_JOB_STATUS_OPTIONS] as StatusFilter[]).map(
            (s) => {
              const active = selectedStatus === s;
              const label = s === 'all' ? 'All' : s;
              const count = statusCounts[s] ?? 0;
              const swatch =
                s === 'all' ? '' : getStatusStyles(s).split(' ')[0]; // just the bg-* class
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStatus(s)}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#0a293b] text-white shadow-sm'
                      : 'text-[#64748b] hover:text-[#0a293b] hover:bg-[#f7f8f9]'
                  }`}
                >
                  {s !== 'all' && (
                    <span
                      className={`h-2 w-2 rounded-full ${swatch || 'bg-gray-300'}`}
                    />
                  )}
                  <span>{label}</span>
                  <span
                    className={`inline-flex min-w-[22px] justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'bg-[#f1f5f9] text-[#64748b]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            },
          )}
        </div>
      )}

      {/* Search + job filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] h-4 w-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applicants by name, email, or job..."
            className="w-full pl-10 pr-4 py-2 border border-[#e7eaee] rounded-md bg-[#ffffff] text-[#0a293b] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </div>
        <Select
          placeholder="Filter by job"
          data={jobOptions}
          value={selectedJobId}
          onChange={setSelectedJobId}
          clearable
          searchable
          nothingFoundMessage="No jobs"
          className="min-w-[240px]"
          styles={{
            input: {
              backgroundColor: '#ffffff',
              borderColor: '#e7eaee',
              color: '#0a293b',
            },
          }}
        />
      </div>

      {totalCount > 0 && (
        <div className="text-xs text-[#64748b]">
          Showing {applicants.length} of {totalCount} application
          {totalCount === 1 ? '' : 's'}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-md bg-white border border-[#e7eaee] p-6 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f1f5f9] animate-pulse rounded-sm" />
          ))}
        </div>
      ) : isError ? (
        <Card className="w-max mx-auto flex flex-col items-center gap-4 p-6">
          <span className="text-red-600">
            Failed to load applications, please try again.
          </span>
          <button
            onClick={() => refetch()}
            className="w-full flex items-center justify-center gap-3 rounded-md px-3 py-1.5 text-sm border-2 border-cyan-950 hover:border-[#10CFD1] hover:bg-[#10CFD1] hover:text-white transition-all duration-300"
          >
            <IconRefresh size={19} />
            <span>Try again</span>
          </button>
        </Card>
      ) : showEmpty ? (
        <div className="text-[#64748b] p-8 text-center bg-white rounded-md border border-[#e7eaee]">
          {debouncedQuery.trim() ||
          selectedJobId ||
          selectedStatus !== 'all'
            ? 'No applicants match your filters.'
            : 'No applications yet.'}
        </div>
      ) : (
        <div className="relative">
          {isFetching && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-t-md">
              <div className="h-full w-full animate-pulse bg-[#00a9ab]/70" />
            </div>
          )}
          <ApplicantsTable
            applicants={applicants}
            jobTitleById={jobTitleById}
            onView={setApplicantToView}
            onDelete={setApplicantToDelete}
          />
        </div>
      )}

      <ApplicantDetailModal
        applicant={applicantToView}
        jobTitle={
          applicantToView ? jobTitleById[applicantToView.jobId] : undefined
        }
        onClose={() => setApplicantToView(null)}
        onDelete={setApplicantToDelete}
      />

      <DeleteApplicantModal
        applicant={applicantToDelete}
        onClose={() => setApplicantToDelete(null)}
      />
    </div>
  );
}
