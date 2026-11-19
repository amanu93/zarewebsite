'use client';

import { ActionIcon, Menu } from '@mantine/core';
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { Job } from '@/store/api/job.api';

export function JobRowActions({
  job,
  onEdit,
  onDelete,
}: {
  job: Job;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
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
          component={Link}
          href={`/careers/${job.id}`}
          target="_blank"
          leftSection={<IconEye size={14} />}
        >
          View public page
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEdit size={14} />}
          onClick={() => onEdit(job)}
        >
          Edit
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={() => onDelete(job)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
