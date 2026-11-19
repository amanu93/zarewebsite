'use client';
import { Table, Text } from '@mantine/core';
import type { AppliedJob } from '@/store/api/applied-jobs.api';
import { StatusSelect } from '../applicants/_components/status-select';
import { RowActions } from '../applicants/_components/row-actions';
import { ResumeCell } from '../applicants/_components/resume-cell';

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

export function ApplicantsTable({
  applicants,
  jobTitleById,
  onView,
  onDelete,
}: {
  applicants: AppliedJob[];
  jobTitleById: Record<string, string>;
  onView: (applicant: AppliedJob) => void;
  onDelete: (applicant: AppliedJob) => void;
}) {
  const rows = applicants.map((applicant) => (
    <Table.Tr
      key={applicant.id}
      onClick={() => onView(applicant)}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        <div className="min-w-0">
          <Text size="sm" fw={600} c="#0a293b" className="truncate">
            {applicant.fullName}
          </Text>
          <Text size="xs" c="#64748b" className="truncate">
            {applicant.email}
          </Text>
        </div>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="#0a293b" className="truncate">
          {jobTitleById[applicant.jobId] ?? applicant.jobId}
        </Text>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <ResumeCell applicantId={applicant.id} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="#64748b">
          {formatRelative(applicant.createdAt)}
        </Text>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <StatusSelect applicant={applicant} />
      </Table.Td>
      <Table.Td
        style={{ width: 40 }}
        onClick={(e) => e.stopPropagation()}
      >
        <RowActions
          applicant={applicant}
          onView={onView}
          onDelete={onDelete}
        />
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <Table
        highlightOnHover
        styles={{
          table: {
            backgroundColor: '#ffffff',
            borderCollapse: 'collapse',
          },
          th: {
            backgroundColor: '#f9fafb',
            color: '#64748b',
            fontWeight: 600,
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            borderBottom: '1px solid #e7eaee',
            padding: '10px 16px',
            textAlign: 'left',
          },
          td: {
            borderBottom: '1px solid #e7eaee',
            padding: '14px 16px',
            verticalAlign: 'middle',
          },
          tr: {
            transition: 'background-color 0.15s',
            '&:hover': {
              backgroundColor: '#f7f8f9 !important',
            },
          },
        }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Applicant</Table.Th>
            <Table.Th>Job</Table.Th>
            <Table.Th>Resume</Table.Th>
            <Table.Th>Applied</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </div>
  );
}
