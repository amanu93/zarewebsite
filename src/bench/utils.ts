// The site's cn: its tailwind-merge is taught the custom text scale.
export { cn } from '@/lib/utils';

// Every date and day count comes from dates.ts: calendar days in East Africa
// Time. These names stay for the screens that already import them.
export {
  formatDate,
  formatDateLong,
  timeAgo,
  daysFromToday as daysUntil,
} from '@/bench/dates';

export const LAYER_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  ready: { label: 'Ready', dot: 'bg-bench-healthy', text: 'text-bench-healthy' },
  known: { label: 'Known', dot: 'bg-bench-warning', text: 'text-bench-warning' },
  raw: { label: 'Raw', dot: 'bg-bench-ink-faint', text: 'text-bench-ink-faint' },
  archived: { label: 'Archived', dot: 'bg-bench-ink-faint', text: 'text-bench-ink-faint line-through' },
};

export const HEALTH_COLOR: Record<string, string> = {
  green: 'var(--color-bench-healthy)',
  amber: 'var(--color-bench-warning)',
  red: 'var(--color-bench-critical)',
};
