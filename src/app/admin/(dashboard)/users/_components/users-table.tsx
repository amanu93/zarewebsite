'use client';

import { ActionIcon, Anchor, Menu, Table, Text } from '@mantine/core';
import { IconDotsVertical, IconEdit, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import type { User } from '@/store/api/users.api';

const fullName = (u: User) =>
  `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const statusStyles = (status?: string) => {
  switch (status) {
    case 'Active':
      return 'bg-[#dcfce7] text-[#166534]';
    case 'Inactive':
      return 'bg-[#fee2e2] text-[#991b1b]';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export function UsersTable({
  users,
  onDelete,
}: {
  users: User[];
  onDelete: (user: User) => void;
}) {
  const rows = users.map((user) => (
    <Table.Tr key={user.id}>
      <Table.Td>
        <Text size="sm" fw={500} c="#101828">
          {fullName(user)}
        </Text>
        <Text size="xs" c="#64748b" mt={2}>
          {user.email}
        </Text>
      </Table.Td>
      <Table.Td>
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles(
            user.status,
          )}`}
        >
          {user.status || '—'}
        </span>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="#64748b">
          {formatDate(user.createdAt)}
        </Text>
      </Table.Td>
      <Table.Td style={{ width: 40 }}>
        <Menu position="bottom-end" withArrow shadow="md">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconEdit size={14} />}
              component={Link}
              href={`/admin/users/${user.id}`}
            >
              Edit
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => onDelete(user)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
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
            backgroundColor: '#ffffff',
            color: '#64748b',
            fontWeight: 500,
            fontSize: '14px',
            borderBottom: '1px solid #e7eaee',
            padding: '12px 16px',
            textAlign: 'left',
          },
          td: {
            borderBottom: '1px solid #e7eaee',
            padding: '16px',
            verticalAlign: 'top',
          },
          tr: {
            '&:hover': {
              backgroundColor: '#f7f8f9 !important',
            },
          },
        }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Joined</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </div>
  );
}

export { fullName as userFullName };
