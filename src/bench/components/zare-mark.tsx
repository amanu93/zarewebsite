import { cn } from '@/lib/utils';

/**
 * The Zare mark alone: navy tile, teal Z. For the phone header, where the
 * full lockup does not fit. The paths are the tile and Z from
 * `@/components/layout/logo`, unchanged; keep the two in step.
 */
export function ZareMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 694.72 947.34" role="img" aria-label="Zare Innovations" className={cn('block', className)}>
      <rect width="694.72" height="947.34" fill="#0c293a" />
      <path
        fill="var(--color-accent, #41c1c7)"
        d="m694.72,347.36l-371.04,599.98h-189.47l299.99-497.36L0,686.82v-371.04L189.47,0h189.47l-244.73,426.3,457.88-244.73c9.4-4.97,15-5.76,23.68,0l78.95,55.26v110.52Z"
      />
    </svg>
  );
}
