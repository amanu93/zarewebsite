'use client';

import Link from 'next/link';

/**
 * Anything that fails while rendering a portal page lands here, inside the
 * portal's own shell, instead of taking the whole screen down.
 */
export default function PortalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="px-5 py-16 text-center">
      <div className="text-[15px] font-medium">Something went wrong on this page</div>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] text-bench-ink-dim">
        Nothing you saved before this was lost. Try again, or go back to the dashboard.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-contrast hover:bg-accent-bright"
        >
          Try again
        </button>
        <Link href="/portal" className="px-3 py-2 text-[12.5px] text-accent hover:text-accent-bright">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
