'use client';

import { ActionIcon, Menu } from '@mantine/core';
import { IconDotsVertical, IconEdit, IconEye, IconTrash } from '@tabler/icons-react';
import type { Candidate } from '@/store/api/candidates.api';

export function CandidateRowActions({
  candidate,
  onView,
  onEdit,
  onDelete,
}: {
  candidate: Candidate;
  onView: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (c: Candidate) => void;
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
          onClick={() => onView(candidate)}
        >
          View details
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEdit size={14} />}
          onClick={() => onEdit(candidate)}
        >
          Edit
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
          onClick={() => onDelete(candidate)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
