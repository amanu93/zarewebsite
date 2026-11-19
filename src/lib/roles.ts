import type { JobType } from '@/types/job';

/**
 * Server-side fetch for open roles.
 *
 * NOTE: `lib/jobs.ts#getAllJobs` does `Array.isArray(data) ? data : []`, but
 * the same endpoint is typed as `{ total, items }` by the RTK Query client in
 * `store/api/job.api.ts`, which is the code actually running in production on
 * /careers. If that typing is right, getAllJobs has always returned an empty
 * array and **the sitemap has never contained a single job URL**, which is a
 * silent SEO loss on the one page type that is Google Jobs eligible.
 *
 * This helper accepts either shape rather than guessing. `lib/jobs.ts` is left
 * untouched here because it is existing logic; the fix belongs in the cutover
 * commit. See docs/CONTENT-CHECKLIST.md.
 */
export async function getOpenRoles(): Promise<JobType[]> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return [];

  try {
    const res = await fetch(`${base}/api/job`, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data: unknown = await res.json();

    if (Array.isArray(data)) return data as JobType[];
    if (
      data &&
      typeof data === 'object' &&
      'items' in data &&
      Array.isArray((data as { items: unknown }).items)
    ) {
      return (data as { items: JobType[] }).items;
    }
    return [];
  } catch {
    // A careers page that renders with an honest empty state beats a page
    // that 500s because a backend was briefly unavailable.
    return [];
  }
}

/**
 * Job descriptions are stored as HTML from the admin rich-text editor. On a
 * clamped card preview the markup is noise, so strip it while preserving
 * paragraph breaks so the clamp reads naturally.
 */
export function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/** Skills arrive as a comma or pipe separated string. */
export function parseSkills(skills: string | undefined): string[] {
  if (!skills) return [];
  return skills
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}
