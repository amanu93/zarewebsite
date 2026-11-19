type StatusProps = {
  status: string;
};

export const APPLIED_JOB_STATUS_OPTIONS = [
  'Pending',
  'Shortlisted',
  'Rejected',
  'Hired',
] as const;

export function getStatusStyles(status: string) {
  switch (status) {
    case 'Pending':
      return 'bg-[#e0f2fe] text-[#075985]';
    case 'Shortlisted':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'Rejected':
      return 'bg-[#fee2e2] text-[#991b1b]';
    case 'Hired':
      return 'bg-[#dcfce7] text-[#166534]';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function StatusBadge({ status }: StatusProps) {
  return (
    <span
      className={`inline-block px-2 py-1 rounded-md text-sm font-medium ${getStatusStyles(
        status,
      )}`}
    >
      {status}
    </span>
  );
}
