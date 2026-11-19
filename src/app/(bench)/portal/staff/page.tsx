'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { deleteStaff, staffName, useStaff, type StaffUser } from '@/bench/admin';
import {
  addUser,
  ROLE_LABEL,
  ROLES,
  setUserRole,
  useCurrentUser,
  useUsers,
  type Role,
} from '@/bench/data';
import { initials } from '@/bench/components/candidate-bits';
import { cn, formatDate } from '@/bench/utils';

/**
 * Staff administration, moved here from /admin.
 *
 * Two records back one person: the landing-api account that lets them sign
 * in, and the bench user that carries their portal role. This screen owns
 * the account; the role is edited here too, so an exec has one place to go.
 * Someone who has not signed in yet has no bench row: picking a role for
 * them creates it, and their first sign-in picks it up.
 */

export default function StaffPage() {
  const { data: accounts, loading, error, reload } = useStaff();
  const benchUsers = useUsers();
  const me = useCurrentUser();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(u: StaffUser) {
    if (!confirm(`Remove ${staffName(u)}? They will no longer be able to sign in.`)) {
      return;
    }
    setBusy(u.id);
    try {
      await deleteStaff(u.id);
      reload();
    } catch (err) {
      console.error(err);
      alert('Could not remove this person.');
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(u: StaffUser, role: Role) {
    const bench = benchUsers.find(
      (b) => b.email.toLowerCase() === u.email.toLowerCase(),
    );
    try {
      if (bench) await setUserRole(bench.id, role);
      else await addUser({ full_name: staffName(u), email: u.email, role });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not change the role.');
    }
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-[13px] text-bench-ink-dim">
            Who can sign in, and what they can do in the portal.
          </p>
        </div>
        <Link
          href="/portal/staff/new"
          className="flex h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
        >
          <Plus size={14} /> Add person
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-bench-critical/40 bg-bench-critical/10 px-4 py-3 text-[12.5px] text-bench-critical">
          Could not load staff. Is the API reachable?
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-bench-line bg-bench-surface px-6 py-14 text-center text-[13px] text-bench-ink-dim">
          Loading…
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bench-line bg-bench-surface/40 px-6 py-14 text-center">
          <div className="text-[14px] font-medium">No one yet</div>
          <p className="mt-1 text-[12.5px] text-bench-ink-dim">
            Add the first person to give them a sign-in.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-bench-line bg-bench-surface">
          {accounts.map((u, i) => {
            const bench = benchUsers.find(
              (b) => b.email.toLowerCase() === u.email.toLowerCase(),
            );
            return (
              <li
                key={u.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5',
                  i > 0 && 'border-t border-bench-line',
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bench-surface-3 text-[11px] font-medium text-bench-ink-dim">
                  {initials(staffName(u))}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">
                    {staffName(u)}
                    {me?.email?.toLowerCase() === u.email.toLowerCase() && (
                      <span className="ml-2 text-[11px] text-bench-ink-faint">you</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-bench-ink-faint">
                    <span className="truncate">{u.email}</span>
                    {u.createdAt && (
                      <>
                        <span>·</span>
                        <span>joined {formatDate(u.createdAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <select
                  aria-label={`Portal role for ${staffName(u)}`}
                  value={bench?.role ?? 'recruiter'}
                  onChange={(e) => changeRole(u, e.target.value as Role)}
                  className="h-8 rounded-md border border-bench-line bg-bench-surface-2 px-2 text-[12px] text-bench-ink focus:border-accent/50 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => remove(u)}
                  disabled={busy === u.id}
                  aria-label={`Remove ${staffName(u)}`}
                  className="shrink-0 rounded-md border border-bench-line p-2 text-bench-ink-faint transition-colors hover:border-bench-critical/50 hover:text-bench-critical disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
