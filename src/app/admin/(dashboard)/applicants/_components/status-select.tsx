'use client';

import { Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown } from '@tabler/icons-react';
import {
  useUpdateAppliedJobMutation,
  type AppliedJob,
} from '@/store/api/applied-jobs.api';
import {
  APPLIED_JOB_STATUS_OPTIONS,
  getStatusStyles,
} from '../../_components/status-badge';

export function StatusSelect({ applicant }: { applicant: AppliedJob }) {
  const [updateAppliedJob] = useUpdateAppliedJobMutation();

  const handleChange = async (nextStatus: string) => {
    if (nextStatus === applicant.status) return;
    try {
      await updateAppliedJob({
        id: applicant.id,
        data: {
          jobId: applicant.jobId,
          fullName: applicant.fullName,
          email: applicant.email,
          phone: applicant.phone,
          coverLetter: applicant.coverLetter,
          status: nextStatus,
        },
      }).unwrap();
      notifications.show({
        color: 'teal',
        title: 'Status updated',
        message: `${applicant.fullName} is now ${nextStatus}`,
      });
    } catch (err) {
      console.error('Failed to update applicant status', err);
      notifications.show({
        color: 'red',
        title: 'Update failed',
        message: 'Could not change status. Please try again.',
      });
    }
  };

  return (
    <Menu position="bottom-start" withArrow shadow="md">
      <Menu.Target>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium ${getStatusStyles(
            applicant.status,
          )}`}
        >
          <span>{applicant.status}</span>
          <IconChevronDown size={14} />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {APPLIED_JOB_STATUS_OPTIONS.map((option) => (
          <Menu.Item
            key={option}
            onClick={() => handleChange(option)}
            disabled={option === applicant.status}
          >
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusStyles(
                option,
              )}`}
            >
              {option}
            </span>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
