'use client';

/**
 * Contract generator, moved here from /admin.
 *
 * The generator itself is a self-contained document in
 * `public/contract-generator.html` and stays one: it is a print surface,
 * so it keeps its paper-and-ink look rather than the portal's dark theme —
 * a contract should look like a contract. The portal supplies the frame
 * and the navigation around it.
 */
export default function ContractsPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col px-5 py-6">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Contracts</h1>
        <p className="mt-1 text-[13px] text-bench-ink-dim">
          Generate a contract, then download or print it.
        </p>
      </div>

      <iframe
        src="/contract-generator.html"
        title="Contract generator"
        className="min-h-0 w-full flex-1 rounded-lg border border-bench-line bg-white"
      />
    </div>
  );
}
