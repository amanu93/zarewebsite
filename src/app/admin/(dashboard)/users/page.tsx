'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDebounce } from 'use-debounce';
import { useGetUsersQuery, type User } from '@/store/api/users.api';
import { UsersTable } from './_components/users-table';
import { DeleteUserModal } from './_components/delete-user-modal';

// TODO: pass the current admin's organization/account id here instead of "1".
// The `1` is what the debug snippet used and returned real users; needs
// clarification from the backend team once org scoping is formalized.
const DEFAULT_LIST_ID = '1';

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetUsersQuery({
    listId: DEFAULT_LIST_ID,
  });

  const users = useMemo(() => {
    const all = data?.items ?? [];
    const needle = debouncedQuery.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((u) => {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
      return (
        name.includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.role ?? '').toLowerCase().includes(needle) ||
        (u.organizationName ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data, debouncedQuery]);

  const totalCount = data?.items.length ?? 0;
  const showEmpty =
    !isLoading && !isFetching && !isError && users.length === 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0a293b]">Users</h1>
          <p className="text-sm text-[#64748b]">
            Manage admin accounts, roles and organization membership.
          </p>
        </div>
        <Button
          component={Link}
          href="/admin/users/new"
          leftSection={<IconPlus size={16} />}
          color="dark"
          styles={{ root: { backgroundColor: '#1a365d' } }}
        >
          Add user
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] h-4 w-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name, email, role, or organization..."
            className="w-full pl-10 pr-4 py-2 border border-[#e7eaee] rounded-md bg-white text-[#0a293b] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </div>
      </div>

      {totalCount > 0 && (
        <div className="mb-3 text-xs text-[#64748b]">
          Showing {users.length} of {totalCount} user
          {totalCount === 1 ? '' : 's'}
        </div>
      )}

      {isLoading || isFetching ? (
        <div className="rounded-md bg-white border border-[#e7eaee] p-6 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f1f5f9] animate-pulse rounded-sm" />
          ))}
        </div>
      ) : isError ? (
        <Card className="w-max mx-auto flex flex-col items-center gap-4 p-6">
          <span className="text-red-600">
            Failed to load users, please try again.
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
          {debouncedQuery.trim() ? 'No users match your search.' : 'No users yet.'}
        </div>
      ) : (
        <UsersTable users={users} onDelete={setUserToDelete} />
      )}

      <DeleteUserModal
        user={userToDelete}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
}
