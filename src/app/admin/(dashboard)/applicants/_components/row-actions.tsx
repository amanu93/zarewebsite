'use client';

import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical, IconEye, IconTrash } from '@tabler/icons-react';
import type { AppliedJob } from '@/store/api/applied-jobs.api';

export function RowActions({
  applicant,
  onView,
  onDelete,
}: {
  applicant: AppliedJob;
  onView: (applicant: AppliedJob) => void;
  onDelete: (applicant: AppliedJob) => void;
}) {
  return (
    <Menu position="bottom-end" withArrow shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEye size={14} />}
          onClick={() => onView(applicant)}
        >
          View details
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={() => onDelete(applicant)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
