'use client';

import { useMemo } from 'react';
import { IconArchive } from '@tabler/icons-react';
import { JobsTable } from '../_components/jobs-table';

export default function ExpiredJobsPage() {
  // Filter server-side for anything past its close date.
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const extraWhere = useMemo(
    () => [
      [
        {
          column: 'endDate',
          value: nowIso,
          operator: '<' as const,
        },
      ],
    ],
    [nowIso],
  );

  return (
    <JobsTable
      extraWhere={extraWhere}
      showCreate={false}
      emptyState={{
        icon: <IconArchive size={28} />,
        title: 'Nothing archived yet.',
        description:
          'When a job post passes its close date it will appear here so you can reopen or clone it.',
      }}
    />
  );
}
